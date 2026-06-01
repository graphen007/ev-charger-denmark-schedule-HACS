import fs from "fs";
import path from "path";
import type { CarConfig, CarSettings, Tariffs } from "./planner.js";
import { DEFAULT_TARIFFS, DEFAULT_CAR_SETTINGS } from "./planner.js";

const DATA_DIR        = process.env.DATA_DIR ?? "/data";
const SETTINGS_PATH   = path.join(DATA_DIR, "settings.json");
const SESSIONS_PATH   = path.join(DATA_DIR, "sessions.json");
const LAST_CMDS_PATH  = path.join(DATA_DIR, "last_commands.json");

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

export interface LastCommand {
  action: "start" | "stop";
  time: string;
  ep?: number;
}

const DEFAULT_GLOBAL: GlobalSettings = {
  area: "DK1",
  entso_e_token: "",
  eur_dkk_rate: 7.46,
  tariffs: { ...DEFAULT_TARIFFS },
  notifications: { price_published: true, charge_complete: true, price_spike_threshold: 3.0 },
  cars: [],
  carSettings: {},
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ---- In-memory caches (populated synchronously from DB at startup) ----
let _settings: GlobalSettings | null = null;
let _lastCommands: Record<string, LastCommand> = {};

// ---- Settings ----

function loadAreaOverride(): "DK1" | "DK2" {
  try {
    const opts = JSON.parse(fs.readFileSync("/data/options.json", "utf8"));
    if (opts.area === "DK2") return "DK2";
  } catch {}
  return "DK1";
}

function mergeSettings(parsed: Partial<GlobalSettings>): GlobalSettings {
  return {
    ...DEFAULT_GLOBAL,
    ...parsed,
    area: parsed.area ?? loadAreaOverride(),
    tariffs:       { ...DEFAULT_GLOBAL.tariffs,       ...(parsed.tariffs ?? {}) },
    notifications: { ...DEFAULT_GLOBAL.notifications, ...(parsed.notifications ?? {}) },
    cars:          parsed.cars ?? [],
    carSettings:   parsed.carSettings ?? {},
  };
}

/** Sync read from in-memory cache. Call initFromDb() before this. */
export function loadSettings(): GlobalSettings {
  if (_settings) return _settings;
  // Cold-start fallback (before initFromDb completes): read JSON
  ensureDataDir();
  try {
    _settings = mergeSettings(JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8")));
  } catch {
    _settings = { ...DEFAULT_GLOBAL, area: loadAreaOverride() };
  }
  return _settings;
}

export function saveSettings(s: GlobalSettings): void {
  _settings = s;
  // Write to MongoDB (async, fire-and-forget)
  import("./db.js").then(({ isDbConnected, dbSaveSettings }) => {
    if (isDbConnected()) dbSaveSettings(s).catch(e => console.warn("[DB] saveSettings failed:", e.message));
  });
}

export function getCarSettings(carId: string): CarSettings {
  return { ...DEFAULT_CAR_SETTINGS, ...(loadSettings().carSettings[carId] ?? {}) };
}

export function saveCarSettings(carId: string, cs: CarSettings): void {
  const s = loadSettings();
  s.carSettings[carId] = cs;
  saveSettings(s);
}

// ---- Sessions ----

export async function loadSessions(): Promise<ChargingSession[]> {
  const { isDbConnected, dbLoadSessions } = await import("./db.js");
  if (isDbConnected()) return dbLoadSessions();
  try { return JSON.parse(fs.readFileSync(SESSIONS_PATH, "utf8")); } catch { return []; }
}

export async function appendSession(session: ChargingSession): Promise<void> {
  const { isDbConnected, dbAppendSession } = await import("./db.js");
  if (isDbConnected()) { await dbAppendSession(session); return; }
  ensureDataDir();
  const existing: ChargingSession[] = (() => {
    try { return JSON.parse(fs.readFileSync(SESSIONS_PATH, "utf8")); } catch { return []; }
  })();
  fs.writeFileSync(SESSIONS_PATH, JSON.stringify([...existing, session].slice(-500), null, 2), "utf8");
}

// ---- Last commands ----

export function loadLastCommands(): Record<string, LastCommand> {
  return _lastCommands;
}

export function saveLastCommand(carId: string, cmd: LastCommand): void {
  _lastCommands[carId] = cmd;
  import("./db.js").then(({ isDbConnected, dbSaveLastCommands }) => {
    if (isDbConnected()) dbSaveLastCommands(_lastCommands).catch(e => console.warn("[DB] saveLastCommand failed:", e.message));
  });
}

// ---- Startup: load everything from MongoDB, migrate JSON if first run ----

export async function initFromDb(): Promise<void> {
  const { isDbConnected, dbLoadSettings, dbSaveSettings, dbLoadLastCommands, dbSaveLastCommands, dbAppendSession, dbLoadSessions } = await import("./db.js");
  if (!isDbConnected()) return;

  // Settings
  const dbSettings = await dbLoadSettings();
  if (dbSettings) {
    _settings = mergeSettings(dbSettings);
    console.log("[DB] Settings loaded from MongoDB");
  } else {
    // First run — migrate from JSON if it exists
    const jsonSettings = (() => {
      try { return mergeSettings(JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8"))); } catch { return null; }
    })();
    _settings = jsonSettings ?? { ...DEFAULT_GLOBAL, area: loadAreaOverride() };
    await dbSaveSettings(_settings);
    console.log("[DB] Settings migrated to MongoDB" + (jsonSettings ? " (from JSON)" : " (defaults)"));
  }

  // Last commands
  const dbCmds = await dbLoadLastCommands();
  if (dbCmds) {
    _lastCommands = dbCmds;
    console.log("[DB] Last commands loaded from MongoDB");
  } else {
    try {
      _lastCommands = JSON.parse(fs.readFileSync(LAST_CMDS_PATH, "utf8"));
      await dbSaveLastCommands(_lastCommands);
      console.log("[DB] Last commands migrated to MongoDB (from JSON)");
    } catch { _lastCommands = {}; }
  }

  // Sessions — migrate JSON sessions into MongoDB if collection is empty
  const existingCount = (await dbLoadSessions()).length;
  if (existingCount === 0) {
    try {
      const jsonSessions: ChargingSession[] = JSON.parse(fs.readFileSync(SESSIONS_PATH, "utf8"));
      if (jsonSessions.length) {
        for (const s of jsonSessions) await dbAppendSession(s);
        console.log(`[DB] Migrated ${jsonSessions.length} sessions from JSON to MongoDB`);
      }
    } catch {}
  }
}
