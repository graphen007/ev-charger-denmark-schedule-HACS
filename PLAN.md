# EV Smart Charging — HA Addon Plan

## Overview

A Home Assistant addon that runs 24/7 and automatically charges EVs based on Danish
electricity prices. It exposes an Ingress web UI, controls EV charging switches via HA,
and supports multiple cars with independent modes and schedules.

**Why addon over HACS Lovelace card:**
- Runs 24/7 — no browser open required, plug in car and it charges automatically
- Full Node.js backend with real logging, session history, and proper scheduling
- Persistent storage in `/data/` on the HA host
- Ingress web UI unconstrained by Lovelace card sizing

---

## Architecture

```
addon/
  config.yaml            HA addon manifest — ingress port 8099
  Dockerfile             node:20-alpine, build TS + bundle UI
  run.sh
  package.json
  tsconfig.json
  src/
    index.ts             Startup + wiring
    haClient.ts          HA WebSocket: auth, state_changed, callService
    priceClient.ts       Price sources: ENTSO-E (with token) or elprisenligenu.dk (fallback)
    tariffs.ts           N1 tariff tiers + effectivePrice calculation
    planner.ts           buildChargePlan + planSummary
    settings.ts          /data/settings.json load/save
    sessionLog.ts        /data/sessions.json — charging session history
    controller.ts        Plug events, fast charger detection, 5-min tick loop
    notifier.ts          HA push notifications
    web.ts               Express REST API + WebSocket + static /ui
  ui/
    index.html
    app.js               SPA with Chart.js, 4 views
    styles.css
```

---

## UI — 4-panel SPA

### Dashboard
- All-cars status row: SoC, plug/charging status, mode badge, next charge time
- Live price strip: current / lowest today / highest today / rank / tomorrow forecast
- 48h Chart.js bar chart: price bars with charging slots highlighted green
- Smart actions tip: best time reasoning, solar hint, savings vs peak

### Plan
- Mode selector (Cheapest Hours / Below Threshold / Departure Plan / Charge Now / Solar Surplus / Off)
- Settings sliders per mode (hours, threshold, departure time, target SoC, charge limit)
- Schedule chart: same Chart.js bar chart, green = scheduled charging, grey = idle, faded = past
- Estimate: kWh added, final SoC, estimated cost
- Execute now button

### History
- Per-car charging session log (date, kWh, cost, avg price, duration)
- Monthly summary bar chart
- Savings vs always charging at peak

### Settings
- Add / edit / remove cars with searchable HA entity pickers
- Car diagnostic test: reads all sensor states and reports ok/fail per entity
- Tariff configuration (N1 tiers, Energinet, elafgift, supplier) — defaults for Sabro/DK1 2025
- Price source toggle: elprisenligenu.dk (no key) or ENTSO-E (free token)
- Notification preferences

---

## Charging Modes

| Mode            | Behaviour |
|-----------------|-----------|
| Cheapest Hours  | Charge during the N cheapest 15-min slots today (slider: 1–12 hrs) |
| Below Threshold | Charge whenever effective price is below a set ceiling (DKK/kWh) |
| Departure Plan  | Charge the cheapest slots before a set departure time to reach target SoC |
| Charge Now      | Always charge while plugged in |
| Solar Surplus   | Charge when solar export exceeds a threshold |
| Off             | Stop charging immediately on Execute |

---

## Price Sources

1. **elprisenligenu.dk** — no API key required, returns DKK/kWh directly, verified working
2. **ENTSO-E** — free token from transparency.entsoe.eu, returns EUR/MWh XML, converted with configurable EUR/DKK rate
3. **HA Nord Pool integration** — auto-detected if a `nordpool` sensor with `raw_today` attribute exists

Effective price = spot * 1.25 (VAT) + N1 tariff + Energinet + elafgift + supplier add-on

---

## API

```
GET    /api/status                  All cars status, current plans
GET    /api/ha/entities             HA entity list for Settings dropdowns
GET    /api/settings                Full settings (cars, tariffs, notifications)
POST   /api/settings                Full settings save
POST   /api/settings/cars           Add car
PUT    /api/settings/cars/:carId    Edit car
DELETE /api/settings/cars/:carId    Remove car
POST   /api/settings/tariffs        Save tariff config
POST   /api/settings/notifications  Save notification prefs
GET    /api/car/:carId/settings     Per-car charge settings
POST   /api/car/:carId/settings     Save + immediately rebuild plan
GET    /api/car/:carId/test         Diagnostic: read all entity states
GET    /api/plan/:carId             15-min plan array
POST   /api/execute/:carId          Force control loop now
GET    /api/prices                  Today + tomorrow slots with effective prices
GET    /api/forecast                Price forecast
GET    /api/history                 Charging session log
POST   /api/refresh                 Force price fetch
WS     /ws                          Real-time push: plan_updated, status, new prices
```

---

## Data Model

```json
// /data/settings.json
{
  "area": "DK1",
  "entso_e_token": "",
  "eur_dkk_rate": 7.46,
  "tariffs": { "low": 0.11, "high_winter": 0.32, "high_summer": 0.17,
               "peak_winter": 0.97, "peak_summer": 0.43,
               "energinet": 0.21, "elafgift": 0.0, "supplier": 0.0 },
  "notifications": { "price_published": true, "charge_complete": true, "price_spike": false, "spike_threshold": 3.0 },
  "cars": [
    {
      "id": "kia_pv5",
      "name": "Kia PV5",
      "battery_kwh": 71.2,
      "charge_kw": 9.5,
      "charging_switch": "switch.pv5_ev_charging",
      "soc_entity": "sensor.pv5_ev_battery_level",
      "plug_entity": "binary_sensor.pv5_ev_battery_plug",
      "power_entity": "sensor.pv5_ev_charging_power",
      "charge_limit_entity": "number.pv5_ev_charging_limit",
      "solar_power_entity": "",
      "consumption_entity": ""
    }
  ],
  "carSettings": {
    "kia_pv5": { "mode": "Cheapest Hours", "cheapest_hours": 4, "price_threshold": 0.5,
                 "departure_time": "07:00", "target_soc": 80, "charge_limit": 100 }
  }
}
```

---

## Known Limitations / Next Steps

- Price data requires either HA Nord Pool integration, elprisenligenu.dk (auto), or an ENTSO-E token
- Solar Surplus mode reads entities but does not yet blend with Cheapest Hours as a hybrid fallback
- CO2 tracking not yet implemented in session log
- Forecast view shows static placeholder — wind/CO2 index not yet wired up
- Notifications implemented but require HA `notify` service to be configured
