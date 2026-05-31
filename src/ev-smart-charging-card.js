import { LitElement, html, nothing } from "lit";
import { cardStyles } from "./styles.js";
import {
  loadCarSettings,
  saveCarSettings,
  fetchTodayPrices,
  setCharging,
  getLiveSoC,
} from "./car-manager.js";
import {
  buildChargePlan,
  planSummary,
  DEFAULT_TARIFFS,
} from "./charge-planner.js";

const MODES = ["Lad nu", "Billigste timer", "Under grænse", "Afgang-plan", "Slukket"];

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
    this._loading = true;
    this._error = null;
    try {
      // Load settings
      this._settings = await loadCarSettings(this.hass, this._selectedCarId);
      // Fetch prices
      await this._fetchAndPlan();
    } catch (e) {
      this._error = `Fejl ved indlæsning: ${e.message}`;
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
    this._slots = await fetchTodayPrices(this.hass, configEntry, area);
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
    if (!this._settings || !this._plan.length) return;
    const car = this._selectedCar;
    if (!car?.charging_switch) return;

    const now = new Date();
    const currentSlot = this._plan.find((s) => {
      const start = new Date(s.start);
      const end = new Date(start.getTime() + 15 * 60 * 1000);
      return now >= start && now < end;
    });

    if (!currentSlot) return;
    const shouldCharge = currentSlot.charging;
    const currentState = this.hass.states[car.charging_switch]?.state;
    const isCharging = currentState === "on";

    if (shouldCharge && !isCharging) {
      await setCharging(this.hass, car.charging_switch, true);
    } else if (!shouldCharge && isCharging) {
      await setCharging(this.hass, car.charging_switch, false);
    }
  }

  async _onCarChange(e) {
    this._selectedCarId = e.target.value;
    this._settings = null;
    this._plan = [];
    this._summary = null;
    await this._loadAll();
  }

  async _onModeChange(mode) {
    this._settings = { ...this._settings, mode };
    this._rebuildPlan();
    await saveCarSettings(this.hass, this._selectedCarId, this._settings);
  }

  async _onSettingChange(key, value) {
    this._settings = { ...this._settings, [key]: value };
    this._rebuildPlan();
    await saveCarSettings(this.hass, this._selectedCarId, this._settings);
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
        ${this._loading ? html`<div class="loading-spinner">Henter priser...</div>` : html`
          ${this._renderCarSelector()}
          ${this._renderStatusPanel()}
          ${this._renderModeSelector()}
          ${this._renderSettings()}
          ${this._renderEstimate()}
          ${this._renderTimeline()}
          ${this._renderPriceWidget()}
        `}
      </ha-card>
    `;
  }

  _renderHeader() {
    return html`
      <div class="card-header">
        <span class="card-title">EV Ladeplaner</span>
        <button class="refresh-btn" @click=${this._onRefresh} title="Opdater priser">
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
          <div class="stat-label">Batteri</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${range != null && !isNaN(range) ? Math.round(range) : "–"} km</div>
          <div class="stat-label">Rækkevidde</div>
        </div>

        <div class="soc-bar-wrap">
          <div class="soc-bar-label">
            <span>${car?.name ?? "Bil"}</span>
            <span>${plugState === "on" ? (power && power > 0 ? `Lader ${power} kW` : "Tilsluttet") : "Ikke tilsluttet"}</span>
          </div>
          <div class="soc-bar">
            <div class="soc-bar-fill ${this._socBarClass(soc)}" style="width:${Math.max(0, Math.min(100, soc ?? 0))}%"></div>
          </div>
        </div>

        ${!hasLiveData ? html`
          <div class="manual-soc-row">
            <label>Manuel SoC (ingen HA-integration)</label>
            <input type="range" min="0" max="100" step="1"
              .value=${String(this._settings?.manual_soc ?? 20)}
              @input=${(e) => this._onSettingChange("manual_soc", parseInt(e.target.value))}
            />
            <div class="manual-soc-value">${this._settings?.manual_soc ?? 20}%</div>
          </div>
          <div class="no-integration-note">Ingen HA-integration — ladestik kan ikke styres automatisk</div>
        ` : nothing}
      </div>
    `;
  }

  _renderModeSelector() {
    const mode = this._settings?.mode ?? "Billigste timer";
    return html`
      <div class="section-label">Ladetilstand</div>
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
    if (!mode || mode === "Lad nu" || mode === "Slukket") return nothing;

    return html`
      <div class="settings-panel">
        ${mode === "Billigste timer" ? html`
          <div class="setting-row">
            <label>Billigste timer <span>${this._settings.cheapest_hours} timer</span></label>
            <input type="range" min="1" max="12" step="1"
              .value=${String(this._settings.cheapest_hours ?? 4)}
              @input=${(e) => this._onSettingChange("cheapest_hours", parseInt(e.target.value))}
            />
          </div>
        ` : nothing}

        ${mode === "Under grænse" ? html`
          <div class="setting-row">
            <label>Prisloft <span>${this._fmt(this._settings.price_threshold)} kr/kWh</span></label>
            <input type="range" min="0.10" max="5.00" step="0.05"
              .value=${String(this._settings.price_threshold ?? 0.5)}
              @input=${(e) => this._onSettingChange("price_threshold", parseFloat(e.target.value))}
            />
          </div>
        ` : nothing}

        ${mode === "Afgang-plan" ? html`
          <div class="setting-row">
            <label>Afgangstidspunkt</label>
            <input type="time"
              .value=${this._settings.departure_time ?? "07:00"}
              @change=${(e) => this._onSettingChange("departure_time", e.target.value)}
            />
          </div>
          <div class="setting-row">
            <label>Mål-SoC ved afgang <span>${this._settings.target_soc ?? 80}%</span></label>
            <input type="range" min="50" max="100" step="5"
              .value=${String(this._settings.target_soc ?? 80)}
              @input=${(e) => this._onSettingChange("target_soc", parseInt(e.target.value))}
            />
          </div>
        ` : nothing}
      </div>
    `;
  }

  _renderEstimate() {
    if (!this._summary || this._plan.length === 0) {
      return html`<div class="estimate-box loading">Ingen ladeplan – opdater eller vælg en tilstand.</div>`;
    }
    const { kwh_added, final_soc, total_cost, cheapest_slot, priciest_slot, avg_ep } = this._summary;

    return html`
      <div class="estimate-box">
        <div class="estimate-title">Estimat – i dag</div>
        <div class="estimate-main">+${this._fmt(kwh_added, 1)} kWh → ${Math.round(final_soc)}% SoC</div>
        <div class="estimate-sub">Estimeret pris: ~${this._fmt(total_cost)} kr</div>
        <div class="estimate-stats">
          <span class="estimate-stat">Billigst: ${this._fmt(cheapest_slot?.ep)} kr/kWh (${cheapest_slot ? this._formatTime(cheapest_slot.start) : "–"})</span>
          <span class="estimate-stat">Dyrest: ${this._fmt(priciest_slot?.ep)} kr/kWh</span>
          <span class="estimate-stat">Snit: ${this._fmt(avg_ep)} kr/kWh</span>
        </div>
      </div>
    `;
  }

  _renderTimeline() {
    if (this._plan.length === 0) return nothing;

    // Build hourly groups (4 slots per hour)
    const hourGroups = [];
    for (let i = 0; i < this._plan.length; i += 4) {
      const group = this._plan.slice(i, i + 4);
      const charging = group.some((s) => s.charging);
      const avgEp = group.reduce((s, x) => s + x.ep, 0) / group.length;
      hourGroups.push({ start: group[0].start, charging, avgEp });
    }

    const allEp = hourGroups.map((g) => g.avgEp);
    const minEp = Math.min(...allEp);
    const maxEp = Math.max(...allEp);
    const now = new Date();

    return html`
      <div class="timeline-wrap">
        <div class="section-label">Ladeplan – ${new Date().toLocaleDateString("da-DK", { weekday: "short", day: "numeric", month: "short" })}</div>
        <div class="timeline-bar">
          ${hourGroups.map((g) => {
            const relEp = maxEp > minEp ? (g.avgEp - minEp) / (maxEp - minEp) : 0;
            const isPeak = relEp > 0.66;
            const isCheap = relEp < 0.33;
            const isNow = new Date(g.start) <= now && now < new Date(new Date(g.start).getTime() + 60 * 60 * 1000);
            return html`<div
              class="timeline-slot ${g.charging ? "charging" : ""} ${g.charging && isCheap ? "cheap" : ""} ${g.charging && isPeak ? "peak" : ""}"
              title="${this._formatTime(g.start)}: ${this._fmt(g.avgEp)} kr/kWh${g.charging ? " – LADER" : ""}"
              style="${isNow ? "outline: 2px solid var(--primary-text-color);" : ""}"
            ></div>`;
          })}
        </div>
        <div class="timeline-labels">
          <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span>
        </div>
      </div>

      <button class="table-toggle" @click=${() => { this._showTable = !this._showTable; }}>
        ${this._showTable ? "Skjul timeplan" : "Vis timeplan"}
      </button>

      ${this._showTable ? this._renderTable(hourGroups, now) : nothing}
    `;
  }

  _renderTable(hourGroups, now) {
    return html`
      <table class="price-table">
        <thead>
          <tr><th>Tid</th><th>kr/kWh</th><th>Status</th></tr>
        </thead>
        <tbody>
          ${hourGroups.map((g) => {
            const isNow = new Date(g.start) <= now && now < new Date(new Date(g.start).getTime() + 60 * 60 * 1000);
            return html`
              <tr class="${g.charging ? "charging-row" : ""} ${isNow ? "now-row" : ""}">
                <td>${this._formatTime(g.start)}${isNow ? " ←" : ""}</td>
                <td>${this._fmt(g.avgEp)}</td>
                <td>${g.charging ? html`<span class="charge-dot"></span>Lader` : "–"}</td>
              </tr>
            `;
          })}
        </tbody>
      </table>
    `;
  }

  _renderPriceWidget() {
    const currentEntity = this.config?.nordpool_entity;
    const currentPrice = currentEntity ? parseFloat(this.hass?.states[currentEntity]?.state) : null;

    const lowestEntity = currentEntity?.replace("current_price", "lowest_price");
    const highestEntity = currentEntity?.replace("current_price", "highest_price");
    const lowest = lowestEntity ? parseFloat(this.hass?.states[lowestEntity]?.state) : null;
    const highest = highestEntity ? parseFloat(this.hass?.states[highestEntity]?.state) : null;

    return html`
      <div class="price-row">
        <div class="price-chip">
          <div class="price-chip-label">Nu</div>
          <div class="price-chip-value">${currentPrice != null ? this._fmt(currentPrice) : "–"} kr</div>
        </div>
        <div class="price-chip">
          <div class="price-chip-label">Lavest i dag</div>
          <div class="price-chip-value">${lowest != null ? this._fmt(lowest) : "–"} kr</div>
        </div>
        <div class="price-chip">
          <div class="price-chip-label">Hoejest i dag</div>
          <div class="price-chip-value">${highest != null ? this._fmt(highest) : "–"} kr</div>
        </div>
      </div>
    `;
  }

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
