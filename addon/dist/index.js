"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const haClient_js_1 = require("./haClient.js");
const controller_js_1 = require("./controller.js");
const notifier_js_1 = require("./notifier.js");
const web_js_1 = require("./web.js");
const settings_js_1 = require("./settings.js");
const PORT = parseInt(process.env.PORT ?? "8099", 10);
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
async function connectWithRetry(ha) {
    let attempt = 0;
    while (true) {
        try {
            await ha.connect();
            return;
        }
        catch (err) {
            attempt++;
            const delay = Math.min(5000 * attempt, 60000); // back off up to 60s
            console.warn(`[Main] HA not available (attempt ${attempt}): ${err.message} — retrying in ${delay / 1000}s`);
            await sleep(delay);
        }
    }
}
async function postConnectSetup(ha, controller) {
    // Check if any configured cars are already plugged in
    const { cars } = (0, settings_js_1.loadSettings)();
    for (const car of cars) {
        if (car.plug_entity) {
            const state = ha.getState(car.plug_entity);
            if (state?.state === "on") {
                console.log(`[Main] ${car.name} already plugged in at startup`);
                await controller.onPlugIn(car);
            }
        }
    }
    // Fetch prices for the first time
    await controller.refreshPrices();
}
async function main() {
    console.log("=== EV Smart Charging Denmark v2.0 ===");
    const ha = new haClient_js_1.HaClient();
    const notifier = new notifier_js_1.Notifier(ha);
    const controller = new controller_js_1.Controller(ha, notifier);
    // Wire HA state_changed → controller plug events
    ha.onStateChanged(async (entityId, newState, oldState) => {
        if (!newState || !oldState)
            return;
        const { cars } = (0, settings_js_1.loadSettings)();
        for (const car of cars) {
            if (car.plug_entity === entityId) {
                const wasPlugged = oldState.state === "on";
                const isPlugged = newState.state === "on";
                if (!wasPlugged && isPlugged)
                    await controller.onPlugIn(car);
                if (wasPlugged && !isPlugged)
                    await controller.onPlugOut(car);
            }
        }
    });
    // Re-run post-connect setup on every reconnect (HA may have restarted)
    ha.onConnect(() => { postConnectSetup(ha, controller).catch(console.error); });
    // ---- Start web server immediately (UI accessible before HA connects) ----
    const { server } = (0, web_js_1.createWebServer)(controller, ha);
    server.listen(PORT, () => {
        console.log(`[Web] Listening on port ${PORT} — UI ready`);
    });
    // ---- Connect to HA with unlimited retries in background ----
    connectWithRetry(ha)
        .then(() => console.log("[Main] HA connection established"))
        .catch(console.error); // never rejects, but just in case
    // 5-minute charge control tick
    const tickInterval = setInterval(() => { controller.tick().catch(console.error); }, 5 * 60 * 1000);
    // Poll for tomorrow's prices every 30 min between 13:00 and 15:00
    const pricePoller = setInterval(async () => {
        const h = new Date().getHours();
        if (h >= 13 && h <= 15) {
            const slots = controller.getPriceSlots();
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = tomorrow.toDateString();
            const hasTomorrow = slots.some((s) => new Date(s.start).toDateString() === tomorrowStr);
            if (!hasTomorrow)
                await controller.refreshPrices().catch(console.error);
        }
    }, 30 * 60 * 1000);
    // Midnight price refresh
    const midnightInterval = setInterval(async () => {
        const now = new Date();
        if (now.getHours() === 0 && now.getMinutes() < 6) {
            await controller.refreshPrices().catch(console.error);
        }
    }, 5 * 60 * 1000);
    // Graceful shutdown
    const shutdown = () => {
        console.log("[Main] Shutting down…");
        clearInterval(tickInterval);
        clearInterval(pricePoller);
        clearInterval(midnightInterval);
        server.close();
        process.exit(0);
    };
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
}
main().catch((err) => {
    console.error("[Main] Fatal:", err);
    process.exit(1);
});
