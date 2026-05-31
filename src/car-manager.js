/**
 * Car settings manager — persistent, cross-user, cross-device.
 *
 * Storage strategy (in order of preference):
 *  1. input_text.ev_settings_{carId} helper — created once via HA config API,
 *     stored in .storage/input_text, survives HA restarts, shared across all users.
 *  2. /api/states/ write — transient but instant cross-user WS broadcast (fallback
 *     when the helper hasn't been created yet).
 *  3. localStorage — same-device fallback for HA restart recovery.
 */

const STORAGE_PREFIX = "ev_smart_charging_";
const ENTITY_PREFIX  = "input_text.ev_settings_";

const DEFAULT_SETTINGS = {
  mode: "Cheapest Hours",
  price_threshold: 0.50,
  cheapest_hours: 4,
  departure_time: "07:00",
  target_soc: 80,
  charge_limit: 100,
  manual_soc: 20,
};

/**
 * Ensures a persistent input_text helper exists for a car.
 * Creates it via the HA helpers config API if missing.
 * Returns true if the entity now exists (or already did).
 */
async function ensurePersistentHelper(hass, carId) {
  const entityId = `${ENTITY_PREFIX}${carId}`;
  if (hass.states[entityId]) return true;
  try {
    await hass.callApi("POST", "config/input_text/config", {
      id:      `ev_settings_${carId}`,
      name:    `EV Settings ${carId}`,
      max:     255,
      initial: "",
    });
    return true;
  } catch (e) {
    // May already exist (409) or API unavailable — not fatal
    if (!e?.message?.includes("409")) {
      console.warn("[ev-charging] Could not create input_text helper:", e?.message);
    }
    return !!hass.states[entityId];
  }
}

/** Loads settings synchronously from hass.states, falls back to localStorage. */
export function loadCarSettings(hass, carId) {
  const entityId = `${ENTITY_PREFIX}${carId}`;
  const raw = hass?.states[entityId]?.state;
  if (raw && raw !== "unknown" && raw !== "unavailable") {
    try {
      const parsed = JSON.parse(raw);
      // Keep localStorage in sync as a restart-recovery cache
      try { localStorage.setItem(`${STORAGE_PREFIX}${carId}`, raw); } catch {}
      return { ...DEFAULT_SETTINGS, ...parsed };
    } catch {}
  }
  // Fallback: localStorage (same device — survives HA restart)
  try {
    const local = localStorage.getItem(`${STORAGE_PREFIX}${carId}`);
    if (local) return { ...DEFAULT_SETTINGS, ...JSON.parse(local) };
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

/** Saves settings persistently. Writes localStorage instantly, then syncs to HA. */
export async function saveCarSettings(hass, carId, settings) {
  const entityId = `${ENTITY_PREFIX}${carId}`;
  const json = JSON.stringify(settings);

  // Immediate local write for instant UI feedback
  try { localStorage.setItem(`${STORAGE_PREFIX}${carId}`, json); } catch {}

  // Ensure the persistent helper exists, then set its value
  const helperReady = await ensurePersistentHelper(hass, carId);
  if (helperReady) {
    try {
      // input_text.set_value persists to .storage/input_text — survives HA restarts
      await hass.callService("input_text", "set_value", { entity_id: entityId, value: json });
      return;
    } catch (e) {
      console.warn("[ev-charging] input_text.set_value failed, falling back:", e?.message);
    }
  }

  // Fallback: states API (transient but cross-user via WS broadcast)
  try {
    await hass.callApi("POST", `states/${entityId}`, { state: json });
  } catch (e) {
    console.warn("[ev-charging] Could not save settings:", e?.message);
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
