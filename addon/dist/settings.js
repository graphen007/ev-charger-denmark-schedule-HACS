"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadSettings = loadSettings;
exports.saveSettings = saveSettings;
exports.getCarSettings = getCarSettings;
exports.saveCarSettings = saveCarSettings;
exports.loadSessions = loadSessions;
exports.appendSession = appendSession;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const planner_js_1 = require("./planner.js");
const DATA_DIR = process.env.DATA_DIR ?? "/data";
const SETTINGS_PATH = path_1.default.join(DATA_DIR, "settings.json");
const SESSIONS_PATH = path_1.default.join(DATA_DIR, "sessions.json");
const DEFAULT_GLOBAL = {
    area: "DK1",
    entso_e_token: "",
    eur_dkk_rate: 7.46,
    tariffs: { ...planner_js_1.DEFAULT_TARIFFS },
    notifications: {
        price_published: true,
        charge_complete: true,
        price_spike_threshold: 3.0,
    },
    cars: [],
    carSettings: {},
};
function ensureDataDir() {
    if (!fs_1.default.existsSync(DATA_DIR))
        fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
}
let _settings = null;
function loadSettings() {
    if (_settings)
        return _settings;
    ensureDataDir();
    // Merge with any area set in addon options.json
    let areaOverride = "DK1";
    try {
        const opts = JSON.parse(fs_1.default.readFileSync("/data/options.json", "utf8"));
        if (opts.area === "DK2")
            areaOverride = "DK2";
    }
    catch { }
    try {
        const raw = fs_1.default.readFileSync(SETTINGS_PATH, "utf8");
        const parsed = JSON.parse(raw);
        _settings = {
            ...DEFAULT_GLOBAL,
            ...parsed,
            area: parsed.area ?? areaOverride,
            tariffs: { ...DEFAULT_GLOBAL.tariffs, ...(parsed.tariffs ?? {}) },
            notifications: { ...DEFAULT_GLOBAL.notifications, ...(parsed.notifications ?? {}) },
            cars: parsed.cars ?? [],
            carSettings: parsed.carSettings ?? {},
        };
    }
    catch {
        _settings = { ...DEFAULT_GLOBAL, area: areaOverride };
    }
    return _settings;
}
function saveSettings(s) {
    ensureDataDir();
    _settings = s;
    fs_1.default.writeFileSync(SETTINGS_PATH, JSON.stringify(s, null, 2), "utf8");
}
function getCarSettings(carId) {
    const s = loadSettings();
    return { ...planner_js_1.DEFAULT_CAR_SETTINGS, ...(s.carSettings[carId] ?? {}) };
}
function saveCarSettings(carId, cs) {
    const s = loadSettings();
    s.carSettings[carId] = cs;
    saveSettings(s);
}
// ---- Session log ----
function loadSessions() {
    ensureDataDir();
    try {
        return JSON.parse(fs_1.default.readFileSync(SESSIONS_PATH, "utf8"));
    }
    catch {
        return [];
    }
}
function appendSession(session) {
    ensureDataDir();
    const sessions = loadSessions();
    sessions.push(session);
    // Keep last 500 sessions
    const trimmed = sessions.slice(-500);
    fs_1.default.writeFileSync(SESSIONS_PATH, JSON.stringify(trimmed, null, 2), "utf8");
}
