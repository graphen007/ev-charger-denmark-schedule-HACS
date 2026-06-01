import express, { type Request, type Response, type NextFunction } from "express";
import http from "http";
import { WebSocketServer, type WebSocket as Ws } from "ws";
import path from "path";
import type { Controller } from "./controller.js";
import type { HaClient } from "./haClient.js";
import { loadSettings, saveSettings, getCarSettings, saveCarSettings,
  loadSessions, type GlobalSettings,
} from "./settings.js";
import { fetchForecast } from "./priceClient.js";
import { buildChargePlan, getActiveChargeKw, type CarConfig, type ChargerConfig } from "./planner.js";
import { isDbConnected, dbGetPricesForDate, dbGetPriceSlots } from "./db.js";
import { randomUUID } from "crypto";

export function createWebServer(controller: Controller, ha: HaClient) {
  const app = express();
  app.use(express.json());

  // Request timing — logs every request so we can tell if slowness is server-side or ingress
  app.use((req: Request, res: Response, next: NextFunction) => {
    const t0 = Date.now();
    res.on("finish", () => {
      const ms = Date.now() - t0;
      const flag = ms > 1000 ? " ⚠️ SLOW" : ms > 300 ? " ⚡ warn" : "";
      console.log(`[web] ${req.method} ${req.path} → ${res.statusCode} in ${ms}ms${flag}`);
    });
    next();
  });

  // Serve UI with no-cache for index.html so updates are always picked up
  const uiDir = path.resolve(__dirname, "../ui");
  app.use(express.static(uiDir, { etag: true, lastModified: true }));
  app.get("/", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path.join(uiDir, "index.html"));
  });

  // ---- Status ----
  app.get("/api/status", (_req, res) => {
    res.json(controller.getAllStatus());
  });

  // ---- HA entities proxy (for entity dropdowns in Settings) ----
  app.get("/api/ha/entities", (_req, res) => {
    const states = ha.getAllStates().map((s) => ({
      entity_id:    s.entity_id,
      state:        s.state,
      friendly_name: s.attributes.friendly_name ?? s.entity_id,
      domain:       s.entity_id.split(".")[0],
    }));
    res.json(states);
  });

  // ---- Global settings (full save) ----
  app.get("/api/settings", (_req, res) => res.json(loadSettings()));
  app.post("/api/settings", (req, res) => {
    const current = loadSettings();
    const updated = { ...current, ...(req.body as Partial<typeof current>) };
    saveSettings(updated);
    res.json({ ok: true });
  });

  // ---- Cars CRUD ----
  app.get("/api/settings/cars", (_req, res) => res.json(loadSettings().cars));

  app.post("/api/settings/cars", (req, res) => {
    const s = loadSettings();
    const car: CarConfig = req.body as CarConfig;
    if (!car.id || !car.name) { res.status(400).json({ error: "id and name required" }); return; }
    if (s.cars.find((c) => c.id === car.id)) { res.status(409).json({ error: "Car id already exists" }); return; }
    s.cars.push(car);
    saveSettings(s);
    res.json({ ok: true, car });
  });

  app.put("/api/settings/cars/:carId", (req, res) => {
    const s = loadSettings();
    const idx = s.cars.findIndex((c) => c.id === req.params.carId);
    if (idx < 0) { res.status(404).json({ error: "Car not found" }); return; }
    s.cars[idx] = { ...s.cars[idx], ...(req.body as Partial<CarConfig>), id: req.params.carId };
    saveSettings(s);
    res.json({ ok: true, car: s.cars[idx] });
  });

  app.delete("/api/settings/cars/:carId", (req, res) => {
    const s = loadSettings();
    s.cars = s.cars.filter((c) => c.id !== req.params.carId);
    delete s.carSettings[req.params.carId];
    saveSettings(s);
    res.json({ ok: true });
  });

  // ---- Tariffs ----
  app.get("/api/settings/tariffs", (_req, res) => res.json(loadSettings().tariffs));
  app.post("/api/settings/tariffs", (req, res) => {
    const s = loadSettings();
    s.tariffs = { ...s.tariffs, ...(req.body as Partial<GlobalSettings["tariffs"]>) };
    saveSettings(s);
    res.json({ ok: true, tariffs: s.tariffs });
  });

  // ---- Notifications ----
  app.get("/api/settings/notifications", (_req, res) => res.json(loadSettings().notifications));
  app.post("/api/settings/notifications", (req, res) => {
    const s = loadSettings();
    s.notifications = { ...s.notifications, ...(req.body as Partial<GlobalSettings["notifications"]>) };
    saveSettings(s);
    res.json({ ok: true });
  });

  // ---- Per-car charge settings ----
  app.get("/api/car/:carId/settings", (req, res) => res.json(getCarSettings(req.params.carId)));
  app.post("/api/car/:carId/settings", (req, res) => {
    saveCarSettings(req.params.carId, req.body);
    // Settings saved — plan is NOT rebuilt here; use Apply Plan to apply
    res.json({ ok: true });
  });

  // ---- Charger CRUD ----
  app.get("/api/car/:carId/chargers", (req, res) => {
    const { cars } = loadSettings();
    const car = cars.find(c => c.id === req.params.carId);
    if (!car) { res.status(404).json({ error: "Car not found" }); return; }
    res.json(car.chargers ?? []);
  });

  app.post("/api/car/:carId/chargers", (req, res) => {
    const settings = loadSettings();
    const car = settings.cars.find(c => c.id === req.params.carId);
    if (!car) { res.status(404).json({ error: "Car not found" }); return; }
    const { name, kw } = req.body as { name: string; kw: number };
    if (!name || !kw) { res.status(400).json({ error: "name and kw required" }); return; }
    const newCharger: ChargerConfig = { id: randomUUID(), name, kw: Number(kw) };
    car.chargers = [...(car.chargers ?? []), newCharger];
    saveSettings(settings);
    res.json(newCharger);
  });

  app.put("/api/car/:carId/chargers/:chargerId", (req, res) => {
    const settings = loadSettings();
    const car = settings.cars.find(c => c.id === req.params.carId);
    if (!car) { res.status(404).json({ error: "Car not found" }); return; }
    const idx = (car.chargers ?? []).findIndex(c => c.id === req.params.chargerId);
    if (idx === -1) { res.status(404).json({ error: "Charger not found" }); return; }
    const { name, kw } = req.body as { name: string; kw: number };
    car.chargers![idx] = { ...car.chargers![idx], name, kw: Number(kw) };
    saveSettings(settings);
    controller.rebuildPlan(car);
    res.json(car.chargers![idx]);
  });

  app.delete("/api/car/:carId/chargers/:chargerId", (req, res) => {
    const settings = loadSettings();
    const car = settings.cars.find(c => c.id === req.params.carId);
    if (!car) { res.status(404).json({ error: "Car not found" }); return; }
    car.chargers = (car.chargers ?? []).filter(c => c.id !== req.params.chargerId);
    saveSettings(settings);
    // If deleted charger was active, clear selection
    const carSettings = getCarSettings(req.params.carId);
    if (carSettings.activeChargerId === req.params.chargerId) {
      saveCarSettings(req.params.carId, { ...carSettings, activeChargerId: undefined });
    }
    controller.rebuildPlan(car);
    res.json({ ok: true });
  });

  // ---- Set active charger (triggers plan rebuild) ----
  app.post("/api/car/:carId/active-charger", (req, res) => {
    const { cars } = loadSettings();
    const car = cars.find(c => c.id === req.params.carId);
    if (!car) { res.status(404).json({ error: "Car not found" }); return; }
    const { chargerId } = req.body as { chargerId: string | null };
    const carSettings = getCarSettings(req.params.carId);
    saveCarSettings(req.params.carId, { ...carSettings, activeChargerId: chargerId ?? undefined });
    controller.rebuildPlan(car);
    res.json({ ok: true, activeChargerId: chargerId });
  });

  app.get("/api/car/:carId/preview-plan", (req, res) => {
    const { cars, tariffs } = loadSettings();
    const car = cars.find(c => c.id === req.params.carId);
    if (!car) { res.status(404).json({ error: "Car not found" }); return; }
    const settings = getCarSettings(req.params.carId);
    const prices = controller.getPriceSlots();
    const { soc: currentSoc } = controller.getLiveCarData(car);
    const plan = buildChargePlan(prices, settings, tariffs ?? {}, currentSoc, car.battery_kwh, getActiveChargeKw(car, settings));
    res.json({ plan, settings });
  });

  // ---- Car diagnostic test ----
  app.get("/api/car/:carId/test", (req, res) => {
    const { cars } = loadSettings();
    const car = cars.find(c => c.id === req.params.carId);
    if (!car) { res.status(404).json({ error: "Car not found" }); return; }

    function readEntity(entityId: string | undefined, label: string) {
      if (!entityId) return { label, entity_id: null, state: null, ok: false, note: "Not configured" };
      const s = ha.getState(entityId);
      return {
        label,
        entity_id: entityId,
        state: s?.state ?? null,
        unit: s?.attributes?.unit_of_measurement ?? null,
        friendly_name: s?.attributes?.friendly_name ?? null,
        ok: s !== undefined,
        note: s === undefined ? "Entity not found in HA" : null,
      };
    }

    res.json({
      car: car.name,
      haConnected: ha.isConnected(),
      entities: [
        readEntity(car.charging_switch,          "Charging switch"),
        readEntity(car.soc_entity,          "SoC sensor"),
        readEntity(car.plug_entity,         "Plug sensor"),
        readEntity(car.power_entity,        "Power sensor"),
        readEntity(car.charge_limit_entity, "Charge limit"),
      ].filter(e => e.entity_id !== null),
    });
  });


  app.get("/api/plan/:carId", (req, res) => {
    const state = controller.getCarState(req.params.carId);
    res.json(state?.plan ?? []);
  });

  // ---- Execute ----
  app.post("/api/execute/:carId", async (req, res) => {
    const result = await controller.executeNow(req.params.carId);
    res.json({ ok: true, result });
  });

  // ---- Prices ----
  app.get("/api/prices", (_req, res) => res.json({
    slots: controller.getPriceSlots(),
    error: controller.getLastPriceError(),
  }));

  // ---- Forecast ----
  app.get("/api/forecast", async (_req, res) => {
    const { area, entso_e_token, eur_dkk_rate } = loadSettings();
    try {
      // Pass DB query callback — forecast uses stored historical data, avoids 4 live API calls
      const dbQuery = isDbConnected() ? dbGetPricesForDate : undefined;
      const forecast = await fetchForecast(area, entso_e_token, eur_dkk_rate, dbQuery);
      res.json(forecast);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // ---- Historical price data ----
  app.get("/api/prices/history", async (req, res) => {
    const { area } = loadSettings();
    const queryArea = typeof req.query.area === "string" ? req.query.area : area;
    const from = typeof req.query.from === "string" ? req.query.from : (() => {
      const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().slice(0, 10);
    })();
    const to = typeof req.query.to === "string" ? req.query.to : undefined;
    if (!isDbConnected()) return res.status(503).json({ error: "DB not connected" });
    try {
      const slots = await dbGetPriceSlots(queryArea, from, to);
      res.json(slots);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // ---- History ----
  app.get("/api/history", async (_req, res) => res.json(await loadSessions()));

  // ---- Force refresh ----
  app.post("/api/refresh", async (_req, res) => {
    await controller.refreshPrices();
    res.json({ ok: true });
  });

  app.post("/api/car/:carId/refresh", async (req, res) => {
    const { cars } = loadSettings();
    const car = cars.find(c => c.id === req.params.carId);
    if (!car) return res.status(404).json({ error: "Car not found" });
    if (!car.refresh_entity) return res.status(400).json({ error: "No refresh_entity configured for this car" });
    await controller.refreshCarData(car);
    res.json({ ok: true });
  });

  // Fallback: serve index.html for all non-API routes (SPA routing)
  app.get("*", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path.join(uiDir, "index.html"));
  });

  // Error handler
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[Web]", err.message);
    res.status(500).json({ error: err.message });
  });

  // ---- WebSocket server (real-time push) ----
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: "/ws" });
  const clients = new Set<Ws>();

  wss.on("connection", (ws) => {
    clients.add(ws);
    // Send current state immediately on connect
    ws.send(JSON.stringify({ event: "status", data: controller.getAllStatus() }));
    ws.on("close", () => clients.delete(ws));
  });

  const broadcast = (event: string, data: unknown) => {
    const msg = JSON.stringify({ event, data });
    for (const ws of clients) {
      if (ws.readyState === ws.OPEN) ws.send(msg);
    }
  };

  controller.setBroadcast(broadcast);

  return { server, broadcast };
}
