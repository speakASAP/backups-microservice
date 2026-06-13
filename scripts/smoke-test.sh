#!/bin/bash
set -euo pipefail
BASE_URL="${BACKUPS_SMOKE_BASE_URL:-https://backups.alfares.cz}"
REQUIRE_AUTH="${BACKUPS_SMOKE_REQUIRE_AUTH:-false}"
AUTH_HEADER="${BACKUPS_SMOKE_AUTH_HEADER:-}"
if [ -z "${AUTH_HEADER}" ] && [ -n "${BACKUPS_SMOKE_TOKEN:-}" ]; then
  AUTH_HEADER="Bearer ${BACKUPS_SMOKE_TOKEN}"
fi
BASE_URL="${BASE_URL%/}"
export BASE_URL REQUIRE_AUTH AUTH_HEADER
node <<'NODE'
const baseUrl = process.env.BASE_URL;
const requireAuth = process.env.REQUIRE_AUTH === 'true';
const authHeader = process.env.AUTH_HEADER || '';
const results = [];
function record(name, status, detail) {
  results.push({ name, status, detail });
  const marker = status === 'pass' ? 'PASS' : status === 'skip' ? 'SKIP' : 'FAIL';
  console.log(`${marker} ${name}${detail ? ` - ${detail}` : ''}`);
}
function fail(message) {
  throw new Error(message);
}
async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'GET',
    redirect: 'manual',
    headers: options.auth && authHeader ? { Authorization: authHeader } : {},
  });
  const contentType = response.headers.get('content-type') || '';
  let body = null;
  if (contentType.includes('application/json')) {
    body = await response.json().catch(() => null);
  } else {
    body = await response.text().catch(() => '');
  }
  return { response, body };
}
function expectObject(body, name) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    fail(`${name} did not return a JSON object`);
  }
}
function expectArray(body, name) {
  if (!Array.isArray(body)) fail(`${name} did not return a JSON array`);
}
async function checkPublic(name, path, validate) {
  try {
    const { response, body } = await request(path);
    if (!response.ok) fail(`HTTP ${response.status}`);
    validate(body, response);
    record(name, 'pass', `HTTP ${response.status}`);
  } catch (error) {
    record(name, 'fail', error.message);
    throw error;
  }
}
async function checkProtectedRejects(path) {
  try {
    const { response } = await request(path);
    if (response.status !== 401 && response.status !== 403) {
      fail(`expected 401/403, got HTTP ${response.status}`);
    }
    record(`protected rejection ${path}`, 'pass', `HTTP ${response.status}`);
  } catch (error) {
    record(`protected rejection ${path}`, 'fail', error.message);
    throw error;
  }
}
async function checkAuthenticated(name, path, validate) {
  if (!authHeader) {
    if (requireAuth) fail(`${name} requires BACKUPS_SMOKE_AUTH_HEADER or BACKUPS_SMOKE_TOKEN`);
    record(name, 'skip', 'no smoke auth provided');
    return;
  }
  try {
    const { response, body } = await request(path, { auth: true });
    if (!response.ok) fail(`HTTP ${response.status}`);
    validate(body, response);
    record(name, 'pass', `HTTP ${response.status}`);
  } catch (error) {
    record(name, 'fail', error.message);
    throw error;
  }
}
(async () => {
  await checkPublic('health liveness', '/health', (body) => {
    expectObject(body, 'health');
    if (body.service !== 'backups-microservice') fail('unexpected service name');
  });
  await checkPublic('health readiness', '/health/readiness', (body) => {
    expectObject(body, 'readiness');
    expectObject(body.checks, 'readiness checks');
    expectObject(body.checks.database, 'database readiness');
    expectObject(body.checks.storage, 'storage readiness');
    if (!['ready', 'degraded'].includes(body.status)) fail('unexpected readiness status');
  });
  await checkPublic('info', '/info', (body) => {
    expectObject(body, 'info');
    if (body.service !== 'backups-microservice') fail('unexpected service name');
    expectObject(body.endpoints, 'info endpoints');
  });
  await checkProtectedRejects('/jobs');
  await checkAuthenticated('dashboard summary', '/dashboard/summary', (body) => {
    expectObject(body, 'dashboard summary');
    expectObject(body.stats, 'dashboard stats');
    if (!Array.isArray(body.recent_runs)) fail('dashboard recent_runs missing');
  });
  await checkAuthenticated('jobs list', '/jobs', (body) => {
    expectArray(body, 'jobs');
  });
  await checkAuthenticated('targets list', '/targets', (body) => {
    expectArray(body, 'targets');
  });
  await checkAuthenticated('recent backup runs', '/backups?limit=5', (body) => {
    expectArray(body, 'recent backup runs');
  });
  const failed = results.filter((result) => result.status === 'fail');
  if (failed.length > 0) process.exit(1);
  const skipped = results.filter((result) => result.status === 'skip');
  if (skipped.length > 0) {
    console.log(`Smoke completed with ${skipped.length} authenticated check(s) skipped.`);
  } else {
    console.log('Smoke completed with all checks passing.');
  }
})().catch((error) => {
  console.error(`Smoke failed: ${error.message}`);
  process.exit(1);
});
NODE
