import { GITHUB_API_BASE, GITHUB_OAUTH_URL, GITHUB_OAUTH_SCOPE, STORAGE_KEYS } from '../utils/constants.js';

/**
 * GitHub OAuth client for the SPA.
 *
 * Flow:
 *  1. login()           → redirect to GitHub
 *  2. handleCallback()  → exchange code via /api/auth/callback → store token
 *  3. getUser()         → fetch user info → whitelist check
 *
 * In development (localhost) the Cloudflare Function isn't available,
 * so we use VITE_GITHUB_CLIENT_ID env var and skip the server-side exchange
 * by storing the token directly (dev-only path).
 */

// ── Helpers ────────────────────────────────────────────────────────
function saveToken(token) { localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token); }
function saveUser(user)   { localStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(user)); }

export function getStoredToken() { return localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN); }

export function getStoredUser() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.AUTH_USER) || 'null'); }
  catch { return null; }
}

export function clearAuth() {
  localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
  localStorage.removeItem(STORAGE_KEYS.OAUTH_STATE);
}

export function hasGitHubOAuthClientId() {
  return Boolean(import.meta.env.VITE_GITHUB_CLIENT_ID);
}

// ── PKCE / state ───────────────────────────────────────────────────
function generateState() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

// ── Login ──────────────────────────────────────────────────────────
export function login() {
  const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
  if (!clientId) {
    console.warn('VITE_GITHUB_CLIENT_ID is not configured');
    return false;
  }
  const state       = generateState();
  sessionStorage.setItem(STORAGE_KEYS.OAUTH_STATE, state);

  const params = new URLSearchParams({
    client_id:    clientId,
    redirect_uri: `${location.origin}/api/auth/callback`,
    scope:        GITHUB_OAUTH_SCOPE,
    state,
  });
  location.href = `${GITHUB_OAUTH_URL}?${params}`;
  return true;
}

// ── Handle callback (called from main.js on page load) ─────────────
/**
 * Reads the `access_token` hash param set by the Cloudflare Function
 * (or `code`+`state` in dev mode).
 * Returns `{ ok: boolean, user?: object, error?: string }`
 */
export async function handleCallback() {
  // Parse hash: #access_token=xxx  (set by CF Function redirect)
  const hash   = new URLSearchParams(location.hash.slice(1));
  const search = new URLSearchParams(location.search);

  const token = hash.get('access_token') || search.get('access_token');
  if (!token) return null;  // Not a callback

  // Clean URL
  history.replaceState(null, '', location.pathname);

  saveToken(token);

  // Fetch user
  try {
    const user = await fetchUser(token);
    saveUser(user);
    return { ok: true, user };
  } catch (e) {
    clearAuth();
    return { ok: false, error: e.message };
  }
}

// ── Fetch user via GitHub API ──────────────────────────────────────
async function fetchUser(token) {
  const res = await fetch(`${GITHUB_API_BASE}/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) throw new Error(`GitHub user fetch failed: ${res.status}`);
  return res.json();
}

// ── Whitelist check ────────────────────────────────────────────────
/**
 * Checks if the authenticated user is allowed.
 * ALLOWED_GITHUB_LOGIN is set via .env:  VITE_ALLOWED_LOGIN=your_username
 */
export function isAllowed(user) {
  const allowed = import.meta.env.VITE_ALLOWED_LOGIN;
  if (!allowed) return true;   // If not configured, allow everyone (dev)
  return user?.login?.toLowerCase() === allowed.toLowerCase();
}

// ── Session check ──────────────────────────────────────────────────
export async function checkSession() {
  const token = getStoredToken();
  const user  = getStoredUser();
  if (!token || !user) return { authenticated: false };

  // Optionally refresh user info
  try {
    const fresh = await fetchUser(token);
    saveUser(fresh);
    return { authenticated: true, user: fresh };
  } catch {
    clearAuth();
    return { authenticated: false };
  }
}

export function logout() { clearAuth(); }
