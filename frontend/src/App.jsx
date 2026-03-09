import { useState, useEffect, useCallback, useRef } from "react";

// ─────────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────────
const API = "http://localhost:5000/api";

// ─────────────────────────────────────────────
//  STYLES (injected into <head>)
// ─────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Mono:wght@300;400;500&family=Tenor+Sans&display=swap');

  :root {
    --cream: #FAF3EC;
    --cream-dark: #F0E4D4;
    --cream-mid: #E8D5C0;
    --red: #C0392B;
    --red-deep: #922B21;
    --red-light: #E74C3C;
    --red-blush: #FDECEA;
    --gold: #B8860B;
    --charcoal: #2C1810;
    --charcoal-mid: #4A2C20;
    --text: #3D1F15;
    --muted: #7A5C52;
    --border: #E2D0C0;
    --mono: 'DM Mono', monospace;
    --serif: 'Cormorant Garamond', serif;
    --sans: 'Tenor Sans', sans-serif;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: var(--cream);
    color: var(--text);
    font-family: var(--serif);
    font-size: 15px;
    line-height: 1.6;
  }

  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: var(--cream-dark); }
  ::-webkit-scrollbar-thumb { background: var(--red); border-radius: 3px; }

  .lc-app {
    display: grid;
    grid-template-columns: 260px 1fr;
    min-height: 100vh;
  }

  /* ── SIDEBAR ── */
  .sidebar {
    background: var(--charcoal);
    display: flex;
    flex-direction: column;
    padding: 0;
    position: sticky;
    top: 0;
    height: 100vh;
    overflow-y: auto;
  }

  .sidebar-brand {
    padding: 28px 24px 20px;
    border-bottom: 1px solid rgba(255,255,255,0.07);
  }

  .brand-name {
    font-family: var(--serif);
    font-size: 26px;
    font-weight: 300;
    font-style: italic;
    color: var(--cream);
    line-height: 1.1;
  }

  .brand-name span { color: var(--red-light); }

  .brand-sub {
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--muted);
    margin-top: 5px;
  }

  .sidebar-nav { flex: 1; padding: 16px 0; }

  .nav-section-label {
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.2);
    padding: 12px 24px 6px;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 24px;
    cursor: pointer;
    transition: all 0.18s;
    border-left: 2px solid transparent;
    font-family: var(--sans);
    font-size: 12px;
    letter-spacing: 0.06em;
    color: rgba(255,255,255,0.45);
  }

  .nav-item:hover {
    background: rgba(255,255,255,0.04);
    color: rgba(255,255,255,0.8);
  }

  .nav-item.active {
    border-left-color: var(--red-light);
    background: rgba(192,57,43,0.12);
    color: var(--cream);
  }

  .nav-item .nav-icon { font-size: 14px; opacity: 0.7; }

  .sidebar-status {
    padding: 16px 24px;
    border-top: 1px solid rgba(255,255,255,0.07);
  }

  .status-dot {
    display: inline-block;
    width: 7px; height: 7px;
    border-radius: 50%;
    margin-right: 8px;
    vertical-align: middle;
  }

  .status-dot.green { background: #27C93F; box-shadow: 0 0 6px rgba(39,201,63,0.5); }
  .status-dot.red { background: var(--red-light); }
  .status-dot.grey { background: rgba(255,255,255,0.2); }

  .status-text {
    font-family: var(--mono);
    font-size: 10px;
    color: rgba(255,255,255,0.4);
  }

  .status-value {
    font-family: var(--mono);
    font-size: 11px;
    color: rgba(255,255,255,0.7);
  }

  /* ── MAIN ── */
  .main {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background: var(--cream);
  }

  .topbar {
    background: white;
    border-bottom: 1px solid var(--border);
    padding: 0 36px;
    height: 62px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .topbar-title {
    font-family: var(--serif);
    font-size: 20px;
    font-weight: 300;
    font-style: italic;
    color: var(--charcoal);
  }

  .topbar-actions { display: flex; gap: 10px; align-items: center; }

  .btn {
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    padding: 8px 18px;
    border: none;
    cursor: pointer;
    transition: all 0.18s;
    border-radius: 2px;
  }

  .btn-primary {
    background: var(--red);
    color: white;
  }

  .btn-primary:hover { background: var(--red-deep); }
  .btn-primary:disabled { background: var(--muted); cursor: not-allowed; }

  .btn-outline {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--muted);
  }

  .btn-outline:hover {
    border-color: var(--red);
    color: var(--red);
  }

  .btn-ghost {
    background: transparent;
    color: var(--muted);
    padding: 6px 12px;
  }

  .btn-ghost:hover { color: var(--red); }

  .content { padding: 32px 36px; flex: 1; }

  /* ── UPLOAD PANEL ── */
  .upload-zone {
    border: 2px dashed var(--cream-mid);
    border-radius: 6px;
    padding: 48px 32px;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;
    background: white;
    position: relative;
  }

  .upload-zone:hover, .upload-zone.drag-over {
    border-color: var(--red);
    background: var(--red-blush);
  }

  .upload-icon { font-size: 36px; margin-bottom: 12px; opacity: 0.5; }

  .upload-title {
    font-family: var(--serif);
    font-size: 20px;
    font-weight: 300;
    color: var(--charcoal);
    margin-bottom: 6px;
  }

  .upload-sub {
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
  }

  /* ── STAT CARDS ── */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 14px;
    margin-bottom: 28px;
  }

  .stat-card {
    background: white;
    border: 1px solid var(--border);
    padding: 20px 18px;
    position: relative;
    overflow: hidden;
  }

  .stat-card::after {
    content: '';
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 2px;
    background: var(--red);
    transform: scaleX(0);
    transition: transform 0.3s;
  }

  .stat-card:hover::after { transform: scaleX(1); }

  .stat-label {
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 8px;
  }

  .stat-value {
    font-family: var(--serif);
    font-size: 32px;
    font-weight: 300;
    color: var(--charcoal);
    line-height: 1;
  }

  .stat-value.red { color: var(--red); }
  .stat-value.gold { color: var(--gold); }

  .stat-sub {
    font-family: var(--mono);
    font-size: 9px;
    color: var(--muted);
    margin-top: 4px;
  }

  /* ── SECTION HEADER ── */
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--border);
  }

  .section-title {
    font-family: var(--serif);
    font-size: 18px;
    font-weight: 300;
    font-style: italic;
    color: var(--charcoal);
  }

  .section-badge {
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    padding: 3px 10px;
    background: var(--red-blush);
    color: var(--red-deep);
    border-radius: 2px;
  }

  /* ── BUNDLE CARDS ── */
  .bundles-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 14px;
    margin-bottom: 32px;
  }

  .bundle-card {
    background: white;
    border: 1px solid var(--border);
    padding: 18px;
    transition: transform 0.2s, box-shadow 0.2s;
    position: relative;
  }

  .bundle-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(192,57,43,0.08);
  }

  .bundle-rank {
    position: absolute;
    top: -1px; right: -1px;
    background: var(--red);
    color: white;
    font-family: var(--mono);
    font-size: 9px;
    padding: 3px 8px;
    letter-spacing: 0.1em;
  }

  .bundle-items {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 12px;
  }

  .bundle-item-tag {
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: 0.08em;
    padding: 3px 9px;
    background: var(--cream-dark);
    color: var(--charcoal-mid);
    border-radius: 2px;
  }

  .bundle-arrow {
    font-size: 13px;
    color: var(--red);
    self-align: center;
  }

  .bundle-metrics {
    display: flex;
    gap: 12px;
    margin-top: 10px;
  }

  .bundle-metric { text-align: center; }

  .bm-val {
    font-family: var(--mono);
    font-size: 13px;
    color: var(--red);
    display: block;
  }

  .bm-label {
    font-family: var(--mono);
    font-size: 8px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted);
  }

  /* ── RULES TABLE ── */
  .table-wrap { overflow-x: auto; background: white; border: 1px solid var(--border); }

  table { width: 100%; border-collapse: collapse; font-size: 13px; }

  th {
    background: var(--charcoal);
    color: var(--cream);
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    padding: 10px 14px;
    text-align: left;
    white-space: nowrap;
  }

  td {
    padding: 9px 14px;
    border-bottom: 1px solid var(--cream-dark);
    color: var(--text);
    vertical-align: top;
  }

  tr:hover td { background: rgba(192,57,43,0.03); }

  .tag {
    display: inline-block;
    font-family: var(--mono);
    font-size: 9px;
    padding: 2px 7px;
    border-radius: 2px;
    margin: 1px;
  }

  .tag-ant { background: #EBF5FB; color: #1A5276; }
  .tag-con { background: rgba(192,57,43,0.08); color: var(--red-deep); }

  .lift-bar {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .lift-track {
    width: 60px; height: 4px;
    background: var(--cream-dark);
    border-radius: 2px;
    overflow: hidden;
  }

  .lift-fill {
    height: 100%;
    background: var(--red);
    border-radius: 2px;
  }

  .lift-num {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--red);
    min-width: 32px;
  }

  /* ── BAR CHART ── */
  .bar-chart { padding: 8px 0; }

  .bar-row {
    display: grid;
    grid-template-columns: 180px 1fr 50px;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
  }

  .bar-label {
    font-family: var(--mono);
    font-size: 10px;
    color: var(--text);
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
    text-align: right;
  }

  .bar-track {
    height: 16px;
    background: var(--cream-dark);
    border-radius: 2px;
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    background: linear-gradient(to right, var(--red-deep), var(--red-light));
    border-radius: 2px;
    transition: width 0.6s ease;
  }

  .bar-pct {
    font-family: var(--mono);
    font-size: 10px;
    color: var(--muted);
  }

  /* ── DRIFT ALERTS ── */
  .drift-list { display: flex; flex-direction: column; gap: 8px; }

  .drift-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: white;
    border: 1px solid var(--border);
    border-left: 3px solid var(--red);
    padding: 10px 14px;
    font-family: var(--mono);
    font-size: 11px;
  }

  .drift-item.positive { border-left-color: #27C93F; }
  .drift-item.negative { border-left-color: var(--red-light); }

  .drift-item-name { color: var(--charcoal); font-weight: 500; }
  .drift-change { color: var(--red); }
  .drift-change.up { color: #1A7A2E; }

  /* ── VERSION TIMELINE ── */
  .versions-list { display: flex; flex-direction: column; gap: 10px; }

  .version-card {
    background: white;
    border: 1px solid var(--border);
    padding: 14px 18px;
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 16px;
    align-items: center;
    transition: border-color 0.2s;
  }

  .version-card.current { border-color: var(--red); }

  .version-badge {
    background: var(--charcoal);
    color: var(--cream);
    font-family: var(--mono);
    font-size: 11px;
    padding: 4px 12px;
    letter-spacing: 0.1em;
  }

  .version-badge.current { background: var(--red); }

  .version-meta {
    font-family: var(--mono);
    font-size: 10px;
    color: var(--muted);
    display: flex;
    gap: 18px;
  }

  .version-meta span strong {
    color: var(--charcoal);
    font-weight: 500;
  }

  /* ── PROMOTIONS ── */
  .promo-list { display: flex; flex-direction: column; gap: 10px; }

  .promo-card {
    background: white;
    border: 1px solid var(--border);
    padding: 14px 18px;
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .promo-icon { font-size: 20px; }

  .promo-bundle { flex: 1; }

  .promo-items {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-bottom: 4px;
  }

  .promo-discount {
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .promo-stats {
    font-family: var(--mono);
    font-size: 11px;
    text-align: right;
  }

  .promo-lift { color: var(--red); font-size: 14px; display: block; }
  .promo-lift-label { color: var(--muted); font-size: 9px; letter-spacing: 0.1em; }

  /* ── CROSSSELL WIDGET ── */
  .crosssell-input {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }

  .cart-input {
    flex: 1;
    min-width: 220px;
    border: 1px solid var(--border);
    padding: 9px 14px;
    font-family: var(--mono);
    font-size: 12px;
    color: var(--text);
    background: white;
    outline: none;
    transition: border-color 0.2s;
  }

  .cart-input:focus { border-color: var(--red); }

  .crosssell-results { display: flex; flex-direction: column; gap: 8px; }

  .cs-card {
    background: white;
    border: 1px solid var(--border);
    padding: 12px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .cs-suggest {
    font-family: var(--serif);
    font-size: 15px;
    color: var(--charcoal);
  }

  .cs-reason {
    font-family: var(--mono);
    font-size: 9px;
    color: var(--muted);
    margin-top: 3px;
  }

  .cs-metrics {
    font-family: var(--mono);
    font-size: 11px;
    text-align: right;
    white-space: nowrap;
  }

  /* ── LOADING SPINNER ── */
  @keyframes spin { to { transform: rotate(360deg); } }

  .spinner {
    width: 20px; height: 20px;
    border: 2px solid var(--cream-mid);
    border-top-color: var(--red);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    display: inline-block;
  }

  .loading-overlay {
    position: fixed;
    inset: 0;
    background: rgba(250,243,236,0.85);
    backdrop-filter: blur(4px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 100;
    gap: 16px;
  }

  .loading-text {
    font-family: var(--serif);
    font-size: 18px;
    font-style: italic;
    color: var(--charcoal);
  }

  .loading-sub {
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--muted);
  }

  /* ── EMPTY STATE ── */
  .empty-state {
    text-align: center;
    padding: 80px 32px;
  }

  .empty-icon { font-size: 48px; margin-bottom: 20px; opacity: 0.3; }

  .empty-title {
    font-family: var(--serif);
    font-size: 24px;
    font-weight: 300;
    font-style: italic;
    color: var(--charcoal-mid);
    margin-bottom: 8px;
  }

  .empty-sub {
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--muted);
  }

  /* ── TOAST ── */
  .toast-container {
    position: fixed;
    bottom: 28px;
    right: 28px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 200;
  }

  .toast {
    background: var(--charcoal);
    color: var(--cream);
    font-family: var(--mono);
    font-size: 11px;
    padding: 12px 18px;
    border-radius: 2px;
    border-left: 3px solid var(--red-light);
    min-width: 260px;
    animation: slideIn 0.25s ease;
  }

  .toast.success { border-left-color: #27C93F; }
  .toast.error { border-left-color: var(--red-light); }

  @keyframes slideIn {
    from { transform: translateX(20px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }

  /* ── MISC ── */
  .divider { height: 1px; background: var(--border); margin: 24px 0; }

  .pill {
    display: inline-block;
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: 0.1em;
    padding: 2px 8px;
    border-radius: 2px;
  }

  .pill-red { background: rgba(192,57,43,0.10); color: var(--red-deep); }
  .pill-green { background: rgba(39,201,63,0.10); color: #1A7A2E; }
  .pill-grey { background: var(--cream-dark); color: var(--muted); }

  .flex { display: flex; }
  .flex-col { flex-direction: column; }
  .gap-4 { gap: 16px; }
  .items-center { align-items: center; }
  .justify-between { justify-content: space-between; }
  .mb-2 { margin-bottom: 8px; }
  .mb-4 { margin-bottom: 16px; }
  .mb-6 { margin-bottom: 24px; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }

  @media (max-width: 900px) {
    .lc-app { grid-template-columns: 1fr; }
    .sidebar { position: relative; height: auto; }
    .grid-2, .grid-3 { grid-template-columns: 1fr; }
    .bar-row { grid-template-columns: 120px 1fr 40px; }
  }
`;

// ─────────────────────────────────────────────
//  INJECT CSS
// ─────────────────────────────────────────────
function StyleInjector() {
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);
  return null;
}

// ─────────────────────────────────────────────
//  TOAST SYSTEM
// ─────────────────────────────────────────────
function ToastContainer({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
//  STAT CARD
// ─────────────────────────────────────────────
function StatCard({ label, value, sub, color }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${color || ""}`}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────
//  LIFT BAR
// ─────────────────────────────────────────────
function LiftBar({ lift }) {
  const pct = Math.min((lift / 5) * 100, 100);
  return (
    <div className="lift-bar">
      <div className="lift-track">
        <div className="lift-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="lift-num">{lift?.toFixed(2)}</span>
    </div>
  );
}

// ─────────────────────────────────────────────
//  OVERVIEW PAGE
// ─────────────────────────────────────────────
function OverviewPage({ data }) {
  if (!data)
    return (
      <div className="empty-state">
        <div className="empty-icon">🌸</div>
        <div className="empty-title">No data loaded yet</div>
        <div className="empty-sub">Upload a CSV dataset to begin analysis</div>
      </div>
    );

  const latest = data.version_history?.[data.version_history.length - 1];

  return (
    <div>
      <div className="stats-grid">
        <StatCard label="Transactions" value={data.n_transactions?.toLocaleString()} sub="total loaded" />
        <StatCard label="Frequent Itemsets" value={data.n_itemsets?.toLocaleString()} sub="above min support" color="red" />
        <StatCard label="Association Rules" value={data.n_rules?.toLocaleString()} sub="after filtering" />
        <StatCard label="Avg Lift" value={data.avg_lift?.toFixed(3)} sub="rule quality" color="gold" />
        <StatCard label="Avg Confidence" value={`${(data.avg_confidence * 100)?.toFixed(1)}%`} sub="directional strength" />
        <StatCard label="Hit Rate" value={`${(data.hit_rate * 100)?.toFixed(1)}%`} sub="10% holdout eval" color="red" />
        <StatCard label="Min Support" value={data.min_support?.toFixed(3)} sub="adaptive threshold" />
        <StatCard label="Iterations" value={data.version_history?.length || 0} sub="learning cycles" />
      </div>

      {/* Drift alerts */}
      {data.drift_alerts?.length > 0 && (
        <div className="mb-6">
          <div className="section-header">
            <h2 className="section-title">Drift Alerts</h2>
            <span className="section-badge">{data.drift_alerts.length} detected</span>
          </div>
          <div className="drift-list">
            {data.drift_alerts.map((d, i) => (
              <div key={i} className={`drift-item ${d.direction === "↑" ? "positive" : "negative"}`}>
                <span className="drift-item-name">{d.item}</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)" }}>
                  {d.prev_support?.toFixed(3)} → {d.curr_support?.toFixed(3)}
                </span>
                <span className={`drift-change ${d.direction === "↑" ? "up" : ""}`}>
                  {d.direction} {d.change_pct}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Basket size distribution */}
      {data.basket_size_dist && (
        <div className="mb-6">
          <div className="section-header">
            <h2 className="section-title">Basket Size Distribution</h2>
          </div>
          <div className="bar-chart">
            {Object.entries(data.basket_size_dist)
              .sort((a, b) => Number(a[0]) - Number(b[0]))
              .map(([sz, count]) => {
                const maxCount = Math.max(...Object.values(data.basket_size_dist));
                return (
                  <div key={sz} className="bar-row">
                    <div className="bar-label">{sz} item{sz !== "1" ? "s" : ""}</div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${(count / maxCount) * 100}%` }} />
                    </div>
                    <div className="bar-pct">{count}</div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Engine config */}
      <div className="mb-6">
        <div className="section-header">
          <h2 className="section-title">Engine Configuration</h2>
          {data.threshold_changed && <span className="pill pill-red">Threshold Adapted</span>}
        </div>
        <div style={{ background: "white", border: "1px solid var(--border)", padding: "18px 20px", fontFamily: "var(--mono)", fontSize: 11, lineHeight: 2 }}>
          <div><span style={{ color: "var(--muted)" }}>min_support:</span>{" "}<strong style={{ color: "var(--red)" }}>{data.min_support}</strong></div>
          <div><span style={{ color: "var(--muted)" }}>min_confidence:</span>{" "}<strong>{data.min_confidence}</strong></div>
          <div><span style={{ color: "var(--muted)" }}>score weights:</span>{" "}
            {Object.entries(data.weights || {}).map(([k, v]) => (
              <span key={k} style={{ marginRight: 12 }}>{k}: <strong style={{ color: "var(--red)" }}>{v}</strong></span>
            ))}
          </div>
          <div><span style={{ color: "var(--muted)" }}>elapsed:</span>{" "}<strong>{data.elapsed_seconds}s</strong></div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  ITEM FREQUENCIES PAGE
// ─────────────────────────────────────────────
function FrequenciesPage({ data }) {
  if (!data?.item_frequencies)
    return <div className="empty-state"><div className="empty-icon">📊</div><div className="empty-title">No data yet</div></div>;

  const items = Object.entries(data.item_frequencies);
  const maxCount = Math.max(...items.map(([, v]) => v.count));

  return (
    <div>
      <div className="stats-grid">
        <StatCard label="Unique Items" value={items.length} />
        <StatCard label="Top Item" value={items[0]?.[0].split(" ")[0] + "…"} sub={`${(items[0]?.[1].support * 100).toFixed(1)}% support`} color="red" />
        <StatCard label="Total Transactions" value={data.n_transactions?.toLocaleString()} />
      </div>

      <div className="section-header">
        <h2 className="section-title">Item Frequency Rankings</h2>
        <span className="section-badge">{items.length} unique items</span>
      </div>

      <div style={{ background: "white", border: "1px solid var(--border)", padding: "20px 24px" }}>
        <div className="bar-chart">
          {items.map(([item, info]) => (
            <div key={item} className="bar-row">
              <div className="bar-label" title={item}>{item}</div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${(info.count / maxCount) * 100}%` }} />
              </div>
              <div className="bar-pct">{(info.support * 100).toFixed(1)}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  BUNDLES PAGE
// ─────────────────────────────────────────────
function BundlesPage({ data }) {
  if (!data?.top_bundles?.length)
    return <div className="empty-state"><div className="empty-icon">🛍️</div><div className="empty-title">No bundles yet</div></div>;

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Top Bundle Recommendations</h2>
        <span className="section-badge">by composite score</span>
      </div>

      <div className="bundles-grid">
        {data.top_bundles.map((rule, i) => (
          <div key={i} className="bundle-card">
            <div className="bundle-rank">#{i + 1}</div>
            <div className="bundle-items">
              {rule.antecedents?.map((a) => (
                <span key={a} className="bundle-item-tag">{a}</span>
              ))}
              <span className="bundle-arrow">→</span>
              {rule.consequents?.map((c) => (
                <span key={c} className="tag tag-con">{c}</span>
              ))}
            </div>
            <div className="bundle-metrics">
              <div className="bundle-metric">
                <span className="bm-val">{rule.lift?.toFixed(2)}×</span>
                <span className="bm-label">Lift</span>
              </div>
              <div className="bundle-metric">
                <span className="bm-val">{(rule.confidence * 100)?.toFixed(0)}%</span>
                <span className="bm-label">Conf</span>
              </div>
              <div className="bundle-metric">
                <span className="bm-val">{(rule.support * 100)?.toFixed(1)}%</span>
                <span className="bm-label">Sup</span>
              </div>
              <div className="bundle-metric">
                <span className="bm-val" style={{ color: "var(--gold)" }}>{rule.composite_score?.toFixed(3)}</span>
                <span className="bm-label">Score</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Promotions */}
      {data.promotions?.length > 0 && (
        <>
          <div className="section-header">
            <h2 className="section-title">Promotion Candidates</h2>
            <span className="section-badge">lift ≥ 1.8, conf ≥ 55%</span>
          </div>
          <div className="promo-list">
            {data.promotions.map((p, i) => (
              <div key={i} className="promo-card">
                <div className="promo-icon">🏷️</div>
                <div className="promo-bundle">
                  <div className="promo-items">
                    {p.bundle?.map((item) => (
                      <span key={item} className="bundle-item-tag">{item}</span>
                    ))}
                  </div>
                  <div className="promo-discount">{p.discount} · {p.rationale}</div>
                </div>
                <div className="promo-stats">
                  <span className="promo-lift">{p.lift?.toFixed(2)}×</span>
                  <span className="promo-lift-label">LIFT</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Shelf placement */}
      {data.shelf_placement?.length > 0 && (
        <>
          <div className="section-header" style={{ marginTop: 28 }}>
            <h2 className="section-title">Shelf Placement Suggestions</h2>
            <span className="section-badge">lift ≥ 2.0</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.shelf_placement.map((p, i) => (
              <div key={i} style={{ background: "white", border: "1px solid var(--border)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 16, fontFamily: "var(--mono)", fontSize: 11 }}>
                <span>📦</span>
                <span style={{ color: "var(--text)" }}>{p.item_a?.join(", ")}</span>
                <span style={{ color: "var(--muted)" }}>←→</span>
                <span style={{ color: "var(--red-deep)" }}>{p.item_b?.join(", ")}</span>
                <span style={{ marginLeft: "auto", color: "var(--red)" }}>lift {p.lift?.toFixed(2)}×</span>
                <span style={{ color: "var(--muted)", fontSize: 9 }}>{p.advice}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
//  RULES TABLE PAGE
// ─────────────────────────────────────────────
function RulesPage({ data }) {
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState("composite_score");
  const [sortDir, setSortDir] = useState("desc");

  if (!data?.rules_preview?.length)
    return <div className="empty-state"><div className="empty-icon">📋</div><div className="empty-title">No rules yet</div></div>;

  const rules = [...data.rules_preview]
    .filter((r) => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        r.antecedents?.join(" ").toLowerCase().includes(s) ||
        r.consequents?.join(" ").toLowerCase().includes(s)
      );
    })
    .sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      return dir * (a[sortCol] - b[sortCol]);
    });

  const toggleSort = (col) => {
    if (col === sortCol) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("desc"); }
  };

  const SortIcon = ({ col }) =>
    sortCol === col ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="section-title" style={{ fontFamily: "var(--serif)", fontSize: 18, fontStyle: "italic" }}>
          Association Rules
        </div>
        <div className="flex gap-4 items-center">
          <input
            className="cart-input"
            style={{ width: 220 }}
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="section-badge">{rules.length} rules</span>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Antecedents</th>
              <th>Consequents</th>
              <th onClick={() => toggleSort("support")} style={{ cursor: "pointer" }}>Support<SortIcon col="support" /></th>
              <th onClick={() => toggleSort("confidence")} style={{ cursor: "pointer" }}>Confidence<SortIcon col="confidence" /></th>
              <th onClick={() => toggleSort("lift")} style={{ cursor: "pointer" }}>Lift<SortIcon col="lift" /></th>
              <th onClick={() => toggleSort("leverage")} style={{ cursor: "pointer" }}>Leverage<SortIcon col="leverage" /></th>
              <th onClick={() => toggleSort("conviction")} style={{ cursor: "pointer" }}>Conviction<SortIcon col="conviction" /></th>
              <th onClick={() => toggleSort("composite_score")} style={{ cursor: "pointer" }}>Score<SortIcon col="composite_score" /></th>
            </tr>
          </thead>
          <tbody>
            {rules.slice(0, 100).map((r, i) => (
              <tr key={i}>
                <td>
                  {r.antecedents?.map((a) => (
                    <span key={a} className="tag tag-ant">{a}</span>
                  ))}
                </td>
                <td>
                  {r.consequents?.map((c) => (
                    <span key={c} className="tag tag-con">{c}</span>
                  ))}
                </td>
                <td style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{(r.support * 100)?.toFixed(2)}%</td>
                <td style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{(r.confidence * 100)?.toFixed(1)}%</td>
                <td><LiftBar lift={r.lift} /></td>
                <td style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{r.leverage?.toFixed(4)}</td>
                <td style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{r.conviction?.toFixed(3)}</td>
                <td>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--gold)", fontWeight: 500 }}>
                    {r.composite_score?.toFixed(4)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rules.length > 100 && (
        <div style={{ textAlign: "center", marginTop: 12, fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)" }}>
          Showing top 100 of {rules.length} rules
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
//  CROSS-SELL PAGE
// ─────────────────────────────────────────────
function CrosssellPage({ data }) {
  const [cartInput, setCartInput] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!cartInput.trim()) return;
    setLoading(true);
    try {
      const resp = await fetch(`${API}/crosssell?cart=${encodeURIComponent(cartInput)}`);
      const json = await resp.json();
      setResults(json);
    } catch {
      setResults({ error: "Could not fetch suggestions" });
    }
    setLoading(false);
  };

  const availableItems = data?.item_frequencies ? Object.keys(data.item_frequencies) : [];

  return (
    <div>
      <div className="section-header mb-4">
        <h2 className="section-title">Cart Cross-Sell Simulator</h2>
        <span className="section-badge">live rule matching</span>
      </div>

      <div style={{ background: "white", border: "1px solid var(--border)", padding: "20px 24px", marginBottom: 24 }}>
        <p style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)", marginBottom: 12, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Enter items currently in the cart (comma-separated)
        </p>
        <div className="crosssell-input">
          <input
            className="cart-input"
            placeholder="e.g. Gentle Toner, Hydrating Moisturizer"
            value={cartInput}
            onChange={(e) => setCartInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button className="btn btn-primary" onClick={handleSearch} disabled={loading || !data}>
            {loading ? "Searching…" : "Get Suggestions"}
          </button>
        </div>
        {availableItems.length > 0 && (
          <div>
            <p style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--muted)", marginBottom: 8, letterSpacing: "0.12em" }}>QUICK ADD:</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {availableItems.slice(0, 12).map((item) => (
                <button
                  key={item}
                  className="btn btn-ghost"
                  style={{ fontSize: 10, padding: "3px 10px", border: "1px solid var(--border)" }}
                  onClick={() => setCartInput((prev) => prev ? `${prev}, ${item}` : item)}
                >
                  + {item}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {results && (
        <div>
          {results.error ? (
            <div style={{ color: "var(--red)", fontFamily: "var(--mono)", fontSize: 12 }}>{results.error}</div>
          ) : results.suggestions?.length === 0 ? (
            <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)", textAlign: "center", padding: 32 }}>
              No suggestions found for this cart combination. Try different items.
            </div>
          ) : (
            <>
              <div className="section-header mb-4">
                <h2 className="section-title">Suggestions for cart: [{results.cart?.join(", ")}]</h2>
                <span className="section-badge">{results.suggestions?.length} found</span>
              </div>
              <div className="crosssell-results">
                {results.suggestions?.map((s, i) => (
                  <div key={i} className="cs-card">
                    <div>
                      <div className="cs-suggest">🛒 {s.suggest?.join(", ")}</div>
                      <div className="cs-reason">Because: {s.because?.join(" + ")} → often bought together</div>
                    </div>
                    <div className="cs-metrics">
                      <div style={{ color: "var(--red)", fontSize: 14 }}>{s.lift?.toFixed(2)}× lift</div>
                      <div style={{ color: "var(--muted)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em" }}>{(s.confidence * 100)?.toFixed(0)}% confidence</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {!data && (
        <div className="empty-state">
          <div className="empty-icon">🛍️</div>
          <div className="empty-title">Upload data first</div>
          <div className="empty-sub">Load a dataset to enable cross-sell suggestions</div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
//  VERSIONS PAGE
// ─────────────────────────────────────────────
function VersionsPage({ data }) {
  if (!data?.version_history?.length)
    return <div className="empty-state"><div className="empty-icon">🔄</div><div className="empty-title">No versions yet</div></div>;

  const history = [...data.version_history].reverse();

  return (
    <div>
      <div className="section-header mb-4">
        <h2 className="section-title">Learning Iteration History</h2>
        <span className="section-badge">{history.length} versions</span>
      </div>

      <div className="versions-list">
        {history.map((v, i) => (
          <div key={v.version} className={`version-card ${i === 0 ? "current" : ""}`}>
            <div className={`version-badge ${i === 0 ? "current" : ""}`}>{v.version}</div>
            <div>
              <div className="version-meta">
                <span><strong>{v.n_transactions?.toLocaleString()}</strong> txns</span>
                <span><strong>{v.rule_count}</strong> rules</span>
                <span>avg lift <strong>{v.avg_lift}</strong></span>
                <span>avg conf <strong>{(v.avg_confidence * 100)?.toFixed(1)}%</strong></span>
                <span>min_sup <strong>{v.min_support}</strong></span>
              </div>
              {v.top_rule && (
                <div style={{ marginTop: 6, fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)" }}>
                  Top rule: [{v.top_rule.antecedents?.join(", ")}] → [{v.top_rule.consequents?.join(", ")}]
                  &nbsp;·&nbsp;lift {v.top_rule.lift?.toFixed(2)}
                </div>
              )}
              {v.drift_alerts?.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  {v.drift_alerts.map((d, j) => (
                    <span key={j} className="pill pill-red" style={{ marginRight: 4 }}>
                      {d.direction} {d.item} {d.change_pct}%
                    </span>
                  ))}
                </div>
              )}
              {v.threshold_changed && (
                <span className="pill pill-red" style={{ marginTop: 4, display: "inline-block" }}>Threshold Adapted</span>
              )}
            </div>
            <div style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 9, color: "var(--muted)" }}>
              <div style={{ marginBottom: 4 }}>
                {Object.entries(v.weights || {}).map(([k, val]) => (
                  <div key={k}>{k}: <strong style={{ color: "var(--red)" }}>{val}</strong></div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Comparison chart */}
      {history.length > 1 && (
        <div style={{ marginTop: 28 }}>
          <div className="section-header mb-4">
            <h2 className="section-title">Lift Progression</h2>
          </div>
          <div style={{ background: "white", border: "1px solid var(--border)", padding: "20px 24px" }}>
            {[...history].reverse().map((v) => (
              <div key={v.version} className="bar-row">
                <div className="bar-label">{v.version}</div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${Math.min((v.avg_lift / 5) * 100, 100)}%` }} />
                </div>
                <div className="bar-pct">{v.avg_lift}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
//  UPLOAD PAGE
// ─────────────────────────────────────────────
function UploadPage({ onUpload, loading, data }) {
  const [dragOver, setDragOver] = useState(false);
  const [mode, setMode] = useState("append");
  const fileRef = useRef();

  const handleFile = (file) => {
    if (!file || !file.name.endsWith(".csv")) return;
    onUpload(file, mode);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  const downloadSample = async (type) => {
    try {
      const resp = await fetch(`${API}/generate-sample?type=${type}&n=1000`);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lumicart_sample_${type}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  return (
    <div>
      <div className="section-header mb-4">
        <h2 className="section-title">Upload Transaction Dataset</h2>
      </div>

      {/* Format guide */}
      <div style={{ background: "white", border: "1px solid var(--border)", padding: "16px 20px", marginBottom: 20 }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Accepted CSV Formats</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, fontFamily: "var(--mono)", fontSize: 11 }}>
          <div>
            <div style={{ color: "var(--red)", marginBottom: 4 }}>Format 1 — Long (recommended)</div>
            <div style={{ background: "var(--cream-dark)", padding: "8px 10px", fontSize: 10, lineHeight: 1.8 }}>
              transaction_id,item<br />
              1,Moisturizer<br />
              1,Toner<br />
              2,Foundation<br />
              2,Concealer
            </div>
          </div>
          <div>
            <div style={{ color: "var(--red)", marginBottom: 4 }}>Format 2 — Wide</div>
            <div style={{ background: "var(--cream-dark)", padding: "8px 10px", fontSize: 10, lineHeight: 1.8 }}>
              transaction_id,item1,item2,item3<br />
              1,Moisturizer,Toner,Serum<br />
              2,Foundation,Concealer,
            </div>
          </div>
          <div>
            <div style={{ color: "var(--red)", marginBottom: 4 }}>Format 3 — Basket rows</div>
            <div style={{ background: "var(--cream-dark)", padding: "8px 10px", fontSize: 10, lineHeight: 1.8 }}>
              Moisturizer,Toner,Serum<br />
              Foundation,Concealer<br />
              Shampoo,Conditioner,Serum
            </div>
          </div>
        </div>
      </div>

      {/* Mode selector */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        {["append", "replace"].map((m) => (
          <button
            key={m}
            className={`btn ${mode === m ? "btn-primary" : "btn-outline"}`}
            onClick={() => setMode(m)}
          >
            {m === "append" ? "📥 Append to existing" : "🔄 Replace all data"}
          </button>
        ))}
      </div>

      {/* Drop zone */}
      <div
        className={`upload-zone mb-6 ${dragOver ? "drag-over" : ""}`}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          style={{ display: "none" }}
          onChange={(e) => handleFile(e.target.files[0])}
        />
        <div className="upload-icon">📂</div>
        <div className="upload-title">Drop CSV file here or click to browse</div>
        <div className="upload-sub" style={{ marginTop: 8 }}>
          mode: {mode} · CSV only · any size
        </div>
        {loading && (
          <div style={{ marginTop: 16, fontFamily: "var(--mono)", fontSize: 10, color: "var(--red)" }}>
            Processing… please wait
          </div>
        )}
      </div>

      {/* Sample downloads */}
      <div className="section-header mb-4">
        <h2 className="section-title">Sample Datasets</h2>
        <span className="section-badge">cosmetics shop</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ background: "white", border: "1px solid var(--border)", padding: "16px 18px" }}>
          <div style={{ fontFamily: "var(--sans)", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--charcoal)", marginBottom: 6 }}>Dataset A — Baseline</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)", marginBottom: 12, lineHeight: 1.7 }}>
            1,000 transactions · 18 cosmetics SKUs<br />
            Natural co-purchase affinities embedded<br />
            Skincare trio + makeup base + hair duo
          </div>
          <button className="btn btn-outline" onClick={() => downloadSample("a")}>⬇ Download CSV</button>
        </div>
        <div style={{ background: "white", border: "1px solid var(--border)", padding: "16px 18px" }}>
          <div style={{ fontFamily: "var(--sans)", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--charcoal)", marginBottom: 6 }}>Dataset B — Seasonal Drift</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)", marginBottom: 12, lineHeight: 1.7 }}>
            1,000 transactions · SPF +40% demand<br />
            New lip care combos emerge<br />
            Triggers drift detection on reload
          </div>
          <button className="btn btn-outline" onClick={() => downloadSample("b")}>⬇ Download CSV</button>
        </div>
      </div>

      {/* Current datasets */}
      {data?.dataset_files?.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div className="section-header mb-4">
            <h2 className="section-title">Loaded Datasets</h2>
            <span className="section-badge">{data.dataset_files.length} files</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {data.dataset_files.map((f, i) => (
              <div key={i} style={{ background: "white", border: "1px solid var(--border)", padding: "10px 14px", fontFamily: "var(--mono)", fontSize: 11, display: "flex", alignItems: "center", gap: 12 }}>
                <span>📄</span>
                <span style={{ color: "var(--charcoal)" }}>{f}</span>
                {i === data.dataset_files.length - 1 && (
                  <span className="pill pill-red" style={{ marginLeft: "auto" }}>latest</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
//  MAIN APP
// ─────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("upload");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [backendOk, setBackendOk] = useState(null);

  const addToast = useCallback((msg, type = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  // Check backend on mount
  useEffect(() => {
    fetch(`${API}/health`)
      .then((r) => r.json())
      .then((d) => {
        setBackendOk(true);
        if (d.n_transactions > 0) {
          // Load existing state
          return fetch(`${API}/state`).then((r) => r.json()).then(setData);
        }
      })
      .catch(() => {
        setBackendOk(false);
        addToast("Cannot connect to backend (localhost:5000). Start the Flask server.", "error");
      });
  }, []);

  const handleUpload = async (file, mode) => {
    setLoading(true);
    const form = new FormData();
    form.append("file", file);
    form.append("mode", mode);
    try {
      const resp = await fetch(`${API}/upload`, { method: "POST", body: form });
      const json = await resp.json();
      if (json.error) {
        addToast(`Error: ${json.error}`, "error");
      } else {
        setData(json);
        addToast(`✓ Loaded ${json.new_transactions_added} new transactions — ${json.n_rules} rules generated`, "success");
        setPage("overview");
      }
    } catch (e) {
      addToast("Upload failed. Is the backend running?", "error");
    }
    setLoading(false);
  };

  const handleRerun = async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${API}/rerun`, { method: "POST" });
      const json = await resp.json();
      if (json.error) addToast(`Error: ${json.error}`, "error");
      else {
        setData(json);
        addToast(`✓ Re-run complete — ${json.n_rules} rules, avg lift ${json.avg_lift}`, "success");
      }
    } catch {
      addToast("Rerun failed", "error");
    }
    setLoading(false);
  };

  const handleReset = async () => {
    if (!window.confirm("Reset all data and start fresh?")) return;
    await fetch(`${API}/reset`, { method: "POST" });
    setData(null);
    setPage("upload");
    addToast("System reset", "info");
  };

  const navItems = [
    { id: "upload", icon: "📂", label: "Upload Dataset" },
    { id: "overview", icon: "📊", label: "Overview" },
    { id: "frequencies", icon: "📈", label: "Item Frequencies" },
    { id: "bundles", icon: "🛍️", label: "Bundles & Promos" },
    { id: "rules", icon: "📋", label: "Rules Table" },
    { id: "crosssell", icon: "🛒", label: "Cross-sell Simulator" },
    { id: "versions", icon: "🔄", label: "Learning History" },
  ];

  const pageTitles = {
    upload: "Upload Dataset",
    overview: "System Overview",
    frequencies: "Item Frequencies",
    bundles: "Bundles & Promotions",
    rules: "Association Rules",
    crosssell: "Cross-sell Simulator",
    versions: "Learning History",
  };

  return (
    <>
      <StyleInjector />
      {loading && (
        <div className="loading-overlay">
          <div className="spinner" style={{ width: 36, height: 36 }} />
          <div className="loading-text">Running MBA Pipeline…</div>
          <div className="loading-sub">FP-Growth · Rule Scoring · Self-Learning</div>
        </div>
      )}
      <div className="lc-app">
        {/* ── SIDEBAR ── */}
        <aside className="sidebar">
          <div className="sidebar-brand">
            <div className="brand-name"><span>Lumi</span>Cart</div>
            <div className="brand-sub">MBA Engine v1.0</div>
          </div>

          <nav className="sidebar-nav">
            <div className="nav-section-label">Analysis</div>
            {navItems.map((item) => (
              <div
                key={item.id}
                className={`nav-item ${page === item.id ? "active" : ""}`}
                onClick={() => setPage(item.id)}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </div>
            ))}

            <div className="nav-section-label" style={{ marginTop: 12 }}>Actions</div>
            <div className="nav-item" onClick={handleRerun} style={{ opacity: data ? 1 : 0.4, pointerEvents: data ? "auto" : "none" }}>
              <span className="nav-icon">⚡</span>
              Re-run Pipeline
            </div>
            <div className="nav-item" onClick={handleReset}>
              <span className="nav-icon">🗑️</span>
              Reset System
            </div>
          </nav>

          <div className="sidebar-status">
            <div style={{ marginBottom: 8 }}>
              <span className={`status-dot ${backendOk ? "green" : "red"}`} />
              <span className="status-text">{backendOk ? "Backend connected" : "Backend offline"}</span>
            </div>
            {data && (
              <>
                <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "rgba(255,255,255,0.35)", lineHeight: 1.8 }}>
                  <div>{data.n_transactions?.toLocaleString()} transactions</div>
                  <div>{data.n_rules} rules</div>
                  <div>v{data.version_history?.length || 0}</div>
                </div>
              </>
            )}
          </div>
        </aside>

        {/* ── MAIN ── */}
        <main className="main">
          <header className="topbar">
            <div className="topbar-title">{pageTitles[page]}</div>
            <div className="topbar-actions">
              {data && (
                <>
                  <span className="pill pill-green">{data.n_transactions?.toLocaleString()} txns</span>
                  <span className="pill pill-red">{data.n_rules} rules</span>
                  <span className="pill pill-grey">lift {data.avg_lift}</span>
                </>
              )}
              {data && (
                <button className="btn btn-primary" onClick={handleRerun} disabled={loading}>
                  ⚡ Re-run
                </button>
              )}
            </div>
          </header>

          <div className="content">
            {page === "upload"       && <UploadPage onUpload={handleUpload} loading={loading} data={data} />}
            {page === "overview"     && <OverviewPage data={data} />}
            {page === "frequencies"  && <FrequenciesPage data={data} />}
            {page === "bundles"      && <BundlesPage data={data} />}
            {page === "rules"        && <RulesPage data={data} />}
            {page === "crosssell"    && <CrosssellPage data={data} />}
            {page === "versions"     && <VersionsPage data={data} />}
          </div>
        </main>
      </div>

      <ToastContainer toasts={toasts} />
    </>
  );
}
