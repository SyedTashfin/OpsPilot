export const dashboardStyles = String.raw`
:root {
  color-scheme: dark;
  --bg: #08090a;
  --panel: #0f1011;
  --surface: rgba(255, 255, 255, 0.035);
  --surface-strong: rgba(255, 255, 255, 0.06);
  --surface-raised: #191a1b;
  --border: rgba(255, 255, 255, 0.08);
  --border-soft: rgba(255, 255, 255, 0.05);
  --text: #f7f8f8;
  --muted: #8a8f98;
  --muted-strong: #d0d6e0;
  --dim: #62666d;
  --accent: #7170ff;
  --accent-strong: #5e6ad2;
  --green: #10b981;
  --amber: #f59e0b;
  --red: #ef4444;
  --blue: #38bdf8;
  --mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  --sans: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; overflow-x: hidden; }
body {
  margin: 0;
  min-height: 100vh;
  overflow-x: hidden;
  font-family: var(--sans);
  font-feature-settings: "cv01", "ss03";
  background:
    radial-gradient(circle at 15% 0%, rgba(113, 112, 255, 0.18), transparent 34rem),
    radial-gradient(circle at 85% 8%, rgba(56, 189, 248, 0.08), transparent 26rem),
    var(--bg);
  color: var(--text);
}
button, input, select { font: inherit; }
button { cursor: pointer; }
.app-shell { display: grid; grid-template-columns: 292px minmax(0, 1fr); min-height: 100vh; min-width: 0; max-width: 100vw; overflow-x: hidden; }
.sidebar {
  position: sticky;
  top: 0;
  min-width: 0;
  height: 100vh;
  padding: 28px 22px;
  border-right: 1px solid var(--border-soft);
  background: rgba(8, 9, 10, 0.82);
  backdrop-filter: blur(18px);
}
.brand { display: flex; gap: 14px; align-items: center; margin-bottom: 34px; }
.brand-mark {
  width: 42px; height: 42px; display: grid; place-items: center;
  border-radius: 12px;
  background: linear-gradient(145deg, #7170ff, #38bdf8);
  color: white; font-family: var(--mono); font-size: 12px; font-weight: 700;
  box-shadow: 0 0 0 1px rgba(255,255,255,.18), 0 14px 44px rgba(113,112,255,.25);
}
.brand h1, .topbar h2, .section-header h3, .hero-copy h3 { margin: 0; letter-spacing: -0.04em; }
.brand h1 { font-size: 17px; font-weight: 590; }
.eyebrow { margin: 0 0 7px; color: var(--muted); font: 600 11px/1.2 var(--mono); text-transform: uppercase; letter-spacing: .1em; }
.nav-list { display: grid; gap: 6px; }
.nav-list a {
  color: var(--muted-strong); text-decoration: none; padding: 10px 12px; border-radius: 10px;
  border: 1px solid transparent; font-size: 14px; font-weight: 510;
}
.nav-list a:hover, .nav-list a.active { color: var(--text); background: var(--surface); border-color: var(--border); }
.sidebar-card {
  position: absolute; left: 22px; right: 22px; bottom: 24px;
  display: flex; gap: 12px; padding: 14px; border-radius: 14px;
  border: 1px solid var(--border); background: var(--surface);
}
.sidebar-card strong { display: block; font-size: 13px; }
.sidebar-card p { margin: 4px 0 0; color: var(--muted); font-size: 12px; line-height: 1.45; }
.status-dot { width: 8px; height: 8px; border-radius: 999px; background: var(--dim); flex: 0 0 auto; margin-top: 5px; }
.status-dot.live { background: var(--green); box-shadow: 0 0 0 4px rgba(16,185,129,.12); }
.status-dot.warn { background: var(--amber); box-shadow: 0 0 0 4px rgba(245,158,11,.12); }
.status-dot.fail { background: var(--red); box-shadow: 0 0 0 4px rgba(239,68,68,.12); }
.main-panel { padding: 30px; max-width: 1540px; width: 100%; min-width: 0; margin: 0 auto; }
.topbar { display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; margin-bottom: 22px; }
.topbar h2 { font-size: clamp(32px, 4vw, 54px); font-weight: 510; line-height: .98; }
.topbar-actions { display: flex; gap: 10px; flex-wrap: wrap; }
.button {
  border: 1px solid var(--border); color: var(--text); border-radius: 9px; padding: 10px 14px;
  background: var(--surface); font-size: 13px; font-weight: 590;
}
.button.primary { background: var(--accent-strong); border-color: rgba(255,255,255,.18); box-shadow: 0 14px 30px rgba(94,106,210,.22); }
.button.ghost:hover, .button.primary:hover { filter: brightness(1.12); }
.alert-region { min-height: 0; }
.alert { margin: 0 0 14px; padding: 12px 14px; border: 1px solid var(--border); border-radius: 12px; background: rgba(245, 158, 11, .09); color: #fde68a; }
.hero-grid { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(320px, .9fr); gap: 18px; margin-bottom: 18px; }
.hero-card, .status-card, .section-panel {
  min-width: 0;
  border: 1px solid var(--border); border-radius: 22px; background: linear-gradient(180deg, rgba(255,255,255,.055), rgba(255,255,255,.025));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.04), 0 26px 70px rgba(0,0,0,.25);
}
.hero-card { padding: 28px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(300px, .85fr); gap: 24px; }
.hero-copy h3 { font-size: clamp(34px, 5vw, 64px); line-height: .98; font-weight: 510; }
.hero-copy p:last-child { color: var(--muted-strong); max-width: 760px; line-height: 1.65; }
.hero-stack { display: grid; gap: 10px; align-content: end; min-width: 0; }
.hero-stack div, .status-item, .metric-card, .detail-card, details, .langfuse-panel-inner {
  border: 1px solid var(--border-soft); border-radius: 14px; background: rgba(255,255,255,.035); padding: 14px;
}
.hero-stack span, .metric-label, .detail-label { display: block; color: var(--muted); font: 500 11px/1.4 var(--mono); text-transform: uppercase; letter-spacing: .08em; }
.hero-stack strong { display: block; margin-top: 7px; color: var(--text); font-size: 14px; line-height: 1.4; }
.status-card, .section-panel { padding: 20px; }
.status-grid { display: grid; gap: 10px; }
.status-item { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.status-item span:first-child { color: var(--muted-strong); font-size: 13px; }
.status-item span:last-child { font-family: var(--mono); font-size: 12px; color: var(--text); }
.section-panel { margin-top: 18px; scroll-margin-top: 20px; }
.section-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
.section-header h3 { font-size: 26px; font-weight: 510; }
.badge { display: inline-flex; align-items: center; border: 1px solid var(--border); border-radius: 999px; padding: 6px 10px; color: var(--muted-strong); background: rgba(255,255,255,.035); font: 500 12px var(--mono); white-space: nowrap; }
.badge.success { color: #bbf7d0; border-color: rgba(16,185,129,.35); background: rgba(16,185,129,.08); }
.badge.error { color: #fecaca; border-color: rgba(239,68,68,.35); background: rgba(239,68,68,.08); }
.badge.muted { color: var(--muted); }
.metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.metric-card { min-height: 116px; display: grid; align-content: space-between; }
.metric-value { margin-top: 12px; font-size: 30px; font-weight: 590; letter-spacing: -.04em; }
.metric-footnote { margin-top: 7px; color: var(--muted); font-size: 12px; }
.filters { display: flex; gap: 10px; flex-wrap: wrap; }
input, select { color: var(--text); background: rgba(255,255,255,.04); border: 1px solid var(--border); border-radius: 9px; padding: 10px 12px; min-height: 40px; }
.table-wrap { overflow-x: auto; border: 1px solid var(--border-soft); border-radius: 14px; }
table { width: 100%; border-collapse: collapse; min-width: 780px; }
th, td { text-align: left; padding: 14px 16px; border-bottom: 1px solid var(--border-soft); vertical-align: middle; }
th { color: var(--muted); font: 600 11px var(--mono); text-transform: uppercase; letter-spacing: .08em; }
td { color: var(--muted-strong); font-size: 14px; }
tr[data-incident-id] { cursor: pointer; }
tr[data-incident-id]:hover, tr.selected { background: rgba(113,112,255,.08); }
.investigation-grid { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(340px, .8fr); gap: 14px; }
.detail-card h4, details summary { margin: 0 0 10px; color: var(--text); font-size: 16px; font-weight: 590; }
.detail-card p, details p { color: var(--muted-strong); line-height: 1.6; margin: 0; }
.detail-card.full { grid-column: 1 / -1; }
.root-cause { font-size: 18px; }
.confidence-ring { width: 132px; height: 132px; border-radius: 999px; display: grid; place-items: center; background: conic-gradient(var(--green) var(--confidence), rgba(255,255,255,.08) 0); margin: 8px auto 0; }
.confidence-ring span { width: 104px; height: 104px; border-radius: inherit; display: grid; place-items: center; background: #101112; font-size: 24px; font-weight: 590; }
.timeline-list { display: grid; gap: 12px; position: relative; }
.timeline-item { display: grid; grid-template-columns: 34px minmax(0, 1fr) auto; gap: 12px; align-items: start; padding: 14px; border: 1px solid var(--border-soft); border-radius: 14px; background: rgba(255,255,255,.03); }
.timeline-index { width: 28px; height: 28px; border-radius: 999px; display: grid; place-items: center; background: rgba(113,112,255,.18); color: #c7d2fe; font-family: var(--mono); font-size: 12px; }
.timeline-title { margin: 0; font-weight: 590; }
.timeline-meta { margin-top: 5px; color: var(--muted); font: 12px var(--mono); }
.evidence-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
details { padding: 0; overflow: hidden; }
details summary { cursor: pointer; list-style: none; padding: 14px; margin: 0; display: flex; justify-content: space-between; gap: 14px; }
details summary::-webkit-details-marker { display: none; }
.details-body { border-top: 1px solid var(--border-soft); padding: 14px; color: var(--muted-strong); }
pre { overflow: auto; max-width: 100%; margin: 10px 0 0; color: #c7d2fe; background: rgba(0,0,0,.26); border: 1px solid var(--border-soft); border-radius: 10px; padding: 12px; font: 12px/1.5 var(--mono); }
.langfuse-panel-inner { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.langfuse-action { grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: center; gap: 14px; padding-top: 12px; border-top: 1px solid var(--border-soft); }
a.button { text-decoration: none; display: inline-flex; align-items: center; justify-content: center; }
.empty-state { color: var(--muted); border: 1px dashed var(--border); border-radius: 14px; padding: 18px; }
@media (max-width: 1180px) {
  .app-shell { grid-template-columns: 1fr; }
  .sidebar { position: relative; height: auto; display: block; }
  .sidebar-card { position: static; margin-top: 18px; }
  .nav-list { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .hero-grid, .hero-card, .investigation-grid { grid-template-columns: 1fr; }
  .metric-grid, .langfuse-panel-inner { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 720px) {
  .main-panel, .sidebar { padding: 18px; }
  .topbar, .section-header { display: grid; }
  .nav-list, .metric-grid, .evidence-grid, .langfuse-panel-inner { grid-template-columns: 1fr; }
  .timeline-item { grid-template-columns: 30px 1fr; }
  .timeline-item .badge { grid-column: 2; justify-self: start; }
}
`;
