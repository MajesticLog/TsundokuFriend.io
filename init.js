/* =========================
   INIT
========================= */
function initApp() {
  if (typeof hwInit          === 'function') hwInit();
  if (typeof renderBookList  === 'function') renderBookList();
  if (typeof initShelf       === 'function') initShelf();
  if (typeof renderRadicals  === 'function') renderRadicals(); // pre-render while panel hidden

  // Restore quick notes
  const notes = localStorage.getItem('tsundoku-notes');
  const ta    = document.getElementById('quick-notes');
  if (notes && ta) ta.value = notes;
}

if (document.readyState === 'loading')
  document.addEventListener('DOMContentLoaded', initApp);
else
  initApp();

// ── Theme dots ──────────────────────────────────────────
function applyTheme(theme) {
  const t = (theme || 'flowers').toLowerCase();
  if (t === 'flowers') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('tsundoku-theme', t);
  document.querySelectorAll('.theme-dot').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.theme === t)
  );
}

function initThemeDots() {
  applyTheme(localStorage.getItem('tsundoku-theme') || 'flowers');
  document.querySelectorAll('.theme-dot').forEach(btn =>
    btn.addEventListener('click', () => applyTheme(btn.dataset.theme))
  );
}
document.addEventListener('DOMContentLoaded', initThemeDots);
