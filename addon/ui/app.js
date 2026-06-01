// EV Smart Charging — Addon UI

// Detect ingress base path so API calls work both directly and via HA Ingress proxy
const BASE_URL = (() => {
  const p = location.pathname;
  // Strip trailing filename if any, then trailing slash
  return p.replace(/\/[^/]*\.[^/]*$/, '').replace(/\/$/, '');
})();

const MODES = [
  { id: "Charge Now",       desc: "Start immediately" },
  { id: "Cheapest Hours",   desc: "Cheapest slots to reach target SoC" },
  { id: "Off",              desc: "Manual override off" },
];

const DEFAULT_TARIFFS = {
  low:          0.11,
  high_summer:  0.17,
  high_winter:  0.32,
  peak_summer:  0.43,
  peak_winter:  0.97,
  energinet:    0.21,
  elafgift:     0.00,
  supplier:     0.00,
};

const TARIFF_LABELS = {
  low:          "Low (00-06h)",
  high_summer:  "High summer (06-17h + 21-24h, Apr-Sep)",
  high_winter:  "High winter (06-17h + 21-24h, Oct-Mar)",
  peak_summer:  "Peak summer (17-21h, Apr-Sep)",
  peak_winter:  "Peak winter (17-21h, Oct-Mar)",
  energinet:    "Energinet (fixed)",
  elafgift:     "Elafgift (EV exempt)",
  supplier:     "Supplier add-on",
};

let state = {
  status:          [],
  prices:          [],
  priceError:      null,
  forecast:        null,
  selectedPlanCar: null,
  carSettings:     {},
  haEntities:      [],
  editingCarId:    null,
  previewPlan:     null,   // last fetched preview plan — shown in chart alongside active plan
  settings:        null,
};

let priceChart   = null;
let historyChart = null;
let planChart    = null;

// ---- WebSocket ----
function connectWs() {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(`${proto}//${location.host}${BASE_URL}/ws`);
  ws.onopen  = () => setStatus("Connected", true);
  ws.onmessage = (e) => {
    const { event, data } = JSON.parse(e.data);
    if (event === "status")         { state.status = data; renderDashboard(); renderPlan(); }
    if (event === "plan_updated")   { const s = state.status.find(c => c.carId === data.carId); if (s) s.plan = data.plan; renderDashboard(); renderPlan(); }
    if (event === "prices_updated") { loadPrices(); }
    if (event === "plug_changed")   { loadStatus(); }
    setStatus("Connected", true);
  };
  ws.onclose = () => { setStatus("Reconnecting"); setTimeout(connectWs, 3000); };
  ws.onerror = () => { setStatus("Connection error"); };
}

function setStatus(msg, ok = false) {
  const el = document.getElementById("topbar-status");
  if (!el) return;
  el.textContent = msg;
  el.className = "topbar-status" + (ok ? " connected" : "");
}

// ---- API ----
async function api(method, path, body) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const t0 = performance.now();
  const res = await fetch(`${BASE_URL}${path}`, opts);
  const ms = Math.round(performance.now() - t0);
  const style = ms > 1000 ? "color:red;font-weight:bold" : ms > 300 ? "color:orange" : "color:green";
  console.log(`%c[API] ${method} ${path} → ${res.status} in ${ms}ms`, style);
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}`);
  return res.json();
}

async function loadAll() {
  const [status, priceResp, settings, haEntities] = await Promise.all([
    api("GET", "/api/status"),
    api("GET", "/api/prices"),
    api("GET", "/api/settings"),
    api("GET", "/api/ha/entities"),
  ]);
  state.status     = status;
  state.prices     = priceResp.slots ?? priceResp;
  state.priceError = priceResp.error ?? null;
  state.settings   = settings;
  state.haEntities = haEntities;
  // Settings embedded in status — no per-car fetches needed
  for (const car of (state.status || [])) {
    if (car.settings) state.carSettings[car.carId] = car.settings;
  }
  state.selectedPlanCar = state.status?.[0]?.carId ?? null;
  renderAll();
  loadForecast();
}

async function loadStatus() {
  state.status = await api("GET", "/api/status");
  // Settings are now embedded in each car's status — no per-car fetches needed
  for (const car of (state.status || [])) {
    if (car.settings) state.carSettings[car.carId] = car.settings;
  }
  renderDashboard(); renderPlan();
}

async function loadPrices() {
  const resp = await api("GET", "/api/prices");
  state.prices = resp.slots ?? resp; // handle both old array and new {slots, error} shape
  state.priceError = resp.error ?? null;
  renderDashboard();
}

async function loadForecast() {
  try { state.forecast = await api("GET", "/api/forecast"); renderForecastBanner(); } catch {}
}

function renderAll() {
  renderDashboard(); renderPlan();
  // Only re-render settings if that view is currently visible (avoids entity-picker thrash on every poll)
  if (document.getElementById("view-settings")?.classList.contains("active")) renderSettingsView();
}

// ---- Dashboard ----
function renderDashboard() {
  renderCarsGrid();
  renderPriceChart();
  renderPriceStrip();
  renderSmartTip();
}

function renderCarsGrid() {
  const grid = document.getElementById("cars-status-grid");
  if (!grid) return;
  if (!state.status.length) { grid.innerHTML = '<div class="car-card"><p style="color:#a1a1aa;font-size:.85rem">No cars configured. Go to Settings to add a car.</p></div>'; return; }
  grid.innerHTML = state.status.map((car, i) => {
    const cs = state.carSettings[car.carId] ?? {};
    const soc = Math.round(car.soc ?? 0);
    const fillClass = soc < 20 ? "low" : soc > 80 ? "high" : "";
    const col = CAR_COLORS[i % CAR_COLORS.length];

    // Status tag
    const statusText = car.isFastCharger ? "DC Fast" : car.isCharging ? "Charging" : car.plugged ? "Connected" : "Not connected";
    const statusClass = car.isCharging ? "charging" : car.isFastCharger ? "fast" : "";

    // Current action line
    const now = new Date();
    const cap = cs.max_price_cap ?? 0;
    const tariffs = state.settings?.tariffs ?? {};
    let actionLine = "";
    if (!car.plugged) {
      actionLine = "Not plugged in";
    } else if (cs.mode === "Off") {
      actionLine = "Charging disabled";
    } else if (car.isFastCharger) {
      actionLine = `DC fast charging — ${(car.powerW/1000).toFixed(1)} kW`;
    } else if (car.isCharging) {
      const currentSlot = car.plan?.find(s => !s.isPast && s.charging);
      const ep = currentSlot ? ` at ${currentSlot.ep.toFixed(2)} DKK/kWh` : "";
      actionLine = `Charging${ep}${car.powerW > 100 ? ` — ${(car.powerW/1000).toFixed(1)} kW` : ""}`;
    } else if (cs.mode === "Cheapest Hours") {
      // Check if current slot is blocked by price cap
      const nowSlot = car.plan?.find(s => { const dt = new Date(s.start); return dt <= now && now < new Date(dt.getTime() + 15*60000); });
      if (cap > 0 && nowSlot && nowSlot.ep > cap) {
        actionLine = `Paused — price ${nowSlot.ep.toFixed(2)} > cap ${cap.toFixed(2)} DKK/kWh`;
      } else {
        const nextSlot = car.plan?.find(s => !s.isPast && s.charging && new Date(s.start) > now);
        actionLine = nextSlot ? `Next charge at ${fmtTime(nextSlot.start)}` : "Target SoC reached";
      }
    } else if (cs.mode === "Charge Now") {
      actionLine = "Starting charge...";
    } else {
      const nextSlot = car.plan?.find(s => !s.isPast && s.charging && new Date(s.start) > now);
      actionLine = nextSlot ? `Next charge at ${fmtTime(nextSlot.start)}` : "No charge scheduled";
    }

    const carConfig = state.settings?.cars?.find(c => c.id === car.carId);
    const hasRefresh = !!carConfig?.refresh_entity;

    // Planned vs actual state
    const planned = car.plannedAction;                  // "charge" | "pause" | "unknown"
    const actual  = car.isCharging ? "charge" : "pause";
    const mismatch = car.plugged && planned !== "unknown" && planned !== actual;
    const plannedLabel = planned === "charge" ? "Should be charging" : planned === "pause" ? "Should be paused" : "No plan slot";
    const actualLabel  = car.isCharging
      ? `Charging${car.powerW > 100 ? ` (${(car.powerW/1000).toFixed(1)} kW)` : ""}${car.currentSlotEp ? ` at ${car.currentSlotEp.toFixed(2)} DKK/kWh` : ""}`
      : "Not charging";
    const stateRow = car.plugged && !car.isFastCharger ? `
      <div class="car-state-row">
        <span class="state-pill ${planned}">${plannedLabel}</span>
        <span class="state-arrow">→</span>
        <span class="state-pill actual ${mismatch ? "mismatch" : actual}">${actualLabel}</span>
      </div>` : "";

    // Last command
    const lc = car.lastCommand;
    const lcLine = lc ? `<div class="car-last-cmd">Last command: <strong>${lc.action === "start" ? "Start charging" : "Stop charging"}</strong>${lc.ep ? ` at ${lc.ep.toFixed(2)} DKK/kWh` : ""} — ${fmtAgo(lc.time)}</div>` : "";

    return `<div class="car-card" style="border-left:3px solid ${col.border}">
      <div class="car-card-header">
        <span class="car-name">${car.carName}</span>
        <span class="status-tag ${statusClass}">${statusText}</span>
        ${hasRefresh ? `<button class="btn-sm" onclick="refreshCar('${car.carId}', this)" title="Refresh car data from cloud">Refresh</button>` : ""}
      </div>
      <div class="soc-value">${soc}<span class="soc-unit">%</span></div>
      <div class="soc-track"><div class="soc-fill ${fillClass}" style="width:${soc}%;background:${col.border}"></div></div>
      <div class="car-action">${actionLine}</div>
      ${stateRow}
      ${lcLine}
      <div class="car-meta">
        <span class="car-mode-label">${cs.mode ?? "Not set"}</span>
        ${car.summary ? `<span>+${car.summary.kwhAdded?.toFixed(1)} kWh → ${Math.round(car.summary.finalSoc)}%  ~${car.summary.totalCost?.toFixed(2)} DKK</span>` : ""}
      </div>
    </div>`;
  }).join("");
}

const CAR_COLORS = [
  { bar: "rgba(74,222,128,0.85)",  line: "rgba(74,222,128,1)",   border: "#4ade80" },
  { bar: "rgba(96,165,250,0.85)",  line: "rgba(96,165,250,1)",   border: "#60a5fa" },
  { bar: "rgba(251,146,60,0.85)",  line: "rgba(251,146,60,1)",   border: "#fb923c" },
  { bar: "rgba(196,147,251,0.85)", line: "rgba(196,147,251,1)",  border: "#c493fb" },
];

function carColorIdx(carId) {
  const cars = state.settings?.cars ?? [];
  const idx = cars.findIndex(c => c.id === carId);
  return idx >= 0 ? idx % CAR_COLORS.length : 0;
}

function renderForecastBanner() {
  const f = state.forecast;
  const banner = document.getElementById("forecast-banner");
  if (!f || !banner) return;
  banner.style.display = "";
  document.getElementById("forecast-label").textContent = f.label ?? "Price forecast";
  document.getElementById("forecast-indicators").innerHTML = [
    f.windCapacityPct !== null ? `<span class="forecast-chip">Wind ${Math.round(f.windCapacityPct * 100)}%</span>` : "",
    f.co2gPerKwh !== null ? `<span class="forecast-chip">${Math.round(f.co2gPerKwh)} g CO2/kWh</span>` : "",
    f.historicalAvg !== null ? `<span class="forecast-chip">Typical ~${f.historicalAvg.toFixed(2)} DKK/kWh</span>` : "",
  ].join("");
}

function renderPriceChart() {
  const canvas = document.getElementById("price-chart");
  const wrap = canvas?.parentElement;
  if (!canvas) return;

  if (!state.prices.length) {
    if (priceChart) { priceChart.destroy(); priceChart = null; }
    const errMsg = state.priceError ? `<br><span style="font-size:.75rem;color:var(--red)">${state.priceError}</span>` : "";
    // Keep a hidden canvas so when prices arrive the chart can be built on it
    wrap.innerHTML = `<div id="price-no-data" style="padding:2rem;text-align:center;color:var(--gray-400);font-size:.9rem">
      No price data — check HA Nord Pool integration or Energinet API.${errMsg}
      <br><br><button class="btn" onclick="document.getElementById('btn-refresh').click()">Retry</button>
    </div><canvas id="price-chart"></canvas>`;
    document.getElementById("price-chart").style.display = "none";
    return;
  }

  // Always ensure canvas is visible (may have been hidden by the "no data" branch)
  canvas.style.display = "";
  const noData = document.getElementById("price-no-data");
  if (noData) noData.remove();

  const isDark = document.documentElement.dataset.theme === "dark" ||
    (document.documentElement.dataset.theme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const textColor    = isDark ? "#a1a1aa" : "#71717a";
  const gridColor    = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)";
  const pastColor    = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const defaultColor = isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.15)";

  const now = new Date();
  const tariffs = state.settings?.tariffs ?? {};

  // Expand hourly prices → 15-min slots
  const slots15 = [];
  for (const s of state.prices) {
    const base = new Date(s.start);
    for (let q = 0; q < 4; q++) {
      const dt = new Date(base.getTime() + q * 15 * 60000);
      slots15.push({ dt, ep: computeEp(s.value, dt, tariffs), start: dt.toISOString() });
    }
  }

  // Build a map: slot start → which car (index) is charging there (first car wins for color)
  const slotCarMap = new Map(); // start → car index
  state.status.forEach((car, i) => {
    (car.plan ?? []).filter(s => s.charging).forEach(s => {
      if (!slotCarMap.has(s.start)) slotCarMap.set(s.start, i);
    });
  });

  // Match plan slot starts to 15-min expanded slots (plan uses exact ISO, prices need rounding)
  const bgColors = slots15.map(s => {
    if (s.dt < now) return pastColor;
    // Try exact match first, then nearest 15-min bucket
    const key = s.dt.toISOString();
    const carIdx = slotCarMap.get(key) ?? [...slotCarMap.entries()].find(([k]) => {
      const kDt = new Date(k); return Math.abs(kDt - s.dt) < 60000;
    })?.[1];
    if (carIdx !== undefined) return CAR_COLORS[carIdx % CAR_COLORS.length].bar;
    return defaultColor;
  });

  // SoC projection lines per car
  const datasets = [
    { type: "bar", data: slots15.map(s => parseFloat(s.ep.toFixed(3))), backgroundColor: bgColors, borderRadius: 2, borderSkipped: false, yAxisID: "y" },
  ];

  state.status.forEach((car, i) => {
    const carConfig = state.settings?.cars?.find(c => c.id === car.carId);
    const batteryKwh = carConfig?.battery_kwh ?? 71.2;
    const chargeKw   = carConfig?.charge_kw   ?? 9.5;
    const chargeLimit = state.carSettings[car.carId]?.charge_limit ?? 100;
    let soc = car.soc;
    if (soc == null) return;
    const col = CAR_COLORS[i % CAR_COLORS.length];
    const planSlots = car.plan ?? [];
    const socData = slots15.map(s => {
      if (s.dt < now) return null;
      const planSlot = planSlots.find(p => { const pd = new Date(p.start); return Math.abs(pd - s.dt) < 60000; });
      if (planSlot?.charging) soc = Math.min(chargeLimit, soc + (chargeKw * 0.25 / batteryKwh * 100));
      return parseFloat(soc.toFixed(1));
    });
    datasets.push({
      type: "line", data: socData, borderColor: col.line, backgroundColor: "transparent",
      borderWidth: 1.5, pointRadius: 0, tension: 0.3, yAxisID: "y2", spanGaps: false,
      label: car.carName,
    });
  });

  // Fingerprint based on price data content — if unchanged, update chart in-place (no flicker)
  const priceKey = `${state.prices.length}|${state.prices[0]?.start ?? ""}|${state.prices.at(-1)?.start ?? ""}|${isDark}`;
  if (priceChart && priceChart._priceKey === priceKey && priceChart.data.datasets.length === datasets.length) {
    // Only plan/SoC changed — update data without destroying the chart
    priceChart.data.datasets[0].backgroundColor = bgColors;
    datasets.slice(1).forEach((ds, i) => {
      if (priceChart.data.datasets[i + 1]) priceChart.data.datasets[i + 1].data = ds.data;
    });
    priceChart.update("none");
    return;
  }

  if (priceChart) priceChart.destroy();
  priceChart = new Chart(canvas, {
    data: {
      labels: slots15.map(s => s.dt.getMinutes() === 0 ? fmtTime(s.dt.toISOString()) : ""),
      datasets,
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: state.status.length > 1, labels: { color: textColor, boxWidth: 12, font: { size: 11 } } },
        tooltip: { callbacks: {
          title: (items) => { const s = slots15[items[0].dataIndex]; return fmtTime(s.dt.toISOString()); },
          label: ctx => {
            if (ctx.datasetIndex === 0) {
              const s = slots15[ctx.dataIndex];
              const carIdx = [...slotCarMap.entries()].find(([k]) => Math.abs(new Date(k) - s.dt) < 60000)?.[1];
              const tag = carIdx !== undefined ? ` — ${state.status[carIdx]?.carName} charging` : "";
              return `${ctx.raw} DKK/kWh${tag}`;
            }
            return `${ctx.dataset.label} SoC: ${ctx.raw}%`;
          }
        }},
      },
      scales: {
        x:  { ticks: { maxTicksLimit: 24, color: textColor, font: { size: 10 } }, grid: { display: false } },
        y:  { ticks: { color: textColor, font: { size: 11 } }, grid: { color: gridColor } },
        y2: state.status.some(c => c.soc != null)
          ? { position: "right", min: 0, max: 100, ticks: { color: textColor, font: { size: 10 }, callback: v => `${v}%` }, grid: { display: false } }
          : undefined,
      },
      animation: { duration: 200 },
    },
  });
  priceChart._priceKey = priceKey;
}

function computeEp(spot, dt, tariffs) {
  const h = dt.getHours(), m = dt.getMonth() + 1;
  const isSummer = m >= 4 && m <= 9;
  let n1 = tariffs.low ?? DEFAULT_TARIFFS.low;
  if (h >= 6 && h < 17 || h >= 21) n1 = isSummer ? (tariffs.high_summer ?? DEFAULT_TARIFFS.high_summer) : (tariffs.high_winter ?? DEFAULT_TARIFFS.high_winter);
  if (h >= 17 && h < 21)           n1 = isSummer ? (tariffs.peak_summer ?? DEFAULT_TARIFFS.peak_summer) : (tariffs.peak_winter ?? DEFAULT_TARIFFS.peak_winter);
  return spot * 1.25 + n1 + (tariffs.energinet ?? DEFAULT_TARIFFS.energinet) + (tariffs.elafgift ?? DEFAULT_TARIFFS.elafgift) + (tariffs.supplier ?? DEFAULT_TARIFFS.supplier);
}

function renderPriceStrip() {
  const strip = document.getElementById("price-strip");
  if (!strip || !state.prices.length) return;
  const now = new Date();
  const tariffs = state.settings?.tariffs ?? {};
  const todayStr = now.toDateString();
  const today = state.prices.filter(s => new Date(s.start).toDateString() === todayStr);
  const todayEps = today.map(s => ({ ep: computeEp(s.value, new Date(s.start), tariffs), start: s.start, dt: new Date(s.start) }));
  const current = todayEps.find(s => s.dt <= now && now < new Date(s.dt.getTime() + 3600000));
  const lo = todayEps.length ? Math.min(...todayEps.map(s => s.ep)) : null;
  const hi = todayEps.length ? Math.max(...todayEps.map(s => s.ep)) : null;
  const currentEp = current?.ep ?? null;
  const rank = currentEp != null && lo != null && hi != null && hi > lo ? Math.round(((currentEp - lo) / (hi - lo)) * 100) : null;
  const rankClass = rank !== null ? (rank < 33 ? "cheap" : rank < 66 ? "mid" : "peak") : "";

  strip.innerHTML = `
    <div class="price-chip">
      <span class="chip-label">Now</span>
      <span class="chip-value ${rankClass}">${currentEp != null ? currentEp.toFixed(2) : "--"}<span class="chip-unit"> DKK</span></span>
    </div>
    <div class="price-chip">
      <span class="chip-label">Lowest today</span>
      <span class="chip-value cheap">${lo != null ? lo.toFixed(2) : "--"}<span class="chip-unit"> DKK</span></span>
    </div>
    <div class="price-chip">
      <span class="chip-label">Highest today</span>
      <span class="chip-value peak">${hi != null ? hi.toFixed(2) : "--"}<span class="chip-unit"> DKK</span></span>
    </div>
    ${rank !== null ? `<div class="price-chip"><span class="chip-label">Price rank</span><span class="chip-value ${rankClass}">${rank}%<span class="chip-unit"> of today</span></span></div>` : ""}
  `;
}

function renderSmartTip() {
  const tipEl = document.getElementById("smart-tip");
  const container = document.getElementById("smart-actions");
  if (!tipEl || !container) return;
  if (!state.prices.length || !state.status.length) { container.style.display = "none"; return; }
  const now = new Date();
  const tariffs = state.settings?.tariffs ?? {};
  const carId = state.status[0]?.carId;
  const cs = state.carSettings[carId] ?? {};
  const todayEps = state.prices
    .filter(s => new Date(s.start).toDateString() === now.toDateString())
    .map(s => ({ ep: computeEp(s.value, new Date(s.start), tariffs), dt: new Date(s.start) }));
  const sorted = [...todayEps].sort((a, b) => a.ep - b.ep);
  const p25 = sorted[Math.floor(sorted.length * 0.25)]?.ep;
  const current = todayEps.find(s => s.dt <= now && now < new Date(s.dt.getTime() + 3600000));

  const tips = [];
  if (current && cs.mode !== "Charge Now" && current.ep <= (p25 ?? Infinity))
    tips.push(`Current price (${current.ep.toFixed(2)} DKK/kWh) is in the cheapest 25% today.`);

  if (cs.mode !== "Charge Now" && cs.mode !== "Off") {
    const win = getBestWindowTonight(carId);
    if (win) {
      const fmt = dt => dt.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
      tips.push(`Best window tonight: ${fmt(win.startDt)}–${fmt(win.endDt)}, avg ${win.avgEp.toFixed(2)} DKK/kWh, est. cost ~${win.estCost.toFixed(2)} DKK`);
    }
  }

  if (tips.length) {
    tipEl.innerHTML = tips.map(t => `<div>${t}</div>`).join("");
    container.style.display = "";
  } else {
    container.style.display = "none";
  }
}

// ---- SoC projection helper ----
// Returns array of projected SoC values (null for past slots) aligned with planSlots.
function computeSocProjection(carStatus, planSlots) {
  if (!carStatus || carStatus.soc == null || !planSlots.length) return null;
  const carConfig = state.settings?.cars?.find(c => c.id === carStatus.carId);
  const batteryKwh = carConfig?.battery_kwh ?? 71.2;
  const chargeKw   = carConfig?.charge_kw   ?? 9.5;
  const chargeLimit = state.carSettings[carStatus.carId]?.charge_limit ?? 100;
  const now = new Date();
  let soc = carStatus.soc;
  return planSlots.map(s => {
    const dt = new Date(s.start);
    if (dt < now) return null;
    if (s.charging) soc = Math.min(chargeLimit, soc + (chargeKw * 0.25 / batteryKwh * 100));
    return parseFloat(soc.toFixed(1));
  });
}

// Returns the cheapest upcoming window tonight for the given car.
function getBestWindowTonight(carId) {
  if (!state.prices.length) return null;
  const now = new Date();
  const tariffs = state.settings?.tariffs ?? {};
  const cs = state.carSettings[carId] ?? {};
  const carConfig  = state.settings?.cars?.find(c => c.id === carId);
  const chargeKw   = carConfig?.charge_kw   ?? 9.5;
  const batteryKwh = carConfig?.battery_kwh ?? 71.2;
  const carStatus  = state.status.find(c => c.carId === carId);
  const currentSoc = carStatus?.soc ?? cs.manual_soc ?? 20;
  const targetSoc  = Math.min(cs.target_soc ?? 80, cs.charge_limit ?? 100);
  const neededKwh  = Math.max(0, ((targetSoc - currentSoc) / 100) * batteryKwh);
  const hours      = neededKwh / chargeKw;
  const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() + 1); cutoff.setHours(6, 0, 0, 0);
  const future = state.prices
    .filter(s => { const dt = new Date(s.start); return dt >= now && dt < cutoff; })
    .map(s => ({ ep: computeEp(s.value, new Date(s.start), tariffs), dt: new Date(s.start) }));
  if (future.length < 4) return null;
  const nSlots = Math.min(Math.ceil(hours * 4), future.length);
  if (nSlots === 0) return null;
  const cheapest = [...future].sort((a, b) => a.ep - b.ep).slice(0, nSlots).sort((a, b) => a.dt - b.dt);
  const startDt = cheapest[0].dt;
  const endDt   = new Date(cheapest[cheapest.length - 1].dt.getTime() + 15 * 60000);
  const avgEp   = cheapest.reduce((sum, s) => sum + s.ep, 0) / cheapest.length;
  return { startDt, endDt, avgEp, kwhNeeded: neededKwh, estCost: neededKwh * avgEp };
}

// Approximate what a session would have cost at the peak tariff rate for that month.
function peakRateApprox(startTime) {
  const dt = new Date(startTime);
  const m = dt.getMonth() + 1;
  const isSummer = m >= 4 && m <= 9;
  const tariffs = state.settings?.tariffs ?? DEFAULT_TARIFFS;
  const peakN1 = isSummer ? (tariffs.peak_summer ?? DEFAULT_TARIFFS.peak_summer) : (tariffs.peak_winter ?? DEFAULT_TARIFFS.peak_winter);
  // Use a conservative spot estimate of 0.6 DKK/kWh
  return 0.6 * 1.25 + peakN1 + (tariffs.energinet ?? DEFAULT_TARIFFS.energinet) + (tariffs.elafgift ?? DEFAULT_TARIFFS.elafgift) + (tariffs.supplier ?? DEFAULT_TARIFFS.supplier);
}


function renderPlan() {
  // Skip all heavy DOM work if Plan tab isn't visible — avoids blocking the main thread on every poll
  if (!document.getElementById("view-plan")?.classList.contains("active")) return;
  renderPlanCarSelect(); renderModeGrid(); renderModeSettings(); renderPlanEstimate(); renderTimeline(); renderScheduleTable();
}

function renderTimeline(overridePlan) {
  const canvas = document.getElementById("plan-chart");
  const section = document.getElementById("timeline-section");
  if (!canvas || !section) return;

  // Active plan = what the controller is running now
  const activePlan   = state.status.find(c => c.carId === state.selectedPlanCar)?.plan ?? [];
  // Preview plan = what WILL run after Apply (set by loadAndRenderPreview)
  const previewPlan  = overridePlan ?? state.previewPlan ?? [];

  // Use whichever has slots as the basis for the x-axis
  const basePlan = activePlan.length ? activePlan : previewPlan;
  if (!basePlan.length) {
    section.style.display = "none";
    if (planChart) { planChart.destroy(); planChart = null; }
    return;
  }
  section.style.display = "";

  const isDark = document.documentElement.dataset.theme === "dark" ||
    (document.documentElement.dataset.theme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const textColor    = isDark ? "#a1a1aa" : "#71717a";
  const gridColor    = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)";
  const pastColor    = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const defaultColor = isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.15)";
  const activeColor  = "rgba(74,222,128,0.9)";   // green  — current plan
  const previewColor = "rgba(99,102,241,0.75)";  // indigo — new plan

  const now = new Date();
  const activeSet  = new Set(activePlan.filter(s => s.charging).map(s => s.start));
  const previewSet = new Set(previewPlan.filter(s => s.charging).map(s => s.start));

  // Scriptable backgroundColor — "both" slots get a split green|indigo gradient
  const bgColors = (ctx) => {
    const slot = basePlan[ctx.dataIndex];
    if (!slot) return defaultColor;
    if (new Date(slot.start) < now) return pastColor;
    const inActive  = activeSet.has(slot.start);
    const inPreview = previewSet.has(slot.start);
    if (inActive && inPreview) {
      // Top half green (current), bottom half indigo (new plan)
      try {
        const bar = ctx.chart.getDatasetMeta(0).data[ctx.dataIndex];
        if (bar) {
          const { y, base } = bar.getProps(["y", "base"], true);
          const grad = ctx.chart.ctx.createLinearGradient(0, y, 0, base);
          grad.addColorStop(0,   activeColor);
          grad.addColorStop(0.5, activeColor);
          grad.addColorStop(0.5, previewColor);
          grad.addColorStop(1,   previewColor);
          return grad;
        }
      } catch {}
      return activeColor; // fallback before first draw
    }
    if (inActive)  return activeColor;
    if (inPreview) return previewColor;
    return defaultColor;
  };

  const labels   = basePlan.map(s => fmtTime(s.start));
  const epData   = basePlan.map(s => parseFloat((s.ep ?? 0).toFixed(3)));

  const carStatus = state.status.find(c => c.carId === state.selectedPlanCar);
  const lineColor = isDark ? "rgba(129,140,248,0.9)" : "rgba(99,102,241,0.85)";
  const socData   = computeSocProjection(carStatus, basePlan);

  // Update in-place if chart already exists with matching structure
  const expectedDatasets = socData ? 2 : 1;
  if (planChart && planChart.data.datasets.length === expectedDatasets) {
    planChart.data.labels = labels;
    planChart.data.datasets[0].data = epData;
    planChart.data.datasets[0].backgroundColor = bgColors;
    if (socData) planChart.data.datasets[1].data = socData;
    planChart.update("none");
    return;
  }

  if (planChart) planChart.destroy();
  const datasets = [
    { type: "bar", data: epData, backgroundColor: bgColors, borderRadius: 2, borderSkipped: false, yAxisID: "y" },
  ];
  if (socData) datasets.push({
    type: "line", data: socData, borderColor: lineColor, backgroundColor: "transparent",
    borderWidth: 2, pointRadius: 0, tension: 0.3, yAxisID: "y2", spanGaps: false,
  });

  planChart = new Chart(canvas, {
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => {
          if (ctx.datasetIndex !== 0) return `SoC: ${ctx.raw}%`;
          const start = basePlan[ctx.dataIndex]?.start;
          const inActive  = activeSet.has(start);
          const inPreview = previewSet.has(start);
          const tag = (inActive && inPreview) ? " ✓ both plans"
                    : inActive  ? " ✓ current"
                    : inPreview ? " → new plan"
                    : "";
          return `${ctx.raw} DKK/kWh${tag}`;
        }}},
      },
      scales: {
        x:  { ticks: { maxTicksLimit: 12, color: textColor, font: { size: 11 } }, grid: { display: false } },
        y:  { ticks: { color: textColor, font: { size: 11 } }, grid: { color: gridColor } },
        y2: socData ? { position: "right", min: 0, max: 100, ticks: { color: lineColor, font: { size: 10 }, callback: v => `${v}%` }, grid: { display: false } } : undefined,
      },
      animation: { duration: 0 },
    },
  });
}


function renderPlanCarSelect() {
  const sel = document.getElementById("plan-car-select");
  if (!sel) return;
  sel.innerHTML = state.status.map(c => `<option value="${c.carId}" ${c.carId === state.selectedPlanCar ? "selected" : ""}>${c.carName}</option>`).join("");
}

function renderModeGrid() {
  const grid = document.getElementById("mode-grid");
  if (!grid) return;
  const cs = state.carSettings[state.selectedPlanCar] ?? {};
  grid.innerHTML = MODES.map(m => `
    <button class="mode-btn ${cs.mode === m.id ? "active" : ""}" data-mode="${m.id}">
      <span class="mode-btn-label">${m.id}</span>
      <span class="mode-btn-desc">${m.desc}</span>
    </button>`).join("");
  grid.querySelectorAll(".mode-btn").forEach(btn => btn.addEventListener("click", async () => {
    const cs2 = { ...(state.carSettings[state.selectedPlanCar] ?? {}), mode: btn.dataset.mode };
    state.carSettings[state.selectedPlanCar] = cs2;
    await api("POST", `/api/car/${state.selectedPlanCar}/settings`, cs2);
    renderModeGrid(); renderModeSettings();
    loadAndRenderPreview();
  }));
}

function renderModeSettings() {
  const el = document.getElementById("mode-settings");
  const card = document.getElementById("mode-settings-card");
  if (!el) return;
  const cs = state.carSettings[state.selectedPlanCar] ?? {};
  const mode = cs.mode;
  if (!mode || mode === "Charge Now" || mode === "Off") { card.style.display = "none"; return; }
  card.style.display = "";
  let html = "";
  if (mode === "Cheapest Hours") {
    html += slider("target_soc", "Target SoC", cs.target_soc ?? 80, 10, 100, 5, "%");
    const cap = cs.max_price_cap ?? 0;
    html += `<div class="setting-row">
      <label>Max price cap <span class="setting-hint">(optional — skip slots above this price)</span></label>
      <div style="display:flex;gap:.5rem;align-items:center">
        <input type="number" id="sr-max_price_cap" value="${cap > 0 ? cap : ""}" placeholder="e.g. 1.00" min="0" step="0.05" style="flex:1;width:100%" />
        <span style="white-space:nowrap;color:var(--gray-400);font-size:.85rem">DKK/kWh</span>
        ${cap > 0 ? `<button class="btn-sm" id="sr-cap-clear">Clear</button>` : ""}
      </div>
    </div>`;
    const dl = cs.deadline_time ?? "";
    html += `<div class="setting-row">
      <label>Deadline <span class="setting-hint">(optional — reach target by this time)</span></label>
      <div style="display:flex;gap:.5rem;align-items:center">
        <input type="time" id="sr-deadline_time" value="${dl}" style="flex:1" />
        ${dl ? `<button class="btn-sm" id="sr-deadline-clear">Clear</button>` : ""}
      </div>
    </div>`;
  }
  html += slider("charge_limit", "AC charge limit", cs.charge_limit ?? 100, 50, 100, 5, "%");
  el.innerHTML = html;
  el.querySelectorAll("input[type=range]").forEach(inp => {
    inp.addEventListener("input", async () => {
      const lbl = inp.closest(".setting-row").querySelector(".slider-val");
      if (lbl) lbl.textContent = `${inp.value}${inp.dataset.unit}`;
      const cs2 = { ...(state.carSettings[state.selectedPlanCar] ?? {}), [inp.dataset.key]: parseFloat(inp.value) };
      state.carSettings[state.selectedPlanCar] = cs2;
      await api("POST", `/api/car/${state.selectedPlanCar}/settings`, cs2);
      loadAndRenderPreview();
    });
  });
  el.querySelector("#sr-max_price_cap")?.addEventListener("change", async e => {
    const val = parseFloat(e.target.value);
    const cs2 = { ...(state.carSettings[state.selectedPlanCar] ?? {}), max_price_cap: isNaN(val) ? 0 : val };
    state.carSettings[state.selectedPlanCar] = cs2;
    await api("POST", `/api/car/${state.selectedPlanCar}/settings`, cs2);
    renderModeSettings(); loadAndRenderPreview();
  });
  el.querySelector("#sr-cap-clear")?.addEventListener("click", async () => {
    const cs2 = { ...(state.carSettings[state.selectedPlanCar] ?? {}), max_price_cap: 0 };
    state.carSettings[state.selectedPlanCar] = cs2;
    await api("POST", `/api/car/${state.selectedPlanCar}/settings`, cs2);
    renderModeSettings(); loadAndRenderPreview();
  });
  el.querySelector("#sr-deadline_time")?.addEventListener("change", async e => {
    const cs2 = { ...(state.carSettings[state.selectedPlanCar] ?? {}), deadline_time: e.target.value };
    state.carSettings[state.selectedPlanCar] = cs2;
    await api("POST", `/api/car/${state.selectedPlanCar}/settings`, cs2);
    renderModeSettings(); loadAndRenderPreview();
  });
  el.querySelector("#sr-deadline-clear")?.addEventListener("click", async () => {
    const cs2 = { ...(state.carSettings[state.selectedPlanCar] ?? {}), deadline_time: "" };
    state.carSettings[state.selectedPlanCar] = cs2;
    await api("POST", `/api/car/${state.selectedPlanCar}/settings`, cs2);
    renderModeSettings(); loadAndRenderPreview();
  });
}

function slider(key, label, value, min, max, step, unit) {
  return `<div class="setting-row">
    <label>${label} — <span class="slider-val">${value}${unit}</span></label>
    <input type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-key="${key}" data-unit="${unit}" />
  </div>`;
}

function renderPlanEstimate() {
  const el = document.getElementById("plan-estimate");
  if (!el) return;
  // If a preview is loaded, loadAndRenderPreview() owns this element — don't overwrite it on poll
  if (state.previewPlan) return;
  const carStatus = state.status.find(c => c.carId === state.selectedPlanCar);
  const s = carStatus?.summary;
  if (!s) { el.innerHTML = `<div class="estimate-empty">No plan active — select a mode above.</div>`; return; }
  el.innerHTML = `
    <div class="estimate-main">+${s.kwhAdded?.toFixed(1)} kWh to ${Math.round(s.finalSoc)}%</div>
    <div class="estimate-cost">Estimated cost: ~${s.totalCost?.toFixed(2)} DKK</div>
    <div class="estimate-stats">
      <span>Cheapest slot: ${s.cheapestSlot?.ep?.toFixed(2) ?? "--"} DKK/kWh</span>
      <span>Most expensive: ${s.priesiestSlot?.ep?.toFixed(2) ?? "--"} DKK/kWh</span>
      <span>Average: ${s.avgEp?.toFixed(2) ?? "--"} DKK/kWh</span>
    </div>`;
}

function planTableRows(plan) {
  const now = new Date();
  let lastDay = "";
  return plan.map(s => {
    const dt = new Date(s.start);
    const dayStr = dt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
    const dayHeader = dayStr !== lastDay ? ((lastDay = dayStr), `<tr class="day-row"><td colspan="3">${dayStr}</td></tr>`) : "";
    const isNow = dt <= now && now < new Date(dt.getTime() + 15 * 60000);
    return `${dayHeader}<tr class="${s.isPast ? "past" : ""} ${s.charging ? "charging" : ""} ${isNow ? "now-row" : ""}">
      <td>${fmtTime(s.start)}${isNow ? " ◀" : ""}</td>
      <td>${s.ep?.toFixed(2)}</td>
      <td>${s.isPast ? "" : s.charging ? "Charging" : ""}</td>
    </tr>`;
  }).join("");
}

function renderScheduleTable() {
  const tbody = document.getElementById("schedule-body");
  if (!tbody) return;
  const plan = state.status.find(c => c.carId === state.selectedPlanCar)?.plan ?? [];
  tbody.innerHTML = planTableRows(plan);
}

async function loadAndRenderPreview() {
  if (!state.selectedPlanCar) return;
  const details = document.getElementById("preview-details");
  try {
    const { plan, settings } = await api("GET", `/api/car/${state.selectedPlanCar}/preview-plan`);
    state.previewPlan = plan;  // store so renderTimeline can merge both plans

    const chargingSlots = plan.filter(s => s.charging);
    const chargeKw = state.settings?.cars?.find(c => c.id === state.selectedPlanCar)?.charge_kw ?? 0;
    const totalKwh  = chargingSlots.length * 0.25 * chargeKw;
    const avgEp     = chargingSlots.length ? chargingSlots.reduce((a, s) => a + s.ep, 0) / chargingSlots.length : 0;
    const totalCost = chargingSlots.reduce((a, s) => a + s.ep * 0.25 * chargeKw, 0);

    // Update the estimate card
    const estimateEl = document.getElementById("plan-estimate");
    if (estimateEl) estimateEl.innerHTML = `
      <div class="estimate-main">
        <span class="legend-dot active"></span> Current &nbsp;&nbsp;
        <span class="legend-dot preview"></span> New plan
      </div>
      <div class="estimate-cost">New plan: ~${totalCost.toFixed(2)} DKK &nbsp;·&nbsp; ${chargingSlots.length} slots &nbsp;·&nbsp; avg ${avgEp.toFixed(2)} DKK/kWh</div>
      <div class="estimate-stats"><span>Mode: <strong>${settings.mode}</strong></span></div>`;

    // Redraw chart with both plans overlaid
    renderTimeline();

    // Update collapsible
    if (details) {
      document.getElementById("plan-estimate-preview").innerHTML = `
        <div class="preview-summary">
          Mode: <strong>${settings.mode}</strong> &nbsp;·&nbsp;
          ${chargingSlots.length} slots · ~${totalKwh.toFixed(1)} kWh · ~${totalCost.toFixed(2)} DKK · avg ${avgEp.toFixed(2)} DKK/kWh
        </div>`;
      document.getElementById("preview-body").innerHTML = planTableRows(plan);
      details.style.display = "";
    }
  } catch {
    if (details) details.style.display = "none";
  }
}

// ---- History ----
async function renderHistory() {
  const history = await api("GET", "/api/history").catch(() => []);
  const filterCar = document.getElementById("history-car-filter")?.value ?? "";
  const sessions = filterCar ? history.filter(s => s.carId === filterCar) : history;

  const filterSel = document.getElementById("history-car-filter");
  if (filterSel && filterSel.options.length === 1) {
    [...new Set(history.map(s => s.carId))].forEach(carId => {
      const name = history.find(s => s.carId === carId)?.carName ?? carId;
      filterSel.innerHTML += `<option value="${carId}">${name}</option>`;
    });
  }

  const totalKwh   = sessions.reduce((a, s) => a + (s.kwhAdded ?? 0), 0);
  const totalCost  = sessions.reduce((a, s) => a + (s.estimatedCost ?? 0), 0);
  const avgPrice   = sessions.length ? sessions.reduce((a, s) => a + (s.avgEffectivePrice ?? 0), 0) / sessions.length : 0;
  const totalSaved = sessions.reduce((a, s) => {
    const peak = peakRateApprox(s.startTime);
    return a + Math.max(0, (peak - (s.avgEffectivePrice ?? peak)) * (s.kwhAdded ?? 0));
  }, 0);
  document.getElementById("history-stats").innerHTML = `
    <div class="stat-card"><div class="stat-value">${totalKwh.toFixed(1)}</div><div class="stat-label">Total kWh</div></div>
    <div class="stat-card"><div class="stat-value">${totalCost.toFixed(0)}</div><div class="stat-label">Total DKK</div></div>
    <div class="stat-card"><div class="stat-value">${avgPrice.toFixed(2)}</div><div class="stat-label">Avg DKK/kWh</div></div>
    <div class="stat-card saved"><div class="stat-value">${totalSaved.toFixed(0)}</div><div class="stat-label">DKK saved vs peak</div></div>
    <div class="stat-card"><div class="stat-value">${sessions.length}</div><div class="stat-label">Sessions</div></div>`;

  const monthly = {};
  sessions.forEach(s => { const m = s.startTime?.slice(0, 7) ?? "unknown"; monthly[m] = (monthly[m] ?? 0) + (s.kwhAdded ?? 0); });
  const months = Object.keys(monthly).sort().slice(-6);
  const canvas = document.getElementById("history-chart");
  if (historyChart) historyChart.destroy();
  if (months.length) {
    historyChart = new Chart(canvas, {
      type: "bar",
      data: { labels: months, datasets: [{ label: "kWh", data: months.map(m => monthly[m]), backgroundColor: "rgba(0,0,0,0.8)", borderRadius: 2 }] },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: "#a1a1aa" } }, y: { ticks: { color: "#a1a1aa" } } } }
    });
  }

  document.getElementById("history-body").innerHTML = [...sessions].reverse().map(s => {
    const start = new Date(s.startTime), end = new Date(s.endTime);
    const dur = Math.round((end - start) / 60000);
    const peak = peakRateApprox(s.startTime);
    const saved = Math.max(0, (peak - (s.avgEffectivePrice ?? peak)) * (s.kwhAdded ?? 0));
    return `<tr>
      <td>${start.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</td>
      <td>${s.carName}</td>
      <td>${Math.round(s.startSoc)}% to ${Math.round(s.endSoc)}%</td>
      <td>${s.kwhAdded?.toFixed(1)}</td>
      <td>${s.estimatedCost?.toFixed(2)} DKK</td>
      <td>${s.avgEffectivePrice?.toFixed(2)}</td>
      <td class="${saved > 0.5 ? "saved-value" : ""}">${saved > 0.1 ? `${saved.toFixed(2)} DKK` : "—"}</td>
      <td>${dur >= 60 ? `${Math.floor(dur/60)}h ${dur%60}m` : `${dur}m`}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="8" class="empty-row">No sessions yet</td></tr>`;
}

// ---- Settings ----
function renderSettingsView() {
  if (!state.settings) return;
  renderCarsList();
  renderPriceSourceForm();
  renderTariffsForm();
  renderNotifForm();
}

function renderPriceSourceForm() {
  const s = state.settings;
  const areaEl = document.getElementById("ps-area");
  if (areaEl) areaEl.value = s.area ?? "DK1";
  const tokenEl = document.getElementById("ps-entso-token");
  if (tokenEl) tokenEl.value = s.entso_e_token ?? "";
  const rateEl = document.getElementById("ps-eur-dkk");
  if (rateEl) rateEl.value = s.eur_dkk_rate ?? 7.46;

  // Set active toggle based on whether a token is stored
  const useEntsoe = !!(s.entso_e_token);
  document.querySelectorAll(".source-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.source === (useEntsoe ? "entsoe" : "elpris"));
  });
  const fields = document.getElementById("entsoe-fields");
  if (fields) fields.style.display = useEntsoe ? "" : "none";
}

// ---- Searchable entity picker ----
function setupEntityPicker(hostId, entities, selected, keywords) {
  const host = document.getElementById(hostId);
  if (!host) return;

  const suggested = entities.filter(e =>
    keywords.some(k => e.entity_id.toLowerCase().includes(k) || (e.friendly_name ?? "").toLowerCase().includes(k))
  );
  const rest = entities.filter(e => !suggested.includes(e));

  const displayName = (v) => v ? (entities.find(e => e.entity_id === v)?.friendly_name ?? v) : "";

  host.innerHTML = `
    <div class="ep">
      <input class="ep-input" type="text" autocomplete="off" placeholder="Search..." value="${displayName(selected)}">
      <div class="ep-dropdown" hidden></div>
      <input class="ep-value" type="hidden" value="${selected ?? ""}">
    </div>`;

  const input    = host.querySelector(".ep-input");
  const dropdown = host.querySelector(".ep-dropdown");
  const hidden   = host.querySelector(".ep-value");

  function buildList(filter) {
    const q = filter.toLowerCase();
    const match = e => !q || e.entity_id.toLowerCase().includes(q) || (e.friendly_name ?? "").toLowerCase().includes(q);
    const filtSuggested = suggested.filter(match);
    const filtRest      = rest.filter(match);
    let html = `<div class="ep-option" data-value="">(none)</div>`;
    if (filtSuggested.length) {
      html += `<div class="ep-group">Suggested</div>`;
      html += filtSuggested.map(e => optionHtml(e)).join("");
    }
    if (filtRest.length) {
      if (filtSuggested.length) html += `<div class="ep-group">All</div>`;
      html += filtRest.map(e => optionHtml(e)).join("");
    }
    if (!filtSuggested.length && !filtRest.length) html += `<div class="ep-empty">No results</div>`;
    dropdown.innerHTML = html;
    dropdown.querySelectorAll(".ep-option").forEach(opt => {
      if (opt.dataset.value === hidden.value) opt.classList.add("selected");
      opt.addEventListener("mousedown", (ev) => {
        ev.preventDefault();
        hidden.value  = opt.dataset.value;
        input.value   = opt.dataset.value ? (entities.find(e => e.entity_id === opt.dataset.value)?.friendly_name ?? opt.dataset.value) : "";
        dropdown.hidden = true;
      });
    });
  }

  function optionHtml(e) {
    return `<div class="ep-option" data-value="${e.entity_id}">
      ${e.friendly_name ?? e.entity_id}
      <span class="ep-id">${e.entity_id}</span>
    </div>`;
  }

  input.addEventListener("focus", () => { buildList(input.value); dropdown.hidden = false; });
  input.addEventListener("input", () => { buildList(input.value); dropdown.hidden = false; });
  input.addEventListener("blur",  () => {
    setTimeout(() => { dropdown.hidden = true; }, 150);
    // Restore display name if user typed something invalid
    input.value = displayName(hidden.value);
  });
}

async function testCar(carId) {
  // Show modal immediately with loading state
  let modal = document.getElementById("test-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "test-modal";
    modal.className = "test-modal-overlay";
    document.body.appendChild(modal);
    modal.addEventListener("click", e => { if (e.target === modal) modal.hidden = true; });
  }
  modal.hidden = false;
  modal.innerHTML = `<div class="test-modal">
    <div class="test-modal-header"><h2>Testing car…</h2><button class="btn btn-sm" id="test-close">Close</button></div>
    <div class="test-modal-body"><p style="color:var(--gray-400)">Reading entity states from Home Assistant…</p></div>
  </div>`;
  document.getElementById("test-close").onclick = () => { modal.hidden = true; };

  try {
    const result = await api("GET", `/api/car/${carId}/test`);
    const rows = result.entities.map(e => {
      const icon = e.ok ? "OK" : "FAIL";
      const cls  = e.ok ? "test-ok" : "test-fail";
      return `<tr class="${cls}">
        <td>${e.label}</td>
        <td class="test-entity-id">${e.entity_id ?? "—"}</td>
        <td>${e.state !== null ? `${e.state}${e.unit ? " " + e.unit : ""}` : "—"}</td>
        <td><span class="test-status-icon ${cls}">${icon}</span> ${e.note ?? (e.ok ? "OK" : "Not found")}</td>
      </tr>`;
    }).join("");
    modal.innerHTML = `<div class="test-modal">
      <div class="test-modal-header">
        <div>
          <h2>${result.car}</h2>
          <span class="test-ha-status ${result.haConnected ? "test-ok" : "test-fail"}">HA ${result.haConnected ? "Connected" : "Not connected"}</span>
        </div>
        <button class="btn btn-sm" id="test-close">Close</button>
      </div>
      <div class="test-modal-body">
        ${result.entities.length === 0 ? '<p style="color:var(--gray-400)">No entities configured. Edit the car to add sensors.</p>' : `
        <table class="data-table test-table">
          <thead><tr><th>Sensor</th><th>Entity ID</th><th>Current value</th><th>Status</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`}
      </div>
    </div>`;
    document.getElementById("test-close").onclick = () => { modal.hidden = true; };
  } catch (e) {
    modal.innerHTML = `<div class="test-modal">
      <div class="test-modal-header"><h2>Test failed</h2><button class="btn btn-sm" id="test-close">Close</button></div>
      <div class="test-modal-body"><p style="color:var(--red)">${e.message}</p></div>
    </div>`;
    document.getElementById("test-close").onclick = () => { modal.hidden = true; };
  }
}

function renderCarsList() {
  const el = document.getElementById("cars-list");
  if (!el) return;
  const cars = state.settings?.cars ?? [];
  if (!cars.length) { el.innerHTML = `<div class="empty-note">No cars added yet.</div>`; return; }
  el.innerHTML = cars.map(car => `
    <div class="car-list-item">
      <div class="car-list-info">
        <span class="car-list-name">${car.name}</span>
        <span class="car-list-meta">${car.battery_kwh} kWh  ${car.charge_kw} kW AC</span>
      </div>
      <div class="car-list-actions">
        <button class="btn btn-sm" data-test="${car.id}">Test</button>
        <button class="btn btn-sm" data-edit="${car.id}">Edit</button>
        <button class="btn btn-sm btn-danger" data-delete="${car.id}">Remove</button>
      </div>
    </div>`).join("");
  el.querySelectorAll("[data-edit]").forEach(btn => btn.addEventListener("click", () => openCarForm(btn.dataset.edit)));
  el.querySelectorAll("[data-delete]").forEach(btn => btn.addEventListener("click", () => deleteCar(btn.dataset.delete)));
  el.querySelectorAll("[data-test]").forEach(btn => btn.addEventListener("click", () => testCar(btn.dataset.test)));
}

function openCarForm(carId = null) {
  const card = document.getElementById("car-form-card");
  document.getElementById("car-form-title").textContent = carId ? "Edit car" : "Add car";
  state.editingCarId = carId;
  card.style.display = "";
  const car = carId ? state.settings.cars.find(c => c.id === carId) : {};
  document.getElementById("cf-id").value       = car?.id ?? "";
  document.getElementById("cf-id").disabled    = !!carId;
  document.getElementById("cf-name").value     = car?.name ?? "";
  document.getElementById("cf-battery").value  = car?.battery_kwh ?? 71.2;
  document.getElementById("cf-chargekw").value = car?.charge_kw ?? 9.5;
  const entityKeys = { "cf-switch": "charging_switch", "cf-soc": "soc_entity", "cf-plug": "plug_entity", "cf-power": "power_entity", "cf-limit": "charge_limit_entity", "cf-refresh": "refresh_entity" };
  const domains    = { "cf-switch": "switch", "cf-soc": "sensor", "cf-plug": "binary_sensor", "cf-power": "sensor", "cf-limit": "number", "cf-refresh": ["button", "script"] };
  const keywords   = {
    "cf-switch":  ["charg", "ev", "car", "vehicle", "wallbox", "zaptec", "easee", "charger"],
    "cf-soc":     ["soc", "battery", "state_of_charge", "charge_level", "batt"],
    "cf-plug":    ["plug", "connect", "cable", "charg", "ev", "vehicle"],
    "cf-power":   ["power", "watt", "charg", "kw", "ev"],
    "cf-limit":   ["limit", "charge", "max", "target", "level"],
    "cf-refresh": ["refresh", "update", "sync", "fetch", "kia", "hyundai", "ev", "connect"],
  };
  Object.entries(domains).forEach(([selId, domain]) => {
    const domainArr = Array.isArray(domain) ? domain : [domain];
    const entities = state.haEntities.filter(e => domainArr.includes(e.domain));
    const current  = car?.[entityKeys[selId]] ?? "";
    setupEntityPicker(selId, entities, current, keywords[selId] ?? []);
  });
  card.scrollIntoView({ behavior: "smooth" });
}

async function deleteCar(carId) {
  if (!confirm(`Remove ${carId}?`)) return;
  await api("DELETE", `/api/settings/cars/${carId}`);
  state.settings = await api("GET", "/api/settings");
  renderCarsList(); await loadStatus();
}

function renderTariffsForm() {
  const tariffs = state.settings?.tariffs ?? {};
  document.querySelectorAll(".tf").forEach(inp => {
    const key = inp.dataset.key;
    const val = tariffs[key] ?? DEFAULT_TARIFFS[key] ?? 0;
    inp.value = val;
    // Show default below the input
    let hint = inp.nextElementSibling;
    if (!hint || !hint.classList.contains("default-val")) {
      hint = document.createElement("div");
      hint.className = "default-val";
      inp.after(hint);
    }
    hint.textContent = `Default: ${DEFAULT_TARIFFS[key]}`;
  });
}

function renderNotifForm() {
  const n = state.settings?.notifications ?? {};
  document.getElementById("nf-published").checked = n.price_published ?? true;
  document.getElementById("nf-complete").checked   = n.charge_complete ?? true;
  document.getElementById("nf-spike").value        = n.price_spike_threshold ?? 3.0;
}

// ---- Utilities ----
function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
}

function fmtAgo(iso) {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)  return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return new Date(iso).toLocaleString("da-DK", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

async function refreshCar(carId, btn) {
  const orig = btn.textContent;
  btn.disabled = true; btn.textContent = "...";
  try {
    await api("POST", `/api/car/${carId}/refresh`);
    await loadStatus();
  } finally {
    btn.disabled = false; btn.textContent = orig;
  }
}

// ---- Event listeners ----
document.addEventListener("DOMContentLoaded", () => {
  // Dark mode toggle
  const html = document.documentElement;
  const saved = localStorage.getItem("ev-theme");
  if (saved) html.dataset.theme = saved;
  document.getElementById("theme-toggle").addEventListener("click", () => {
    const isDark = html.dataset.theme === "dark";
    html.dataset.theme = isDark ? "light" : "dark";
    localStorage.setItem("ev-theme", html.dataset.theme);
    renderPriceChart(); // rebuild with correct dark/light colors
    renderTimeline();
  });

  document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", e => {
      e.preventDefault();
      document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
      document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
      link.classList.add("active");
      document.getElementById(`view-${link.dataset.view}`).classList.add("active");
      if (link.dataset.view === "history")  renderHistory();
      if (link.dataset.view === "settings") renderSettingsView();
      if (link.dataset.view === "plan")     { renderPlan(); loadAndRenderPreview(); }
    });
  });

  document.getElementById("btn-refresh").addEventListener("click", async () => {
    await api("POST", "/api/refresh"); await loadAll();
  });

  document.getElementById("btn-execute").addEventListener("click", async () => {
    const btn = document.getElementById("btn-execute");
    const result = document.getElementById("execute-result");
    btn.disabled = true; btn.textContent = "Applying...";
    try {
      const r = await api("POST", `/api/execute/${state.selectedPlanCar}`);
      result.textContent = r.result ?? "Done"; result.className = "execute-result success";
      await loadStatus();  // refresh plan view after apply
      state.previewPlan = null;  // clear preview — active plan IS the new plan now
    } catch (e) {
      result.textContent = e.message; result.className = "execute-result error";
    } finally { btn.disabled = false; btn.textContent = "Apply Plan"; }
  });

  document.getElementById("plan-car-select").addEventListener("change", async e => {
    state.selectedPlanCar = e.target.value;
    state.previewPlan = null;
    state.carSettings[state.selectedPlanCar] = state.status.find(c => c.carId === e.target.value)?.settings ?? {};
    renderPlan();
    loadAndRenderPreview();
  });

  document.getElementById("history-car-filter").addEventListener("change", renderHistory);
  document.getElementById("btn-add-car").addEventListener("click", () => openCarForm(null));

  document.getElementById("car-form").addEventListener("submit", async e => {
    e.preventDefault();
    const val = id => {
      const el = document.getElementById(id);
      if (el?.classList.contains("ep-host")) return el.querySelector(".ep-value")?.value ?? "";
      return el?.value ?? "";
    };
    const car = {
      id:                       val("cf-id").trim(),
      name:                     val("cf-name").trim(),
      battery_kwh:              parseFloat(val("cf-battery")),
      charge_kw:                parseFloat(val("cf-chargekw")),
      charging_switch:          val("cf-switch")      || undefined,
      soc_entity:               val("cf-soc")         || undefined,
      plug_entity:         val("cf-plug")    || undefined,
      power_entity:        val("cf-power")   || undefined,
      charge_limit_entity: val("cf-limit")   || undefined,
      refresh_entity:      val("cf-refresh") || undefined,
    };
    if (state.editingCarId) await api("PUT",  `/api/settings/cars/${state.editingCarId}`, car);
    else                    await api("POST", "/api/settings/cars", car);
    document.getElementById("car-form-card").style.display = "none";
    state.settings = await api("GET", "/api/settings");
    renderCarsList(); await loadStatus();
  });

  document.getElementById("cf-cancel").addEventListener("click", () => {
    document.getElementById("car-form-card").style.display = "none";
  });

  // Source toggle
  document.querySelectorAll(".source-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".source-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("entsoe-fields").style.display = btn.dataset.source === "entsoe" ? "" : "none";
    });
  });

  document.getElementById("price-source-form").addEventListener("submit", async e => {
    e.preventDefault();
    const useEntsoe = document.querySelector(".source-btn.active")?.dataset.source === "entsoe";
    const s = await api("GET", "/api/settings");
    s.area          = document.getElementById("ps-area").value;
    s.entso_e_token = useEntsoe ? (document.getElementById("ps-entso-token").value.trim()) : "";
    s.eur_dkk_rate  = parseFloat(document.getElementById("ps-eur-dkk").value) || 7.46;
    await api("POST", "/api/settings", s);
    state.settings = await api("GET", "/api/settings");
    await api("POST", "/api/refresh").catch(() => {});
    const priceResp = await api("GET", "/api/prices");
    state.prices = priceResp.slots ?? priceResp;
    state.priceError = priceResp.error ?? null;
    renderDashboard();
  });

  document.getElementById("tariffs-form").addEventListener("submit", async e => {
    e.preventDefault();
    const tariffs = {};
    document.querySelectorAll(".tf").forEach(inp => { tariffs[inp.dataset.key] = parseFloat(inp.value); });
    await api("POST", "/api/settings/tariffs", tariffs);
    state.settings = await api("GET", "/api/settings");
    renderTariffsForm();
  });

  document.getElementById("notif-form").addEventListener("submit", async e => {
    e.preventDefault();
    await api("POST", "/api/settings/notifications", {
      price_published:       document.getElementById("nf-published").checked,
      charge_complete:       document.getElementById("nf-complete").checked,
      price_spike_threshold: parseFloat(document.getElementById("nf-spike").value),
    });
  });

  loadAll().catch(console.error);
  connectWs();
  // HTTP fallback poll — keeps data fresh even if WS can't connect through Ingress
  setInterval(() => loadStatus().catch(() => {}), 10000);
});

