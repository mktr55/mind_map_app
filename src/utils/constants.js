// App constants
export const APP_NAME = 'MindFlow';
export const APP_VERSION = '1.0.0';

// localStorage keys
export const STORAGE_KEYS = {
  MAPS_INDEX:   'mindflow-maps-index',
  MAP_PREFIX:   'mindflow-map-',
  VIEW_PREFIX:  'mindflow-view-',
  CURRENT_MAP:  'mindflow-current-map',
  THEME:        'mindmap-theme',
  AUTH_TOKEN:   'mindflow-auth-token',
  AUTH_USER:    'mindflow-auth-user',
  GITHUB_REPO:  'mindflow-github-repo',
  GITHUB_PATH:  'mindflow-github-path',
  SETTINGS:     'mindflow-settings',
  OAUTH_STATE:  'mindflow-oauth-state',
};

// GitHub API
export const GITHUB_API_BASE  = 'https://api.github.com';
export const GITHUB_OAUTH_URL = 'https://github.com/login/oauth/authorize';
export const GITHUB_OAUTH_SCOPE = 'repo';

// Default mind map data
export function makeDefaultMapData() {
  const ts = Date.now();
  return {
    data: { text: '新しいマインドマップ', expand: true, uid: `root-${ts}` },
    children: [
      { data: { text: 'アイデア 1', expand: true, uid: `c1-${ts}` }, children: [] },
      { data: { text: 'アイデア 2', expand: true, uid: `c2-${ts}` }, children: [] },
      { data: { text: 'アイデア 3', expand: true, uid: `c3-${ts}` }, children: [] },
    ],
  };
}

// Debounce timing
export const DEBOUNCE_LOCAL_SAVE_MS  = 800;
export const DEBOUNCE_REMOTE_SYNC_MS = 5000;
export const DEBOUNCE_REMOTE_MAX_MS  = 15000;

// Layout options
export const LAYOUTS = [
  { id: 'logicalStructure',    label: 'ツリー',       icon: '🌲' },
  { id: 'mindMap',             label: 'マインドマップ', icon: '🧠' },
  { id: 'organizationStructure', label: '組織図',     icon: '🏢' },
  { id: 'catalogOrganization', label: 'カタログ',     icon: '📋' },
];

// Export formats
export const EXPORT_FORMATS = [
  { id: 'json', label: 'JSON',     icon: '📄' },
  { id: 'png',  label: 'PNG 画像', icon: '🖼️' },
  { id: 'svg',  label: 'SVG',      icon: '🎨' },
  { id: 'md',   label: 'Markdown', icon: '📝' },
];
