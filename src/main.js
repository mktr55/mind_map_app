import MindMap from 'simple-mind-map';
import TouchEvent from 'simple-mind-map/src/plugins/TouchEvent.js';
import './style.css';

MindMap.usePlugin(TouchEvent);

const STORAGE_KEYS = {
  token: 'mindflow.githubToken',
  user: 'mindflow.githubUser',
  workspace: 'mindflow.workspace',
  sidebarCollapsed: 'mindflow.sidebarCollapsed',
  headerCollapsed: 'mindflow.headerCollapsed',
  toolbarCollapsed: 'mindflow.toolbarCollapsed',
  statusCollapsed: 'mindflow.statusCollapsed',
};

const API_BASE = 'https://api.github.com';
const DEFAULT_REPO = 'mindflow-data';
const DEFAULT_PATH = 'mindflow/workspace.json';
const SYNC_DEBOUNCE_MS = 1200;

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createNode(text, prefix = 'node') {
  return {
    data: { text, expand: true, uid: uid(prefix) },
    children: [],
  };
}

function createBlankMap(title = '新しいマインドマップ') {
  return {
    id: uid('map'),
    title,
    updatedAt: new Date().toISOString(),
    layout: 'logicalStructure',
    root: {
      data: { text: title, expand: true, uid: uid('root') },
      children: [
        createNode('アイデア', 'idea'),
        createNode('調べる', 'research'),
        createNode('次の一歩', 'next'),
      ],
    },
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

function getToken() {
  return localStorage.getItem(STORAGE_KEYS.token);
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.token);
  localStorage.removeItem(STORAGE_KEYS.user);
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function encodeContent(value) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(value, null, 2))));
}

function decodeContent(value) {
  return JSON.parse(decodeURIComponent(escape(atob(value))));
}

function normalizeNode(node, fallbackText = '無題') {
  if (!node || typeof node !== 'object') return createNode(fallbackText);
  const data = node.data && typeof node.data === 'object' ? node.data : {};
  const text = data.text || node.text || fallbackText;
  return {
    data: {
      ...data,
      text,
      expand: data.expand !== false,
      uid: data.uid || uid('import-node'),
    },
    children: Array.isArray(node.children)
      ? node.children.map((child, index) => normalizeNode(child, `トピック ${index + 1}`))
      : [],
  };
}

function normalizeWorkspace(input) {
  if (!input || typeof input !== 'object') return createDefaultWorkspace();

  if (Array.isArray(input.maps)) {
    const maps = input.maps
      .map((map, index) => {
        const title = map.title || map.root?.data?.text || `マインドマップ ${index + 1}`;
        return {
          id: map.id || uid('map'),
          title,
          updatedAt: map.updatedAt || new Date().toISOString(),
          layout: map.layout || 'logicalStructure',
          root: normalizeNode(map.root, title),
        };
      })
      .filter((map) => map.root);

    if (maps.length === 0) return createDefaultWorkspace();

    return {
      currentMapId: maps.some((map) => map.id === input.currentMapId)
        ? input.currentMapId
        : maps[0].id,
      maps,
      updatedAt: input.updatedAt || new Date().toISOString(),
    };
  }

  if (input.root) {
    const title = input.title || input.root?.data?.text || 'MindFlow';
    const map = {
      id: input.id || uid('legacy-map'),
      title,
      updatedAt: input.updatedAt || new Date().toISOString(),
      layout: input.layout || 'logicalStructure',
      root: normalizeNode(input.root, title),
    };
    return { currentMapId: map.id, maps: [map], updatedAt: map.updatedAt };
  }

  return createDefaultWorkspace();
}

function getCurrentMap(workspace) {
  return workspace.maps.find((map) => map.id === workspace.currentMapId) || workspace.maps[0];
}

function buildMindMapData(map) {
  return {
    root: map.root,
    layout: map.layout || 'logicalStructure',
    theme: {
      template: 'default',
      config: {
        backgroundColor: '#40464f',
        lineColor: '#8597a7',
        lineWidth: 2,
        root: {
          fillColor: '#1c8bff',
          color: '#ffffff',
          borderColor: 'transparent',
          borderWidth: 0,
          fontSize: 18,
          fontWeight: 'bold',
          borderRadius: 10,
          paddingX: 24,
          paddingY: 14,
        },
        second: {
          fillColor: '#ffffff',
          color: '#1d2630',
          borderColor: '#dbe4ed',
          borderWidth: 1,
          fontSize: 15,
          borderRadius: 8,
          paddingX: 18,
          paddingY: 10,
          marginX: 64,
          marginY: 18,
        },
        node: {
          fillColor: '#f6f8fb',
          color: '#33414f',
          borderColor: '#d6dfe8',
          borderWidth: 1,
          fontSize: 14,
          borderRadius: 7,
          paddingX: 14,
          paddingY: 8,
          marginX: 42,
          marginY: 10,
        },
      },
    },
  };
}

async function githubFetch(path, options = {}) {
  const token = getToken();
  if (!token) throw new Error('GitHub Token が未設定です');

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || `GitHub API error: ${response.status}`);
  }

  return response.status === 204 ? null : response.json();
}

async function fetchViewer() {
  return githubFetch('/user');
}

async function ensurePrivateRepo(owner) {
  try {
    return await githubFetch(`/repos/${owner}/${DEFAULT_REPO}`);
  } catch (error) {
    if (!String(error.message).includes('Not Found')) throw error;
  }

  return githubFetch('/user/repos', {
    method: 'POST',
    body: {
      name: DEFAULT_REPO,
      private: true,
      auto_init: true,
      description: 'MindFlow sync data',
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
    if (String(error.message).includes('Not Found')) return null;
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
    <main class="login-shell">
      <section class="login-panel">
        <p class="eyebrow">Private GitHub Sync</p>
        <h1>MindFlow</h1>
        <p class="lede">GitHub Personal Access Token を入れると、マップを private repo に保存します。</p>
        <form id="tokenForm" class="token-form">
          <label class="field" for="tokenInput">
            <span>GitHub Token</span>
            <input id="tokenInput" type="password" autocomplete="off" placeholder="ghp_..." required />
          </label>
          <button class="primary-btn" type="submit">MindFlow を開く</button>
        </form>
        <p id="tokenError" class="error-text" role="alert"></p>
      </section>
    </main>
  `;

  document.getElementById('tokenForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const tokenInput = document.getElementById('tokenInput');
    const errorEl = document.getElementById('tokenError');
    const token = tokenInput.value.trim();
    if (!token) return;

    localStorage.setItem(STORAGE_KEYS.token, token);
    errorEl.textContent = '';
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
    <main class="app-shell">
      <div id="mindMapMount" class="mindmap-canvas"></div>
      <button id="rootQuickAddBtn" class="root-quick-add" type="button" aria-label="ルートノードに子ノードを追加">
        <strong>+</strong><span>子ノード</span>
      </button>

      <header id="topbarPanel" class="topbar-panel">
        <div class="topbar-grip"></div>
        <div class="topbar-brand">
          <p class="eyebrow">Signed in as @${escapeHtml(user.login)}</p>
          <h1 id="mapTitleHeading">MindFlow</h1>
          <p class="repo-label">${escapeHtml(user.login)}/${DEFAULT_REPO}</p>
        </div>
        <div class="topbar-actions">
          <button id="syncBtn" class="small-btn" type="button">同期</button>
          <button id="logoutBtn" class="small-btn ghost-btn" type="button">ログアウト</button>
          <button id="collapseTopbarBtn" class="icon-btn" type="button" aria-label="上部を折り畳む">⌃</button>
        </div>
      </header>

      <button id="expandTopbarBtn" class="panel-handle panel-handle-top" type="button" aria-label="上部を開く">
        <span>MindFlow</span><strong>⌄</strong>
      </button>

      <aside id="sidebarPanel" class="sidebar-panel">
        <div class="sidebar-head">
          <div>
            <p class="section-label">Maps</p>
            <h2>保存済み一覧</h2>
          </div>
          <button id="collapseSidebarBtn" class="icon-btn" type="button" aria-label="左パネルを折り畳む">〈</button>
        </div>
        <div class="sidebar-actions">
          <button id="importMapBtn" class="small-btn" type="button">インポート</button>
          <button id="newMapBtn" class="primary-btn small-btn" type="button">新規</button>
        </div>
        <div id="mapList" class="map-list"></div>
        <input id="importMapInput" type="file" accept=".opml,.xml,.mm,.json" hidden />
      </aside>

      <button id="expandSidebarBtn" class="panel-handle panel-handle-left" type="button" aria-label="左パネルを開く">
        <strong>〉</strong><span>Maps</span>
      </button>

      <section class="floating-toolbar" aria-label="マインドマップ操作">
        <button id="renameMapBtn" class="tool-btn" type="button">名前</button>
        <button id="addChildBtn" class="tool-btn" type="button">子</button>
        <button id="addSiblingBtn" class="tool-btn" type="button">兄弟</button>
        <button id="deleteNodeBtn" class="tool-btn danger" type="button">削除</button>
        <button id="fitBtn" class="tool-btn" type="button">全体</button>
        <button id="collapseToolbarBtn" class="icon-btn toolbar-toggle-btn" type="button" aria-label="操作ツールを折り畳む">〉</button>
      </section>

      <button id="expandToolbarBtn" class="panel-handle panel-handle-toolbar" type="button" aria-label="操作ツールを開く">
        <span>Tools</span><strong>〈</strong>
      </button>

      <div class="floating-status">
        <span id="statusPill" class="status-pill" data-tone="muted">ローカル保存済み</span>
        <button id="deleteMapBtn" class="danger-btn small-btn" type="button">このマップを削除</button>
        <button id="collapseStatusBtn" class="icon-btn status-toggle-btn" type="button" aria-label="ステータスを折り畳む">〉</button>
      </div>

      <button id="expandStatusBtn" class="panel-handle panel-handle-status" type="button" aria-label="ステータスを開く">
        <span>Status</span><strong>〈</strong>
      </button>
    </main>
  `;
}

function renderMapList(workspace) {
  const currentMap = getCurrentMap(workspace);
  const list = document.getElementById('mapList');
  list.innerHTML = workspace.maps
    .map((map) => `
      <button class="map-card ${map.id === currentMap.id ? 'active' : ''}" type="button" data-map-id="${escapeHtml(map.id)}">
        <span class="map-card-title">${escapeHtml(map.title)}</span>
        <span class="map-card-time">${new Date(map.updatedAt || Date.now()).toLocaleString('ja-JP')}</span>
      </button>
    `)
    .join('');
}

function createImportedNode(text, children = [], prefix = 'import') {
  return {
    data: { text: text || '無題', expand: true, uid: uid(prefix) },
    children,
  };
}

function parseXmlDocument(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const error = doc.querySelector('parsererror');
  if (error) throw new Error('XML を読み込めませんでした');
  return doc;
}

function convertOpmlOutline(outline) {
  const text = outline.getAttribute('text') || outline.getAttribute('title') || '無題';
  const children = Array.from(outline.children)
    .filter((child) => child.tagName.toLowerCase() === 'outline')
    .map(convertOpmlOutline);
  return createImportedNode(text, children, 'opml');
}

function parseOpmlMap(text, fallbackTitle) {
  const doc = parseXmlDocument(text);
  if (doc.documentElement.tagName.toLowerCase() !== 'opml') throw new Error('OPML 形式ではありません');
  const outlines = Array.from(doc.querySelectorAll('body > outline'));
  if (outlines.length === 0) throw new Error('OPML にノードがありません');
  const title = doc.querySelector('head > title')?.textContent?.trim() || fallbackTitle || 'MindMeister import';
  const root = outlines.length === 1
    ? convertOpmlOutline(outlines[0])
    : createImportedNode(title, outlines.map(convertOpmlOutline), 'opml-root');
  return { id: uid('map'), title: root.data.text || title, updatedAt: new Date().toISOString(), root, layout: 'logicalStructure' };
}

function readFreeMindNodeLabel(nodeEl) {
  const rich = Array.from(nodeEl.children).find(
    (child) => child.tagName?.toLowerCase() === 'richcontent' && child.getAttribute('TYPE') === 'NODE',
  );
  return nodeEl.getAttribute('TEXT') || nodeEl.getAttribute('text') || rich?.textContent?.trim() || '無題';
}

function convertFreeMindNode(nodeEl) {
  const children = Array.from(nodeEl.children)
    .filter((child) => child.tagName.toLowerCase() === 'node')
    .map(convertFreeMindNode);
  return createImportedNode(readFreeMindNodeLabel(nodeEl), children, 'mm');
}

function parseFreeMindMap(text, fallbackTitle) {
  const doc = parseXmlDocument(text);
  if (doc.documentElement.tagName.toLowerCase() !== 'map') throw new Error('FreeMind 形式ではありません');
  const rootEl = doc.querySelector('map > node');
  if (!rootEl) throw new Error('FreeMind にルートノードがありません');
  const root = convertFreeMindNode(rootEl);
  return { id: uid('map'), title: root.data.text || fallbackTitle || 'FreeMind import', updatedAt: new Date().toISOString(), root, layout: 'logicalStructure' };
}

function parseImportedMaps(fileName, text) {
  const fallbackTitle = fileName.replace(/\.(opml|xml|mm|json)$/i, '') || 'Imported map';
  if (/\.json$/i.test(fileName)) {
    const normalized = normalizeWorkspace(JSON.parse(text));
    return normalized.maps.map((map) => ({ ...map, id: uid('import-map'), updatedAt: new Date().toISOString() }));
  }
  if (/\.mm$/i.test(fileName)) return [parseFreeMindMap(text, fallbackTitle)];
  return [parseOpmlMap(text, fallbackTitle)];
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
    nodeTextEditZIndex: 40,
  });

  const mapTitleHeading = document.getElementById('mapTitleHeading');
  const statusPill = document.getElementById('statusPill');
  const importMapInput = document.getElementById('importMapInput');
  const rootQuickAddBtn = document.getElementById('rootQuickAddBtn');

  const isTextEditing = () => Boolean(mindMap.renderer?.textEdit?.isShowTextEdit?.());

  function setStatus(message, tone = 'muted') {
    statusPill.textContent = message;
    statusPill.dataset.tone = tone;
  }

  function updateHeader() {
    const currentMap = getCurrentMap(workspace);
    mapTitleHeading.textContent = currentMap.title;
    document.title = `${currentMap.title} - MindFlow`;
  }

  function updateSelectedNode(node = selectedNode) {
    selectedNode = node || null;
  }

  function getRootNode() {
    return mindMap.renderer?.root || null;
  }

  function isRootNode(node = selectedNode) {
    const rootNode = getRootNode();
    return Boolean(node && rootNode && node.getData('uid') === rootNode.getData('uid'));
  }

  function startNodeTextEdit(node = selectedNode) {
    if (!node) return false;
    mindMap.renderer?.textEdit?.show?.({ node, isInserting: false });
    return true;
  }

  function updateRootQuickAddButton() {
    const rootNode = getRootNode();
    const rect = rootNode?.getRect?.();
    if (!rect) {
      rootQuickAddBtn.classList.remove('visible');
      return;
    }
    rootQuickAddBtn.style.left = `${rect.left + rect.width / 2}px`;
    rootQuickAddBtn.style.top = `${rect.bottom + 14}px`;
    rootQuickAddBtn.classList.add('visible');
  }

  function saveCurrentMapFromCanvas() {
    const currentMap = getCurrentMap(workspace);
    if (!currentMap || suppressSave) return;
    const data = mindMap.getData(true);
    currentMap.root = data.root || data;
    currentMap.layout = data.layout || currentMap.layout || 'logicalStructure';
    currentMap.title = currentMap.root?.data?.text || currentMap.title;
    currentMap.updatedAt = new Date().toISOString();
  }

  function persistWorkspace() {
    workspace.updatedAt = new Date().toISOString();
    writeJson(STORAGE_KEYS.workspace, workspace);
  }

  async function syncNow() {
    clearTimeout(syncTimer);
    saveCurrentMapFromCanvas();
    persistWorkspace();
    renderMapList(workspace);
    updateHeader();
    setStatus('同期中...', 'working');
    try {
      const result = await writeRemoteWorkspace(user.login, workspace, currentSha);
      currentSha = result.content.sha;
      setStatus('GitHubに保存済み', 'ok');
    } catch (error) {
      setStatus(`同期失敗: ${error.message}`, 'error');
    }
  }

  function queueSync() {
    if (suppressSave) return;
    saveCurrentMapFromCanvas();
    persistWorkspace();
    renderMapList(workspace);
    updateHeader();
    setStatus('ローカル保存済み', 'muted');
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncNow, SYNC_DEBOUNCE_MS);
  }

  function refitCanvas() {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        mindMap.resize();
        mindMap.view.fit();
        updateRootQuickAddButton();
      });
    });
  }

  function setLayoutState(kind, collapsed) {
    const keyByKind = {
      sidebar: STORAGE_KEYS.sidebarCollapsed,
      header: STORAGE_KEYS.headerCollapsed,
      toolbar: STORAGE_KEYS.toolbarCollapsed,
      status: STORAGE_KEYS.statusCollapsed,
    };
    const key = keyByKind[kind];
    document.body.classList.toggle(`${kind}-collapsed`, collapsed);
    localStorage.setItem(key, collapsed ? 'true' : 'false');
    refitCanvas();
  }

  function updateLayoutState() {
    setLayoutState('sidebar', localStorage.getItem(STORAGE_KEYS.sidebarCollapsed) === 'true');
    setLayoutState('header', localStorage.getItem(STORAGE_KEYS.headerCollapsed) === 'true');
    setLayoutState('toolbar', localStorage.getItem(STORAGE_KEYS.toolbarCollapsed) === 'true');
    setLayoutState('status', localStorage.getItem(STORAGE_KEYS.statusCollapsed) === 'true');
  }

  function loadMapIntoCanvas(mapId) {
    const nextMap = workspace.maps.find((map) => map.id === mapId);
    if (!nextMap) return;
    mindMap.renderer?.textEdit?.hideEditTextBox?.();
    saveCurrentMapFromCanvas();
    workspace.currentMapId = nextMap.id;
    persistWorkspace();
    renderMapList(workspace);
    updateHeader();
    suppressSave = true;
    mindMap.setFullData(buildMindMapData(nextMap));
    suppressSave = false;
    updateSelectedNode(null);
    refitCanvas();
  }

  async function importMapFile(file) {
    if (!file) return;
    try {
      const importedMaps = parseImportedMaps(file.name, await file.text());
      saveCurrentMapFromCanvas();
      workspace.maps.unshift(...importedMaps);
      workspace.currentMapId = importedMaps[0].id;
      persistWorkspace();
      renderMapList(workspace);
      loadMapIntoCanvas(importedMaps[0].id);
      queueSync();
      setStatus(`${importedMaps.length}件をインポートしました`, 'ok');
    } catch (error) {
      setStatus(`インポート失敗: ${error.message}`, 'error');
      window.alert(`インポートできませんでした。\n${error.message}`);
    } finally {
      importMapInput.value = '';
    }
  }

  renderMapList(workspace);
  updateHeader();
  updateLayoutState();
  updateSelectedNode(null);
  refitCanvas();

  mindMap.on('data_change', queueSync);
  mindMap.on('node_tree_render_end', updateRootQuickAddButton);
  mindMap.on('node_active', (node, activeNodeList = []) => {
    updateSelectedNode(node || activeNodeList[0] || null);
  });
  mindMap.on('node_text_edit_change', ({ node, text }) => {
    if (!isRootNode(node)) return;
    const currentMap = getCurrentMap(workspace);
    const nextTitle = text?.trim() ? text : currentMap.title;
    mapTitleHeading.textContent = nextTitle;
    document.title = `${nextTitle} - MindFlow`;
  });

  document.getElementById('collapseSidebarBtn').addEventListener('click', () => setLayoutState('sidebar', true));
  document.getElementById('expandSidebarBtn').addEventListener('click', () => setLayoutState('sidebar', false));
  document.getElementById('collapseTopbarBtn').addEventListener('click', () => setLayoutState('header', true));
  document.getElementById('expandTopbarBtn').addEventListener('click', () => setLayoutState('header', false));
  document.getElementById('collapseToolbarBtn').addEventListener('click', () => setLayoutState('toolbar', true));
  document.getElementById('expandToolbarBtn').addEventListener('click', () => setLayoutState('toolbar', false));
  document.getElementById('collapseStatusBtn').addEventListener('click', () => setLayoutState('status', true));
  document.getElementById('expandStatusBtn').addEventListener('click', () => setLayoutState('status', false));

  document.getElementById('mapList').addEventListener('click', (event) => {
    const button = event.target.closest('[data-map-id]');
    if (button) loadMapIntoCanvas(button.dataset.mapId);
  });

  document.getElementById('newMapBtn').addEventListener('click', () => {
    const name = window.prompt('新しいマインドマップ名', `マインドマップ ${workspace.maps.length + 1}`);
    if (!name) return;
    saveCurrentMapFromCanvas();
    const map = createBlankMap(name.trim() || `マインドマップ ${workspace.maps.length + 1}`);
    workspace.maps.unshift(map);
    workspace.currentMapId = map.id;
    persistWorkspace();
    renderMapList(workspace);
    loadMapIntoCanvas(map.id);
    queueSync();
  });

  document.getElementById('renameMapBtn').addEventListener('click', () => {
    if (startNodeTextEdit()) return;
    const currentMap = getCurrentMap(workspace);
    const name = window.prompt('マップ名', currentMap.title);
    if (!name) return;
    currentMap.title = name.trim() || currentMap.title;
    currentMap.root.data.text = currentMap.title;
    loadMapIntoCanvas(currentMap.id);
    queueSync();
  });

  document.getElementById('deleteMapBtn').addEventListener('click', () => {
    if (workspace.maps.length <= 1) {
      window.alert('最後のマップは削除できません。');
      return;
    }
    const currentMap = getCurrentMap(workspace);
    if (!window.confirm(`「${currentMap.title}」を削除しますか？`)) return;
    workspace.maps = workspace.maps.filter((map) => map.id !== currentMap.id);
    workspace.currentMapId = workspace.maps[0].id;
    persistWorkspace();
    renderMapList(workspace);
    loadMapIntoCanvas(workspace.currentMapId);
    queueSync();
  });

  document.getElementById('importMapBtn').addEventListener('click', () => importMapInput.click());
  importMapInput.addEventListener('change', async (event) => {
    await importMapFile(event.target.files?.[0]);
  });
  rootQuickAddBtn.addEventListener('click', () => {
    const rootNode = getRootNode();
    if (!rootNode || isTextEditing()) return;
    mindMap.execCommand('INSERT_CHILD_NODE', true, [rootNode]);
  });

  document.getElementById('addChildBtn').addEventListener('click', () => {
    if (!isTextEditing()) mindMap.execCommand('INSERT_CHILD_NODE');
  });
  document.getElementById('addSiblingBtn').addEventListener('click', () => {
    if (!isTextEditing()) mindMap.execCommand('INSERT_NODE');
  });
  document.getElementById('deleteNodeBtn').addEventListener('click', () => {
    if (!isTextEditing()) mindMap.execCommand('REMOVE_NODE');
  });
  document.getElementById('fitBtn').addEventListener('click', () => mindMap.view.fit());
  document.getElementById('syncBtn').addEventListener('click', syncNow);
  document.getElementById('logoutBtn').addEventListener('click', () => {
    clearSession();
    window.location.reload();
  });

  window.addEventListener('resize', refitCanvas);
}

const app = document.getElementById('app');

if (getToken()) {
  boot(app).catch((error) => {
    console.error(error);
    clearSession();
    renderTokenScreen(app);
  });
} else {
  renderTokenScreen(app);
}
