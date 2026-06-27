import MindMap from 'simple-mind-map';
import TouchEvent from 'simple-mind-map/src/plugins/TouchEvent.js';
import './style.css';

MindMap.usePlugin(TouchEvent);

const STORAGE_KEYS = {
  token: 'mindflow.githubToken',
  user: 'mindflow.githubUser',
  workspace: 'mindflow.workspace',
  status: 'mindflow.status',
};

const API_BASE = 'https://api.github.com';
const DEFAULT_REPO = 'mindflow-data';
const DEFAULT_PATH = 'mindflow/workspace.json';

function createNode(text, ts, prefix) {
  return {
    data: {
      text,
      expand: true,
      uid: `${prefix}-${ts}-${Math.random().toString(36).slice(2, 8)}`,
    },
    children: [],
  };
}

function createBlankMap(title = '新しいマインドマップ') {
  const ts = Date.now();
  return {
    id: `map-${ts}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    updatedAt: new Date().toISOString(),
    root: {
      data: {
        text: title,
        expand: true,
        uid: `root-${ts}`,
      },
      children: [
        createNode('アイデア', ts, 'idea'),
        createNode('調べる', ts, 'research'),
        createNode('次の一歩', ts, 'next'),
      ],
    },
    layout: 'logicalStructure',
  };
}

function createDefaultWorkspace() {
  const firstMap = createBlankMap('MindFlow');
  return {
    currentMapId: firstMap.id,
    maps: [firstMap],
    updatedAt: new Date().toISOString(),
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

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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

function setStatus(text, tone = 'muted') {
  const statusEl = document.getElementById('statusPill');
  if (statusEl) {
    statusEl.textContent = text;
    statusEl.dataset.tone = tone;
  }
  writeJson(STORAGE_KEYS.status, { text, tone });
}

function restoreStatus() {
  const saved = readJson(STORAGE_KEYS.status, { text: '未同期', tone: 'muted' });
  setStatus(saved.text, saved.tone);
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

function normalizeWorkspace(input) {
  if (!input || typeof input !== 'object') {
    return createDefaultWorkspace();
  }

  if (Array.isArray(input.maps) && input.maps.length > 0) {
    const maps = input.maps
      .map((map, index) => ({
        id: map.id || `map-${Date.now()}-${index}`,
        title: map.title || map.root?.data?.text || `マインドマップ ${index + 1}`,
        updatedAt: map.updatedAt || new Date().toISOString(),
        root: map.root,
        layout: map.layout || 'logicalStructure',
      }))
      .filter((map) => map.root);

    if (maps.length === 0) {
      return createDefaultWorkspace();
    }

    return {
      currentMapId: maps.some((map) => map.id === input.currentMapId) ? input.currentMapId : maps[0].id,
      maps,
      updatedAt: input.updatedAt || new Date().toISOString(),
    };
  }

  if (input.root) {
    const map = {
      id: input.id || `legacy-${Date.now()}`,
      title: input.title || input.root?.data?.text || 'MindFlow',
      updatedAt: input.updatedAt || new Date().toISOString(),
      root: input.root,
      layout: input.layout || 'logicalStructure',
    };
    return {
      currentMapId: map.id,
      maps: [map],
      updatedAt: map.updatedAt,
    };
  }

  return createDefaultWorkspace();
}

async function fetchViewer() {
  return githubFetch('/user');
}

async function ensurePrivateRepo(owner) {
  try {
    return await githubFetch(`/repos/${owner}/${DEFAULT_REPO}`);
  } catch (error) {
    if (!String(error.message).includes('Not Found')) {
      throw error;
    }
  }

  return githubFetch('/user/repos', {
    method: 'POST',
    body: {
      name: DEFAULT_REPO,
      private: true,
      auto_init: true,
      description: 'MindFlow mobile sync data',
    },
  });
}

async function readRemoteWorkspace(owner) {
  try {
    const file = await githubFetch(`/repos/${owner}/${DEFAULT_REPO}/contents/${DEFAULT_PATH}`);
    return {
      sha: file.sha,
      content: normalizeWorkspace(decodeContent(file.content.replace(/\n/g, ''))),
    };
  } catch (error) {
    if (String(error.message).includes('Not Found')) {
      return null;
    }
    throw error;
  }
}

async function writeRemoteWorkspace(owner, workspace, sha) {
  return githubFetch(`/repos/${owner}/${DEFAULT_REPO}/contents/${DEFAULT_PATH}`, {
    method: 'PUT',
    body: {
      message: 'MindFlow workspace sync',
      content: encodeContent(workspace),
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
          GitHub token を入れた自分の端末だけで、複数のマインドマップを保存して使えます。
        </p>
        <label class="field">
          <span>GitHub Token</span>
          <input id="tokenInput" type="password" placeholder="github_pat_..." autocomplete="off" />
        </label>
        <p class="hint">
          classic token なら <code>repo</code>。fine-grained token なら private repo の
          <code>Contents: Read and write</code> と <code>Metadata: Read</code> が必要です。
        </p>
        <button id="tokenSubmit" class="primary-btn wide-btn">接続する</button>
        <p id="tokenError" class="error-text"></p>
      </section>
    </main>
  `;

  const input = document.getElementById('tokenInput');
  const errorEl = document.getElementById('tokenError');
  document.getElementById('tokenSubmit').addEventListener('click', async () => {
    errorEl.textContent = '';
    setToken(input.value);
    try {
      await boot(app);
    } catch (error) {
      clearSession();
      errorEl.textContent = error.message;
    }
  });
}

function renderAppShell(app, user) {
  app.innerHTML = `
    <main class="shell">
      <header class="topbar">
        <button id="toggleSidebarBtn" class="mobile-nav-btn" type="button">‹</button>
        <div class="topbar-brand">
          <p class="eyebrow">Signed in as @${user.login}</p>
          <h1>MindFlow</h1>
        </div>
        <div class="topbar-actions">
          <span class="repo-label">${user.login}/${DEFAULT_REPO}</span>
          <button id="syncBtn" class="primary-btn small-btn">同期</button>
          <button id="logoutBtn" class="ghost-btn">ログアウト</button>
        </div>
      </header>
      <section class="workspace">
        <aside class="sidebar panel" id="sidebarPanel">
          <div class="sidebar-head">
            <div>
              <p class="section-label">Maps</p>
              <h2>保存済み一覧</h2>
            </div>
            <div class="sidebar-actions">
              <button id="importMapBtn" class="small-btn">インポート</button>
              <button id="newMapBtn" class="primary-btn small-btn">新規</button>
            </div>
          </div>
          <div id="mapList" class="map-list"></div>
          <input id="importMapInput" type="file" accept=".opml,.xml,.mm,.json" hidden />
        </aside>
      <section class="editor panel">
        <div class="toolbar">
          <button id="renameMapBtn">名前</button>
          <button id="addChildBtn">子</button>
          <button id="addSiblingBtn">兄弟</button>
          <button id="deleteNodeBtn">削除</button>
          <button id="fitBtn">全体</button>
        </div>
        <div class="node-editor-strip">
          <label for="nodeTextInput">選択ノード</label>
          <input id="nodeTextInput" type="text" placeholder="ノードを選択" autocomplete="off" disabled />
        </div>
        <p class="inline-hint">ノードを選んで入力欄を書き換えるか、ノードをダブルタップして直接編集できます。</p>
        <div class="meta-row">
          <span id="statusPill" class="status-pill" data-tone="muted">未同期</span>
          <button id="deleteMapBtn" class="danger-btn small-btn">このマップを削除</button>
        </div>
          <div id="mindMapMount" class="mindmap-frame"></div>
        </section>
      </section>
      <button id="sidebarBackdrop" class="sidebar-backdrop" type="button" aria-label="閉じる"></button>
    </main>
  `;

  restoreStatus();
}

function formatUpdatedAt(value) {
  if (!value) {
    return '';
  }

  try {
    return new Date(value).toLocaleString('ja-JP', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function renderMapList(workspace) {
  const listEl = document.getElementById('mapList');
  listEl.innerHTML = workspace.maps
    .slice()
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .map((map) => `
        <button class="map-card ${map.id === workspace.currentMapId ? 'active' : ''}" data-map-id="${map.id}">
          <span class="map-card-title">${escapeHtml(map.title)}</span>
          <span class="map-card-time">${formatUpdatedAt(map.updatedAt)}</span>
        </button>
      `)
    .join('');
}

function getCurrentMap(workspace) {
  return workspace.maps.find((map) => map.id === workspace.currentMapId) || workspace.maps[0];
}

function selectRootNode(mindMap) {
  const root = mindMap?.renderer?.root;
  if (root && typeof root.active === 'function') {
    root.active();
  }
}

function buildMindMapData(map) {
  return {
    root: map.root,
    layout: map.layout || 'logicalStructure',
  };
}

function readMindMapSnapshot(mindMap, fallbackLayout) {
  const full = mindMap.getData();
  if (full?.root) {
    return {
      root: full.root,
      layout: full.layout || fallbackLayout || 'logicalStructure',
    };
  }

  return {
    root: full,
    layout: fallbackLayout || 'logicalStructure',
  };
}

function createNodeData(text, prefix = 'node') {
  const ts = Date.now();
  return {
    text: text?.trim() || '無題',
    expand: true,
    uid: `${prefix}-${ts}-${Math.random().toString(36).slice(2, 8)}`,
  };
}

function createImportedNode(text, children = [], prefix = 'import') {
  return {
    data: createNodeData(text, prefix),
    children,
  };
}

function parseXmlDocument(text) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/xml');
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error('XML を読み取れませんでした');
  }
  return doc;
}

function convertOpmlOutline(outlineEl) {
  const children = Array.from(outlineEl.children)
    .filter((child) => child.tagName.toLowerCase() === 'outline')
    .map((child) => convertOpmlOutline(child));
  return createImportedNode(outlineEl.getAttribute('text') || '無題', children, 'opml');
}

function parseOpmlMap(text, fallbackTitle) {
  const doc = parseXmlDocument(text);
  if (doc.documentElement.tagName.toLowerCase() !== 'opml') {
    throw new Error('OPML 形式ではありません');
  }

  const body = doc.querySelector('body');
  const outlines = body
    ? Array.from(body.children).filter((child) => child.tagName.toLowerCase() === 'outline')
    : [];
  if (outlines.length === 0) {
    throw new Error('OPML にノードがありません');
  }

  if (outlines.length === 1) {
    const root = convertOpmlOutline(outlines[0]);
    return {
      id: `map-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: root.data.text || fallbackTitle || 'MindMeister import',
      updatedAt: new Date().toISOString(),
      root,
      layout: 'logicalStructure',
    };
  }

  const title =
    doc.querySelector('head > title')?.textContent?.trim() ||
    fallbackTitle ||
    'MindMeister import';

  return {
    id: `map-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    updatedAt: new Date().toISOString(),
    root: createImportedNode(title, outlines.map((outline) => convertOpmlOutline(outline)), 'opml-root'),
    layout: 'logicalStructure',
  };
}

function readFreeMindNodeLabel(nodeEl) {
  const richContent = Array.from(nodeEl.children).find(
    (child) => child.tagName?.toLowerCase() === 'richcontent' && child.getAttribute('TYPE') === 'NODE',
  );
  return (
    nodeEl.getAttribute('TEXT') ||
    nodeEl.getAttribute('text') ||
    richContent?.textContent?.trim() ||
    '無題'
  );
}

function convertFreeMindNode(nodeEl) {
  const children = Array.from(nodeEl.children)
    .filter((child) => child.tagName.toLowerCase() === 'node')
    .map((child) => convertFreeMindNode(child));
  return createImportedNode(readFreeMindNodeLabel(nodeEl), children, 'mm');
}

function parseFreeMindMap(text, fallbackTitle) {
  const doc = parseXmlDocument(text);
  if (doc.documentElement.tagName.toLowerCase() !== 'map') {
    throw new Error('FreeMind 形式ではありません');
  }

  const rootEl = doc.querySelector('map > node');
  if (!rootEl) {
    throw new Error('マップのルートノードがありません');
  }

  const root = convertFreeMindNode(rootEl);
  return {
    id: `map-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: root.data.text || fallbackTitle || 'FreeMind import',
    updatedAt: new Date().toISOString(),
    root,
    layout: 'logicalStructure',
  };
}

function parseWorkspaceImport(text) {
  const parsed = normalizeWorkspace(JSON.parse(text));
  return parsed.maps.map((map, index) => ({
    ...map,
    id: `map-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    updatedAt: new Date(Date.now() - index).toISOString(),
  }));
}

function parseImportedMaps(fileName, text) {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith('.json')) {
    return parseWorkspaceImport(text);
  }

  if (lowerName.endsWith('.mm')) {
    return [parseFreeMindMap(text, fileName.replace(/\.[^.]+$/, ''))];
  }

  if (lowerName.endsWith('.opml')) {
    return [parseOpmlMap(text, fileName.replace(/\.[^.]+$/, ''))];
  }

  const xmlDoc = parseXmlDocument(text);
  const rootTag = xmlDoc.documentElement.tagName.toLowerCase();
  if (rootTag === 'opml') {
    return [parseOpmlMap(text, fileName.replace(/\.[^.]+$/, ''))];
  }
  if (rootTag === 'map') {
    return [parseFreeMindMap(text, fileName.replace(/\.[^.]+$/, ''))];
  }

  throw new Error('対応形式は OPML / FreeMind(.mm) / MindFlow JSON です');
}

async function boot(app) {
  const user = await fetchViewer();
  writeJson(STORAGE_KEYS.user, user);
  await ensurePrivateRepo(user.login);

  renderAppShell(app, user);

  const localWorkspace = normalizeWorkspace(readJson(STORAGE_KEYS.workspace, createDefaultWorkspace()));
  const remoteWorkspace = await readRemoteWorkspace(user.login);
  const workspace = remoteWorkspace?.content || localWorkspace;

  writeJson(STORAGE_KEYS.workspace, workspace);

  let currentSha = remoteWorkspace?.sha || null;
  let syncTimer = null;
  let suppressSave = false;
  let selectedNode = null;
  let isUpdatingNodeInput = false;
  let pendingRenderEndHandler = null;

  const mindMap = new MindMap({
    el: document.getElementById('mindMapMount'),
    data: buildMindMapData(getCurrentMap(workspace)),
    fit: true,
    enableAutoEnterTextEditWhenKeydown: true,
    disableTouchZoom: false,
    minTouchZoomScale: 10,
    maxTouchZoomScale: 300,
    openRealtimeRenderOnNodeTextEdit: true,
    defaultInsertSecondLevelNodeText: '新しいトピック',
    defaultInsertBelowSecondLevelNodeText: '新しいトピック',
    nodeTextEditZIndex: 20,
  });

  const nodeTextInput = document.getElementById('nodeTextInput');
  const importMapBtn = document.getElementById('importMapBtn');
  const importMapInput = document.getElementById('importMapInput');
  const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
  const sidebarPanel = document.getElementById('sidebarPanel');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');

  const isTextEditing = () => Boolean(mindMap.renderer?.textEdit?.isShowTextEdit?.());

  const updateNodeInput = (node = selectedNode) => {
    if (!nodeTextInput) {
      return;
    }

    selectedNode = node || null;
    isUpdatingNodeInput = true;
    nodeTextInput.disabled = !selectedNode;
    nodeTextInput.value = selectedNode?.getData?.('text') || '';
    nodeTextInput.placeholder = selectedNode ? '文字を入力' : 'ノードを選択';
    isUpdatingNodeInput = false;
  };

  const persistWorkspace = () => {
    workspace.updatedAt = new Date().toISOString();
    writeJson(STORAGE_KEYS.workspace, workspace);
  };

  const closeSidebar = () => {
    sidebarPanel?.classList.remove('open');
    sidebarBackdrop?.classList.remove('visible');
  };

  const toggleSidebar = () => {
    sidebarPanel?.classList.toggle('open');
    sidebarBackdrop?.classList.toggle('visible', sidebarPanel?.classList.contains('open'));
  };

  const importMapsIntoWorkspace = (maps) => {
    if (!Array.isArray(maps) || maps.length === 0) {
      throw new Error('インポートできるマップがありません');
    }

    saveCurrentMapFromCanvas();
    workspace.maps.unshift(...maps);
    persistWorkspace();
    renderMapList(workspace);
    loadMapIntoCanvas(maps[0].id);
    closeSidebar();
    queueSync();
    setStatus(`${maps.length}件をインポートしました`, 'ok');
  };

  const importMapFile = async (file) => {
    if (!file) {
      return;
    }

    try {
      const importedMaps = parseImportedMaps(file.name, await file.text());
      importMapsIntoWorkspace(importedMaps);
    } catch (error) {
      setStatus(`インポート失敗: ${error.message}`, 'error');
      window.alert(`インポートできませんでした。\n${error.message}`);
    } finally {
      if (importMapInput) {
        importMapInput.value = '';
      }
    }
  };

  const saveCurrentMapFromCanvas = ({ renderList = true } = {}) => {
    if (suppressSave) {
      return;
    }

    const current = getCurrentMap(workspace);
    if (!current) {
      return;
    }

    const snapshot = readMindMapSnapshot(mindMap, current.layout);
    current.root = snapshot.root;
    current.layout = snapshot.layout;
    current.title = current.root?.data?.text?.trim() || current.title || '無題';
    current.updatedAt = new Date().toISOString();
    persistWorkspace();
    if (renderList) {
      renderMapList(workspace);
    }
  };

  const syncNow = async () => {
    mindMap.renderer?.textEdit?.hideEditTextBox?.();
    saveCurrentMapFromCanvas();
    setStatus('同期中…', 'busy');
    const result = await writeRemoteWorkspace(user.login, workspace, currentSha);
    currentSha = result.content?.sha || currentSha;
    setStatus('GitHub に保存済み', 'ok');
  };

  const queueSync = () => {
    saveCurrentMapFromCanvas({ renderList: !isTextEditing() });
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

  const focusLoadedMap = () => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        mindMap.view.fit();
        selectRootNode(mindMap);
        updateNodeInput(mindMap.renderer?.root);
      });
    });
  };

  const loadMapIntoCanvas = (mapId) => {
    const nextMap = workspace.maps.find((map) => map.id === mapId);
    if (!nextMap) {
      return;
    }

    mindMap.renderer?.textEdit?.hideEditTextBox?.();
    saveCurrentMapFromCanvas();
    workspace.currentMapId = nextMap.id;
    persistWorkspace();
    renderMapList(workspace);
    closeSidebar();

    if (pendingRenderEndHandler) {
      mindMap.off('node_tree_render_end', pendingRenderEndHandler);
    }

    const handleRenderEnd = () => {
      mindMap.off('node_tree_render_end', handleRenderEnd);
      pendingRenderEndHandler = null;
      focusLoadedMap();
    };

    pendingRenderEndHandler = handleRenderEnd;
    mindMap.on('node_tree_render_end', handleRenderEnd);
    suppressSave = true;
    mindMap.setFullData(buildMindMapData(nextMap));
    suppressSave = false;
  };

  renderMapList(workspace);
  focusLoadedMap();

  mindMap.on('data_change', queueSync);
  mindMap.on('node_active', (node, activeNodeList = []) => {
    updateNodeInput(node || activeNodeList[0] || null);
  });
  mindMap.on('node_text_edit_change', ({ node, text }) => {
    if (node === selectedNode && nodeTextInput && document.activeElement !== nodeTextInput) {
      isUpdatingNodeInput = true;
      nodeTextInput.value = text || '';
      isUpdatingNodeInput = false;
    }
  });

  nodeTextInput?.addEventListener('input', () => {
    if (!selectedNode || isUpdatingNodeInput) {
      return;
    }

    selectedNode.setText(nodeTextInput.value);
  });

  nodeTextInput?.addEventListener('focus', () => {
    mindMap.renderer?.textEdit?.hideEditTextBox?.();
  });

  toggleSidebarBtn?.addEventListener('click', toggleSidebar);
  sidebarBackdrop?.addEventListener('click', closeSidebar);

  importMapBtn?.addEventListener('click', () => {
    importMapInput?.click();
  });

  importMapInput?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    await importMapFile(file);
  });

  document.getElementById('mapList').addEventListener('click', (event) => {
    const button = event.target.closest('[data-map-id]');
    if (button) {
      loadMapIntoCanvas(button.dataset.mapId);
    }
  });

  document.getElementById('newMapBtn').addEventListener('click', () => {
    const name = window.prompt('新しいマインドマップ名', `マインドマップ ${workspace.maps.length + 1}`);
    if (!name) {
      return;
    }

    saveCurrentMapFromCanvas();
    const map = createBlankMap(name.trim() || `マインドマップ ${workspace.maps.length + 1}`);
    workspace.maps.unshift(map);
    persistWorkspace();
    renderMapList(workspace);
    loadMapIntoCanvas(map.id);
    queueSync();
  });

  document.getElementById('renameMapBtn').addEventListener('click', () => {
    const current = getCurrentMap(workspace);
    const name = window.prompt('マップ名を変更', current.title);
    if (!name) {
      return;
    }

    current.title = name.trim() || current.title;
    current.root.data.text = current.title;
    current.updatedAt = new Date().toISOString();
    persistWorkspace();
    renderMapList(workspace);

    suppressSave = true;
    mindMap.setFullData(buildMindMapData(current));
    suppressSave = false;
    queueSync();
  });

  document.getElementById('deleteMapBtn').addEventListener('click', () => {
    if (workspace.maps.length === 1) {
      window.alert('最後の1枚は削除できません。');
      return;
    }

    const current = getCurrentMap(workspace);
    if (!window.confirm(`「${current.title}」を削除しますか？`)) {
      return;
    }

    workspace.maps = workspace.maps.filter((map) => map.id !== current.id);
    workspace.currentMapId = workspace.maps[0].id;
    persistWorkspace();
    renderMapList(workspace);
    loadMapIntoCanvas(workspace.currentMapId);
    queueSync();
  });

  document.getElementById('addChildBtn').addEventListener('click', () => {
    mindMap.execCommand('INSERT_CHILD_NODE');
  });

  document.getElementById('addSiblingBtn').addEventListener('click', () => {
    mindMap.execCommand('INSERT_NODE');
  });

  document.getElementById('deleteNodeBtn').addEventListener('click', () => {
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
