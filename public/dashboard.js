(function () {
  "use strict";

  const config = Object.assign(
    {
      apiBase: "/bridge/api/v1",
      pollSeconds: 3,
      bambuddyUrl: `${window.location.protocol}//${window.location.hostname}:8001`,
    },
    window.COMMAND_CENTER_CONFIG || {},
  );

  const icons = {
    printer: '<svg class="bambu-mark" viewBox="0 0 94 122" aria-hidden="true"><path d="M50.3856 45.5508V122H94V62.6627L50.3856 45.5508Z" fill="currentColor"/><path d="M50.3856 0V38.2419L94 55.3884V0H50.3856Z" fill="currentColor"/><path d="M0 76.4838V0H43.6143V59.3373L0 76.4838Z" fill="currentColor"/><path d="M0 122V83.7927L43.6143 66.6462V122H0Z" fill="currentColor"/></svg>',
    fullscreen: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></svg>',
    external: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3h7v7M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg>',
    settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    layers: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></svg>',
    nozzle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3h8v6l-2 3v3h-4v-3L8 9V3Z"/><path d="M10 18h4M12 15v3"/></svg>',
    bed: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17h18v3H3zM5 4c0 2 2 2 2 4s-2 2-2 4M12 4c0 2 2 2 2 4s-2 2-2 4M19 4c0 2 2 2 2 4s-2 2-2 4"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5v14M15 5v14"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7V5Z"/></svg>',
    stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
    light: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 22h4"/><path d="M8.2 14.5A7 7 0 1 1 15.8 14.5c-.7.5-.8 1.2-.8 1.5H9c0-.3-.1-1-.8-1.5Z"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7L20 14"/><path d="M20 7v4h-4"/></svg>',
    warning: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5M12 18h.01"/></svg>',
    bell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>',
  };

  // v3.5 introduced the Mark V three-bay design, but existing Fire tablets
  // retained the older HUD + Camera Wall values in localStorage. That exact
  // combination produces two squeezed cards and one oversized auto column.
  // Migrate it once, then leave all later user choices untouched.
  const savedTheme = localStorage.getItem("bcc-theme");
  const savedLayout = localStorage.getItem("bcc-layout");
  if (localStorage.getItem("bcc-mark-v-migrated") !== "1") {
    if (!savedTheme || savedTheme === "arc") localStorage.setItem("bcc-theme", "overdrive");
    if (!savedLayout || savedLayout === "wall") localStorage.setItem("bcc-layout", "grid");
    localStorage.setItem("bcc-mark-v-migrated", "1");
  }

  const state = {
    printers: [],
    statuses: new Map(),
    cards: new Map(),
    pollTimer: null,
    pollSeconds: Number(localStorage.getItem("bcc-poll-seconds")) || Number(config.pollSeconds) || 3,
    wakeLock: null,
    connected: true,
    theme: localStorage.getItem("bcc-theme") || "bambu",
    layout: localStorage.getItem("bcc-layout") || "grid",
    performance: localStorage.getItem("bcc-performance") || (/Silk|Kindle|KF[A-Z0-9]+|Fire/i.test(navigator.userAgent) ? "balanced" : "full"),
    version: "3.7.0",
    previousStatuses: new Map(),
    activeAlertPrinter: null,
    notifications: (() => {
      try {
        const saved = JSON.parse(localStorage.getItem("bcc-notifications") || "[]");
        return Array.isArray(saved) ? saved.slice(0, 30) : [];
      } catch { return []; }
    })(),
  };

  // Camera-first layouts no longer apply to the camera-free console.
  if (!["grid", "rail"].includes(state.layout)) {
    state.layout = "grid";
    localStorage.setItem("bcc-layout", "grid");
  }

  const root = document.getElementById("dashboard-root");
  if (!root) return;

  function applyAppearance() {
    document.documentElement.dataset.theme = state.theme;
    document.documentElement.dataset.layout = state.layout;
    document.documentElement.dataset.performance = state.performance;
    const themeColors = { light: "#eef3f6", overdrive: "#000711", arc: "#020c13", workshop: "#11100e", bambu: "#07100e" };
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeColors[state.theme] || themeColors.bambu);
    const subtitle = document.querySelector(".brand-subtitle");
    if (subtitle) {
      subtitle.textContent = state.theme === "overdrive"
        ? "J.A.R.V.I.S. // MARK V FABRICATION ARRAY"
        : state.theme === "arc" ? "J.A.R.V.I.S. PRINTER ARRAY" : "Local printer control";
    }
  }

  applyAppearance();

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function shell() {
    root.innerHTML = `
      <div class="command-shell">
        <div class="overdrive-backdrop" aria-hidden="true">
          <span class="overdrive-reactor"><i></i><b></b></span>
          <span class="overdrive-scan"></span>
          <span class="overdrive-telemetry overdrive-telemetry-left">SYS. FAB-01<br>REACTOR ONLINE<br>OPTICAL ARRAY LINKED</span>
          <span class="overdrive-telemetry overdrive-telemetry-right">MARK // XLII<br>SECURE LOCAL LINK<br>STATUS NOMINAL</span>
        </div>
        <header class="topbar">
          <div class="brand">
            <div class="brand-mark">${icons.printer}</div>
            <div class="brand-copy">
              <h1 class="brand-title">Bambu Command Center</h1>
              <div class="brand-subtitle">Local printer control</div>
            </div>
          </div>
          <div class="system-summary" id="system-summary">
            <span class="live-dot" id="system-dot"></span>
            <span id="system-summary-text">Connecting to Bambuddy…</span>
          </div>
          <div class="top-actions">
            <time class="clock" id="clock"></time>
            <button class="icon-button notification-button" id="notification-button" aria-label="Open notification center" title="Notifications">${icons.bell}<span class="notification-badge" id="notification-badge" hidden>0</span></button>
            <button class="icon-button" id="fullscreen-button" aria-label="Enter fullscreen" title="Fullscreen">${icons.fullscreen}</button>
            <button class="icon-button" id="bambuddy-button" aria-label="Open Bambuddy" title="Open Bambuddy">${icons.external}</button>
            <button class="icon-button" id="settings-button" aria-label="Dashboard settings" title="Settings">${icons.settings}</button>
          </div>
        </header>
        <aside class="notification-center" id="notification-center" hidden aria-label="Notification center">
          <div class="notification-center-header">
            <div><span class="notification-kicker">J.A.R.V.I.S. event log</span><h2>Notification Center</h2></div>
            <div class="notification-header-actions"><button class="notification-clear" id="notification-clear-all">Clear All</button><button class="notification-close" id="notification-close" aria-label="Close notification center">×</button></div>
          </div>
          <div class="notification-list" id="notification-list"></div>
          <div class="notification-empty" id="notification-empty"><span>${icons.bell}</span><strong>All systems nominal</strong><p>Printer alerts and completed jobs will collect here.</p></div>
          <section class="notification-detail" id="notification-detail" hidden aria-label="Notification details">
            <button class="notification-detail-back" id="notification-detail-back">← Event log</button>
            <div class="notification-detail-title">${icons.warning}<span id="notification-detail-title">Printer notification</span></div>
            <div class="notice-heading"><span class="printer-status-dot" id="notice-dot"></span><div><div class="notice-printer" id="notice-printer"></div><div class="notice-state" id="notice-state"></div></div></div>
            <div class="notice-message" id="notice-message"></div>
            <div class="notice-facts">
              <div><span>Job</span><strong id="notice-job">—</strong></div>
              <div><span>Progress</span><strong id="notice-progress">—</strong></div>
              <div><span>Estimated finish</span><strong id="notice-finish">—</strong></div>
            </div>
            <div class="notice-errors" id="notice-errors" hidden></div>
            <div class="notification-detail-actions"><span class="notice-action-buttons" id="notice-action-buttons"></span><button class="modal-button primary" id="status-open-bambuddy">Open Bambuddy</button></div>
          </section>
        </aside>
        <section class="dashboard" id="dashboard">
          <div class="loading-screen">
            <div class="loading-card">
              <div class="loading-spinner"></div>
              <h2>Connecting to your printers</h2>
              <p>Loading printer status and controls.</p>
            </div>
          </div>
        </section>
      </div>
      <div class="toast-region" id="toast-region" aria-live="assertive"></div>
      <div class="modal-backdrop" id="confirm-modal" hidden>
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div class="modal-header">
            <div class="modal-title danger" id="confirm-title">${icons.warning}<span>Stop this print?</span></div>
            <button class="icon-button" data-close-modal="confirm-modal" aria-label="Close">×</button>
          </div>
          <div class="modal-content"><p id="confirm-copy"></p></div>
          <div class="modal-actions">
            <button class="modal-button" data-close-modal="confirm-modal">Keep Printing</button>
            <button class="modal-button danger" id="confirm-stop">Stop Print</button>
          </div>
        </div>
      </div>
      <div class="modal-backdrop" id="settings-modal" hidden>
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
          <div class="modal-header">
            <div class="modal-title" id="settings-title">${icons.settings}<span>Display Settings</span></div>
            <button class="icon-button" data-close-modal="settings-modal" aria-label="Close">×</button>
          </div>
          <div class="modal-content">
            <div class="setting-row">
              <div><div class="setting-label">Theme</div><div class="setting-help">Change the color, texture, and overall personality.</div></div>
              <select class="setting-select" id="display-theme">
                <option value="bambu">Bambu Dark</option><option value="arc">JARVIS Command HUD</option><option value="overdrive">JARVIS Overdrive // Mark V</option><option value="workshop">Workshop</option><option value="light">Clean Light</option>
              </select>
            </div>
            <div class="setting-row">
              <div><div class="setting-label">Layout</div><div class="setting-help">Choose how multiple printers share the screen.</div></div>
              <select class="setting-select" id="display-layout">
                <option value="grid">Command Grid — equal bays</option><option value="rail">Status Rail — stacked printers</option>
              </select>
            </div>
            <div class="setting-row">
              <div><div class="setting-label">Performance</div><div class="setting-help">Balanced is optimized for Fire tablets while preserving the full HUD design.</div></div>
              <select class="setting-select" id="performance-mode">
                <option value="balanced">Balanced — Fire tablet optimized</option><option value="full">Full effects</option><option value="eco">Eco — maximum smoothness</option>
              </select>
            </div>
            <div class="setting-row">
              <div><div class="setting-label">Status refresh</div><div class="setting-help">How often printer data updates.</div></div>
              <select class="setting-select" id="poll-seconds">
                <option value="2">2 seconds</option><option value="3">3 seconds</option><option value="5">5 seconds</option>
              </select>
            </div>
            <div class="version-row"><span>Automatic updates enabled</span><span id="version-label">v${escapeHtml(state.version)}</span></div>
          </div>
          <div class="modal-actions"><button class="modal-button primary" id="save-settings">Save Settings</button></div>
        </div>
      </div>`;
  }

  async function api(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeout || 8000);
    try {
      const response = await fetch(`${config.apiBase}${path}`, {
        method: options.method || "GET",
        headers: Object.assign({ Accept: "application/json" }, options.headers || {}),
        body: options.body,
        cache: "no-store",
        signal: controller.signal,
      });
      const contentType = response.headers.get("content-type") || "";
      const payload = contentType.includes("application/json") ? await response.json() : await response.text();
      if (!response.ok) {
        const message = payload && typeof payload === "object" ? payload.detail || payload.message : payload;
        throw new Error(message || `Bambuddy returned ${response.status}`);
      }
      return payload;
    } finally {
      clearTimeout(timeout);
    }
  }

  function statusMeta(status) {
    if (!status || !status.connected) return { label: "Offline", tone: "red" };
    if (visibleHmsErrors(status).length) return { label: "Attention", tone: "red" };
    if (plateClearNeeded(status)) return { label: "Clear Plate", tone: "amber" };
    const current = String(status.state || "IDLE").toUpperCase();
    const map = {
      RUNNING: ["Printing", "green"], PAUSE: ["Paused", "amber"], PREPARE: ["Preparing", "amber"],
      SLICING: ["Slicing", "amber"], FINISH: ["Finished", "green"], FAILED: ["Attention", "red"], IDLE: ["Ready", "green"],
    };
    const item = map[current] || [current.replaceAll("_", " "), "green"];
    return { label: item[0], tone: item[1] };
  }

  function activeState(value) {
    return ["RUNNING", "PAUSE", "PREPARE", "SLICING"].includes(String(value || "").toUpperCase());
  }

  function plateClearNeeded(status) {
    return Boolean(status?.awaiting_plate_clear) && !activeState(status?.state);
  }

  function formatTime(minutesValue) {
    const value = Number(minutesValue);
    if (!Number.isFinite(value) || value <= 0) return "—";
    const totalMinutes = Math.max(1, Math.round(value));
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    if (days) return `${days}d ${hours}h`;
    if (hours) return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
    return `${minutes}m`;
  }

  function finishTime(minutesValue) {
    const value = Number(minutesValue);
    if (!Number.isFinite(value) || value <= 0) return "—";
    const finish = new Date(Date.now() + value * 60000);
    const today = new Date();
    const sameDay = finish.getFullYear() === today.getFullYear()
      && finish.getMonth() === today.getMonth()
      && finish.getDate() === today.getDate();
    return new Intl.DateTimeFormat([], sameDay
      ? { hour: "numeric", minute: "2-digit" }
      : { weekday: "short", hour: "numeric", minute: "2-digit" }).format(finish);
  }

  function formatTemp(current, target) {
    const live = Number(current);
    const goal = Number(target);
    if (!Number.isFinite(live)) return "—";
    if (Number.isFinite(goal) && goal > 0) return `${Math.round(live)}° / ${Math.round(goal)}°`;
    return `${Math.round(live)}°`;
  }

  function cleanJobName(status) {
    const raw = status?.subtask_name || status?.current_print || status?.gcode_file;
    if (!raw) return activeState(status?.state) ? "Current print" : "No active print";
    return String(raw).replace(/\.gcode\.3mf$/i, "").replace(/\.3mf$/i, "").replaceAll("_", " ");
  }

  function normalizeColor(value) {
    if (!value) return "#37443f";
    const cleaned = String(value).replace("#", "").slice(0, 6);
    return /^[0-9a-f]{6}$/i.test(cleaned) ? `#${cleaned}` : "#37443f";
  }

  function spoolData(status) {
    const trays = [];
    for (const unit of status?.ams || []) for (const tray of unit.tray || []) trays.push(tray);
    for (const tray of status?.vt_tray || []) trays.push(tray);
    return trays.slice(0, 5);
  }

  function cardTemplate(printer) {
    const id = Number(printer.id);
    return `
      <article class="printer-card" data-printer-id="${id}">
        <div class="bay-identity" aria-hidden="true"><span>FAB BAY</span><strong>${String(id).padStart(2, "0")}</strong></div>
        <div class="status-deck">
          <div class="status-deck-grid" aria-hidden="true"></div>
          <div class="status-orbit" data-role="progress-orbit" style="--progress:0%">
            <div class="status-orbit-core"><strong data-role="hero-progress">—%</strong><span>Complete</span></div>
          </div>
          <div class="status-telemetry">
            <span class="status-kicker">FABRICATION BAY ${String(id).padStart(2, "0")}</span>
            <strong data-role="hero-state">Connecting</strong>
            <span data-role="hero-eta">Synchronizing telemetry</span>
          </div>
          <div class="status-signal" data-role="status-signal"><i></i><span>CONTROL LINK</span><b data-role="control-link">CONNECTING</b></div>
        </div>
        <div class="card-content">
          <div class="card-power-rail" aria-hidden="true"><span></span><b></b><i></i></div>
          <div class="card-heading">
            <div class="card-title">
              <span class="printer-status-dot offline" data-role="status-dot"></span>
              <div><h2 class="printer-name">${escapeHtml(printer.name || `Printer ${id}`)}</h2><div class="printer-model">${escapeHtml(printer.model || "Bambu Lab printer")}</div></div>
            </div>
            <button class="state-pill" data-role="state-pill" data-command="details" data-tone="amber" aria-label="View printer notification">Connecting</button>
          </div>
          <div class="job-row">
            <div class="job-header"><div class="job-name" data-role="job-name">Loading printer status…</div><div class="job-percent" data-role="job-progress">—%</div></div>
            <div class="progress-track"><div class="progress-fill" data-role="progress-fill"></div></div>
          </div>
          <div class="metrics">
            <div class="metric"><span class="metric-icon">${icons.clock}</span><span class="metric-copy"><span class="metric-value" data-role="time">—</span><span class="metric-label" data-role="finish-time">Calculating finish</span></span></div>
            <div class="metric"><span class="metric-icon">${icons.layers}</span><span class="metric-copy"><span class="metric-value" data-role="layers">—</span><span class="metric-label">Layer</span></span></div>
            <div class="metric"><span class="metric-icon">${icons.nozzle}</span><span class="metric-copy"><span class="metric-value" data-role="nozzle">—</span><span class="metric-label">Nozzle</span></span></div>
            <div class="metric"><span class="metric-icon">${icons.bed}</span><span class="metric-copy"><span class="metric-value" data-role="bed">—</span><span class="metric-label">Bed</span></span></div>
          </div>
          <div class="ams-strip" data-role="ams"><span class="ams-label">Filament</span><span class="spool-chip"><span class="spool-color"></span><span class="spool-name">Waiting for spool data</span></span></div>
          <div>
            <div class="speed-row" aria-label="Print speed">
              <button class="speed-button" data-command="speed" data-value="1">Silent</button>
              <button class="speed-button" data-command="speed" data-value="2">Standard</button>
              <button class="speed-button" data-command="speed" data-value="3">Sport</button>
              <button class="speed-button" data-command="speed" data-value="4">Ludicrous</button>
            </div>
            <div class="control-row" style="margin-top:7px">
              <button class="control-button primary" data-command="pause-resume"><span class="button-icon">${icons.pause}</span><span data-role="pause-label">Pause</span></button>
              <button class="control-button" data-command="light"><span class="button-icon">${icons.light}</span><span>Light</span></button>
              <button class="control-button" data-command="refresh"><span class="button-icon" data-role="refresh-icon">${icons.refresh}</span><span data-role="refresh-label">Refresh</span></button>
              <button class="control-button danger" data-command="stop"><span class="button-icon">${icons.stop}</span><span>Stop</span></button>
            </div>
          </div>
        </div>
      </article>`;
  }

  function cacheCard(card, id) {
    const get = (role) => card.querySelector(`[data-role="${role}"]`);
    state.cards.set(id, {
      root: card, progressOrbit: get("progress-orbit"), heroProgress: get("hero-progress"), heroState: get("hero-state"), heroEta: get("hero-eta"), statusSignal: get("status-signal"), controlLink: get("control-link"),
      statusDot: get("status-dot"), statePill: get("state-pill"), jobName: get("job-name"), jobProgress: get("job-progress"), progressFill: get("progress-fill"),
      time: get("time"), finishTime: get("finish-time"), layers: get("layers"), nozzle: get("nozzle"), bed: get("bed"), ams: get("ams"), pauseLabel: get("pause-label"),
      pauseButton: card.querySelector('[data-command="pause-resume"]'), lightButton: card.querySelector('[data-command="light"]'),
      stopButton: card.querySelector('[data-command="stop"]'), refreshButton: card.querySelector('[data-command="refresh"]'),
      refreshIcon: get("refresh-icon"), refreshLabel: get("refresh-label"), speedButtons: Array.from(card.querySelectorAll('[data-command="speed"]')),
      pauseIcon: card.querySelector('[data-command="pause-resume"] .button-icon'),
      amsSignature: null, pauseIconState: null, refreshIconState: null,
    });
  }

  function renderPrinters(printers) {
    const dashboard = document.getElementById("dashboard");
    dashboard.innerHTML = `<div class="printer-grid" data-count="${printers.length}" style="--printer-count:${Math.max(1, printers.length)}">${printers.map(cardTemplate).join("")}</div>`;
    state.cards.clear();
    for (const card of dashboard.querySelectorAll("[data-printer-id]")) {
      const id = Number(card.dataset.printerId);
      cacheCard(card, id);
    }
  }

  function renderEmpty(message) {
    const dashboard = document.getElementById("dashboard");
    dashboard.innerHTML = `
      <div class="empty-screen"><div class="empty-card">
        <h2>Can’t reach Bambuddy</h2><p>${escapeHtml(message || "The local dashboard bridge could not load your printers.")}</p>
        <div class="empty-actions"><button class="soft-button primary" id="retry-button">Try Again</button><button class="soft-button" id="open-bambuddy-empty">Open Bambuddy</button></div>
      </div></div>`;
    document.getElementById("retry-button")?.addEventListener("click", discover);
    document.getElementById("open-bambuddy-empty")?.addEventListener("click", openBambuddy);
  }

  function setText(node, value) {
    if (!node) return;
    const next = String(value);
    if (node.textContent !== next) node.textContent = next;
  }

  function setDisabled(node, value) {
    if (node && node.disabled !== Boolean(value)) node.disabled = Boolean(value);
  }

  function updateCard(printer, status) {
    const refs = state.cards.get(Number(printer.id));
    if (!refs || !status) return;
    const meta = statusMeta(status);
    const progress = Math.max(0, Math.min(100, Number(status.progress) || 0));
    const currentState = String(status.state || "IDLE").toUpperCase();
    const paused = currentState === "PAUSE";
    const printing = activeState(currentState);

    refs.statusDot.classList.toggle("offline", !status.connected);
    refs.statusSignal?.classList.toggle("offline", !status.connected);
    setText(refs.controlLink, status.connected ? "ONLINE" : "OFFLINE");
    setText(refs.statePill, meta.label);
    if (refs.statePill.dataset.tone !== meta.tone) refs.statePill.dataset.tone = meta.tone;
    setText(refs.heroState, meta.label);
    setText(refs.heroProgress, `${Math.round(progress)}%`);
    setText(refs.heroEta, printing ? `Estimated completion ${finishTime(status.remaining_time)}` : (status.connected ? "Standing by for next assignment" : "Printer link unavailable"));
    if (refs.progressOrbit) refs.progressOrbit.style.setProperty("--progress", `${progress}%`);
    setText(refs.jobName, cleanJobName(status));
    setText(refs.jobProgress, `${Math.round(progress)}%`);
    const progressWidth = `${progress}%`;
    if (refs.progressFill.style.width !== progressWidth) refs.progressFill.style.width = progressWidth;
    setText(refs.time, formatTime(status.remaining_time));
    const eta = printing ? finishTime(status.remaining_time) : "—";
    setText(refs.finishTime, eta === "—" ? "Remaining" : `Finishes ${eta}`);
    setText(refs.layers, Number(status.total_layers) > 0 ? `${status.layer_num || 0} / ${status.total_layers}` : "—");
    setText(refs.nozzle, formatTemp(status.temperatures?.nozzle, status.temperatures?.nozzle_target));
    setText(refs.bed, formatTemp(status.temperatures?.bed, status.temperatures?.bed_target));
    setText(refs.pauseLabel, paused ? "Resume" : "Pause");
    const pauseIconState = paused ? "play" : "pause";
    if (refs.pauseIconState !== pauseIconState) {
      refs.pauseIcon.innerHTML = paused ? icons.play : icons.pause;
      refs.pauseIconState = pauseIconState;
    }
    setDisabled(refs.pauseButton, !status.connected || (!paused && currentState !== "RUNNING"));
    setDisabled(refs.stopButton, !status.connected || !printing);
    refs.lightButton.classList.toggle("active", Boolean(status.chamber_light));
    const needsPlateClear = plateClearNeeded(status);
    const refreshCommand = needsPlateClear ? "clear-plate" : "refresh";
    if (refs.refreshButton.dataset.command !== refreshCommand) refs.refreshButton.dataset.command = refreshCommand;
    refs.refreshButton.classList.toggle("active", needsPlateClear);
    if (refs.refreshIconState !== refreshCommand) {
      refs.refreshIcon.innerHTML = needsPlateClear ? icons.layers : icons.refresh;
      refs.refreshIconState = refreshCommand;
    }
    setText(refs.refreshLabel, needsPlateClear ? "Plate Clear" : "Refresh");
    refs.speedButtons.forEach((button) => {
      setDisabled(button, !status.connected || !printing);
      button.classList.toggle("active", Number(button.dataset.value) === Number(status.speed_level));
    });

    const trays = spoolData(status);
    const amsSignature = trays.length
      ? trays.map((tray) => `${tray.tray_type || tray.tray_id_name || "Empty"}:${normalizeColor(tray.tray_color)}`).join("|")
      : "external";
    if (refs.amsSignature === amsSignature) return;
    refs.amsSignature = amsSignature;
    if (trays.length) {
      refs.ams.innerHTML = `<span class="ams-label">Filament</span>${trays.map((tray) => {
        const label = tray.tray_type || tray.tray_id_name || "Empty";
        return `<span class="spool-chip"><span class="spool-color" style="background:${normalizeColor(tray.tray_color)}"></span><span class="spool-name">${escapeHtml(label)}</span></span>`;
      }).join("")}`;
    } else {
      refs.ams.innerHTML = '<span class="ams-label">Filament</span><span class="spool-chip"><span class="spool-color"></span><span class="spool-name">External spool</span></span>';
    }
  }

  function updateSummary() {
    const statuses = Array.from(state.statuses.values());
    const online = statuses.filter((item) => item.connected).length;
    const printing = statuses.filter((item) => activeState(item.state)).length;
    const summary = document.getElementById("system-summary-text");
    const dot = document.getElementById("system-dot");
    setText(summary, `${online} online · ${printing} active · ${state.printers.length} total`);
    if (dot) dot.classList.toggle("offline", !state.connected || online === 0);
  }

  async function pollStatuses() {
    if (!state.printers.length) return;
    const results = await Promise.allSettled(
      state.printers.map(async (printer) => [printer, await api(`/printers/${printer.id}/status`, { timeout: 6500 })]),
    );
    let successes = 0;
    for (const result of results) {
      if (result.status === "fulfilled") {
        successes += 1;
        const [printer, status] = result.value;
        const previousStatus = state.previousStatuses.get(Number(printer.id));
        state.statuses.set(Number(printer.id), status);
        updateCard(printer, status);
        queuePrinterAlert(printer, status, previousStatus);
        state.previousStatuses.set(Number(printer.id), status);
      }
    }
    state.connected = successes > 0;
    updateSummary();
  }

  function schedulePolling() {
    clearInterval(state.pollTimer);
    const effectiveSeconds = state.performance === "eco"
      ? Math.max(8, state.pollSeconds)
      : state.performance === "balanced" ? Math.max(5, state.pollSeconds) : state.pollSeconds;
    state.pollTimer = setInterval(pollStatuses, effectiveSeconds * 1000);
  }

  async function discover() {
    try {
      const payload = await api("/printers/", { timeout: 9000 });
      const printers = Array.isArray(payload) ? payload : payload.printers || payload.items || [];
      if (!printers.length) throw new Error("Bambuddy responded, but no printers are configured.");
      printers.sort((a, b) => {
        const aP2 = /p2s/i.test(`${a.name} ${a.model}`) ? -1 : 0;
        const bP2 = /p2s/i.test(`${b.name} ${b.model}`) ? -1 : 0;
        return aP2 - bP2 || String(a.name).localeCompare(String(b.name));
      });
      state.printers = printers;
      renderPrinters(printers);
      await pollStatuses();
      schedulePolling();
    } catch (error) {
      state.connected = false;
      updateSummary();
      renderEmpty(error?.message || "Connection failed.");
    }
  }

  function toast(message, isError = false) {
    const region = document.getElementById("toast-region");
    if (!region) return;
    const item = document.createElement("div");
    item.className = `toast${isError ? " error" : ""}`;
    item.textContent = message;
    region.appendChild(item);
    setTimeout(() => item.remove(), 3200);
  }

  async function command(printerId, path, successMessage) {
    try {
      const result = await api(`/printers/${printerId}${path}`, { method: "POST", timeout: 10000 });
      toast(result?.message || successMessage || "Command sent");
      setTimeout(pollStatuses, 650);
    } catch (error) {
      toast(error?.message || "The command failed", true);
    }
  }

  async function jsonCommand(printerId, path, body, successMessage) {
    try {
      const result = await api(`/printers/${printerId}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        timeout: 12000,
      });
      toast(result?.message || successMessage || "Command sent");
      closeNotificationCenter();
      setTimeout(pollStatuses, 650);
    } catch (error) {
      toast(error?.message || "The command failed", true);
    }
  }

  function showModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.hidden = false;
  }
  function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.hidden = true;
  }

  const commonHmsMessages = {
    "0300_4006": "The nozzle is clogged.",
    "0300_4008": "The AMS failed to change filament.",
    "0300_400C": "The print was canceled.",
    "0300_8000": "Printing paused for an unknown reason. Check the printer, then resume when it is safe.",
    "0300_8001": "Printing was paused by the user.",
    "0300_8002": "First-layer defects were detected. Check the first layer before continuing.",
    "0300_8003": "Spaghetti defects were detected. Inspect the print before continuing.",
    "0300_8004": "Filament ran out. Load new filament before resuming.",
    "0300_8005": "The toolhead front cover came off. Reinstall it and inspect the print.",
    "0300_8006": "The build-plate marker was not detected. Check the plate position and marker.",
    "0300_8007": "An unfinished job was detected after power loss. You may be able to resume it.",
    "0300_800B": "The filament cutter is stuck.",
    "0300_800C": "A skipped step was detected and auto-recovery completed. Inspect for layer shift before resuming.",
    "0300_800D": "The extruder is not extruding normally. Inspect the print before resuming.",
    "0300_800F": "The enclosure door appears open, so printing was paused.",
    "0300_8011": "The detected build plate does not match the sliced file.",
    "0300_8013": "The print reached a programmed pause.",
    "0300_8015": "The external spool ran out. Load filament, then resume.",
    "0300_8016": "The nozzle may be clogged. Clean it before resuming.",
    "0300_8017": "A foreign object was detected on the heatbed. Clear the bed before resuming.",
    "0300_8019": "No build plate was detected.",
    "0300_801A": "A filament extrusion error was detected. Check the extruder before resuming or canceling.",
    "0500_400E": "Printing was canceled.",
  };

  // Newer P2S firmware currently reports these records, but Bambuddy's own
  // error catalog does not recognize them and the printer supplies no actions.
  // Bambuddy intentionally suppresses uncataloged, non-actionable HMS records.
  const ignoredHmsFullCodes = new Set([
    "0500060000020070",
    "050002000003000A",
  ]);

  function visibleHmsErrors(status) {
    const errors = Array.isArray(status?.hms_errors) ? status.hms_errors : [];
    return errors.filter((error) => {
      const fullCode = String(error?.full_code || "").toUpperCase().replace(/[^0-9A-F]/g, "");
      return !ignoredHmsFullCodes.has(fullCode) || (Array.isArray(error?.actions) && error.actions.length > 0);
    });
  }

  function hmsCode(error) {
    const raw = String(error?.full_code || error?.code || "UNKNOWN").toUpperCase().replace(/[^0-9A-F]/g, "");
    const attr = Number(error?.attr);
    const codeNumber = Number.parseInt(String(error?.code || "0").replace(/[^0-9A-F]/gi, ""), 16);
    if (Number.isFinite(attr) && Number.isFinite(codeNumber)) {
      const module = ((attr >> 16) & 0xFFFF) || (((attr >> 8) & 0xFF) << 8) | (attr & 0xFF);
      return `${module.toString(16).padStart(4, "0").toUpperCase()}_${(codeNumber & 0xFFFF).toString(16).padStart(4, "0").toUpperCase()}`;
    }
    if (raw.length === 8) return `${raw.slice(0, 4)}_${raw.slice(4)}`;
    if (raw.length >= 16) return `${raw.slice(0, 4)}_${raw.slice(-4)}`;
    return String(error?.code || error?.full_code || "Unknown");
  }

  function hmsSeverity(error) {
    return ({ 1: "Fatal", 2: "Serious", 3: "Warning" })[Number(error?.severity)] || "Information";
  }

  function hmsMessage(error) {
    const code = hmsCode(error);
    return commonHmsMessages[code] || `The printer reported HMS ${code}. Follow the printer's on-screen guidance or open Bambuddy for the full troubleshooting entry.`;
  }

  function actionLabel(action) {
    const overrides = {
      resume_after_error: "Resume Print", retry: "Try Again", done: "Done",
      check_filament: "Filament Checked", check_assistant: "Open Assistant",
      continue_print: "Continue", stop_print: "Stop Print",
    };
    const key = String(action || "").toLowerCase();
    return overrides[key] || key.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function alertDescriptor(status) {
    const errors = visibleHmsErrors(status);
    if (errors.length) return { kind: "hms", signature: `hms:${errors.map(hmsCode).sort().join(",")}`, important: true };
    if (plateClearNeeded(status)) return { kind: "plate", signature: `plate:${cleanJobName(status)}`, important: true };
    const current = String(status?.state || "").toUpperCase();
    if (current === "FAILED") return { kind: "failed", signature: `failed:${cleanJobName(status)}`, important: true };
    if (current === "FINISH") return { kind: "finish", signature: `finish:${cleanJobName(status)}`, important: true };
    if (current === "PAUSE") return { kind: "pause", signature: `pause:${cleanJobName(status)}`, important: false };
    return null;
  }

  function queuePrinterAlert(printer, status, previousStatus) {
    const alert = alertDescriptor(status);
    if (!alert) return;
    const previous = alertDescriptor(previousStatus);
    if (previous?.signature === alert.signature) return;
    if (!alert.important && !previousStatus) return;
    const duplicate = state.notifications.some((item) => Number(item.printerId) === Number(printer.id) && item.signature === alert.signature);
    if (duplicate) return;
    const meta = statusMeta(status);
    const snapshotKeys = [
      "connected", "state", "progress", "subtask_name", "current_print", "gcode_file", "remaining_time",
      "layer_num", "total_layers", "temperatures", "awaiting_plate_clear", "hms_errors", "error_message",
      "error", "message", "notification", "warning", "finish_reason", "hms_message", "print_error",
      "notifications", "alerts", "warnings", "errors", "hms", "speed_level", "chamber_light",
    ];
    const snapshot = {};
    snapshotKeys.forEach((key) => { if (status?.[key] !== undefined) snapshot[key] = status[key]; });
    state.notifications.unshift({
      id: `${Date.now()}-${printer.id}-${Math.random().toString(16).slice(2, 8)}`,
      printerId: Number(printer.id), printerName: printer.name || `Printer ${printer.id}`,
      kind: alert.kind, signature: alert.signature, important: alert.important,
      createdAt: Date.now(), read: false, stateLabel: meta.label,
      job: cleanJobName(status), message: noticeText(status, meta), snapshot,
    });
    state.notifications = state.notifications.slice(0, 30);
    persistNotifications();
    renderNotificationCenter();
  }

  function persistNotifications() {
    try { localStorage.setItem("bcc-notifications", JSON.stringify(state.notifications)); }
    catch {
      state.notifications = state.notifications.slice(0, 12);
      try { localStorage.setItem("bcc-notifications", JSON.stringify(state.notifications)); } catch { /* Storage is optional. */ }
    }
  }

  function notificationTitle(kind) {
    return ({ hms: "Printer needs attention", plate: "Build plate needs clearing", failed: "Print failed", finish: "Print finished", pause: "Print paused" })[kind] || "Printer update";
  }

  function notificationTime(value) {
    const date = new Date(Number(value) || Date.now());
    const sameDay = date.toDateString() === new Date().toDateString();
    return new Intl.DateTimeFormat([], sameDay ? { hour: "numeric", minute: "2-digit" } : { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
  }

  function renderNotificationCenter() {
    const list = document.getElementById("notification-list");
    const empty = document.getElementById("notification-empty");
    const detail = document.getElementById("notification-detail");
    const badge = document.getElementById("notification-badge");
    const button = document.getElementById("notification-button");
    const clear = document.getElementById("notification-clear-all");
    const unread = state.notifications.filter((item) => !item.read).length;
    if (badge) {
      badge.textContent = unread > 99 ? "99+" : String(unread);
      badge.hidden = unread === 0;
    }
    button?.classList.toggle("has-notifications", unread > 0);
    if (clear) clear.disabled = state.notifications.length === 0;
    if (!list || !empty) return;
    const showingDetail = Boolean(detail && !detail.hidden);
    empty.hidden = showingDetail || state.notifications.length > 0;
    list.hidden = showingDetail || state.notifications.length === 0;
    list.innerHTML = state.notifications.map((item) => `
      <article class="notification-item${item.read ? "" : " unread"}" data-notification-id="${escapeHtml(item.id)}">
        <button class="notification-open" data-notification-action="open">
          <span class="notification-severity" data-kind="${escapeHtml(item.kind)}"></span>
          <span class="notification-copy"><span class="notification-item-top"><strong>${escapeHtml(notificationTitle(item.kind))}</strong><time>${escapeHtml(notificationTime(item.createdAt))}</time></span><span class="notification-printer">${escapeHtml(item.printerName)} · ${escapeHtml(item.stateLabel || "Update")}</span><span class="notification-job">${escapeHtml(item.job || "No active job")}</span><span class="notification-preview">${escapeHtml(item.message || "Open for details")}</span></span>
        </button>
        <button class="notification-dismiss" data-notification-action="dismiss" aria-label="Dismiss notification">×</button>
      </article>`).join("");
  }

  function openNotificationCenter() {
    const center = document.getElementById("notification-center");
    const button = document.getElementById("notification-button");
    if (!center) return;
    center.hidden = false;
    button?.classList.add("active");
    button?.setAttribute("aria-expanded", "true");
    renderNotificationCenter();
  }

  function showNotificationList() {
    const detail = document.getElementById("notification-detail");
    if (detail) detail.hidden = true;
    state.activeAlertPrinter = null;
    renderNotificationCenter();
  }

  function closeNotificationCenter() {
    const center = document.getElementById("notification-center");
    const button = document.getElementById("notification-button");
    if (center) center.hidden = true;
    button?.classList.remove("active");
    button?.setAttribute("aria-expanded", "false");
    showNotificationList();
  }

  function noticeText(status, meta) {
    const hmsErrors = visibleHmsErrors(status);
    if (hmsErrors.length) return hmsErrors.map((error) => hmsMessage(error)).join("\n\n");
    const direct = [
      status?.error_message, status?.error, status?.message, status?.notification,
      status?.warning, status?.finish_reason, status?.hms_message, status?.print_error,
    ].find((value) => typeof value === "string" && value.trim());
    if (direct) return direct.trim();

    const collections = [status?.notifications, status?.alerts, status?.warnings, status?.errors, status?.hms];
    const messages = [];
    for (const collection of collections) {
      if (!Array.isArray(collection)) continue;
      for (const item of collection) {
        if (typeof item === "string" && item.trim()) messages.push(item.trim());
        else if (item && typeof item === "object") {
          const value = item.message || item.text || item.description || item.title || item.code || item.error_code;
          if (value !== undefined && String(value).trim()) messages.push(String(value).trim());
        }
      }
    }
    if (messages.length) return [...new Set(messages)].join("\n");

    if (String(status?.state || "").toUpperCase() === "FINISH") {
      return "The print finished successfully. Bambuddy did not report any additional notification.";
    }
    if (meta.tone === "red") {
      return "The printer reports that attention is required, but no detailed message was included. Open Bambuddy to view the full printer notification.";
    }
    return `The printer is currently ${meta.label.toLowerCase()}. No additional notification was reported.`;
  }

  function renderNoticeErrors(printerId, status) {
    const errors = visibleHmsErrors(status);
    const list = document.getElementById("notice-errors");
    const actions = document.getElementById("notice-action-buttons");
    if (!list || !actions) return;
    list.hidden = !errors.length;
    list.innerHTML = errors.map((error) => `<div class="notice-error-row"><span>${escapeHtml(hmsCode(error))}</span><strong>${escapeHtml(hmsSeverity(error))}</strong></div>`).join("");
    const actionItems = [];
    errors.forEach((error, errorIndex) => {
      (Array.isArray(error.actions) ? error.actions : []).forEach((action) => actionItems.push({ error, errorIndex, action }));
    });
    actions.innerHTML = actionItems.map((item, index) => `<button class="modal-button primary notice-hms-action" data-action-index="${index}">${escapeHtml(actionLabel(item.action))}</button>`).join("");
    if (errors.length) actions.insertAdjacentHTML("beforeend", '<button class="modal-button notice-clear-hms" data-command="clear-hms">Clear Alert</button>');
    if (plateClearNeeded(status)) actions.insertAdjacentHTML("beforeend", '<button class="modal-button primary" data-notice-command="clear-plate">Plate Is Clear</button>');
    else if (!errors.length && String(status?.state || "").toUpperCase() === "PAUSE") actions.insertAdjacentHTML("beforeend", '<button class="modal-button primary" data-notice-command="resume">Resume Print</button>');
    actions.querySelectorAll("[data-action-index]").forEach((button) => {
      button.addEventListener("click", () => {
        const item = actionItems[Number(button.dataset.actionIndex)];
        if (!item) return;
        jsonCommand(printerId, "/hms/execute-action", {
          action: item.action,
          print_error: item.error.full_code || String(item.error.code || "").replaceAll("_", ""),
          job_id: item.error.job_id ?? null,
        }, `${actionLabel(item.action)} sent`);
      });
    });
    actions.querySelector("[data-command='clear-hms']")?.addEventListener("click", () => {
      closeNotificationCenter();
      command(printerId, "/hms/clear", "Printer alert cleared");
    });
    actions.querySelector("[data-notice-command='clear-plate']")?.addEventListener("click", () => {
      closeNotificationCenter();
      command(printerId, "/clear-plate", "Plate marked clear");
    });
    actions.querySelector("[data-notice-command='resume']")?.addEventListener("click", () => {
      closeNotificationCenter();
      command(printerId, "/print/resume", "Resume command sent");
    });
  }

  function showStatusDetails(printerId, suppliedStatus = null, alertKind = null) {
    state.activeAlertPrinter = Number(printerId);
    const printer = state.printers.find((item) => Number(item.id) === Number(printerId));
    const status = suppliedStatus || state.statuses.get(Number(printerId)) || {};
    const meta = statusMeta(status);
    const progress = Math.max(0, Math.min(100, Number(status.progress) || 0));
    const title = document.getElementById("notification-detail-title");
    const titleByKind = {
      hms: "Printer needs attention", plate: "Print finished — clear the plate",
      failed: "Print failed", finish: "Print finished", pause: "Print paused",
    };
    if (title) title.textContent = titleByKind[alertKind] || (meta.tone === "red" ? "Printer needs attention" : `${meta.label} details`);
    document.getElementById("notice-printer").textContent = printer?.name || "Printer";
    document.getElementById("notice-state").textContent = meta.label;
    document.getElementById("notice-message").textContent = noticeText(status, meta);
    document.getElementById("notice-job").textContent = cleanJobName(status);
    document.getElementById("notice-progress").textContent = `${Math.round(progress)}%`;
    document.getElementById("notice-finish").textContent = activeState(status.state) ? finishTime(status.remaining_time) : "—";
    renderNoticeErrors(printerId, status);
    const dot = document.getElementById("notice-dot");
    if (dot) dot.classList.toggle("offline", meta.tone === "red" || !status.connected);
    const detail = document.getElementById("notification-detail");
    if (detail) detail.hidden = false;
    openNotificationCenter();
  }

  function askStop(printerId) {
    const printer = state.printers.find((item) => Number(item.id) === Number(printerId));
    const status = state.statuses.get(Number(printerId));
    document.getElementById("confirm-copy").textContent = `This will permanently stop “${cleanJobName(status)}” on ${printer?.name || "this printer"}. It cannot be resumed.`;
    const confirm = document.getElementById("confirm-stop");
    confirm.dataset.printerId = String(printerId);
    showModal("confirm-modal");
  }

  async function requestFullscreen() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      toast("Silk blocked fullscreen. Use its Full Screen option instead.", true);
    }
  }

  function openBambuddy() { window.location.href = config.bambuddyUrl; }

  async function requestWakeLock() {
    if (!("wakeLock" in navigator)) return;
    try { state.wakeLock = await navigator.wakeLock.request("screen"); }
    catch { /* Older Fire OS versions use Stay awake while charging. */ }
  }

  function bindEvents() {
    const notificationCenter = document.getElementById("notification-center");
    const notificationButton = document.getElementById("notification-button");
    notificationButton?.addEventListener("click", () => {
      if (!notificationCenter) return;
      if (notificationCenter.hidden) {
        showNotificationList();
        openNotificationCenter();
      } else closeNotificationCenter();
    });
    document.getElementById("notification-close")?.addEventListener("click", closeNotificationCenter);
    document.getElementById("notification-detail-back")?.addEventListener("click", showNotificationList);
    document.getElementById("notification-clear-all")?.addEventListener("click", () => {
      state.notifications = [];
      persistNotifications();
      showNotificationList();
      renderNotificationCenter();
    });
    document.getElementById("notification-list")?.addEventListener("click", (event) => {
      const itemElement = event.target.closest("[data-notification-id]");
      const actionElement = event.target.closest("[data-notification-action]");
      if (!itemElement || !actionElement) return;
      const index = state.notifications.findIndex((item) => item.id === itemElement.dataset.notificationId);
      if (index < 0) return;
      if (actionElement.dataset.notificationAction === "dismiss") {
        state.notifications.splice(index, 1);
        persistNotifications();
        renderNotificationCenter();
        return;
      }
      const item = state.notifications[index];
      item.read = true;
      persistNotifications();
      renderNotificationCenter();
      showStatusDetails(item.printerId, item.snapshot, item.kind);
    });
    document.getElementById("fullscreen-button")?.addEventListener("click", requestFullscreen);
    document.getElementById("bambuddy-button")?.addEventListener("click", openBambuddy);
    document.getElementById("settings-button")?.addEventListener("click", () => {
      document.getElementById("display-theme").value = state.theme;
      document.getElementById("display-layout").value = state.layout;
      document.getElementById("performance-mode").value = state.performance;
      document.getElementById("poll-seconds").value = String(state.pollSeconds);
      showModal("settings-modal");
    });
    document.getElementById("save-settings")?.addEventListener("click", () => {
      const nextPoll = Number(document.getElementById("poll-seconds").value) || 3;
      const nextTheme = document.getElementById("display-theme").value || "bambu";
      const nextLayout = document.getElementById("display-layout").value || "grid";
      const nextPerformance = document.getElementById("performance-mode").value || "balanced";
      state.pollSeconds = nextPoll;
      state.theme = nextTheme;
      state.layout = nextLayout;
      state.performance = nextPerformance;
      localStorage.setItem("bcc-poll-seconds", String(nextPoll));
      localStorage.setItem("bcc-theme", nextTheme);
      localStorage.setItem("bcc-layout", nextLayout);
      localStorage.setItem("bcc-performance", nextPerformance);
      applyAppearance();
      schedulePolling();
      closeModal("settings-modal");
      toast("Display settings saved");
    });
    document.querySelectorAll("[data-close-modal]").forEach((button) => {
      button.addEventListener("click", () => closeModal(button.dataset.closeModal));
    });
    document.getElementById("confirm-stop")?.addEventListener("click", (event) => {
      const id = Number(event.currentTarget.dataset.printerId);
      closeModal("confirm-modal");
      command(id, "/print/stop", "Stop command sent");
    });
    document.getElementById("status-open-bambuddy")?.addEventListener("click", openBambuddy);
    document.getElementById("dashboard")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-command]");
      if (!button || button.disabled) return;
      const card = button.closest("[data-printer-id]");
      if (!card) return;
      const id = Number(card.dataset.printerId);
      const status = state.statuses.get(id);
      switch (button.dataset.command) {
        case "details": showStatusDetails(id); break;
        case "pause-resume":
          if (String(status?.state).toUpperCase() === "PAUSE") command(id, "/print/resume", "Resume command sent");
          else command(id, "/print/pause", "Pause command sent");
          break;
        case "stop": askStop(id); break;
        case "light": command(id, `/chamber-light?on=${!status?.chamber_light}`, "Light command sent"); break;
        case "refresh": command(id, "/refresh-status", "Status refresh requested"); break;
        case "clear-plate": command(id, "/clear-plate", "Plate marked clear"); break;
        case "speed": command(id, `/print-speed?mode=${button.dataset.value}`, "Print speed updated"); break;
      }
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "hidden") { requestWakeLock(); pollStatuses(); }
    });
  }

  function startClock() {
    const update = () => {
      const clock = document.getElementById("clock");
      if (clock) clock.textContent = new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" }).format(new Date());
    };
    update();
    setInterval(update, 15000);
  }

  async function loadVersion() {
    try {
      const response = await fetch(`/version.json?ts=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      state.version = data.version || state.version;
      const label = document.getElementById("version-label");
      if (label) label.textContent = `v${state.version}`;
    } catch { /* Version display is optional. */ }
  }

  shell();
  applyAppearance();
  bindEvents();
  renderNotificationCenter();
  startClock();
  loadVersion();
  requestWakeLock();
  discover();
})();
