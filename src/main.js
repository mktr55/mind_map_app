import MindMap from 'simple-mind-map';
import TouchEvent from 'simple-mind-map/src/plugins/TouchEvent.js';
import AssociativeLine from 'simple-mind-map/src/plugins/AssociativeLine.js';
import KeyboardNavigation from 'simple-mind-map/src/plugins/KeyboardNavigation.js';
import './style.css';

MindMap.usePlugin(TouchEvent);
MindMap.usePlugin(AssociativeLine);
MindMap.usePlugin(KeyboardNavigation);

const STORAGE_KEYS = {
  token: 'mindflow.githubToken',
  user: 'mindflow.githubUser',
  workspace: 'mindflow.workspace',
  sidebarCollapsed: 'mindflow.sidebarCollapsed',
  headerCollapsed: 'mindflow.headerCollapsed',
  toolbarCollapsed: 'mindflow.toolbarCollapsed',
};

const API_BASE = 'https://api.github.com';
const DEFAULT_REPO = 'mindflow-data';
const DEFAULT_PATH = 'mindflow/workspace.json';
const SYNC_DEBOUNCE_MS = 1200;
const IS_LOCAL_DEV_MODE = import.meta.env.DEV && !getToken();

function canUseMapShortcut(eventOrTarget) {
  const target = eventOrTarget?.target || eventOrTarget;
  const el = target instanceof Element ? target : null;
  return Boolean(el && (el === document.body || el.closest('#mindMapMount') || el.closest('.smm-node-edit-wrap')));
}

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
  if (node.root && typeof node.root === 'object') {
    node = node.root;
  }
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
        associativeLineWidth: 3,
        associativeLineColor: '#22c55e',
        associativeLineActiveWidth: 8,
        associativeLineActiveColor: '#16a34a',
        associativeLineDasharray: '0',
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
      <div id="mindMapMount" class="mindmap-canvas" tabindex="-1"></div>
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
      <div class="sidebar-status-row">
        <span id="statusPill" class="status-pill" data-tone="muted">ローカル保存済み</span>
        <button id="deleteMapBtn" class="danger-btn small-btn" type="button">このマップを削除</button>
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
        <button id="connectBtn" class="tool-btn connect-btn" type="button">関係線</button>
        <button id="deleteNodeBtn" class="tool-btn danger" type="button">削除</button>
        <button id="fitBtn" class="tool-btn" type="button">全体</button>
        <button id="collapseToolbarBtn" class="icon-btn toolbar-toggle-btn" type="button" aria-label="操作ツールを折り畳む">〉</button>
      </section>

      <button id="expandToolbarBtn" class="panel-handle panel-handle-toolbar" type="button" aria-label="操作ツールを開く">
        <span>Tools</span><strong>〈</strong>
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
  const user = IS_LOCAL_DEV_MODE ? { login: 'local-preview' } : await fetchViewer();
  writeJson(STORAGE_KEYS.user, user);
  if (!IS_LOCAL_DEV_MODE) await ensurePrivateRepo(user.login);
  renderAppShell(app, user);

  const localWorkspace = normalizeWorkspace(readJson(STORAGE_KEYS.workspace, createDefaultWorkspace()));
  const remoteWorkspace = IS_LOCAL_DEV_MODE ? null : await readRemoteWorkspace(user.login);
  const workspace = remoteWorkspace?.content || localWorkspace;
  writeJson(STORAGE_KEYS.workspace, workspace);

  let currentSha = remoteWorkspace?.sha || null;
  let syncTimer = null;
  let suppressSave = false;
  let selectedNode = null;
  const currentMap = getCurrentMap(workspace);
  const mindMapData = buildMindMapData(currentMap);
  const mindMap = new MindMap({
    el: document.getElementById('mindMapMount'),
    data: currentMap.root,
    layout: currentMap.layout || 'logicalStructure',
    theme: mindMapData.theme.template,
    themeConfig: mindMapData.theme.config,
    fit: true,
    enableAutoEnterTextEditWhenKeydown: true,
    disableTouchZoom: false,
    minTouchZoomScale: 10,
    maxTouchZoomScale: 300,
    openRealtimeRenderOnNodeTextEdit: true,
    customCheckEnableShortcut: canUseMapShortcut,
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

function getActionTargetNode() {
  return selectedNode || mindMap.renderer?.activeNodeList?.[0] || getRootNode();
}

function insertChildNode(targetNode = getActionTargetNode()) {
  if (!targetNode || isTextEditing()) return;
  activateNode(targetNode);
  mindMap.execCommand('INSERT_CHILD_NODE', true, [targetNode]);
}

function insertSiblingNode(targetNode = getActionTargetNode()) {
  if (!targetNode || isTextEditing()) return;
  activateNode(targetNode);
  mindMap.execCommand('INSERT_NODE', true, [targetNode]);
}

mindMap.__mindflowInsertChildNode = insertChildNode;
mindMap.__mindflowInsertSiblingNode = insertSiblingNode;

function refreshAssociativeLines() {
  mindMap.associativeLine?.renderAllLines?.();
}

let connectMode = false;
let connectEscHandler = null;

function setConnectButtonActive(active) {
  document.getElementById('connectBtn')?.classList.toggle('active', active);
}

function exitConnectMode(message = null) {
  connectMode = false;
  setConnectButtonActive(false);
  if (connectEscHandler) {
    document.removeEventListener('keydown', connectEscHandler);
    connectEscHandler = null;
  }
  if (message) setStatus(message, 'muted');
}

function startConnect(fromNode = null) {
  const al = mindMap.associativeLine;
  if (!al) {
    setStatus('関係線プラグインが見つかりません', 'error');
    return;
  }

  if (al.isCreatingLine) {
    al.cancelCreateLine();
    exitConnectMode('関係線モードを解除しました');
    return;
  }

  const startNode = fromNode ?? selectedNode ?? mindMap.renderer?.activeNodeList?.[0] ?? null;
  if (!startNode) {
    setStatus('先にノードを選択してください', 'error');
    return;
  }

  try {
    mindMap.execCommand('CLEAR_ACTIVE_NODE');
  } catch {}

  al.createLine(startNode);
  connectMode = true;
  setConnectButtonActive(true);
  setStatus('関係線モード: つなぐ先のノードをクリック', 'working');

  connectEscHandler = (event) => {
    if (event.key === 'Escape') {
      al.cancelCreateLine();
      exitConnectMode('関係線モードを解除しました');
    }
  };
  document.addEventListener('keydown', connectEscHandler);

  const onDeactivate = () => {
    exitConnectMode();
    queueSync();
    mindMap.off('associative_line_deactivate', onDeactivate);
  };
  mindMap.on('associative_line_deactivate', onDeactivate);
}

function isRootNode(node = selectedNode) {
  const rootNode = getRootNode();
  return Boolean(node && rootNode && node.getData('uid') === rootNode.getData('uid'));
}

function getEditTargetNode() {
  return selectedNode || mindMap.renderer?.activeNodeList?.[0] || getRootNode();
}

function startNodeTextEdit(node = selectedNode) {
  if (!node) return false;
  mindMap.renderer?.textEdit?.show?.({ node, isInserting: false });
  return true;
}

function isTypingContext(target) {
  const el = target instanceof HTMLElement ? target : null;
  return Boolean(el && (el.matches('input, textarea, select') || el.isContentEditable));
}
function shouldHandleMapKey(event) {
  return canUseMapShortcut(event) && !isTextEditing() && !isTypingContext(event.target) && !event.altKey && !event.metaKey && !event.ctrlKey && !event.shiftKey;
}
function activateNode(node) {
  if (!node) return;
  mindMap.renderer?.clearActiveNodeList?.();
  mindMap.renderer?.addNodeToActiveList?.(node, true);
  mindMap.renderer?.emitNodeActiveEvent?.(node);
  updateSelectedNode(node);
}
function collectRenderedNodes(rootNode = getRootNode()) {
  const nodes = [];
  const queue = rootNode ? [rootNode] : [];
  while (queue.length) {
    const node = queue.shift();
    nodes.push(node);
    if (node.children?.length) queue.push(...node.children);
  }
  return nodes;
}
function getNodeScreenRect(node) {
  const rect = node?.getRect?.();
  if (rect) {
    const left = rect.left ?? rect.x;
    const top = rect.top ?? rect.y;
    const width = rect.width ?? 0;
    const height = rect.height ?? 0;
    return {
      left,
      top,
      right: rect.right ?? rect.x2 ?? left + width,
      bottom: rect.bottom ?? rect.y2 ?? top + height,
      width,
      height,
    };
  }
  const { scaleX = 1, scaleY = 1, translateX = 0, translateY = 0 } = mindMap.draw?.transform?.() || {};
  return {
    left: node.left * scaleX + translateX,
    top: node.top * scaleY + translateY,
    right: (node.left + node.width) * scaleX + translateX,
    bottom: (node.top + node.height) * scaleY + translateY,
    width: node.width * scaleX,
    height: node.height * scaleY,
  };
}
function findDirectionalNode(currentNode, dir) {
  const currentRect = getNodeScreenRect(currentNode);
  const currentCenter = {
    x: currentRect.left + currentRect.width / 2,
    y: currentRect.top + currentRect.height / 2,
  };
  return collectRenderedNodes()
    .filter((node) => node !== currentNode)
    .map((node) => {
      const rect = getNodeScreenRect(node);
      const center = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
      const dx = center.x - currentCenter.x;
      const dy = center.y - currentCenter.y;
      const primary = dir === 'Left' || dir === 'Right' ? Math.abs(dx) : Math.abs(dy);
      const cross = dir === 'Left' || dir === 'Right' ? Math.abs(dy) : Math.abs(dx);
      const isForward =
        (dir === 'Left' && dx < 0) ||
        (dir === 'Right' && dx > 0) ||
        (dir === 'Up' && dy < 0) ||
        (dir === 'Down' && dy > 0);
      return { node, isForward, score: primary + cross * 1.7 };
    })
    .filter((item) => item.isForward)
    .sort((a, b) => a.score - b.score)[0]?.node || null;
}
function navigateNodeByArrow(key) {
  const dirByKey = {
    ArrowLeft: 'Left',
    ArrowUp: 'Up',
    ArrowRight: 'Right',
    ArrowDown: 'Down',
  };
  const dir = dirByKey[key];
  if (!dir) return false;
  const currentNode = getActionTargetNode();
  if (!currentNode) return true;
  const targetNode = findDirectionalNode(currentNode, dir);
  if (targetNode) {
    mindMap.execCommand('GO_TARGET_NODE', targetNode, updateSelectedNode);
  } else {
    activateNode(currentNode);
  }
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
    if (IS_LOCAL_DEV_MODE) {
      setStatus('ローカル保存済み', 'muted');
      return;
    }
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
    if (!IS_LOCAL_DEV_MODE) syncTimer = setTimeout(syncNow, SYNC_DEBOUNCE_MS);
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
  refreshAssociativeLines();
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
  mindMap.on('node_tree_render_end', () => {
    updateRootQuickAddButton();
    refreshAssociativeLines();
  });
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
    suppressSave = true;
    mindMap.setFullData(buildMindMapData(map));
    suppressSave = false;
    updateSelectedNode(null);
    refitCanvas();
    refreshAssociativeLines();
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
  insertChildNode(getRootNode());
  });

  document.getElementById('addChildBtn').addEventListener('click', () => {
  insertChildNode();
  });
  document.getElementById('addSiblingBtn').addEventListener('click', () => {
  insertSiblingNode();
  });
  document.getElementById('connectBtn').addEventListener('click', () => {
    if (!isTextEditing()) startConnect();
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

function triggerSelectedNodeTextEdit() {
  if (isTextEditing()) return;
  const targetNode = getEditTargetNode();
  if (!targetNode) return;
  
  const isActive = mindMap.renderer?.activeNodeList?.includes(targetNode);
  if (!isActive) {
    activateNode(targetNode);
  }
  startNodeTextEdit(targetNode);
}

window.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || (!event.metaKey && !event.ctrlKey) || event.altKey || event.shiftKey) return;
  if (isTypingContext(event.target)) return;
  event.preventDefault();
  event.stopPropagation();
  triggerSelectedNodeTextEdit();
}, true);

window.addEventListener('keydown', (event) => {
  if (!shouldHandleMapKey(event)) return;
  if (event.key === 'Tab') {
    event.preventDefault();
    event.stopImmediatePropagation();
    insertChildNode();
    return;
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    event.stopImmediatePropagation();
    insertSiblingNode();
    return;
  }
  if (navigateNodeByArrow(event.key)) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}, true);

window.addEventListener('resize', refitCanvas);
  }

const app = document.getElementById('app');

if (getToken() || IS_LOCAL_DEV_MODE) {
  boot(app).catch((error) => {
    console.error(error);
    if (IS_LOCAL_DEV_MODE) {
      renderTokenScreen(app);
      return;
    }
    clearSession();
    renderTokenScreen(app);
  });
} else {
  renderTokenScreen(app);
}
