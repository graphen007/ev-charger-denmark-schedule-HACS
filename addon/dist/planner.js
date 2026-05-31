"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CAR_SETTINGS = exports.DEFAULT_TARIFFS = void 0;
exports.getN1Tariff = getN1Tariff;
exports.effectivePrice = effectivePrice;
exports.buildChargePlan = buildChargePlan;
exports.planSummary = planSummary;
exports.DEFAULT_TARIFFS = {
    low: 0.11,
    high_summer: 0.17,
    high_winter: 0.32,
    peak_summer: 0.43,
    peak_winter: 0.97,
    energinet: 0.21,
    elafgift: 0.00,
    supplier: 0.00,
};
/** N1 Nettarif C (incl. 25% VAT) for a given local Date. */
function getN1Tariff(localDate, tariffs) {
    const h = localDate.getHours();
    const m = localDate.getMonth() + 1;
    const isSummer = m >= 4 && m <= 9;
    if (h < 6)
        return tariffs.low;
    if (h >= 17 && h < 21)
        return isSummer ? tariffs.peak_summer : tariffs.peak_winter;
    return isSummer ? tariffs.high_summer : tariffs.high_winter;
}
/** Effective price DKK/kWh = spot×1.25 + N1 nettarif + Energinet + elafgift + supplier */
function effectivePrice(spotDkkPerKwh, localDate, tariffs) {
    return spotDkkPerKwh * 1.25
        + getN1Tariff(localDate, tariffs)
        + tariffs.energinet
        + tariffs.elafgift
        + tariffs.supplier;
}
exports.DEFAULT_CAR_SETTINGS = {
    mode: "Cheapest Hours",
    price_threshold: 0.50,
    cheapest_hours: 4,
    departure_time: "07:00",
    target_soc: 80,
    charge_limit: 100,
    manual_soc: 20,
};
/** Build a 15-min charge plan from hourly price slots expanded to 15-min intervals. */
function buildChargePlan(slots, settings, tariffs, currentSoc, batterKwh, chargeKw, solarSurplusKw = 0) {
    if (!slots.length)
        return [];
    const now = new Date();
    // Expand hourly → 15-min slots
    const expanded = [];
    for (const s of slots) {
        const base = new Date(s.start);
        for (let q = 0; q < 4; q++) {
            const dt = new Date(base.getTime() + q * 15 * 60 * 1000);
            const ep = effectivePrice(s.value, dt, tariffs);
            expanded.push({ start: dt.toISOString(), value: s.value, localDate: dt, ep });
        }
    }
    const future = expanded.filter((s) => s.localDate >= now);
    const charging = new Set();
    const { mode, cheapest_hours, price_threshold, departure_time, target_soc, charge_limit } = settings;
    if (mode === "Charge Now") {
        future.forEach((s) => charging.add(s.start));
    }
    else if (mode === "Cheapest Hours") {
        [...future].sort((a, b) => a.ep - b.ep).slice(0, cheapest_hours * 4).forEach((s) => charging.add(s.start));
    }
    else if (mode === "Below Threshold") {
        future.filter((s) => s.ep <= price_threshold).forEach((s) => charging.add(s.start));
    }
    else if (mode === "Departure Plan") {
        const [depH, depM] = departure_time.split(":").map(Number);
        const dep = new Date();
        dep.setHours(depH, depM, 0, 0);
        if (dep <= now)
            dep.setDate(dep.getDate() + 1);
        const neededKwh = Math.max(0, ((Math.min(target_soc, charge_limit) - currentSoc) / 100) * batterKwh);
        const slotsNeeded = Math.ceil((neededKwh / chargeKw) * 4);
        const window = future.filter((s) => s.localDate < dep);
        if (slotsNeeded > 0) {
            const pick = window.length <= slotsNeeded ? window : [...window].sort((a, b) => a.ep - b.ep).slice(0, slotsNeeded);
            pick.forEach((s) => charging.add(s.start));
        }
    }
    else if (mode === "Solar Surplus") {
        // Mark slots where solar surplus > 80% of charge rate as charging
        // Real-time check is done by controller — here we just schedule based on current surplus
        if (solarSurplusKw >= chargeKw * 0.8) {
            future.slice(0, 4).forEach((s) => charging.add(s.start)); // charge next hour if surplus now
        }
    }
    // "Off" → nothing charged
    return expanded.map((s) => ({
        ...s,
        charging: charging.has(s.start),
        isPast: s.localDate < now,
    }));
}
/** Summary stats over future charging slots. */
function planSummary(plan, currentSoc, batteryKwh, chargeKw, chargeLimit) {
    const chargingSlots = plan.filter((s) => s.charging && !s.isPast);
    const maxPossibleKwh = (chargingSlots.length / 4) * chargeKw;
    const remainingKwh = batteryKwh * (Math.max(0, Math.min(chargeLimit, 100) - currentSoc) / 100);
    const kwhAdded = Math.min(maxPossibleKwh, remainingKwh);
    const finalSoc = Math.min(chargeLimit, currentSoc + (kwhAdded / batteryKwh) * 100);
    const utilization = maxPossibleKwh > 0 ? kwhAdded / maxPossibleKwh : 0;
    const totalCost = chargingSlots.reduce((sum, s) => sum + (s.ep * chargeKw) / 4, 0) * utilization;
    const fp = plan.filter((s) => !s.isPast);
    if (!fp.length)
        return { kwhAdded, finalSoc, totalCost, cheapestSlot: null, priesiestSlot: null, avgEp: 0 };
    return {
        kwhAdded,
        finalSoc,
        totalCost,
        cheapestSlot: fp.reduce((b, s) => s.ep < b.ep ? s : b, fp[0]),
        priesiestSlot: fp.reduce((b, s) => s.ep > b.ep ? s : b, fp[0]),
        avgEp: fp.reduce((a, s) => a + s.ep, 0) / fp.length,
    };
}
