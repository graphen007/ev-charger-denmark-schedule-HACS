import { LitElement, html, nothing } from "lit";
import { cardStyles } from "./styles.js";
import {
  loadCarSettings,
  saveCarSettings,
  fetchTodayAndTomorrowPrices,
  setCharging,
  getLiveSoC,
} from "./car-manager.js";
import {
  buildChargePlan,
  planSummary,
  DEFAULT_TARIFFS,
} from "./charge-planner.js";

const MODES = ["Charge Now", "Cheapest Hours", "Below Threshold", "Departure Plan", "Off"];

const VERSION = "1.0.0";

class EvSmartChargingCard extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      config: { type: Object },
      _selectedCarId: { type: String },
      _settings: { type: Object },
      _slots: { type: Array },
      _plan: { type: Array },
      _summary: { type: Object },
      _loading: { type: Boolean },
      _error: { type: String },
      _showTable: { type: Boolean },
      _lastAction: { type: String },
      _executing: { type: Boolean },
    };
  }

  static get styles() {
    return cardStyles;
  }

  constructor() {
    super();
    this._selectedCarId = null;
    this._settings = null;
    this._slots = [];
    this._plan = [];
    this._summary = null;
    this._loading = false;
    this._error = null;
    this._showTable = false;
    this._controlInterval = null;
    this._lastAction = null;
    this._executing = false;
  }

  setConfig(config) {
    if (!config.cars || config.cars.length === 0) {
      throw new Error("ev-smart-charging-card: 'cars' list is required in config.");
    }
    this.config = config;
    this._selectedCarId = config.cars[0].id;
  }

  get _cars() {
    return this.config?.cars ?? [];
  }

  get _selectedCar() {
    return this._cars.find((c) => c.id === this._selectedCarId) ?? this._cars[0];
  }

  get _tariffs() {
    return { ...DEFAULT_TARIFFS, ...(this.config?.tariffs ?? {}) };
  }

  get _currentSoC() {
    const car = this._selectedCar;
    const live = getLiveSoC(this.hass, car?.soc_entity);
    if (live !== null) return live;
    return this._settings?.manual_soc ?? 20;
  }

  async connectedCallback() {
    super.connectedCallback();
    this._startControlLoop();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._controlInterval) clearInterval(this._controlInterval);
  }

  _startControlLoop() {
    if (this._controlInterval) clearInterval(this._controlInterval);
    // Check every 5 minutes
    this._controlInterval = setInterval(() => this._runChargeControl(), 5 * 60 * 1000);
  }

  async updated(changedProps) {
    // When hass becomes available for the first time, load settings + prices
    if (changedProps.has("hass") && this.hass && !this._settings) {
      await this._loadAll();
    }
    // When hass updates, re-run control logic (entity state changes)
    if (changedProps.has("hass") && this.hass && this._settings && this._plan.length > 0) {
      this._runChargeControl();
    }
  }

  async _loadAll() {
    if (!this.hass || !this._selectedCarId) return;
    if (this._loading) return; // prevent concurrent loads
    this._loading = true;
    this._error = null;
    try {
      this._settings = loadCarSettings(this._selectedCarId);
      await this._fetchAndPlan();
    } catch (e) {
      this._error = `Error loading: ${e.message}`;
    } finally {
      this._loading = false;
    }
  }

  async _fetchAndPlan() {
    const car = this._selectedCar;
    const configEntry = this.config?.nordpool_config_entry;
    const area = this.config?.area ?? "DK1";
    if (!configEntry) {
      this._error = "Mangler nordpool_config_entry i kortets konfiguration.";
      return;
    }
    this._slots = await fetchTodayAndTomorrowPrices(this.hass, configEntry, area);
    this._rebuildPlan();
  }

  _rebuildPlan() {
    if (!this._settings || this._slots.length === 0) return;
    const car = this._selectedCar;
    const enrichedSettings = {
      ...this._settings,
      current_soc: this._currentSoC,
      battery_kwh: car?.battery_kwh ?? 71.2,
      charge_kw: car?.charge_kw ?? this.config?.charger_speed_kw ?? 9.5,
    };
    this._plan = buildChargePlan(this._slots, this._settings.mode, enrichedSettings, this._tariffs);
    this._summary = planSummary(this._plan, enrichedSettings);
  }

  async _runChargeControl() {
    if (!this._settings || !this._plan.length) return "No plan";
    const car = this._selectedCar;
    if (!car?.charging_switch) return "No charging switch configured";

    // Guard: don't act if car is not plugged in
    if (car.plug_entity) {
      const plugState = this.hass?.states[car.plug_entity]?.state;
      if (plugState !== "on") {
        const currentState = this.hass.states[car.charging_switch]?.state;
        if (currentState === "on") await setCharging(this.hass, car.charging_switch, false);
        return "🔌 Car not connected — no action";
      }
    }

    const now = new Date();
    const mode = this._settings?.mode;

    // "Charge Now" — bypass slot logic, just turn on immediately
    if (mode === "Charge Now") {
      const currentState = this.hass.states[car.charging_switch]?.state;
      if (currentState !== "on") {
        await setCharging(this.hass, car.charging_switch, true);
        return "▶ Charging started (Charge Now mode)";
      }
      return "✓ Already charging";
    }

    // Find the current 15-min slot by localDate
    const currentSlot = this._plan.find((s) => {
      return now >= s.localDate && now < new Date(s.localDate.getTime() + 15 * 60 * 1000);
    });

    if (!currentSlot) return "No slot for current time";

    const shouldCharge = currentSlot.charging;
    const currentState = this.hass.states[car.charging_switch]?.state;
    const isCharging = currentState === "on";
    const slotTime = this._formatTime(currentSlot.start);
    const ep = currentSlot.ep?.toFixed(2);

    if (shouldCharge && !isCharging) {
      await setCharging(this.hass, car.charging_switch, true);
      return `▶ Charging started (${slotTime}, ${ep} DKK/kWh)`;
    } else if (!shouldCharge && isCharging) {
      await setCharging(this.hass, car.charging_switch, false);
      return `⏸ Charging stopped (${slotTime}, ${ep} DKK/kWh — too expensive)`;
    } else if (shouldCharge && isCharging) {
      return `✓ Already charging (${slotTime}, ${ep} DKK/kWh)`;
    } else {
      return `– Not charging (${slotTime}, ${ep} DKK/kWh — not scheduled)`;
    }
  }

  async _onExecutePlan() {
    this._executing = true;
    this._lastAction = null;
    try {
      const result = await this._runChargeControl();
      this._lastAction = result;
    } catch (e) {
      this._lastAction = `Fejl: ${e.message}`;
    } finally {
      this._executing = false;
    }
  }

  async _onChargeLimitChange(value) {
    this._settings = { ...this._settings, charge_limit: value };
    saveCarSettings(this._selectedCarId, this._settings);
    const entity = this._selectedCar?.charge_limit_entity;
    if (entity) {
      await this.hass.callService("number", "set_value", { entity_id: entity, value });
    }
  }

  async _onCarChange(e) {
    this._selectedCarId = e.target.value;
    // Load settings immediately from localStorage (no async needed)
    this._settings = loadCarSettings(this._selectedCarId);
    this._plan = [];
    this._summary = null;
    // Then fetch prices for the new car
    this._loading = true;
    try {
      await this._fetchAndPlan();
    } catch (e2) {
      this._error = `Error loading: ${e2.message}`;
    } finally {
      this._loading = false;
    }
  }

  async _onModeChange(mode) {
    this._settings = { ...this._settings, mode };
    this._rebuildPlan();
    saveCarSettings(this._selectedCarId, this._settings);
  }

  async _onSettingChange(key, value) {
    this._settings = { ...this._settings, [key]: value };
    this._rebuildPlan();
    saveCarSettings(this._selectedCarId, this._settings);
  }

  async _onRefresh() {
    await this._loadAll();
  }

  // ---- Render helpers ----

  _formatTime(isoString) {
    const d = new Date(isoString);
    return d.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
  }

  _fmt(val, decimals = 2) {
    return val != null ? val.toFixed(decimals) : "–";
  }

  _socBarClass(soc) {
    if (soc < 20) return "critical";
    if (soc < 40) return "low";
    return "";
  }

  // ---- Render ----

  render() {
    if (!this.config) return nothing;

    return html`
      <ha-card>
        ${this._renderHeader()}
        ${this._error ? html`<div class="error-box">${this._error}</div>` : nothing}
        ${this._loading ? html`<div class="loading-spinner">Fetching prices…</div>` : html`
          ${this._renderCarSelector()}
          ${this._renderStatusPanel()}
          ${this._renderPriceStrip()}
          ${this._renderNextCharge()}
          ${this._renderModeSelector()}
          ${this._renderSettings()}
          ${this._renderEstimate()}
          ${this._renderSmartTip()}
          ${this._renderExecuteButton()}
          ${this._renderCombinedChart()}
          ${this._renderTableToggle()}
        `}
      </ha-card>
    `;
  }

  _renderHeader() {
    return html`
      <div class="card-header">
        <span class="card-title">EV Charge Planner</span>
        <button class="refresh-btn" @click=${this._onRefresh} title="Refresh prices">
          &#x21BB;
        </button>
      </div>
    `;
  }

  _renderCarSelector() {
    if (this._cars.length <= 1) return nothing;
    return html`
      <div class="car-selector">
        <select @change=${this._onCarChange} .value=${this._selectedCarId}>
          ${this._cars.map(
            (car) => html`<option value=${car.id} ?selected=${car.id === this._selectedCarId}>${car.name}</option>`
          )}
        </select>
      </div>
    `;
  }

  _renderStatusPanel() {
    const car = this._selectedCar;
    const soc = this._currentSoC;
    const hasLiveData = !!car?.soc_entity && getLiveSoC(this.hass, car.soc_entity) !== null;
    const rangeEntity = car?.soc_entity?.replace("battery_level", "ev_range");
    const range = rangeEntity ? parseFloat(this.hass?.states[rangeEntity]?.state) : null;
    const plugState = car?.plug_entity ? this.hass?.states[car.plug_entity]?.state : null;
    const power = car?.power_entity ? parseFloat(this.hass?.states[car.power_entity]?.state) : null;

    return html`
      <div class="status-panel">
        <div class="stat-card">
          <div class="stat-value">${soc != null ? Math.round(soc) : "–"}%</div>
          <div class="stat-label">Battery</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${range != null && !isNaN(range) ? Math.round(range) : "–"} km</div>
          <div class="stat-label">Range</div>
        </div>

        <div class="soc-bar-wrap">
          <div class="soc-bar-label">
            <span>${car?.name ?? "Car"}</span>
            <span>${plugState === "on" ? (power && power > 0 ? `Charging ${power} kW` : "Connected") : "Not connected"}</span>
          </div>
          <div class="soc-bar">
            <div class="soc-bar-fill ${this._socBarClass(soc)}" style="width:${Math.max(0, Math.min(100, soc ?? 0))}%"></div>
          </div>
        </div>

        ${!hasLiveData ? html`
          <div class="manual-soc-row">
            <label>Manual SoC (no HA integration)</label>
            <input type="range" min="0" max="100" step="1"
              .value=${String(this._settings?.manual_soc ?? 20)}
              @input=${(e) => this._onSettingChange("manual_soc", parseInt(e.target.value))}
            />
            <div class="manual-soc-value">${this._settings?.manual_soc ?? 20}%</div>
          </div>
          <div class="no-integration-note">No HA integration — charger cannot be controlled automatically</div>
        ` : nothing}
      </div>
    `;
  }

  _renderModeSelector() {
    const mode = this._settings?.mode ?? "Cheapest Hours";
    return html`
      <div class="section-label">Charging Mode</div>
      <div class="mode-grid">
        ${MODES.map(
          (m) => html`
            <button class="mode-btn ${mode === m ? "active" : ""}" @click=${() => this._onModeChange(m)}>
              ${m}
            </button>
          `
        )}
      </div>
    `;
  }

  _renderSettings() {
    const mode = this._settings?.mode;
    if (!mode || mode === "Charge Now" || mode === "Off") return nothing;

    return html`
      <div class="settings-panel">
        ${mode === "Cheapest Hours" ? html`
          <div class="setting-row">
            <label>Cheapest hours <span>${this._settings.cheapest_hours} hrs</span></label>
            <input type="range" min="1" max="12" step="1"
              .value=${String(this._settings.cheapest_hours ?? 4)}
              @input=${(e) => this._onSettingChange("cheapest_hours", parseInt(e.target.value))}
            />
          </div>
        ` : nothing}

        ${mode === "Below Threshold" ? html`
          <div class="setting-row">
            <label>Price ceiling <span>${this._fmt(this._settings.price_threshold)} DKK/kWh</span></label>
            <input type="range" min="0.10" max="5.00" step="0.05"
              .value=${String(this._settings.price_threshold ?? 0.5)}
              @input=${(e) => this._onSettingChange("price_threshold", parseFloat(e.target.value))}
            />
          </div>
        ` : nothing}

        ${mode === "Departure Plan" ? html`
          <div class="setting-row">
            <label>Departure time</label>
            <input type="time"
              .value=${this._settings.departure_time ?? "07:00"}
              @change=${(e) => this._onSettingChange("departure_time", e.target.value)}
            />
          </div>
          <div class="setting-row">
            <label>Target SoC at departure <span>${this._settings.target_soc ?? 80}%</span></label>
            <input type="range" min="30" max="100" step="5"
              .value=${String(this._settings.target_soc ?? 80)}
              @input=${(e) => this._onSettingChange("target_soc", parseInt(e.target.value))}
            />
          </div>
        ` : nothing}

        ${this._selectedCar?.charge_limit_entity ? html`
          <div class="setting-row">
            <label>AC charge limit <span>${this._settings.charge_limit ?? 80}%</span></label>
            <input type="range" min="50" max="100" step="5"
              .value=${String(this._settings.charge_limit ?? 80)}
              @input=${(e) => this._onChargeLimitChange(parseInt(e.target.value))}
            />
          </div>
        ` : nothing}
      </div>
    `;
  }

  _renderEstimate() {
    if (!this._summary || this._plan.length === 0) {
      return html`<div class="estimate-box loading">No charge plan — refresh or select a mode.</div>`;
    }
    const { kwh_added, final_soc, total_cost, cheapest_slot, priciest_slot, avg_ep } = this._summary;
    const mode = this._settings?.mode;
    const dep = this._settings?.departure_time ?? "07:00";
    const [depH, depM] = dep.split(":").map(Number);
    const depDate = new Date(); depDate.setHours(depH, depM, 0, 0);
    if (depDate <= new Date()) depDate.setDate(depDate.getDate() + 1);
    const depLabel = depDate.toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" });

    // Savings vs charging at worst price
    const car = this._selectedCar;
    const charge_kw = car?.charge_kw ?? this.config?.charger_speed_kw ?? 9.5;
    const chargingCount = this._plan.filter((s) => s.charging && !s.isPast).length;
    const worstCost = priciest_slot ? (priciest_slot.ep * charge_kw * chargingCount) / 4 : 0;
    const savings = worstCost - total_cost;

    return html`
      <div class="estimate-box">
        <div class="estimate-title">
          ${mode === "Departure Plan" ? `Estimate — depart ${depLabel}` : "Estimate — from now"}
        </div>
        <div class="estimate-main">+${this._fmt(kwh_added, 1)} kWh → ${Math.round(final_soc)}% SoC</div>
        <div class="estimate-sub">Estimated cost: ~${this._fmt(total_cost)} DKK
          ${savings > 0.01 ? html` · <span class="savings">save ~${this._fmt(savings)} DKK vs. peak hours</span>` : nothing}
        </div>
        <div class="estimate-stats">
          <span class="estimate-stat">Cheapest: ${this._fmt(cheapest_slot?.ep)} DKK/kWh (${cheapest_slot ? this._formatTime(cheapest_slot.start) : "–"})</span>
          <span class="estimate-stat">Most exp.: ${this._fmt(priciest_slot?.ep)} DKK/kWh</span>
          <span class="estimate-stat">Avg: ${this._fmt(avg_ep)} DKK/kWh</span>
        </div>
      </div>
    `;
  }

  _renderTimeline() {
    if (this._plan.length === 0) return nothing;

    const slots = this._plan; // use raw 15-min slots
    const allEp = slots.map((s) => s.ep);
    const minEp = Math.min(...allEp);
    const maxEp = Math.max(...allEp);
    const now = new Date();
    const todayStr = now.toDateString();

    const todaySlots = slots.filter((s) => s.localDate.toDateString() === todayStr);
    const tomorrowSlots = slots.filter((s) => s.localDate.toDateString() !== todayStr);

    const renderBar = (slotList) => slotList.map((s) => {
      const relEp = maxEp > minEp ? (s.ep - minEp) / (maxEp - minEp) : 0;
      const isNow = s.localDate <= now && now < new Date(s.localDate.getTime() + 15 * 60 * 1000);
      return html`<div
        class="timeline-slot ${s.isPast ? "past" : ""} ${s.charging ? "charging" : ""} ${s.charging && relEp < 0.33 ? "cheap" : ""} ${s.charging && relEp > 0.66 ? "peak" : ""}"
        title="${this._formatTime(s.start)}: ${this._fmt(s.ep)} DKK/kWh${s.charging ? " – charging" : ""}${s.isPast ? " (past)" : ""}"
        style="${isNow ? "outline: 2px solid var(--primary-text-color);" : ""}"
      ></div>`;
    });

    // Hour labels: one per 4 slots
    const renderLabels = (slotList) => {
      const hours = [];
      for (let i = 0; i < slotList.length; i += 4) {
        hours.push(slotList[i].localDate.getHours().toString().padStart(2, "0"));
      }
      const step = Math.ceil(hours.length / 6); // show ~6 labels max
      return html`<div class="timeline-labels">
        ${hours.filter((_, i) => i % step === 0 || i === hours.length - 1).map((h) => html`<span>${h}</span>`)}
      </div>`;
    };

    return html`
      <div class="timeline-wrap">
        <div class="section-label">Charge Plan</div>
        ${todaySlots.length ? html`
          <div class="timeline-day-label">${now.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} (today)</div>
          <div class="timeline-bar">${renderBar(todaySlots)}</div>
          ${renderLabels(todaySlots)}
        ` : nothing}
        ${tomorrowSlots.length ? html`
          <div class="timeline-day-label">${tomorrowSlots[0].localDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} (tomorrow)</div>
          <div class="timeline-bar">${renderBar(tomorrowSlots)}</div>
          ${renderLabels(tomorrowSlots)}
        ` : html`<div class="estimate-sub" style="margin:4px 16px;opacity:.6">Tomorrow's prices available ~13:00</div>`}
      </div>

      <button class="table-toggle" @click=${() => { this._showTable = !this._showTable; }}>
        ${this._showTable ? "Hide 15-min plan" : "Show 15-min plan"}
      </button>

      ${this._showTable ? this._renderTable(slots, now) : nothing}
    `;
  }

  _renderTable(slots, now) {
    let lastDay = null;
    return html`
      <table class="price-table">
        <thead>
          <tr><th>Time</th><th>DKK/kWh</th><th>Status</th></tr>
        </thead>
        <tbody>
          ${slots.map((s) => {
            const dayStr = s.localDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
            const dayHeader = dayStr !== lastDay ? ((lastDay = dayStr), html`<tr class="day-header-row"><td colspan="3">${dayStr}</td></tr>`) : nothing;
            const isNow = s.localDate <= now && now < new Date(s.localDate.getTime() + 15 * 60 * 1000);
            return html`
              ${dayHeader}
              <tr class="${s.isPast ? "past-row" : ""} ${s.charging ? "charging-row" : ""} ${isNow ? "now-row" : ""}">
                <td>${this._formatTime(s.start)}${isNow ? " ◀" : ""}</td>
                <td>${this._fmt(s.ep)}</td>
                <td>${s.isPast ? html`<span style="opacity:.4">–</span>` : s.charging ? html`<span class="charge-dot"></span>Charging` : "–"}</td>
              </tr>
            `;
          })}
        </tbody>
      </table>
    `;
  }

  _renderExecuteButton() {
    if (!this._selectedCar?.charging_switch) return nothing;
    const mode = this._settings?.mode;
    if (mode === "Off") return nothing;

    const car = this._selectedCar;
    const isPlugged = car.plug_entity ? this.hass?.states[car.plug_entity]?.state === "on" : true;

    const actionClass = this._lastAction?.startsWith("▶") ? "action-started"
      : this._lastAction?.startsWith("⏸") ? "action-stopped"
      : this._lastAction?.startsWith("✓") ? "action-ok"
      : this._lastAction ? "action-idle" : "";

    return html`
      <div class="execute-wrap">
        <button class="execute-btn ${this._executing ? "executing" : ""}"
          @click=${this._onExecutePlan}
          ?disabled=${this._executing || !this._plan.length || !isPlugged}>
          ${!isPlugged ? "🔌 Car not connected" : this._executing ? "⏳ Running…" : "▶ Execute plan now"}
        </button>
        ${this._lastAction ? html`<div class="action-status ${actionClass}">${this._lastAction}</div>` : nothing}
        <div class="auto-note">Runs automatically every 5 minutes</div>
      </div>
    `;
  }

  _renderPriceStrip() {
    if (!this._plan.length) return nothing;
    const now = new Date();
    const todaySlots = this._plan.filter((s) => s.localDate.toDateString() === now.toDateString());
    const currentSlot = todaySlots.find((s) => now >= s.localDate && now < new Date(s.localDate.getTime() + 15 * 60 * 1000));
    const lowest = todaySlots.length ? Math.min(...todaySlots.map((s) => s.ep)) : null;
    const highest = todaySlots.length ? Math.max(...todaySlots.map((s) => s.ep)) : null;
    const current = currentSlot?.ep ?? null;
    const pct = current != null && lowest != null && highest != null && highest > lowest
      ? Math.round(((current - lowest) / (highest - lowest)) * 100) : null;
    const priceClass = pct != null ? (pct < 33 ? "price-cheap" : pct < 66 ? "price-mid" : "price-peak") : "";

    return html`
      <div class="price-strip">
        <div class="price-strip-item ${priceClass}">
          <div class="ps-label">Now</div>
          <div class="ps-value">${current != null ? this._fmt(current) : "–"}</div>
          <div class="ps-unit">DKK/kWh</div>
        </div>
        <div class="price-strip-divider"></div>
        <div class="price-strip-item price-cheap">
          <div class="ps-label">Lowest today</div>
          <div class="ps-value">${lowest != null ? this._fmt(lowest) : "–"}</div>
          <div class="ps-unit">DKK/kWh</div>
        </div>
        <div class="price-strip-divider"></div>
        <div class="price-strip-item price-peak">
          <div class="ps-label">Highest today</div>
          <div class="ps-value">${highest != null ? this._fmt(highest) : "–"}</div>
          <div class="ps-unit">DKK/kWh</div>
        </div>
        ${pct != null ? html`
        <div class="price-strip-divider"></div>
        <div class="price-strip-item">
          <div class="ps-label">Price rank</div>
          <div class="ps-value ${priceClass}">${pct}%</div>
          <div class="ps-unit">of today's range</div>
        </div>` : nothing}
      </div>
      <div class="price-chip-note">All prices incl. N1 Nettarif C + Energinet tariffs</div>
    `;
  }

  _renderNextCharge() {
    if (!this._plan.length || this._settings?.mode === "Off") return nothing;
    const now = new Date();
    const currentSlot = this._plan.find((s) => now >= s.localDate && now < new Date(s.localDate.getTime() + 15 * 60 * 1000));

    if (currentSlot?.charging) {
      const stopSlot = this._plan.find((s) => !s.isPast && !s.charging && s.localDate > now);
      const stopLabel = stopSlot ? this._formatTime(stopSlot.start) : "–";
      return html`<div class="next-charge charging-now">⚡ Charging now — stops ~${stopLabel}</div>`;
    }

    const nextSlot = this._plan.find((s) => !s.isPast && s.charging && s.localDate > now);
    if (!nextSlot) return html`<div class="next-charge">No charging scheduled</div>`;

    const diff = nextSlot.localDate - now;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const label = h > 0 ? `${h}h ${m}min` : `${m} min`;
    const isTomorrow = nextSlot.localDate.toDateString() !== now.toDateString();

    return html`<div class="next-charge">
      ⏱ Next charge ${isTomorrow ? "tomorrow " : ""}at ${this._formatTime(nextSlot.start)} — in ${label} (${this._fmt(nextSlot.ep)} DKK/kWh)
    </div>`;
  }

  _renderSmartTip() {
    if (!this._plan.length || !this._summary) return nothing;
    const now = new Date();
    const mode = this._settings?.mode;
    const todaySlots = this._plan.filter((s) => !s.isPast && s.localDate.toDateString() === now.toDateString());
    const currentSlot = this._plan.find((s) => now >= s.localDate && now < new Date(s.localDate.getTime() + 15 * 60 * 1000));
    const sortedEp = [...todaySlots].sort((a, b) => a.ep - b.ep);
    const cheapest3 = sortedEp.slice(0, 3);
    const p25 = sortedEp[Math.floor(sortedEp.length * 0.25)]?.ep;

    // Tip: current slot is cheap but not charging
    if (currentSlot && !currentSlot.charging && currentSlot.ep <= (p25 ?? Infinity) && mode !== "Charge Now") {
      return html`<div class="smart-tip">💡 Current price (${this._fmt(currentSlot.ep)} DKK/kWh) is in the cheapest 25% today — consider switching to Charge Now or adding more hours.</div>`;
    }
    // Tip: very cheap window coming up soon
    const upcomingCheap = cheapest3.find((s) => !s.charging && s.localDate > now && (s.localDate - now) < 3 * 3600000);
    if (upcomingCheap && mode === "Off") {
      return html`<div class="smart-tip">💡 Cheap price window at ${this._formatTime(upcomingCheap.start)} (${this._fmt(upcomingCheap.ep)} DKK/kWh) — enable a charging mode to take advantage.</div>`;
    }
    // Tip: cheapest hours not all covered
    if (mode === "Cheapest Hours" && this._summary.final_soc < (this._settings?.charge_limit ?? 100) - 5) {
      const uncheduledCheap = cheapest3.filter((s) => !s.charging);
      if (uncheduledCheap.length) {
        return html`<div class="smart-tip">💡 Battery will reach ${Math.round(this._summary.final_soc)}% — increase Cheapest Hours to charge more during the cheap window (${this._fmt(uncheduledCheap[0].ep)} DKK/kWh at ${this._formatTime(uncheduledCheap[0].start)}).</div>`;
      }
    }
    return nothing;
  }

  _renderCombinedChart() {
    if (!this._plan.length) return nothing;

    const slots = this._plan;
    const now = new Date();
    const car = this._selectedCar;
    const battery_kwh = car?.battery_kwh ?? 71.2;
    const charge_kw = car?.charge_kw ?? 9.5;
    const charge_limit = this._settings?.charge_limit ?? 100;
    const current_soc = this._currentSoC ?? this._settings?.manual_soc ?? 20;

    // SVG viewport
    const VW = 1000, VH = 230;
    const ML = 46, MR = 46, MT = 12, MB = 30;
    const CW = VW - ML - MR, CH = VH - MT - MB;

    // Price scale (leave 10% headroom)
    const allEp = slots.map((s) => s.ep);
    const minEp = Math.min(...allEp);
    const maxEp = Math.max(...allEp);
    const epPad = (maxEp - minEp) * 0.1 || 0.1;
    const epMin = minEp - epPad, epMax = maxEp + epPad;

    const startMs = slots[0].localDate.getTime();
    const endMs = slots[slots.length - 1].localDate.getTime() + 15 * 60 * 1000;
    const totalMs = endMs - startMs;
    const barW = CW / slots.length;

    const toX = (ms) => ML + ((ms - startMs) / totalMs) * CW;
    const epToY = (ep) => MT + CH - ((ep - epMin) / (epMax - epMin)) * CH;
    const socToY = (soc) => MT + CH - (Math.min(100, Math.max(0, soc)) / 100) * CH;

    // SoC projection from now
    let projSoc = current_soc;
    const socPts = [];
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      if (!s.isPast) {
        if (socPts.length === 0) socPts.push([toX(now.getTime()), socToY(projSoc)]);
        socPts.push([ML + (i + 0.5) * barW, socToY(projSoc)]);
        if (s.charging) projSoc = Math.min(charge_limit, projSoc + (charge_kw * 0.25 / battery_kwh) * 100);
      }
    }
    if (socPts.length) socPts.push([ML + slots.length * barW, socToY(projSoc)]);
    const socPath = socPts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

    // Day separators
    const daySeps = [];
    let lastDay = null;
    slots.forEach((s, i) => {
      const d = s.localDate.toDateString();
      if (d !== lastDay) {
        if (lastDay) daySeps.push({ x: ML + i * barW, label: s.localDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) });
        lastDay = d;
      }
    });

    // Hour labels every 3h
    const xLabels = [];
    slots.forEach((s, i) => {
      if (s.localDate.getMinutes() === 0 && s.localDate.getHours() % 3 === 0) {
        xLabels.push({ x: ML + i * barW, label: s.localDate.getHours().toString().padStart(2, "0") + ":00" });
      }
    });

    // Price Y-axis ticks
    const priceTicks = [minEp, (minEp + maxEp) / 2, maxEp];
    const nowX = toX(now.getTime());
    const inRange = now.getTime() >= startMs && now.getTime() <= endMs;

    return html`
      <div class="combined-chart-wrap">
        <div class="section-label">Price & Charge Plan</div>
        <svg viewBox="0 0 ${VW} ${VH}" class="combined-svg" xmlns="http://www.w3.org/2000/svg">

          <!-- Grid lines -->
          ${priceTicks.map((ep) => html`<line
            x1="${ML}" y1="${epToY(ep).toFixed(1)}"
            x2="${ML + CW}" y2="${epToY(ep).toFixed(1)}"
            stroke="currentColor" stroke-width="0.5" stroke-dasharray="4,4" opacity="0.15"/>`)}

          <!-- SoC grid lines -->
          ${[25, 50, 75, 100].map((v) => html`<line
            x1="${ML}" y1="${socToY(v).toFixed(1)}"
            x2="${ML + CW}" y2="${socToY(v).toFixed(1)}"
            stroke="#2196f3" stroke-width="0.3" stroke-dasharray="2,6" opacity="0.2"/>`)}

          <!-- Price bars -->
          ${slots.map((s, i) => {
            const x = ML + i * barW;
            const h = Math.max(2, ((s.ep - epMin) / (epMax - epMin)) * CH);
            const y = MT + CH - h;
            const isNow = s.localDate <= now && now < new Date(s.localDate.getTime() + 15 * 60 * 1000);
            const fill = s.charging
              ? (s.ep < (minEp + (maxEp - minEp) * 0.33) ? "#4caf50" : s.ep > (minEp + (maxEp - minEp) * 0.66) ? "#ff9800" : "#66bb6a")
              : "currentColor";
            return html`<rect
              x="${x.toFixed(1)}" y="${y.toFixed(1)}"
              width="${Math.max(0.5, barW - 0.8).toFixed(1)}" height="${h.toFixed(1)}"
              fill="${fill}" opacity="${s.isPast ? 0.2 : s.charging ? 0.95 : 0.35}"
              rx="1">
              <title>${this._formatTime(s.start)}: ${this._fmt(s.ep)} DKK/kWh${s.charging ? " ⚡ charging" : ""}</title>
            </rect>
            ${isNow ? html`<rect x="${x.toFixed(1)}" y="${MT}" width="${barW.toFixed(1)}" height="${CH}"
              fill="none" stroke="white" stroke-width="1.5" opacity="0.6" rx="1"/>` : nothing}`;
          })}

          <!-- Day separators -->
          ${daySeps.map((d) => html`
            <line x1="${d.x.toFixed(1)}" y1="${MT}" x2="${d.x.toFixed(1)}" y2="${MT + CH}"
              stroke="currentColor" stroke-width="1" stroke-dasharray="3,3" opacity="0.3"/>
            <text x="${(d.x + 5).toFixed(1)}" y="${(MT + 14).toFixed(1)}"
              font-size="16" fill="currentColor" opacity="0.5">${d.label}</text>`)}

          <!-- Current time line -->
          ${inRange ? html`
            <line x1="${nowX.toFixed(1)}" y1="${MT}" x2="${nowX.toFixed(1)}" y2="${MT + CH + 4}"
              stroke="white" stroke-width="2" opacity="0.8"/>` : nothing}

          <!-- Charge limit dashed line -->
          <line x1="${ML}" y1="${socToY(charge_limit).toFixed(1)}"
            x2="${ML + CW}" y2="${socToY(charge_limit).toFixed(1)}"
            stroke="#2196f3" stroke-width="1.5" stroke-dasharray="6,3" opacity="0.5"/>
          <text x="${(ML + CW + 3).toFixed(1)}" y="${(socToY(charge_limit) + 5).toFixed(1)}"
            font-size="15" fill="#2196f3" opacity="0.8">${charge_limit}%</text>

          <!-- SoC projection line -->
          ${socPath ? html`<path d="${socPath}" fill="none" stroke="#2196f3" stroke-width="3"
            stroke-linejoin="round" stroke-linecap="round" opacity="0.85"/>` : nothing}

          <!-- Current SoC dot -->
          ${inRange && socPts.length ? html`<circle
            cx="${socPts[0][0].toFixed(1)}" cy="${socPts[0][1].toFixed(1)}"
            r="5" fill="#2196f3" opacity="0.9"/>` : nothing}

          <!-- Left Y-axis: price -->
          ${priceTicks.map((ep) => html`<text
            x="${(ML - 4).toFixed(1)}" y="${(epToY(ep) + 4).toFixed(1)}"
            font-size="16" fill="currentColor" text-anchor="end" opacity="0.6">${ep.toFixed(1)}</text>`)}
          <text x="${(ML - 4).toFixed(1)}" y="${(MT - 2).toFixed(1)}"
            font-size="13" fill="currentColor" text-anchor="end" opacity="0.45">DKK</text>

          <!-- Right Y-axis: SoC -->
          ${[0, 50, 100].map((v) => html`<text
            x="${(ML + CW + 4).toFixed(1)}" y="${(socToY(v) + 4).toFixed(1)}"
            font-size="16" fill="#2196f3" opacity="0.7">${v}%</text>`)}
          <text x="${(ML + CW + 4).toFixed(1)}" y="${(MT - 2).toFixed(1)}"
            font-size="13" fill="#2196f3" opacity="0.45">SoC</text>

          <!-- X-axis labels -->
          ${xLabels.map((l) => html`<text
            x="${l.x.toFixed(1)}" y="${(MT + CH + 20).toFixed(1)}"
            font-size="16" fill="currentColor" text-anchor="middle" opacity="0.5">${l.label}</text>`)}
        </svg>

        <div class="chart-legend">
          <span class="legend-item"><span class="legend-swatch" style="background:#4caf50"></span>Charging (cheap)</span>
          <span class="legend-item"><span class="legend-swatch" style="background:#ff9800"></span>Charging (peak)</span>
          <span class="legend-item"><span class="legend-swatch" style="background:currentColor;opacity:.35"></span>Not charging</span>
          <span class="legend-item"><span class="legend-line-swatch"></span>SoC projection</span>
        </div>
      </div>

      <button class="table-toggle" @click=${() => { this._showTable = !this._showTable; }}>
        ${this._showTable ? "Hide 15-min schedule" : "Show 15-min schedule"}
      </button>
      ${this._showTable ? this._renderTable() : nothing}
    `;
  }

  _renderTableToggle() { return nothing; } // handled inside _renderCombinedChart

  _renderTable() {
    const now = new Date();
    let lastDay = null;
    return html`
      <table class="price-table">
        <thead><tr><th>Time</th><th>DKK/kWh</th><th>Status</th></tr></thead>
        <tbody>
          ${this._plan.map((s) => {
            const dayStr = s.localDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
            const dayHeader = dayStr !== lastDay
              ? ((lastDay = dayStr), html`<tr class="day-header-row"><td colspan="3">${dayStr}</td></tr>`)
              : nothing;
            const isNow = s.localDate <= now && now < new Date(s.localDate.getTime() + 15 * 60 * 1000);
            return html`${dayHeader}
              <tr class="${s.isPast ? "past-row" : ""} ${s.charging ? "charging-row" : ""} ${isNow ? "now-row" : ""}">
                <td>${this._formatTime(s.start)}${isNow ? " ◀" : ""}</td>
                <td>${this._fmt(s.ep)}</td>
                <td>${s.isPast ? html`<span style="opacity:.4">–</span>` : s.charging ? html`<span class="charge-dot"></span>Charging` : "–"}</td>
              </tr>`;
          })}
        </tbody>
      </table>`;
  }

  // Legacy stubs — replaced by combined chart
  _renderPriceChart() { return nothing; }
  _renderTimeline() { return nothing; }
  _renderPriceWidget() { return nothing; }

  getCardSize() {
    return 8;
  }
}

customElements.define("ev-smart-charging-card", EvSmartChargingCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "ev-smart-charging-card",
  name: "EV Smart Charging Denmark",
  description: "Smart EV charging scheduler with Danish Nord Pool prices, N1 tariffs, and departure planning.",
  preview: false,
  documentationURL: "https://github.com/graphen007/ev-charger-denmark-schedule-HACS",
});

console.info(
  `%c EV-SMART-CHARGING-CARD %c v${VERSION} `,
  "background:#4caf50;color:#fff;font-weight:bold;padding:2px 4px;border-radius:3px 0 0 3px",
  "background:#1e1e1e;color:#4caf50;font-weight:bold;padding:2px 4px;border-radius:0 3px 3px 0"
);
