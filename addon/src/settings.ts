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
  entso_e_token: string;
  eur_dkk_rate: number;
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
  entso_e_token: "",
  eur_dkk_rate: 7.46,
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

// ---- Session log (MongoDB) ----
import { dbLoadSessions, dbAppendSession, isDbConnected } from "./db.js";

/** Load sessions — from MongoDB if connected, else legacy JSON fallback. */
export async function loadSessions(): Promise<ChargingSession[]> {
  if (isDbConnected()) return dbLoadSessions();
  // Legacy JSON fallback (used if MongoDB unavailable)
  try {
    return JSON.parse(fs.readFileSync(SESSIONS_PATH, "utf8")) as ChargingSession[];
  } catch { return []; }
}

/** Append a session — to MongoDB if connected, else legacy JSON fallback. */
export async function appendSession(session: ChargingSession): Promise<void> {
  if (isDbConnected()) { await dbAppendSession(session); return; }
  // Legacy JSON fallback
  ensureDataDir();
  const existing: ChargingSession[] = (() => {
    try { return JSON.parse(fs.readFileSync(SESSIONS_PATH, "utf8")); } catch { return []; }
  })();
  const trimmed = [...existing, session].slice(-500);
  fs.writeFileSync(SESSIONS_PATH, JSON.stringify(trimmed, null, 2), "utf8");
}

// ---- Last command log ----

export interface LastCommand {
  action: "start" | "stop";
  time: string;   // ISO
  ep?: number;    // effective price at the time
}

const LAST_COMMANDS_PATH = path.join(DATA_DIR, "last_commands.json");

export function loadLastCommands(): Record<string, LastCommand> {
  try {
    return JSON.parse(fs.readFileSync(LAST_COMMANDS_PATH, "utf8"));
  } catch {
    return {};
  }
}

export function saveLastCommand(carId: string, cmd: LastCommand): void {
  ensureDataDir();
  const all = loadLastCommands();
  all[carId] = cmd;
  fs.writeFileSync(LAST_COMMANDS_PATH, JSON.stringify(all, null, 2), "utf8");
}
