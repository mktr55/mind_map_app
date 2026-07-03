import MindElixir from 'mind-elixir';
import { ja } from 'mind-elixir/i18n';
import 'mind-elixir/style.css';
import './elixir-spike.css';

const STORAGE_KEYS = {
  workspace: 'mindflow.workspace',
};

function uid(prefix = 'node') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

function createNode(text, prefix = 'node') {
  return {
    data: { text, expand: true, uid: uid(prefix) },
    children: [],
  };
}

function createDefaultWorkspace() {
  const title = 'Mind Elixir 検証';
  const map = {
    id: uid('map'),
    title,
    updatedAt: new Date().toISOString(),
    layout: 'logicalStructure',
    root: {
      data: { text: title, expand: true, uid: uid('root') },
      children: [
        createNode('スマホで触りやすいか'),
        createNode('既存データを保てるか'),
        createNode('同期に戻せるか'),
      ],
    },
  };

  return {
    currentMapId: map.id,
    maps: [map],
    updatedAt: map.updatedAt,
  };
}

function normalizeWorkspace(input) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.maps) || input.maps.length === 0) {
    return createDefaultWorkspace();
  }

  const maps = input.maps
    .filter((map) => map?.root)
    .map((map, index) => ({
      id: map.id || uid('map'),
      title: map.title || map.root?.data?.text || `マインドマップ ${index + 1}`,
      updatedAt: map.updatedAt || new Date().toISOString(),
      layout: map.layout || 'logicalStructure',
      root: map.root,
    }));

  if (maps.length === 0) return createDefaultWorkspace();

  return {
    currentMapId: maps.some((map) => map.id === input.currentMapId) ? input.currentMapId : maps[0].id,
    maps,
    updatedAt: input.updatedAt || new Date().toISOString(),
  };
}

function getCurrentMap(workspace) {
  return workspace.maps.find((map) => map.id === workspace.currentMapId) || workspace.maps[0];
}

function getTextFromSimpleNode(node, fallback = '無題') {
  return node?.data?.text || node?.data?.data?.text || fallback;
}

function makeStyle(data = {}) {
  const style = {};
  if (data.color) style.color = data.color;
  if (data.fillColor) style.background = data.fillColor;
  if (data.fontSize) style.fontSize = String(data.fontSize);
  return Object.keys(style).length ? style : undefined;
}

function simpleToElixirNode(node, depth = 0, index = 0) {
  const data = node?.data || {};
  const id = data.uid || uid('me');
  const elixirNode = {
    id,
    topic: getTextFromSimpleNode(node),
    expanded: data.expand !== false,
    style: makeStyle(data),
    children: (node?.children || []).map((child, childIndex) => simpleToElixirNode(child, depth + 1, childIndex)),
    mindflow: {
      data: { ...data, uid: id },
      note: data.note || '',
    },
  };

  if (depth === 1) elixirNode.direction = index % 2 === 0 ? MindElixir.RIGHT : MindElixir.LEFT;
  if (data.hyperlink) elixirNode.hyperLink = data.hyperlink;
  if (Array.isArray(data.tags)) elixirNode.tags = data.tags;
  if (data.icon) elixirNode.icons = [data.icon];

  return elixirNode;
}

function elixirToSimpleNode(node) {
  const originalData = node?.mindflow?.data || {};
  const data = {
    ...originalData,
    uid: node.id || originalData.uid || uid('node'),
    text: node.topic || originalData.text || '無題',
    expand: node.expanded !== false,
  };

  if (node.hyperLink) data.hyperlink = node.hyperLink;
  if (node.style?.color) data.color = node.style.color;
  if (node.style?.background) data.fillColor = node.style.background;
  if (node.style?.fontSize) data.fontSize = Number.parseInt(node.style.fontSize, 10) || node.style.fontSize;
  if (node.mindflow?.note) data.note = node.mindflow.note;
  if (Array.isArray(node.tags)) data.tags = node.tags;
  if (Array.isArray(node.icons) && node.icons[0]) data.icon = node.icons[0];

  return {
    data,
    children: (node.children || []).map(elixirToSimpleNode),
  };
}

function workspaceToElixirData(workspace) {
  const currentMap = getCurrentMap(workspace);
  return {
    nodeData: simpleToElixirNode(currentMap.root),
    arrows: currentMap.elixirArrows || [],
    summaries: currentMap.elixirSummaries || [],
  };
}

function elixirDataToWorkspace(workspace, elixirData) {
  const currentMap = getCurrentMap(workspace);
  const root = elixirToSimpleNode(elixirData.nodeData);
  currentMap.root = root;
  currentMap.title = root.data.text || currentMap.title;
  currentMap.updatedAt = new Date().toISOString();
  currentMap.elixirArrows = elixirData.arrows || [];
  currentMap.elixirSummaries = elixirData.summaries || [];
  workspace.updatedAt = currentMap.updatedAt;
  return workspace;
}

function downloadText(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function renderShell(app, currentMap) {
  app.innerHTML = `
    <main class="elixir-app">
      <header class="elixir-topbar">
        <div class="elixir-title">
          <strong>${currentMap.title}</strong>
          <span>Mind Elixir spike</span>
        </div>
        <div class="elixir-actions">
          <a class="elixir-btn" href="${location.pathname}">現行版</a>
          <button class="elixir-btn" id="elixirUndoBtn" type="button">Undo</button>
          <button class="elixir-btn" id="elixirRedoBtn" type="button">Redo</button>
          <button class="elixir-btn" id="elixirFitBtn" type="button">Fit</button>
          <button class="elixir-btn primary" id="elixirSaveBtn" type="button">保存</button>
          <button class="elixir-btn" id="elixirExportBtn" type="button">JSON</button>
        </div>
      </header>
      <section class="elixir-stage">
        <div id="elixirMap" class="elixir-map"></div>
        <div class="elixir-mobile-dock" id="elixirMobileDock">
          <button class="elixir-mobile-btn" id="elixirAddChildBtn" type="button">子追加</button>
          <button class="elixir-mobile-btn" id="elixirAddSiblingBtn" type="button">兄弟追加</button>
          <button class="elixir-mobile-btn" id="elixirEditBtn" type="button">編集</button>
          <button class="elixir-mobile-btn danger" id="elixirDeleteBtn" type="button">削除</button>
        </div>
      </section>
      <footer class="elixir-status" id="elixirStatus">既存ワークスペースを Mind Elixir 形式で表示しています</footer>
    </main>
  `;
}

export function renderMindElixirSpike(app) {
  let workspace = normalizeWorkspace(readJson(STORAGE_KEYS.workspace, createDefaultWorkspace()));
  const currentMap = getCurrentMap(workspace);
  renderShell(app, currentMap);

  const status = document.getElementById('elixirStatus');
  const setStatus = (message) => {
    status.textContent = message;
  };

  const mobileButtons = {
    addChild: document.getElementById('elixirAddChildBtn'),
    addSibling: document.getElementById('elixirAddSiblingBtn'),
    edit: document.getElementById('elixirEditBtn'),
    remove: document.getElementById('elixirDeleteBtn'),
  };

  const mind = new MindElixir({
    el: '#elixirMap',
    direction: MindElixir.SIDE,
    editable: true,
    toolBar: true,
    keypress: true,
    overflowHidden: false,
    compact: false,
    mobileMultiSelect: true,
    newTopicName: '新しいトピック',
    contextMenu: {
      locale: ja,
      focus: true,
      link: true,
    },
    theme: {
      name: 'MindFlow Elixir',
      palette: ['#0f766e', '#2563eb', '#f59e0b', '#dc2626', '#7c3aed', '#16a34a', '#db2777', '#475569'],
      cssVar: {
        '--main-bgcolor': '#f6f4ef',
        '--main-color': '#1f2937',
        '--color': '#172033',
        '--bgcolor': '#ffffff',
        '--selected': '#f59e0b',
        '--accent-color': '#0f766e',
        '--root-bgcolor': '#0f766e',
        '--root-color': '#ffffff',
        '--root-radius': '8px',
        '--main-radius': '7px',
        '--topic-padding': '8px 12px',
        '--panel-bgcolor': '255, 255, 255',
        '--panel-color': '23, 32, 51',
      },
    },
  });

  mind.init(workspaceToElixirData(workspace));
  mind.toCenter();

  const getSelectedTopic = () => mind.currentNode || null;
  const isRootTopic = (topic) => Boolean(topic?.nodeObj && !topic.nodeObj.parent);

  const syncMobileActions = () => {
    const topic = getSelectedTopic();
    const hasSelection = Boolean(topic);
    mobileButtons.addChild.disabled = !hasSelection;
    mobileButtons.edit.disabled = !hasSelection;
    mobileButtons.addSibling.disabled = !hasSelection || isRootTopic(topic);
    mobileButtons.remove.disabled = !hasSelection || isRootTopic(topic);
  };

  const save = (message = 'Mind Elixir の編集を workspace に保存しました') => {
    workspace = elixirDataToWorkspace(workspace, mind.getData());
    writeJson(STORAGE_KEYS.workspace, workspace);
    setStatus(message);
  };

  let saveTimer = null;
  mind.bus.addListener('operation', (operation) => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => save(`保存済み: ${operation?.name || 'operation'}`), 500);
    syncMobileActions();
  });
  mind.bus.addListener('selectNodes', () => {
    syncMobileActions();
  });

  const addChildFromSelection = () => {
    const topic = getSelectedTopic();
    if (!topic) {
      setStatus('まずノードを選択してください');
      return;
    }
    mind.addChild(topic);
    syncMobileActions();
  };

  const addSiblingFromSelection = () => {
    const topic = getSelectedTopic();
    if (!topic || isRootTopic(topic)) {
      setStatus('ルートノードには兄弟ノードを追加できません');
      return;
    }
    mind.insertSibling('after', topic);
    syncMobileActions();
  };

  const editSelection = () => {
    const topic = getSelectedTopic();
    if (!topic) {
      setStatus('まずノードを選択してください');
      return;
    }
    mind.beginEdit(topic);
  };

  const removeSelection = async () => {
    const topic = getSelectedTopic();
    if (!topic || isRootTopic(topic)) {
      setStatus('ルートノードは削除できません');
      return;
    }
    await mind.removeNodes([topic]);
    syncMobileActions();
  };

  document.getElementById('elixirSaveBtn').addEventListener('click', () => save());
  document.getElementById('elixirUndoBtn').addEventListener('click', () => {
    mind.undo();
    save('Undo を反映しました');
  });
  document.getElementById('elixirRedoBtn').addEventListener('click', () => {
    mind.redo();
    save('Redo を反映しました');
  });
  document.getElementById('elixirFitBtn').addEventListener('click', () => {
    mind.scaleFit();
    mind.toCenter();
  });
  document.getElementById('elixirExportBtn').addEventListener('click', () => {
    save('JSON をエクスポートしました');
    downloadText(`${getCurrentMap(workspace).title || 'mindflow-elixir'}.json`, JSON.stringify(mind.getData(), null, 2));
  });
  mobileButtons.addChild.addEventListener('click', addChildFromSelection);
  mobileButtons.addSibling.addEventListener('click', addSiblingFromSelection);
  mobileButtons.edit.addEventListener('click', editSelection);
  mobileButtons.remove.addEventListener('click', () => {
    void removeSelection();
  });

  syncMobileActions();

  window.__mindflowElixir = mind;
}
