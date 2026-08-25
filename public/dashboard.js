(function () {
  "use strict";

  const config = Object.assign(
    {
      apiBase: "/bridge/api/v1",
      cameraFps: 8,
      pollSeconds: 3,
      bambuddyUrl: `${window.location.protocol}//${window.location.hostname}:8001`,
    },
    window.COMMAND_CENTER_CONFIG || {},
  );

  const icons = {
    printer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6z"/><path d="M18 12h.01"/></svg>',
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
    focus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"/></svg>',
  };

  const state = {
    printers: [],
    statuses: new Map(),
    cards: new Map(),
    pollTimer: null,
    pollSeconds: Number(localStorage.getItem("bcc-poll-seconds")) || Number(config.pollSeconds) || 3,
    cameraFps: Number(localStorage.getItem("bcc-camera-fps")) || Number(config.cameraFps) || 8,
    wakeLock: null,
    connected: true,
    theme: localStorage.getItem("bcc-theme") || "bambu",
    layout: localStorage.getItem("bcc-layout") || "grid",
    focusedPrinter: null,
    version: "3.0.0",
  };

  const root = document.getElementById("dashboard-root");
  if (!root) return;

  function applyAppearance() {
    document.documentElement.dataset.theme = state.theme;
    document.documentElement.dataset.layout = state.layout;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", state.theme === "light" ? "#eef3f6" : "#07100e");
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
            <button class="icon-button" id="fullscreen-button" aria-label="Enter fullscreen" title="Fullscreen">${icons.fullscreen}</button>
            <button class="icon-button" id="bambuddy-button" aria-label="Open Bambuddy" title="Open Bambuddy">${icons.external}</button>
            <button class="icon-button" id="settings-button" aria-label="Dashboard settings" title="Settings">${icons.settings}</button>
          </div>
        </header>
        <section class="dashboard" id="dashboard">
          <div class="loading-screen">
            <div class="loading-card">
              <div class="loading-spinner"></div>
              <h2>Connecting to your printers</h2>
              <p>Loading Bambuddy status and camera connections.</p>
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
                <option value="bambu">Bambu Dark</option><option value="arc">Arc Reactor</option><option value="workshop">Workshop</option><option value="light">Clean Light</option>
              </select>
            </div>
            <div class="setting-row">
              <div><div class="setting-label">Layout</div><div class="setting-help">Choose how multiple printers share the screen.</div></div>
              <select class="setting-select" id="display-layout">
                <option value="grid">Command Grid</option><option value="wall">Camera Wall</option><option value="focus">Swipe Focus</option><option value="rail">Status Rail</option>
              </select>
            </div>
            <div class="setting-row">
              <div><div class="setting-label">Camera quality</div><div class="setting-help">Higher FPS uses more network bandwidth.</div></div>
              <select class="setting-select" id="camera-fps">
                <option value="4">4 FPS</option><option value="8">8 FPS</option><option value="12">12 FPS</option>
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
        <div class="camera-frame">
          <div class="camera-placeholder">Connecting camera…<span>Live feed from Bambuddy</span></div>
          <img class="camera-feed is-loading" alt="Live camera for ${escapeHtml(printer.name)}" data-role="camera">
          <div class="camera-badges">
            <span class="camera-live"><span class="camera-live-dot"></span> Live</span>
            <span class="camera-badge-actions"><span class="camera-state" data-role="camera-state">Connecting</span><button class="camera-focus" data-command="focus" aria-label="Focus ${escapeHtml(printer.name)}" title="Focus printer">${icons.focus}</button></span>
          </div>
          <div class="camera-progress" data-role="camera-progress">—</div>
        </div>
        <div class="card-content">
          <div class="card-heading">
            <div class="card-title">
              <span class="printer-status-dot offline" data-role="status-dot"></span>
              <div><h2 class="printer-name">${escapeHtml(printer.name || `Printer ${id}`)}</h2><div class="printer-model">${escapeHtml(printer.model || "Bambu Lab printer")}</div></div>
            </div>
            <span class="state-pill" data-role="state-pill" data-tone="amber">Connecting</span>
          </div>
          <div class="job-row">
            <div class="job-header"><div class="job-name" data-role="job-name">Loading printer status…</div><div class="job-percent" data-role="job-progress">—%</div></div>
            <div class="progress-track"><div class="progress-fill" data-role="progress-fill"></div></div>
          </div>
          <div class="metrics">
            <div class="metric"><span class="metric-icon">${icons.clock}</span><span class="metric-copy"><span class="metric-value" data-role="time">—</span><span class="metric-label">Remaining</span></span></div>
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
      root: card, camera: get("camera"), cameraState: get("camera-state"), cameraProgress: get("camera-progress"),
      statusDot: get("status-dot"), statePill: get("state-pill"), jobName: get("job-name"), jobProgress: get("job-progress"), progressFill: get("progress-fill"),
      time: get("time"), layers: get("layers"), nozzle: get("nozzle"), bed: get("bed"), ams: get("ams"), pauseLabel: get("pause-label"),
      pauseButton: card.querySelector('[data-command="pause-resume"]'), lightButton: card.querySelector('[data-command="light"]'),
      stopButton: card.querySelector('[data-command="stop"]'), refreshButton: card.querySelector('[data-command="refresh"]'),
      refreshIcon: get("refresh-icon"), refreshLabel: get("refresh-label"), speedButtons: Array.from(card.querySelectorAll('[data-command="speed"]')),
    });
  }

  function attachCamera(id) {
    const refs = state.cards.get(id);
    if (!refs) return;
    const printer = state.printers.find((item) => Number(item.id) === Number(id));
    const lowFpsCamera = /(?:A1|P1)/i.test(`${printer?.name || ""} ${printer?.model || ""}`);
    const cameraFps = lowFpsCamera ? Math.min(state.cameraFps, 5) : state.cameraFps;
    const src = `${config.apiBase}/printers/${id}/camera/stream?fps=${cameraFps}`;
    refs.camera.classList.add("is-loading");
    refs.camera.classList.remove("has-error");
    refs.camera.onload = () => refs.camera.classList.remove("is-loading", "has-error");
    refs.camera.onerror = () => {
      refs.camera.classList.add("has-error");
      const placeholder = refs.root.querySelector(".camera-placeholder");
      if (placeholder) placeholder.innerHTML = 'Camera unavailable<span>Retrying automatically</span>';
      setTimeout(() => {
        if (document.body.contains(refs.camera)) refs.camera.src = `${src}&retry=${Date.now()}`;
      }, 10000);
    };
    refs.camera.src = src;
  }

  function renderPrinters(printers) {
    const dashboard = document.getElementById("dashboard");
    dashboard.innerHTML = `<div class="printer-grid" style="--printer-count:${Math.max(1, printers.length)}">${printers.map(cardTemplate).join("")}</div>`;
    state.cards.clear();
    for (const card of dashboard.querySelectorAll("[data-printer-id]")) {
      const id = Number(card.dataset.printerId);
      cacheCard(card, id);
      attachCamera(id);
    }
    applyFocus();
  }

  function applyFocus() {
    const grid = document.querySelector(".printer-grid");
    if (!grid) return;
    grid.classList.toggle("has-focus", state.focusedPrinter !== null);
    for (const card of grid.querySelectorAll("[data-printer-id]")) {
      const focused = Number(card.dataset.printerId) === Number(state.focusedPrinter);
      card.classList.toggle("is-focused", focused);
      card.classList.toggle("is-dimmed", state.focusedPrinter !== null && !focused);
      const button = card.querySelector('[data-command="focus"]');
      if (button) {
        button.classList.toggle("active", focused);
        button.title = focused ? "Return to overview" : "Focus printer";
      }
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

  function updateCard(printer, status) {
    const refs = state.cards.get(Number(printer.id));
    if (!refs || !status) return;
    const meta = statusMeta(status);
    const progress = Math.max(0, Math.min(100, Number(status.progress) || 0));
    const currentState = String(status.state || "IDLE").toUpperCase();
    const paused = currentState === "PAUSE";
    const printing = activeState(currentState);

    refs.statusDot.classList.toggle("offline", !status.connected);
    refs.statePill.textContent = meta.label;
    refs.statePill.dataset.tone = meta.tone;
    refs.cameraState.textContent = meta.label;
    refs.cameraProgress.textContent = printing ? `${Math.round(progress)}%` : meta.label;
    refs.jobName.textContent = cleanJobName(status);
    refs.jobProgress.textContent = `${Math.round(progress)}%`;
    refs.progressFill.style.width = `${progress}%`;
    refs.time.textContent = formatTime(status.remaining_time);
    refs.layers.textContent = Number(status.total_layers) > 0 ? `${status.layer_num || 0} / ${status.total_layers}` : "—";
    refs.nozzle.textContent = formatTemp(status.temperatures?.nozzle, status.temperatures?.nozzle_target);
    refs.bed.textContent = formatTemp(status.temperatures?.bed, status.temperatures?.bed_target);
    refs.pauseLabel.textContent = paused ? "Resume" : "Pause";
    refs.pauseButton.querySelector(".button-icon").innerHTML = paused ? icons.play : icons.pause;
    refs.pauseButton.disabled = !status.connected || (!paused && currentState !== "RUNNING");
    refs.stopButton.disabled = !status.connected || !printing;
    refs.lightButton.classList.toggle("active", Boolean(status.chamber_light));
    refs.refreshButton.dataset.command = status.awaiting_plate_clear ? "clear-plate" : "refresh";
    refs.refreshButton.classList.toggle("active", Boolean(status.awaiting_plate_clear));
    refs.refreshIcon.innerHTML = status.awaiting_plate_clear ? icons.layers : icons.refresh;
    refs.refreshLabel.textContent = status.awaiting_plate_clear ? "Plate Clear" : "Refresh";
    refs.speedButtons.forEach((button) => {
      button.disabled = !status.connected || !printing;
      button.classList.toggle("active", Number(button.dataset.value) === Number(status.speed_level));
    });

    const trays = spoolData(status);
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
    if (summary) summary.textContent = `${online} online · ${printing} active · ${state.printers.length} total`;
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
        state.statuses.set(Number(printer.id), status);
        updateCard(printer, status);
      }
    }
    state.connected = successes > 0;
    updateSummary();
  }

  function schedulePolling() {
    clearInterval(state.pollTimer);
    state.pollTimer = setInterval(pollStatuses, state.pollSeconds * 1000);
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

  function showModal(id) { const modal = document.getElementById(id); if (modal) modal.hidden = false; }
  function closeModal(id) { const modal = document.getElementById(id); if (modal) modal.hidden = true; }

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
    document.getElementById("fullscreen-button")?.addEventListener("click", requestFullscreen);
    document.getElementById("bambuddy-button")?.addEventListener("click", openBambuddy);
    document.getElementById("settings-button")?.addEventListener("click", () => {
      document.getElementById("display-theme").value = state.theme;
      document.getElementById("display-layout").value = state.layout;
      document.getElementById("camera-fps").value = String(state.cameraFps);
      document.getElementById("poll-seconds").value = String(state.pollSeconds);
      showModal("settings-modal");
    });
    document.getElementById("save-settings")?.addEventListener("click", () => {
      const nextFps = Number(document.getElementById("camera-fps").value) || 8;
      const nextPoll = Number(document.getElementById("poll-seconds").value) || 3;
      const nextTheme = document.getElementById("display-theme").value || "bambu";
      const nextLayout = document.getElementById("display-layout").value || "grid";
      const cameraChanged = nextFps !== state.cameraFps;
      state.cameraFps = nextFps;
      state.pollSeconds = nextPoll;
      state.theme = nextTheme;
      state.layout = nextLayout;
      localStorage.setItem("bcc-camera-fps", String(nextFps));
      localStorage.setItem("bcc-poll-seconds", String(nextPoll));
      localStorage.setItem("bcc-theme", nextTheme);
      localStorage.setItem("bcc-layout", nextLayout);
      state.focusedPrinter = null;
      applyAppearance();
      applyFocus();
      schedulePolling();
      if (cameraChanged) state.printers.forEach((printer) => attachCamera(Number(printer.id)));
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
    document.getElementById("dashboard")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-command]");
      if (!button || button.disabled) return;
      const card = button.closest("[data-printer-id]");
      if (!card) return;
      const id = Number(card.dataset.printerId);
      const status = state.statuses.get(id);
      switch (button.dataset.command) {
        case "focus":
          state.focusedPrinter = state.focusedPrinter === id ? null : id;
          applyFocus();
          break;
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
      if (document.visibilityState === "visible") { requestWakeLock(); pollStatuses(); }
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
  bindEvents();
  startClock();
  loadVersion();
  requestWakeLock();
  discover();
})();
