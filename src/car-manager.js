/**
 * Car settings manager — persists per-car settings to HA input_text helpers.
 * Helper name: input_text.ev_settings_{car_id}
 * State value: JSON string, max 255 chars per field stored individually.
 *
 * Settings object shape:
 * {
 *   mode: string,
 *   price_threshold: number,
 *   cheapest_hours: number,
 *   departure_time: string,  // "HH:MM"
 *   target_soc: number,
 *   manual_soc: number,
 * }
 */

const DEFAULT_SETTINGS = {
  mode: "Billigste timer",
  price_threshold: 0.50,
  cheapest_hours: 4,
  departure_time: "07:00",
  target_soc: 80,
  manual_soc: 20,
};

/** Loads settings for a car from HA state. Returns defaults if helper doesn't exist. */
export async function loadCarSettings(hass, carId) {
  const entityId = `input_text.ev_settings_${carId}`;
  const state = hass.states[entityId];
  if (!state || !state.state || state.state === "unknown") {
    return { ...DEFAULT_SETTINGS };
  }
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(state.state) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Saves settings for a car to HA. Creates the input_text helper if needed. */
export async function saveCarSettings(hass, carId, settings) {
  const entityId = `input_text.ev_settings_${carId}`;
  const value = JSON.stringify(settings);

  // Try to set via input_text.set_value service first (works if helper exists)
  try {
    await hass.callService("input_text", "set_value", {
      entity_id: entityId,
      value,
    });
    return;
  } catch {
    // Helper doesn't exist — create it via REST API then set
  }

  // Create the helper via REST
  try {
    const resp = await fetch(`/api/states/${entityId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${hass.auth.data.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        state: value,
        attributes: {
          friendly_name: `EV Indstillinger – ${carId}`,
          max: 500,
        },
      }),
    });
    if (!resp.ok) throw new Error(await resp.text());
  } catch (e) {
    console.error("[ev-charging] Could not save settings:", e);
  }
}

/**
 * Fetches today's Nord Pool prices via the nordpool.get_prices_for_date service.
 * Returns array of { start: ISO string, value: DKK/kWh } sorted by start.
 */
export async function fetchTodayPrices(hass, configEntry, area = "DK1") {
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  try {
    const result = await hass.callService(
      "nordpool",
      "get_prices_for_date",
      {
        date: dateStr,
        areas: area,
        currency: "DKK",
        config_entry: configEntry,
      },
      { return_response: true }
    );

    const raw = result?.response?.[area] ?? result?.[area] ?? [];
    return raw
      .map((item) => ({ start: item.start, value: item.price }))
      .sort((a, b) => a.start.localeCompare(b.start));
  } catch (e) {
    console.error("[ev-charging] Failed to fetch prices:", e);
    return [];
  }
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
