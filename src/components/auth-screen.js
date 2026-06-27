import { login } from '../auth/github-oauth.js';
import { APP_NAME } from '../utils/constants.js';

/** Renders the full-screen GitHub login screen and wires the button. */
export function mountAuthScreen(container, { onError } = {}) {
  const screen = document.createElement('div');
  screen.className = 'auth-screen';
  screen.id = 'authScreen';
  screen.innerHTML = `
    <div class="auth-card">
      <span class="auth-logo" aria-hidden="true">🧠</span>
      <h1 class="auth-title">${APP_NAME}</h1>
      <p class="auth-subtitle">
        個人用マインドマップツール<br>
        GitHub アカウントでログインしてください
      </p>
      <button class="auth-btn" id="githubLoginBtn" type="button">
        <svg viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path fill-rule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 10 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 20 10.017C20 4.484 15.522 0 10 0z" clip-rule="evenodd"/>
        </svg>
        GitHub でログイン
      </button>
      <div class="auth-error" id="authError"></div>
      <p class="auth-note">
        ⚡ データはあなたの GitHub プライベートリポジトリに保存されます<br>
        🔒 ログイン情報は外部サーバーに送信されません
      </p>
    </div>
  `;

  container.appendChild(screen);

  // Show error if redirected back with ?error=…
  const hash  = new URLSearchParams(location.hash.slice(1));
  const qstr  = new URLSearchParams(location.search);
  const errMsg = hash.get('error') || qstr.get('error');
  if (errMsg) {
    showError(screen, decodeURIComponent(errMsg));
    history.replaceState(null, '', location.pathname);
    if (onError) onError(errMsg);
  }

  screen.querySelector('#githubLoginBtn').addEventListener('click', () => {
    login();
  });

  return {
    remove: () => screen.remove(),
    showError: (msg) => showError(screen, msg),
  };
}

function showError(screen, msg) {
  const el = screen.querySelector('#authError');
  if (!el) return;
  el.textContent = `ログインエラー: ${msg}`;
  el.classList.add('visible');
}
