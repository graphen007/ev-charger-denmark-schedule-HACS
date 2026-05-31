"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWebServer = createWebServer;
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const ws_1 = require("ws");
const path_1 = __importDefault(require("path"));
const settings_js_1 = require("./settings.js");
const priceClient_js_1 = require("./priceClient.js");
function createWebServer(controller, ha) {
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    // Serve UI with no-cache for index.html so updates are always picked up
    const uiDir = path_1.default.resolve(__dirname, "../ui");
    app.use(express_1.default.static(uiDir, { etag: true, lastModified: true }));
    app.get("/", (_req, res) => {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.sendFile(path_1.default.join(uiDir, "index.html"));
    });
    // ---- Status ----
    app.get("/api/status", (_req, res) => {
        res.json(controller.getAllStatus());
    });
    // ---- HA entities proxy (for entity dropdowns in Settings) ----
    app.get("/api/ha/entities", (_req, res) => {
        const states = ha.getAllStates().map((s) => ({
            entity_id: s.entity_id,
            state: s.state,
            friendly_name: s.attributes.friendly_name ?? s.entity_id,
            domain: s.entity_id.split(".")[0],
        }));
        res.json(states);
    });
    // ---- Global settings ----
    app.get("/api/settings", (_req, res) => res.json((0, settings_js_1.loadSettings)()));
    // ---- Cars CRUD ----
    app.get("/api/settings/cars", (_req, res) => res.json((0, settings_js_1.loadSettings)().cars));
    app.post("/api/settings/cars", (req, res) => {
        const s = (0, settings_js_1.loadSettings)();
        const car = req.body;
        if (!car.id || !car.name) {
            res.status(400).json({ error: "id and name required" });
            return;
        }
        if (s.cars.find((c) => c.id === car.id)) {
            res.status(409).json({ error: "Car id already exists" });
            return;
        }
        s.cars.push(car);
        (0, settings_js_1.saveSettings)(s);
        res.json({ ok: true, car });
    });
    app.put("/api/settings/cars/:carId", (req, res) => {
        const s = (0, settings_js_1.loadSettings)();
        const idx = s.cars.findIndex((c) => c.id === req.params.carId);
        if (idx < 0) {
            res.status(404).json({ error: "Car not found" });
            return;
        }
        s.cars[idx] = { ...s.cars[idx], ...req.body, id: req.params.carId };
        (0, settings_js_1.saveSettings)(s);
        res.json({ ok: true, car: s.cars[idx] });
    });
    app.delete("/api/settings/cars/:carId", (req, res) => {
        const s = (0, settings_js_1.loadSettings)();
        s.cars = s.cars.filter((c) => c.id !== req.params.carId);
        delete s.carSettings[req.params.carId];
        (0, settings_js_1.saveSettings)(s);
        res.json({ ok: true });
    });
    // ---- Tariffs ----
    app.get("/api/settings/tariffs", (_req, res) => res.json((0, settings_js_1.loadSettings)().tariffs));
    app.post("/api/settings/tariffs", (req, res) => {
        const s = (0, settings_js_1.loadSettings)();
        s.tariffs = { ...s.tariffs, ...req.body };
        (0, settings_js_1.saveSettings)(s);
        res.json({ ok: true, tariffs: s.tariffs });
    });
    // ---- Notifications ----
    app.get("/api/settings/notifications", (_req, res) => res.json((0, settings_js_1.loadSettings)().notifications));
    app.post("/api/settings/notifications", (req, res) => {
        const s = (0, settings_js_1.loadSettings)();
        s.notifications = { ...s.notifications, ...req.body };
        (0, settings_js_1.saveSettings)(s);
        res.json({ ok: true });
    });
    // ---- Per-car charge settings ----
    app.get("/api/car/:carId/settings", (req, res) => res.json((0, settings_js_1.getCarSettings)(req.params.carId)));
    app.post("/api/car/:carId/settings", (req, res) => {
        (0, settings_js_1.saveCarSettings)(req.params.carId, req.body);
        res.json({ ok: true });
    });
    // ---- Car diagnostic test ----
    app.get("/api/car/:carId/test", (req, res) => {
        const { cars } = (0, settings_js_1.loadSettings)();
        const car = cars.find(c => c.id === req.params.carId);
        if (!car) {
            res.status(404).json({ error: "Car not found" });
            return;
        }
        function readEntity(entityId, label) {
            if (!entityId)
                return { label, entity_id: null, state: null, ok: false, note: "Not configured" };
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
                readEntity(car.charging_switch, "Charging switch"),
                readEntity(car.soc_entity, "SoC sensor"),
                readEntity(car.plug_entity, "Plug sensor"),
                readEntity(car.power_entity, "Power sensor"),
                readEntity(car.charge_limit_entity, "Charge limit"),
                readEntity(car.solar_power_entity, "Solar power"),
                readEntity(car.house_consumption_entity, "House consumption"),
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
        const { area } = (0, settings_js_1.loadSettings)();
        try {
            const forecast = await (0, priceClient_js_1.fetchForecast)(area);
            res.json(forecast);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    // ---- History ----
    app.get("/api/history", (_req, res) => res.json((0, settings_js_1.loadSessions)()));
    // ---- Force refresh ----
    app.post("/api/refresh", async (_req, res) => {
        await controller.refreshPrices();
        res.json({ ok: true });
    });
    // Fallback: serve index.html for all non-API routes (SPA routing)
    app.get("*", (_req, res) => {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.sendFile(path_1.default.join(uiDir, "index.html"));
    });
    // Error handler
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    app.use((err, _req, res, _next) => {
        console.error("[Web]", err.message);
        res.status(500).json({ error: err.message });
    });
    // ---- WebSocket server (real-time push) ----
    const server = http_1.default.createServer(app);
    const wss = new ws_1.WebSocketServer({ server, path: "/ws" });
    const clients = new Set();
    wss.on("connection", (ws) => {
        clients.add(ws);
        // Send current state immediately on connect
        ws.send(JSON.stringify({ event: "status", data: controller.getAllStatus() }));
        ws.on("close", () => clients.delete(ws));
    });
    const broadcast = (event, data) => {
        const msg = JSON.stringify({ event, data });
        for (const ws of clients) {
            if (ws.readyState === ws.OPEN)
                ws.send(msg);
        }
    };
    controller.setBroadcast(broadcast);
    return { server, broadcast };
}
