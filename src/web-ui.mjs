export const AGENT_WEB_UI_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>QiuyuRemote Push Agent</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f3f6fa;
      --panel: #ffffff;
      --panel-2: #f6f8fb;
      --panel-3: #eef2f7;
      --text: #18202d;
      --muted: #647084;
      --border: #d9dee8;
      --accent: #0a84ff;
      --accent-strong: #0068d6;
      --ok: #2f9e44;
      --warn: #b56b00;
      --bad: #d92d20;
      --shadow: 0 18px 48px rgba(25, 37, 60, 0.10);
    }
    @media (prefers-color-scheme: dark) {
      html[data-theme="system"] {
        color-scheme: dark;
        --bg: #0b1118;
        --panel: #111b27;
        --panel-2: #162231;
        --panel-3: #1d2a3b;
        --text: #f0f5fb;
        --muted: #93a1b5;
        --border: #273548;
        --accent: #2f7dff;
        --accent-strong: #5e9cff;
        --ok: #46d477;
        --warn: #ffb020;
        --bad: #ff5f63;
        --shadow: 0 18px 52px rgba(0, 0, 0, 0.26);
      }
    }
    html[data-theme="dark"] {
      color-scheme: dark;
      --bg: #0b1118;
      --panel: #111b27;
      --panel-2: #162231;
      --panel-3: #1d2a3b;
      --text: #f0f5fb;
      --muted: #93a1b5;
      --border: #273548;
      --accent: #2f7dff;
      --accent-strong: #5e9cff;
      --ok: #46d477;
      --warn: #ffb020;
      --bad: #ff5f63;
      --shadow: 0 18px 52px rgba(0, 0, 0, 0.26);
    }
    * { box-sizing: border-box; }
    [hidden] { display: none !important; }
    body {
      margin: 0;
      font: 14px/1.42 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background:
        radial-gradient(circle at 18% -8%, color-mix(in srgb, var(--accent) 18%, transparent), transparent 34%),
        linear-gradient(180deg, color-mix(in srgb, var(--panel-2) 20%, var(--bg)), var(--bg) 360px);
      color: var(--text);
    }
    button, input, select {
      font: inherit;
    }
    button {
      min-height: 34px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--panel-2);
      color: var(--text);
      padding: 6px 12px;
      cursor: pointer;
      white-space: nowrap;
    }
    button:hover { border-color: var(--accent); }
    button.primary {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }
    button.primary:hover {
      background: var(--accent-strong);
      border-color: var(--accent-strong);
    }
    button.danger:hover { border-color: var(--accent); }
    button:disabled {
      cursor: wait;
      opacity: 0.62;
    }
    input, select {
      width: 100%;
      min-height: 34px;
      border-radius: 7px;
      border: 1px solid var(--border);
      background: var(--panel);
      color: var(--text);
      padding: 6px 10px;
      outline: none;
    }
    input:focus, select:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 16%, transparent);
    }
    input.needs-key {
      border-color: var(--warn);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--warn) 16%, transparent);
    }
    label {
      color: var(--muted);
    }
    .shell {
      width: min(1680px, 100%);
      margin: 0 auto;
      padding: 18px 24px 22px;
    }
    .agent-console {
      display: grid;
      gap: 14px;
    }
    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 18px;
      min-height: 54px;
    }
    .title-line {
      display: flex;
      align-items: center;
      gap: 9px;
      min-width: 0;
    }
    .title h1 {
      margin: 0;
      font-size: 25px;
      line-height: 1.1;
      letter-spacing: 0;
      white-space: nowrap;
    }
    .title p {
      margin: 4px 0 0;
      color: var(--muted);
      font-size: 13px;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      justify-content: flex-end;
      align-items: center;
    }
    .toolbar-wrap {
      display: grid;
      justify-items: end;
      gap: 7px;
      min-width: 0;
    }
    .top-meta {
      color: var(--muted);
      font-size: 13px;
      white-space: nowrap;
    }
    .top-meta a {
      color: inherit;
      text-decoration: none;
      border-bottom: 1px solid color-mix(in srgb, currentColor 32%, transparent);
    }
    .top-meta a:hover {
      color: var(--accent);
      border-bottom-color: currentColor;
    }
    .update-notice {
      max-width: 440px;
      padding: 7px 10px;
      border: 1px solid color-mix(in srgb, var(--warn) 42%, var(--border));
      border-radius: 8px;
      background: color-mix(in srgb, var(--warn) 12%, var(--panel));
      color: var(--warn);
      font-size: 13px;
      text-align: right;
      overflow-wrap: anywhere;
    }
    .update-notice a {
      color: inherit;
      font-weight: 700;
    }
    .toolbar select {
      width: auto;
      min-width: 124px;
    }
    .overview-grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 16px;
    }
    .stat-card {
      min-height: 118px;
      display: grid;
      grid-template-columns: 46px minmax(0, 1fr);
      gap: 12px;
      align-items: center;
      padding: 16px 18px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background:
        linear-gradient(145deg, color-mix(in srgb, var(--panel-3) 52%, transparent), transparent 115%),
        var(--panel);
      box-shadow: var(--shadow);
    }
    .stat-card:nth-child(2) .stat-icon {
      color: var(--ok);
      background: color-mix(in srgb, var(--ok) 16%, var(--panel-2));
    }
    .stat-card:nth-child(3) .stat-icon {
      color: #a66cff;
      background: color-mix(in srgb, #a66cff 16%, var(--panel-2));
    }
    .stat-card:nth-child(4) .stat-icon {
      color: var(--warn);
      background: color-mix(in srgb, var(--warn) 16%, var(--panel-2));
    }
    .stat-icon {
      width: 46px;
      height: 46px;
      display: grid;
      place-items: center;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: color-mix(in srgb, var(--accent) 16%, var(--panel-2));
      color: var(--accent);
      font-weight: 700;
      font-size: 19px;
    }
    .stat-content {
      min-width: 0;
    }
    .stat-label {
      color: var(--muted);
      font-size: 12px;
      margin-bottom: 4px;
    }
    .stat-value {
      font-size: 16px;
      font-weight: 700;
      line-height: 1.12;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .stat-note {
      color: var(--muted);
      font-size: 11px;
      margin-top: 7px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .stat-note .pill {
      background: color-mix(in srgb, var(--panel-3) 78%, transparent);
      border-color: color-mix(in srgb, currentColor 28%, var(--border));
      font-weight: 650;
    }
    .stat-subnote {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 8px;
      color: var(--muted);
      font-size: 11px;
      white-space: nowrap;
      min-width: 0;
    }
    .stat-subnote span {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .copy-button {
      width: 24px;
      height: 24px;
      min-height: 24px;
      display: inline-grid;
      place-items: center;
      flex: none;
      padding: 0;
      border-radius: 6px;
      color: var(--muted);
      background: transparent;
    }
    .copy-button:hover {
      color: var(--accent);
      background: color-mix(in srgb, var(--accent) 10%, transparent);
    }
    .copy-button svg {
      width: 15px;
      height: 15px;
      display: block;
    }
    .panel {
      border: 1px solid var(--border);
      border-radius: 8px;
      background:
        linear-gradient(150deg, color-mix(in srgb, var(--panel-3) 24%, transparent), transparent 78%),
        var(--panel);
      box-shadow: var(--shadow);
      overflow: hidden;
    }
    .panel-head {
      min-height: 54px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
      background: color-mix(in srgb, var(--panel-2) 78%, transparent);
    }
    .panel-head.tight {
      align-items: flex-start;
    }
    .panel-head h2 {
      margin: 0;
      font-size: 16px;
      line-height: 1.2;
      letter-spacing: 0;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .panel-head p {
      margin: 2px 0 0;
      color: var(--muted);
      font-size: 13px;
    }
    .panel-body {
      padding: 8px 10px;
    }
    .control-strip {
      display: grid;
      grid-template-columns: minmax(300px, .86fr) minmax(360px, .88fr) minmax(440px, 1.24fr);
      gap: 0;
      align-items: stretch;
      overflow: hidden;
      background:
        linear-gradient(140deg, color-mix(in srgb, var(--panel-3) 42%, transparent), transparent 120%),
        var(--panel);
    }
    .control-cell {
      display: grid;
      align-content: start;
      gap: 7px;
      min-width: 0;
      padding: 14px 18px;
      border-right: 1px solid var(--border);
    }
    .access-card {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
    }
    .access-card .cell-title,
    .access-card .cell-subtitle,
    .access-card .message {
      grid-column: 1 / -1;
    }
    .access-card .field-line {
      grid-column: 1;
    }
    .access-card .inline-actions {
      grid-column: 2;
      align-self: center;
    }
    .control-cell:last-child {
      border-right: 0;
    }
    .cell-title {
      font-weight: 700;
      font-size: 14px;
    }
    .cell-title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }
    .cell-subtitle {
      color: var(--muted);
      font-size: 13px;
      margin-top: -6px;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .compact-form {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 6px 8px;
      align-items: end;
    }
    .pair-card .compact-form {
      grid-template-columns: minmax(150px, .8fr) minmax(150px, .9fr) auto;
    }
    .pair-inline {
      display: grid;
      grid-template-columns: minmax(0, 330px) auto;
      grid-template-areas:
        "code action"
        "name action";
      gap: 10px;
      align-items: center;
    }
    .pair-inline .field-line:first-child {
      grid-area: code;
    }
    .pair-inline .field-line:nth-child(2) {
      grid-area: name;
    }
    .pair-inline #pairButton {
      grid-area: action;
      align-self: center;
    }
    .pair-card .field-line {
      grid-template-columns: 92px minmax(0, 1fr);
    }
    .diagnostics-control pre {
      max-height: 92px;
      min-height: 74px;
    }
    .field-line {
      display: grid;
      grid-template-columns: 92px minmax(0, 1fr);
      gap: 8px;
      align-items: center;
      min-width: 0;
    }
    .field-line span {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .inline-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      justify-content: flex-end;
    }
    .access-card .inline-actions {
      justify-content: flex-start;
      flex-wrap: nowrap;
    }
    .access-card .inline-actions button {
      padding-inline: 9px;
      font-size: 13px;
    }
    .message {
      min-height: 18px;
      color: var(--muted);
      grid-column: 1 / -1;
      overflow-wrap: anywhere;
    }
    .message.error { color: var(--bad); }
    .message.success { color: var(--ok); }
    .message.warning { color: var(--warn); }
    .meta {
      color: var(--muted);
      font-size: 12px;
      white-space: nowrap;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      min-height: 21px;
      padding: 2px 7px;
      border-radius: 999px;
      background: var(--panel);
      color: var(--muted);
      border: 1px solid var(--border);
      white-space: nowrap;
    }
    .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--muted);
      flex: none;
    }
    .ok .dot { background: var(--ok); }
    .warn .dot { background: var(--warn); }
    .bad .dot { background: var(--bad); }
    .ok { color: var(--ok); }
    .warn { color: var(--warn); }
    .bad { color: var(--bad); }
    .rows {
      display: grid;
      gap: 4px;
      min-width: 0;
    }
    .row {
      display: grid;
      grid-template-columns: 96px minmax(0, 1fr);
      gap: 7px;
      align-items: baseline;
      min-width: 0;
    }
    .row dt {
      color: var(--muted);
      margin: 0;
      white-space: nowrap;
    }
    .row dd {
      margin: 0;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .config-rows {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 7px 20px;
    }
    .config-rows .row {
      grid-template-columns: auto minmax(0, 1fr);
    }
    .config-rows .row dd,
    .relay-summary .row dd {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .relay-summary .row {
      grid-template-columns: auto minmax(0, 1fr);
    }
    .split-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(360px, .8fr);
      gap: 8px;
      align-items: stretch;
    }
    .split-grid > .panel {
      height: 100%;
    }
    .relay-card .panel-head p,
    .codes-card .panel-head p {
      display: none;
    }
    .relay-card .panel-head,
    .codes-card .panel-head {
      min-height: 52px;
      padding-block: 10px;
    }
    .relay-card #pairedDevices,
    .codes-card #relayPairingCodes {
      padding: 10px;
    }
    .relay-summary {
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 4px 12px;
      padding: 8px 10px;
      border-bottom: 1px solid var(--border);
    }
    .list-head {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      padding: 6px 10px;
      color: var(--muted);
      font-size: 12px;
      border-bottom: 1px solid var(--border);
      background: var(--panel);
    }
    .agent-events {
      display: grid;
      gap: 10px;
    }
    .relay-events-list {
      margin-top: 8px;
    }
    .event-filter-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      padding: 12px 12px 0;
    }
    .event-chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 30px;
      padding: 4px 12px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: color-mix(in srgb, var(--panel-2) 82%, transparent);
      color: var(--muted);
      font-weight: 650;
    }
    .event-chip b {
      min-width: 22px;
      padding: 1px 6px;
      border-radius: 999px;
      background: color-mix(in srgb, currentColor 18%, transparent);
      color: currentColor;
      text-align: center;
    }
    pre {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
      background: var(--panel-2);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 9px;
      max-height: 176px;
      overflow: auto;
      font-size: 12px;
    }
    .empty {
      color: var(--muted);
      border: 1px dashed var(--border);
      border-radius: 8px;
      padding: 8px 10px;
      background: color-mix(in srgb, var(--panel-2) 65%, transparent);
    }
    .console-table {
      display: grid;
      gap: 0;
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
      background: color-mix(in srgb, var(--panel) 90%, transparent);
      min-width: 0;
    }
    .console-table + .console-table {
      margin-top: 8px;
    }
    .console-row {
      display: grid;
      align-items: center;
      gap: 8px;
      min-height: 44px;
      padding: 8px 12px;
      border-bottom: 1px solid var(--border);
      min-width: 0;
    }
    .console-row > * {
      min-width: 0;
    }
    .console-row:last-child {
      border-bottom: 0;
    }
    .console-row.head {
      min-height: 38px;
      color: var(--muted);
      background: color-mix(in srgb, var(--panel-2) 88%, transparent);
      font-size: 13px;
      font-weight: 650;
    }
    .console-row:hover:not(.head) {
      background: color-mix(in srgb, var(--accent) 5%, transparent);
    }
    .server-row {
      grid-template-columns: minmax(190px, .85fr) 90px minmax(170px, .7fr) minmax(0, 1.45fr) 86px;
    }
    .server-row > :last-child {
      justify-self: center;
      text-align: center;
    }
    .server-row.head > :last-child {
      width: 100%;
    }
    .device-row {
      grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr) minmax(0, .82fr) minmax(0, .72fr) minmax(0, .7fr) minmax(76px, .52fr);
    }
    .code-row {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.06fr) minmax(0, .72fr) minmax(0, .72fr) minmax(78px, .5fr) minmax(62px, .38fr);
    }
    .codes-table .console-row {
      gap: 6px;
      padding-inline: 10px;
    }
    .devices-table .console-row {
      gap: 7px;
      padding-inline: 10px;
    }
    .event-row {
      grid-template-columns: 160px minmax(0, 1fr) 190px;
      align-items: start;
    }
    .console-main {
      min-width: 0;
      overflow: hidden;
    }
    .entity-main {
      display: grid;
      grid-template-columns: 22px minmax(0, 1fr);
      gap: 8px;
      align-items: center;
      min-width: 0;
    }
    .entity-icon {
      width: 18px;
      height: 18px;
      display: grid;
      place-items: center;
      color: var(--muted);
    }
    .entity-icon svg {
      width: 18px;
      height: 18px;
      display: block;
    }
    .console-title-line {
      font-weight: 700;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .event-row .console-main {
      overflow: visible;
    }
    .event-row .event-message,
    .event-row .event-source {
      white-space: normal;
      overflow: visible;
      text-overflow: clip;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .console-subline,
    .console-muted {
      color: var(--muted);
      font-size: 12px;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .console-wrap {
      min-width: 0;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .server-row .console-wrap {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      word-break: normal;
    }
    .console-truncate {
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .copy-cell {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      max-width: 100%;
    }
    .copy-cell .console-truncate {
      flex: 1 1 auto;
      min-width: 0;
    }
    .copy-inline-button {
      width: 24px;
      min-width: 24px;
      height: 24px;
      min-height: 24px;
      padding: 0;
      display: inline-grid;
      place-items: center;
      flex: none;
      border-color: transparent;
    }
    .date-stack {
      display: grid;
      gap: 1px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.25;
      white-space: nowrap;
    }
    .date-stack span {
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .table-footer {
      padding: 8px 14px;
      color: var(--muted);
      font-weight: 650;
      border: 1px solid var(--border);
      border-top: 0;
      border-radius: 0 0 8px 8px;
      background: color-mix(in srgb, var(--panel) 90%, transparent);
    }
    .console-table.has-footer {
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
    }
    .status-text {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      width: max-content;
      max-width: 100%;
      font-weight: 650;
      white-space: nowrap;
    }
    .console-actions {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 5px;
      min-width: 0;
    }
    .console-actions button {
      min-width: 0;
      min-height: 28px;
      padding-inline: 8px;
      font-size: 12px;
    }
    .codes-table .console-actions button {
      padding-inline: 7px;
    }
    .code-row .pill {
      min-height: 22px;
      padding-inline: 8px;
    }
    .relay-summary.console-table {
      grid-template-columns: none;
      padding: 0;
      border-bottom: 0;
    }
    .summary-row {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
    .summary-row .row {
      display: block;
      min-width: 0;
    }
    .summary-row .row dt {
      margin-bottom: 2px;
      font-size: 12px;
    }
    .summary-row .row dd {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .details-stack {
      display: grid;
      gap: 2px;
      min-width: 0;
    }
    .details-stack span {
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    @media (min-width: 761px) {
      .server-row .console-actions,
      .device-row .console-actions,
      .code-row .console-actions {
        grid-column: 6;
      }
      .server-row .console-actions {
        grid-column: 5;
      }
    }
    @media (max-width: 1400px) and (min-width: 1121px) {
      .overview-grid {
        gap: 12px;
      }
      .stat-card {
        grid-template-columns: 42px minmax(0, 1fr);
        gap: 10px;
        min-height: 108px;
        padding: 13px 14px;
      }
      .stat-icon {
        width: 42px;
        height: 42px;
        font-size: 17px;
      }
      .stat-value {
        font-size: 14px;
      }
      .stat-label {
        font-size: 12px;
      }
    }
    @media (max-width: 1120px) {
      .overview-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      .control-strip,
      .split-grid {
        grid-template-columns: 1fr;
      }
      .control-cell {
        border-right: 0;
        border-bottom: 1px solid var(--border);
      }
      .control-cell:last-child {
        border-bottom: 0;
      }
      .relay-summary {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    @media (min-width: 1121px) {
      .split-grid {
        grid-template-columns: minmax(0, 1fr) minmax(0, .98fr);
      }
      .events-card {
        align-self: start;
      }
    }
    @media (max-width: 760px) {
      .shell {
        padding: 8px;
      }
      .topbar {
        display: grid;
        justify-items: stretch;
        gap: 7px;
      }
      .title-line {
        justify-content: space-between;
      }
      .title h1 {
        font-size: 19px;
      }
      .toolbar {
        justify-content: flex-end;
      }
      .toolbar select {
        flex: 0 1 118px;
        min-width: 104px;
      }
      .toolbar button {
        min-width: 0;
        width: auto;
        max-width: max-content;
        padding-inline: 8px;
      }
      .overview-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .stat-card {
        min-height: 58px;
        grid-template-columns: 26px minmax(0, 1fr);
        padding: 7px 8px;
      }
      .stat-icon {
        width: 26px;
        height: 26px;
      }
      .stat-value {
        font-size: 15px;
      }
      .panel-head {
        min-height: 38px;
        padding: 7px 8px;
      }
      .panel-head p {
        display: none;
      }
      .panel-body {
        padding: 8px;
      }
      .compact-form,
      .pair-card .compact-form {
        grid-template-columns: 1fr;
      }
      .pair-inline {
        grid-template-columns: 1fr;
        grid-template-areas:
          "code"
          "name"
          "action";
      }
      .pair-inline #pairButton {
        justify-self: end;
      }
      .field-line {
        grid-template-columns: 76px minmax(0, 1fr);
      }
      .inline-actions {
        justify-content: flex-end;
      }
      .config-rows,
      .relay-summary {
        grid-template-columns: 1fr;
      }
      .console-table {
        border-radius: 8px;
      }
      .console-row.head {
        display: none;
      }
      .console-row,
      .server-row,
      .device-row,
      .code-row,
      .event-row,
      .summary-row {
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 4px 8px;
        align-items: start;
        padding: 7px 8px;
      }
      .summary-row .row {
        display: grid;
        grid-column: 1 / -1;
        grid-template-columns: 78px minmax(0, 1fr);
      }
      .event-row {
        grid-template-columns: minmax(112px, auto) minmax(0, 1fr);
      }
      .console-row > *:nth-child(n+3) {
        grid-column: 1 / -1;
      }
      .console-actions {
        grid-column: 2;
        grid-row: 1;
        justify-content: flex-end;
      }
      pre {
        max-height: 160px;
      }
    }
  </style>
</head>
<body>
  <main class="shell agent-console">
    <header class="topbar console-topbar">
      <div class="title console-title">
        <div class="title-line">
          <h1>QiuyuRemote Push Agent</h1>
          <span id="pairedPill" class="pill"><span class="dot"></span>Loading</span>
        </div>
        <p id="subtitle" data-i18n="subtitle">Download notification bridge</p>
      </div>
      <div class="toolbar-wrap">
        <div class="toolbar console-toolbar">
          <select id="languageSelect" aria-label="Language">
            <option value="zh" data-i18n="languageChinese">中文</option>
            <option value="en" data-i18n="languageEnglish">English</option>
          </select>
          <select id="themeSelect" aria-label="Theme">
            <option value="system" data-i18n="themeSystem">Follow System</option>
            <option value="light" data-i18n="themeLight">Light</option>
            <option value="dark" data-i18n="themeDark">Dark</option>
          </select>
          <button id="refreshButton" type="button" data-i18n="refresh">Refresh</button>
          <button id="diagnosticsButton" type="button" data-i18n="runDiagnostics">Run Diagnostics</button>
          <button id="testButton" class="primary" type="button" data-i18n="sendTestPush">Send Test Push</button>
        </div>
        <div id="startedAtLine" class="top-meta"></div>
        <div id="versionLine" class="top-meta"></div>
        <div id="updateNotice" class="update-notice" hidden></div>
      </div>
    </header>

    <section id="overviewCards" class="overview-grid" aria-live="polite"></section>

    <section class="panel control-strip">
      <article class="control-cell access-card">
        <div class="cell-title" data-i18n="accessApiKey">Access / API Key</div>
        <div class="cell-subtitle" data-i18n="accessHint">Used only when this Agent page requires remote access.</div>
        <label class="field-line">
          <span data-i18n="apiKey">API Key</span>
          <input id="apiKey" type="password" autocomplete="off" data-i18n-placeholder="apiKeyPlaceholder" placeholder="Required for remote access">
        </label>
        <div class="inline-actions">
          <button id="saveKeyButton" type="button" data-i18n="saveForBrowser">Save For This Browser</button>
          <button id="clearKeyButton" type="button" data-i18n="clear">Clear</button>
        </div>
        <div id="authMessage" class="message"></div>
      </article>

      <form id="pairForm" class="control-cell pair-card">
        <div class="cell-title" data-i18n="pairDevice">Add Paired Device</div>
        <div class="cell-subtitle" data-i18n="pairDeviceHint">Paste the pairing code generated by QiuyuRemote.</div>
        <div class="pair-inline">
          <label class="field-line">
            <span data-i18n="pairingCode">Pairing Code</span>
            <input id="pairingCode" autocomplete="one-time-code" placeholder="ABCD-1234">
          </label>
          <label class="field-line">
            <span data-i18n="agentName">Agent Name</span>
            <input id="agentName" data-i18n-placeholder="agentNamePlaceholder" placeholder="Home Agent">
          </label>
          <button id="pairButton" class="primary" type="submit" data-i18n="pairAgent">Add Paired Agent</button>
        </div>
        <div id="pairMessage" class="message"></div>
      </form>

      <article class="control-cell diagnostics-control">
        <div class="cell-title-row">
          <div class="cell-title" data-i18n="diagnostics">Diagnostics</div>
          <span id="diagnosticsMeta" class="meta">Not run</span>
        </div>
        <div class="cell-subtitle" data-i18n="diagnosticsHintShort">Connectivity checks for all configured services.</div>
        <pre id="diagnosticsOutput" data-i18n="diagnosticsHint">Run diagnostics to check qBittorrent, Transmission, and aria2 connectivity.</pre>
      </article>
    </section>
    <dl id="stateRows" hidden></dl>

    <section class="panel servers-card">
      <div class="panel-head">
        <div>
          <h2 data-i18n="downloadServers">Download Servers</h2>
          <p data-i18n="downloadServersHint">qBittorrent, Transmission, and aria2 monitor status.</p>
        </div>
        <span id="serverCount" class="meta">0 servers</span>
      </div>
      <div id="servers"></div>
    </section>

    <section class="split-grid">
      <article class="panel relay-card">
        <div class="panel-head">
          <div>
            <h2 data-i18n="pairedDevices">Paired Devices</h2>
            <p data-i18n="pairedDevicesHint">Devices that will receive notifications from this Agent.</p>
          </div>
          <span id="relayAgentPill" class="pill"><span class="dot"></span>Loading</span>
          <span id="pairedDevicesMeta" class="meta" hidden>Loading</span>
        </div>
        <div id="relayAgentRows" hidden></div>
        <div id="pairedDevices"></div>
      </article>

      <article class="panel codes-card">
        <div class="panel-head">
          <div>
            <h2><span id="pairingCodesTitle" data-i18n="pairingCodes">Pairing Codes</span></h2>
            <p data-i18n="pairingCodesHint">Codes generated for QiuyuRemote devices.</p>
          </div>
          <span id="relayPairingCodesMeta" class="meta">Loading</span>
        </div>
        <div id="relayPairingCodes"></div>
      </article>
    </section>

    <section class="panel events-card">
      <div class="panel-head">
        <div>
          <h2 data-i18n="recentEvents">Recent Events</h2>
          <p data-i18n="recentEventsHint">Latest pairing, download, and push activity.</p>
        </div>
        <span id="relayEventsMeta" class="meta">Local</span>
      </div>
      <pre id="eventOutput" data-i18n="noEventData" hidden>No event data yet.</pre>
      <div id="agentEvents" class="agent-events"></div>
      <div id="relayEvents" class="relay-events-list"></div>
    </section>

  </main>

  <script>
    const I18N = {
      en: {
        subtitle: "Download notification bridge",
        languageChinese: "Chinese",
        languageEnglish: "English",
        themeSystem: "Follow System",
        themeLight: "Light",
        themeDark: "Dark",
        refresh: "Refresh",
        runDiagnostics: "Run Diagnostics",
        sendTestPush: "Send Test Push",
        status: "Status",
        downloadServers: "Download Servers",
        downloadServices: "Download Services",
        accessApiKey: "Access / API Key",
        accessHint: "Used only when this Agent page requires remote access.",
        configuration: "Configuration",
        configurationHint: "Config file, working directory, and monitored services.",
        pairDeviceHint: "Paste the pairing code generated by QiuyuRemote.",
        downloadServersHint: "Monitor status for enabled download services.",
        pairedDevicesHint: "Devices that will receive notifications from this Agent.",
        pairingCodesHint: "Codes generated for QiuyuRemote devices.",
        recentEventsHint: "Latest pairing, download, and push activity.",
        diagnosticsHintShort: "Connectivity checks for all configured services.",
        allOnline: "All online",
        allServicesHealthy: "All healthy",
        someOffline: "Needs attention",
        allUsed: "All used",
        availableCodes: "available",
        past24Hours: "Past 24 hours",
        startedAt: "Started at",
        runningState: "Running",
        configReady: "Config ready",
        configMissing: "Config missing",
        relayNotLoaded: "Relay not loaded",
        noRecentActivity: "No recent activity",
        diagnostics: "Diagnostics",
        diagnosticsHint: "Run diagnostics to check enabled download service connectivity.",
        access: "Access",
        apiKey: "API Key",
        apiKeyPlaceholder: "Required for remote access",
        saveForBrowser: "Save",
        clear: "Clear",
        copy: "Copy",
        copied: "Copied.",
        pairDevice: "Add Paired Device",
        pairingCode: "Pairing Code",
        agentName: "Agent Name",
        agentNamePlaceholder: "Home Agent",
        pairAgent: "Add Paired Agent",
        pairedDevices: "Paired Devices",
        devices: "Devices",
        pairingCodes: "Pairing Codes",
        recentEvents: "Recent Events",
        noEventData: "No event data yet.",
        loading: "Loading",
        notRun: "Not run",
        connected: "Connected.",
        apiKeyRequired: "API Key Required",
        unavailable: "Unavailable",
        cannotLoadState: "Cannot load Agent state.",
        noServerData: "No server data available.",
        noServersConfigured: "No download servers configured.",
        noRelayDeviceData: "No paired device data available.",
        noPairingCodeData: "No pairing code data available.",
        noPairedDevices: "No devices are paired with this Agent.",
        noPairingCodes: "No pairing code records for this Agent.",
        noRelayEvents: "No Relay events",
        allEvents: "All",
        pairingCodeUsedShort: "Used code",
        pairingFailedShort: "Pairing failed",
        downloadsShort: "Downloads",
        pushesShort: "Pushes",
        localEvent: "local event",
        pairingFailedEvent: "Pairing failed",
        pairingCodeUsedEvent: "Pairing code used",
        pairingCodeDuplicateEvent: "Duplicate pairing code",
        pairingSucceededEvent: "Pairing succeeded",
        pairingRequiredEvent: "Pairing required",
        downloadInactiveEvent: "Download inactive",
        downloadEvent: "Download event",
        pushEvent: "Push event",
        notPaired: "Not Paired",
        paired: "Paired",
        relayPaired: "Relay Paired",
        relayUnavailable: "Relay Unavailable",
        pairRelayHint: "Pair this Agent with a QiuyuRemote device to manage paired devices.",
        cannotLoadRelay: "Cannot load Relay pairing state.",
        config: "Config",
        workingDir: "Working Dir",
        configFilePath: "Config File",
        configFile: "Config Status",
        found: "Found",
        missing: "Missing",
        servers: "Servers",
        server: "server",
        device: "device",
        deviceColumn: "Device",
        code: "code",
        codeColumn: "Code",
        event: "event",
        relayEvent: "Relay event",
        relay: "Relay",
        agent: "Agent",
        serviceName: "Service Name",
        agentId: "Agent ID",
        deviceId: "Device ID",
        associatedDevice: "Device",
        platform: "Platform",
        bundle: "Bundle",
        token: "Token",
        showToken: "Show token",
        hideToken: "Hide token",
        updated: "Updated",
        lastOnline: "Last Online",
        created: "Created",
        createdAt: "Created",
        expires: "Expires",
        expiresAt: "Expires",
        active: "Active",
        used: "Used",
        revoked: "Revoked",
        expired: "Expired",
        online: "Online",
        offline: "Offline",
        available: "Available",
        notAvailable: "Unavailable",
        lastMonitor: "Last Monitor",
        lastHeartbeat: "Last Heartbeat",
        summary: "Summary",
        details: "Details",
        action: "Action",
        message: "Message",
        warning: "Warning",
        error: "Error",
        liveEvents: "Live Events",
        noTaskSummary: "No task summary",
        check: "Check",
        unpair: "Unpair",
        delete: "Delete",
        more: "More",
        totalRows: "Total",
        enterPairingCode: "Enter a pairing code.",
        agentPaired: "Agent paired.",
        agentPairedWithRelay: "Agent paired with Push Relay.",
        keySaved: "API key saved.",
        keyCleared: "API key cleared.",
        running: "Running...",
        passed: "Passed",
        needsAttention: "Needs attention",
        failed: "Failed",
        requestFailed: "Request failed.",
        authHint: "Enter the Agent apiKey from config.json in the Access section.",
        remoteAccessRequiresApiKey: "Remote access requires an Agent API key. Set apiKey in config.json, restart the Agent, then enter the same key in the Access section.",
        agentApiKeyMissingOrIncorrect: "Agent API key is missing or incorrect. Enter the apiKey from config.json in the Access section.",
        relayHTMLHint: "Relay returned a web page instead of API JSON. Check the Relay URL and reverse proxy API routes.",
        notFound: "Not found.",
        internalError: "Internal error.",
        agentNotPairedWithRelay: "Pair this Agent with Push Relay first.",
        pairingCodeMissing: "Enter a pairing code.",
        pairingCodeAlreadyUsed: "Pairing code was already used.",
        pairingCodeExpired: "Pairing code has expired.",
        pairingCodeRevoked: "Pairing code was revoked.",
        pairingCodeNotFound: "Pairing code was not found.",
        pairingCodeNotFoundOrExpired: "Pairing code was not found or has expired.",
        pairingCodeDifferentApp: "Pairing code belongs to a different app than this Agent.",
        existingAgentCannotUpdate: "Existing Agent identity cannot be updated by pairing. Re-pair without static Relay credentials.",
        pairedDeviceMissing: "Paired device is no longer registered.",
        deviceNotRegistered: "Device is not registered with Push Relay.",
        relayPairingFailed: "Relay pairing failed.",
        pushEventFailed: "Push event failed.",
        confirmUnpairDevice: "Unpair this device from this Agent?",
        confirmDeletePairingCode: "Delete this pairing code?",
        deviceUnpaired: "Device unpaired.",
        pairingCodeDeleted: "Pairing code deleted.",
        testEventSent: "Test event sent to Relay.",
        invalidJSONResponse: "Invalid JSON response.",
        unknownServer: "Unknown server.",
        type: "Type",
        subject: "Subject",
        delivery: "Delivery",
        sent: "sent",
        recorded: "Recorded",
        notRedeemed: "Not redeemed",
        version: "Version",
        github: "GitHub",
        updateAvailable: "New PushAgent version {version} is available.",
        upToDate: "Up to date",
        updateCheckDisabled: "Update check disabled",
        unknown: "unknown"
      },
      zh: {
        subtitle: "下载完成通知桥接",
        languageChinese: "中文",
        languageEnglish: "English",
        themeSystem: "跟随系统",
        themeLight: "浅色",
        themeDark: "深色",
        refresh: "刷新",
        runDiagnostics: "运行诊断",
        sendTestPush: "发送测试通知",
        status: "状态",
        downloadServers: "下载服务",
        downloadServices: "下载服务",
        accessApiKey: "访问 / API Key",
        accessHint: "仅在远程访问此 Agent 页面时使用。",
        configuration: "配置",
        configurationHint: "配置文件、工作目录和监控服务。",
        pairDeviceHint: "粘贴 QiuyuRemote 生成的配对码。",
        downloadServersHint: "已启用下载服务的监控状态。",
        pairedDevicesHint: "这些设备会收到此 Agent 发出的通知。",
        pairingCodesHint: "为 QiuyuRemote 设备生成的配对码。",
        recentEventsHint: "最近的配对、下载和推送活动。",
        diagnosticsHintShort: "检查已配置下载服务的连接状态。",
        allOnline: "全部在线",
        allServicesHealthy: "全部正常",
        someOffline: "需要处理",
        allUsed: "全部已使用",
        availableCodes: "个可用",
        past24Hours: "过去 24 小时",
        startedAt: "启动时间",
        runningState: "运行中",
        configReady: "配置正常",
        configMissing: "配置缺失",
        relayNotLoaded: "Relay 未加载",
        noRecentActivity: "暂无最近事件",
        diagnostics: "诊断",
        diagnosticsHint: "运行诊断可检查已启用下载服务的连接状态。",
        access: "访问",
        apiKey: "API Key",
        apiKeyPlaceholder: "远程访问时需要",
        saveForBrowser: "保存",
        clear: "清除",
        copy: "复制",
        copied: "已复制。",
        pairDevice: "新增配对设备",
        pairingCode: "配对码",
        agentName: "Agent 名称",
        agentNamePlaceholder: "Home Agent",
        pairAgent: "新增配对 Agent",
        pairedDevices: "已配对设备",
        devices: "设备",
        pairingCodes: "配对码",
        recentEvents: "最近事件",
        noEventData: "暂无事件数据。",
        loading: "加载中",
        notRun: "未运行",
        connected: "已连接。",
        apiKeyRequired: "需要 API Key",
        unavailable: "不可用",
        cannotLoadState: "无法加载 Agent 状态。",
        noServerData: "暂无下载服务数据。",
        noServersConfigured: "未配置下载服务。",
        noRelayDeviceData: "暂无已配对设备数据。",
        noPairingCodeData: "暂无配对码数据。",
        noPairedDevices: "此 Agent 暂无已配对设备。",
        noPairingCodes: "此 Agent 暂无配对码记录。",
        noRelayEvents: "暂无 Relay 事件",
        allEvents: "全部",
        pairingCodeUsedShort: "配对码",
        pairingFailedShort: "配对失败",
        downloadsShort: "下载事件",
        pushesShort: "推送事件",
        localEvent: "条本地事件",
        pairingFailedEvent: "配对失败",
        pairingCodeUsedEvent: "配对码已使用",
        pairingCodeDuplicateEvent: "重复配对码",
        pairingSucceededEvent: "配对成功",
        pairingRequiredEvent: "需要配对",
        downloadInactiveEvent: "下载无数据",
        downloadEvent: "下载事件",
        pushEvent: "推送事件",
        notPaired: "未配对",
        paired: "已配对",
        relayPaired: "Relay 已配对",
        relayUnavailable: "Relay 不可用",
        pairRelayHint: "将此 Agent 与 QiuyuRemote 设备配对后，可管理已配对设备。",
        cannotLoadRelay: "无法加载 Relay 配对状态。",
        config: "配置",
        workingDir: "工作目录",
        configFilePath: "配置文件",
        configFile: "配置文件状态",
        found: "已找到",
        missing: "缺失",
        servers: "服务",
        server: "个服务",
        device: "台设备",
        deviceColumn: "设备",
        code: "个配对码",
        codeColumn: "配对码",
        event: "条事件",
        relayEvent: "条 Relay 事件",
        relay: "Relay",
        agent: "Agent",
        serviceName: "服务名称",
        agentId: "Agent ID",
        deviceId: "设备 ID",
        associatedDevice: "关联设备",
        platform: "平台",
        bundle: "Bundle",
        token: "Token",
        showToken: "显示 Token",
        hideToken: "隐藏 Token",
        updated: "更新",
        lastOnline: "最后在线",
        created: "创建",
        createdAt: "创建时间",
        expires: "过期",
        expiresAt: "过期时间",
        active: "有效",
        used: "已使用",
        revoked: "已撤销",
        expired: "已过期",
        online: "在线",
        offline: "离线",
        available: "可用",
        notAvailable: "不可用",
        lastMonitor: "上次监控",
        lastHeartbeat: "最后心跳",
        summary: "摘要",
        details: "详情",
        action: "操作",
        message: "消息",
        warning: "警告",
        error: "错误",
        liveEvents: "实时事件",
        noTaskSummary: "暂无任务摘要",
        check: "检查",
        unpair: "取消配对",
        delete: "删除",
        more: "更多",
        totalRows: "共",
        enterPairingCode: "请输入配对码。",
        agentPaired: "Agent 已配对。",
        agentPairedWithRelay: "Agent 已与 Push Relay 配对。",
        keySaved: "API Key 已保存。",
        keyCleared: "API Key 已清除。",
        running: "运行中...",
        passed: "通过",
        needsAttention: "需要处理",
        failed: "失败",
        requestFailed: "请求失败。",
        authHint: "请输入 config.json 里的 Agent apiKey。",
        remoteAccessRequiresApiKey: "远程访问需要 Agent API Key。请在 config.json 中设置 apiKey，重启 Agent，然后在“访问”区域输入同一个 Key。",
        agentApiKeyMissingOrIncorrect: "Agent API Key 缺失或不正确。请在“访问”区域输入 config.json 中的 apiKey。",
        relayHTMLHint: "Relay 返回了网页而不是 API JSON，请检查 Relay 地址和反向代理 API 路由。",
        notFound: "未找到。",
        internalError: "内部错误。",
        agentNotPairedWithRelay: "请先将此 Agent 与 Push Relay 配对。",
        pairingCodeMissing: "请输入配对码。",
        pairingCodeAlreadyUsed: "配对码已被使用。",
        pairingCodeExpired: "配对码已过期。",
        pairingCodeRevoked: "配对码已撤销。",
        pairingCodeNotFound: "未找到配对码。",
        pairingCodeNotFoundOrExpired: "未找到配对码或配对码已过期。",
        pairingCodeDifferentApp: "这个配对码属于其它应用。",
        existingAgentCannotUpdate: "已有 Agent 身份不能通过配对更新，请清除静态 Relay 凭据后重新配对。",
        pairedDeviceMissing: "已配对设备不再存在。",
        deviceNotRegistered: "设备尚未注册到 Push Relay。",
        relayPairingFailed: "Relay 配对失败。",
        pushEventFailed: "推送事件发送失败。",
        confirmUnpairDevice: "从此 Agent 取消配对这个设备？",
        confirmDeletePairingCode: "删除这个配对码？",
        deviceUnpaired: "设备已取消配对。",
        pairingCodeDeleted: "配对码已删除。",
        testEventSent: "测试事件已发送到 Relay。",
        invalidJSONResponse: "返回内容不是有效的 JSON。",
        unknownServer: "未知下载服务。",
        type: "类型",
        subject: "对象",
        delivery: "投递",
        sent: "成功",
        recorded: "记录时间",
        notRedeemed: "未兑换",
        version: "版本",
        github: "GitHub",
        updateAvailable: "发现 PushAgent 新版本 {version}。",
        upToDate: "已是最新",
        updateCheckDisabled: "更新检查已关闭",
        unknown: "未知"
      }
    };

    const state = {
      apiKey: sessionStorage.getItem("qiuyuAgentApiKey") || localStorage.getItem("qiuyuAgentApiKey") || "",
      language: localStorage.getItem("qiuyuAgentLanguage") || ((navigator.language || "").toLowerCase().startsWith("zh") ? "zh" : "en"),
      theme: localStorage.getItem("qiuyuAgentTheme") || "system",
      lastState: null,
      lastRelayPayload: null,
      lastLocalEvents: [],
      lastRelayEvents: [],
      updateStatus: null,
      authRequired: false
    };

    const elements = {
      apiKey: document.getElementById("apiKey"),
      authMessage: document.getElementById("authMessage"),
      clearKeyButton: document.getElementById("clearKeyButton"),
      diagnosticsButton: document.getElementById("diagnosticsButton"),
      diagnosticsMeta: document.getElementById("diagnosticsMeta"),
      diagnosticsOutput: document.getElementById("diagnosticsOutput"),
      agentEvents: document.getElementById("agentEvents"),
      eventOutput: document.getElementById("eventOutput"),
      languageSelect: document.getElementById("languageSelect"),
      refreshButton: document.getElementById("refreshButton"),
      saveKeyButton: document.getElementById("saveKeyButton"),
      serverCount: document.getElementById("serverCount"),
      startedAtLine: document.getElementById("startedAtLine"),
      versionLine: document.getElementById("versionLine"),
      updateNotice: document.getElementById("updateNotice"),
      servers: document.getElementById("servers"),
      pairedPill: document.getElementById("pairedPill"),
      pairForm: document.getElementById("pairForm"),
      pairMessage: document.getElementById("pairMessage"),
      pairingCode: document.getElementById("pairingCode"),
      overviewCards: document.getElementById("overviewCards"),
      pairedDevices: document.getElementById("pairedDevices"),
      pairedDevicesMeta: document.getElementById("pairedDevicesMeta"),
      pairingCodesTitle: document.getElementById("pairingCodesTitle"),
      relayAgentPill: document.getElementById("relayAgentPill"),
      relayAgentRows: document.getElementById("relayAgentRows"),
      relayEvents: document.getElementById("relayEvents"),
      relayEventsMeta: document.getElementById("relayEventsMeta"),
      relayPairingCodes: document.getElementById("relayPairingCodes"),
      relayPairingCodesMeta: document.getElementById("relayPairingCodesMeta"),
      agentName: document.getElementById("agentName"),
      stateRows: document.getElementById("stateRows"),
      testButton: document.getElementById("testButton"),
      themeSelect: document.getElementById("themeSelect")
    };

    elements.languageSelect.value = state.language;
    elements.themeSelect.value = state.theme;
    elements.apiKey.value = state.apiKey;
    elements.agentName.value = t("agentNamePlaceholder");
    applyTheme();
    applyLanguage();

    elements.languageSelect.addEventListener("change", () => {
      state.language = elements.languageSelect.value || "en";
      localStorage.setItem("qiuyuAgentLanguage", state.language);
      applyLanguage();
      if (state.lastState) {
        renderState(state.lastState);
        refreshRelayAgent(state.lastState.paired);
      }
    });

    elements.themeSelect.addEventListener("change", () => {
      state.theme = elements.themeSelect.value || "system";
      localStorage.setItem("qiuyuAgentTheme", state.theme);
      applyTheme();
    });

    elements.saveKeyButton.addEventListener("click", () => {
      state.apiKey = elements.apiKey.value.trim();
      sessionStorage.setItem("qiuyuAgentApiKey", state.apiKey);
      localStorage.setItem("qiuyuAgentApiKey", state.apiKey);
      showMessage(elements.authMessage, state.apiKey ? t("keySaved") : t("keyCleared"), "success");
      refreshState();
    });

    elements.clearKeyButton.addEventListener("click", () => {
      state.apiKey = "";
      elements.apiKey.value = "";
      sessionStorage.removeItem("qiuyuAgentApiKey");
      localStorage.removeItem("qiuyuAgentApiKey");
      showMessage(elements.authMessage, t("keyCleared"), "success");
      refreshState();
    });

    elements.refreshButton.addEventListener("click", refreshState);
    elements.diagnosticsButton.addEventListener("click", () => runDiagnostics(""));
    elements.testButton.addEventListener("click", sendTestPush);
    elements.pairForm.addEventListener("submit", (event) => {
      event.preventDefault();
      pairAgent();
    });
    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-copy-text]");
      if (!button) return;
      copyText(button.getAttribute("data-copy-text") || "");
    });

    async function api(path, options = {}) {
      const headers = Object.assign({ "Accept": "application/json" }, options.headers || {});
      if (options.body && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
      }
      const key = elements.apiKey.value.trim() || state.apiKey;
      if (key) {
        headers["Authorization"] = "Bearer " + key;
      }
      const response = await fetch(path, Object.assign({}, options, { headers }));
      const text = await response.text();
      let payload = {};
      try {
        payload = text ? JSON.parse(text) : {};
      } catch {
        payload = { message: text || "Invalid JSON response." };
      }
      if (!response.ok) {
        const message = payload.message || ("HTTP " + response.status);
        const error = new Error(message);
        error.status = response.status;
        error.payload = payload;
        throw error;
      }
      return payload;
    }

    async function copyText(text) {
      const value = String(text || "");
      if (!value) return;
      let copied = false;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(value);
          copied = true;
        }
      } catch {
        copied = false;
      }
      if (!copied) {
        const input = document.createElement("textarea");
        input.value = value;
        input.setAttribute("readonly", "readonly");
        input.style.position = "fixed";
        input.style.left = "-9999px";
        document.body.appendChild(input);
        input.focus();
        input.select();
        copied = document.execCommand("copy");
        input.remove();
      }
      showMessage(elements.authMessage, copied ? t("copied") : t("requestFailed"), copied ? "success" : "error");
    }

    async function refreshState() {
      withBusy(elements.refreshButton, true);
      try {
        const payload = await api("/v1/state");
        state.lastState = payload;
        renderState(payload);
        checkForUpdates();
        await refreshRelayAgent(payload.paired);
        clearAuthAttention();
        showMessage(elements.authMessage, t("connected"), "success");
      } catch (error) {
        const message = friendlyErrorMessage(error);
        renderState(null, message, isAuthError(error) ? t("apiKeyRequired") : t("unavailable"));
        if (!handleAuthError(error)) {
          showMessage(elements.authMessage, message, "error");
        }
      } finally {
        withBusy(elements.refreshButton, false);
      }
    }

    function renderState(payload, unavailableMessage = t("cannotLoadState"), unavailableLabel = t("unavailable")) {
      if (!payload) {
        state.lastState = null;
        setPill(elements.pairedPill, "bad", unavailableLabel);
        elements.startedAtLine.textContent = "";
        elements.stateRows.innerHTML = row(t("status"), escapeHTML(unavailableMessage));
        elements.servers.innerHTML = emptyHTML(t("noServerData"));
        elements.serverCount.textContent = plural(0, "server");
        renderAgentEvents([]);
        renderRelayAgent(null, unavailableMessage, t("unavailable"));
        renderOverview();
        return;
      }
      state.lastState = payload;
      setPill(elements.pairedPill, payload.paired ? "ok" : "warn", payload.paired ? t("runningState") : t("notPaired"));
      elements.startedAtLine.textContent = payload.startedAt ? t("startedAt") + ": " + formatDate(payload.startedAt) : "";
      renderVersion(payload.app || { version: payload.version });
      elements.stateRows.innerHTML = [
        row(t("configFilePath"), escapeHTML(payload.configPath || "")),
        row(t("workingDir"), escapeHTML(payload.cwd || "")),
        row(t("configFile"), payload.configExists ? t("found") : t("missing")),
        row(t("servers"), String((payload.servers || []).length))
      ].join("");
      elements.serverCount.textContent = plural((payload.servers || []).length, "server");
      renderServers(payload.servers || []);
      renderAgentEvents(payload.runtimeEvents || [], payload.servers || []);
      renderOverview();
    }

    async function checkForUpdates() {
      try {
        const payload = await api("/v1/update-check");
        state.updateStatus = payload;
        renderVersion((state.lastState && state.lastState.app) || payload, payload);
      } catch {
        renderVersion(state.lastState && state.lastState.app, null);
      }
    }

    function renderVersion(app, update) {
      const info = app || {};
      const version = info.version || info.currentVersion || "";
      const repositoryURL = info.repositoryURL || update?.repositoryURL || "";
      const link = repositoryURL
        ? ' · <a href="' + escapeAttribute(repositoryURL) + '" target="_blank" rel="noreferrer">' + escapeHTML(t("github")) + '</a>'
        : "";
      elements.versionLine.innerHTML = version ? escapeHTML(t("version") + " " + version) + link : "";
      const status = update || state.updateStatus;
      if (!status || status.enabled === false || !status.updateAvailable) {
        elements.updateNotice.hidden = true;
        elements.updateNotice.innerHTML = "";
        return;
      }
      const latest = status.latestVersion || "";
      const message = t("updateAvailable").replace("{version}", latest ? "v" + latest : "");
      const action = repositoryURL
        ? ' <a href="' + escapeAttribute(repositoryURL) + '" target="_blank" rel="noreferrer">' + escapeHTML(t("github")) + '</a>'
        : "";
      elements.updateNotice.innerHTML = escapeHTML(message) + action;
      elements.updateNotice.hidden = false;
    }

    function renderOverview() {
      const payload = state.lastState || {};
      const relayPayload = state.lastRelayPayload || {};
      const servers = Array.isArray(payload.servers) ? payload.servers : [];
      const devices = Array.isArray(relayPayload.devices) ? relayPayload.devices : [];
      const codes = Array.isArray(relayPayload.pairingCodes) ? relayPayload.pairingCodes : [];
      const relayEvents = Array.isArray(relayPayload.events) ? relayPayload.events : [];
      const agent = relayPayload.agent || {};
      const identity = payload.relayIdentity || {};
      const agentId = agent.id || identity.agentId || "";
      const onlineServers = servers.filter((server) => server.online).length;
      const activeCodes = codes.filter((code) => code.status === "active").length;
      const recentEvents = [...state.lastLocalEvents, ...relayEvents].filter((event) => {
        const value = event.occurredAt || event.recordedAt || event.createdAt || "";
        const time = Date.parse(value);
        return Number.isFinite(time) && Date.now() - time <= 24 * 60 * 60 * 1000;
      });
      const agentName = agent.name || identity.agentName || elements.agentName.value.trim() || t("agentNamePlaceholder");
      const serverNote = servers.length
        ? onlineServers === servers.length ? t("allServicesHealthy") : t("someOffline")
        : t("noServersConfigured");
      const deviceNote = state.lastRelayPayload
        ? devices.length ? t("allOnline") : t("noPairedDevices")
        : t("relayNotLoaded");
      const codeNote = codes.length
        ? activeCodes ? activeCodes + " " + t("availableCodes") : t("allUsed")
        : t("noPairingCodes");
      const eventCount = recentEvents.length || state.lastLocalEvents.length || relayEvents.length;
      elements.overviewCards.innerHTML = [
        statCard(t("agent"), agentName, payload.paired ? t("paired") : t("notPaired"), "▭", payload.paired ? "ok" : "warn", agentId ? t("agentId") + ": " + agentId : "", agentId),
        statCard(t("downloadServices"), plural(servers.length, "server"), serverNote, "≡", onlineServers === servers.length ? "ok" : "warn"),
        statCard(t("pairedDevices"), plural(devices.length, "device"), deviceNote, "▤", devices.length ? "ok" : "warn"),
        statCard(t("pairingCodes"), plural(codes.length, "code"), codeNote, "⌘", activeCodes ? "ok" : "warn"),
        statCard(t("recentEvents"), plural(eventCount, "event"), eventCount ? t("past24Hours") : t("noRecentActivity"), "□", eventCount ? "ok" : "warn")
      ].join("");
    }

    function statCard(label, value, note, icon, kind = "", subnote = "", copyValue = "") {
      return '<article class="stat-card">' +
        '<div class="stat-icon">' + escapeHTML(icon || "") + '</div>' +
        '<div class="stat-content">' +
          '<div class="stat-label">' + escapeHTML(label || "") + '</div>' +
          '<div class="stat-value">' + escapeHTML(value || "--") + '</div>' +
          '<div class="stat-note">' + pillHTML(note || "", kind) + '</div>' +
          (subnote ? '<div class="stat-subnote"><span>' + escapeHTML(shortText(subnote, 28)) + '</span>' +
            (copyValue ? '<button class="copy-button" type="button" data-copy-text="' + escapeAttribute(copyValue) + '" aria-label="' + escapeAttribute(t("copy")) + '">' + copyIconHTML() + '</button>' : "") +
          '</div>' : "") +
        '</div>' +
      '</article>';
    }

    function renderAgentEvents(runtimeEvents, servers = []) {
      const serverEvents = servers.flatMap((server) => {
        const items = [];
        if (server.lastEventSummary) {
          items.push({
            id: (server.id || server.name || "server") + ":event",
            type: "download",
            level: server.online ? "info" : "warn",
            message: server.lastEventSummary,
            occurredAt: parseSummaryDate(server.lastEventSummary),
            source: server.name || server.id || t("server")
          });
        }
        if (server.lastPushSummary) {
          items.push({
            id: (server.id || server.name || "server") + ":push",
            type: "push",
            level: server.lastPushSummary.includes("failed") ? "error" : "info",
            message: server.lastPushSummary,
            occurredAt: parseSummaryDate(server.lastPushSummary),
            source: server.name || server.id || t("server")
          });
        }
        return items;
      });
      const events = [...(Array.isArray(runtimeEvents) ? runtimeEvents : []), ...serverEvents]
        .filter((event) => event && event.message)
        .sort((left, right) => Date.parse(right.occurredAt || "") - Date.parse(left.occurredAt || ""))
        .slice(0, 8);
      state.lastLocalEvents = events;
      elements.relayEventsMeta.textContent = events.length ? plural(events.length, "localEvent") : t("noEventData");
      elements.eventOutput.hidden = true;
      renderEventList();
      renderOverview();
    }

    function consoleTableHTML(headers, rows, rowClass, extraClass = "") {
      const head = '<div class="console-row head ' + escapeAttribute(rowClass || "") + '">' +
        headers.map((label) => '<span>' + escapeHTML(label) + '</span>').join("") +
      '</div>';
      return '<div class="console-table ' + escapeAttribute(extraClass || "") + '">' + head + rows.join("") + '</div>';
    }

    function consoleRowHTML(cells, rowClass, attributes = "") {
      return '<div class="console-row ' + escapeAttribute(rowClass || "") + '"' + attributes + '>' + cells.join("") + '</div>';
    }

    function consoleMainHTML(title, subtitle = "") {
      return '<div class="console-main"><div class="console-title-line">' + escapeHTML(title || "--") + '</div>' +
        (subtitle ? '<div class="console-subline">' + escapeHTML(subtitle) + '</div>' : "") +
      '</div>';
    }

    function entityMainHTML(icon, title, subtitle = "") {
      return '<div class="entity-main">' +
        '<span class="entity-icon">' + icon + '</span>' +
        consoleMainHTML(title, subtitle) +
      '</div>';
    }

    function consoleStackHTML(lines) {
      const items = lines.filter(Boolean);
      if (!items.length) return '<span class="console-muted">--</span>';
      return '<div class="details-stack">' + items.map((line) => '<span>' + line + '</span>').join("") + '</div>';
    }

    function copyCellHTML(value, limit = 16) {
      const text = value || "--";
      const copyButton = value
        ? '<button class="copy-button copy-inline-button" type="button" data-copy-text="' + escapeAttribute(value) + '" aria-label="' + escapeAttribute(t("copy")) + '" title="' + escapeAttribute(t("copy")) + '">' + copyIconHTML() + '</button>'
        : "";
      return '<span class="copy-cell">' +
        '<span class="console-truncate">' + escapeHTML(shortText(text, limit)) + '</span>' +
        copyButton +
      '</span>';
    }

    function tableFooterHTML(count) {
      const text = state.language === "zh" ? t("totalRows") + " " + count + " 条" : count + " " + t("totalRows").toLowerCase();
      return '<div class="table-footer">' + escapeHTML(text) + '</div>';
    }

    function shortDateHTML(value) {
      if (!value) return '<span class="console-muted">--</span>';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return '<span class="console-muted console-truncate">' + escapeHTML(value) + '</span>';
      }
      const datePart = date.toLocaleDateString(undefined, { year: "numeric", month: "2-digit", day: "2-digit" });
      const timePart = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
      return '<span class="date-stack"><span>' + escapeHTML(datePart) + '</span><span>' + escapeHTML(timePart) + '</span></span>';
    }

    function summaryTableHTML(rows) {
      return '<div class="console-table relay-summary"><div class="console-row summary-row">' + rows.join("") + '</div></div>';
    }

    function pillHTML(text, kind = "") {
      const className = kind ? "pill " + kind : "pill";
      return '<span class="' + escapeAttribute(className) + '"><span class="dot"></span>' + escapeHTML(text || "") + '</span>';
    }

    function statusTextHTML(text, kind = "") {
      const className = kind ? "status-text " + kind : "status-text";
      return '<span class="' + escapeAttribute(className) + '"><span class="dot"></span>' + escapeHTML(text || "") + '</span>';
    }

    function copyIconHTML() {
      return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<rect x="8" y="8" width="11" height="11" rx="2" stroke="currentColor" stroke-width="1.8"/>' +
        '<path d="M5 15V6.5A1.5 1.5 0 0 1 6.5 5H15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
      '</svg>';
    }

    function deviceIconHTML(platform) {
      const isPhone = /ios|iphone|ipad|phone|mobile/i.test(String(platform || ""));
      if (isPhone) {
        return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="8" y="3" width="8" height="18" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M11 18h2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
      }
      return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="5" width="16" height="11" rx="1.5" stroke="currentColor" stroke-width="1.8"/><path d="M9 20h6M12 16v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
    }

    function labeledHTML(label, value) {
      return '<span class="console-muted">' + escapeHTML(label) + ': </span>' + value;
    }

    function agentEventTitle(type) {
      const labels = {
        pairing_failed: "pairingFailedEvent",
        pairing_code_used: "pairingCodeUsedEvent",
        pairing_code_duplicate: "pairingCodeDuplicateEvent",
        pairing_succeeded: "pairingSucceededEvent",
        pairing_required: "pairingRequiredEvent",
        download_inactive: "downloadInactiveEvent",
        download: "downloadEvent",
        push: "pushEvent"
      };
      return t(labels[type] || "recentEvents");
    }

    function parseSummaryDate(value) {
      const match = String(value || "").match(/^\d{4}-\d{2}-\d{2}T[^\s]+/);
      return match ? match[0] : "";
    }

    async function refreshRelayAgent(isPaired) {
      if (!isPaired) {
        state.lastRelayPayload = null;
        renderRelayAgent(null, t("pairRelayHint"), t("notPaired"));
        return;
      }
      try {
        const payload = await api("/v1/relay/agent");
        state.lastRelayPayload = payload;
        renderRelayAgent(payload);
      } catch (error) {
        state.lastRelayPayload = null;
        renderRelayAgent(null, friendlyErrorMessage(error), isAuthError(error) ? t("apiKeyRequired") : t("relayUnavailable"));
        if (isAuthError(error)) {
          handleAuthError(error);
        }
      }
    }

    function renderRelayAgent(payload, unavailableMessage = t("cannotLoadRelay"), unavailableLabel = t("unavailable")) {
      if (!payload || payload.ok === false) {
        state.lastRelayPayload = null;
        const label = payload?.message || unavailableMessage;
        const isNotPaired = unavailableLabel === t("notPaired");
        setPill(elements.relayAgentPill, isNotPaired ? "warn" : "bad", unavailableLabel);
        elements.relayAgentRows.innerHTML = "";
        elements.pairedDevices.innerHTML = emptyHTML(t("noRelayDeviceData"));
        elements.pairedDevicesMeta.textContent = plural(0, "device");
        elements.relayPairingCodes.innerHTML = emptyHTML(t("noPairingCodeData"));
        elements.relayPairingCodesMeta.textContent = plural(0, "code");
        elements.pairingCodesTitle.textContent = t("pairingCodes");
        elements.relayEvents.innerHTML = "";
        if (!localEventCount()) {
          elements.relayEventsMeta.textContent = t("noRelayEvents");
        }
        renderOverview();
        return;
      }
      state.lastRelayPayload = payload;
      const agent = payload.agent || {};
      setPill(elements.relayAgentPill, "ok", t("relayPaired"));
      elements.relayAgentRows.innerHTML = "";
      renderPairedDevices(payload.devices || []);
      renderRelayPairingCodes(payload.pairingCodes || []);
      renderRelayEvents(payload.events || []);
      renderOverview();
    }

    function renderPairedDevices(devices) {
      elements.pairedDevicesMeta.textContent = plural(devices.length, "device");
      if (!devices.length) {
        elements.pairedDevices.innerHTML = emptyHTML(t("noPairedDevices"));
        return;
      }
      elements.pairedDevices.innerHTML = consoleTableHTML(
        [t("deviceColumn"), t("platform") + " / " + t("bundle"), t("deviceId"), t("token"), t("lastOnline"), t("action")],
        devices.map((device) => {
          const platform = [device.platform, device.apnsEnvironment].filter(Boolean).join(" / ") || "--";
          return consoleRowHTML([
            entityMainHTML(deviceIconHTML(platform), device.deviceName || t("deviceColumn"), device.appName || "QiuyuRemote"),
            consoleStackHTML([
              escapeHTML(platform),
              '<span class="console-muted">' + escapeHTML(device.bundleId || "--") + '</span>'
            ]),
            copyCellHTML(device.deviceId || "", 18),
            copyCellHTML(device.deviceToken || "", 16),
            shortDateHTML(device.updatedAt || device.tokenUpdatedAt),
            '<div class="console-actions"><button class="danger" type="button" data-unpair-device="' + escapeAttribute(device.deviceId || "") + '">' + escapeHTML(t("unpair")) + '</button></div>'
          ], "device-row");
        }),
        "device-row",
        "has-footer devices-table"
      ) + tableFooterHTML(devices.length);
      for (const button of elements.pairedDevices.querySelectorAll("[data-unpair-device]")) {
        button.addEventListener("click", () => unpairDevice(button.getAttribute("data-unpair-device") || ""));
      }
    }

    function renderRelayPairingCodes(codes) {
      const activeCodes = codes.filter((code) => code.status === "active").length;
      elements.pairingCodesTitle.textContent = t("pairingCodes");
      elements.relayPairingCodesMeta.textContent = activeCodes ? activeCodes + " " + t("availableCodes") : t("allUsed");
      if (!codes.length) {
        elements.relayPairingCodes.innerHTML = emptyHTML(t("noPairingCodes"));
        return;
      }
      elements.relayPairingCodes.innerHTML = consoleTableHTML(
        [t("codeColumn"), t("associatedDevice"), t("createdAt"), t("expiresAt"), t("status"), t("action")],
        codes.map((code) => {
          const statusClass = statusKind(code.status);
          const label = code.label || code.deviceName || t("pairingCode");
          const deviceLabel = code.deviceName || code.deviceId || "--";
          return consoleRowHTML([
            consoleMainHTML(code.code || "--", label),
            consoleMainHTML(deviceLabel, code.appName || "QiuyuRemote"),
            shortDateHTML(code.createdAt),
            shortDateHTML(code.expiresAt),
            pillHTML(t(code.status || "unknown"), statusClass),
            '<div class="console-actions"><button class="danger" type="button" data-delete-pairing-code="' + escapeAttribute(code.code || "") + '">' + escapeHTML(t("delete")) + '</button></div>'
          ], "code-row");
        }),
        "code-row",
        "has-footer codes-table"
      ) + tableFooterHTML(codes.length);
      for (const button of elements.relayPairingCodes.querySelectorAll("[data-delete-pairing-code]")) {
        button.addEventListener("click", () => deletePairingCode(button.getAttribute("data-delete-pairing-code") || ""));
      }
    }

    function renderRelayEvents(events) {
      state.lastRelayEvents = Array.isArray(events) ? events : [];
      elements.relayEventsMeta.textContent = events.length
        ? plural(events.length, "relayEvent")
        : localEventCount()
          ? plural(localEventCount(), "localEvent")
          : t("noRelayEvents");
      if (events.length && elements.eventOutput.textContent === t("noEventData")) {
        elements.eventOutput.hidden = true;
      }
      renderEventList();
    }

    function renderEventList() {
      const localEvents = (state.lastLocalEvents || []).map((event) => ({
        type: event.type || "local",
        level: event.level || "info",
        title: agentEventTitle(event.type),
        message: event.message || "",
        source: event.source || t("agent"),
        occurredAt: event.occurredAt || ""
      }));
      const relayEvents = (state.lastRelayEvents || []).map((event) => {
        const failed = Number(event.failed || 0);
        const sent = Number(event.sent || 0);
        const subject = event.task?.name || event.server?.name || event.deviceId || event.pairingCode || event.eventId || event.id || "";
        return {
          type: event.type || "relay",
          level: failed > 0 ? "warn" : sent > 0 ? "info" : "warn",
          title: event.type || t("relayEvent"),
          message: event.title || subject || event.body || event.type || t("relayEvent"),
          source: [event.body, t("sent") + " " + sent + " / " + t("failed") + " " + failed].filter(Boolean).join(" · "),
          occurredAt: event.recordedAt || event.occurredAt || ""
        };
      });
      const events = [...localEvents, ...relayEvents]
        .filter((event) => event.message)
        .sort((left, right) => Date.parse(right.occurredAt || "") - Date.parse(left.occurredAt || ""))
        .slice(0, 12);
      const counts = eventCounts(events);
      elements.relayEvents.innerHTML = "";
      elements.relayEventsMeta.textContent = events.length ? plural(events.length, "relayEvent") : t("noRelayEvents");
      if (!events.length) {
        elements.agentEvents.innerHTML = emptyHTML(t("noEventData"));
        return;
      }
      elements.agentEvents.innerHTML = eventFilterHTML(counts) + consoleTableHTML(
        [t("type"), t("message"), t("recorded")],
        events.map((event) => {
          const kind = event.level === "error" ? "bad" : event.level === "warn" ? "warn" : "ok";
          return consoleRowHTML([
            pillHTML(event.title, kind),
            '<div class="console-main"><div class="console-title-line event-message">' + escapeHTML(event.message || "") + '</div>' +
              '<div class="console-subline event-source">' + escapeHTML(event.source || "") + '</div></div>',
            '<span class="console-muted">' + formatDate(event.occurredAt) + '</span>'
          ], "event-row", ' data-agent-event="true"');
        }),
        "event-row"
      );
    }

    function eventCounts(events) {
      return {
        all: events.length,
        codeUsed: events.filter((event) => event.type === "pairing_code_used").length,
        pairingFailed: events.filter((event) => event.type === "pairing_failed").length,
        downloads: events.filter((event) => event.type === "download" || String(event.type || "").includes("download")).length,
        pushes: events.filter((event) => event.type === "push" || String(event.type || "").includes("push")).length
      };
    }

    function eventFilterHTML(counts) {
      const chips = [
        [t("allEvents"), counts.all, "ok"],
        [t("pairingCodeUsedShort"), counts.codeUsed, "warn"],
        [t("pairingFailedShort"), counts.pairingFailed, "bad"],
        [t("downloadsShort"), counts.downloads, "ok"],
        [t("pushesShort"), counts.pushes, "warn"]
      ];
      return '<div class="event-filter-row">' + chips.map(([label, count, kind]) => {
        return '<span class="event-chip ' + escapeAttribute(kind) + '">' + escapeHTML(label) + '<b>' + count + '</b></span>';
      }).join("") + '</div>';
    }

    function localEventCount() {
      return elements.agentEvents ? elements.agentEvents.querySelectorAll("[data-agent-event]").length : 0;
    }

    function renderServers(servers) {
      if (!servers.length) {
        elements.servers.innerHTML = emptyHTML(t("noServersConfigured"));
        return;
      }
      elements.servers.innerHTML = consoleTableHTML(
        [t("serviceName"), t("status"), t("lastHeartbeat"), t("summary"), t("action")],
        servers.map((server) => {
          const statusClass = server.online ? "ok" : "bad";
          const statusText = isCommandLineService(server)
            ? server.online ? t("available") : t("notAvailable")
            : server.online ? t("online") : t("offline");
          const typeLabel = server.type || "unknown";
          const subtitleParts = [];
          if (typeLabel && typeLabel !== (server.name || server.id)) subtitleParts.push(typeLabel);
          return consoleRowHTML([
            consoleMainHTML(server.name || server.id, subtitleParts.join(" · ")),
            statusTextHTML(statusText, statusClass),
            '<span class="console-muted">' + formatDate(server.lastMonitorAt) + '</span>',
            '<span class="console-wrap">' + escapeHTML(server.lastTaskSummary || t("noTaskSummary")) + '</span>',
            '<div class="console-actions"><button type="button" data-diagnostics="' + escapeAttribute(server.id || "") + '">' + escapeHTML(t("check")) + '</button></div>'
          ], "server-row");
        }),
        "server-row"
      );
      for (const button of elements.servers.querySelectorAll("[data-diagnostics]")) {
        button.addEventListener("click", () => runDiagnostics(button.getAttribute("data-diagnostics") || ""));
      }
    }

    function isCommandLineService(server) {
      return ["ytdlp", "yt-dlp"].includes(String(server?.type || "").toLowerCase());
    }

    async function runDiagnostics(serverId) {
      withBusy(elements.diagnosticsButton, true);
      elements.diagnosticsMeta.textContent = t("running");
      try {
        const path = serverId ? "/v1/diagnostics?server=" + encodeURIComponent(serverId) : "/v1/diagnostics";
        const payload = await api(path);
        elements.diagnosticsMeta.textContent = payload.ok ? t("passed") : t("needsAttention");
        elements.diagnosticsOutput.textContent = JSON.stringify(payload, null, 2);
      } catch (error) {
        elements.diagnosticsMeta.textContent = t("failed");
        const message = friendlyErrorMessage(error);
        elements.diagnosticsOutput.textContent = message;
        handleAuthError(error);
      } finally {
        withBusy(elements.diagnosticsButton, false);
      }
    }

    async function pairAgent() {
      const pairingCode = elements.pairingCode.value.trim();
      const agentName = elements.agentName.value.trim();
      if (!pairingCode) {
        showMessage(elements.pairMessage, t("enterPairingCode"), "error");
        return;
      }
      const button = document.getElementById("pairButton");
      withBusy(button, true);
      try {
        const payload = await api("/v1/agent/pair", {
          method: "POST",
          body: JSON.stringify({ pairingCode, agentName })
        });
        showMessage(elements.pairMessage, localizedAgentMessage(payload.message) || t("agentPaired"), "success");
        elements.pairingCode.value = "";
        await refreshState();
      } catch (error) {
        const message = friendlyErrorMessage(error);
        showMessage(elements.pairMessage, message, isAuthError(error) ? "warning" : "error");
        handleAuthError(error);
      } finally {
        withBusy(button, false);
      }
    }

    async function unpairDevice(deviceId) {
      if (!deviceId || !confirm(t("confirmUnpairDevice"))) return;
      await runRelayAction(
        () => api("/v1/relay/agent/devices/" + encodeURIComponent(deviceId), { method: "DELETE" }),
        t("deviceUnpaired")
      );
    }

    async function deletePairingCode(code) {
      if (!code || !confirm(t("confirmDeletePairingCode"))) return;
      await runRelayAction(
        () => api("/v1/relay/agent/pairing-codes/" + encodeURIComponent(code), { method: "DELETE" }),
        t("pairingCodeDeleted")
      );
    }

    async function runRelayAction(operation, successMessage) {
      withBusy(elements.refreshButton, true);
      try {
        await operation();
        showMessage(elements.authMessage, successMessage, "success");
        await refreshState();
      } catch (error) {
        if (!handleAuthError(error)) {
          showMessage(elements.authMessage, friendlyErrorMessage(error), "error");
        }
      } finally {
        withBusy(elements.refreshButton, false);
      }
    }

    async function sendTestPush() {
      withBusy(elements.testButton, true);
      try {
        const payload = await api("/v1/push/test", {
          method: "POST",
          body: JSON.stringify({})
        });
        elements.eventOutput.textContent = JSON.stringify(payload, null, 2);
        elements.eventOutput.hidden = false;
        showMessage(elements.authMessage, localizedAgentMessage(payload.message) || t("testEventSent"), "success");
      } catch (error) {
        const message = friendlyErrorMessage(error);
        elements.eventOutput.textContent = message;
        elements.eventOutput.hidden = false;
        handleAuthError(error);
      } finally {
        withBusy(elements.testButton, false);
      }
    }

    function withBusy(button, busy) {
      if (!button) return;
      button.disabled = busy;
    }

    function showMessage(element, text, kind) {
      element.textContent = text || "";
      element.className = "message" + (kind === "error" ? " error" : kind === "success" ? " success" : kind === "warning" ? " warning" : "");
    }

    function handleAuthError(error) {
      if (!isAuthError(error)) return false;
      const message = friendlyErrorMessage(error);
      state.authRequired = true;
      elements.apiKey.classList.add("needs-key");
      showMessage(elements.authMessage, message, "warning");
      if (document.activeElement !== elements.apiKey) {
        elements.apiKey.focus({ preventScroll: true });
      }
      return true;
    }

    function clearAuthAttention() {
      state.authRequired = false;
      elements.apiKey.classList.remove("needs-key");
    }

    function isAuthError(error) {
      return error?.status === 401 || error?.payload?.requiresApiKey === true;
    }

    function friendlyErrorMessage(error) {
      const localized = localizedAgentMessage(error?.message);
      if (isAuthError(error)) {
        return localized || t("authHint");
      }
      const message = String(error?.message || "");
      if (/non-JSON response|Unexpected token\s+</i.test(message)) {
        return t("relayHTMLHint");
      }
      return localized || t("requestFailed");
    }

    function localizedAgentMessage(value) {
      const message = String(value || "").trim();
      if (!message) return "";
      const exact = {
        "Invalid JSON response.": "invalidJSONResponse",
        "Not found": "notFound",
        "Not found.": "notFound",
        "Internal error": "internalError",
        "Internal error.": "internalError",
        "Remote access requires an Agent API key. Set apiKey in config.json, restart the Agent, then enter the same key in the Access section.": "remoteAccessRequiresApiKey",
        "Agent API key is missing or incorrect. Enter the apiKey from config.json in the Access section.": "agentApiKeyMissingOrIncorrect",
        "Missing pairing code.": "pairingCodeMissing",
        "Agent paired with Push Relay.": "agentPairedWithRelay",
        "Test event sent to Relay.": "testEventSent",
        "Push Agent is not paired with Push Relay.": "agentNotPairedWithRelay",
        "Relay pairing failed.": "relayPairingFailed",
        "Push event failed.": "pushEventFailed",
        "Pairing code was already used.": "pairingCodeAlreadyUsed",
        "Pairing code was not found.": "pairingCodeNotFound",
        "Pairing code was not found or has expired.": "pairingCodeNotFoundOrExpired",
        "Pairing code has expired.": "pairingCodeExpired",
        "Pairing code was revoked.": "pairingCodeRevoked",
        "Paired device is no longer registered.": "pairedDeviceMissing",
        "Device is not registered with Push Relay.": "deviceNotRegistered",
        "Existing Agent identity cannot be updated by pairing. Re-pair without static Relay credentials.": "existingAgentCannotUpdate",
        "Pairing code belongs to a different app than this Agent.": "pairingCodeDifferentApp"
      };
      const key = exact[message];
      if (key) return t(key);
      if (/^Unknown server:/i.test(message)) return t("unknownServer") + " " + message.replace(/^Unknown server:\s*/i, "");
      if (/^Pairing code\b.*\bwas already used\b/i.test(message)) return t("pairingCodeAlreadyUsed");
      if (/Push Agent is not paired with Push Relay/i.test(message)) return t("agentNotPairedWithRelay");
      return message;
    }

    function setPill(element, kind, text) {
      element.className = "pill " + kind;
      element.innerHTML = '<span class="dot"></span>' + escapeHTML(text);
    }

    function statusKind(status) {
      if (status === "active") return "ok";
      if (status === "used") return "warn";
      return "bad";
    }

    function applyTheme() {
      document.documentElement.setAttribute("data-theme", state.theme || "system");
    }

    function applyLanguage() {
      document.documentElement.lang = state.language === "zh" ? "zh-Hans" : "en";
      for (const node of document.querySelectorAll("[data-i18n]")) {
        node.textContent = t(node.getAttribute("data-i18n"));
      }
      for (const node of document.querySelectorAll("[data-i18n-placeholder]")) {
        node.setAttribute("placeholder", t(node.getAttribute("data-i18n-placeholder")));
      }
      elements.diagnosticsMeta.textContent = t("notRun");
      elements.pairedDevicesMeta.textContent = t("loading");
      elements.relayPairingCodesMeta.textContent = t("loading");
      elements.relayEventsMeta.textContent = t("noRelayEvents");
      setPill(elements.pairedPill, "warn", t("loading"));
      setPill(elements.relayAgentPill, "warn", t("loading"));
    }

    function t(key) {
      const dict = I18N[state.language] || I18N.en;
      return dict[key] || I18N.en[key] || key;
    }

    function emptyHTML(text) {
      return '<div class="empty">' + escapeHTML(text) + '</div>';
    }

    function row(label, value) {
      return '<div class="row"><dt>' + escapeHTML(label) + '</dt><dd>' + (value || "") + '</dd></div>';
    }

    function formatDate(value) {
      if (!value) return "--";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return escapeHTML(value);
      return escapeHTML(date.toLocaleString());
    }

    function shortText(value, limit = 32) {
      const text = String(value || "");
      return text.length > limit ? text.slice(0, limit - 1) + "…" : text;
    }

    function plural(count, key) {
      if (state.language === "zh") return count + " " + t(key);
      return count + " " + t(key) + (count === 1 ? "" : "s");
    }

    function escapeHTML(value) {
      return String(value ?? "").replace(/[&<>"']/g, (char) => {
        return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char];
      });
    }

    function escapeAttribute(value) {
      return escapeHTML(value).replace(/"/g, "&quot;");
    }

    refreshState();
    setInterval(refreshState, 30000);
  </script>
</body>
</html>`;
