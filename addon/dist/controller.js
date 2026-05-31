"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Controller = void 0;
const priceClient_js_1 = require("./priceClient.js");
const planner_js_1 = require("./planner.js");
const settings_js_1 = require("./settings.js");
/** Is the car on a DC fast charger? (power >> home AC charge rate) */
function isFastCharger(powerW, chargeKw) {
    return powerW > chargeKw * 1500;
}
class Controller {
    constructor(ha, notifier) {
        this.ha = ha;
        this.notifier = notifier;
        this.carStates = new Map();
        this.priceSlots = [];
        this.broadcastFn = null;
    }
    setBroadcast(fn) {
        this.broadcastFn = fn;
    }
    broadcast(event, data) {
        this.broadcastFn?.(event, data);
    }
    getSoc(car) {
        const s = (0, settings_js_1.loadSettings)();
        if (car.soc_entity) {
            const state = this.ha.getState(car.soc_entity);
            const v = parseFloat(state?.state ?? "");
            if (!isNaN(v))
                return v;
        }
        return (0, settings_js_1.getCarSettings)(car.id).manual_soc ?? 20;
    }
    getPowerW(car) {
        if (!car.power_entity)
            return 0;
        const state = this.ha.getState(car.power_entity);
        return parseFloat(state?.state ?? "0") || 0;
    }
    getSolarSurplusKw(car) {
        if (!car.solar_power_entity)
            return 0;
        const solar = parseFloat(this.ha.getState(car.solar_power_entity)?.state ?? "0") || 0;
        const consumption = car.house_consumption_entity
            ? parseFloat(this.ha.getState(car.house_consumption_entity)?.state ?? "0") || 0
            : 0;
        return Math.max(0, (solar - consumption) / 1000); // assume W → kW
    }
    rebuildPlan(car) {
        const settings = (0, settings_js_1.getCarSettings)(car.id);
        const soc = this.getSoc(car);
        const solarSurplusKw = this.getSolarSurplusKw(car);
        const plan = (0, planner_js_1.buildChargePlan)(this.priceSlots, settings, (0, settings_js_1.loadSettings)().tariffs, soc, car.battery_kwh, car.charge_kw, solarSurplusKw);
        const state = this.carStates.get(car.id) ?? { plugged: false, plan: [] };
        state.plan = plan;
        this.carStates.set(car.id, state);
        this.broadcast("plan_updated", { carId: car.id, plan });
        return plan;
    }
    /** Called when a plug entity transitions to "on". */
    async onPlugIn(car) {
        const powerW = this.getPowerW(car);
        if (isFastCharger(powerW, car.charge_kw)) {
            console.log(`[Controller] ${car.name}: DC fast charger detected (${powerW}W) — hands off`);
            return;
        }
        console.log(`[Controller] ${car.name}: plugged in — building plan`);
        const soc = this.getSoc(car);
        const state = {
            plugged: true,
            plan: [],
            chargingSessionStart: { time: new Date(), startSoc: soc },
        };
        this.carStates.set(car.id, state);
        if (this.priceSlots.length > 0)
            this.rebuildPlan(car);
        this.broadcast("plug_changed", { carId: car.id, plugged: true });
    }
    /** Called when a plug entity transitions to "off". */
    async onPlugOut(car) {
        console.log(`[Controller] ${car.name}: unplugged — turning off charger`);
        const state = this.carStates.get(car.id);
        // Ensure charger is off
        try {
            await this.ha.callService("switch", "turn_off", { entity_id: car.charging_switch });
        }
        catch { }
        // Record session
        if (state?.chargingSessionStart) {
            const endSoc = this.getSoc(car);
            const settings = (0, settings_js_1.getCarSettings)(car.id);
            const plan = state.plan;
            const chargingSlots = plan.filter((s) => s.charging && !s.isPast);
            const kwhAdded = Math.max(0, ((endSoc - state.chargingSessionStart.startSoc) / 100) * car.battery_kwh);
            const avgEp = chargingSlots.length ? chargingSlots.reduce((a, s) => a + s.ep, 0) / chargingSlots.length : 0;
            const session = {
                id: `${car.id}_${Date.now()}`,
                carId: car.id,
                carName: car.name,
                startTime: state.chargingSessionStart.time.toISOString(),
                endTime: new Date().toISOString(),
                startSoc: state.chargingSessionStart.startSoc,
                endSoc,
                kwhAdded,
                estimatedCost: kwhAdded * avgEp,
                avgEffectivePrice: avgEp,
                co2gPerKwh: null, // filled by price client if available
            };
            (0, settings_js_1.appendSession)(session);
            if (endSoc >= (settings.charge_limit ?? 100) - 2) {
                await this.notifier.chargeComplete(car.name, endSoc, kwhAdded, session.estimatedCost);
            }
        }
        this.carStates.set(car.id, { plugged: false, plan: [] });
        this.broadcast("plug_changed", { carId: car.id, plugged: false });
    }
    /** 5-min tick — control charging for all plugged cars. */
    async tick() {
        const { cars } = (0, settings_js_1.loadSettings)();
        for (const car of cars) {
            if (!car.charging_switch)
                continue;
            const state = this.carStates.get(car.id);
            if (!state?.plugged)
                continue;
            await this.controlCar(car, state);
        }
    }
    /** Control one car's charging based on its current plan slot. */
    async controlCar(car, state) {
        const powerW = this.getPowerW(car);
        // DC fast charger bypass
        if (isFastCharger(powerW, car.charge_kw)) {
            console.log(`[Controller] ${car.name}: DC fast charger active — skipping`);
            return;
        }
        const settings = (0, settings_js_1.getCarSettings)(car.id);
        // Solar surplus mode: react in real-time
        if (settings.mode === "Solar Surplus") {
            const surplus = this.getSolarSurplusKw(car);
            const shouldCharge = surplus >= car.charge_kw * 0.8;
            const isCharging = this.ha.getState(car.charging_switch)?.state === "on";
            if (shouldCharge !== isCharging) {
                await this.ha.callService("switch", shouldCharge ? "turn_on" : "turn_off", { entity_id: car.charging_switch });
                console.log(`[Controller] ${car.name}: solar surplus ${surplus.toFixed(1)}kW — ${shouldCharge ? "started" : "paused"} charging`);
            }
            return;
        }
        // Charge Now
        if (settings.mode === "Charge Now") {
            if (this.ha.getState(car.charging_switch)?.state !== "on") {
                await this.ha.callService("switch", "turn_on", { entity_id: car.charging_switch });
                console.log(`[Controller] ${car.name}: Charge Now — started`);
            }
            return;
        }
        // Off
        if (settings.mode === "Off") {
            if (this.ha.getState(car.charging_switch)?.state === "on") {
                await this.ha.callService("switch", "turn_off", { entity_id: car.charging_switch });
            }
            return;
        }
        // Slot-based modes
        if (!state.plan.length)
            return;
        const now = new Date();
        const currentSlot = state.plan.find((s) => now >= s.localDate && now < new Date(s.localDate.getTime() + 15 * 60 * 1000));
        if (!currentSlot)
            return;
        const shouldCharge = currentSlot.charging;
        const isCharging = this.ha.getState(car.charging_switch)?.state === "on";
        if (shouldCharge && !isCharging) {
            await this.ha.callService("switch", "turn_on", { entity_id: car.charging_switch });
            console.log(`[Controller] ${car.name}: ▶ started (${currentSlot.ep.toFixed(2)} DKK/kWh)`);
        }
        else if (!shouldCharge && isCharging) {
            await this.ha.callService("switch", "turn_off", { entity_id: car.charging_switch });
            console.log(`[Controller] ${car.name}: ⏸ paused (${currentSlot.ep.toFixed(2)} DKK/kWh)`);
        }
    }
    /** Refresh prices and rebuild all plans. */
    async refreshPrices() {
        const { area, cars } = (0, settings_js_1.loadSettings)();
        console.log(`[Controller] Fetching prices for ${area}…`);
        try {
            const { today, tomorrow } = await (0, priceClient_js_1.fetchPrices)(area);
            this.priceSlots = [...today, ...tomorrow];
            console.log(`[Controller] Got ${today.length} today + ${tomorrow.length} tomorrow slots`);
            // Notify if tomorrow prices just arrived
            if (tomorrow.length > 0) {
                const tomorrowEps = tomorrow.map((s) => {
                    const dt = new Date(s.start);
                    const ep = s.value * 1.25 + 0.21; // rough effective price for notification
                    return ep;
                });
                const avgEp = tomorrowEps.reduce((a, b) => a + b, 0) / tomorrowEps.length;
                const sortedEps = [...tomorrowEps].sort((a, b) => a - b);
                const maxEp = sortedEps[sortedEps.length - 1];
                const cheapHour = tomorrow.reduce((b, s) => s.value < b.value ? s : b, tomorrow[0]);
                const cheapLabel = new Date(cheapHour.start).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
                await this.notifier.pricesPublished(avgEp, `~${cheapLabel}`);
                await this.notifier.priceSpike("tomorrow peak", maxEp);
            }
            // Rebuild plans for all plugged cars
            for (const car of cars) {
                const state = this.carStates.get(car.id);
                if (state?.plugged)
                    this.rebuildPlan(car);
            }
            this.broadcast("prices_updated", { slots: this.priceSlots.length });
        }
        catch (e) {
            console.error("[Controller] Price fetch failed:", e.message);
        }
    }
    getPriceSlots() { return this.priceSlots; }
    getCarState(carId) { return this.carStates.get(carId); }
    getAllStatus() {
        const { cars } = (0, settings_js_1.loadSettings)();
        return cars.map((car) => {
            const state = this.carStates.get(car.id);
            const settings = (0, settings_js_1.getCarSettings)(car.id);
            const plugState = car.plug_entity ? this.ha.getState(car.plug_entity)?.state : undefined;
            const chargingState = car.charging_switch ? this.ha.getState(car.charging_switch)?.state : undefined;
            const soc = this.getSoc(car);
            const powerW = this.getPowerW(car);
            const plan = state?.plan ?? [];
            const summary = plan.length
                ? (0, planner_js_1.planSummary)(plan, soc, car.battery_kwh, car.charge_kw, settings.charge_limit)
                : null;
            return {
                carId: car.id,
                carName: car.name,
                plugged: plugState === "on",
                isCharging: chargingState === "on",
                isFastCharger: isFastCharger(powerW, car.charge_kw),
                soc,
                powerW,
                mode: settings.mode,
                plan,
                summary,
            };
        });
    }
    /** Force execute plan for one car (used by Execute button in UI). */
    async executeNow(carId) {
        const { cars } = (0, settings_js_1.loadSettings)();
        const car = cars.find((c) => c.id === carId);
        if (!car)
            return `Car ${carId} not found`;
        const state = this.carStates.get(carId);
        if (!state)
            return `${car.name}: no state`;
        await this.controlCar(car, state);
        return `${car.name}: executed`;
    }
}
exports.Controller = Controller;
