import type { PriceSlot } from "./priceClient.js";

export interface Tariffs {
  low: number;           // 00–06h all year
  high_summer: number;   // 06–17 + 21–24, Apr–Sep
  high_winter: number;   // 06–17 + 21–24, Oct–Mar
  peak_summer: number;   // 17–21, Apr–Sep
  peak_winter: number;   // 17–21, Oct–Mar
  energinet: number;     // fixed system/transmission/balance incl. VAT
  elafgift: number;      // EV exempt = 0
  supplier: number;      // variable supplier add-on
}

export const DEFAULT_TARIFFS: Tariffs = {
  low:          0.11,
  high_summer:  0.17,
  high_winter:  0.32,
  peak_summer:  0.43,
  peak_winter:  0.97,
  energinet:    0.21,
  elafgift:     0.00,
  supplier:     0.00,
};

/** N1 Nettarif C (incl. 25% VAT) for a given local Date. */
export function getN1Tariff(localDate: Date, tariffs: Tariffs): number {
  const h = localDate.getHours();
  const m = localDate.getMonth() + 1;
  const isSummer = m >= 4 && m <= 9;
  if (h < 6) return tariffs.low;
  if (h >= 17 && h < 21) return isSummer ? tariffs.peak_summer : tariffs.peak_winter;
  return isSummer ? tariffs.high_summer : tariffs.high_winter;
}

/** Effective price DKK/kWh = spot×1.25 + N1 nettarif + Energinet + elafgift + supplier */
export function effectivePrice(spotDkkPerKwh: number, localDate: Date, tariffs: Tariffs): number {
  return spotDkkPerKwh * 1.25
    + getN1Tariff(localDate, tariffs)
    + tariffs.energinet
    + tariffs.elafgift
    + tariffs.supplier;
}

// ---- Plan types ----

export interface CarConfig {
  id: string;
  name: string;
  battery_kwh: number;
  charge_kw: number;
  charging_switch: string;
  soc_entity?: string;
  plug_entity?: string;
  power_entity?: string;
  charge_limit_entity?: string;
  solar_power_entity?: string;
  house_consumption_entity?: string;
  refresh_entity?: string;  // button/script to trigger a cloud data refresh
}

export interface CarSettings {
  mode: "Charge Now" | "Cheapest Hours" | "Below Threshold" | "Solar Surplus" | "Off";
  price_threshold: number;
  cheapest_hours: number;
  deadline_time: string;     // optional "HH:MM" — reach target_soc by this time (Cheapest Hours)
  target_soc: number;
  charge_limit: number;
  manual_soc: number;
}

export const DEFAULT_CAR_SETTINGS: CarSettings = {
  mode:             "Cheapest Hours",
  price_threshold:  0.50,
  cheapest_hours:   4,
  deadline_time:    "",
  target_soc:       80,
  charge_limit:     100,
  manual_soc:       20,
};

export interface Slot extends PriceSlot {
  localDate: Date;
  ep: number;       // effective price DKK/kWh
  charging: boolean;
  isPast: boolean;
}

export interface PlanSummary {
  kwhAdded: number;
  finalSoc: number;
  totalCost: number;
  cheapestSlot: Slot | null;
  priesiestSlot: Slot | null;
  avgEp: number;
}

/** Build a 15-min charge plan from hourly price slots expanded to 15-min intervals. */
export function buildChargePlan(
  slots: PriceSlot[],
  settings: CarSettings,
  tariffs: Tariffs,
  currentSoc: number,
  batterKwh: number,
  chargeKw: number,
  solarSurplusKw = 0,
): Slot[] {
  if (!slots.length) return [];

  const now = new Date();

  // Expand hourly → 15-min slots
  const expanded: (PriceSlot & { localDate: Date; ep: number })[] = [];
  for (const s of slots) {
    const base = new Date(s.start);
    for (let q = 0; q < 4; q++) {
      const dt = new Date(base.getTime() + q * 15 * 60 * 1000);
      const ep = effectivePrice(s.value, dt, tariffs);
      expanded.push({ start: dt.toISOString(), value: s.value, localDate: dt, ep });
    }
  }

  const future = expanded.filter((s) => s.localDate >= now);
  const charging = new Set<string>();
  const { mode, price_threshold, deadline_time, target_soc, charge_limit } = settings;

  if (mode === "Charge Now") {
    future.forEach((s) => charging.add(s.start));

  } else if (mode === "Cheapest Hours") {
    const targetSocActual = Math.min(target_soc, charge_limit);
    const neededKwh = Math.max(0, ((targetSocActual - currentSoc) / 100) * batterKwh);
    const slotsNeeded = Math.ceil((neededKwh / chargeKw) * 4);
    if (slotsNeeded > 0) {
      // If a deadline is set, only schedule slots before that time
      let window = future;
      if (deadline_time) {
        const [dlH, dlM] = deadline_time.split(":").map(Number);
        const dl = new Date();
        dl.setHours(dlH, dlM, 0, 0);
        if (dl <= now) dl.setDate(dl.getDate() + 1);
        window = future.filter((s) => s.localDate < dl);
      }
      // If window is smaller than needed, use all of it; otherwise pick cheapest
      const pick = window.length <= slotsNeeded ? window : [...window].sort((a, b) => a.ep - b.ep).slice(0, slotsNeeded);
      pick.forEach((s) => charging.add(s.start));
    }

  } else if (mode === "Below Threshold") {
    future.filter((s) => s.ep <= price_threshold).forEach((s) => charging.add(s.start));

  } else if (mode === "Solar Surplus") {
    if (solarSurplusKw >= chargeKw * 0.8) {
      future.slice(0, 4).forEach((s) => charging.add(s.start));
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
export function planSummary(plan: Slot[], currentSoc: number, batteryKwh: number, chargeKw: number, chargeLimit: number): PlanSummary {
  const chargingSlots = plan.filter((s) => s.charging && !s.isPast);
  const maxPossibleKwh = (chargingSlots.length / 4) * chargeKw;
  const remainingKwh = batteryKwh * (Math.max(0, Math.min(chargeLimit, 100) - currentSoc) / 100);
  const kwhAdded = Math.min(maxPossibleKwh, remainingKwh);
  const finalSoc = Math.min(chargeLimit, currentSoc + (kwhAdded / batteryKwh) * 100);
  const utilization = maxPossibleKwh > 0 ? kwhAdded / maxPossibleKwh : 0;
  const totalCost = chargingSlots.reduce((sum, s) => sum + (s.ep * chargeKw) / 4, 0) * utilization;
  const fp = plan.filter((s) => !s.isPast);
  if (!fp.length) return { kwhAdded, finalSoc, totalCost, cheapestSlot: null, priesiestSlot: null, avgEp: 0 };
  return {
    kwhAdded,
    finalSoc,
    totalCost,
    cheapestSlot:   fp.reduce((b, s) => s.ep < b.ep ? s : b, fp[0]),
    priesiestSlot:  fp.reduce((b, s) => s.ep > b.ep ? s : b, fp[0]),
    avgEp:          fp.reduce((a, s) => a + s.ep, 0) / fp.length,
  };
}
