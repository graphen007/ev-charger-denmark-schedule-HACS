# EV Smart Charging Denmark

Smart EV charging automation for Home Assistant — **set it and forget it**.

> **v2.0 — HA Addon (recommended)** — runs 24/7 as a background service, survives HA restarts, no browser required.  
> v1.x Lovelace card is still available for those who prefer it (see [Card installation](#lovelace-card-v1) below).

---

## HA Addon v2.0 — Recommended

The addon runs as a native HA background service. Plug in your car and it automatically charges at the cheapest times. A built-in web UI (via HA Ingress) lets you configure everything without touching YAML.

### Features

- **Background charge control** — 5-minute tick loop checks current price slot and controls your charger switch, even when your browser is closed
- **6 charging modes:**
  - ⚡ **Charge Now** — start immediately
  - 💰 **Cheapest Hours** — charge during the N cheapest hours of the day
  - 🎯 **Below Threshold** — charge when effective price is below your ceiling
  - 🗓️ **Departure Plan** — reach target SoC% by departure time using cheapest slots
  - ☀️ **Solar Surplus** — charge when your solar panels produce enough surplus
  - 🔴 **Off** — manual override
- **15-minute slot resolution** — catches price spikes within the hour
- **Fast charger bypass** — DC charging is never interrupted by the addon
- **Multi-car parallel plans** — each car runs its own independent charge plan simultaneously
- **Price forecast** — wind capacity & CO₂ intensity from Energinet (no Nord Pool integration needed)
- **Session history** — kWh charged, estimated cost, average price per session
- **Push notifications** — tomorrow's prices published, charge complete, price spike alerts
- **Fully configurable via UI** — cars, tariffs, notifications, all entity dropdowns from your live HA

### Web UI panels

| Panel | Description |
|-------|-------------|
| **Dashboard** | All-cars SoC gauges, live charging status, 48h price+plan chart, price strip (Now / Lowest / Highest / Rank), smart suggestions |
| **Plan** | Per-car mode selector, sliders, cost estimate, execute button, collapsible 15-min schedule |
| **History** | Session table, monthly kWh bar chart, total cost & average price stats |
| **Settings** | Add/edit/remove cars with HA entity dropdowns, N1 tariff table, notification toggles |

### Addon installation

1. In Home Assistant: **Settings → Add-ons → Add-on Store**
2. Click **⋮** (three dots) → **Add custom repository**
3. Enter: `https://github.com/graphen007/ev-charger-denmark-schedule-HACS`
4. Find **EV Smart Charging Denmark** in the store → **Install**
5. Click **Start** — the addon appears in your HA sidebar

> The addon fetches electricity prices from the free [Energinet API](https://api.energidataservice.dk/) — no Nord Pool integration required.

### First-time setup

After installing, open the addon UI from the sidebar:

1. Go to **Settings** → click **+ Add car**
2. Fill in your car's name, battery size, and select HA entities from the dropdowns (charging switch, SoC sensor, plug sensor, power sensor)
3. Optionally set solar power / house consumption sensors for Solar Surplus mode
4. Go to **Plan** → choose a charging mode and click **▶ Execute plan now** to start immediately
5. From then on, the addon controls charging automatically

### Tariffs

Default tariffs are **N1 Nettarif C 2025** for DK1 (Sabro area) including 25% VAT. Adjust in **Settings → Tariffs** if you're on a different grid operator or tariff zone.

| Period | Default (DKK/kWh) |
|--------|-------------------|
| 00–06h (low) | 0.11 |
| 06–17h + 21–24h, summer | 0.17 |
| 06–17h + 21–24h, winter | 0.32 |
| 17–21h, summer (peak) | 0.43 |
| 17–21h, winter (peak) | 0.97 |
| Energinet (fixed) | 0.21 |
| EV elafgift (exempt) | 0.00 |

### Requirements (addon)

- Home Assistant OS or Supervised (2024.1+)
- No additional integrations required — prices come directly from Energinet

---

## Lovelace Card v1

The original HACS Lovelace card (v1.0.7) is still available. It runs in your browser and is suitable if you only need to control charging while viewing the dashboard.

### Card installation (HACS)

1. Open HACS → Frontend → ⋮ → Custom repositories
2. Add `https://github.com/graphen007/ev-charger-denmark-schedule-HACS` as **Lovelace**
3. Install "EV Smart Charging Denmark"
4. Add to a Lovelace dashboard:

```yaml
type: custom:ev-smart-charging-card
nordpool_config_entry: YOUR_CONFIG_ENTRY_ID   # Settings → Devices → Nord Pool → URL
area: DK1

cars:
  - id: kia_pv5
    name: Kia PV5
    battery_kwh: 71.2
    charge_kw: 9.5
    soc_entity: sensor.pv5_ev_battery_level
    charging_switch: switch.pv5_ev_charging
    plug_entity: binary_sensor.pv5_ev_battery_plug
    power_entity: sensor.pv5_ev_charging_power

  - id: peugeot_3008
    name: Peugeot 3008
    battery_kwh: 73.0
    charge_kw: 9.5
    # No entities = manual SoC entry
```

### Card manual installation

1. Copy `dist/ev-smart-charging-card.js` to `<config>/www/ev-smart-charging-card.js`
2. Add resource: `/local/ev-smart-charging-card.js` (JavaScript Module)

---

## How pricing works

Effective price = `spot × 1.25 (VAT) + N1 tariff + Energinet (0.21) + supplier add-on`

Prices are fetched in DKK/MWh and divided by 1000 for DKK/kWh. Tomorrow's prices are typically published at ~13:00 CET; the addon polls automatically.

## License

MIT
