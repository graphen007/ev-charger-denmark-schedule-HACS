/**
 * Electricity tariffs for Sabro 8471, DK1 — OK leverandør, 2025.
 *
 * Effective price = spot × 1.25 (moms) + N1 nettarif (inkl. moms) + Energinet (inkl. moms)
 *
 * N1 Nettarif C, Sabro DK1 — tidsvarierende, inkl. 25% moms (kilde: N1 takstblad 2025)
 * Energinet: systemtarif ~0.038 + transmissionsnettarif ~0.120 + balancetarif ~0.007 = ~0.165 ekskl. moms → 0.21 inkl.
 * Elafgift: 0 kr/kWh (EV-ladere er fritaget)
 * OK tillæg: 0 øre/kWh (Højt Forbrug — kun fast månedligt abonnement)
 */
export const DEFAULT_TARIFFS = {
  low: 0.11,           // 00:00–06:00, hele året (N1 lavlast inkl. moms)
  high_summer: 0.17,   // 06:00–17:00 + 21:00–24:00, apr–sep
  high_winter: 0.32,   // 06:00–17:00 + 21:00–24:00, okt–mar
  peak_summer: 0.43,   // 17:00–21:00, apr–sep
  peak_winter: 0.97,   // 17:00–21:00, okt–mar
  energinet: 0.21,     // Energinet faste tariffer inkl. moms
  elafgift: 0.00,      // EV fritaget
  supplier: 0.00,      // OK Højt Forbrug: 0 øre/kWh på kWh-pris
};

/** Returns N1 nettarif C (inkl. moms) for a given local Date. */
export function getN1Tariff(localDate, tariffs = DEFAULT_TARIFFS) {
  const h = localDate.getHours();
  const month = localDate.getMonth() + 1;
  const isSummer = month >= 4 && month <= 9;
  if (h < 6) return tariffs.low;
  if (h >= 17 && h < 21) return isSummer ? tariffs.peak_summer : tariffs.peak_winter;
  return isSummer ? tariffs.high_summer : tariffs.high_winter;
}

/**
 * Effective price (DKK/kWh) = spot×1.25 + N1 nettarif + Energinet + elafgift + leverandør
 */
export function effectivePrice(spotPrice, localDate, tariffs) {
  const t = { ...DEFAULT_TARIFFS, ...tariffs };
  return spotPrice * 1.25
    + getN1Tariff(localDate, t)
    + (t.energinet ?? 0.21)
    + (t.elafgift ?? 0)
    + (t.supplier ?? 0);
}

/**
 * Builds a charge plan from combined today+tomorrow slots.
 * Only future slots are eligible for charging.
 * Afgang-plan: if departure_time already passed today, assumes tomorrow.
 *
 * @returns {Array} plan — { start, localDate, value, ep, charging, isPast }
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

  const now = new Date();

  const annotated = slots.map((s, i) => {
    const dt = new Date(s.start);
    const ep = effectivePrice(s.value, dt, tariffs);
    return { ...s, localDate: dt, ep, i, isFuture: dt >= now };
  });

  const future = annotated.filter((s) => s.isFuture);
  const charging = new Set();

  if (mode === "Lad nu") {
    future.forEach((s) => charging.add(s.i));

  } else if (mode === "Billigste timer") {
    [...future]
      .sort((a, b) => a.ep - b.ep)
      .slice(0, cheapest_hours * 4)
      .forEach((s) => charging.add(s.i));

  } else if (mode === "Under grænse") {
    future.filter((s) => s.ep <= price_threshold).forEach((s) => charging.add(s.i));

  } else if (mode === "Afgang-plan") {
    const [depH, depM] = departure_time.split(":").map(Number);
    const dep = new Date();
    dep.setHours(depH, depM, 0, 0);
    if (dep <= now) dep.setDate(dep.getDate() + 1); // departure tomorrow

    const needed_kwh = Math.max(0, ((target_soc - current_soc) / 100) * battery_kwh);
    const slots_needed = Math.ceil((needed_kwh / charge_kw) * 4);
    const window = future.filter((s) => s.localDate < dep);

    if (window.length > 0 && slots_needed > 0) {
      const pick = window.length <= slots_needed ? window : [...window].sort((a, b) => a.ep - b.ep).slice(0, slots_needed);
      pick.forEach((s) => charging.add(s.i));
    }
  }
  // "Slukket" — nothing charged

  return annotated.map((s) => ({
    start: s.start,
    localDate: s.localDate,
    value: s.value,
    ep: s.ep,
    charging: charging.has(s.i),
    isPast: !s.isFuture,
  }));
}

/**
 * Summary stats over future charging slots only.
 */
export function planSummary(plan, settings) {
  const { current_soc = 20, battery_kwh = 71.2, charge_kw = 9.5 } = settings;
  const chargingSlots = plan.filter((s) => s.charging && !s.isPast);
  const kwh_added = Math.min((chargingSlots.length / 4) * charge_kw, battery_kwh * (1 - current_soc / 100));
  const final_soc = Math.min(100, current_soc + (kwh_added / battery_kwh) * 100);
  const total_cost = chargingSlots.reduce((sum, s) => sum + (s.ep * charge_kw) / 4, 0);

  const fp = plan.filter((s) => !s.isPast);
  if (!fp.length) return { kwh_added, final_soc, total_cost, cheapest_slot: null, priciest_slot: null, avg_ep: 0 };

  return {
    kwh_added,
    final_soc,
    total_cost,
    cheapest_slot: fp.reduce((b, s) => (s.ep < b.ep ? s : b), fp[0]),
    priciest_slot: fp.reduce((b, s) => (s.ep > b.ep ? s : b), fp[0]),
    avg_ep: fp.reduce((a, s) => a + s.ep, 0) / fp.length,
  };
}
