/** Price client — ENTSO-E Transparency Platform (primary) + elprisenligenu.dk (fallback, no key) */

export interface PriceSlot {
  start: string;   // ISO local DK time, e.g. "2026-05-31T14:00:00"
  value: number;   // DKK/kWh (spot price only, excl. tariffs)
}

export interface ForecastHour {
  hour: string;        // "2026-06-02T14:00:00"
  predicted: number;   // predicted DKK/kWh spot (historical hourly avg)
  low: number;         // predicted − 1σ
  high: number;        // predicted + 1σ
  windMW: number | null;
  solarMW: number | null;
  dataPoints: number;  // how many historical weeks contributed
}

export interface PriceForecast {
  windCapacityPct: number | null;
  co2gPerKwh: number | null;
  historicalAvg: number | null;
  historicalStdDev: number | null;
  confidence: "low" | "medium" | "high";
  label: string;
  // Hourly forecast for tomorrow
  hourlyForecast: ForecastHour[];
  forecastDate: string;   // "YYYY-MM-DD"
  weeksOfData: number;    // how many historical weeks were available
}

// ---- Area codes ----
const ENTSO_AREA: Record<string, string> = {
  DK1: "10YDK-1--------W",
  DK2: "10YDK-2--------M",
};

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function fmtEntsoDate(d: Date): string {
  // ENTSO-E wants YYYYMMDDHHmm in UTC
  return `${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,"0")}${String(d.getUTCDate()).padStart(2,"0")}0000`;
}

/** Convert UTC timestamp to DK local time string (no TZ offset). */
function utcToDkLocal(utcDate: Date): string {
  // Use sv-SE locale which gives "YYYY-MM-DD HH:mm:ss"
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Copenhagen",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).format(utcDate).replace(" ", "T");
}

// ---- ENTSO-E ----
async function fetchEntsoePrices(token: string, area: string, localDate: string, eurDkkRate: number): Promise<PriceSlot[]> {
  const areaCode = ENTSO_AREA[area] ?? ENTSO_AREA["DK1"];
  // Request full UTC day plus buffer for timezone
  const d = new Date(localDate + "T12:00:00Z");
  const prev = new Date(d); prev.setUTCDate(prev.getUTCDate() - 1);
  const next = new Date(d); next.setUTCDate(next.getUTCDate() + 1);
  const periodStart = fmtEntsoDate(prev);
  const periodEnd   = fmtEntsoDate(next);

  const url = `https://web-api.tp.entsoe.eu/api?securityToken=${token}&documentType=A44` +
    `&in_Domain=${encodeURIComponent(areaCode)}&out_Domain=${encodeURIComponent(areaCode)}` +
    `&periodStart=${periodStart}&periodEnd=${periodEnd}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`ENTSO-E API ${res.status}`);
  const xml = await res.text();

  // Parse <Period> blocks — each has a <timeInterval><start> and <Point> list
  const slots: PriceSlot[] = [];
  const periodRe = /<Period>([\s\S]*?)<\/Period>/g;
  let pm: RegExpExecArray | null;
  while ((pm = periodRe.exec(xml)) !== null) {
    const block = pm[1];
    const startMatch = block.match(/<start>(.*?)<\/start>/);
    if (!startMatch) continue;
    const periodStart = new Date(startMatch[1]); // UTC

    const pointRe = /<Point>[\s\S]*?<position>(\d+)<\/position>[\s\S]*?<price\.amount>([\d.]+)<\/price\.amount>[\s\S]*?<\/Point>/g;
    let pt: RegExpExecArray | null;
    while ((pt = pointRe.exec(block)) !== null) {
      const pos = parseInt(pt[1]) - 1; // 0-indexed
      const eurPerMwh = parseFloat(pt[2]);
      const utcHour = new Date(periodStart.getTime() + pos * 3_600_000);
      const dkLocal = utcToDkLocal(utcHour);
      // Only keep slots for the requested DK date
      if (dkLocal.startsWith(localDate)) {
        slots.push({ start: dkLocal, value: (eurPerMwh * eurDkkRate) / 1000 });
      }
    }
  }
  return slots.sort((a, b) => a.start.localeCompare(b.start));
}

// ---- elprisenligenu.dk (fallback, no key required) ----
async function fetchElprisenPrices(area: string, localDate: string): Promise<PriceSlot[]> {
  const year  = localDate.substring(0, 4);
  const mmdd  = localDate.substring(5).replace("-", "-"); // MM-DD
  const url   = `https://www.elprisenligenu.dk/api/v1/prices/${year}/${mmdd}_${area}.json`;
  const res   = await fetch(url);
  if (!res.ok) throw new Error(`elprisenligenu.dk ${res.status}`);
  const data  = await res.json() as Array<{ DKK_per_kWh: number; time_start: string }>;
  return data.map(r => ({
    // Strip timezone offset — time_start is already DK local time
    start: r.time_start.replace(/([+-]\d{2}:\d{2}|Z)$/, ""),
    value: r.DKK_per_kWh,
  })).sort((a, b) => a.start.localeCompare(b.start));
}

// ---- Public fetch function ----
export async function fetchPrices(
  area: string,
  entsoToken = "",
  eurDkkRate = 7.46,
): Promise<{ today: PriceSlot[]; tomorrow: PriceSlot[] }> {
  const now = new Date();
  const todayStr    = fmtDate(now);
  const tomorrowDate = new Date(now); tomorrowDate.setDate(now.getDate() + 1);
  const tomorrowStr = fmtDate(tomorrowDate);

  async function fetchOneDay(dateStr: string): Promise<PriceSlot[]> {
    if (entsoToken) {
      return fetchEntsoePrices(entsoToken, area, dateStr, eurDkkRate);
    }
    return fetchElprisenPrices(area, dateStr);
  }

  const [today, tomorrow] = await Promise.all([
    fetchOneDay(todayStr).catch(() => [] as PriceSlot[]),
    fetchOneDay(tomorrowStr).catch(() => [] as PriceSlot[]),
  ]);
  return { today, tomorrow };
}


// ---- Energinet wind/solar production forecast (free, no auth) ----
interface WindHour { hour: string; windMW: number; solarMW: number }

async function fetchWindForecast(area: string, dateStr: string): Promise<WindHour[]> {
  // Energinet's free forecast API — DK1 or DK2 wind+solar production forecast
  const nextDate = fmtDate(new Date(new Date(dateStr).getTime() + 86_400_000));
  const url = `https://api.energidataservice.dk/dataset/Forecasts_5min` +
    `?start=${encodeURIComponent(dateStr + "T00:00")}&end=${encodeURIComponent(nextDate + "T00:00")}` +
    `&columns=HourDK,Prognosis_Wind_Power_Offshore,Prognosis_Wind_Power_Onshore,Prognosis_Solar_Power` +
    `&sort=HourDK,asc&limit=400`;

  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Energinet ${res.status}`);
  const json = await res.json() as { records?: Record<string, unknown>[] };

  // Aggregate 5-min records into hourly averages
  const hourMap = new Map<string, { wind: number[]; solar: number[] }>();
  for (const r of (json.records ?? [])) {
    const hdk = r["HourDK"] as string | undefined;
    if (!hdk) continue;
    const key = hdk.slice(0, 13) + ":00:00"; // "YYYY-MM-DDTHH:00:00"
    if (!hourMap.has(key)) hourMap.set(key, { wind: [], solar: [] });
    const h = hourMap.get(key)!;
    h.wind.push((r["Prognosis_Wind_Power_Offshore"] as number ?? 0) + (r["Prognosis_Wind_Power_Onshore"] as number ?? 0));
    h.solar.push(r["Prognosis_Solar_Power"] as number ?? 0);
  }

  return [...hourMap.entries()]
    .map(([hour, d]) => ({
      hour,
      windMW:  d.wind.length  ? d.wind.reduce((a, b)  => a + b, 0) / d.wind.length  : 0,
      solarMW: d.solar.length ? d.solar.reduce((a, b) => a + b, 0) / d.solar.length : 0,
    }))
    .sort((a, b) => a.hour.localeCompare(b.hour));
}

/** Build per-hour forecast for a given date using historical prices + wind/solar data. */
async function buildHourlyForecast(
  area: string,
  forecastDate: string,
  entsoToken: string,
  eurDkkRate: number,
  dbQuery?: (area: string, dateStr: string) => Promise<PriceSlot[]>,
): Promise<{ forecast: ForecastHour[]; weeksOfData: number }> {
  const target = new Date(forecastDate + "T12:00:00");

  // Collect historical prices for 4 same-weekday occurrences (DB first, API fallback)
  const historicalDays: PriceSlot[][] = [];
  for (let w = 1; w <= 4; w++) {
    const d = new Date(target); d.setDate(d.getDate() - 7 * w);
    const dateStr = fmtDate(d);
    try {
      let slots: PriceSlot[] = [];
      if (dbQuery) slots = await dbQuery(area, dateStr);
      if (slots.length < 20) {
        slots = entsoToken
          ? await fetchEntsoePrices(entsoToken, area, dateStr, eurDkkRate)
          : await fetchElprisenPrices(area, dateStr);
      }
      if (slots.length >= 20) historicalDays.push(slots);
    } catch { /* skip */ }
  }

  // Per-hour (0-23) mean + stddev
  const hourStats = Array.from({ length: 24 }, (_, h) => {
    const values = historicalDays
      .map(day => day.find(s => parseInt(s.start.slice(11, 13)) === h)?.value)
      .filter((v): v is number => v !== undefined);
    if (!values.length) return { avg: null, std: 0, n: 0 };
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const std = values.length > 1
      ? Math.sqrt(values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length)
      : 0;
    return { avg, std, n: values.length };
  });

  // Wind/solar forecast (best-effort)
  let windData: WindHour[] = [];
  try { windData = await fetchWindForecast(area, forecastDate); } catch { /* optional */ }

  const forecast: ForecastHour[] = [];
  for (let h = 0; h < 24; h++) {
    const stats = hourStats[h];
    if (stats.avg === null) continue;
    const hourStr = `${forecastDate}T${String(h).padStart(2, "0")}:00:00`;
    const wind = windData.find(w => parseInt(w.hour.slice(11, 13)) === h);
    forecast.push({
      hour: hourStr,
      predicted: stats.avg,
      low:  Math.max(0, stats.avg - stats.std),
      high: stats.avg + stats.std,
      windMW:  wind?.windMW  ?? null,
      solarMW: wind?.solarMW ?? null,
      dataPoints: stats.n,
    });
  }

  return { forecast, weeksOfData: historicalDays.length };
}

/** Fetch forecast: hourly price prediction + wind/solar for tomorrow. */
export async function fetchForecast(
  area: string,
  entsoToken = "",
  eurDkkRate = 7.46,
  dbQuery?: (area: string, dateStr: string) => Promise<PriceSlot[]>,
): Promise<PriceForecast> {
  const now = new Date();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const forecastDate = fmtDate(tomorrow);
  const dow = tomorrow.getDay();

  const { forecast, weeksOfData } = await buildHourlyForecast(area, forecastDate, entsoToken, eurDkkRate, dbQuery);

  const predicted = forecast.map(f => f.predicted);
  const historicalAvg = predicted.length
    ? predicted.reduce((a, b) => a + b, 0) / predicted.length
    : null;
  const historicalStdDev = predicted.length > 1 && historicalAvg !== null
    ? Math.sqrt(predicted.reduce((s, v) => s + (v - historicalAvg) ** 2, 0) / predicted.length)
    : null;

  const confidence = weeksOfData >= 4 ? "high" : weeksOfData >= 2 ? "medium" : "low";
  const label = historicalAvg !== null
    ? `Forecast for ${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dow]}: ~${historicalAvg.toFixed(2)} DKK/kWh (${weeksOfData}w data)`
    : "Forecast unavailable — not enough historical data yet.";

  return {
    windCapacityPct: null, co2gPerKwh: null,
    historicalAvg, historicalStdDev, confidence, label,
    hourlyForecast: forecast,
    forecastDate,
    weeksOfData,
  };
}
