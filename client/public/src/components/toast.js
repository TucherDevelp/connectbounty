// ── Toast System ──────────────────────────────────
const Toast = (() => {
  const ICONS = { success: '✅', error: '❌', info: '🍬', warning: '⚠️' };

  function show(type, title, body = '', duration = 4000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <div class="toast-icon">${ICONS[type] || 'ℹ️'}</div>
      <div class="toast-text">
        <div class="toast-title">${title}</div>
        ${body ? `<div class="toast-body">${body}</div>` : ''}
      </div>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('hiding');
      setTimeout(() => toast.remove(), 350);
    }, duration);
  }

  return {
    success: (title, body) => show('success', title, body),
    error: (title, body) => show('error', title, body),
    info: (title, body) => show('info', title, body),
    warning: (title, body) => show('warning', title, body),
  };
})();
