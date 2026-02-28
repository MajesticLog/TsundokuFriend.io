/* =========================
   LOOKUP (via Cloudflare Worker)
   IMPORTANT: your worker URL must accept ?keyword=
========================= */
document.getElementById('search-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') lookupWord();
});

// Your minireader worker:
const JISHO_ENDPOINT = "https://minireader.zoe-caudron.workers.dev/?keyword=";

async function lookupWord() {
  const q = document.getElementById('search-input').value.trim();
  if (!q) return;
  const res = document.getElementById('results');
  res.innerHTML = '<p class="status-msg">Searching…</p>';
  try {
    const r = await fetch(JISHO_ENDPOINT + encodeURIComponent(q));
    if (!r.ok) throw new Error("HTTP " + r.status);
    const data = await r.json();
    renderResults(data.data || []);
  } catch (e) {
    res.innerHTML = `<p class="status-msg">⚠️ Could not reach the dictionary. Try searching directly:
      <a href="https://jisho.org/search/${encodeURIComponent(q)}" target="_blank" rel="noopener" style="color:var(--red)">jisho.org ↗</a></p>`;
  }
}

function renderResults(entries) {
  const res = document.getElementById('results');
  if (!entries.length) { res.innerHTML = '<p class="status-msg">No results found.</p>'; return; }
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
        <span class="kanji-large">${escapeHTML(word)}</span>
        <span class="reading">${word !== reading ? escapeHTML(reading) : ''}</span>
        ${jlpt ? `<span class="jlpt-badge">${escapeHTML(jlpt.toUpperCase())}</span>` : ''}
      </div>
      <div class="meanings">${escapeHTML(meanings)}</div>
      ${tags ? `<div class="tags">${escapeHTML(tags)}</div>` : ''}
      <div class="add-btn">
        <select id="bk-${sanitize(word)}" style="max-width:160px">
          ${books.map(b => `<option value="${b.id}">${escapeHTML(b.title)}</option>`).join('')}
          ${books.length === 0 ? '<option disabled>No books yet</option>' : ''}
        </select>
        <button class="btn btn-sm">+ Add to List</button>
      </div>`;
    const btn = div.querySelector('button');
    btn.addEventListener('click', () => addToBook(word, reading, meanings, `bk-${sanitize(word)}`));
    res.appendChild(div);
  });
}

function sanitize(s) { return String(s).replace(/[^a-zA-Z0-9]/g, '_').slice(0,16); }
function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}

function addToBook(word, reading, meaning, selectId) {
  const sel = document.getElementById(selectId);
  if (!sel || !sel.value) { alert('Create a book first in the Word Lists tab.'); return; }
  const bookId = sel.value;
  const book = books.find(b => b.id === bookId);
  if (!book) return;
  if (book.words.some(w => w.word === word)) { showToast('Already in list!'); return; }
  book.words.push({ word, reading, meaning, added: Date.now() });
  saveBooks();
  showToast(`Added ${word} to "${book.title}"`);
}

function showToast(msg) {
  let t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1a1410;color:#f5f0e8;padding:10px 20px;border-radius:2px;font-family:Crimson Pro,serif;font-size:0.95rem;z-index:999;animation:fadeIn 0.2s';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2000);
}
