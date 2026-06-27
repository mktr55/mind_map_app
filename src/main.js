import MindMap from 'simple-mind-map';
import './style.css';

const STORAGE_KEYS = {
  token: 'mindflow.githubToken',
  user: 'mindflow.githubUser',
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
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
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

async function githubFetch(path, { method = 'GET', body } = {}) {
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
    throw new Error(error.message || `${response.status} ${response.statusText}`);
  }

  return response.json();
}

function encodeContent(value) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(value, null, 2))));
}

function decodeContent(value) {
  return JSON.parse(decodeURIComponent(escape(atob(value))));
}

async function fetchViewer() {
  return githubFetch('/user');
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

function setStatus(text, tone = 'muted') {
  const status = document.getElementById('statusPill');
  if (status) {
    status.textContent = text;
    status.dataset.tone = tone;
  }
  writeJson(STORAGE_KEYS.status, { text, tone });
}

function restoreStatus() {
  const saved = readJson(STORAGE_KEYS.status, { text: '未同期', tone: 'muted' });
  setStatus(saved.text, saved.tone);
}

function renderTokenScreen(app, errorMessage = '') {
  app.innerHTML = `
    <main class="shell auth-shell">
      <section class="auth-card">
        <p class="eyebrow">Private Mobile Mind Map</p>
        <h1>MindFlow</h1>
        <p class="lede">
          GitHub の private repo に直接保存する、個人用マインドマップです。
        </p>
        <label class="field">
          <span>GitHub Token</span>
          <input id="tokenInput" type="password" placeholder="貼り付けてください" autocomplete="off" />
        </label>
        <p class="hint">
          対象 repo は <code>mktr55/mindflow-data</code>。
          権限は <code>Contents: Read and write</code> と <code>Metadata: Read</code>。
        </p>
        <button id="tokenSubmit" class="primary-btn">接続する</button>
        <p id="tokenError" class="error-text">${errorMessage}</p>
      </section>
    </main>
  `;

  document.getElementById('tokenSubmit').addEventListener('click', () => {
    const input = document.getElementById('tokenInput');
    setToken(input.value);
    boot(app).catch((error) => {
      clearSession();
      renderTokenScreen(app, error.message);
    });
  });
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
        <p class="inline-hint">まず丸いノードを1回タップしてから操作できます。起動直後は中央ノードを自動選択します。</p>
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

function selectRootNode(mindMap) {
  const root = mindMap?.renderer?.root;
  if (root && typeof root.active === 'function') {
    root.active();
  }
}

function getSelectedNode(mindMap) {
  return mindMap?.renderer?.activeNodeList?.[0] || null;
}

async function boot(app) {
  const user = await fetchViewer();

  try {
    await githubFetch(`/repos/${user.login}/${DEFAULT_REPO}`);
  } catch {
    throw new Error(
      `保存先 ${user.login}/${DEFAULT_REPO} にアクセスできません。token の対象 repo と権限を確認してください。`,
    );
  }

  writeJson(STORAGE_KEYS.user, user);
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

  requestAnimationFrame(() => {
    selectRootNode(mindMap);
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
  mindMap.on('draw_click', () => {
    window.setTimeout(() => {
      if (!getSelectedNode(mindMap)) {
        selectRootNode(mindMap);
      }
    }, 0);
  });

  document.getElementById('addChildBtn').addEventListener('click', () => {
    if (!getSelectedNode(mindMap)) {
      selectRootNode(mindMap);
    }
    mindMap.execCommand('INSERT_CHILD_NODE');
  });

  document.getElementById('addSiblingBtn').addEventListener('click', () => {
    if (!getSelectedNode(mindMap)) {
      selectRootNode(mindMap);
    }
    mindMap.execCommand('INSERT_NODE');
  });

  document.getElementById('deleteBtn').addEventListener('click', () => {
    if (!getSelectedNode(mindMap)) {
      selectRootNode(mindMap);
      return;
    }
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
    clearSession();
    renderTokenScreen(app, error.message);
  });
} else {
  renderTokenScreen(app);
}
