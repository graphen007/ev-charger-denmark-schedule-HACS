import { css } from "lit";

export const cardStyles = css`
  :host {
    display: block;
    font-family: var(--paper-font-body1_-_font-family, sans-serif);
    max-width: 720px;
    margin: 16px auto;
  }

  ha-card {
    padding: 16px;
    overflow: hidden;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  .card-title {
    font-size: 1.2em;
    font-weight: 600;
    color: var(--primary-text-color);
  }

  .refresh-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--secondary-text-color);
    padding: 4px;
    border-radius: 50%;
    transition: background 0.2s;
  }

  .refresh-btn:hover {
    background: var(--secondary-background-color);
  }

  /* ---- Car selector ---- */
  .car-selector {
    margin-bottom: 16px;
  }

  .car-selector select {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--divider-color);
    border-radius: 8px;
    background: var(--card-background-color);
    color: var(--primary-text-color);
    font-size: 1em;
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    padding-right: 32px;
  }

  /* ---- Status panel ---- */
  .status-panel {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 16px;
  }

  .stat-card {
    background: var(--secondary-background-color);
    border-radius: 10px;
    padding: 12px;
    text-align: center;
  }

  .stat-value {
    font-size: 1.6em;
    font-weight: 700;
    color: var(--primary-text-color);
    line-height: 1.2;
  }

  .stat-label {
    font-size: 0.75em;
    color: var(--secondary-text-color);
    margin-top: 2px;
  }

  .soc-bar-wrap {
    grid-column: 1 / -1;
    background: var(--secondary-background-color);
    border-radius: 10px;
    padding: 12px 14px;
  }

  .soc-bar-label {
    display: flex;
    justify-content: space-between;
    font-size: 0.8em;
    color: var(--secondary-text-color);
    margin-bottom: 6px;
  }

  .soc-bar {
    height: 14px;
    border-radius: 7px;
    background: var(--divider-color);
    overflow: hidden;
  }

  .soc-bar-fill {
    height: 100%;
    border-radius: 7px;
    background: var(--success-color, #4caf50);
    transition: width 0.5s ease;
  }

  .soc-bar-fill.low {
    background: var(--warning-color, #ff9800);
  }

  .soc-bar-fill.critical {
    background: var(--error-color, #f44336);
  }

  .manual-soc-row {
    grid-column: 1 / -1;
    background: var(--secondary-background-color);
    border-radius: 10px;
    padding: 12px 14px;
  }

  .manual-soc-row label {
    font-size: 0.85em;
    color: var(--secondary-text-color);
    display: block;
    margin-bottom: 6px;
  }

  .manual-soc-row input[type="range"] {
    width: 100%;
    accent-color: var(--primary-color);
  }

  .manual-soc-value {
    text-align: right;
    font-size: 0.85em;
    color: var(--primary-text-color);
    margin-top: 4px;
  }

  .no-integration-note {
    grid-column: 1 / -1;
    font-size: 0.8em;
    color: var(--secondary-text-color);
    background: var(--secondary-background-color);
    border-radius: 8px;
    padding: 8px 12px;
    text-align: center;
  }

  /* ---- Mode selector ---- */
  .section-label {
    font-size: 0.8em;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--secondary-text-color);
    margin: 14px 0 8px;
  }

  .mode-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 14px;
  }

  .mode-btn {
    padding: 10px 4px;
    border: 2px solid var(--divider-color);
    border-radius: 10px;
    background: var(--card-background-color);
    color: var(--primary-text-color);
    font-size: 0.8em;
    text-align: center;
    cursor: pointer;
    transition: all 0.15s;
    line-height: 1.3;
  }

  .mode-btn.active {
    border-color: var(--primary-color);
    background: var(--primary-color);
    color: var(--text-primary-color, #fff);
    font-weight: 600;
  }

  /* ---- Settings panel ---- */
  .settings-panel {
    background: var(--secondary-background-color);
    border-radius: 10px;
    padding: 14px;
    margin-bottom: 14px;
  }

  .setting-row {
    margin-bottom: 14px;
  }

  .setting-row:last-child {
    margin-bottom: 0;
  }

  .setting-row label {
    display: flex;
    justify-content: space-between;
    font-size: 0.85em;
    color: var(--secondary-text-color);
    margin-bottom: 6px;
  }

  .setting-row label span {
    font-weight: 600;
    color: var(--primary-text-color);
  }

  .setting-row input[type="range"] {
    width: 100%;
    accent-color: var(--primary-color);
  }

  .setting-row input[type="time"],
  .setting-row input[type="number"] {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid var(--divider-color);
    border-radius: 8px;
    background: var(--card-background-color);
    color: var(--primary-text-color);
    font-size: 0.95em;
    box-sizing: border-box;
  }

  /* ---- Estimate ---- */
  .estimate-box {
    background: var(--primary-color);
    color: var(--text-primary-color, #fff);
    border-radius: 10px;
    padding: 14px;
    margin-bottom: 14px;
  }

  .estimate-box.loading {
    background: var(--secondary-background-color);
    color: var(--secondary-text-color);
  }

  .estimate-title {
    font-size: 0.8em;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0.85;
    margin-bottom: 8px;
  }

  .estimate-main {
    font-size: 1.4em;
    font-weight: 700;
    margin-bottom: 4px;
  }

  .estimate-sub {
    font-size: 0.85em;
    opacity: 0.9;
  }

  .estimate-stats {
    display: flex;
    gap: 16px;
    margin-top: 8px;
    flex-wrap: wrap;
  }

  .estimate-stat {
    font-size: 0.8em;
    opacity: 0.9;
  }

  /* ---- Timeline ---- */
  .timeline-wrap {
    margin-bottom: 14px;
  }

  .timeline-bar {
    display: flex;
    height: 28px;
    border-radius: 8px;
    overflow: hidden;
    gap: 1px;
  }

  .timeline-slot {
    flex: 1;
    min-width: 1px;
    background: var(--divider-color);
    transition: background 0.3s;
  }

  .timeline-slot.past {
    opacity: 0.3;
  }

  .timeline-slot.charging {
    background: var(--primary-color);
  }

  .timeline-slot.charging.cheap {
    background: var(--success-color, #4caf50);
  }

  .timeline-slot.charging.peak {
    background: var(--warning-color, #ff9800);
  }

  .timeline-day-label {
    font-size: 0.78em;
    font-weight: 600;
    color: var(--secondary-text-color);
    margin: 10px 0 4px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .day-header-row td {
    font-size: 0.78em;
    font-weight: 600;
    color: var(--secondary-text-color);
    padding: 8px 6px 2px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .past-row {
    opacity: 0.4;
  }

  .timeline-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.7em;
    color: var(--secondary-text-color);
    margin-top: 4px;
    padding: 0 2px;
  }

  /* ---- Hour table ---- */
  .price-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.82em;
    margin-bottom: 8px;
  }

  .price-table th {
    text-align: left;
    color: var(--secondary-text-color);
    font-weight: 600;
    padding: 4px 6px;
    border-bottom: 1px solid var(--divider-color);
  }

  .price-table td {
    padding: 6px 6px;
    border-bottom: 1px solid var(--divider-color);
    color: var(--primary-text-color);
  }

  .price-table tr.charging-row td {
    background: var(--primary-color);
    color: var(--text-primary-color, #fff);
  }

  .price-table tr.now-row td {
    font-weight: 700;
  }

  .charge-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--success-color, #4caf50);
    margin-right: 4px;
  }

  .table-toggle {
    background: none;
    border: none;
    color: var(--primary-color);
    font-size: 0.82em;
    cursor: pointer;
    padding: 6px 0;
    width: 100%;
    text-align: center;
  }

  /* ---- Price widget ---- */
  .price-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
    margin-top: 14px;
  }

  .price-chip {
    background: var(--secondary-background-color);
    border-radius: 8px;
    padding: 10px 8px;
    text-align: center;
  }

  .price-chip-label {
    font-size: 0.7em;
    color: var(--secondary-text-color);
    margin-bottom: 4px;
  }

  .price-chip-value {
    font-size: 1em;
    font-weight: 700;
    color: var(--primary-text-color);
  }

  /* ---- Other cars status strip ---- */
  .other-cars-strip {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    padding: 8px 16px 4px;
  }
  .other-car-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--secondary-background-color);
    border: 1px solid var(--divider-color, rgba(255,255,255,.1));
    border-radius: 20px;
    padding: 5px 12px;
    cursor: pointer;
    font-size: 0.82em;
    transition: background 0.15s;
  }
  .other-car-chip:hover {
    background: var(--primary-color, #03a9f4);
    color: white;
  }
  .other-car-name { font-weight: 600; }
  .other-car-soc { opacity: .75; }
  .other-car-mode { opacity: .65; font-style: italic; }
  .other-car-status.oc-charging { color: #4caf50; }
  .other-car-next { opacity: .6; font-size: .9em; }

  /* ---- Price strip ---- */
  .price-strip {
    display: flex;
    align-items: stretch;
    background: var(--secondary-background-color);
    border-radius: 10px;
    margin-bottom: 4px;
    overflow: hidden;
  }

  .price-strip-item {
    flex: 1;
    padding: 10px 8px;
    text-align: center;
  }

  .price-strip-divider {
    width: 1px;
    background: var(--divider-color);
    margin: 8px 0;
  }

  .ps-label { font-size: 0.68em; color: var(--secondary-text-color); margin-bottom: 2px; }
  .ps-value { font-size: 1.1em; font-weight: 700; color: var(--primary-text-color); }
  .ps-unit  { font-size: 0.65em; color: var(--secondary-text-color); }

  .price-cheap .ps-value { color: var(--success-color, #4caf50); }
  .price-peak  .ps-value { color: var(--error-color, #f44336); }
  .price-mid   .ps-value { color: var(--warning-color, #ff9800); }

  /* ---- Smart tip ---- */
  .smart-tip {
    background: color-mix(in srgb, var(--primary-color) 12%, transparent);
    border-left: 3px solid var(--primary-color);
    border-radius: 0 8px 8px 0;
    padding: 8px 12px;
    font-size: 0.82em;
    color: var(--primary-text-color);
    margin-bottom: 10px;
    line-height: 1.4;
  }

  /* ---- Combined SVG chart ---- */
  .combined-chart-wrap {
    margin: 14px 0 4px;
  }

  .combined-svg {
    width: 100%;
    height: auto;
    display: block;
    color: var(--primary-text-color);
    overflow: visible;
  }

  .chart-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    font-size: 0.72em;
    color: var(--secondary-text-color);
    margin-top: 6px;
    padding: 0 4px;
  }

  .legend-item { display: flex; align-items: center; gap: 5px; }

  .legend-swatch {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .legend-line-swatch {
    display: inline-block;
    width: 18px;
    height: 3px;
    background: #2196f3;
    border-radius: 2px;
    flex-shrink: 0;
  }
  .execute-wrap {
    margin: 12px 0 4px;
    text-align: center;
  }

  .execute-btn {
    width: 100%;
    padding: 14px;
    background: var(--primary-color);
    color: var(--text-primary-color, #fff);
    border: none;
    border-radius: 10px;
    font-size: 1em;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.2s;
  }

  .execute-btn:disabled { opacity: 0.5; cursor: default; }
  .execute-btn.executing { opacity: 0.7; }

  .action-status {
    margin-top: 8px;
    font-size: 0.85em;
    padding: 6px 10px;
    border-radius: 6px;
    background: var(--secondary-background-color);
    color: var(--primary-text-color);
  }

  .action-status.action-started { color: var(--success-color, #4caf50); }
  .action-status.action-stopped { color: var(--warning-color, #ff9800); }
  .action-status.action-ok { color: var(--info-color, #2196f3); }

  .auto-note {
    font-size: 0.72em;
    color: var(--secondary-text-color);
    margin-top: 4px;
  }

  /* ---- Next charge banner ---- */
  .next-charge {
    background: var(--secondary-background-color);
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 0.88em;
    color: var(--primary-text-color);
    margin-bottom: 10px;
  }

  .next-charge.charging-now {
    background: var(--success-color, #4caf50);
    color: #fff;
    font-weight: 600;
  }

  /* ---- Price bar chart ---- */
  .price-chart-wrap {
    margin: 14px 0 4px;
  }

  .chart-section {
    margin-top: 8px;
  }

  .chart-section-label {
    font-size: 0.75em;
    color: var(--secondary-text-color);
    margin-bottom: 4px;
  }

  .price-chart {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 64px;
  }

  .price-bar-col {
    flex: 1;
    height: 100%;
    display: flex;
    align-items: flex-end;
  }

  .price-bar-inner {
    width: 100%;
    border-radius: 3px 3px 0 0;
    background: var(--secondary-text-color, #888);
    transition: height 0.3s;
    opacity: 0.85;
  }

  .price-bar-inner.charging { background: var(--success-color, #4caf50); opacity: 1; }
  .price-bar-inner.past { opacity: 0.3; }
  .price-bar-inner.now { outline: 2px solid var(--primary-color); outline-offset: 1px; }

  .chart-axis {
    display: flex;
    justify-content: space-between;
    font-size: 0.68em;
    color: var(--secondary-text-color);
    margin-top: 2px;
  }

  /* ---- Savings highlight ---- */
  .savings {
    color: var(--success-color, #4caf50);
    font-weight: 600;
  }

  .price-chip-note {
    font-size: 0.68em;
    color: var(--secondary-text-color);
    text-align: center;
    margin-top: 4px;
    padding: 0 8px;
  }
  .error-box {
    background: var(--error-color, #f44336);
    color: #fff;
    border-radius: 8px;
    padding: 12px;
    font-size: 0.85em;
    margin-bottom: 12px;
  }

  .loading-spinner {
    text-align: center;
    color: var(--secondary-text-color);
    padding: 24px;
    font-size: 0.9em;
  }
`;
