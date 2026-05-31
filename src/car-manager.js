/**
 * Car settings manager — persists per-car settings to localStorage.
 * Key: ev_smart_charging_{carId}
 */

const STORAGE_PREFIX = "ev_smart_charging_";

const DEFAULT_SETTINGS = {
  mode: "Cheapest Hours",
  price_threshold: 0.50,
  cheapest_hours: 4,
  departure_time: "07:00",
  target_soc: 80,
  charge_limit: 100,
  manual_soc: 20,
};

/** Loads settings for a car from localStorage. Returns defaults if not found. */
export function loadCarSettings(carId) {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${carId}`);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

/** Saves settings for a car to localStorage. */
export function saveCarSettings(carId, settings) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${carId}`, JSON.stringify(settings));
  } catch (e) {
    console.error("[ev-charging] Could not save settings:", e);
  }
}

/** Fetches Nord Pool prices for a specific date string (YYYY-MM-DD). */
async function fetchPricesForDate(hass, configEntry, area, dateStr) {
  try {
    const result = await hass.callService(
      "nordpool",
      "get_prices_for_date",
      { date: dateStr, areas: area, currency: "DKK", config_entry: configEntry },
      undefined, undefined, true
    );
    const raw = result?.response?.[area] ?? result?.[area] ?? [];
    return raw
      .map((item) => ({ start: item.start, value: item.price / 1000 }))  // MWh → kWh
      .sort((a, b) => a.start.localeCompare(b.start));
  } catch (e) {
    console.warn("[ev-charging] No prices for", dateStr, e?.message);
    return [];
  }
}

function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Fetches today + tomorrow's Nord Pool prices combined.
 * Returns array of { start: ISO string, value: DKK/kWh } sorted by start time.
 * Tomorrow's prices may be empty before ~13:00 when they are published.
 */
export async function fetchTodayAndTomorrowPrices(hass, configEntry, area = "DK1") {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [todaySlots, tomorrowSlots] = await Promise.all([
    fetchPricesForDate(hass, configEntry, area, fmtDate(today)),
    fetchPricesForDate(hass, configEntry, area, fmtDate(tomorrow)),
  ]);

  return [...todaySlots, ...tomorrowSlots].sort((a, b) => a.start.localeCompare(b.start));
}

/**
 * Controls the car's charging switch.
 * @param {object} hass
 * @param {string} switchEntity - e.g. "switch.pv5_ev_charging"
 * @param {boolean} on
 */
export async function setCharging(hass, switchEntity, on) {
  if (!switchEntity) return;
  await hass.callService("switch", on ? "turn_on" : "turn_off", {
    entity_id: switchEntity,
  });
}

/**
 * Reads live SoC from HA state. Returns null if entity unavailable.
 */
export function getLiveSoC(hass, socEntity) {
  if (!socEntity) return null;
  const state = hass.states[socEntity];
  if (!state || state.state === "unavailable" || state.state === "unknown") return null;
  return parseFloat(state.state);
}
