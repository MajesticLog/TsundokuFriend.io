/* =========================
   LOOKUP (direct to Jisho)
   - Avoids Worker 525 TLS issues
========================= */

const JISHO_API = (window.TSUNDOKU_CONFIG && window.TSUNDOKU_CONFIG.jishoApi) || "https://jisho.org/api/v1/search/words?keyword=";

document.getElementById('search-input')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') lookupWord();
});

async function lookupWord(queryOverride) {
  const q = (queryOverride ?? document.getElementById('search-input')?.value ?? '').trim();
  if (!q) return;

  const res = document.getElementById('results');
  if (res) res.innerHTML = '<p class="status-msg">Searching…</p>';

  try {
    const r = await fetch(JISHO_API + encodeURIComponent(q));
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    renderResults(data.data || []);
  } catch (e) {
    if (res) {
      res.innerHTML =
        `<p class="status-msg">⚠️ Could not reach Jisho API. Try searching directly: ` +
        `<a href="https://jisho.org/search/${encodeURIComponent(q)}" target="_blank" rel="noreferrer" style="color:var(--accent-stroke)">jisho.org ↗</a></p>`;
    }
  }
}

function renderResults(entries) {
  const res = document.getElementById('results');
  if (!res) return;

  if (!entries.length) {
    res.innerHTML = '<p class="status-msg">No results found.</p>';
    return;
  }

  res.innerHTML = '';
  entries.slice(0, 8).forEach(entry => {
    const word = entry.japanese[0]?.word || entry.japanese[0]?.reading || '';
    const reading = entry.japanese[0]?.reading || '';
    const meanings = entry.senses[0]?.english_definitions?.join('; ') || '';
    const tags = [...(entry.senses[0]?.parts_of_speech || [])].slice(0,2).join(', ');
    const jlpt = entry.jlpt?.[0] || '';

    const div = document.createElement('div');
    div.className = 'result-entry';
    div.innerHTML = `
      <div class="word-header">
        <span class="kanji-large">${escapeHtml(word)}</span>
        <span class="reading">${word !== reading ? escapeHtml(reading) : ''}</span>
        ${jlpt ? `<span class="jlpt-badge">${escapeHtml(jlpt.toUpperCase())}</span>` : ''}
      </div>
      <div class="meanings">${escapeHtml(meanings)}</div>
      ${tags ? `<div class="tags">${escapeHtml(tags)}</div>` : ''}
      <div class="add-btn">
        <select id="bk-${sanitize(word)}" style="max-width:180px">
          ${books.map(b => `<option value="${b.id}">${escapeHtml(b.title)}</option>`).join('')}
          ${books.length === 0 ? '<option disabled>No books yet</option>' : ''}
        </select>
        <button class="btn btn-sm" onclick='addToBook(${JSON.stringify(word)}, ${JSON.stringify(reading)}, ${JSON.stringify(meanings)}, "bk-${sanitize(word)}")'>+ Add</button>
      </div>`;
    res.appendChild(div);
  });
}

function sanitize(s) { return String(s || '').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 16); }

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
