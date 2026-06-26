export const clientScript = String.raw`
const config = window.__OPSPILOT_CONFIG__ ?? { apiBaseUrl: 'http://localhost:4000', langfuseBaseUrl: 'http://localhost:3001' };
const state = {
  incidents: [],
  selectedIncidentId: null,
  currentInvestigation: null,
  report: null,
  apiHealth: null,
  llmStatus: null,
  search: '',
  severity: 'all',
};

const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const formatDate = (value) => value ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
const formatMs = (value) => typeof value === 'number' ? value + ' ms' : '—';
const percent = (value) => typeof value === 'number' ? Math.round(value * 100) + '%' : '—';
const monoJson = (value) => '<pre>' + escapeHtml(JSON.stringify(value ?? {}, null, 2)) + '</pre>';

async function api(path, options) {
  const response = await fetch(config.apiBaseUrl.replace(/\/$/, '') + path, {
    headers: { 'content-type': 'application/json' },
    ...options,
  });
  if (!response.ok) throw new Error(path + ' failed: ' + response.status);
  return response.json();
}

function showAlert(message, tone = 'warn') {
  $('alertRegion').innerHTML = '<div class="alert ' + tone + '">' + escapeHtml(message) + '</div>';
}
function clearAlert() { $('alertRegion').innerHTML = ''; }

async function loadDashboard() {
  clearAlert();
  try {
    const [health, llm, incidentsResponse] = await Promise.all([
      api('/api/health').catch((error) => ({ error: error.message })),
      api('/api/llm/status').catch((error) => ({ error: error.message })),
      api('/api/incidents'),
    ]);
    state.apiHealth = health;
    state.llmStatus = llm;
    state.incidents = incidentsResponse.items ?? [];
    state.selectedIncidentId = state.selectedIncidentId ?? state.incidents[0]?.id ?? null;
    const linkedInvestigationId = new URLSearchParams(location.search).get('investigationId');
    if (linkedInvestigationId && state.currentInvestigation?.id !== linkedInvestigationId) {
      const [detail, report] = await Promise.all([
        api('/api/investigations/' + encodeURIComponent(linkedInvestigationId)),
        api('/api/investigations/' + encodeURIComponent(linkedInvestigationId) + '/report'),
      ]);
      state.currentInvestigation = detail;
      state.report = report;
      state.selectedIncidentId = detail.incidentId;
    }
    renderAll();
  } catch (error) {
    renderAll();
    showAlert(error instanceof Error ? error.message : 'Failed to load dashboard.');
  }
}

async function runInvestigation() {
  if (!state.selectedIncidentId) {
    showAlert('No incident is available to investigate. Seed telemetry first.');
    return;
  }
  const button = $('runInvestigationButton');
  button.disabled = true;
  button.textContent = 'Running…';
  clearAlert();
  try {
    const result = await api('/api/incidents/' + encodeURIComponent(state.selectedIncidentId) + '/investigations', { method: 'POST', body: '{}' });
    await loadInvestigation(result.investigationId);
    history.replaceState(null, '', '?investigationId=' + encodeURIComponent(result.investigationId) + '#investigation');
    renderNavigation();
  } catch (error) {
    showAlert(error instanceof Error ? error.message : 'Investigation failed.');
  } finally {
    button.disabled = false;
    button.textContent = 'Run investigation';
  }
}

async function loadInvestigation(investigationId) {
  const [detail, report] = await Promise.all([
    api('/api/investigations/' + encodeURIComponent(investigationId)),
    api('/api/investigations/' + encodeURIComponent(investigationId) + '/report'),
  ]);
  state.currentInvestigation = detail;
  state.report = report;
  renderAll();
}

function statusPill(value) {
  const normalized = String(value ?? 'unknown').toLowerCase();
  const cls = normalized.includes('fail') ? 'error' : normalized.includes('complete') || normalized.includes('ok') || normalized.includes('available') ? 'success' : 'muted';
  return '<span class="badge ' + cls + '">' + escapeHtml(value ?? 'unknown') + '</span>';
}

function renderStatus() {
  const health = state.apiHealth ?? {};
  const llm = state.llmStatus ?? {};
  const dbStatus = health.database ?? health.db ?? (health.error ? 'unavailable' : 'connected');
  const langfuseStatus = state.currentInvestigation?.langfuseTraceId ? 'traced' : 'optional';
  $('systemStatus').innerHTML = [
    ['API', health.status ?? (health.error ? 'unavailable' : 'ready')],
    ['Database', dbStatus],
    ['Provider', llm.provider ?? '—'],
    ['Model', llm.model ?? '—'],
    ['Langfuse', langfuseStatus],
  ].map(([label, value]) => '<div class="status-item"><span>' + escapeHtml(label) + '</span><span>' + escapeHtml(value) + '</span></div>').join('');
}

function renderMetrics() {
  const investigation = state.currentInvestigation;
  const incidents = state.incidents;
  const toolCalls = investigation?.toolCalls ?? [];
  const cards = [
    ['System status', state.apiHealth?.error ? 'Degraded' : 'Ready', 'API and database read path'],
    ['Investigations', investigation ? '1 loaded' : '0 loaded', investigation?.status ?? 'Run or select an investigation'],
    ['Incidents', String(incidents.length), incidents[0]?.serviceName ?? 'No incident loaded'],
    ['Provider / model', (state.llmStatus?.provider ?? investigation?.provider ?? '—') + ' / ' + (state.llmStatus?.model ?? investigation?.model ?? '—'), 'Provider abstraction preserved'],
    ['Langfuse status', investigation?.langfuseTraceId ? 'Trace linked' : 'Optional', investigation?.langfuseTraceId ?? 'Disabled or not yet traced'],
    ['Database status', state.apiHealth?.error ? 'Unavailable' : 'Connected', 'Existing API health endpoint'],
    ['Tool calls', String(toolCalls.length), 'Workflow observations'],
    ['Confidence', percent(investigation?.confidence), 'Structured report score'],
  ];
  $('metricGrid').innerHTML = cards.map(([label, value, note]) => '<article class="metric-card"><div><span class="metric-label">' + escapeHtml(label) + '</span><div class="metric-value">' + escapeHtml(value) + '</div></div><div class="metric-footnote">' + escapeHtml(note) + '</div></article>').join('');
  $('heroIncident').textContent = incidents[0]?.title ?? 'No incidents detected';
}

function investigationForIncident(incident) {
  if (state.currentInvestigation?.incidentId === incident.id) return state.currentInvestigation;
  return null;
}

function renderIncidentRows() {
  const query = state.search.toLowerCase();
  const rows = state.incidents.filter((incident) => {
    const matchesSeverity = state.severity === 'all' || incident.severity === state.severity;
    const haystack = [incident.serviceName, incident.severity, incident.status, incident.title].join(' ').toLowerCase();
    return matchesSeverity && haystack.includes(query);
  });
  $('incidentRows').innerHTML = rows.map((incident) => {
    const inv = investigationForIncident(incident);
    const selected = incident.id === state.selectedIncidentId ? ' class="selected"' : '';
    return '<tr data-incident-id="' + escapeHtml(incident.id) + '"' + selected + '>' +
      '<td><strong>' + escapeHtml(incident.serviceName) + '</strong><br><span class="metric-footnote">' + escapeHtml(incident.title) + '</span></td>' +
      '<td>' + statusPill(String(incident.severity).toUpperCase()) + '</td>' +
      '<td>' + statusPill(incident.status) + '</td>' +
      '<td>' + escapeHtml(formatDate(incident.detectedAt)) + '</td>' +
      '<td>' + statusPill(inv?.status ?? 'not started') + '</td>' +
      '<td>' + escapeHtml(percent(inv?.confidence)) + '</td>' +
      '</tr>';
  }).join('') || '<tr><td colspan="6">No incidents match the current filters.</td></tr>';
  document.querySelectorAll('[data-incident-id]').forEach((row) => row.addEventListener('click', () => {
    state.selectedIncidentId = row.getAttribute('data-incident-id');
    renderAll();
  }));
}

function renderInvestigation() {
  const inv = state.currentInvestigation;
  const report = state.report;
  $('investigationStatusBadge').outerHTML = '<span id="investigationStatusBadge" class="badge ' + (inv?.status === 'completed' ? 'success' : 'muted') + '">' + escapeHtml(inv?.status ?? 'No investigation loaded') + '</span>';
  if (!inv) {
    $('investigationDetail').innerHTML = '<div class="empty-state">Run an investigation to populate the showcase page.</div>';
    return;
  }
  const confidence = typeof inv.confidence === 'number' ? Math.round(inv.confidence * 100) : 0;
  const steps = inv.steps ?? [];
  const promptStep = steps.find((step) => step.stepType === 'prompt');
  const finalStep = steps.find((step) => step.stepType === 'final');
  $('investigationDetail').innerHTML =
    '<article class="detail-card"><span class="detail-label">Incident</span><h4>' + escapeHtml(inv.incidentTitle) + '</h4><p>' + escapeHtml(inv.serviceName) + ' · ' + escapeHtml(inv.incidentId) + '</p></article>' +
    '<article class="detail-card"><span class="detail-label">Root cause</span><p class="root-cause">' + escapeHtml(report?.probableRootCause ?? inv.probableRootCause ?? '—') + '</p></article>' +
    '<article class="detail-card"><span class="detail-label">Timeline</span><p>Started ' + escapeHtml(formatDate(inv.startedAt)) + '<br>Completed ' + escapeHtml(formatDate(inv.completedAt)) + '<br>Duration ' + escapeHtml(formatMs(inv.latencyMs)) + '</p></article>' +
    '<article class="detail-card"><span class="detail-label">Confidence</span><div class="confidence-ring" style="--confidence:' + confidence + '%"><span>' + confidence + '%</span></div></article>' +
    '<article class="detail-card full"><span class="detail-label">LLM reasoning</span><h4>Structured investigation report</h4><p>' + escapeHtml(report?.summary ?? inv.summary ?? '—') + '</p>' + (finalStep ? monoJson(JSON.parse(finalStep.content)) : '') + '</article>' +
    '<article class="detail-card full"><span class="detail-label">Prompt context</span><h4>Prompt version ' + escapeHtml(inv.promptVersion) + '</h4><p>Provider ' + escapeHtml(inv.provider) + ' · Model ' + escapeHtml(inv.model) + '</p>' + (promptStep ? '<pre>' + escapeHtml(promptStep.content.slice(0, 1400)) + '</pre>' : '') + '</article>';
}

function renderTimeline() {
  const inv = state.currentInvestigation;
  const calls = inv?.toolCalls ?? [];
  const llmStep = (inv?.steps ?? []).find((step) => step.stepType === 'final');
  const items = calls.map((call, index) => ({
    title: call.toolName,
    status: call.status,
    latency: call.latencyMs,
    createdAt: call.createdAt,
    output: call.output,
    index: index + 1,
  }));
  if (llmStep) items.push({ title: 'LLM', status: inv.status, latency: inv.latencyMs, createdAt: llmStep.createdAt, output: { provider: inv.provider, model: inv.model }, index: items.length + 1 });
  if (inv) items.push({ title: 'Final report', status: inv.status, latency: inv.latencyMs, createdAt: inv.completedAt, output: { confidence: inv.confidence, evidence: inv.evidence?.length ?? 0 }, index: items.length + 1 });
  $('timelineList').innerHTML = items.map((item) => '<article class="timeline-item"><div class="timeline-index">' + item.index + '</div><div><p class="timeline-title">' + escapeHtml(item.title) + '</p><div class="timeline-meta">' + escapeHtml(formatDate(item.createdAt)) + ' · latency ' + escapeHtml(formatMs(item.latency)) + '</div></div>' + statusPill(item.status) + '</article>').join('') || '<div class="empty-state">No timeline yet.</div>';
}

function renderEvidence() {
  const inv = state.currentInvestigation;
  const report = state.report;
  const toolCalls = inv?.toolCalls ?? [];
  const evidence = report?.evidence ?? inv?.evidence ?? [];
  const citedRunbooks = report?.citedRunbooks ?? inv?.citedRunbooks ?? [];
  const sections = [];
  for (const item of evidence) sections.push({ title: item.source + ' · ' + item.reference, summary: item.detail, body: item });
  for (const runbook of citedRunbooks) sections.push({ title: 'runbook · ' + runbook.title, summary: runbook.quote, body: runbook });
  for (const call of toolCalls) sections.push({ title: 'tool output · ' + call.toolName, summary: call.status + ' · ' + formatMs(call.latencyMs), body: call.output });
  $('evidencePanel').innerHTML = sections.map((item) => '<details><summary><span>' + escapeHtml(item.title) + '</span><span class="badge muted">expand</span></summary><div class="details-body"><p>' + escapeHtml(item.summary) + '</p>' + monoJson(item.body) + '</div></details>').join('') || '<div class="empty-state">Evidence appears after an investigation completes.</div>';
}

function renderLangfuse() {
  const inv = state.currentInvestigation;
  if (!inv) {
    $('langfusePanel').innerHTML = '<div class="empty-state">No investigation trace loaded.</div>';
    return;
  }
  const traceId = inv.langfuseTraceId;
  const observations = (inv.toolCalls?.length ?? 0) + (inv.status ? 1 : 0);
  const href = traceId ? config.langfuseBaseUrl.replace(/\/$/, '') + '/project/opspilot-dev/traces/' + encodeURIComponent(traceId) : '#';
  $('langfusePanel').innerHTML = '<div class="langfuse-panel-inner">' +
    metricBlock('Trace ID', traceId ?? 'Disabled / unavailable', 'Stored on investigation') +
    metricBlock('Duration', formatMs(inv.latencyMs), 'Workflow latency') +
    metricBlock('Observations', String(observations), 'Tools + LLM generation') +
    metricBlock('Provider / model', inv.provider + ' / ' + inv.model, 'LLM abstraction') +
    '<div class="langfuse-action"><p class="metric-footnote">Langfuse is linked, not embedded. OpsPilot remains the product read model.</p>' +
    (traceId ? '<a class="button primary" href="' + escapeHtml(href) + '" target="_blank" rel="noreferrer">Open in Langfuse</a>' : '<button class="button ghost" disabled>Trace unavailable</button>') + '</div></div>';
}

function metricBlock(label, value, note) {
  return '<article><span class="metric-label">' + escapeHtml(label) + '</span><div class="metric-value">' + escapeHtml(value) + '</div><div class="metric-footnote">' + escapeHtml(note) + '</div></article>';
}

function renderNavigation() {
  const current = location.hash.replace('#', '') || 'overview';
  document.querySelectorAll('[data-route]').forEach((link) => link.classList.toggle('active', link.getAttribute('data-route') === current));
}

function renderAll() {
  renderStatus();
  renderMetrics();
  renderIncidentRows();
  renderInvestigation();
  renderTimeline();
  renderEvidence();
  renderLangfuse();
  renderNavigation();
}

$('refreshButton').addEventListener('click', loadDashboard);
$('runInvestigationButton').addEventListener('click', runInvestigation);
$('searchInput').addEventListener('input', (event) => { state.search = event.target.value; renderIncidentRows(); });
$('severityFilter').addEventListener('change', (event) => { state.severity = event.target.value; renderIncidentRows(); });
window.addEventListener('hashchange', renderNavigation);
loadDashboard();
`;
