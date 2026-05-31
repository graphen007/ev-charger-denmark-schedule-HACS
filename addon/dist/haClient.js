"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HaClient = void 0;
const ws_1 = __importDefault(require("ws"));
const HA_WS_URL = process.env.HA_WS_URL ?? "ws://supervisor/core/api/websocket";
const HA_TOKEN = process.env.SUPERVISOR_TOKEN ?? process.env.HA_TOKEN ?? "";
const HA_REST = process.env.HA_REST_URL ?? "http://supervisor/core/api";
class HaClient {
    constructor() {
        this.ws = null;
        this.msgId = 1;
        this.pendingCalls = new Map();
        this.stateHandlers = [];
        this.connectHandlers = [];
        this.states = new Map();
        this.reconnectTimer = null;
        this.everConnected = false;
    }
    /**
     * Single connection attempt. Resolves on auth_ok, rejects on auth_invalid or close-before-auth.
     * Does NOT retry — callers should use connectWithRetry().
     */
    connect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        return new Promise((resolve, reject) => {
            let settled = false;
            const done = (err) => {
                if (settled)
                    return;
                settled = true;
                err ? reject(err) : resolve();
            };
            console.log(`[HaClient] Connecting to ${HA_WS_URL}`);
            this.ws = new ws_1.default(HA_WS_URL);
            this.ws.on("message", (raw) => {
                const msg = JSON.parse(raw.toString());
                this.handleMessage(msg, done);
            });
            this.ws.on("close", () => {
                // If we were previously authenticated, reconnect silently.
                // Otherwise reject so the caller's retry loop can handle it.
                if (this.everConnected) {
                    console.warn("[HaClient] WS closed — reconnecting in 5s");
                    this.scheduleReconnect();
                }
                done(new Error("WS closed before auth"));
            });
            this.ws.on("error", (err) => {
                console.error("[HaClient] WS error:", err.message);
                // close event fires after error; it will call done() with an error
            });
        });
    }
    scheduleReconnect() {
        if (this.reconnectTimer)
            return;
        this.reconnectTimer = setTimeout(async () => {
            this.reconnectTimer = null;
            try {
                await this.connect();
                // Re-fire connect handlers so caller can re-check plugged cars, etc.
                for (const h of this.connectHandlers)
                    h();
            }
            catch {
                this.scheduleReconnect(); // keep retrying
            }
        }, 5000);
    }
    async handleMessage(msg, done) {
        if (msg.type === "auth_required") {
            this.send({ type: "auth", access_token: HA_TOKEN });
            return;
        }
        if (msg.type === "auth_ok") {
            console.log("[HaClient] Authenticated ✓");
            await this.loadAllStates();
            await this.subscribeEvents();
            this.everConnected = true;
            done(); // resolve the connect() Promise
            for (const h of this.connectHandlers)
                h(); // notify subscribers
            return;
        }
        if (msg.type === "auth_invalid") {
            done(new Error("HA authentication failed — SUPERVISOR_TOKEN invalid"));
            return;
        }
        if (msg.type === "result") {
            const id = msg.id;
            const pending = this.pendingCalls.get(id);
            if (pending) {
                this.pendingCalls.delete(id);
                if (msg.success)
                    pending.resolve(msg.result);
                else
                    pending.reject(new Error(String(msg.error?.message ?? "HA call failed")));
            }
            return;
        }
        if (msg.type === "event") {
            const event = msg.event;
            if (event.event_type === "state_changed") {
                const data = event.data;
                const entityId = data.entity_id;
                const newState = data.new_state;
                const oldState = data.old_state;
                if (newState)
                    this.states.set(entityId, newState);
                for (const h of this.stateHandlers)
                    h(entityId, newState, oldState);
            }
        }
    }
    send(msg) {
        this.ws?.send(JSON.stringify(msg));
    }
    callWs(msg) {
        return new Promise((resolve, reject) => {
            const id = this.msgId++;
            this.pendingCalls.set(id, { resolve: resolve, reject });
            this.send({ ...msg, id });
        });
    }
    async loadAllStates() {
        const states = await this.callWs({ type: "get_states" });
        for (const s of states)
            this.states.set(s.entity_id, s);
        console.log(`[HaClient] Loaded ${states.length} entity states`);
    }
    async subscribeEvents() {
        await this.callWs({ type: "subscribe_events", event_type: "state_changed" });
        console.log("[HaClient] Subscribed to state_changed events");
    }
    /** Called every time a (re)connection is established and auth_ok received. */
    onConnect(handler) {
        this.connectHandlers.push(handler);
    }
    onStateChanged(handler) {
        this.stateHandlers.push(handler);
    }
    getState(entityId) {
        return this.states.get(entityId);
    }
    getAllStates() {
        return Array.from(this.states.values());
    }
    async callService(domain, service, data) {
        await this.callWs({ type: "call_service", domain, service, service_data: data });
    }
    async callApi(method, path, body) {
        const res = await fetch(`${HA_REST}/${path}`, {
            method,
            headers: {
                "Authorization": `Bearer ${HA_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok)
            throw new Error(`HA API ${method} /${path} → ${res.status}`);
        return res.json();
    }
    async sendNotification(title, message) {
        try {
            await this.callService("notify", "notify", { title, message });
        }
        catch (e) {
            console.warn("[HaClient] Notification failed:", e.message);
        }
    }
}
exports.HaClient = HaClient;
