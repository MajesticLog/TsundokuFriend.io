/* =========================
   FLASHCARDS
   Reads from tsundoku-shelf (Books tab) — each entry has a vocab[] array.
   Supports study by book, JLPT level, or WK level.
========================= */

let fc = {
  deck: [], queue: [], current: null, idx: 0, flipped: false,
  mode: 'kanji-to-meaning',
  stats: { again: 0, hard: 0, good: 0, easy: 0 },
  againWords: [], selectedBooks: new Set(),
  source: 'book',          // 'book' | 'jlpt' | 'wk'
  selectedLevels: new Set(),
};

function _shelf() {
  try { return JSON.parse(localStorage.getItem('tsundoku-shelf') || '[]'); }
  catch(_) { return []; }
}

/* ── All vocab across shelf ─────────────────────── */
function _allVocab() {
  return _shelf().flatMap(e => (e.vocab || []).map(w => ({ ...w, bookId: e.id, bookTitle: e.title })));
}

/* ── Parse JLPT level to sortable number ─────────── */
function _jlptNum(jlpt) {
  if (!jlpt) return 99;
  const m = String(jlpt).match(/n?(\d)/i);
  return m ? +m[1] : 99;
}

/* ── Setup panel ─────────────────────────────────── */
function showFlashcardsSetup() {
  const grid = document.getElementById('fc-book-grid');
  if (!grid) return;

  // Render source selector state
  _updateSourceUI();

  if (fc.source === 'book') {
    _renderBookPicker(grid);
  } else if (fc.source === 'jlpt') {
    _renderJlptPicker(grid);
  } else if (fc.source === 'wk') {
    _renderWkPicker(grid);
  }
}

function _updateSourceUI() {
  document.querySelectorAll('.fc-source-btn').forEach(b => {
    b.classList.toggle('selected', b.dataset.source === fc.source);
  });
  // Update the label next to the picker
  const label = document.querySelector('#fc-source-row > label');
  if (label) {
    const labels = { book: 'Books', jlpt: 'JLPT Level', wk: 'WK Level' };
    label.textContent = labels[fc.source] || 'Books';
  }
}

function fcSetSource(source) {
  fc.source = source;
  fc.selectedBooks.clear();
  fc.selectedLevels.clear();
  showFlashcardsSetup();
}

function _renderBookPicker(grid) {
  const shelf = _shelf().filter(e => e.vocab?.length > 0);
  if (!shelf.length) {
    grid.innerHTML = '<p class="status-msg">No vocab yet — look up words and add them to a book first.</p>';
    return;
  }
  grid.innerHTML = '';
  shelf.forEach(entry => {
    const btn = document.createElement('button');
    btn.className = 'fc-book-opt' + (fc.selectedBooks.has(entry.id) ? ' selected' : '');
    btn.innerHTML = `${_esc(entry.title)} <span style="font-size:0.75rem;opacity:0.6">(${entry.vocab.length})</span>`;
    btn.onclick = () => {
      fc.selectedBooks.has(entry.id) ? fc.selectedBooks.delete(entry.id) : fc.selectedBooks.add(entry.id);
      btn.classList.toggle('selected');
    };
    grid.appendChild(btn);
  });
}

function _renderJlptPicker(grid) {
  const all = _allVocab();
  // Count words per JLPT level
  const counts = {};
  all.forEach(w => {
    const lvl = _jlptTag(w.jlpt);
    if (lvl) counts[lvl] = (counts[lvl] || 0) + 1;
  });
  const noLevel = all.filter(w => !_jlptTag(w.jlpt)).length;

  const levels = ['N5', 'N4', 'N3', 'N2', 'N1'];
  if (!Object.keys(counts).length && !noLevel) {
    grid.innerHTML = '<p class="status-msg">No words with JLPT tags found. Tags are added automatically from Jisho lookups.</p>';
    return;
  }

  grid.innerHTML = '';
  levels.forEach(lvl => {
    const c = counts[lvl] || 0;
    if (!c) return;
    const btn = document.createElement('button');
    btn.className = 'fc-book-opt' + (fc.selectedLevels.has(lvl) ? ' selected' : '');
    btn.innerHTML = `<span style="font-family:'Funnel Display',sans-serif;font-weight:500">${lvl}</span> <span style="font-size:0.75rem;opacity:0.6">(${c})</span>`;
    btn.onclick = () => {
      fc.selectedLevels.has(lvl) ? fc.selectedLevels.delete(lvl) : fc.selectedLevels.add(lvl);
      btn.classList.toggle('selected');
    };
    grid.appendChild(btn);
  });

  if (noLevel) {
    const btn = document.createElement('button');
    btn.className = 'fc-book-opt' + (fc.selectedLevels.has('none') ? ' selected' : '');
    btn.innerHTML = `No tag <span style="font-size:0.75rem;opacity:0.6">(${noLevel})</span>`;
    btn.onclick = () => {
      fc.selectedLevels.has('none') ? fc.selectedLevels.delete('none') : fc.selectedLevels.add('none');
      btn.classList.toggle('selected');
    };
    grid.appendChild(btn);
  }
}

function _renderWkPicker(grid) {
  const all = _allVocab();
  // Group by WK level ranges
  const ranges = [
    { label: '1–10', min: 1, max: 10 },
    { label: '11–20', min: 11, max: 20 },
    { label: '21–30', min: 21, max: 30 },
    { label: '31–40', min: 31, max: 40 },
    { label: '41–50', min: 41, max: 50 },
    { label: '51–60', min: 51, max: 60 },
  ];

  const wkWords = all.filter(w => w.wk_level != null);
  const noWk = all.filter(w => w.wk_level == null).length;

  if (!wkWords.length && !noWk) {
    grid.innerHTML = '<p class="status-msg">No words with WK levels found. Connect WaniKani in settings to add level data.</p>';
    return;
  }

  grid.innerHTML = '';
  ranges.forEach(r => {
    const c = wkWords.filter(w => w.wk_level >= r.min && w.wk_level <= r.max).length;
    if (!c) return;
    const key = `wk${r.min}-${r.max}`;
    const btn = document.createElement('button');
    btn.className = 'fc-book-opt' + (fc.selectedLevels.has(key) ? ' selected' : '');
    btn.innerHTML = `<span style="font-family:'Funnel Display',sans-serif;font-weight:500">WK ${r.label}</span> <span style="font-size:0.75rem;opacity:0.6">(${c})</span>`;
    btn.onclick = () => {
      fc.selectedLevels.has(key) ? fc.selectedLevels.delete(key) : fc.selectedLevels.add(key);
      btn.classList.toggle('selected');
    };
    grid.appendChild(btn);
  });

  if (noWk) {
    const btn = document.createElement('button');
    btn.className = 'fc-book-opt' + (fc.selectedLevels.has('no-wk') ? ' selected' : '');
    btn.innerHTML = `No WK <span style="font-size:0.75rem;opacity:0.6">(${noWk})</span>`;
    btn.onclick = () => {
      fc.selectedLevels.has('no-wk') ? fc.selectedLevels.delete('no-wk') : fc.selectedLevels.add('no-wk');
      btn.classList.toggle('selected');
    };
    grid.appendChild(btn);
  }
}

/* ── Helpers ──────────────────────────────────────── */
function _jlptTag(jlpt) {
  if (!jlpt) return null;
  const s = String(jlpt).toUpperCase();
  const m = s.match(/N(\d)/);
  return m ? 'N' + m[1] : null;
}

/* ── Start session ───────────────────────────────── */
function startFlashcards() {
  let words = [];

  if (fc.source === 'book') {
    const shelf  = _shelf().filter(e => e.vocab?.length > 0);
    const toStudy = fc.selectedBooks.size ? shelf.filter(e => fc.selectedBooks.has(e.id)) : shelf;
    words = toStudy.flatMap(e => e.vocab.map(w => ({ ...w, bookId: e.id })));
  } else if (fc.source === 'jlpt') {
    const all = _allVocab();
    if (fc.selectedLevels.size) {
      words = all.filter(w => {
        const tag = _jlptTag(w.jlpt);
        if (tag && fc.selectedLevels.has(tag)) return true;
        if (!tag && fc.selectedLevels.has('none')) return true;
        return false;
      });
    } else {
      words = all.filter(w => _jlptTag(w.jlpt)); // all tagged words
    }
  } else if (fc.source === 'wk') {
    const all = _allVocab();
    if (fc.selectedLevels.size) {
      words = all.filter(w => {
        if (w.wk_level != null) {
          for (const key of fc.selectedLevels) {
            const m = key.match(/^wk(\d+)-(\d+)$/);
            if (m && w.wk_level >= +m[1] && w.wk_level <= +m[2]) return true;
          }
        }
        if (w.wk_level == null && fc.selectedLevels.has('no-wk')) return true;
        return false;
      });
    } else {
      words = all.filter(w => w.wk_level != null); // all WK words
    }
  }

  // Deduplicate (same word could appear in multiple books)
  if (fc.source !== 'book') {
    const seen = new Set();
    words = words.filter(w => {
      const key = w.word + '|' + w.reading;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  if (!words.length) { alert('No words match your selection — try a different filter.'); return; }

  fc.mode  = document.getElementById('fc-mode').value;
  const order = document.getElementById('fc-order').value;
  const limit = parseInt(document.getElementById('fc-limit').value, 10);

  if (order === 'random')     words = words.sort(() => Math.random() - 0.5);
  if (order === 'hard-first') {
    const sc = JSON.parse(localStorage.getItem('fc-scores') || '{}');
    words.sort((a,b) => (sc[a.word]?.ease || 2.5) - (sc[b.word]?.ease || 2.5));
  }
  if (order === 'jlpt-asc')  words.sort((a,b) => _jlptNum(a.jlpt) - _jlptNum(b.jlpt));
  if (order === 'jlpt-desc') words.sort((a,b) => _jlptNum(b.jlpt) - _jlptNum(a.jlpt));
  if (order === 'wk-asc')    words.sort((a,b) => (a.wk_level || 999) - (b.wk_level || 999));
  if (order === 'wk-desc')   words.sort((a,b) => (b.wk_level || 0) - (a.wk_level || 0));

  if (limit > 0) words = words.slice(0, limit);

  Object.assign(fc, { deck: words, queue: [...words], idx: 0,
    stats: { again:0, hard:0, good:0, easy:0 }, againWords: [], flipped: false });

  document.getElementById('fc-setup').style.display = 'none';
  document.getElementById('fc-results').classList.remove('active');
  document.getElementById('fc-study').classList.add('active');
  loadCard();
}

function loadCard() {
  if (fc.idx >= fc.queue.length) { showResults(); return; }
  fc.current = fc.queue[fc.idx];
  fc.flipped  = false;
  document.getElementById('fc-card-scene').classList.remove('flipped');
  document.getElementById('fc-ratings').classList.remove('visible');

  const done = fc.idx, total = fc.queue.length;
  document.getElementById('fc-count').textContent = `${done+1} / ${total}`;
  document.getElementById('fc-progress-fill').style.width = `${done/total*100}%`;
  ['again','hard','good','easy'].forEach(k =>
    document.getElementById('stat-'+k).textContent = fc.stats[k]);

  const w = fc.current, m = fc.mode;
  const fHint = document.getElementById('fc-front-hint');
  const fWord = document.getElementById('fc-front-word');
  const fSub  = document.getElementById('fc-front-sub');
  const bWord = document.getElementById('fc-back-word');
  const bMean = document.getElementById('fc-back-meaning');
  const bRead = document.getElementById('fc-back-reading');

  if (m === 'kanji-to-meaning') {
    fHint.textContent = 'KANJI';
    fWord.textContent = w.word;
    fWord.style.fontSize = w.word.length > 4 ? '2.8rem' : '4.5rem';
    fSub.textContent = '';
  } else if (m === 'meaning-to-kanji') {
    fHint.textContent = 'MEANING';
    fWord.textContent = w.meaning;
    fWord.style.fontSize = w.meaning.length > 20 ? '1.2rem' : '1.8rem';
    fSub.textContent = '';
  } else {
    fHint.textContent = 'READING';
    fWord.textContent = w.reading;
    fWord.style.fontSize = '3rem';
    fSub.textContent = '';
  }
  bWord.textContent = w.word;
  bMean.textContent = w.meaning;
  bRead.textContent = w.reading;
}

function flipCard() {
  if (fc.flipped) return;
  fc.flipped = true;
  document.getElementById('fc-card-scene').classList.add('flipped');
  document.getElementById('fc-ratings').classList.add('visible');
}

function rateCard(rating) {
  if (!fc.flipped) { flipCard(); return; }
  fc.stats[rating]++;
  const scores = JSON.parse(localStorage.getItem('fc-scores') || '{}');
  const word = fc.current.word;
  const prev = scores[word] || { ease: 2.5, interval: 1, reps: 0 };
  prev.ease = Math.max(1.3, prev.ease + {again:-0.3,hard:-0.15,good:0,easy:0.15}[rating]);
  if (rating === 'again') { prev.interval=1; prev.reps=0; fc.againWords.push(fc.current); }
  else { prev.reps++; prev.interval = Math.round(prev.interval * prev.ease); }
  scores[word] = prev;
  localStorage.setItem('fc-scores', JSON.stringify(scores));
  fc.idx++; loadCard();
}

function endSession()    { if (confirm('End session early?')) showResults(); }

function showResults() {
  document.getElementById('fc-study').classList.remove('active');
  const {again,hard,good,easy} = fc.stats;
  const total = again+hard+good+easy;
  const pct   = total > 0 ? Math.round((good+easy)/total*100) : 0;
  document.getElementById('fc-results-grid').innerHTML = `
    <div class="fc-results-stat"><div class="big" style="color:#c05050">${again}</div><div class="lbl">Again</div></div>
    <div class="fc-results-stat"><div class="big" style="color:#b07028">${hard}</div><div class="lbl">Hard</div></div>
    <div class="fc-results-stat"><div class="big" style="color:#3a8a50">${good}</div><div class="lbl">Good</div></div>
    <div class="fc-results-stat"><div class="big" style="color:#3a70a0">${easy}</div><div class="lbl">Easy</div></div>
    <div class="fc-results-stat" style="grid-column:span 4"><div class="big">${pct}%</div><div class="lbl">Known</div></div>`;
  const al = document.getElementById('fc-again-list');
  if (fc.againWords.length) {
    al.style.display = 'block';
    document.getElementById('fc-again-items').innerHTML =
      fc.againWords.map(w =>
        `<div class="fc-again-item"><span class="k">${_esc(w.word)}</span><span class="r">${_esc(w.reading)}</span><span class="m">${_esc(w.meaning)}</span></div>`
      ).join('');
  } else { al.style.display = 'none'; }
  document.getElementById('fc-results').classList.add('active');
}

function restartSession() { document.getElementById('fc-results').classList.remove('active'); startFlashcards(); }
function backToSetup()    {
  ['fc-results','fc-study'].forEach(id => document.getElementById(id).classList.remove('active'));
  document.getElementById('fc-setup').style.display = 'block';
  showFlashcardsSetup();
}

document.addEventListener('keydown', e => {
  if (!document.getElementById('fc-study')?.classList.contains('active')) return;
  if (e.key===' '||e.key==='Enter') { e.preventDefault(); if (!fc.flipped) flipCard(); }
  if (fc.flipped) { ({1:()=>rateCard('again'),2:()=>rateCard('hard'),3:()=>rateCard('good'),4:()=>rateCard('easy')})[e.key]?.(); }
});

function _esc(s) {
  return String(s??'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

window.fcSetSource = fcSetSource;
