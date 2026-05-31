/** Energinet public API — same underlying data as Nord Pool, no auth required. */

const BASE = "https://api.energidataservice.dk/dataset";

export interface RawPriceRecord {
  HourDK: string;      // "2025-06-01T00:00:00"
  SpotPriceDKK: number; // DKK/MWh
}

export interface PriceSlot {
  start: string;   // ISO local DK time
  value: number;   // DKK/kWh
}

export interface PriceForecast {
  windCapacityPct: number | null;   // 0–1, high = cheap
  co2gPerKwh: number | null;        // low = renewable surplus = cheap
  historicalAvg: number | null;     // DKK/kWh avg for same weekday (4-week avg)
  historicalStdDev: number | null;
  confidence: "low" | "medium" | "high";
  label: string;
}

function isoToSlot(record: RawPriceRecord): PriceSlot {
  return { start: record.HourDK, value: record.SpotPriceDKK / 1000 };
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Energinet API ${res.status}: ${url}`);
  return res.json() as Promise<T>;
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

/** Fetch spot prices for a date range. area = "DK1" | "DK2". */
async function fetchSpotPrices(area: string, startDate: string, endDate: string): Promise<PriceSlot[]> {
  const filter = JSON.stringify({ PriceArea: area });
  const url = `${BASE}/Elspotprices?offset=0&start=${startDate}T00:00&end=${endDate}T23:59&filter=${encodeURIComponent(filter)}&sort=HourDK%20asc&limit=100`;
  const data = await fetchJson<{ records: RawPriceRecord[] }>(url);
  return (data.records ?? []).map(isoToSlot);
}

/** Fetch today + tomorrow's prices. Returns combined sorted array. */
export async function fetchPrices(area: string): Promise<{ today: PriceSlot[]; tomorrow: PriceSlot[] }> {
  const now = new Date();
  const todayStr = fmtDate(now);
  const tomorrowDate = new Date(now); tomorrowDate.setDate(now.getDate() + 1);
  const tomorrowStr = fmtDate(tomorrowDate);

  const [todaySlots, tomorrowSlots] = await Promise.all([
    fetchSpotPrices(area, todayStr, todayStr).catch(() => [] as PriceSlot[]),
    fetchSpotPrices(area, tomorrowStr, tomorrowStr).catch(() => [] as PriceSlot[]),
  ]);

  return { today: todaySlots, tomorrow: tomorrowSlots };
}

/** Fetch wind + CO2 forecast and 4-week historical avg for tomorrow's weekday. */
export async function fetchForecast(area: string): Promise<PriceForecast> {
  const now = new Date();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const dowTomorrow = tomorrow.getDay(); // 0=Sun … 6=Sat

  // Historical: find past 4 occurrences of same weekday
  const historicalPrices: number[] = [];
  for (let weeksBack = 1; weeksBack <= 4; weeksBack++) {
    const d = new Date(tomorrow);
    d.setDate(d.getDate() - 7 * weeksBack);
    const ds = fmtDate(d);
    try {
      const slots = await fetchSpotPrices(area, ds, ds);
      if (slots.length >= 20) {
        const avg = slots.reduce((s, p) => s + p.value, 0) / slots.length;
        historicalPrices.push(avg);
      }
    } catch { /* ignore */ }
  }

  let historicalAvg: number | null = null;
  let historicalStdDev: number | null = null;
  if (historicalPrices.length >= 2) {
    historicalAvg = historicalPrices.reduce((a, b) => a + b, 0) / historicalPrices.length;
    const variance = historicalPrices.reduce((s, v) => s + (v - historicalAvg!) ** 2, 0) / historicalPrices.length;
    historicalStdDev = Math.sqrt(variance);
  }

  // Wind capacity factor from latest Forecasts_5Min
  let windCapacityPct: number | null = null;
  try {
    const tomorrowStr = fmtDate(tomorrow);
    const windData = await fetchJson<{ records: Array<{ OffshoreWindPower: number; OnshoreWindPower: number; SolarPower: number }> }>(
      `${BASE}/Forecasts_5Min?start=${tomorrowStr}T00:00&end=${tomorrowStr}T23:59&limit=288`
    );
    const records = windData.records ?? [];
    if (records.length > 0) {
      const totalWind = records.reduce((s, r) => s + (r.OffshoreWindPower ?? 0) + (r.OnshoreWindPower ?? 0), 0);
      const capacity = area === "DK1" ? 6000 : 2000; // rough installed MW
      windCapacityPct = Math.min(1, (totalWind / records.length) / capacity);
    }
  } catch { /* forecast optional */ }

  // CO2 forecast
  let co2gPerKwh: number | null = null;
  try {
    const tomorrowStr = fmtDate(tomorrow);
    const co2Data = await fetchJson<{ records: Array<{ CO2Emission: number }> }>(
      `${BASE}/CO2Emis?start=${tomorrowStr}T00:00&end=${tomorrowStr}T23:59&limit=24`
    );
    const records = co2Data.records ?? [];
    if (records.length > 0) {
      co2gPerKwh = records.reduce((s, r) => s + (r.CO2Emission ?? 0), 0) / records.length;
    }
  } catch { /* optional */ }

  // Build human-readable label
  const windHigh = windCapacityPct !== null && windCapacityPct > 0.5;
  const co2Low   = co2gPerKwh !== null && co2gPerKwh < 100;
  let label = "Tomorrow's prices not yet published.";
  let confidence: "low" | "medium" | "high" = "low";

  if (windHigh && co2Low) {
    label = "🍃 Good wind forecast — prices likely cheap tomorrow.";
    confidence = "high";
  } else if (windHigh || co2Low) {
    label = "💨 Moderate renewable energy forecast — likely average prices.";
    confidence = "medium";
  } else if (windCapacityPct !== null) {
    label = "🌫️ Low wind forecast — prices may be higher than average.";
    confidence = "medium";
  }

  if (historicalAvg !== null) {
    label += ` Typical for ${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dowTomorrow]}: ~${historicalAvg.toFixed(2)} DKK/kWh.`;
  }

  return { windCapacityPct, co2gPerKwh, historicalAvg, historicalStdDev, confidence, label };
}
