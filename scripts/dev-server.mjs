/**
 * EV Charging Addon — local dev server with mock API
 * Usage: node scripts/dev-server.mjs
 * Opens http://localhost:7000 with the UI and realistic mock data.
 */
import { createServer } from "http";
import { readFile } from "fs/promises";
import { join, extname } from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const UI_DIR = join(__dirname, "..", "addon", "ui");
const PORT = parseInt(process.env.PORT ?? "7001", 10);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css":  "text/css",
  ".js":   "application/javascript",
  ".json": "application/json",
  ".ico":  "image/x-icon",
  ".png":  "image/png",
};

// ---- Mock data ----
const now = new Date();
function addHours(h) { return new Date(now.getTime() + h * 3600000); }
function subHours(h) { return new Date(now.getTime() - h * 3600000); }

// 24 hourly price slots — realistic DK1 prices in øre/MWh
const PRICES_RAW = [
  320, 280, 260, 245, 250, 310, 580, 920, 1100, 980, 850, 780,
  720, 680, 650, 700, 890, 1250, 1420, 1380, 1100, 890, 650, 420,
];
const startOfDay = new Date(now);
startOfDay.setHours(0, 0, 0, 0);
const prices = PRICES_RAW.map((v, i) => ({
  start: new Date(startOfDay.getTime() + i * 3600000).toISOString(),
  area: "DK1",
  value: v,
}));

// 96 quarter-hour plan slots for today
const planSlots = Array.from({ length: 96 }, (_, i) => {
  const slotStart = new Date(startOfDay.getTime() + i * 15 * 60000);
  const hour = slotStart.getHours();
  // Charge during cheap hours: 00-06, 10-12
  const charging = (hour >= 1 && hour < 5) || (hour >= 10 && hour < 12);
  const hPrice = PRICES_RAW[hour] ?? 800;
  const tariff = 0.3906 + 0.2093;
  const ep = parseFloat(((hPrice / 1000) * 1.25 + tariff).toFixed(4));
  return {
    start: slotStart.toISOString(),
    end: new Date(slotStart.getTime() + 15 * 60000).toISOString(),
    charging,
    ep,
    localDate: slotStart.toISOString(),
  };
});

const chargingSlots = planSlots.filter(s => s.charging);
const activeChargeKw = 10.5;
const totalKwh = chargingSlots.length * 0.25 * activeChargeKw;
const avgEp = chargingSlots.reduce((a, s) => a + s.ep, 0) / (chargingSlots.length || 1);

const mockStatus = [
  {
    carId: "kia_ev6",
    carName: "Kia EV6",
    chargers: [
      { id: "ch1", name: "Home wallbox", kw: 10.5 },
      { id: "ch2", name: "Schuko socket", kw: 1.7 },
    ],
    activeChargerId: "ch1",
    activeChargeKw,
    plugged: true,
    isCharging: false,
    isFastCharger: false,
    soc: 47,
    powerW: 0,
    mode: "Cheapest Hours",
    plan: planSlots,
    summary: {
      chargingSlots: chargingSlots.length,
      totalKwh: parseFloat(totalKwh.toFixed(2)),
      estimatedCost: parseFloat((totalKwh * avgEp).toFixed(2)),
      reachableSoc: 80,
      targetSoc: 80,
      maxPossibleKwh: 24.5,
    },
    plannedAction: "pause",
    currentSlotEp: 0.68,
    lastCommand: { action: "stop", time: subHours(2).toISOString() },
    co2gPerKwh: 138,
    settings: {
      mode: "Cheapest Hours",
      price_threshold: 0.5,
      max_price_cap: 0,
      cheapest_hours: 4,
      deadline_time: "07:30",
      target_soc: 80,
      charge_limit: 100,
      manual_soc: 20,
      activeChargerId: "ch1",
      recurringSchedules: [
        { id: "r1", days: [1, 2, 3, 4, 5], time: "07:30", targetSoc: 80 },
      ],
    },
  },
];

const mockSettings = {
  area: "DK1",
  entso_e_token: "",
  eur_dkk_rate: 7.46,
  tariffs: {
    low: 0.1302, high_summer: 0.1302, high_winter: 0.3906,
    peak_summer: 0.1302, peak_winter: 0.8228,
    energinet: 0.2093, elafgift: 0.0, supplier: 0.0,
  },
  notifications: { price_published: true, charge_complete: true, price_spike_threshold: 3.0 },
  cars: [
    {
      id: "kia_ev6",
      name: "Kia EV6",
      battery_kwh: 77.4,
      charge_kw: 10.5,
      chargers: [
        { id: "ch1", name: "Home wallbox", kw: 10.5 },
        { id: "ch2", name: "Schuko socket", kw: 1.7 },
      ],
      charging_switch: "switch.kia_ev6_charger",
      soc_entity: "sensor.kia_ev6_soc",
      plug_entity: "binary_sensor.kia_ev6_plug",
      power_entity: "sensor.kia_ev6_power",
    },
  ],
  carSettings: {
    kia_ev6: mockStatus[0].settings,
  },
};

const mockHistory = Array.from({ length: 12 }, (_, i) => ({
  id: `kia_ev6_${Date.now() - i * 86400000}`,
  carId: "kia_ev6",
  carName: "Kia EV6",
  startTime: subHours(24 * i + 8).toISOString(),
  endTime: subHours(24 * i + 3).toISOString(),
  startSoc: 20 + Math.floor(Math.random() * 20),
  endSoc: 75 + Math.floor(Math.random() * 15),
  kwhAdded: parseFloat((20 + Math.random() * 30).toFixed(1)),
  estimatedCost: parseFloat((8 + Math.random() * 12).toFixed(2)),
  avgEffectivePrice: parseFloat((0.6 + Math.random() * 0.5).toFixed(4)),
  avgChargeKw: parseFloat((9 + Math.random() * 2).toFixed(1)),
  co2gPerKwh: Math.round(100 + Math.random() * 150),
}));

// Forecast mock
const forecastDays = Array.from({ length: 7 }, (_, dayIdx) => {
  const date = new Date(now);
  date.setDate(date.getDate() + dayIdx + 1);
  const hours = Array.from({ length: 24 }, (_, h) => {
    const base = PRICES_RAW[h] ?? 800;
    const jitter = (Math.random() - 0.5) * 200;
    const mean = (base + jitter) / 1000 * 1.25 + 0.3906 + 0.2093;
    return {
      hour: h,
      mean: parseFloat(mean.toFixed(4)),
      low:  parseFloat((mean * 0.85).toFixed(4)),
      high: parseFloat((mean * 1.15).toFixed(4)),
      wind: parseFloat((40 + Math.random() * 40).toFixed(1)),
      solar: parseFloat((dayIdx < 2 ? Math.max(0, Math.sin((h - 6) * Math.PI / 12) * 600) : 0).toFixed(1)),
    };
  });
  const eps = hours.map(h => h.mean);
  return {
    date: date.toISOString().slice(0, 10),
    label: date.toLocaleDateString("da-DK", { weekday: "short", day: "numeric", month: "short" }),
    hours,
    avgEp: parseFloat((eps.reduce((a, b) => a + b, 0) / eps.length).toFixed(4)),
    minEp: parseFloat(Math.min(...eps).toFixed(4)),
    maxEp: parseFloat(Math.max(...eps).toFixed(4)),
    confidence: 0.75,
    weeksOfHistory: 8,
    windForecast: "strong",
  };
});

// ---- Route table ----
function mockApi(path, method) {
  const j = (data) => JSON.stringify(data);

  if (method === "GET") {
    if (path === "/api/status")          return j(mockStatus);
    if (path === "/api/prices")          return j(prices);
    if (path === "/api/settings")        return j(mockSettings);
    if (path === "/api/history")         return j(mockHistory);
    if (path === "/api/forecast")        return j(forecastDays);
    if (path === "/api/ha-entities")     return j([]);
    if (path.startsWith("/api/car/") && path.endsWith("/settings"))
      return j(mockStatus[0].settings);
    if (path.startsWith("/api/car/") && path.endsWith("/chargers"))
      return j(mockSettings.cars[0].chargers);
    if (path.startsWith("/api/car/") && path.endsWith("/preview-plan"))
      return j({ plan: planSlots, settings: mockStatus[0].settings });
    if (path === "/api/prices/percentile") return j({ percentile: 28, count: 672 });
    if (path === "/api/prices/history")  return j(prices);
  }
  if (method === "POST" || method === "PUT" || method === "DELETE") {
    return j({ ok: true });
  }
  return null;
}

// ---- HTTP server ----
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // CORS for local dev
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  // API routes
  if (pathname.startsWith("/api/")) {
    const body = mockApi(pathname, req.method);
    if (body !== null) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(body);
    } else {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
    }
    return;
  }

  // Static files
  let filePath = pathname === "/" ? "/index.html" : pathname;
  // Strip query string from filename
  filePath = filePath.split("?")[0];
  const fullPath = join(UI_DIR, filePath);

  try {
    const data = await readFile(fullPath);
    const ext = extname(fullPath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] ?? "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404); res.end("Not found");
  }
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n  🔌 EV Charging UI — dev server\n  → ${url}\n`);
  // Open in browser
  const open = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  exec(`${open} ${url}`);
});
