import WebSocket from "ws";

export interface HaState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
}

type StateChangedHandler = (entityId: string, newState: HaState, oldState: HaState | null) => void;
type ConnectHandler = () => void;

const HA_WS_URL = process.env.HA_WS_URL ?? "ws://supervisor/core/api/websocket";
const HA_TOKEN  = process.env.SUPERVISOR_TOKEN ?? process.env.HA_TOKEN ?? "";
const HA_REST   = process.env.HA_REST_URL ?? "http://supervisor/core/api";

export class HaClient {
  private ws: WebSocket | null = null;
  private msgId = 1;
  private pendingCalls = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private stateHandlers: StateChangedHandler[] = [];
  private connectHandlers: ConnectHandler[] = [];
  private states: Map<string, HaState> = new Map();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private everConnected = false;

  /**
   * Single connection attempt. Resolves on auth_ok, rejects on auth_invalid or close-before-auth.
   * Does NOT retry — callers should use connectWithRetry().
   */
  connect(): Promise<void> {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }

    return new Promise((resolve, reject) => {
      let settled = false;
      const done = (err?: Error) => {
        if (settled) return;
        settled = true;
        err ? reject(err) : resolve();
      };

      console.log(`[HaClient] Connecting to ${HA_WS_URL}`);
      this.ws = new WebSocket(HA_WS_URL);

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

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
        // Re-fire connect handlers so caller can re-check plugged cars, etc.
        for (const h of this.connectHandlers) h();
      } catch {
        this.scheduleReconnect(); // keep retrying
      }
    }, 5000);
  }

  private async handleMessage(msg: Record<string, unknown>, done: (err?: Error) => void) {
    if (msg.type === "auth_required") {
      this.send({ type: "auth", access_token: HA_TOKEN });
      return;
    }

    if (msg.type === "auth_ok") {
      console.log("[HaClient] Authenticated ✓");
      await this.loadAllStates();
      await this.subscribeEvents();
      this.everConnected = true;
      done();                                     // resolve the connect() Promise
      for (const h of this.connectHandlers) h();  // notify subscribers
      return;
    }

    if (msg.type === "auth_invalid") {
      done(new Error("HA authentication failed — SUPERVISOR_TOKEN invalid"));
      return;
    }

    if (msg.type === "result") {
      const id = msg.id as number;
      const pending = this.pendingCalls.get(id);
      if (pending) {
        this.pendingCalls.delete(id);
        if (msg.success) pending.resolve(msg.result);
        else pending.reject(new Error(String((msg.error as Record<string,unknown>)?.message ?? "HA call failed")));
      }
      return;
    }

    if (msg.type === "event") {
      const event = msg.event as Record<string, unknown>;
      if (event.event_type === "state_changed") {
        const data = event.data as Record<string, unknown>;
        const entityId = data.entity_id as string;
        const newState = data.new_state as HaState | null;
        const oldState = data.old_state as HaState | null;
        if (newState) this.states.set(entityId, newState);
        for (const h of this.stateHandlers) h(entityId, newState!, oldState);
      }
    }
  }

  private send(msg: Record<string, unknown>) {
    this.ws?.send(JSON.stringify(msg));
  }

  private callWs<T>(msg: Record<string, unknown>): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = this.msgId++;
      this.pendingCalls.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.send({ ...msg, id });
    });
  }

  private async loadAllStates() {
    const states = await this.callWs<HaState[]>({ type: "get_states" });
    for (const s of states) this.states.set(s.entity_id, s);
    console.log(`[HaClient] Loaded ${states.length} entity states`);
  }

  private async subscribeEvents() {
    await this.callWs({ type: "subscribe_events", event_type: "state_changed" });
    console.log("[HaClient] Subscribed to state_changed events");
  }

  /** Called every time a (re)connection is established and auth_ok received. */
  onConnect(handler: ConnectHandler) {
    this.connectHandlers.push(handler);
  }

  onStateChanged(handler: StateChangedHandler) {
    this.stateHandlers.push(handler);
  }

  getState(entityId: string): HaState | undefined {
    return this.states.get(entityId);
  }

  isConnected(): boolean { return this.everConnected; }

  getAllStates(): HaState[] {
    return Array.from(this.states.values());
  }

  async callService(domain: string, service: string, data: Record<string, unknown>): Promise<void> {
    await this.callWs({ type: "call_service", domain, service, service_data: data });
  }

  async callApi<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${HA_REST}/${path}`, {
      method,
      headers: {
        "Authorization": `Bearer ${HA_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`HA API ${method} /${path} → ${res.status}`);
    return res.json() as Promise<T>;
  }

  async sendNotification(title: string, message: string): Promise<void> {
    try {
      await this.callService("notify", "notify", { title, message });
    } catch (e) {
      console.warn("[HaClient] Notification failed:", (e as Error).message);
    }
  }
}

