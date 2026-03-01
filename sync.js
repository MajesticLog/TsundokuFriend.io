/* =========================
   SYNC — Backup & Restore
   localStorage is per-browser, so every visitor already has
   their own private data. This lets YOU move YOUR data between
   your own devices via a JSON file.
========================= */

function openSyncPanel() {
  document.getElementById('sync-status').textContent = '';
  document.getElementById('sync-modal').classList.add('open');
}
function closeSyncPanel() {
  document.getElementById('sync-modal').classList.remove('open');
}
document.getElementById('sync-modal')
  .addEventListener('click', e => { if (e.target === e.currentTarget) closeSyncPanel(); });

function exportAllData() {
  const payload = {
    version:    1,
    exported:   new Date().toISOString(),
    shelf:      JSON.parse(localStorage.getItem('tsundoku-shelf')  || '[]'),
    fcScores:   JSON.parse(localStorage.getItem('fc-scores')       || '{}'),
    quickNotes: localStorage.getItem('tsundoku-notes')             || '',
    theme:      localStorage.getItem('tsundoku-theme')             || 'flowers',
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href: url,
    download: `tsundoku-backup-${new Date().toISOString().slice(0,10)}.json`,
  });
  a.click();
  URL.revokeObjectURL(url);
}

async function importAllData(event) {
  const file   = event.target.files[0];
  const status = document.getElementById('sync-status');
  if (!file) return;
  status.textContent = 'Reading…';
  try {
    const payload = JSON.parse(await file.text());
    if (!payload.version || !Array.isArray(payload.shelf))
      throw new Error('Not a valid backup file');

    // Merge shelf — add books that don't exist yet (matched by id)
    const existing = JSON.parse(localStorage.getItem('tsundoku-shelf') || '[]');
    const ids = new Set(existing.map(e => e.id));
    let added = 0;
    for (const e of payload.shelf) { if (!ids.has(e.id)) { existing.push(e); added++; } }
    localStorage.setItem('tsundoku-shelf', JSON.stringify(existing));

    // Merge fc-scores — keep higher ease value per word
    const scores = JSON.parse(localStorage.getItem('fc-scores') || '{}');
    for (const [w, s] of Object.entries(payload.fcScores || {}))
      if (!scores[w] || s.ease > scores[w].ease) scores[w] = s;
    localStorage.setItem('fc-scores', JSON.stringify(scores));

    // Notes — append if new
    if (payload.quickNotes) {
      const cur = localStorage.getItem('tsundoku-notes') || '';
      if (!cur.includes(payload.quickNotes.slice(0, 40)))
        localStorage.setItem('tsundoku-notes',
          cur ? cur + '\n\n— imported —\n' + payload.quickNotes : payload.quickNotes);
      const ta = document.getElementById('quick-notes');
      if (ta) ta.value = localStorage.getItem('tsundoku-notes');
    }

    // Theme
    if (payload.theme && typeof applyTheme === 'function') applyTheme(payload.theme);

    // Refresh UI
    if (typeof renderShelf         === 'function') { renderShelf(); renderShelfDetail?.(); }
    if (typeof showFlashcardsSetup === 'function') showFlashcardsSetup();

    status.textContent = `✓ Imported ${added} new book${added !== 1 ? 's' : ''}.`;
    event.target.value = '';
  } catch (e) {
    status.textContent = '⚠ ' + e.message;
  }
}

window.openSyncPanel  = openSyncPanel;
window.closeSyncPanel = closeSyncPanel;
window.exportAllData  = exportAllData;
window.importAllData  = importAllData;
