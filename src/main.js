import MindMap from 'simple-mind-map';
import './style.css';

const STORAGE_KEYS = {
  token: 'mindflow.githubToken',
  user: 'mindflow.githubUser',
  repo: 'mindflow.repo',
  map: 'mindflow.localMap',
  status: 'mindflow.status',
};

const DEFAULT_REPO = 'mindflow-data';
const DEFAULT_PATH = 'mindflow/mindflow.json';
const API_BASE = 'https://api.github.com';

function defaultMap() {
  const ts = Date.now();
  return {
    root: {
      data: { text: 'MindFlow', expand: true, uid: `root-${ts}` },
      children: [
        { data: { text: '今日やること', expand: true, uid: `a-${ts}` }, children: [] },
        { data: { text: '気になること', expand: true, uid: `b-${ts}` }, children: [] },
        { data: { text: 'あとで整理', expand: true, uid: `c-${ts}` }, children: [] },
      ],
    },
    layout: 'logicalStructure',
  };
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getToken() {
  return localStorage.getItem(STORAGE_KEYS.token) || '';
}

function setToken(token) {
  localStorage.setItem(STORAGE_KEYS.token, token.trim());
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.token);
  localStorage.removeItem(STORAGE_KEYS.user);
}

async function githubFetch(path, { method = 'GET', body, raw = false } = {}) {
  const token = getToken();
  if (!token) {
    throw new Error('GitHub token がありません。');
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const message = error.message || `${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  if (raw) {
    return response;
  }

  return response.json();
}

async function fetchViewer() {
  return githubFetch('/user');
}

function encodeContent(value) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(value, null, 2))));
}

function decodeContent(value) {
  return JSON.parse(decodeURIComponent(escape(atob(value))));
}

async function readRemoteMap(owner, repo) {
  try {
    const file = await githubFetch(`/repos/${owner}/${repo}/contents/${DEFAULT_PATH}`);
    return {
      sha: file.sha,
      content: decodeContent(file.content.replace(/\n/g, '')),
    };
  } catch (error) {
    if (String(error.message).includes('Not Found')) {
      return null;
    }
    throw error;
  }
}

async function writeRemoteMap(owner, repo, payload, sha) {
  return githubFetch(`/repos/${owner}/${repo}/contents/${DEFAULT_PATH}`, {
    method: 'PUT',
    body: {
      message: 'MindFlow mobile sync',
      content: encodeContent(payload),
      ...(sha ? { sha } : {}),
    },
  });
}

function renderTokenScreen(app) {
  app.innerHTML = `
    <main class="shell auth-shell">
      <section class="auth-card">
        <p class="eyebrow">Private Mobile Mind Map</p>
        <h1>MindFlow</h1>
        <p class="lede">
          GitHub Pages 上で動く個人専用マインドマップです。
          GitHub personal access token を入れた端末だけが同期できます。
        </p>
        <label class="field">
          <span>GitHub Token</span>
          <input id="tokenInput" type="password" placeholder="github_pat_..." autocomplete="off" />
        </label>
        <p class="hint">
          必要権限: <code>mktr55/mindflow-data</code> に対する fine-grained token の
          <code>Contents: Read and write</code> と <code>Metadata: Read</code>。
        </p>
        <button id="tokenSubmit" class="primary-btn">接続する</button>
        <p id="tokenError" class="error-text"></p>
      </section>
    </main>
  `;

  const input = document.getElementById('tokenInput');
  const error = document.getElementById('tokenError');
  document.getElementById('tokenSubmit').addEventListener('click', async () => {
    error.textContent = '';
    setToken(input.value);
    try {
      await boot(app);
    } catch (err) {
      clearSession();
      error.textContent = err.message;
    }
  });
}

function setStatus(text, tone = 'muted') {
  const el = document.getElementById('statusPill');
  if (!el) {
    return;
  }
  el.textContent = text;
  el.dataset.tone = tone;
  localStorage.setItem(STORAGE_KEYS.status, JSON.stringify({ text, tone }));
}

function restoreStatus() {
  const saved = readJson(STORAGE_KEYS.status, { text: '未同期', tone: 'muted' });
  setStatus(saved.text, saved.tone);
}

function renderAppShell(app, user) {
  app.innerHTML = `
    <main class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">Signed in as @${user.login}</p>
          <h1>MindFlow</h1>
        </div>
        <button id="logoutBtn" class="ghost-btn">ログアウト</button>
      </header>
      <section class="panel">
        <div class="toolbar">
          <button id="addChildBtn">子ノード</button>
          <button id="addSiblingBtn">兄弟ノード</button>
          <button id="deleteBtn">削除</button>
          <button id="fitBtn">全体表示</button>
          <button id="syncBtn" class="primary-btn">今すぐ同期</button>
        </div>
        <div class="meta-row">
          <span id="statusPill" class="status-pill" data-tone="muted">未同期</span>
          <span class="repo-label">${user.login}/${DEFAULT_REPO}</span>
        </div>
        <div id="mindMapMount" class="mindmap-frame"></div>
      </section>
    </main>
  `;
  restoreStatus();
}

async function boot(app) {
  const user = await fetchViewer();
  writeJson(STORAGE_KEYS.user, user);
  writeJson(STORAGE_KEYS.repo, { owner: user.login, repo: DEFAULT_REPO });

  try {
    await githubFetch(`/repos/${user.login}/${DEFAULT_REPO}`);
  } catch (error) {
    throw new Error(
      `保存先 ${user.login}/${DEFAULT_REPO} にアクセスできません。fine-grained token の対象 repo と権限を確認してください。`,
    );
  }

  renderAppShell(app, user);

  const localPayload = readJson(STORAGE_KEYS.map, defaultMap());
  const remotePayload = await readRemoteMap(user.login, DEFAULT_REPO);
  const initialPayload = remotePayload?.content || localPayload;
  writeJson(STORAGE_KEYS.map, initialPayload);

  const mindMap = new MindMap({
    el: document.getElementById('mindMapMount'),
    data: initialPayload.root,
    layout: initialPayload.layout || 'logicalStructure',
    fit: true,
    enableAutoEnterTextEditWhenKeydown: true,
    nodeTextEditZIndex: 20,
  });

  let currentSha = remotePayload?.sha || null;
  let syncTimer = null;

  const snapshot = () => {
    const full = mindMap.getData();
    const payload = {
      root: full.root || full,
      layout: full.layout || 'logicalStructure',
      updatedAt: new Date().toISOString(),
    };
    writeJson(STORAGE_KEYS.map, payload);
    return payload;
  };

  const syncNow = async () => {
    const payload = snapshot();
    setStatus('同期中…', 'busy');
    const result = await writeRemoteMap(user.login, DEFAULT_REPO, payload, currentSha);
    currentSha = result.content?.sha || currentSha;
    setStatus('GitHub に保存済み', 'ok');
  };

  const queueSync = () => {
    snapshot();
    setStatus('ローカル保存済み', 'muted');
    window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(async () => {
      try {
        await syncNow();
      } catch (error) {
        setStatus(`同期失敗: ${error.message}`, 'error');
      }
    }, 1200);
  };

  mindMap.on('data_change', queueSync);

  document.getElementById('addChildBtn').addEventListener('click', () => {
    mindMap.execCommand('INSERT_CHILD_NODE');
  });

  document.getElementById('addSiblingBtn').addEventListener('click', () => {
    mindMap.execCommand('INSERT_NODE');
  });

  document.getElementById('deleteBtn').addEventListener('click', () => {
    mindMap.execCommand('REMOVE_NODE');
  });

  document.getElementById('fitBtn').addEventListener('click', () => {
    mindMap.view.fit();
  });

  document.getElementById('syncBtn').addEventListener('click', async () => {
    try {
      await syncNow();
    } catch (error) {
      setStatus(`同期失敗: ${error.message}`, 'error');
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    clearSession();
    location.reload();
  });
}

const app = document.getElementById('app');
if (getToken()) {
  boot(app).catch((error) => {
    renderTokenScreen(app);
    const errorEl = document.getElementById('tokenError');
    if (errorEl) {
      errorEl.textContent = error.message;
    }
  });
} else {
  renderTokenScreen(app);
}
