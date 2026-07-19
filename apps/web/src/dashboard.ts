export type DashboardConfig = {
  readonly apiBaseUrl: string;
  readonly langfuseBaseUrl: string;
};

export function resolveDashboardConfig(env: NodeJS.ProcessEnv = process.env): DashboardConfig {
  return {
    apiBaseUrl: env.WEB_PUBLIC_API_URL ?? "http://localhost:4000",
    langfuseBaseUrl: env.WEB_PUBLIC_LANGFUSE_URL ?? "http://localhost:3001",
  };
}

export function createDashboardHtml(config: DashboardConfig = resolveDashboardConfig()): string {
  const serialized = JSON.stringify(config).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <title>OpsPilot — AI Investigation Dashboard</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/assets/styles.css" />
  </head>
  <body>
    <script>window.__OPSPILOT_CONFIG__ = ${serialized};</script>
    <div class="app-shell">
      <aside class="sidebar" aria-label="Primary navigation">
        <div class="brand">
          <div class="brand-mark" aria-hidden="true">OP</div>
          <div>
            <p class="eyebrow">OpsPilot</p>
            <h1>AI Ops Command</h1>
          </div>
        </div>
        <nav class="nav-list">
          <a href="#overview" data-route="overview" class="active">Overview</a>
          <a href="#incidents" data-route="incidents">Incidents</a>
          <a href="#investigation" data-route="investigation">Investigation</a>
          <a href="#history" data-route="history">History</a>
          <a href="#timeline" data-route="timeline">Tool Timeline</a>
          <a href="#evidence" data-route="evidence">Evidence</a>
          <a href="#langfuse" data-route="langfuse">Langfuse</a>
        </nav>
        <div class="sidebar-card">
          <span class="status-dot live"></span>
          <div>
            <strong>V1 vertical slice</strong>
            <p>Deterministic workflow, persisted evidence, optional Langfuse tracing.</p>
          </div>
        </div>
      </aside>

      <main class="main-panel">
        <header class="topbar">
          <div>
            <p class="eyebrow">Production-style incident investigation</p>
            <h2>AI Investigation Dashboard</h2>
          </div>
          <div class="topbar-actions">
            <button id="refreshButton" class="button ghost" type="button">Refresh</button>
            <button id="runInvestigationButton" class="button primary" type="button">Run investigation</button>
          </div>
        </header>

        <section id="alertRegion" class="alert-region" aria-live="polite"></section>

        <section class="hero-grid" aria-labelledby="overview-title">
          <div class="hero-card">
            <div class="hero-copy">
              <p class="eyebrow">Overview</p>
              <h3 id="overview-title">From signal to traceable root cause.</h3>
              <p>OpsPilot turns BeautyCorp telemetry into an auditable AI investigation: tool execution, persisted evidence, runbook citations, structured LLM output, and Langfuse trace linkage.</p>
            </div>
            <div class="hero-stack" aria-label="Investigation flow summary">
              <div><span>Incident</span><strong id="heroIncident">Waiting for API</strong></div>
              <div><span>Workflow</span><strong>query_logs → query_metrics → deploys → runbooks → LLM</strong></div>
              <div><span>Read model</span><strong>API detail + report endpoints</strong></div>
            </div>
          </div>
          <div class="status-card">
            <p class="eyebrow">System status</p>
            <div id="systemStatus" class="status-grid"></div>
          </div>
        </section>

        <section id="overview" class="section-panel" data-section>
          <div class="section-header">
            <div>
              <p class="eyebrow">Platform health</p>
              <h3>Operational overview</h3>
            </div>
            <span class="badge">Live API-backed</span>
          </div>
          <div id="metricGrid" class="metric-grid"></div>
        </section>

        <section id="incidents" class="section-panel" data-section>
          <div class="section-header">
            <div>
              <p class="eyebrow">Incident list</p>
              <h3>Detected incidents</h3>
            </div>
            <div class="filters" role="search">
              <input id="searchInput" type="search" placeholder="Search service, status, severity…" aria-label="Search incidents" />
              <select id="severityFilter" aria-label="Filter by severity">
                <option value="all">All severities</option>
                <option value="sev1">SEV1</option>
                <option value="sev2">SEV2</option>
                <option value="sev3">SEV3</option>
                <option value="sev4">SEV4</option>
              </select>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Detected</th>
                  <th>Investigation</th>
                  <th>Confidence</th>
                </tr>
              </thead>
              <tbody id="incidentRows"></tbody>
            </table>
          </div>
        </section>

        <section id="investigation" class="section-panel showcase" data-section>
          <div class="section-header">
            <div>
              <p class="eyebrow">Showcase</p>
              <h3>Investigation detail</h3>
            </div>
            <span id="investigationStatusBadge" class="badge muted">No investigation loaded</span>
          </div>
          <div id="investigationDetail" class="investigation-grid"></div>
        </section>



        <section id="history" class="section-panel" data-section>
          <div class="section-header">
            <div>
              <p class="eyebrow">Investigation history</p>
              <h3>Persisted investigations</h3>
            </div>
            <button id="loadMoreHistoryButton" class="button ghost" type="button">Load more</button>
          </div>
          <div id="historyPanel" class="history-list"></div>
        </section>

        <section id="timeline" class="section-panel" data-section>
          <div class="section-header">
            <div>
              <p class="eyebrow">Tool timeline</p>
              <h3>Workflow execution</h3>
            </div>
            <span class="badge">Deterministic order</span>
          </div>
          <div id="timelineList" class="timeline-list"></div>
        </section>

        <section id="evidence" class="section-panel" data-section>
          <div class="section-header">
            <div>
              <p class="eyebrow">Evidence panel</p>
              <h3>Supporting signals</h3>
            </div>
            <span class="badge">Expandable</span>
          </div>
          <div id="evidencePanel" class="evidence-grid"></div>
        </section>

        <section id="langfuse" class="section-panel" data-section>
          <div class="section-header">
            <div>
              <p class="eyebrow">Observability</p>
              <h3>Langfuse integration</h3>
            </div>
            <span class="badge">External trace</span>
          </div>
          <div id="langfusePanel" class="langfuse-panel"></div>
        </section>
      </main>
    </div>
    <script type="module" src="/assets/app.js"></script>
  </body>
</html>`;
}
