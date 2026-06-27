import { LAYOUTS, EXPORT_FORMATS } from '../utils/constants.js';
import { toggleTheme, getThemePreference } from '../themes/themes.js';
import { toast } from './toast.js';
import { logout } from '../auth/github-oauth.js';

/* ------------------------------------------------------------------ */

// SVG icon helpers (inline for zero external dependency)
const I = {
  addChild:    `<svg viewBox="0 0 20 20" fill="none"><rect x="2" y="6" width="6" height="5" rx="1.5" stroke="currentColor" stroke-width="1.4"/><rect x="12" y="3" width="6" height="5" rx="1.5" stroke="currentColor" stroke-width="1.4"/><rect x="12" y="12" width="6" height="5" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M8 8.5h2a2 2 0 0 1 2 2v2.5M10 8.5V5.5a2 2 0 0 1 2-2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`,
  addSibling:  `<svg viewBox="0 0 20 20" fill="none"><rect x="2" y="7.5" width="7" height="5" rx="1.5" stroke="currentColor" stroke-width="1.4"/><rect x="11" y="7.5" width="7" height="5" rx="1.5" stroke="currentColor" stroke-width="1.4"/></svg>`,
  delete:      `<svg viewBox="0 0 20 20" fill="none"><path d="M7 3h6M4 6h12M8 6v9M12 6v9M5 6l.5 10.5a1 1 0 0 0 1 .5h7a1 1 0 0 0 1-.5L15 6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  undo:        `<svg viewBox="0 0 20 20" fill="none"><path d="M4 8.5 A6 6 0 1 1 5.5 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 4v5h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  redo:        `<svg viewBox="0 0 20 20" fill="none"><path d="M16 8.5 A6 6 0 1 0 14.5 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 4v5h-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  zoomIn:      `<svg viewBox="0 0 20 20" fill="none"><circle cx="9" cy="9" r="5.5" stroke="currentColor" stroke-width="1.4"/><path d="M7 9h4M9 7v4M14 14l3 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`,
  zoomOut:     `<svg viewBox="0 0 20 20" fill="none"><circle cx="9" cy="9" r="5.5" stroke="currentColor" stroke-width="1.4"/><path d="M7 9h4M14 14l3 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`,
  fit:         `<svg viewBox="0 0 20 20" fill="none"><path d="M3 7V4h3M14 4h3v3M17 13v3h-3M6 17H3v-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><rect x="7" y="7" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.4"/></svg>`,
  layout:      `<svg viewBox="0 0 20 20" fill="none"><rect x="2" y="3" width="5" height="4" rx="1" stroke="currentColor" stroke-width="1.4"/><rect x="2" y="13" width="5" height="4" rx="1" stroke="currentColor" stroke-width="1.4"/><rect x="13" y="8" width="5" height="4" rx="1" stroke="currentColor" stroke-width="1.4"/><path d="M7 5h4a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H7" stroke="currentColor" stroke-width="1.4"/><path d="M7 15h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`,
  exportIcon:  `<svg viewBox="0 0 20 20" fill="none"><path d="M10 3v10m0 0L7 10m3 3 3-3M4 15h12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  sun:         `<svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="3.5" stroke="currentColor" stroke-width="1.4"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`,
  moon:        `<svg viewBox="0 0 20 20" fill="none"><path d="M17 12.5A7 7 0 0 1 7.5 3a7 7 0 1 0 9.5 9.5z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  menu:        `<svg viewBox="0 0 20 20" fill="none"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  minimap:     `<svg viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="16" height="12" rx="1.5" stroke="currentColor" stroke-width="1.4"/><rect x="11" y="10" width="6" height="4" rx="1" stroke="currentColor" stroke-width="1.2"/><path d="M5 7h5M5 10h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`,
  files:       `<svg viewBox="0 0 20 20" fill="none"><path d="M5 4h6l3 3v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" stroke="currentColor" stroke-width="1.4"/><path d="M11 4v3h3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`,
  logout:      `<svg viewBox="0 0 20 20" fill="none"><path d="M13 14l3-4-3-4M16 10H8M10 4H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  nodeSettings: `<svg viewBox="0 0 20 20" fill="none"><rect x="3" y="4" width="14" height="12" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M7 8h6M7 12h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
  connect:     `<svg viewBox="0 0 20 20" fill="none"><circle cx="4.5" cy="10" r="2.5" stroke="currentColor" stroke-width="1.4"/><circle cx="15.5" cy="10" r="2.5" stroke="currentColor" stroke-width="1.4"/><path d="M7 10h6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-dasharray="2 1.5"/><path d="M11.5 8l2 2-2 2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

let toolbar = null;
let _mindMap = null;
let _onOpenFiles = null;
let _onToggleMinimap = null;
let _onOpenSidebar = null;
let minimapVisible = true;
let connectBanner = null;
let connectEscHandler = null;
let nodeContextMenu = null;
let nodeContextMenuNode = null;
let nodeContextMenuCloseHandler = null;
let connectMode = false;
let relationLineDeleteVisible = false;
let relationLineQuickDelete = null;
let relationLineContextMenu = null;
let relationLineContextMenuCloseHandler = null;

/* ── Public API ─────────────────────────────────────────────────── */
export function createToolbar(mindMapInstance, { onOpenFiles, onToggleMinimap, onOpenSidebar }) {
  _mindMap         = mindMapInstance;
  _onOpenFiles     = onOpenFiles;
  _onToggleMinimap = onToggleMinimap;
  _onOpenSidebar   = onOpenSidebar;

  toolbar = document.createElement('div');
  toolbar.className = 'toolbar';
  toolbar.id = 'appToolbar';
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', 'マインドマップツールバー');

  toolbar.innerHTML = buildHTML();
  document.body.appendChild(toolbar);

  wireEvents();
  updateThemeBtn();
  const api = {
    updateThemeBtn,
    startConnect,
    openNodeContextMenu,
    openRelationLineContextMenu,
    closeNodeContextMenu,
    closeRelationLineContextMenu,
    exitConnectMode,
    isConnectMode,
    setRelationLineDeleteVisible,
    updateRelationLineQuickDeletePosition,
  };
  return api;
}

function buildHTML() {
  return `
    <!-- Files -->
    <button class="toolbar-btn" id="tbFiles" data-tooltip="マップ一覧">${I.files}</button>
    <div class="toolbar-divider"></div>

    <!-- Node ops -->
    <button class="toolbar-btn" id="tbAddChild"   data-tooltip="子ノード追加 (Tab)">${I.addChild}</button>
    <button class="toolbar-btn" id="tbAddSibling" data-tooltip="兄弟ノード追加 (Enter)">${I.addSibling}</button>
    <button class="toolbar-btn connect-action" id="tbConnect" data-tooltip="関係線を追加 — 階層をまたいでノード同士をつなげます">${I.connect}</button>
    <button class="toolbar-btn danger-action" id="tbDeleteLine" data-tooltip="選択中の関係線を削除">${I.delete}</button>
    <button class="toolbar-btn" id="tbDelete"     data-tooltip="ノード削除 (Del)">${I.delete}</button>
    <div class="toolbar-divider"></div>

    <!-- Undo/Redo -->
    <button class="toolbar-btn" id="tbUndo" data-tooltip="元に戻す (Ctrl+Z)">${I.undo}</button>
    <button class="toolbar-btn" id="tbRedo" data-tooltip="やり直し (Ctrl+Y)">${I.redo}</button>
    <div class="toolbar-divider"></div>

    <!-- Zoom -->
    <button class="toolbar-btn" id="tbZoomIn"  data-tooltip="拡大 (Ctrl+)">${I.zoomIn}</button>
    <button class="toolbar-btn" id="tbZoomOut" data-tooltip="縮小 (Ctrl-)">${I.zoomOut}</button>
    <button class="toolbar-btn" id="tbFit"     data-tooltip="全体表示 (F1)">${I.fit}</button>
    <div class="toolbar-divider"></div>

    <!-- Layout dropdown -->
    <div class="toolbar-dropdown-wrap">
      <button class="toolbar-btn" id="tbLayout" data-tooltip="レイアウト">${I.layout}</button>
      <div class="toolbar-dropdown" id="layoutDrop">
        ${LAYOUTS.map(l => `<div class="toolbar-dropdown-item" data-layout="${l.id}">${l.icon} ${l.label}</div>`).join('')}
      </div>
    </div>

    <!-- Export dropdown -->
    <div class="toolbar-dropdown-wrap">
      <button class="toolbar-btn" id="tbExport" data-tooltip="エクスポート">${I.exportIcon}</button>
      <div class="toolbar-dropdown" id="exportDrop">
        ${EXPORT_FORMATS.map(f => `<div class="toolbar-dropdown-item" data-format="${f.id}">${f.icon} ${f.label}</div>`).join('')}
      </div>
    </div>
    <div class="toolbar-divider"></div>

    <!-- Node settings -->
    <button class="toolbar-btn" id="tbNodeSettings" data-tooltip="ノード設定 (右クリックでも開く)">${I.nodeSettings}</button>

    <!-- Minimap -->
    <button class="toolbar-btn active" id="tbMinimap" data-tooltip="ミニマップ">${I.minimap}</button>

    <!-- Theme -->
    <button class="toolbar-btn" id="tbTheme" data-tooltip="テーマ切替">${I.sun}</button>

    <!-- Logout -->
    <button class="toolbar-btn" id="tbLogout" data-tooltip="ログアウト" style="color:var(--text-muted)">${I.logout}</button>
  `;
}

function wireEvents() {
  const g = id => toolbar.querySelector(`#${id}`);

  g('tbFiles').onclick      = () => _onOpenFiles?.();
  g('tbAddChild').onclick   = () => _mindMap?.execCommand('INSERT_CHILD_NODE');
  g('tbAddSibling').onclick = () => _mindMap?.execCommand('INSERT_BROTHER_NODE');
  g('tbConnect').onclick    = () => startConnect();
  g('tbDeleteLine').onclick = () => {
    removeActiveRelationLine();
  };
  g('tbDelete').onclick     = () => _mindMap?.execCommand('REMOVE_NODE');
  g('tbUndo').onclick       = () => _mindMap?.execCommand('BACK');
  g('tbRedo').onclick       = () => _mindMap?.execCommand('FORWARD');
  g('tbZoomIn').onclick     = () => _mindMap?.execCommand('ZOOM_IN');
  g('tbZoomOut').onclick    = () => _mindMap?.execCommand('ZOOM_OUT');
  g('tbFit').onclick        = () => _mindMap?.execCommand('FIT_CANVAS');

  // Node settings
  g('tbNodeSettings').onclick = () => _onOpenSidebar?.();

  // Minimap toggle
  g('tbMinimap').onclick = () => {
    minimapVisible = !minimapVisible;
    g('tbMinimap').classList.toggle('active', minimapVisible);
    _onToggleMinimap?.(minimapVisible);
  };

  // Theme toggle
  g('tbTheme').onclick = () => {
    const theme = toggleTheme();
    updateThemeBtn();
    // Sync mind map background via SET_THEME command
    const bgColor = theme === 'dark' ? '#0d1117' : '#f6f8fa';
    _mindMap?.execCommand('SET_THEME_CONFIG', { backgroundColor: bgColor });
  };

  // Logout
  g('tbLogout').onclick = () => {
    if (!confirm('ログアウトしますか？')) return;
    logout();
    location.reload();
  };

  // Layout dropdown
  wireDropdown('tbLayout', 'layoutDrop', item => {
    const layout = item.dataset.layout;
    _mindMap?.execCommand('SET_LAYOUT', layout);
    toast.info(`レイアウト: ${LAYOUTS.find(l => l.id === layout)?.label ?? layout}`);
  });

  // Export dropdown
  wireDropdown('tbExport', 'exportDrop', async item => {
    const fmt = item.dataset.format;
    await handleExport(fmt);
  });
}

function wireDropdown(btnId, dropId, onSelect) {
  const btn  = toolbar.querySelector(`#${btnId}`);
  const drop = toolbar.querySelector(`#${dropId}`);
  if (!btn || !drop) return;

  btn.addEventListener('click', e => {
    e.stopPropagation();
    const isOpen = drop.classList.contains('open');
    closeAllDropdowns();
    if (!isOpen) drop.classList.add('open');
  });

  drop.querySelectorAll('.toolbar-dropdown-item').forEach(item => {
    item.addEventListener('click', e => {
      e.stopPropagation();
      drop.classList.remove('open');
      onSelect(item);
    });
  });
}

function closeAllDropdowns() {
  toolbar?.querySelectorAll('.toolbar-dropdown').forEach(d => d.classList.remove('open'));
}

document.addEventListener('click', closeAllDropdowns);

function updateThemeBtn() {
  const btn = toolbar?.querySelector('#tbTheme');
  if (!btn) return;
  const isDark = getThemePreference() === 'dark';
  btn.innerHTML    = isDark ? I.sun : I.moon;
  btn.dataset.tooltip = isDark ? 'ライトモード' : 'ダークモード';
}

/* ── Connection mode / context menu ──────────────────────────────── */
export function startConnect(fromNode = null) {
  const al = _mindMap?.associativeLine;
  if (!al) {
    toast.error('AssociativeLine プラグインが見つかりません');
    return;
  }

  // If already connecting, cancel
  if (al.isCreatingLine) {
    al.cancelCreateLine();
    exitConnectMode();
    return;
  }

  const startNode = fromNode ?? _mindMap?.renderer?.activeNodeList?.[0] ?? null;
  if (!startNode) {
    toast.info('まずノードを選択してください。');
    return;
  }

  // Start drawing
  try {
    _mindMap.execCommand('CLEAR_ACTIVE_NODE');
  } catch {}
  al.createLine(startNode);

  // Highlight button
  const btn = toolbar?.querySelector('#tbConnect');
  btn?.classList.add('active');

  // Show guide banner
  showConnectBanner();
  connectMode = true;

  // Esc to cancel
  connectEscHandler = (e) => {
    if (e.key === 'Escape') { al.cancelCreateLine(); exitConnectMode(); }
  };
  document.addEventListener('keydown', connectEscHandler);

  // Listen for connection completed or cancelled
  const onDeactivate = () => {
    exitConnectMode();
    _mindMap.off('associative_line_deactivate', onDeactivate);
  };
  _mindMap.on('associative_line_deactivate', onDeactivate);
}

export function exitConnectMode() {
  toolbar?.querySelector('#tbConnect')?.classList.remove('active');
  connectBanner?.remove();
  connectBanner = null;
  connectMode = false;
  if (connectEscHandler) {
    document.removeEventListener('keydown', connectEscHandler);
    connectEscHandler = null;
  }
}

export function isConnectMode() {
  return connectMode;
}

function removeActiveRelationLine() {
  const al = _mindMap?.associativeLine;
  if (!al?.activeLine) {
    toast.info('削除したい関係線を先にクリックしてください。');
    return false;
  }
  al.removeLine?.();
  return true;
}

export function setRelationLineDeleteVisible(visible) {
  relationLineDeleteVisible = !!visible;
  toolbar?.querySelector('#tbDeleteLine')?.classList.toggle('active', relationLineDeleteVisible);
  if (!relationLineDeleteVisible) {
    hideRelationLineQuickDelete();
    closeRelationLineContextMenu();
    return;
  }
  ensureRelationLineQuickDelete();
  updateRelationLineQuickDeletePosition();
}

export function updateRelationLineQuickDeletePosition() {
  if (!relationLineDeleteVisible || !_mindMap?.associativeLine?.activeLine) {
    hideRelationLineQuickDelete();
    return;
  }
  ensureRelationLineQuickDelete();
  const pathNode = _mindMap.associativeLine.activeLine?.[0]?.node;
  const rect = pathNode?.getBoundingClientRect?.();
  if (!rect || (!rect.width && !rect.height)) {
    hideRelationLineQuickDelete();
    return;
  }
  const size = 28;
  const left = Math.min(window.innerWidth - size - 12, Math.max(12, rect.right - size / 2));
  const top = Math.min(window.innerHeight - size - 12, Math.max(12, rect.top + rect.height / 2 - size / 2));
  relationLineQuickDelete.style.left = `${left}px`;
  relationLineQuickDelete.style.top = `${top}px`;
  relationLineQuickDelete.classList.add('visible');
}

function showConnectBanner() {
  connectBanner?.remove();
  connectBanner = document.createElement('div');
  connectBanner.id = 'connectBanner';
  connectBanner.style.cssText = `
    position: fixed;
    top: 64px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 500;
    background: var(--accent);
    color: #fff;
    padding: 8px 20px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 500;
    box-shadow: var(--shadow-md), var(--shadow-glow);
    display: flex;
    align-items: center;
    gap: 10px;
    white-space: nowrap;
    pointer-events: none;
    font-family: var(--font-sans);
    animation: toastIn 0.3s ease forwards;
  `;
  connectBanner.innerHTML = `
    <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
      <circle cx="3" cy="8" r="2" stroke="currentColor" stroke-width="1.3"/>
      <circle cx="13" cy="8" r="2" stroke="currentColor" stroke-width="1.3"/>
      <path d="M5 8h6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-dasharray="1.5 1.2"/>
    </svg>
    階層をまたいでつなげたいノードをクリックしてください &nbsp;·&nbsp; <kbd style="background:rgba(255,255,255,0.2);padding:1px 6px;border-radius:4px;font-size:11px">Esc</kbd> でキャンセル
  `;
  document.body.appendChild(connectBanner);
}

export function openNodeContextMenu(node, event) {
  if (!node || !_mindMap) return;

  closeRelationLineContextMenu();
  closeNodeContextMenu();
  nodeContextMenuNode = node;

  nodeContextMenu = document.createElement('div');
  nodeContextMenu.className = 'node-context-menu';
  nodeContextMenu.innerHTML = `
    <button type="button" class="node-context-menu-item" data-action="connect">${I.connect}<span>関係線を追加</span></button>
    <button type="button" class="node-context-menu-item" data-action="sidebar">${I.nodeSettings}<span>ノード設定</span></button>
    <button type="button" class="node-context-menu-item" data-action="child">${I.addChild}<span>子ノード追加</span></button>
    <button type="button" class="node-context-menu-item" data-action="sibling">${I.addSibling}<span>兄弟ノード追加</span></button>
    <button type="button" class="node-context-menu-item danger" data-action="delete">${I.delete}<span>ノード削除</span></button>
  `;
  document.body.appendChild(nodeContextMenu);

  positionNodeContextMenu(event?.clientX ?? window.innerWidth / 2, event?.clientY ?? 120);

  nodeContextMenu.addEventListener('click', onNodeContextMenuClick);
  nodeContextMenuCloseHandler = (e) => {
    if (e.key === 'Escape') closeNodeContextMenu();
  };
  document.addEventListener('keydown', nodeContextMenuCloseHandler);

  setTimeout(() => {
    nodeContextMenu?.classList.add('open');
    document.addEventListener('pointerdown', onOutsideContextMenuPointerDown, { capture: true });
  }, 0);
}

function positionNodeContextMenu(x, y) {
  positionFloatingMenu(nodeContextMenu, x, y);
}

function positionFloatingMenu(menuEl, x, y) {
  if (!menuEl) return;
  const margin = 12;
  const rect = menuEl.getBoundingClientRect();
  const left = Math.min(x, window.innerWidth - rect.width - margin);
  const top = Math.min(y, window.innerHeight - rect.height - margin);
  menuEl.style.left = `${Math.max(margin, left)}px`;
  menuEl.style.top = `${Math.max(margin, top)}px`;
}

function onNodeContextMenuClick(e) {
  const btn = e.target.closest?.('.node-context-menu-item');
  if (!btn) return;
  const action = btn.dataset.action;
  if (action === 'connect') {
    startConnect(nodeContextMenuNode);
  } else if (action === 'sidebar') {
    _onOpenSidebar?.(nodeContextMenuNode);
  } else if (action === 'child') {
    _mindMap?.execCommand('INSERT_CHILD_NODE');
  } else if (action === 'sibling') {
    _mindMap?.execCommand('INSERT_BROTHER_NODE');
  } else if (action === 'delete') {
    _mindMap?.execCommand('REMOVE_NODE');
  }
  closeNodeContextMenu();
}

function onOutsideContextMenuPointerDown(e) {
  if (!nodeContextMenu) return;
  if (nodeContextMenu.contains(e.target)) return;
  closeNodeContextMenu();
}

export function closeNodeContextMenu() {
  if (nodeContextMenu) {
    nodeContextMenu.removeEventListener('click', onNodeContextMenuClick);
    nodeContextMenu.remove();
    nodeContextMenu = null;
  }
  nodeContextMenuNode = null;
  if (nodeContextMenuCloseHandler) {
    document.removeEventListener('keydown', nodeContextMenuCloseHandler);
    nodeContextMenuCloseHandler = null;
  }
  document.removeEventListener('pointerdown', onOutsideContextMenuPointerDown, { capture: true });
}

export function openRelationLineContextMenu(event) {
  if (!_mindMap?.associativeLine?.activeLine) return;
  closeNodeContextMenu();
  closeRelationLineContextMenu();
  relationLineContextMenu = document.createElement('div');
  relationLineContextMenu.className = 'line-context-menu';
  relationLineContextMenu.innerHTML = `
    <button type="button" class="line-context-menu-item danger" data-action="delete">${I.delete}<span>関係線を削除</span></button>
  `;
  document.body.appendChild(relationLineContextMenu);
  positionFloatingMenu(relationLineContextMenu, event?.clientX ?? window.innerWidth / 2, event?.clientY ?? 120);
  relationLineContextMenu.addEventListener('click', onRelationLineContextMenuClick);
  relationLineContextMenuCloseHandler = e => {
    if (e.key === 'Escape') closeRelationLineContextMenu();
  };
  document.addEventListener('keydown', relationLineContextMenuCloseHandler);
  setTimeout(() => {
    relationLineContextMenu?.classList.add('open');
    document.addEventListener('pointerdown', onOutsideRelationLineContextMenuPointerDown, { capture: true });
  }, 0);
}

function onRelationLineContextMenuClick(e) {
  const btn = e.target.closest?.('.line-context-menu-item');
  if (!btn) return;
  if (btn.dataset.action === 'delete' && removeActiveRelationLine()) {
    closeRelationLineContextMenu();
  }
}

function onOutsideRelationLineContextMenuPointerDown(e) {
  if (!relationLineContextMenu) return;
  if (relationLineContextMenu.contains(e.target)) return;
  closeRelationLineContextMenu();
}

export function closeRelationLineContextMenu() {
  if (relationLineContextMenu) {
    relationLineContextMenu.removeEventListener('click', onRelationLineContextMenuClick);
    relationLineContextMenu.remove();
    relationLineContextMenu = null;
  }
  if (relationLineContextMenuCloseHandler) {
    document.removeEventListener('keydown', relationLineContextMenuCloseHandler);
    relationLineContextMenuCloseHandler = null;
  }
  document.removeEventListener('pointerdown', onOutsideRelationLineContextMenuPointerDown, { capture: true });
}

function ensureRelationLineQuickDelete() {
  if (relationLineQuickDelete) return relationLineQuickDelete;
  relationLineQuickDelete = document.createElement('button');
  relationLineQuickDelete.type = 'button';
  relationLineQuickDelete.className = 'line-quick-delete';
  relationLineQuickDelete.setAttribute('aria-label', '選択中の関係線を削除');
  relationLineQuickDelete.textContent = '×';
  relationLineQuickDelete.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    removeActiveRelationLine();
  });
  document.body.appendChild(relationLineQuickDelete);
  return relationLineQuickDelete;
}

function hideRelationLineQuickDelete() {
  relationLineQuickDelete?.classList.remove('visible');
}


/* ── Mobile FAB ─────────────────────────────────────────────────── */
export function createFab(mindMapInstance, { onOpenFiles }) {
  const fab = document.createElement('div');
  fab.className = 'fab-container';
  fab.id = 'fabContainer';
  fab.innerHTML = `
    <div class="fab-actions" id="fabActions">
      <button class="fab-action" id="fabFiles"   data-tooltip="マップ一覧">${I.files}</button>
      <button class="fab-action" id="fabFit"     data-tooltip="全体表示">${I.fit}</button>
      <button class="fab-action" id="fabDelete"  data-tooltip="ノード削除">${I.delete}</button>
      <button class="fab-action" id="fabSibling" data-tooltip="兄弟ノード">${I.addSibling}</button>
      <button class="fab-action" id="fabChild"   data-tooltip="子ノード">${I.addChild}</button>
    </div>
    <button class="fab-main" id="fabMain" aria-label="メニューを開く">
      <svg viewBox="0 0 20 20" fill="none" width="24" height="24"><path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
    </button>
  `;
  document.body.appendChild(fab);

  const main    = fab.querySelector('#fabMain');
  const actions = fab.querySelector('#fabActions');
  let open = false;

  main.onclick = () => {
    open = !open;
    main.classList.toggle('open', open);
    actions.classList.toggle('open', open);
  };

  fab.querySelector('#fabChild').onclick   = () => { mindMapInstance?.execCommand('INSERT_CHILD_NODE');   close(); };
  fab.querySelector('#fabSibling').onclick = () => { mindMapInstance?.execCommand('INSERT_BROTHER_NODE'); close(); };
  fab.querySelector('#fabDelete').onclick  = () => { mindMapInstance?.execCommand('REMOVE_NODE');         close(); };
  fab.querySelector('#fabFit').onclick     = () => { mindMapInstance?.execCommand('FIT_CANVAS');          close(); };
  fab.querySelector('#fabFiles').onclick   = () => { onOpenFiles?.(); close(); };

  function close() { open = false; main.classList.remove('open'); actions.classList.remove('open'); }
}

/* ── Export ─────────────────────────────────────────────────────── */
async function handleExport(format) {
  if (!_mindMap?.doExport) { toast.error('エクスポートプラグインが読み込まれていません'); return; }
  try {
    let dataUrl, filename;
    switch (format) {
      case 'png': {
        toast.info('PNG を生成中...');
        dataUrl  = await _mindMap.doExport.png();
        filename = 'mindflow.png';
        break;
      }
      case 'svg': {
        dataUrl  = await _mindMap.doExport.svg();
        filename = 'mindflow.svg';
        break;
      }
      case 'json': {
        dataUrl  = await _mindMap.doExport.json();
        filename = 'mindflow.json';
        break;
      }
      case 'md': {
        dataUrl  = await _mindMap.doExport.md();
        filename = 'mindflow.md';
        break;
      }
      default: toast.error(`未対応フォーマット: ${format}`); return;
    }
    if (dataUrl) download(dataUrl, filename);
    toast.success(`${format.toUpperCase()} を保存しました`);
  } catch (e) {
    console.error(e);
    toast.error(`エクスポートに失敗しました: ${e.message}`);
  }
}

function download(url, name) {
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
}
