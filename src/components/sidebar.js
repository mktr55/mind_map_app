import { toast } from './toast.js';

/* ------------------------------------------------------------------
 * Sidebar – Node detail panel (right side).
 * Opens when a node is selected; closes when deselected.
 * ------------------------------------------------------------------ */

const COLORS = [
  '#7c5cfc','#3b82f6','#10b981','#f59e0b','#ef4444',
  '#ec4899','#06b6d4','#84cc16','#f97316','#8b5cf6',
  '#ffffff','#e6edf3','#8b949e','#21262d','#0d1117',
];

const ICONS = {
  close: `<svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  link:  `<svg viewBox="0 0 16 16" fill="none"><path d="M6.5 9.5a3.5 3.5 0 0 0 5 0l2-2a3.5 3.5 0 0 0-5-5L7 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M9.5 6.5a3.5 3.5 0 0 0-5 0l-2 2a3.5 3.5 0 0 0 5 5L9 12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
};

let panel, backdrop, _mindMap;
let currentNode = null;

export function createSidebar(mindMapInstance) {
  _mindMap = mindMapInstance;

  // Backdrop (mobile)
  backdrop = document.createElement('div');
  backdrop.className = 'backdrop';
  backdrop.id = 'sidebarBackdrop';
  backdrop.addEventListener('click', closeSidebar);
  document.body.appendChild(backdrop);

  // Panel
  panel = document.createElement('div');
  panel.className = 'sidebar';
  panel.id = 'nodeSidebar';
  panel.innerHTML = `
    <div class="sidebar-header">
      <span class="sidebar-title">ノード設定</span>
      <button class="btn-icon" id="sidebarClose" aria-label="閉じる">${ICONS.close}</button>
    </div>
    <div class="sidebar-content" id="sidebarContent">
      <div class="sidebar-section">
        <div class="sidebar-label">テキスト</div>
        <textarea class="sidebar-input sidebar-textarea" id="nodeText" rows="3" placeholder="ノードのテキスト"></textarea>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-label">背景色</div>
        <div class="color-row" id="bgColorRow"></div>
        <input type="color" id="bgColorPicker" style="margin-top:8px" title="カスタム色">
      </div>

      <div class="sidebar-section">
        <div class="sidebar-label">文字色</div>
        <div class="color-row" id="fgColorRow"></div>
        <input type="color" id="fgColorPicker" style="margin-top:8px" title="カスタム色">
      </div>

      <div class="sidebar-section">
        <div class="sidebar-label">フォントサイズ</div>
        <select class="sidebar-input" id="fontSizeSelect">
          ${[10,12,13,14,16,18,20,24,28,32].map(s => `<option value="${s}">${s}px</option>`).join('')}
        </select>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-label">リンク</div>
        <input type="url" class="sidebar-input" id="nodeLink" placeholder="https://...">
      </div>

      <div class="sidebar-section">
        <div class="sidebar-label">メモ</div>
        <textarea class="sidebar-input sidebar-textarea" id="nodeNote" rows="4" placeholder="ノートを追加..."></textarea>
      </div>

      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn btn-primary" id="applyNodeBtn" style="flex:1">適用</button>
        <button class="btn btn-ghost" id="sidebarCloseBtn" style="flex:1">閉じる</button>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  // Render color swatches
  renderSwatches('bgColorRow', 'bg');
  renderSwatches('fgColorRow', 'fg');

  // Wire events
  panel.querySelector('#sidebarClose').addEventListener('click', closeSidebar);
  panel.querySelector('#sidebarCloseBtn').addEventListener('click', closeSidebar);
  panel.querySelector('#applyNodeBtn').addEventListener('click', applyChanges);

  // Apply on Enter in text
  panel.querySelector('#nodeText').addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) applyChanges();
  });

  return { open: openSidebar, close: closeSidebar };
}

function openSidebar(node) {
  currentNode = node;
  const d = node?.data?.data ?? {};

  panel.querySelector('#nodeText').value     = d.text ?? '';
  panel.querySelector('#nodeLink').value     = d.hyperlink ?? '';
  panel.querySelector('#nodeNote').value     = d.note ?? '';
  const fsSel = panel.querySelector('#fontSizeSelect');
  fsSel.value = d.fontSize ?? '14';

  panel.querySelector('#bgColorPicker').value = d.fillColor || '#21262d';
  panel.querySelector('#fgColorPicker').value = d.color     || '#e6edf3';
  updateActiveSwatches(d.fillColor, d.color);

  panel.classList.add('open');
  backdrop.classList.add('visible');
  panel.querySelector('#nodeText').focus();
}

function closeSidebar() {
  currentNode = null;
  panel.classList.remove('open');
  backdrop.classList.remove('visible');
}

function applyChanges() {
  if (!currentNode || !_mindMap) return;
  const text     = panel.querySelector('#nodeText').value.trim();
  const link     = panel.querySelector('#nodeLink').value.trim();
  const note     = panel.querySelector('#nodeNote').value;
  const fontSize = parseInt(panel.querySelector('#fontSizeSelect').value, 10);
  const fillColor= panel.querySelector('#bgColorPicker').value;
  const color    = panel.querySelector('#fgColorPicker').value;

  if (!text) { toast.error('テキストを入力してください'); return; }

  // Update text
  _mindMap.execCommand('SET_NODE_TEXT', currentNode, text);
  // Update styles
  _mindMap.execCommand('SET_NODE_STYLE', currentNode, 'fillColor', fillColor);
  _mindMap.execCommand('SET_NODE_STYLE', currentNode, 'color', color);
  _mindMap.execCommand('SET_NODE_STYLE', currentNode, 'fontSize', fontSize);
  // Update hyperlink
  if (link) {
    _mindMap.execCommand('SET_NODE_HYPERLINK', currentNode, link);
  }
  // Update note
  _mindMap.execCommand('SET_NODE_NOTE', currentNode, note);

  toast.success('ノードを更新しました');
  closeSidebar();
}

function renderSwatches(containerId, type) {
  const row = panel.querySelector(`#${containerId}`);
  row.innerHTML = COLORS.map(c => `
    <span class="color-swatch" data-color="${c}" data-type="${type}"
          style="background:${c};border:2px solid ${c === '#ffffff' ? '#484f58' : 'transparent'}"
          title="${c}" role="button" tabindex="0">
    </span>
  `).join('');

  row.querySelectorAll('.color-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      const picker = type === 'bg' ? '#bgColorPicker' : '#fgColorPicker';
      panel.querySelector(picker).value = sw.dataset.color;
      updateActiveSwatches(
        type === 'bg' ? sw.dataset.color : panel.querySelector('#bgColorPicker').value,
        type === 'fg' ? sw.dataset.color : panel.querySelector('#fgColorPicker').value,
      );
    });
  });
}

function updateActiveSwatches(bg, fg) {
  panel.querySelectorAll('#bgColorRow .color-swatch').forEach(s => {
    s.classList.toggle('active', s.dataset.color === bg);
  });
  panel.querySelectorAll('#fgColorRow .color-swatch').forEach(s => {
    s.classList.toggle('active', s.dataset.color === fg);
  });
}
