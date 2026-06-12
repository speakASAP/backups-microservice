const store = {
  token: localStorage.getItem('backups_token') || '',
  summary: null,
  targets: [],
  jobs: [],
  runs: [],
  restores: [],
};

const page = document.querySelector('[data-page]')?.dataset.page;

function $(id) {
  return document.getElementById(id);
}

function headers(json = false) {
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(store.token ? { Authorization: `Bearer ${store.token}` } : {}),
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

function initTokenControl() {
  const input = $('token-input');
  if (input) input.value = store.token;
  document.querySelectorAll('[data-action="save-token"]').forEach((button) => {
    button.addEventListener('click', () => {
      store.token = input?.value.trim() || '';
      if (store.token) localStorage.setItem('backups_token', store.token);
      else localStorage.removeItem('backups_token');
      showNotice(store.token ? 'Token saved for this browser.' : 'Token cleared.');
      loadPage();
    });
  });
}

function requireTokenBeforeLoad() {
  if (store.token) return false;
  showNotice('Enter an admin JWT or service token to load backup data.');
  renderEmptyStates('Authorization required.');
  return true;
}

function statusBadge(status) {
  const value = status || 'none';
  const kind = ['success', 'completed', 'enabled'].includes(value)
    ? 'ok'
    : ['failed', 'disabled'].includes(value)
      ? 'bad'
      : ['running', 'pending', 'verifying'].includes(value)
        ? 'warn'
        : 'neutral';
  return `<span class="badge ${kind}">${escapeHtml(value)}</span>`;
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

async function loadSummary() {
  store.summary = await api('/dashboard/summary');
  store.targets = store.summary.coverage?.map((item) => item.target) || [];
  store.jobs = store.summary.coverage?.flatMap((item) => item.jobs || []) || [];
  store.runs = store.summary.recent_runs || [];
  store.restores = store.summary.restore_requests || [];
}

async function loadRawCollections() {
  const [targets, jobs, runs, restores] = await Promise.all([
    api('/targets'),
    api('/jobs'),
    api('/backups?limit=80'),
    api('/restore'),
  ]);
  store.targets = Array.isArray(targets) ? targets : [];
  store.jobs = Array.isArray(jobs) ? jobs : [];
  store.runs = Array.isArray(runs) ? runs : [];
  store.restores = Array.isArray(restores) ? restores : [];
}

async function loadPage() {
  hideNotice();
  if (requireTokenBeforeLoad()) return;
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
    showNotice(isAuthError
      ? 'Authorization failed. Check the admin JWT or service token and save it again.'
      : error.message,
    isAuthError ? 'error' : 'info');
    renderEmptyStates(isAuthError ? 'Authorization failed.' : 'Unable to load data.');
  }
}

function renderDashboard() {
  const summary = store.summary || {};
  const stats = summary.stats || {};
  $('metric-protected').textContent = `${summary.coverage?.filter((item) => item.protected).length || 0}/${stats.targets_total || 0}`;
  $('metric-jobs').textContent = `${stats.jobs_enabled || 0}/${stats.jobs_total || 0}`;
  $('metric-runs').textContent = stats.runs_24h ?? 0;
  $('metric-failed').textContent = stats.failed_24h ?? 0;
  $('metric-latest').innerHTML = statusBadge(stats.latest_status);

  const coverage = $('coverage-list');
  coverage.innerHTML = (summary.coverage || []).length
    ? summary.coverage.map(renderCoverageCard).join('')
    : '<div class="muted">No backup targets are configured.</div>';

  renderSettings(summary.storage || {}, summary.guardrails || {});
  renderRunsTable($('runs-table'), summary.recent_runs || []);
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
        <span>${escapeHtml(target.host || '-')}:${escapeHtml(target.port || '-')}</span>
        <span>database ${escapeHtml(target.database_name || '-')}</span>
      </div>
      <div class="meta-line">
        <span>schedule ${escapeHtml(schedule)}</span>
        <span>retention ${escapeHtml(retention)}</span>
        <span>last success ${escapeHtml(formatDate(item.last_success?.completed_at))}</span>
      </div>
    </div>
    <div>${statusBadge(item.protected ? 'enabled' : 'disabled')}</div>
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

function renderRunsTable(tbody, runs) {
  tbody.innerHTML = runs.length ? runs.map((run) => `<tr>
    <td>${escapeHtml(run.job?.name || shortId(run.job_id))}</td>
    <td>${statusBadge(run.status)}</td>
    <td>${escapeHtml(run.triggered_by || '-')}</td>
    <td>${escapeHtml(formatDate(run.started_at))}</td>
    <td>${escapeHtml(duration(run.started_at, run.completed_at))}</td>
    <td class="mono">${escapeHtml(run.storage_path || '-')}</td>
  </tr>`).join('') : '<tr><td colspan="6" class="muted">No backup runs found.</td></tr>';
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
        <span>${escapeHtml(target.host)}:${escapeHtml(target.port)}</span>
        <span>${escapeHtml(target.database_name)}</span>
        <span>secret ref ${escapeHtml(target.vault_secret_ref || 'not set')}</span>
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
    <td>${escapeHtml(formatDate(run.started_at))}</td>
    <td>${escapeHtml(run.triggered_by || '-')}</td>
    <td><button class="button small secondary" type="button" data-restore-run="${escapeHtml(run.id)}">Restore</button></td>
  </tr>`).join('') : '<tr><td colspan="6" class="muted">No successful backup runs found.</td></tr>';

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
  if (retention < 3) {
    showNotice('Retention below three full backups requires explicit owner approval and is blocked in this UI.', 'error');
    return;
  }
  const body = {
    name: $('job-name').value.trim(),
    target_id: $('job-target').value,
    schedule_cron: $('job-cron').value.trim(),
    retention_full_count: retention,
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

async function submitRestore(event) {
  event.preventDefault();
  if (!$('restore-confirm').checked) {
    showNotice('Human approval confirmation is required before submitting a restore request.', 'error');
    return;
  }
  const body = {
    backup_run_id: $('restore-run').value,
    target_id: $('restore-target').value,
  };
  await api('/restore', { method: 'POST', body: JSON.stringify(body) });
  $('restore-form-panel').classList.add('hidden');
  $('restore-confirm').checked = false;
  showNotice('Restore request submitted.');
  await loadPage();
}

document.addEventListener('click', async (event) => {
  const target = event.target.closest('button, a');
  if (!target) return;
  const action = target.dataset.action;
  try {
    if (action === 'refresh') await loadPage();
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
      $('restore-form-panel').classList.remove('hidden');
      $('restore-form-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } catch (error) {
    showNotice(error.message, 'error');
  }
});

document.addEventListener('submit', async (event) => {
  try {
    if (event.target.id === 'job-form') await createJob(event);
    if (event.target.id === 'restore-form') await submitRestore(event);
  } catch (error) {
    showNotice(error.message, 'error');
  }
});

initTokenControl();
loadPage();
setInterval(loadPage, page === 'restore' ? 15000 : 30000);
