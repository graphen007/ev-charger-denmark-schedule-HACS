/** Price client — ENTSO-E Transparency Platform (primary) + elprisenligenu.dk (fallback, no key) */

export interface PriceSlot {
  start: string;   // ISO local DK time, e.g. "2026-05-31T14:00:00"
  value: number;   // DKK/kWh (spot price only, excl. tariffs)
}

export interface PriceForecast {
  windCapacityPct: number | null;
  co2gPerKwh: number | null;
  historicalAvg: number | null;
  historicalStdDev: number | null;
  confidence: "low" | "medium" | "high";
  label: string;
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

/** Fetch wind + CO2 forecast and 4-week historical avg for tomorrow's weekday. */
export async function fetchForecast(area: string, entsoToken = "", eurDkkRate = 7.46): Promise<PriceForecast> {
  const now = new Date();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const dowTomorrow = tomorrow.getDay();

  // Historical: 4 occurrences of same weekday
  const historicalPrices: number[] = [];
  for (let weeksBack = 1; weeksBack <= 4; weeksBack++) {
    const d = new Date(tomorrow);
    d.setDate(d.getDate() - 7 * weeksBack);
    try {
      const slots = entsoToken
        ? await fetchEntsoePrices(entsoToken, area, fmtDate(d), eurDkkRate)
        : await fetchElprisenPrices(area, fmtDate(d));
      if (slots.length >= 20) historicalPrices.push(slots.reduce((s, p) => s + p.value, 0) / slots.length);
    } catch { /* ignore */ }
  }

  let historicalAvg: number | null = null;
  let historicalStdDev: number | null = null;
  if (historicalPrices.length >= 2) {
    historicalAvg = historicalPrices.reduce((a, b) => a + b, 0) / historicalPrices.length;
    const variance = historicalPrices.reduce((s, v) => s + (v - historicalAvg!) ** 2, 0) / historicalPrices.length;
    historicalStdDev = Math.sqrt(variance);
  }

  const label = historicalAvg !== null
    ? `Typical for ${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dowTomorrow]}: ~${historicalAvg.toFixed(2)} DKK/kWh.`
    : "No historical data available.";

  return { windCapacityPct: null, co2gPerKwh: null, historicalAvg, historicalStdDev, confidence: "low", label };
}
