import fs from "fs";
import path from "path";
import type { CarConfig, CarSettings, Tariffs } from "./planner.js";
import { DEFAULT_TARIFFS, DEFAULT_CAR_SETTINGS } from "./planner.js";

const DATA_DIR  = process.env.DATA_DIR ?? "/data";
const SETTINGS_PATH = path.join(DATA_DIR, "settings.json");
const SESSIONS_PATH = path.join(DATA_DIR, "sessions.json");

export interface NotificationSettings {
  price_published: boolean;
  charge_complete: boolean;
  price_spike_threshold: number;
}

export interface GlobalSettings {
  area: "DK1" | "DK2";
  tariffs: Tariffs;
  notifications: NotificationSettings;
  cars: CarConfig[];
  carSettings: Record<string, CarSettings>;
}

export interface ChargingSession {
  id: string;
  carId: string;
  carName: string;
  startTime: string;
  endTime: string;
  startSoc: number;
  endSoc: number;
  kwhAdded: number;
  estimatedCost: number;
  avgEffectivePrice: number;
  co2gPerKwh: number | null;
}

const DEFAULT_GLOBAL: GlobalSettings = {
  area: "DK1",
  tariffs: { ...DEFAULT_TARIFFS },
  notifications: {
    price_published:        true,
    charge_complete:        true,
    price_spike_threshold:  3.0,
  },
  cars: [],
  carSettings: {},
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

let _settings: GlobalSettings | null = null;

export function loadSettings(): GlobalSettings {
  if (_settings) return _settings;
  ensureDataDir();

  // Merge with any area set in addon options.json
  let areaOverride: "DK1" | "DK2" = "DK1";
  try {
    const opts = JSON.parse(fs.readFileSync("/data/options.json", "utf8"));
    if (opts.area === "DK2") areaOverride = "DK2";
  } catch {}

  try {
    const raw = fs.readFileSync(SETTINGS_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<GlobalSettings>;
    _settings = {
      ...DEFAULT_GLOBAL,
      ...parsed,
      area: parsed.area ?? areaOverride,
      tariffs:       { ...DEFAULT_GLOBAL.tariffs,       ...(parsed.tariffs ?? {}) },
      notifications: { ...DEFAULT_GLOBAL.notifications, ...(parsed.notifications ?? {}) },
      cars:          parsed.cars ?? [],
      carSettings:   parsed.carSettings ?? {},
    };
  } catch {
    _settings = { ...DEFAULT_GLOBAL, area: areaOverride };
  }
  return _settings;
}

export function saveSettings(s: GlobalSettings): void {
  ensureDataDir();
  _settings = s;
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(s, null, 2), "utf8");
}

export function getCarSettings(carId: string): CarSettings {
  const s = loadSettings();
  return { ...DEFAULT_CAR_SETTINGS, ...(s.carSettings[carId] ?? {}) };
}

export function saveCarSettings(carId: string, cs: CarSettings): void {
  const s = loadSettings();
  s.carSettings[carId] = cs;
  saveSettings(s);
}

// ---- Session log ----

export function loadSessions(): ChargingSession[] {
  ensureDataDir();
  try {
    return JSON.parse(fs.readFileSync(SESSIONS_PATH, "utf8")) as ChargingSession[];
  } catch {
    return [];
  }
}

export function appendSession(session: ChargingSession): void {
  ensureDataDir();
  const sessions = loadSessions();
  sessions.push(session);
  // Keep last 500 sessions
  const trimmed = sessions.slice(-500);
  fs.writeFileSync(SESSIONS_PATH, JSON.stringify(trimmed, null, 2), "utf8");
}
