import { GITHUB_API_BASE, STORAGE_KEYS } from '../utils/constants.js';

/* ------------------------------------------------------------------
 * GitHub Contents API client (OAuth token based)
 * ------------------------------------------------------------------ */

function getToken() { return localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN); }

function getAuthUser() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.AUTH_USER) || 'null'); }
  catch { return null; }
}

function getRepoConfig() {
  const saved = localStorage.getItem(STORAGE_KEYS.GITHUB_REPO);
  const user  = getAuthUser();
  const repo  = saved || (user ? `${user.login}/mindflow-data` : null);
  const path  = localStorage.getItem(STORAGE_KEYS.GITHUB_PATH) || 'mindmaps';
  return { repo, path };
}

async function apiFetch(url, opts = {}) {
  const token = getToken();
  if (!token) throw Object.assign(new Error('Not authenticated'), { status: 401 });

  const res = await fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...opts.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err  = Object.assign(new Error(`GitHub ${res.status}: ${body.message || res.statusText}`), {
      status: res.status, body,
    });
    throw err;
  }
  return res.json();
}

/** Verify token + return GitHub user object. */
export async function testConnection() {
  try {
    const user = await apiFetch(`${GITHUB_API_BASE}/user`);
    return { ok: true, user };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Ensure the storage repo exists (creates private repo if missing).
 * Call once after login before any push.
 */
export async function ensureRepo() {
  const { repo } = getRepoConfig();
  if (!repo) throw new Error('No repository configured');
  const [owner, name] = repo.split('/');
  try {
    await apiFetch(`${GITHUB_API_BASE}/repos/${owner}/${name}`);
  } catch (e) {
    if (e.status !== 404) throw e;
    // Create private repo
    await apiFetch(`${GITHUB_API_BASE}/user/repos`, {
      method: 'POST',
      body: JSON.stringify({
        name,
        private: true,
        description: 'MindFlow – personal mind map storage',
        auto_init: true,
      }),
    });
    // Give GitHub a moment to initialise
    await new Promise(r => setTimeout(r, 1500));
  }
}

/* SHA cache so we avoid an extra GET on every save */
const shaCache = new Map();

async function readFile(filePath) {
  const { repo, path } = getRepoConfig();
  try {
    const data = await apiFetch(`${GITHUB_API_BASE}/repos/${repo}/contents/${path}/${filePath}`);
    const content = JSON.parse(decodeURIComponent(escape(atob(data.content.replace(/\n/g, '')))));
    return { content, sha: data.sha };
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}

async function writeFile(filePath, content, sha) {
  const { repo, path } = getRepoConfig();
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 2))));
  const body = {
    message: `MindFlow: update ${filePath}`,
    content: encoded,
    ...(sha ? { sha } : {}),
  };
  const result = await apiFetch(`${GITHUB_API_BASE}/repos/${repo}/contents/${path}/${filePath}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  return result.content.sha;
}

/** Push one mind map to GitHub. Creates or updates the JSON file. */
export async function pushMindMap(id, title, data) {
  const file    = `${id}.json`;
  const payload = { id, title, data, updatedAt: new Date().toISOString() };
  let sha = shaCache.get(file);

  // On first push we may not have SHA yet – fetch it
  if (!sha) {
    const existing = await readFile(file);
    sha = existing?.sha ?? null;
    if (sha) shaCache.set(file, sha);
  }

  try {
    const newSha = await writeFile(file, payload, sha);
    shaCache.set(file, newSha);
    return { ok: true };
  } catch (e) {
    if (e.status === 409) {
      // Conflict – re-fetch fresh SHA and retry once
      const fresh = await readFile(file);
      if (fresh) {
        const newSha = await writeFile(file, payload, fresh.sha);
        shaCache.set(file, newSha);
        return { ok: true };
      }
    }
    throw e;
  }
}

/** Pull one mind map from GitHub. Returns null if not found. */
export async function pullMindMap(id) {
  const result = await readFile(`${id}.json`);
  if (result) { shaCache.set(`${id}.json`, result.sha); return result.content; }
  return null;
}

/** List all remote mind map files in the data directory. */
export async function listRemoteMaps() {
  const { repo, path } = getRepoConfig();
  try {
    const files = await apiFetch(`${GITHUB_API_BASE}/repos/${repo}/contents/${path}`);
    return Array.isArray(files)
      ? files.filter(f => f.type === 'file' && f.name.endsWith('.json'))
             .map(f => ({ name: f.name, sha: f.sha }))
      : [];
  } catch (e) {
    if (e.status === 404) return [];
    throw e;
  }
}

export function isSyncEnabled() { return !!getToken(); }
