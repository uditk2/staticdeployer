import { config } from '../config/env.js';

const API_BASE = 'https://api.cloudflare.com/client/v4';

function authHeaders() {
  // Prefer API Token if provided
  if (config.cf.apiToken && config.cf.apiToken.trim() !== '') {
    return { 'Authorization': `Bearer ${config.cf.apiToken}` };
  }
  // Fallback to Global API Key headers if present
  if (config.cf.apiKey && config.cf.email) {
    return { 'X-Auth-Email': config.cf.email, 'X-Auth-Key': config.cf.apiKey };
  }
  return {};
}

export async function putKV(key, value) {
  const url = `${API_BASE}/accounts/${config.cf.accountId}/storage/kv/namespaces/${config.cf.kvNamespaceId}/values/${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      ...authHeaders(),
      // Content-Type must be text/plain for raw values; we send JSON string
      'Content-Type': 'text/plain',
    },
    body: typeof value === 'string' ? value : JSON.stringify(value),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 403) {
      throw new Error(
        `KV put failed (403): ${text}. Hint: ensure CF_API_TOKEN is a Cloudflare API Token with 'Account -> Workers KV Storage:Edit' scope, and CF_ACCOUNT_ID/CF_KV_NAMESPACE_ID belong to the same account.`
      );
    }
    throw new Error(`KV put failed (${res.status}): ${text}`);
  }
}

export async function putHostMapping(host, mapping) {
  // store as JSON string
  await putKV(`host:${host}`, mapping);
}

export async function getHostMapping(host) {
  const url = `${API_BASE}/accounts/${config.cf.accountId}/storage/kv/namespaces/${config.cf.kvNamespaceId}/values/${encodeURIComponent('host:' + host)}`;
  const res = await fetch(url, {
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`KV get failed ${res.status}`);
  try {
    return await res.json();
  } catch {
    const text = await res.text();
    return JSON.parse(text);
  }
}

export async function deleteKV(key) {
  const url = `${API_BASE}/accounts/${config.cf.accountId}/storage/kv/namespaces/${config.cf.kvNamespaceId}/values/${encodeURIComponent(key)}`;
  console.log(`[KV] Deleting key: ${key}`);
  const res = await fetch(url, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`KV delete failed (${res.status}): ${text}`);
  }
  console.log(`[KV] Delete successful (status: ${res.status})`);
}

export async function deleteHostMapping(host) {
  await deleteKV(`host:${host}`);
}
