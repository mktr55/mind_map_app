import { STORAGE_KEYS } from '../utils/constants.js';

/* ------------------------------------------------------------------
 * Theme definitions for simple-mind-map + CSS variable system
 * ------------------------------------------------------------------ */

export const DARK_MIND_MAP_THEME = {
  template: 'default',
  config: {
    backgroundColor: '#0d1117',
    lineColor: '#30363d',
    lineWidth: 2,
    associativeLineWidth: 2,
    associativeLineColor: '#48d364',
    associativeLineActiveWidth: 16,
    associativeLineActiveColor: '#8cff98',
    associativeLineDasharray: '2,4',
    associativeLineTextColor: '#48d364',
    associativeLineTextFontSize: 14,
    associativeLineTextLineHeight: 1.2,
    associativeLineTextFontFamily: 'Inter, sans-serif',
    root: {
      fillColor: '#7c5cfc',
      color: '#ffffff',
      borderColor: 'transparent',
      borderWidth: 0,
      fontSize: 18,
      fontWeight: 'bold',
      fontFamily: 'Inter, sans-serif',
      borderRadius: 12,
      paddingX: 24,
      paddingY: 14,
    },
    second: {
      fillColor: '#21262d',
      color: '#e6edf3',
      borderColor: '#30363d',
      borderWidth: 1,
      fontSize: 15,
      fontWeight: '500',
      fontFamily: 'Inter, sans-serif',
      borderRadius: 8,
      paddingX: 18,
      paddingY: 10,
      marginX: 60,
      marginY: 20,
    },
    node: {
      fillColor: '#161b22',
      color: '#8b949e',
      borderColor: '#21262d',
      borderWidth: 1,
      fontSize: 14,
      fontFamily: 'Inter, sans-serif',
      borderRadius: 6,
      paddingX: 14,
      paddingY: 8,
      marginX: 40,
      marginY: 10,
    },
  },
};

export const LIGHT_MIND_MAP_THEME = {
  template: 'default',
  config: {
    backgroundColor: '#f6f8fa',
    lineColor: '#d0d7de',
    lineWidth: 2,
    associativeLineWidth: 2,
    associativeLineColor: '#2da44e',
    associativeLineActiveWidth: 16,
    associativeLineActiveColor: '#54dd6f',
    associativeLineDasharray: '2,4',
    associativeLineTextColor: '#2da44e',
    associativeLineTextFontSize: 14,
    associativeLineTextLineHeight: 1.2,
    associativeLineTextFontFamily: 'Inter, sans-serif',
    root: {
      fillColor: '#6c4de6',
      color: '#ffffff',
      borderColor: 'transparent',
      borderWidth: 0,
      fontSize: 18,
      fontWeight: 'bold',
      fontFamily: 'Inter, sans-serif',
      borderRadius: 12,
      paddingX: 24,
      paddingY: 14,
    },
    second: {
      fillColor: '#ffffff',
      color: '#1f2328',
      borderColor: '#d0d7de',
      borderWidth: 1,
      fontSize: 15,
      fontWeight: '500',
      fontFamily: 'Inter, sans-serif',
      borderRadius: 8,
      paddingX: 18,
      paddingY: 10,
      marginX: 60,
      marginY: 20,
    },
    node: {
      fillColor: '#f6f8fa',
      color: '#656d76',
      borderColor: '#d0d7de',
      borderWidth: 1,
      fontSize: 14,
      fontFamily: 'Inter, sans-serif',
      borderRadius: 6,
      paddingX: 14,
      paddingY: 8,
      marginX: 40,
      marginY: 10,
    },
  },
};

export function getThemePreference() {
  return localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
}

export function setThemePreference(theme) {
  localStorage.setItem(STORAGE_KEYS.THEME, theme);
  document.documentElement.setAttribute('data-theme', theme);
}

export function toggleTheme() {
  const next = getThemePreference() === 'dark' ? 'light' : 'dark';
  setThemePreference(next);
  return next;
}

export function getMindMapTheme(theme) {
  return theme === 'dark' ? DARK_MIND_MAP_THEME : LIGHT_MIND_MAP_THEME;
}

export function initTheme() {
  const theme = getThemePreference();
  document.documentElement.setAttribute('data-theme', theme);
  return theme;
}
