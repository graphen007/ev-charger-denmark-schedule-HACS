import type { HaClient } from "./haClient.js";
import type { Notifier } from "./notifier.js";
import type { PriceSlot } from "./priceClient.js";
import { fetchPrices } from "./priceClient.js";
import { buildChargePlan, planSummary, type Slot, type CarConfig } from "./planner.js";
import { loadSettings, saveCarSettings, getCarSettings, appendSession, type ChargingSession } from "./settings.js";

/** Is the car on a DC fast charger? (power >> home AC charge rate) */
function isFastCharger(powerW: number, chargeKw: number): boolean {
  return powerW > chargeKw * 1500;
}

interface CarState {
  plugged: boolean;
  plan: Slot[];
  chargingSessionStart?: { time: Date; startSoc: number };
}

export class Controller {
  private carStates = new Map<string, CarState>();
  private priceSlots: PriceSlot[] = [];
  private lastPriceError: string | null = null;
  private broadcastFn: ((event: string, data: unknown) => void) | null = null;

  constructor(private ha: HaClient, private notifier: Notifier) {}

  setBroadcast(fn: (event: string, data: unknown) => void) {
    this.broadcastFn = fn;
  }

  private broadcast(event: string, data: unknown) {
    this.broadcastFn?.(event, data);
  }

  /** Press the car's refresh button/script entity so the integration fetches fresh data. */
  async refreshCarData(car: CarConfig): Promise<void> {
    if (!car.refresh_entity) return;
    const domain = car.refresh_entity.split(".")[0];
    const service = domain === "button" ? "press" : domain === "script" ? "turn_on" : "press";
    try {
      await this.ha.callService(domain, service, { entity_id: car.refresh_entity });
      console.log(`[Controller] ${car.name}: triggered data refresh (${car.refresh_entity})`);
      // Give the integration a moment to fetch before we read state
      await new Promise(res => setTimeout(res, 3000));
    } catch (e: unknown) {
      console.warn(`[Controller] ${car.name}: refresh entity call failed — ${(e as Error).message}`);
    }
  }

  private getSoc(car: CarConfig): number {
    const s = loadSettings();
    if (car.soc_entity) {
      const state = this.ha.getState(car.soc_entity);
      const v = parseFloat(state?.state ?? "");
      if (!isNaN(v)) return v;
    }
    return getCarSettings(car.id).manual_soc ?? 20;
  }

  private getPowerW(car: CarConfig): number {
    if (!car.power_entity) return 0;
    const state = this.ha.getState(car.power_entity);
    return parseFloat(state?.state ?? "0") || 0;
  }

  private getSolarSurplusKw(car: CarConfig): number {
    if (!car.solar_power_entity) return 0;
    const solar = parseFloat(this.ha.getState(car.solar_power_entity)?.state ?? "0") || 0;
    const consumption = car.house_consumption_entity
      ? parseFloat(this.ha.getState(car.house_consumption_entity)?.state ?? "0") || 0
      : 0;
    return Math.max(0, (solar - consumption) / 1000); // assume W → kW
  }

  rebuildPlan(car: CarConfig): Slot[] {
    const settings = getCarSettings(car.id);
    const soc = this.getSoc(car);
    const solarSurplusKw = this.getSolarSurplusKw(car);
    const plan = buildChargePlan(
      this.priceSlots, settings, loadSettings().tariffs,
      soc, car.battery_kwh, car.charge_kw, solarSurplusKw,
    );
    // Preserve existing state — only update the plan array
    const existing = this.carStates.get(car.id);
    const state: CarState = existing ?? { plugged: false, plan: [] };
    state.plan = plan;
    this.carStates.set(car.id, state);
    this.broadcast("plan_updated", { carId: car.id, plan });
    return plan;
  }

  /** Called when a plug entity transitions to "on". */
  async onPlugIn(car: CarConfig): Promise<void> {
    const powerW = this.getPowerW(car);
    if (isFastCharger(powerW, car.charge_kw)) {
      console.log(`[Controller] ${car.name}: DC fast charger detected (${powerW}W) — hands off`);
      return;
    }
    console.log(`[Controller] ${car.name}: plugged in — building plan`);
    const soc = this.getSoc(car);
    const state: CarState = {
      plugged: true,
      plan: [],
      chargingSessionStart: { time: new Date(), startSoc: soc },
    };
    this.carStates.set(car.id, state);
    if (this.priceSlots.length > 0) this.rebuildPlan(car);
    this.broadcast("plug_changed", { carId: car.id, plugged: true });
    // Start controlling immediately rather than waiting up to 5 min for the tick
    await this.controlCar(car, this.carStates.get(car.id)!);
  }

  /** Called when a plug entity transitions to "off". */
  async onPlugOut(car: CarConfig): Promise<void> {
    console.log(`[Controller] ${car.name}: unplugged — turning off charger`);
    const state = this.carStates.get(car.id);

    // Ensure charger is off
    try { await this.ha.callService("switch", "turn_off", { entity_id: car.charging_switch }); } catch {}

    // Record session
    if (state?.chargingSessionStart) {
      const endSoc = this.getSoc(car);
      const settings = getCarSettings(car.id);
      const plan = state.plan;
      const chargingSlots = plan.filter((s) => s.charging && !s.isPast);
      const kwhAdded = Math.max(0, ((endSoc - state.chargingSessionStart.startSoc) / 100) * car.battery_kwh);
      const avgEp = chargingSlots.length ? chargingSlots.reduce((a, s) => a + s.ep, 0) / chargingSlots.length : 0;
      const session: ChargingSession = {
        id: `${car.id}_${Date.now()}`,
        carId: car.id,
        carName: car.name,
        startTime: state.chargingSessionStart.time.toISOString(),
        endTime: new Date().toISOString(),
        startSoc: state.chargingSessionStart.startSoc,
        endSoc,
        kwhAdded,
        estimatedCost: kwhAdded * avgEp,
        avgEffectivePrice: avgEp,
        co2gPerKwh: null, // filled by price client if available
      };
      appendSession(session);
      if (endSoc >= (settings.charge_limit ?? 100) - 2) {
        await this.notifier.chargeComplete(car.name, endSoc, kwhAdded, session.estimatedCost);
      }
    }

    this.carStates.set(car.id, { plugged: false, plan: [] });
    this.broadcast("plug_changed", { carId: car.id, plugged: false });
  }

  /** 5-min tick — control charging for all cars. */
  async tick(): Promise<void> {
    const { cars } = loadSettings();
    for (const car of cars) {
      if (!car.charging_switch) continue;
      await this.refreshCarData(car);
      const state = this.carStates.get(car.id);
      const noPlugDetection = !car.plug_entity;
      if (!noPlugDetection && !state?.plugged) continue;
      const effectiveState = state ?? { plugged: true, plan: [] };
      await this.controlCar(car, effectiveState);
    }
  }

  /** Control one car's charging based on its current plan slot. */
  private async controlCar(car: CarConfig, state: CarState): Promise<void> {
    const powerW = this.getPowerW(car);

    // DC fast charger bypass
    if (isFastCharger(powerW, car.charge_kw)) {
      console.log(`[Controller] ${car.name}: DC fast charger active — skipping`);
      return;
    }

    const settings = getCarSettings(car.id);
    console.log(`[Controller] ${car.name}: controlCar mode=${settings.mode} switch=${car.charging_switch}`);

    if (!car.charging_switch) {
      console.warn(`[Controller] ${car.name}: no charging_switch configured — skipping`);
      return;
    }

    // Solar surplus mode: react in real-time
    if (settings.mode === "Solar Surplus") {
      const surplus = this.getSolarSurplusKw(car);
      const shouldCharge = surplus >= car.charge_kw * 0.8;
      const isCharging = this.ha.getState(car.charging_switch)?.state === "on";
      if (shouldCharge !== isCharging) {
        await this.ha.callService("switch", shouldCharge ? "turn_on" : "turn_off", { entity_id: car.charging_switch });
        console.log(`[Controller] ${car.name}: solar surplus ${surplus.toFixed(1)}kW — ${shouldCharge ? "started" : "paused"} charging`);
      }
      return;
    }

    // Charge Now
    if (settings.mode === "Charge Now") {
      if (this.ha.getState(car.charging_switch)?.state !== "on") {
        await this.ha.callService("switch", "turn_on", { entity_id: car.charging_switch });
        console.log(`[Controller] ${car.name}: Charge Now — started`);
      }
      return;
    }

    // Off
    if (settings.mode === "Off") {
      if (this.ha.getState(car.charging_switch)?.state === "on") {
        await this.ha.callService("switch", "turn_off", { entity_id: car.charging_switch });
        console.log(`[Controller] ${car.name}: Off — stopped`);
      }
      return;
    }

    // Slot-based modes
    if (!state.plan.length) {
      console.log(`[Controller] ${car.name}: no plan slots — skipping (prices loaded: ${this.priceSlots.length})`);
      return;
    }
    const now = new Date();
    const currentSlot = state.plan.find(
      (s) => now >= s.localDate && now < new Date(s.localDate.getTime() + 15 * 60 * 1000),
    );
    if (!currentSlot) {
      console.log(`[Controller] ${car.name}: no matching slot for ${now.toTimeString().slice(0,5)}`);
      return;
    }

    const shouldCharge = currentSlot.charging;
    const isCharging = this.ha.getState(car.charging_switch)?.state === "on";
    console.log(`[Controller] ${car.name}: slot ${now.toTimeString().slice(0,5)} shouldCharge=${shouldCharge} isCharging=${isCharging}`);

    if (shouldCharge && !isCharging) {
      await this.ha.callService("switch", "turn_on", { entity_id: car.charging_switch });
      console.log(`[Controller] ${car.name}: started (${currentSlot.ep.toFixed(2)} DKK/kWh)`);
    } else if (!shouldCharge && isCharging) {
      await this.ha.callService("switch", "turn_off", { entity_id: car.charging_switch });
      console.log(`[Controller] ${car.name}: paused (${currentSlot.ep.toFixed(2)} DKK/kWh)`);
    }
  }

  /** Try to read today/tomorrow prices from a HA Nord Pool sensor entity.
   *  Returns null if no suitable entity is found or HA is not connected. */
  private fetchPricesFromHaEntities(): { today: PriceSlot[]; tomorrow: PriceSlot[] } | null {
    if (!this.ha.isConnected()) return null;
    const allStates = this.ha.getAllStates();
    // Find nordpool sensor entities — they have raw_today attribute with price objects
    const npEntity = allStates.find(e =>
      e.entity_id.toLowerCase().includes("nordpool") &&
      Array.isArray(e.attributes?.raw_today) &&
      e.attributes.raw_today.length > 0,
    );
    if (!npEntity) return null;

    console.log(`[Controller] Using HA Nord Pool entity: ${npEntity.entity_id}`);
    // price_type "MWh" means values are DKK/MWh → divide by 1000
    const scale = (npEntity.attributes.price_type ?? "MWh") === "MWh" ? 0.001 : 1;

    type RawEntry = { start: string; value: number };
    const toSlot = (item: RawEntry): PriceSlot => ({
      // Strip timezone offset so it's treated as local DK time
      start: item.start.replace(/([+-]\d{2}:\d{2}|Z)$/, ""),
      value: item.value * scale,
    });

    const today    = (npEntity.attributes.raw_today    as RawEntry[] ?? []).map(toSlot);
    const tomorrow = (npEntity.attributes.raw_tomorrow as RawEntry[] ?? []).map(toSlot);
    return { today, tomorrow };
  }

  /** Refresh prices and rebuild all plans. */
  async refreshPrices(): Promise<void> {
    const { area, cars } = loadSettings();
    console.log(`[Controller] Fetching prices for ${area}…`);
    try {
      // Try HA Nord Pool entity first (most reliable inside the addon)
      let today: PriceSlot[];
      let tomorrow: PriceSlot[];
      const haResult = this.fetchPricesFromHaEntities();
      if (haResult && haResult.today.length >= 20) {
        today    = haResult.today;
        tomorrow = haResult.tomorrow;
        console.log(`[Controller] Prices from HA Nord Pool: ${today.length} today + ${tomorrow.length} tomorrow`);
      } else {
        // Use ENTSO-E (if token set) or elprisenligenu.dk fallback
        const { entso_e_token, eur_dkk_rate } = loadSettings();
        const fetched = await fetchPrices(area, entso_e_token, eur_dkk_rate);
        today    = fetched.today;
        tomorrow = fetched.tomorrow;
        console.log(`[Controller] Prices from ${entso_e_token ? "ENTSO-E" : "elprisenligenu.dk"}: ${today.length} today + ${tomorrow.length} tomorrow`);
      }

      this.lastPriceError = null;
      this.priceSlots = [...today, ...tomorrow];

      // Notify if tomorrow prices just arrived
      if (tomorrow.length > 0) {
        const tomorrowEps = tomorrow.map((s) => {
          const dt = new Date(s.start);
          const ep = s.value * 1.25 + 0.21; // rough effective price for notification
          return ep;
        });
        const avgEp = tomorrowEps.reduce((a, b) => a + b, 0) / tomorrowEps.length;
        const sortedEps = [...tomorrowEps].sort((a, b) => a - b);
        const maxEp = sortedEps[sortedEps.length - 1];
        const cheapHour = tomorrow.reduce((b, s) => s.value < b.value ? s : b, tomorrow[0]);
        const cheapLabel = new Date(cheapHour.start).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
        await this.notifier.pricesPublished(avgEp, `~${cheapLabel}`);
        await this.notifier.priceSpike("tomorrow peak", maxEp);
      }

      // Rebuild plans for all plugged cars
      for (const car of cars) {
        const state = this.carStates.get(car.id);
        if (state?.plugged) this.rebuildPlan(car);
      }
      this.broadcast("prices_updated", { slots: this.priceSlots.length });
    } catch (e) {
      this.lastPriceError = (e as Error).message;
      console.error("[Controller] Price fetch failed:", this.lastPriceError);
    }
  }

  getPriceSlots(): PriceSlot[] { return this.priceSlots; }
  getLastPriceError(): string | null { return this.lastPriceError; }
  getCarState(carId: string): CarState | undefined { return this.carStates.get(carId); }

  getAllStatus() {
    const { cars } = loadSettings();
    return cars.map((car) => {
      const state = this.carStates.get(car.id);
      const settings = getCarSettings(car.id);
      const plugState = car.plug_entity ? this.ha.getState(car.plug_entity)?.state : undefined;
      const chargingState = car.charging_switch ? this.ha.getState(car.charging_switch)?.state : undefined;
      const soc = this.getSoc(car);
      const powerW = this.getPowerW(car);
      const plan = state?.plan ?? [];
      const summary = plan.length
        ? planSummary(plan, soc, car.battery_kwh, car.charge_kw, settings.charge_limit)
        : null;
      return {
        carId: car.id,
        carName: car.name,
        plugged: plugState === "on",
        isCharging: chargingState === "on",
        isFastCharger: isFastCharger(powerW, car.charge_kw),
        soc,
        powerW,
        mode: settings.mode,
        plan,
        summary,
      };
    });
  }

  /** Force execute plan for one car (used by Execute button in UI). */
  async executeNow(carId: string): Promise<string> {
    const { cars } = loadSettings();
    const car = cars.find((c) => c.id === carId);
    if (!car) return `Car ${carId} not found`;

    // Refresh car data first so we read the latest SoC/plug state
    await this.refreshCarData(car);

    const settings = getCarSettings(carId);

    // Re-read plug state from HA directly so we always have the latest value.
    // If no plug entity is configured we cannot detect plug state — treat as plugged.
    const plugState = car.plug_entity ? this.ha.getState(car.plug_entity)?.state : undefined;
    const isPlugged = car.plug_entity ? plugState === "on" : true;

    // If the car is not plugged in and the mode would turn charging on, bail out early.
    // "Off" is still allowed — it ensures the switch is off regardless of plug state.
    if (!isPlugged && settings.mode !== "Off") {
      if (car.charging_switch && this.ha.getState(car.charging_switch)?.state === "on") {
        await this.ha.callService("switch", "turn_off", { entity_id: car.charging_switch });
      }
      return `${car.name}: not plugged in — nothing to do`;
    }

    // Update carState so subsequent ticks keep running for this car
    const existing = this.carStates.get(carId);
    const state: CarState = existing ?? { plugged: isPlugged, plan: [] };
    state.plugged = isPlugged;
    if (!existing || state.plan.length === 0) {
      if (this.priceSlots.length > 0) this.rebuildPlan(car);
    }
    this.carStates.set(carId, state);
    await this.controlCar(car, this.carStates.get(carId) ?? state);
    return `${car.name}: executed`;
  }
}
