import { getMapsIndex, generateId, deleteMindMap } from '../storage/local.js';
import { APP_NAME } from '../utils/constants.js';
import { toast } from './toast.js';

/* ------------------------------------------------------------------ */

const ICONS = {
  close: `<svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  plus:  `<svg viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  importIcon: `<svg viewBox="0 0 16 16" fill="none"><path d="M8 2v8m0 0L5 7m3 3 3-3M3 13h10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  file:  `<svg viewBox="0 0 16 16" fill="none"><path d="M4 2h5l3 3v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" stroke="currentColor" stroke-width="1.2"/><path d="M9 2v3h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`,
  trash: `<svg viewBox="0 0 16 16" fill="none"><path d="M5.5 2h5M2.5 4.5h11M6 4.5v7.5M10 4.5v7.5M3.5 4.5l.5 8a1 1 0 0 0 1 .5h6a1 1 0 0 0 1-.5l.5-8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

let panel, backdrop;
let _onSelect, _onCreate, _onDelete, _onImport;

/** Mount the file manager panel in the DOM. */
export function createFileManager({ onSelect, onCreate, onDelete, onImport }) {
  _onSelect = onSelect;
  _onCreate = onCreate;
  _onDelete = onDelete;
  _onImport = onImport;

  // Backdrop
  backdrop = document.createElement('div');
  backdrop.className = 'backdrop';
  backdrop.id = 'fmBackdrop';
  backdrop.addEventListener('click', close);
  document.body.appendChild(backdrop);

  // Panel
  panel = document.createElement('div');
  panel.className = 'file-manager';
  panel.id = 'fileManager';
  panel.innerHTML = `
    <div class="sidebar-header">
      <span class="sidebar-title">${APP_NAME}</span>
      <button class="btn-icon" id="fmClose" aria-label="閉じる">${ICONS.close}</button>
    </div>
    <div class="file-manager-actions">
      <button class="btn btn-primary btn-block" id="fmNewBtn" style="gap:6px">
        ${ICONS.plus} 新しいマインドマップ
      </button>
      <button class="btn btn-block btn-ghost" id="fmImportBtn" style="gap:6px">
        ${ICONS.importIcon} JSON インポート
      </button>
    </div>
    <div class="file-list" id="fmList"></div>
    <input type="file" id="fmImportInput" accept=".json" style="display:none">
  `;
  document.body.appendChild(panel);

  panel.querySelector('#fmClose').addEventListener('click', close);
  panel.querySelector('#fmNewBtn').addEventListener('click', handleNew);
  panel.querySelector('#fmImportBtn').addEventListener('click', () => panel.querySelector('#fmImportInput').click());
  panel.querySelector('#fmImportInput').addEventListener('change', handleImport);

  return { open, close, refresh: (activeId) => renderList(activeId) };
}

function open() {
  renderList();
  panel.classList.add('open');
  backdrop.classList.add('visible');
}

function close() {
  panel.classList.remove('open');
  backdrop.classList.remove('visible');
}

function renderList(activeId) {
  const list    = panel.querySelector('#fmList');
  const current = activeId ?? localStorage.getItem('mindflow-current-map');
  const maps    = getMapsIndex();

  if (!maps.length) {
    list.innerHTML = `<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:32px 16px;line-height:1.6">
      まだマインドマップがありません。<br>新しく作成してみましょう！</p>`;
    return;
  }

  list.innerHTML = maps.map(m => `
    <div class="file-item ${m.id === current ? 'active' : ''}" data-id="${m.id}" role="button" tabindex="0">
      <span class="file-item-icon">${ICONS.file}</span>
      <div class="file-item-info">
        <span class="file-item-title">${esc(m.title)}</span>
        <span class="file-item-date">${relativeDate(m.updatedAt)}</span>
      </div>
      <button class="btn-icon file-item-delete" data-id="${m.id}" aria-label="削除">${ICONS.trash}</button>
    </div>
  `).join('');

  list.querySelectorAll('.file-item').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.closest('.file-item-delete')) return;
      _onSelect?.(el.dataset.id);
      close();
    });
    el.addEventListener('keydown', e => { if (e.key === 'Enter') el.click(); });
  });

  list.querySelectorAll('.file-item-delete').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id  = btn.dataset.id;
      const map = maps.find(m => m.id === id);
      if (!confirm(`「${map?.title || 'このマップ'}」を削除しますか？`)) return;
      deleteMindMap(id);
      _onDelete?.(id);
      renderList();
      toast.success('マインドマップを削除しました');
    });
  });
}

function handleNew() {
  const id    = generateId();
  const title = '新しいマインドマップ';
  _onCreate?.(id, title);
  close();
}

function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = evt => {
    try {
      const raw = JSON.parse(evt.target.result);
      // Support both raw node tree and { root: ... } wrappers
      const data  = raw?.root ?? raw;
      const title = data?.data?.text ?? 'インポート';
      if (!data?.data?.text) { toast.error('無効なマインドマップファイルです'); return; }
      _onImport?.(generateId(), title, data);
      close();
      toast.success('インポートしました');
    } catch { toast.error('JSONの読み込みに失敗しました'); }
  };
  reader.readAsText(file);
  e.target.value = '';
}

// ── Helpers ─────────────────────────────────────────────────────────
function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function relativeDate(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso);
  if (diff < 60e3)   return 'たった今';
  if (diff < 3600e3) return `${Math.floor(diff / 60e3)}分前`;
  if (diff < 86400e3)return `${Math.floor(diff / 3600e3)}時間前`;
  if (diff < 604800e3)return `${Math.floor(diff / 86400e3)}日前`;
  return new Date(iso).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
}
