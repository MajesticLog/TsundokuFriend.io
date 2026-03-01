/* =========================
   SYNC — Backup & Restore
   Export/import all localStorage data as a single JSON file.
   This is the recommended approach for a static GitHub Pages site.
========================= */

function openSyncPanel() {
  document.getElementById('sync-status').textContent = '';
  document.getElementById('sync-modal').classList.add('open');
}
function closeSyncPanel() {
  document.getElementById('sync-modal').classList.remove('open');
}

// Close on backdrop click
document.getElementById('sync-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeSyncPanel();
});

function exportAllData() {
  const payload = {
    version: 1,
    exported: new Date().toISOString(),
    shelf:     JSON.parse(localStorage.getItem('tsundoku-shelf')   || '[]'),
    fcScores:  JSON.parse(localStorage.getItem('fc-scores')        || '{}'),
    quickNotes: localStorage.getItem('tsundoku-notes')             || '',
    theme:      localStorage.getItem('tsundoku-theme')             || 'flowers',
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href     = url;
  a.download = `tsundoku-backup-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importAllData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const status = document.getElementById('sync-status');
  status.textContent = 'Reading file…';

  try {
    const text    = await file.text();
    const payload = JSON.parse(text);

    if (!payload.version || !Array.isArray(payload.shelf)) {
      status.textContent = '⚠ Invalid backup file.';
      return;
    }

    // Merge shelf entries (keep existing, add new ones by id)
    const existing = JSON.parse(localStorage.getItem('tsundoku-shelf') || '[]');
    const existIds = new Set(existing.map(e => e.id));
    const merged   = [...existing];
    let added = 0;
    for (const entry of payload.shelf) {
      if (!existIds.has(entry.id)) { merged.push(entry); added++; }
    }
    localStorage.setItem('tsundoku-shelf', JSON.stringify(merged));

    // Merge fc-scores (keep higher ease score per word)
    const existScores = JSON.parse(localStorage.getItem('fc-scores') || '{}');
    for (const [word, score] of Object.entries(payload.fcScores || {})) {
      if (!existScores[word] || score.ease > existScores[word].ease) {
        existScores[word] = score;
      }
    }
    localStorage.setItem('fc-scores', JSON.stringify(existScores));

    // Notes: append if different
    if (payload.quickNotes) {
      const existNotes = localStorage.getItem('tsundoku-notes') || '';
      if (!existNotes.includes(payload.quickNotes.slice(0, 40))) {
        localStorage.setItem('tsundoku-notes', existNotes
          ? existNotes + '\n\n— imported —\n' + payload.quickNotes
          : payload.quickNotes);
      }
    }

    // Theme
    if (payload.theme && typeof applyTheme === 'function') applyTheme(payload.theme);

    // Refresh UI
    if (typeof renderShelf          === 'function') renderShelf();
    if (typeof showFlashcardsSetup  === 'function') showFlashcardsSetup();

    status.textContent = `✓ Imported ${added} new book${added !== 1 ? 's' : ''} successfully.`;

    // Reset file input so same file can be re-imported if needed
    event.target.value = '';

  } catch (e) {
    status.textContent = '⚠ Could not read file: ' + e.message;
  }
}

window.openSyncPanel  = openSyncPanel;
window.closeSyncPanel = closeSyncPanel;
window.exportAllData  = exportAllData;
window.importAllData  = importAllData;
