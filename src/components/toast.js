/**
 * Toast notification system.
 * Usage: toast.success('保存しました'), toast.error('エラー'), toast.info('情報')
 */

let container = null;

function getContainer() {
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    container.id = 'toastContainer';
    document.body.appendChild(container);
  }
  return container;
}

const ICONS = {
  success: `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.2"/><path d="M5.5 8.5l1.5 1.5 3.5-3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  error:   `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.2"/><path d="M8 5v3.5M8 10.5v.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
  info:    `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.2"/><path d="M8 7v4M8 5.5v.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
};

export function showToast(message, type = 'info', duration = 3200) {
  const cont  = getContainer();
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon" style="flex-shrink:0;width:16px;height:16px;">${ICONS[type] || ICONS.info}</span><span class="toast-message">${message}</span>`;
  cont.appendChild(toast);

  const timer = setTimeout(() => dismiss(toast), duration);
  toast.addEventListener('click', () => { clearTimeout(timer); dismiss(toast); });
}

function dismiss(el) {
  el.classList.add('hiding');
  el.addEventListener('animationend', () => el.remove(), { once: true });
}

export const toast = {
  success: (msg, d) => showToast(msg, 'success', d),
  error:   (msg, d) => showToast(msg, 'error',   d ?? 5000),
  info:    (msg, d) => showToast(msg, 'info',     d),
};
