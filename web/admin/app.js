const store = {
  summary: null,
  targets: [],
  jobs: [],
  runs: [],
  restores: [],
  destinations: [],
  discovery: null,
};

const page = document.querySelector('[data-page]')?.dataset.page;

function $(id) {
  return document.getElementById(id);
}

function headers(json = false) {
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { ...headers(Boolean(options.body)), ...(options.headers || {}) },
  });
  const text = await response.text();
  const payload = text ? safeJson(text) : null;
  if (!response.ok) {
    const message = payload?.message || payload?.error || text || `Request failed: ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function showNotice(message, type = 'info') {
  const el = $('notice');
  if (!el) return;
  el.textContent = message;
  el.className = `notice ${type === 'error' ? 'error' : ''}`;
}

function hideNotice() {
  const el = $('notice');
  if (el) el.classList.add('hidden');
}

function statusBadge(status) {
  const value = status || 'none';
  const kind = ['success', 'completed', 'enabled', 'verified'].includes(value)
    ? 'ok'
    : ['failed', 'disabled'].includes(value)
      ? 'bad'
      : ['running', 'pending', 'verifying', 'skipped', 'unknown'].includes(value)
        ? 'warn'
        : 'neutral';
  return `<span class="badge ${kind}">${escapeHtml(value)}</span>`;
}

function verificationBadge(run) {
  const status = run?.verification_status || 'unknown';
  const reason = run?.verification_reason ? ` title="${escapeHtml(run.verification_reason)}"` : '';
  return `<span${reason}>${statusBadge(status)}</span>`;
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
}

function duration(start, end) {
  if (!start || !end) return '-';
  const seconds = Math.max(0, Math.round((new Date(end) - new Date(start)) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

function shortId(value) {
  return value ? `${String(value).slice(0, 12)}` : '-';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[char]));
}

function cronLabel(value) {
  const labels = {
    '0 2 * * *': 'Daily at 02:00',
    '0 */6 * * *': 'Every 6 hours',
    '0 0 * * 0': 'Weekly on Sunday',
  };
  return labels[value] || value || '-';
}

function currentActorLabel() {
  return 'admin-session';
}

function sourceLabel(value) {
  const labels = {
    postgres_database: 'PostgreSQL database',
    minio_bucket: 'MinIO bucket',
    kubernetes_resource: 'Kubernetes resource',
    secret_reference: 'Secret reference',
    pvc: 'Persistent volume',
    service: 'Service',
    logical_postgres: 'Logical PostgreSQL restore',
    object_restore: 'Object restore',
    manifest_reapply: 'Manifest reapply',
    secret_rehydration: 'Secret rehydration',
    volume_restore: 'Volume restore',
    manual: 'Manual runbook',
  };
  return labels[value] || value || '-';
}

async function loadSummary() {
  const [summary, discovery] = await Promise.all([
    api('/dashboard/summary'),
    api('/discovery/kubernetes').catch((error) => ({
      available: false,
      error: error.message,
      databases: [],
      services: [],
      workloads: [],
    })),
  ]);
  store.summary = summary;
  store.discovery = discovery;
  store.targets = store.summary.coverage?.map((item) => item.target) || [];
  store.jobs = store.summary.coverage?.flatMap((item) => item.jobs || []) || [];
  store.runs = store.summary.recent_runs || [];
  store.restores = store.summary.restore_requests || [];
  store.destinations = store.summary.destinations || [];
}

async function loadRawCollections() {
  const [targets, jobs, runs, restores, destinations] = await Promise.all([
    api('/targets'),
    api('/jobs'),
    api('/backups?limit=80'),
    api('/restore'),
    api('/destinations').catch(() => []),
  ]);
  store.targets = Array.isArray(targets) ? targets : [];
  store.jobs = Array.isArray(jobs) ? jobs : [];
  store.runs = Array.isArray(runs) ? runs : [];
  store.restores = Array.isArray(restores) ? restores : [];
  store.destinations = Array.isArray(destinations) ? destinations : [];
}

async function loadPage() {
  if (!page) return;
  hideNotice();
  try {
    if (page === 'dashboard') {
      await loadSummary();
      renderDashboard();
    } else if (page === 'jobs') {
      await loadRawCollections();
      renderJobs();
    } else if (page === 'restore') {
      await loadRawCollections();
      renderRestore();
    }
  } catch (error) {
    const isAuthError = /authorization|unauthorized|token/i.test(error.message);
    if (isAuthError) {
      window.location.href = `/admin/login?returnTo=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    showNotice(error.message, 'info');
    renderEmptyStates(isAuthError ? 'Authorization failed.' : 'Unable to load data.');
  }
}

async function login(event) {
  event.preventDefault();
  const submit = $('login-submit');
  if (submit) submit.disabled = true;
  hideNotice();
  try {
    const response = await fetch('/admin/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: $('login-email')?.value.trim(),
        password: $('login-password')?.value,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || 'Login failed');
    const returnTo = new URLSearchParams(window.location.search).get('returnTo') || '/admin';
    window.location.href = returnTo.startsWith('/admin') ? returnTo : '/admin';
  } catch (error) {
    showNotice(error.message, 'error');
  } finally {
    if (submit) submit.disabled = false;
  }
}

async function logout() {
  await fetch('/admin/logout', { method: 'POST' });
  window.location.href = '/admin/login';
}

function renderDashboard() {
  const summary = store.summary || {};
  const stats = summary.stats || {};
  const discoveredGaps = stats.unprotected_discovered_sources || 0;
  $('metric-protected').textContent = `${stats.protected_sources || 0}/${(stats.targets_total || 0) + discoveredGaps}`;
  $('metric-jobs').textContent = `${stats.jobs_enabled || 0}/${stats.jobs_total || 0}`;
  $('metric-runs').textContent = stats.runs_24h ?? 0;
  $('metric-failed').textContent = stats.failed_24h ?? 0;
  $('metric-latest').innerHTML = statusBadge(stats.latest_status);

  const coverage = $('coverage-list');
  const unprotected = summary.unprotected_discovered_sources || [];
  coverage.innerHTML = (summary.coverage || []).length || unprotected.length
    ? [
      ...(summary.coverage || []).map(renderCoverageCard),
      ...unprotected.map(renderUnprotectedSourceCard),
    ].join('')
    : '<div class="muted">No backup targets are configured.</div>';

  renderCoverageStats(summary.coverage_stats || []);
  renderSettings(summary.storage || {}, summary.guardrails || {});
  renderDiscovery(store.discovery || {});
  renderDestinations(summary.storage || {});
  renderSourceContracts(summary.source_contracts || []);
  renderRunsTable($('runs-table'), summary.recent_runs || []);
}

function renderCoverageStats(stats) {
  const list = $('coverage-stats');
  if (!list) return;
  list.innerHTML = stats.length
    ? stats.map((item) => `<article class="stat-card">
      <strong>${escapeHtml(item.protected)}/${escapeHtml(item.total)}</strong>
      <span>${escapeHtml(sourceLabel(item.source_category))}</span>
    </article>`).join('')
    : '<div class="muted">No coverage classes are tracked yet.</div>';
}

function renderCoverageCard(item) {
  const target = item.target || {};
  const jobs = item.jobs || [];
  const enabledJobs = jobs.filter((job) => job.enabled);
  const schedule = enabledJobs.map((job) => cronLabel(job.schedule_cron)).join(', ') || 'No enabled schedule';
  const retention = enabledJobs.map((job) => `${job.retention_full_count} full`).join(', ') || '-';
  return `<article class="coverage-card">
    <div>
      <h3>${escapeHtml(target.name || target.database_name || target.id)}</h3>
      <div class="meta-line">
        <span>${escapeHtml(target.type || 'postgres')}</span>
        <span>${escapeHtml(sourceLabel(target.source_category || 'postgres_database'))}</span>
        <span>owner ${escapeHtml(target.service_owner || 'unassigned')}</span>
        <span>${escapeHtml(target.criticality || 'standard')}</span>
      </div>
      <div class="meta-line">
        <span>${escapeHtml(target.host || '-')}:${escapeHtml(target.port || '-')}</span>
        <span>database ${escapeHtml(target.database_name || '-')}</span>
        <span>namespace ${escapeHtml(target.kubernetes_namespace || '-')}</span>
        <span>restore ${escapeHtml(sourceLabel(target.restore_class || 'logical_postgres'))}</span>
      </div>
      <div class="meta-line">
        <span>schedule ${escapeHtml(schedule)}</span>
        <span>retention ${escapeHtml(retention)}</span>
        <span>RPO ${escapeHtml(target.rpo_minutes ? `${target.rpo_minutes}m` : '-')}</span>
        <span>RTO ${escapeHtml(target.rto_minutes ? `${target.rto_minutes}m` : '-')}</span>
        <span>last success ${escapeHtml(formatDate(item.last_success?.completed_at))}</span>
        <span>verification ${item.last_verification ? statusBadge(item.last_verification.status) : statusBadge('unknown')}</span>
      </div>
      ${target.coverage_notes ? `<p class="muted">${escapeHtml(target.coverage_notes)}</p>` : ''}
    </div>
    <div>${statusBadge(item.protected ? 'enabled' : 'disabled')}</div>
  </article>`;
}

function renderUnprotectedSourceCard(source) {
  return `<article class="coverage-card gap">
    <div>
      <h3>${escapeHtml(source.name)}</h3>
      <div class="meta-line">
        <span>${escapeHtml(sourceLabel(source.source_category))}</span>
        <span>namespace ${escapeHtml(source.namespace || '-')}</span>
        <span>${escapeHtml(source.host || '-')}</span>
      </div>
      <p class="muted">${escapeHtml(source.reason || 'No backup target is configured.')}</p>
    </div>
    <div>${statusBadge(source.backup_ready ? 'unprotected' : 'contract pending')}</div>
  </article>`;
}

function renderSettings(storage, guardrails) {
  const values = [
    ['Backend', storage.backend],
    ['Bucket', storage.bucket],
    ['Prefix', storage.prefix],
    ['Endpoint', storage.endpoint_configured ? 'configured' : 'not configured'],
    ['Compression', storage.compression],
    ['Default schedule', storage.default_schedule || '-'],
    ['Default retention days', storage.default_retention_days || '-'],
    ['Minimum full backups', guardrails.retention_min_full_backups],
    ['Restore approval', guardrails.restore_requires_human_approval ? 'required' : 'not configured'],
    ['Secrets', guardrails.secrets_source],
  ];
  $('settings-list').innerHTML = values.map(([label, value]) => {
    return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value ?? '-')}</dd></div>`;
  }).join('');
}

function renderDiscovery(discovery) {
  const status = $('discovery-status');
  if (status) {
    status.className = `badge ${discovery.available ? 'ok' : 'warn'}`;
    status.textContent = discovery.available ? 'live' : 'unavailable';
  }

  const databases = discovery.databases || [];
  const services = discovery.services || [];
  $('database-list').innerHTML = databases.length
    ? databases.map((service) => renderDatabaseOption(service)).join('')
    : `<div class="muted">${escapeHtml(discovery.error || 'No PostgreSQL services were detected from Kubernetes.')}</div>`;

  $('service-list').innerHTML = services.length
    ? services.slice(0, 12).map((service) => renderServiceOption(service)).join('')
    : '<div class="muted">No Kubernetes services discovered.</div>';

  populateDestinationSelect($('target-destination'));
}

function renderDatabaseOption(service) {
  const protectedTarget = store.targets.find((target) => target.host === service.host || target.host === service.name);
  return `<article class="service-card">
    <div>
      <h3>${escapeHtml(service.name)}</h3>
      <div class="meta-line">
        <span>${escapeHtml(service.namespace)}</span>
        <span>${escapeHtml(service.host)}</span>
        <span>ports ${escapeHtml((service.ports || []).join(', ') || '-')}</span>
        <span>database ${escapeHtml(service.suggested_database || '-')}</span>
      </div>
    </div>
    <button class="button small secondary" type="button"
      data-protect-db="true"
      data-name="${escapeHtml(service.name)}"
      data-host="${escapeHtml(service.host)}"
      data-namespace="${escapeHtml(service.namespace || '')}"
      data-owner="${escapeHtml(service.app || service.name)}"
      data-port="${escapeHtml(service.suggested_port || 5432)}"
      data-database="${escapeHtml(service.suggested_database || '')}">
      ${protectedTarget ? 'Review' : 'Protect'}
    </button>
  </article>`;
}

function renderServiceOption(service) {
  return `<article class="service-card compact">
    <div>
      <strong>${escapeHtml(service.name)}</strong>
      <div class="meta-line">
        <span>${escapeHtml(service.namespace)}</span>
        <span>${escapeHtml(service.backup_kind)}</span>
        <span>${escapeHtml((service.ports || []).join(', ') || '-')}</span>
      </div>
    </div>
    ${statusBadge(service.backup_ready ? 'postgres' : 'service')}
  </article>`;
}

function renderDestinations(storage) {
  const list = $('destinations-list');
  if (!list) return;
  const defaults = store.destinations.length ? store.destinations : [{
    name: 'Configured WAL-G destination',
    type: 's3',
    uri: storage.prefix || storage.bucket || 's3://backups',
    notes: storage.endpoint_configured ? 'Endpoint configured by environment' : 'Endpoint is not configured',
    enabled: true,
  }];
  list.innerHTML = defaults.map((destination) => `<article class="destination-card">
    <div>
      <h3>${escapeHtml(destination.name)}</h3>
      <div class="meta-line">
        <span>${escapeHtml(destination.type)}</span>
        <span class="mono">${escapeHtml(destination.uri)}</span>
      </div>
      ${destination.notes ? `<p>${escapeHtml(destination.notes)}</p>` : ''}
    </div>
    ${statusBadge(destination.enabled ? 'enabled' : 'disabled')}
  </article>`).join('');
  populateDestinationSelect($('target-destination'));
}

function renderSourceContracts(contracts) {
  const list = $('source-contracts-list');
  if (!list) return;
  list.innerHTML = contracts.length
    ? contracts.map((contract) => `<article class="destination-card">
      <div>
        <h3>${escapeHtml(sourceLabel(contract.source_category))}</h3>
        <div class="meta-line">
          <span>${escapeHtml(sourceLabel(contract.restore_class))}</span>
          <span>${escapeHtml(contract.credential_policy || '-')}</span>
        </div>
      </div>
      ${statusBadge(contract.execution_status === 'implemented' ? 'enabled' : 'contract only')}
    </article>`).join('')
    : '<div class="muted">No source contracts are published by the API.</div>';
}

function populateDestinationSelect(select) {
  if (!select) return;
  if (store.destinations.length) {
    select.innerHTML = store.destinations
      .filter((destination) => destination.enabled)
      .map((destination) => `<option value="${escapeHtml(destination.uri)}">${escapeHtml(destination.name)} - ${escapeHtml(destination.uri)}</option>`)
      .join('');
    return;
  }
  const prefix = store.summary?.storage?.prefix || 's3://backups';
  select.innerHTML = `<option value="${escapeHtml(prefix)}">Configured WAL-G destination - ${escapeHtml(prefix)}</option>`;
}

function renderRunsTable(tbody, runs) {
  tbody.innerHTML = runs.length ? runs.map((run) => `<tr>
    <td>${escapeHtml(run.job?.name || shortId(run.job_id))}</td>
    <td>${statusBadge(run.status)}</td>
    <td>${verificationBadge(run)}<div class="muted">${escapeHtml(run.verification_reason || '')}</div></td>
    <td>${escapeHtml(run.triggered_by || '-')}</td>
    <td>${escapeHtml(formatDate(run.started_at))}</td>
    <td>${escapeHtml(duration(run.started_at, run.completed_at))}</td>
    <td>${escapeHtml(formatDate(run.verification_checked_at))}</td>
  </tr>`).join('') : '<tr><td colspan="7" class="muted">No backup runs found.</td></tr>';
}

function renderJobs() {
  populateTargetSelect($('job-target'));
  $('jobs-table').innerHTML = store.jobs.length ? store.jobs.map((job) => `<tr>
    <td><strong>${escapeHtml(job.name)}</strong><div class="mono">${escapeHtml(shortId(job.id))}</div></td>
    <td>${escapeHtml(job.target?.name || shortId(job.target_id))}<div class="muted">${escapeHtml(job.target?.database_name || '')}</div></td>
    <td><span class="mono">${escapeHtml(job.schedule_cron)}</span><div class="muted">${escapeHtml(cronLabel(job.schedule_cron))}</div></td>
    <td>${escapeHtml(job.retention_full_count)} full</td>
    <td>${statusBadge(job.enabled ? 'enabled' : 'disabled')}</td>
    <td>${escapeHtml(formatDate(job.last_run_at))}</td>
    <td>
      <button class="button small secondary" type="button" data-run-job="${escapeHtml(job.id)}">Run</button>
      <button class="button small secondary" type="button" data-toggle-job="${escapeHtml(job.id)}" data-enabled="${job.enabled ? 'true' : 'false'}">${job.enabled ? 'Disable' : 'Enable'}</button>
    </td>
  </tr>`).join('') : '<tr><td colspan="7" class="muted">No schedules configured.</td></tr>';

  $('targets-list').innerHTML = store.targets.length ? store.targets.map((target) => `<article class="target-card">
    <div>
      <h3>${escapeHtml(target.name)}</h3>
      <div class="meta-line">
        <span>${escapeHtml(target.type || 'postgres')}</span>
        <span>${escapeHtml(sourceLabel(target.source_category || 'postgres_database'))}</span>
        <span>owner ${escapeHtml(target.service_owner || 'unassigned')}</span>
        <span>${escapeHtml(target.criticality || 'standard')}</span>
        <span>${escapeHtml(target.host)}:${escapeHtml(target.port)}</span>
        <span>${escapeHtml(target.database_name)}</span>
        <span>RPO ${escapeHtml(target.rpo_minutes ? `${target.rpo_minutes}m` : '-')}</span>
        <span>RTO ${escapeHtml(target.rto_minutes ? `${target.rto_minutes}m` : '-')}</span>
      </div>
    </div>
    <div>${statusBadge(target.enabled ? 'enabled' : 'disabled')}</div>
  </article>`).join('') : '<div class="muted">No targets configured.</div>';
}

function renderRestore() {
  populateTargetSelect($('restore-target'));
  const successfulRuns = store.runs.filter((run) => run.status === 'success');
  $('backups-table').innerHTML = successfulRuns.length ? successfulRuns.map((run) => `<tr>
    <td class="mono">${escapeHtml(shortId(run.id))}</td>
    <td>${escapeHtml(run.job?.name || shortId(run.job_id))}</td>
    <td>${statusBadge(run.status)}</td>
    <td>${verificationBadge(run)}<div class="muted">${escapeHtml(run.verification_reason || '')}</div></td>
    <td>${escapeHtml(formatDate(run.started_at))}</td>
    <td>${escapeHtml(run.triggered_by || '-')}</td>
    <td><button class="button small secondary" type="button" data-restore-run="${escapeHtml(run.id)}">Restore</button></td>
  </tr>`).join('') : '<tr><td colspan="7" class="muted">No successful backup runs found.</td></tr>';

  $('restore-table').innerHTML = store.restores.length ? store.restores.map((request) => `<tr>
    <td class="mono">${escapeHtml(shortId(request.id))}</td>
    <td>${escapeHtml(request.target?.name || shortId(request.target_id))}</td>
    <td>${statusBadge(request.status)}</td>
    <td>${escapeHtml(request.requested_by || '-')}</td>
    <td>${escapeHtml(formatDate(request.created_at))}</td>
  </tr>`).join('') : '<tr><td colspan="5" class="muted">No restore requests found.</td></tr>';
}

function populateTargetSelect(select) {
  if (!select) return;
  select.innerHTML = store.targets.length
    ? store.targets.map((target) => `<option value="${escapeHtml(target.id)}">${escapeHtml(target.name)} - ${escapeHtml(target.database_name)}</option>`).join('')
    : '<option value="">No targets available</option>';
}

function renderEmptyStates(message = 'Waiting for authorized data.') {
  ['runs-table', 'jobs-table', 'backups-table', 'restore-table'].forEach((id) => {
    const el = $(id);
    if (el) el.innerHTML = `<tr><td colspan="8" class="muted">${escapeHtml(message)}</td></tr>`;
  });
  ['coverage-list', 'targets-list'].forEach((id) => {
    const el = $(id);
    if (el) el.innerHTML = `<div class="muted">${escapeHtml(message)}</div>`;
  });
}

async function createJob(event) {
  event.preventDefault();
  const retention = Number($('job-retention').value || 7);
  const approvalActor = $('job-retention-approval-actor')?.value.trim();
  const approvalReason = $('job-retention-approval-reason')?.value.trim();
  if (retention < 3 && (!approvalActor || !approvalReason || approvalReason.length < 12)) {
    showNotice('Retention below three full backups requires owner approval actor and reason.', 'error');
    return;
  }
  const body = {
    name: $('job-name').value.trim(),
    target_id: $('job-target').value,
    schedule_cron: $('job-cron').value.trim(),
    retention_full_count: retention,
    retention_approval_actor: retention < 3 ? approvalActor : undefined,
    retention_approval_reason: retention < 3 ? approvalReason : undefined,
    storage_prefix: $('job-prefix').value.trim() || undefined,
  };
  await api('/jobs', { method: 'POST', body: JSON.stringify(body) });
  $('job-form').reset();
  $('job-retention').value = 7;
  $('job-cron').value = '0 2 * * *';
  $('job-form-panel').classList.add('hidden');
  showNotice('Backup schedule created.');
  await loadPage();
}

async function createTarget(event) {
  event.preventDefault();
  const retention = Number($('target-retention').value || 7);
  const approvalActor = $('target-retention-approval-actor')?.value.trim();
  const approvalReason = $('target-retention-approval-reason')?.value.trim();
  if (retention < 3 && (!approvalActor || !approvalReason || approvalReason.length < 12)) {
    showNotice('Retention below three full backups requires owner approval actor and reason.', 'error');
    return;
  }
  const targetBody = {
    source_category: $('target-source-category').value,
    criticality: $('target-criticality').value,
    rpo_minutes: Number($('target-rpo').value || 0) || undefined,
    rto_minutes: Number($('target-rto').value || 0) || undefined,
    restore_class: $('target-restore-class').value,
    kubernetes_namespace: $('target-namespace').value.trim() || undefined,
    name: $('target-name').value.trim(),
    host: $('target-host').value.trim(),
    port: Number($('target-port').value || 5432),
    database_name: $('target-database').value.trim(),
    vault_secret_ref: $('target-secret').value.trim() || undefined,
    service_owner: $('target-owner').value.trim() || undefined,
    coverage_notes: $('target-notes').value.trim() || undefined,
    enabled: true,
  };
  if (targetBody.source_category !== 'postgres_database') {
    showNotice('This source category is contract-only in Goal 05. Create executable schedules only for PostgreSQL database targets.', 'error');
    return;
  }
  const createdTarget = await api('/targets', { method: 'POST', body: JSON.stringify(targetBody) });
  const destination = $('target-destination').value || store.summary?.storage?.prefix || createdTarget.database_name;
  await api('/jobs', {
    method: 'POST',
    body: JSON.stringify({
      target_id: createdTarget.id,
      name: `${createdTarget.name} daily backup`,
      schedule_cron: $('target-cron').value,
      retention_full_count: retention,
      retention_approval_actor: retention < 3 ? approvalActor : undefined,
      retention_approval_reason: retention < 3 ? approvalReason : undefined,
      storage_prefix: `${destination.replace(/\/$/, '')}/${createdTarget.database_name}`,
      enabled: true,
    }),
  });
  $('target-form').reset();
  $('target-port').value = 5432;
  $('target-retention').value = 7;
  $('target-cron').value = '0 2 * * *';
  $('target-source-category').value = 'postgres_database';
  $('target-criticality').value = 'standard';
  $('target-restore-class').value = 'logical_postgres';
  showNotice('Backup target and schedule created.');
  await loadPage();
}

async function createDestination(event) {
  event.preventDefault();
  await api('/destinations', {
    method: 'POST',
    body: JSON.stringify({
      name: $('destination-name').value.trim(),
      type: $('destination-type').value,
      uri: $('destination-uri').value.trim(),
      notes: $('destination-notes').value.trim() || undefined,
      enabled: true,
    }),
  });
  $('destination-form').reset();
  showNotice('Backup destination added.');
  await loadPage();
}

async function submitRestore(event) {
  event.preventDefault();
  const runId = $('restore-run').value.trim();
  const targetId = $('restore-target').value;
  const confirmedRun = $('restore-confirm-run').value.trim();
  const confirmedTarget = $('restore-confirm-target').value.trim();
  const approvalActor = $('restore-approval-actor').value.trim();
  const approvalReason = $('restore-approval-reason').value.trim();
  if (!$('restore-confirm').checked) {
    showNotice('Production restore approval confirmation is required before submitting a restore request.', 'error');
    return;
  }
  if (confirmedRun !== runId || confirmedTarget !== targetId) {
    showNotice('Restore confirmation must repeat the exact backup run ID and target ID.', 'error');
    return;
  }
  if (!approvalActor || approvalReason.length < 12) {
    showNotice('Restore approval actor and reason are required.', 'error');
    return;
  }
  const body = {
    backup_run_id: runId,
    target_id: targetId,
    approval_confirmed_backup_run_id: confirmedRun,
    approval_confirmed_target_id: confirmedTarget,
    approval_actor: approvalActor,
    approval_reason: approvalReason,
    production_restore_approved: true,
  };
  await api('/restore', { method: 'POST', body: JSON.stringify(body) });
  $('restore-form-panel').classList.add('hidden');
  $('restore-confirm').checked = false;
  $('restore-confirm-run').value = '';
  $('restore-confirm-target').value = '';
  $('restore-approval-reason').value = '';
  showNotice('Restore request submitted.');
  await loadPage();
}

document.addEventListener('click', async (event) => {
  const target = event.target.closest('button, a');
  if (!target) return;
  const action = target.dataset.action;
  try {
    if (action === 'refresh') await loadPage();
    if (action === 'logout') await logout();
    if (action === 'show-job-form') $('job-form-panel')?.classList.remove('hidden');
    if (action === 'hide-job-form') $('job-form-panel')?.classList.add('hidden');
    if (action === 'hide-restore-form') $('restore-form-panel')?.classList.add('hidden');
    if (target.dataset.runJob) {
      await api('/backups/trigger', { method: 'POST', body: JSON.stringify({ job_id: target.dataset.runJob }) });
      showNotice('Manual backup run triggered.');
      await loadPage();
    }
    if (target.dataset.toggleJob) {
      const enabled = target.dataset.enabled === 'true';
      await api(`/jobs/${target.dataset.toggleJob}`, { method: 'PATCH', body: JSON.stringify({ enabled: !enabled }) });
      showNotice(enabled ? 'Schedule disabled.' : 'Schedule enabled.');
      await loadPage();
    }
    if (target.dataset.restoreRun) {
      $('restore-run').value = target.dataset.restoreRun;
      $('restore-confirm-run').value = '';
      $('restore-confirm-target').value = '';
      $('restore-approval-actor').value = currentActorLabel();
      $('restore-approval-reason').value = '';
      $('restore-form-panel').classList.remove('hidden');
      $('restore-form-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (target.dataset.protectDb) {
      $('target-name').value = target.dataset.name || '';
      $('target-host').value = target.dataset.host || '';
      $('target-port').value = target.dataset.port || 5432;
      $('target-database').value = target.dataset.database || '';
      $('target-namespace').value = target.dataset.namespace || '';
      $('target-owner').value = target.dataset.owner || '';
      $('target-source-category').value = 'postgres_database';
      $('target-restore-class').value = 'logical_postgres';
      $('target-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
      $('target-secret').focus();
    }
  } catch (error) {
    showNotice(error.message, 'error');
  }
});

document.addEventListener('submit', async (event) => {
  try {
    if (event.target.id === 'login-form') await login(event);
    if (event.target.id === 'job-form') await createJob(event);
    if (event.target.id === 'target-form') await createTarget(event);
    if (event.target.id === 'destination-form') await createDestination(event);
    if (event.target.id === 'restore-form') await submitRestore(event);
  } catch (error) {
    showNotice(error.message, 'error');
  }
});

loadPage();
if (page) setInterval(loadPage, page === 'restore' ? 15000 : 30000);
