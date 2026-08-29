import { createReadStream, promises as fs } from "node:fs";
import { createServer, request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { connect as netConnect } from "node:net";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const localPublic = join(here, "public");
const sharedPublic = join(here, "..", "public");
const port = Number(process.env.PORT || 8092);
const bambuddyUrl = new URL(process.env.BAMBUDDY_URL || "http://127.0.0.1:8001");
const browserUrl = process.env.BAMBUDDY_BROWSER_URL || "";
const apiKey = process.env.BAMBUDDY_API_KEY || "";
const cameraToken = process.env.BAMBUDDY_CAMERA_TOKEN || "";
const thinClient = /^(1|true|yes|on)$/i.test(process.env.THIN_CLIENT || "");
const go2rtcUrl = new URL(process.env.GO2RTC_URL || "http://127.0.0.1:1984");

const mime = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

function securityHeaders(response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "SAMEORIGIN");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' ws: wss:; frame-ancestors 'self'",
  );
}

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}

function proxy(request, response) {
  const incoming = new URL(request.url, "http://dashboard.local");
  const upstreamPath = incoming.pathname.slice("/bridge".length);
  if (!upstreamPath.startsWith("/api/v1/")) {
    json(response, 403, { detail: "Only Bambuddy API paths are allowed" });
    return;
  }

  const target = new URL(upstreamPath + incoming.search, bambuddyUrl);
  if (cameraToken && upstreamPath.includes("/camera/")) target.searchParams.set("token", cameraToken);
  const transport = target.protocol === "https:" ? httpsRequest : httpRequest;
  const headers = {
    accept: request.headers.accept || "application/json",
    "accept-encoding": "identity",
    "user-agent": "Bambu-Command-Center/1.0",
  };
  if (request.headers["content-type"]) headers["content-type"] = request.headers["content-type"];
  if (request.headers["content-length"]) headers["content-length"] = request.headers["content-length"];
  if (apiKey) headers["x-api-key"] = apiKey;

  const upstream = transport(
    target,
    { method: request.method, headers, timeout: 30000 },
    (upstreamResponse) => {
      const responseHeaders = {};
      for (const [key, value] of Object.entries(upstreamResponse.headers)) {
        if (value !== undefined && !["connection", "keep-alive", "transfer-encoding"].includes(key)) responseHeaders[key] = value;
      }
      responseHeaders["cache-control"] = "no-store";
      responseHeaders["x-accel-buffering"] = "no";
      response.writeHead(upstreamResponse.statusCode || 502, responseHeaders);
      upstreamResponse.pipe(response);
    },
  );

  upstream.on("timeout", () => upstream.destroy(new Error("Bambuddy request timed out")));
  upstream.on("error", (error) => {
    if (!response.headersSent) json(response, 502, { detail: `Cannot reach Bambuddy: ${error.message}` });
    else response.destroy(error);
  });
  request.on("aborted", () => upstream.destroy());
  response.on("close", () => { if (!response.writableEnded) upstream.destroy(); });
  request.pipe(upstream);
}

function thinHealth(request, response) {
  if (!thinClient) {
    json(response, 200, { enabled: false, available: false });
    return;
  }
  const incoming = new URL(request.url, "http://dashboard.local");
  const stream = incoming.searchParams.get("stream") || "";
  if (!/^printer_\d+$/.test(stream)) {
    json(response, 400, { enabled: true, available: false, detail: "Invalid stream name" });
    return;
  }
  const target = new URL(`/api/streams?src=${encodeURIComponent(stream)}`, go2rtcUrl);
  const check = httpRequest(target, { timeout: 2500 }, (upstreamResponse) => {
    upstreamResponse.resume();
    json(response, 200, { enabled: true, available: upstreamResponse.statusCode === 200, stream });
  });
  check.on("timeout", () => check.destroy(new Error("go2rtc timed out")));
  check.on("error", () => json(response, 200, { enabled: true, available: false, stream }));
  check.end();
}

async function staticFile(request, response) {
  const incoming = new URL(request.url, "http://dashboard.local");
  if (incoming.pathname === "/runtime-config.js") {
    const resolvedBrowserUrl = browserUrl || `http://${request.headers.host?.split(":")[0] || "127.0.0.1"}:8001`;
    securityHeaders(response);
    response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store" });
    response.end(`window.COMMAND_CENTER_CONFIG=${JSON.stringify({ bambuddyUrl: resolvedBrowserUrl, thinClient, go2rtcUrl: "/go2rtc" })};`);
    return;
  }

  const pathname = incoming.pathname === "/" ? "/index.html" : decodeURIComponent(incoming.pathname);
  const safe = normalize(pathname).replace(/^(\.\.[/\\])+/, "").replace(/^[/\\]+/, "");
  const candidates = [join(localPublic, safe), join(sharedPublic, safe)];
  let selected = null;
  for (const candidate of candidates) {
    if (!candidate.startsWith(localPublic) && !candidate.startsWith(sharedPublic)) continue;
    try {
      const stat = await fs.stat(candidate);
      if (stat.isFile()) { selected = { candidate, stat }; break; }
    } catch {
      // Try the shared public directory next.
    }
  }
  if (!selected) {
    json(response, 404, { detail: "Not found" });
    return;
  }

  securityHeaders(response);
  response.writeHead(200, {
    "Content-Type": mime[extname(selected.candidate).toLowerCase()] || "application/octet-stream",
    "Content-Length": selected.stat.size,
    "Cache-Control": "no-store",
  });
  createReadStream(selected.candidate).pipe(response);
}

const server = createServer((request, response) => {
  securityHeaders(response);
  if (request.url === "/health") {
    json(response, 200, { status: "ok", bambuddy: bambuddyUrl.origin });
    return;
  }
  if (request.url?.startsWith("/bridge/")) {
    proxy(request, response);
    return;
  }
  if (request.url?.startsWith("/thin/health")) {
    thinHealth(request, response);
    return;
  }
  staticFile(request, response).catch((error) => json(response, 500, { detail: error.message }));
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Bambu Command Center listening on http://0.0.0.0:${port}`);
  console.log(`Proxying Bambuddy at ${bambuddyUrl.origin}`);
});

server.on("upgrade", (request, socket, head) => {
  const incoming = new URL(request.url || "/", "http://dashboard.local");
  if (!thinClient || incoming.pathname !== "/go2rtc/api/ws") {
    socket.destroy();
    return;
  }

  const upstream = netConnect(Number(go2rtcUrl.port || 1984), go2rtcUrl.hostname, () => {
    const forwarded = [];
    for (let i = 0; i < request.rawHeaders.length; i += 2) {
      if (request.rawHeaders[i].toLowerCase() === "host") continue;
      forwarded.push(`${request.rawHeaders[i]}: ${request.rawHeaders[i + 1]}`);
    }
    const path = incoming.pathname.slice("/go2rtc".length) + incoming.search;
    upstream.write(`${request.method} ${path} HTTP/${request.httpVersion}\r\nHost: ${go2rtcUrl.host}\r\n${forwarded.join("\r\n")}\r\n\r\n`);
    if (head.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
