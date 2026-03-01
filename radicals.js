/* =========================
   RADICAL PICKER
   Completely self-contained.
   All state on window._radState to avoid any module-scope conflicts.
   Buttons use inline styles to bypass any CSS conflicts entirely.
========================= */

// ── State (all on window to avoid scope issues) ──────────────────────────────
window._radState = window._radState || {
  element2kanji: null,
  loadError:     null,
  strokeFilter:  null,
  selected:      new Set(),
  filterBuilt:   false,
};

// ── Radical data ─────────────────────────────────────────────────────────────
const RADICALS = [
  {r:'一',s:1},{r:'丨',s:1},{r:'丶',s:1},{r:'ノ',s:1},{r:'乙',s:1},{r:'亅',s:1},
  {r:'二',s:2},{r:'亠',s:2},{r:'人',s:2},{r:'儿',s:2},{r:'入',s:2},{r:'八',s:2},
  {r:'冂',s:2},{r:'冖',s:2},{r:'冫',s:2},{r:'几',s:2},{r:'凵',s:2},{r:'刀',s:2},
  {r:'力',s:2},{r:'勹',s:2},{r:'匕',s:2},{r:'匚',s:2},{r:'十',s:2},{r:'卜',s:2},
  {r:'卩',s:2},{r:'厂',s:2},{r:'厶',s:2},{r:'又',s:2},
  {r:'口',s:3},{r:'囗',s:3},{r:'土',s:3},{r:'士',s:3},{r:'夕',s:3},{r:'大',s:3},
  {r:'女',s:3},{r:'子',s:3},{r:'宀',s:3},{r:'寸',s:3},{r:'小',s:3},{r:'山',s:3},
  {r:'川',s:3},{r:'工',s:3},{r:'己',s:3},{r:'巾',s:3},{r:'广',s:3},{r:'弓',s:3},
  {r:'彳',s:3},
  {r:'心',s:4},{r:'手',s:4},{r:'文',s:4},{r:'日',s:4},{r:'月',s:4},{r:'木',s:4},
  {r:'止',s:4},{r:'水',s:4},{r:'火',s:4},{r:'犬',s:4},{r:'王',s:4},{r:'艹',s:4},
  {r:'示',s:5},{r:'禾',s:5},{r:'穴',s:5},{r:'立',s:5},{r:'竹',s:6},{r:'米',s:6},
  {r:'糸',s:6},{r:'羊',s:6},{r:'耳',s:6},{r:'虫',s:6},{r:'見',s:7},{r:'言',s:7},
  {r:'貝',s:7},{r:'走',s:7},{r:'足',s:7},{r:'金',s:8},{r:'門',s:8},{r:'雨',s:8},
  {r:'食',s:9},{r:'馬',s:10},{r:'魚',s:11},{r:'鳥',s:11},
];
const STROKE_COUNTS = [...new Set(RADICALS.map(r => r.s))].sort((a,b)=>a-b);

// ── Load element2kanji.json eagerly ──────────────────────────────────────────
async function loadElementIndex() {
  if (window._radState.element2kanji) return window._radState.element2kanji;
  if (window._radState.loadError)     throw window._radState.loadError;
  for (const url of ['./element2kanji.json', './data/element2kanji.json']) {
    try {
      const r = await fetch(url);
      if (!r.ok) continue;
      window._radState.element2kanji = await r.json();
      console.log('[radicals] Loaded', Object.keys(window._radState.element2kanji).length, 'entries from', url);
      return window._radState.element2kanji;
    } catch(_) {}
  }
  window._radState.loadError = new Error('element2kanji.json not found in ./ or ./data/');
  throw window._radState.loadError;
}
loadElementIndex().catch(()=>{});

// ── Render stroke-filter bar ─────────────────────────────────────────────────
function _buildStrokeFilter() {
  const sf = document.getElementById('stroke-filter');
  if (!sf || window._radState.filterBuilt) return;
  window._radState.filterBuilt = true;
  sf.innerHTML = '';

  const mkBtn = (label, active) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.className = 'stroke-btn' + (active ? ' active' : '');
    return b;
  };

  const all = mkBtn('All', true);
  all.onclick = () => {
    window._radState.strokeFilter = null;
    sf.querySelectorAll('.stroke-btn').forEach(b => b.classList.remove('active'));
    all.classList.add('active');
    _buildRadicalGrid();
  };
  sf.appendChild(all);

  STROKE_COUNTS.forEach(s => {
    const btn = mkBtn(String(s), false);
    btn.onclick = () => {
      window._radState.strokeFilter = s;
      sf.querySelectorAll('.stroke-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _buildRadicalGrid();
    };
    sf.appendChild(btn);
  });
}

// ── Render radical button grid ───────────────────────────────────────────────
// Uses inline styles so it works regardless of what CSS is deployed.
function _buildRadicalGrid() {
  const grid = document.getElementById('radical-grid');
  if (!grid) return;

  const sf  = window._radState.strokeFilter;
  const sel = window._radState.selected;
  const list = sf ? RADICALS.filter(r => r.s === sf) : RADICALS;

  const frag = document.createDocumentFragment();
  list.forEach(({ r, s }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    const isSelected = sel.has(r);
    // ALL styling inline — no dependency on external CSS whatsoever
    btn.style.cssText =
      'display:inline-flex;align-items:center;justify-content:center;' +
      'width:40px;height:40px;padding:0;flex-shrink:0;' +
      'font-size:1.1rem;font-family:inherit;' +
      'cursor:pointer;position:relative;border-radius:8px;' +
      'border:1.5px solid ' + (isSelected ? 'var(--accent-stroke,#7b6f9e)' : 'rgba(75,74,62,0.3)') + ';' +
      'background:transparent;' +
      'color:' + (isSelected ? 'var(--accent-stroke,#7b6f9e)' : 'inherit') + ';';
    btn.innerHTML = r +
      '<span style="position:absolute;top:1px;right:2px;font-size:0.36rem;' +
      'font-family:monospace;opacity:0.5;line-height:1;pointer-events:none">' + s + '</span>';
    btn.title = r + '  (' + s + ' strokes)';
    btn.onclick = () => {
      if (sel.has(r)) {
        sel.delete(r);
        btn.style.borderColor = 'rgba(75,74,62,0.3)';
        btn.style.color = 'inherit';
      } else {
        sel.add(r);
        btn.style.borderColor = 'var(--accent-stroke,#7b6f9e)';
        btn.style.color = 'var(--accent-stroke,#7b6f9e)';
      }
      _updateDisplay();
    };
    frag.appendChild(btn);
  });

  grid.innerHTML = '';
  grid.appendChild(frag);
  console.log('[radicals] Grid built:', list.length, 'buttons');
}

function _updateDisplay() {
  const el = document.getElementById('selected-radicals-display');
  if (!el) return;
  const sel = window._radState.selected;
  el.textContent = sel.size ? [...sel].join('  ') : '—';
}

// ── Search by selected radicals → kanji candidates ───────────────────────────
async function searchByRadicals() {
  const cand = document.getElementById('radical-kanji-candidates');
  const sel  = window._radState.selected;
  if (!sel.size) {
    if (cand) cand.innerHTML = '<p class="status-msg">Select at least one radical first.</p>';
    return;
  }
  if (cand) cand.innerHTML = '<p class="status-msg">Loading…</p>';

  let idx;
  try { idx = await loadElementIndex(); }
  catch (e) {
    if (cand) cand.innerHTML =
      '<p class="status-msg">⚠ Could not load element2kanji.json — ' +
      'make sure it is in the same folder as index.html.<br>' +
      '<small style="opacity:0.6">' + e.message + '</small></p>';
    return;
  }

  const parts = [...sel];
  let result = new Set(idx[parts[0]] || []);
  for (let i = 1; i < parts.length; i++) {
    const nxt = new Set(idx[parts[i]] || []);
    result = new Set([...result].filter(k => nxt.has(k)));
  }
  _renderKanjiCandidates([...result].slice(0, 240));
}

function _renderKanjiCandidates(chars) {
  const cand = document.getElementById('radical-kanji-candidates');
  if (!cand) return;
  if (!chars.length) {
    cand.innerHTML = '<p class="status-msg">No kanji found. Try fewer radicals.</p>';
    return;
  }
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:8px';
  chars.forEach(k => {
    const b = document.createElement('button');
    b.type = 'button';
    b.style.cssText =
      'display:inline-flex;align-items:center;justify-content:center;' +
      'width:40px;height:40px;padding:0;' +
      'font-size:1.1rem;font-family:inherit;' +
      'border:1.5px solid rgba(75,74,62,0.3);border-radius:8px;' +
      'background:transparent;cursor:pointer;';
    b.textContent = k;
    b.title = 'Add ' + k + ' to query';
    b.onclick = () => radicalAppend(k);
    b.onmouseenter = () => { b.style.borderColor='rgba(75,74,62,0.7)'; };
    b.onmouseleave = () => { b.style.borderColor='rgba(75,74,62,0.3)'; };
    wrap.appendChild(b);
  });
  cand.innerHTML = '';
  cand.appendChild(wrap);
  cand.insertAdjacentHTML('beforeend',
    '<p class="status-msg" style="margin-top:10px">Click kanji to add to the query box</p>');
}

// ── Build-word helpers ────────────────────────────────────────────────────────
function radicalAppend(kanji) {
  const inp = document.getElementById('radical-query');
  if (!inp) return;
  inp.value += kanji;
  inp.dispatchEvent(new Event('input'));
}

function clearRadicals() {
  window._radState.selected.clear();
  _buildRadicalGrid();
  _updateDisplay();
  const cand = document.getElementById('radical-kanji-candidates');
  if (cand) cand.innerHTML = '<p class="status-msg">Select radicals and click "Get Kanji".</p>';
}

function radicalSearchWord() {
  const q = (document.getElementById('radical-query')?.value || '').trim();
  if (!q) return;
  const si = document.getElementById('search-input');
  if (si) si.value = q;
  if (typeof showPanel  === 'function') showPanel('lookup');
  if (typeof lookupWord === 'function') lookupWord(q);
}

function radicalClearAll() {
  const inp = document.getElementById('radical-query');
  if (inp) inp.value = '';
  const box = document.getElementById('radical-word-suggestions');
  if (box) box.innerHTML = '<p class="status-msg">Build a query to see suggestions.</p>';
  clearRadicals();
}

// ── Word suggestions ─────────────────────────────────────────────────────────
const _RAD_API = (window.TSUNDOKU_CONFIG && window.TSUNDOKU_CONFIG.jishoApi)
  || 'https://minireader.zoe-caudron.workers.dev/?keyword=';

let _sugTimer = null;
function _setupQueryListener() {
  const q = document.getElementById('radical-query');
  if (!q || q.dataset.radBound) return;
  q.dataset.radBound = '1';
  q.addEventListener('input', () => {
    clearTimeout(_sugTimer);
    _sugTimer = setTimeout(_radSuggest, 280);
  });
}

async function _radSuggest() {
  const q   = (document.getElementById('radical-query')?.value || '').trim();
  const box = document.getElementById('radical-word-suggestions');
  if (!box) return;
  if (!q) { box.innerHTML = '<p class="status-msg">Build a query to see suggestions.</p>'; return; }
  box.innerHTML = '<p class="status-msg">Searching…</p>';
  try {
    const r = await fetch(_RAD_API + encodeURIComponent(q));
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    const entries = (data.data || []).slice(0, 6);
    if (!entries.length) { box.innerHTML = '<p class="status-msg">No results.</p>'; return; }
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:8px';
    entries.forEach(e => {
      const w  = e.japanese?.[0]?.word    || e.japanese?.[0]?.reading || '';
      const rd = e.japanese?.[0]?.reading || '';
      const m  = e.senses?.[0]?.english_definitions?.slice(0,2).join('; ') || '';
      const b  = document.createElement('button');
      b.type = 'button'; b.className = 'btn btn-sm btn-outline'; b.style.textAlign = 'left';
      b.innerHTML =
        '<span style="font-family:\'Kosugi Maru\',sans-serif;font-weight:600">' + _esc(w) + '</span>' +
        (w!==rd ? '<span style="opacity:0.65;margin-left:8px">'+_esc(rd)+'</span>' : '') +
        '<span style="opacity:0.7;margin-left:10px">— ' + _esc(m) + '</span>';
      b.onclick = () => {
        const si = document.getElementById('search-input');
        if (si) si.value = w;
        if (typeof showPanel  === 'function') showPanel('lookup');
        if (typeof lookupWord === 'function') lookupWord(w);
      };
      wrap.appendChild(b);
    });
    box.innerHTML = ''; box.appendChild(wrap);
  } catch(_) {
    box.innerHTML = '<p class="status-msg">Could not load suggestions.</p>';
  }
}

function _esc(s) {
  return String(s??'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

// ── Main entry point ─────────────────────────────────────────────────────────
function renderRadicals() {
  _buildStrokeFilter();
  _buildRadicalGrid();
  _updateDisplay();
  _setupQueryListener();
}

// Expose everything globally
window.renderRadicals    = renderRadicals;
window.searchByRadicals  = searchByRadicals;
window.clearRadicals     = clearRadicals;
window.radicalAppend     = radicalAppend;
window.radicalSearchWord = radicalSearchWord;
window.radicalClearAll   = radicalClearAll;
