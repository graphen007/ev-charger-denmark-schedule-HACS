# EV Smart Charging Denmark

A HACS Lovelace card for smart EV charging scheduling based on Danish Nord Pool electricity prices with N1 network tariff support.

## Features

- **Multiple cars** — add as many cars as you want in the card config; each has its own saved settings
- **5 charging modes:**
  - **Lad nu** — always charge
  - **Billigste timer** — charge during the N cheapest hours of the day
  - **Under grænse** — charge when effective price is below your threshold
  - **Afgang-plan** — reach a target SoC% by your departure time using the cheapest available slots
  - **Slukket** — manual override off
- **Charge plan visualisation** — colour-coded hourly timeline bar + expandable hour-by-hour table
- **Estimate summary** — kWh added, final SoC%, estimated cost
- **Live price widget** — current / today's lowest / today's highest
- **Automatic charging control** — turns `switch.pv5_ev_charging` on/off based on the active plan
- **N1 nettarif C 2025** built-in (configurable for other grid operators)
- **Works without HA integration** — cars without HA entities use manual SoC entry

## Installation

### HACS (recommended)
1. Open HACS → Frontend → ⋮ → Custom repositories
2. Add `https://github.com/graphen007/ev-charger-denmark-schedule-HACS` as **Lovelace**
3. Install "EV Smart Charging Denmark"
4. Add the resource in Settings → Dashboards → Resources (or HACS does it automatically)

### Manual
1. Copy `dist/ev-smart-charging-card.js` to `<config>/www/ev-smart-charging-card.js`
2. Add resource: `/local/ev-smart-charging-card.js` (JavaScript Module)

## Card Configuration

```yaml
type: custom:ev-smart-charging-card
nordpool_entity: sensor.nord_pool_dk1_current_price
nordpool_config_entry: YOUR_CONFIG_ENTRY_ID
area: DK1
charger_speed_kw: 9.5

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
    # No entities = manual SoC entry, no automatic charging control
```

### Adding a new car

Just add a new entry under `cars:`. Settings are automatically saved per car ID.

```yaml
  - id: my_new_car
    name: My New Car
    battery_kwh: 60.0
    charge_kw: 9.5
    soc_entity: sensor.my_car_battery    # optional
    charging_switch: switch.my_charger   # optional
```

### Tariff override (optional)

Default tariffs are N1 Nettarif C 2025 for DK1 (Sabro area). Override with:

```yaml
tariffs:
  low: 0.11           # 00:00–06:00 DKK/kWh (incl. VAT)
  high_summer: 0.17   # 06:00–17:00 + 21:00–24:00 Apr–Sep
  high_winter: 0.32   # 06:00–17:00 + 21:00–24:00 Oct–Mar
  peak_summer: 0.43   # 17:00–21:00 Apr–Sep
  peak_winter: 0.97   # 17:00–21:00 Oct–Mar
```

## Finding your Nord Pool config_entry ID

In Home Assistant: Settings → Devices & Services → Nord Pool → (click the integration) → the URL contains the config entry ID, e.g. `01JPXHZEN9W8XZQYT223BPTEGC`.

## How it works

The card fetches today's 15-minute price slots via `nordpool.get_prices_for_date`, adds the N1 network tariff and 25% VAT to each slot, then applies your chosen charging mode to build a charge plan. It runs a background check every 5 minutes to turn your charger on or off based on the current slot in the plan.

Per-car settings are saved to `input_text.ev_settings_{car_id}` helpers in HA so your configuration survives page reloads.

## Requirements

- Home Assistant 2024.1+
- [Nord Pool integration](https://www.home-assistant.io/integrations/nordpool/)

## License

MIT
