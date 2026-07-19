export function toast(msg, type = 'inf') {
  const icons = { ok: '✅', err: '❌', inf: 'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type]}</span>${msg}`;
  document.getElementById('toast-box').appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

export function setSyncStatus(s) {
  const dot = document.getElementById('sync-dot');
  const lbl = document.getElementById('sync-label');
  if (!dot) return;
  dot.className = 'sync-dot ' + s;
  lbl.textContent = s === 'synced' ? 'متزامن' : s === 'error' ? 'خطأ' : ' جاري المزامنة';
}

export function setLoadText(t) {
  document.getElementById('ld-text').textContent = t;
}
export function hideLoading() {
  const ov = document.getElementById('loading-overlay');
  ov.classList.add('hidden');
  setTimeout(() => ov.style.display = 'none', 450);
}
