import { STORAGE_KEYS } from '../utils/constants.js';

/** Generate a unique map ID */
export function generateId() {
  return 'map-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

/** Return the saved index array (sorted newest-first) */
export function getMapsIndex() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.MAPS_INDEX) || '[]');
  } catch { return []; }
}

function setMapsIndex(index) {
  localStorage.setItem(STORAGE_KEYS.MAPS_INDEX, JSON.stringify(index));
}

/** Persist a full mind map. Returns the stored payload. */
export function saveMindMap(id, title, data) {
  const payload = { id, title, data, updatedAt: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEYS.MAP_PREFIX + id, JSON.stringify(payload));

  const index = getMapsIndex();
  const i = index.findIndex(m => m.id === id);
  const meta = { id, title, updatedAt: payload.updatedAt };
  if (i >= 0) index[i] = meta; else index.unshift(meta);
  setMapsIndex(index);
  return payload;
}

/** Load a single mind map by ID. Returns null if not found. */
export function loadMindMap(id) {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.MAP_PREFIX + id) || 'null');
  } catch { return null; }
}

/** Remove a mind map and its view state. */
export function deleteMindMap(id) {
  localStorage.removeItem(STORAGE_KEYS.MAP_PREFIX + id);
  localStorage.removeItem(STORAGE_KEYS.VIEW_PREFIX + id);
  setMapsIndex(getMapsIndex().filter(m => m.id !== id));
}

/** Rename a mind map without changing its data. */
export function renameMindMap(id, newTitle) {
  const saved = loadMindMap(id);
  if (!saved) return;
  saved.title     = newTitle;
  saved.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEYS.MAP_PREFIX + id, JSON.stringify(saved));
  const index = getMapsIndex();
  const i = index.findIndex(m => m.id === id);
  if (i >= 0) { index[i].title = newTitle; index[i].updatedAt = saved.updatedAt; }
  setMapsIndex(index);
}

/** Persist the viewport state (zoom + pan position) for a map. */
export function saveViewState(id, viewData) {
  localStorage.setItem(STORAGE_KEYS.VIEW_PREFIX + id, JSON.stringify(viewData));
}

/** Restore the viewport state for a map. Returns null if not found. */
export function loadViewState(id) {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.VIEW_PREFIX + id) || 'null');
  } catch { return null; }
}

export function getCurrentMapId() { return localStorage.getItem(STORAGE_KEYS.CURRENT_MAP); }
export function setCurrentMapId(id) { localStorage.setItem(STORAGE_KEYS.CURRENT_MAP, id); }
