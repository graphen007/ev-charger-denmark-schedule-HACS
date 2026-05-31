/**
 * N1 Nettarif C 2025 (incl. 25% VAT) for DK1 / Sabro area.
 * All values in DKK/kWh.
 *
 * Users can override via card config tariffs: { low, high_summer, high_winter,
 * peak_summer, peak_winter }
 */
export const DEFAULT_TARIFFS = {
  low: 0.11,          // 00:00–06:00
  high_summer: 0.17,  // 06:00–17:00, 21:00–24:00 (Apr–Sep)
  high_winter: 0.32,  // 06:00–17:00, 21:00–24:00 (Oct–Mar)
  peak_summer: 0.43,  // 17:00–21:00 (Apr–Sep)
  peak_winter: 0.97,  // 17:00–21:00 (Oct–Mar)
};

/** Returns N1 tariff in DKK/kWh for a given local Date object. */
export function getTariff(localDate, tariffs = DEFAULT_TARIFFS) {
  const h = localDate.getHours();
  const month = localDate.getMonth() + 1; // 1–12
  const isSummer = month >= 4 && month <= 9;

  if (h < 6) return tariffs.low;
  if (h >= 17 && h < 21) return isSummer ? tariffs.peak_summer : tariffs.peak_winter;
  return isSummer ? tariffs.high_summer : tariffs.high_winter;
}

/**
 * Computes effective price (DKK/kWh) = spot_price * 1.25 (VAT) + network_tariff.
 * @param {number} spotPrice - Nord Pool price in DKK/kWh (already per kWh)
 * @param {Date}   localDate - local Date for tariff lookup
 * @param {object} tariffs   - optional tariff override
 */
export function effectivePrice(spotPrice, localDate, tariffs) {
  return spotPrice * 1.25 + getTariff(localDate, tariffs);
}

/**
 * Given an array of Nord Pool price slots (each: { start: ISO string, value: DKK/kWh }),
 * returns the charge plan for a given mode.
 *
 * @param {Array}  slots         - sorted 15-min price slots for the day
 * @param {string} mode          - 'Lad nu'|'Billigste timer'|'Under grænse'|'Afgang-plan'|'Slukket'
 * @param {object} settings      - { cheapest_hours, price_threshold, departure_time, target_soc, current_soc, battery_kwh, charge_kw }
 * @param {object} tariffs       - optional tariff override
 * @returns {Array} plan - array of { start, end, price, effectivePrice, charging: bool }
 */
export function buildChargePlan(slots, mode, settings, tariffs) {
  if (!slots || slots.length === 0) return [];

  const {
    cheapest_hours = 4,
    price_threshold = 0.5,
    departure_time = "07:00",
    target_soc = 80,
    current_soc = 20,
    battery_kwh = 71.2,
    charge_kw = 9.5,
  } = settings;

  // Annotate each slot with effective price
  const annotated = slots.map((s) => {
    const dt = new Date(s.start);
    const ep = effectivePrice(s.value, dt, tariffs);
    return { ...s, localDate: dt, ep };
  });

  let chargingSlots = new Set();

  if (mode === "Lad nu") {
    annotated.forEach((_, i) => chargingSlots.add(i));
  } else if (mode === "Slukket") {
    // no slots
  } else if (mode === "Billigste timer") {
    const slotsNeeded = cheapest_hours * 4; // 4 slots per hour
    const sorted = [...annotated]
      .map((s, i) => ({ ep: s.ep, i }))
      .sort((a, b) => a.ep - b.ep)
      .slice(0, slotsNeeded);
    sorted.forEach(({ i }) => chargingSlots.add(i));
  } else if (mode === "Under grænse") {
    annotated.forEach((s, i) => {
      if (s.ep <= price_threshold) chargingSlots.add(i);
    });
  } else if (mode === "Afgang-plan") {
    const [depH, depM] = departure_time.split(":").map(Number);
    const needed_kwh = ((target_soc - current_soc) / 100) * battery_kwh;
    const slots_needed = Math.ceil((needed_kwh / charge_kw) * 4); // 15-min slots

    // Find slots before departure
    const beforeDep = annotated
      .map((s, i) => ({ ep: s.ep, i, h: s.localDate.getHours(), m: s.localDate.getMinutes() }))
      .filter(({ h, m }) => h < depH || (h === depH && m < depM));

    if (beforeDep.length === 0 || slots_needed <= 0) {
      // nothing to do
    } else if (beforeDep.length <= slots_needed) {
      // Not enough time — charge all available slots before departure
      beforeDep.forEach(({ i }) => chargingSlots.add(i));
    } else {
      // Pick cheapest slots before departure
      const chosen = [...beforeDep]
        .sort((a, b) => a.ep - b.ep)
        .slice(0, slots_needed);
      chosen.forEach(({ i }) => chargingSlots.add(i));
    }
  }

  return annotated.map((s, i) => ({
    start: s.start,
    localDate: s.localDate,
    value: s.value,
    ep: s.ep,
    charging: chargingSlots.has(i),
  }));
}

/**
 * Computes summary stats from a charge plan.
 * @returns { kwh_added, final_soc, total_cost, cheapest_slot, priciest_slot, avg_ep }
 */
export function planSummary(plan, settings) {
  const { current_soc = 20, battery_kwh = 71.2, charge_kw = 9.5 } = settings;
  const chargingSlots = plan.filter((s) => s.charging);
  const kwh_added = Math.min(
    (chargingSlots.length / 4) * charge_kw,
    battery_kwh * (1 - current_soc / 100)
  );
  const final_soc = Math.min(100, current_soc + (kwh_added / battery_kwh) * 100);
  const total_cost = chargingSlots.reduce((sum, s) => sum + (s.ep * charge_kw) / 4, 0);
  const allEp = plan.map((s) => s.ep);
  const cheapest_slot = plan.reduce((best, s) => (s.ep < best.ep ? s : best), plan[0]);
  const priciest_slot = plan.reduce((best, s) => (s.ep > best.ep ? s : best), plan[0]);
  const avg_ep = allEp.reduce((a, b) => a + b, 0) / allEp.length;

  return { kwh_added, final_soc, total_cost, cheapest_slot, priciest_slot, avg_ep };
}

/** Returns today's date string YYYY-MM-DD in local time. */
export function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
