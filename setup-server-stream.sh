#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$project_dir"

dashboard_url="${COMMAND_CENTER_URL:-http://127.0.0.1:8092}"
server_ip="$(hostname -I | awk '{print $1}')"
printer_file="$(mktemp)"
trap 'rm -f "$printer_file"' EXIT

echo "Reading printers from Bambu Command Center..."
curl -fsS "$dashboard_url/bridge/api/v1/printers/" > "$printer_file"

python3 /dev/fd/3 "$printer_file" "$project_dir/go2rtc.yaml" "$server_ip" 3<<'PY'
import getpass
import json
import sys
from pathlib import Path
from urllib.parse import quote

printer_file, output_file, server_ip = sys.argv[1:]
payload = json.loads(Path(printer_file).read_text(encoding="utf-8"))
printers = payload if isinstance(payload, list) else payload.get("printers") or payload.get("items") or []
if not isinstance(printers, list) or not printers:
    raise SystemExit("No printers were returned by Bambu Command Center.")

streams = {}
print("\nServer Stream setup keeps all access codes inside local go2rtc.yaml.")
print("Nothing entered here is uploaded to GitHub.\n")

for printer in printers:
    printer_id = int(printer.get("id"))
    name = str(printer.get("name") or f"Printer {printer_id}")
    model = str(printer.get("model") or "")
    ip = str(printer.get("ip_address") or printer.get("ip") or printer.get("host") or "")
    external = str(printer.get("external_camera_url") or "")
    source = ""

    print(f"[{printer_id}] {name} ({model or 'unknown model'})")
    if external.lower().startswith(("rtsp://", "rtsps://")):
        use_external = input("  Use its existing external RTSP camera? [Y/n]: ").strip().lower()
        if use_external in ("", "y", "yes"):
            source = external

    if not source and "P2S" in model.upper():
        if not ip:
            ip = input("  Printer LAN IP: ").strip()
        access_code = getpass.getpass("  P2S LAN access code (hidden): ").strip()
        if ip and access_code:
            source = f"rtsps://bblp:{quote(access_code, safe='')}@{ip}:322/streaming/live/1"

    if not source:
        manual = getpass.getpass("  Direct RTSP URL, or Enter to keep Bambuddy fallback (hidden): ").strip()
        if manual.lower().startswith(("rtsp://", "rtsps://")):
            source = manual

    if source:
        streams[f"printer_{printer_id}"] = source
        print("  Direct H.264 stream configured.\n")
    else:
        print("  Using Bambuddy MJPEG fallback for this printer.\n")

if not streams:
    raise SystemExit("No direct streams were configured; no files were changed.")

lines = [
    "api:",
    '  listen: "127.0.0.1:1984"',
    '  origin: "*"',
    "rtsp:",
    '  listen: "127.0.0.1:8556"',
    "webrtc:",
    '  listen: ":8555"',
    "  candidates:",
    f"    - {json.dumps(server_ip + ':8555')}",
    "streams:",
]
for name, source in streams.items():
    lines.append(f"  {name}: {json.dumps(source)}")

path = Path(output_file)
path.write_text("\n".join(lines) + "\n", encoding="utf-8")
path.chmod(0o600)
print(f"Configured {len(streams)} direct stream(s).")
PY

touch .env
if grep -q '^THIN_CLIENT=' .env; then
  sed -i 's/^THIN_CLIENT=.*/THIN_CLIENT=true/' .env
else
  printf '\nTHIN_CLIENT=true\n' >> .env
fi
if grep -q '^GO2RTC_URL=' .env; then
  sed -i 's|^GO2RTC_URL=.*|GO2RTC_URL=http://127.0.0.1:1984|' .env
else
  printf 'GO2RTC_URL=http://127.0.0.1:1984\n' >> .env
fi

echo "Starting the server-stream helper and recreating Command Center..."
docker compose --profile thin-client pull go2rtc bambu-command-center
docker compose --profile thin-client up -d --force-recreate go2rtc bambu-command-center

echo
echo "Server Stream mode is enabled. Open $dashboard_url and hard-refresh the tablet."
echo "WebRTC media stays local on TCP/UDP port 8555; do not forward that port through your router."
