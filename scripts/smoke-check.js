#!/usr/bin/env node
'use strict';

const baseUrl = (process.env.BACKUPS_BASE_URL || process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3398').replace(/\/$/, '');
const authToken = process.env.BACKUPS_AUTH_TOKEN || process.env.SMOKE_AUTH_TOKEN || process.env.SERVICE_TOKEN || '';
const requireAuthSmoke = ['1', 'true', 'yes'].includes(String(process.env.BACKUPS_REQUIRE_AUTH_SMOKE || '').toLowerCase());
const timeoutMs = Number(process.env.BACKUPS_SMOKE_TIMEOUT_MS || 10000);

function redactError(error) {
  return error instanceof Error ? error.message.replace(/[A-Za-z0-9._~+/-]{24,}/g, '[redacted]') : 'unknown error';
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method || 'GET',
      headers: options.headers || {},
      signal: controller.signal,
    });
    const contentType = response.headers.get('content-type') || '';
    const body = contentType.includes('application/json') ? await response.json().catch(() => null) : null;
    return { status: response.status, ok: response.ok, body };
  } finally {
    clearTimeout(timer);
  }
}

function expectObject(name, response) {
  if (!response.ok || response.body === null || Array.isArray(response.body) || typeof response.body !== 'object') {
    throw new Error(`${name} did not return a JSON object with a successful status`);
  }
}

function expectArray(name, response) {
  if (!response.ok || !Array.isArray(response.body)) {
    throw new Error(`${name} did not return a JSON array with a successful status`);
  }
}

function expectRejected(name, response) {
  if (![401, 403].includes(response.status)) {
    throw new Error(`${name} should reject unauthenticated requests; received HTTP ${response.status}`);
  }
}

async function main() {
  const evidence = [];

  const health = await request('/health');
  expectObject('health', health);
  evidence.push('health');

  const readiness = await request('/health/readiness');
  expectObject('readiness', readiness);
  if (readiness.body?.checks?.database === undefined || readiness.body?.checks?.storage === undefined) {
    throw new Error('readiness does not report database and storage checks separately');
  }
  if (!readiness.ok) {
    throw new Error(`readiness is not ready; received HTTP ${readiness.status}`);
  }
  evidence.push('readiness database/storage');

  const info = await request('/info');
  expectObject('info', info);
  evidence.push('info');

  expectRejected('jobs unauthenticated protection', await request('/jobs'));
  evidence.push('protected endpoint rejection');

  const protectedPaths = [
    ['/dashboard/summary', 'dashboard summary', expectObject],
    ['/jobs', 'jobs', expectArray],
    ['/targets', 'targets', expectArray],
    ['/backups?limit=5', 'recent runs', expectArray],
  ];

  if (!authToken) {
    if (requireAuthSmoke) throw new Error('authenticated smoke checks require BACKUPS_AUTH_TOKEN or SERVICE_TOKEN');
    for (const [path, name] of protectedPaths) {
      expectRejected(`${name} unauthenticated protection`, await request(path));
      evidence.push(`${name} auth protection`);
    }
  } else {
    const headers = { Authorization: `Bearer ${authToken}` };
    for (const [path, name, assertResponse] of protectedPaths) {
      const response = await request(path, { headers });
      assertResponse(name, response);
      evidence.push(name);
    }
  }

  console.log(`Backups smoke check passed: ${evidence.join(', ')}`);
}

main().catch((error) => {
  console.error(`Backups smoke check failed: ${redactError(error)}`);
  process.exit(1);
});
