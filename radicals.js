/* =========================
   RADICAL / COMPONENT SEARCH
   - Local component->kanji index (KanjiVG-style)
   - Works on GitHub Pages (no scraping/CORS)
========================= */

let element2kanji = null;

// Minimal fallback so it works immediately even without the big JSON.
const ELEMENT2KANJI_FALLBACK = {
  "一": ["一","丁","七","万","丈","三","上","下","不","世","丘","丙","中","主","二","井","亜","亡","交","京","亭","人","今"],
  "口": ["口","古","句","各","名","吾","告","和","品","員","問","味","唱","商","喜","器","国","園","困","回","因","固","囲"],
  "水": ["水","永","求","汐","汁","江","池","決","汽","河","泉","泊","泣","法","波","泥","注","泳","洋","洗","海","消","流","涙","湖","港","湯","漢","潮"],
  "木": ["木","本","末","未","札","机","村","林","枚","果","枝","松","板","校","根","植","楽","森","様","樹"],
  "人": ["人","仁","今","仏","仕","他","代","令","位","住","体","何","作","使","例","供","依","信","側","像"],
  "艹": ["花","草","茶","英","若","苦","荷","菜","菓","落","葉","蒸","薬","薄","藍"]
};

async function loadElementIndex() {
  if (element2kanji) return element2kanji;
  try {
    const r = await fetch("./data/element2kanji.json", { cache: "force-cache" });
    if (!r.ok) throw new Error("missing");
    element2kanji = await r.json();
  } catch {
    element2kanji = ELEMENT2KANJI_FALLBACK;
  }
  return element2kanji;
}

let strokeFilter = null;

// Picker list (includes a small extra: 艹)
const RADICALS = [
  {r:'一',s:1},{r:'丨',s:1},{r:'丶',s:1},{r:'ノ',s:1},{r:'乙',s:1},{r:'亅',s:1},
  {r:'二',s:2},{r:'亠',s:2},{r:'人',s:2},{r:'儿',s:2},{r:'入',s:2},{r:'八',s:2},{r:'冂',s:2},{r:'冖',s:2},{r:'冫',s:2},{r:'几',s:2},{r:'凵',s:2},{r:'刀',s:2},{r:'力',s:2},{r:'勹',s:2},{r:'匕',s:2},{r:'匚',s:2},{r:'十',s:2},{r:'卜',s:2},{r:'卩',s:2},{r:'厂',s:2},{r:'厶',s:2},{r:'又',s:2},
  {r:'口',s:3},{r:'囗',s:3},{r:'土',s:3},{r:'士',s:3},{r:'夕',s:3},{r:'大',s:3},{r:'女',s:3},{r:'子',s:3},{r:'宀',s:3},{r:'寸',s:3},{r:'小',s:3},{r:'山',s:3},{r:'川',s:3},{r:'工',s:3},{r:'己',s:3},{r:'巾',s:3},{r:'广',s:3},{r:'弓',s:3},{r:'彳',s:3},
  {r:'心',s:4},{r:'手',s:4},{r:'文',s:4},{r:'日',s:4},{r:'月',s:4},{r:'木',s:4},{r:'止',s:4},{r:'水',s:4},{r:'火',s:4},{r:'犬',s:4},{r:'王',s:4},{r:'艹',s:4},
];

const strokeCounts = [...new Set(RADICALS.map(x => x.s))].sort((a,b)=>a-b);

function renderRadicals() {
  const sf = document.getElementById('stroke-filter');
  if (!sf) return;

  if (!sf.children.length) {
    const allBtn = document.createElement('button');
    allBtn.className = 'stroke-btn active';
    allBtn.textContent = 'All';
    allBtn.onclick = () => { strokeFilter = null; highlightStroke(allBtn); renderRadicalGrid(); };
    sf.appendChild(allBtn);

    strokeCounts.forEach(s => {
      const btn = document.createElement('button');
      btn.className = 'stroke-btn';
      btn.textContent = s;
      btn.onclick = () => { strokeFilter = s; highlightStroke(btn); renderRadicalGrid(); };
      sf.appendChild(btn);
    });
  }
  renderRadicalGrid();
}

function highlightStroke(el) {
  document.querySelectorAll('.stroke-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}

function renderRadicalGrid() {
  const grid = document.getElementById('radical-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const filtered = strokeFilter ? RADICALS.filter(r => r.s === strokeFilter) : RADICALS;

  filtered.forEach(({r, s}) => {
    const btn = document.createElement('button');
    btn.className = 'radical-btn' + (selectedRadicals.has(r) ? ' selected' : '');
    btn.innerHTML = `${r}<span class="strokes">${s}</span>`;
    btn.title = `${r} (${s} strokes)`;
    btn.onclick = () => toggleRadical(r, btn);
    grid.appendChild(btn);
  });
}

function toggleRadical(r, btn) {
  if (selectedRadicals.has(r)) { selectedRadicals.delete(r); btn.classList.remove('selected'); }
  else { selectedRadicals.add(r); btn.classList.add('selected'); }
  const disp = document.getElementById('selected-radicals-display');
  if (disp) disp.textContent = selectedRadicals.size ? [...selectedRadicals].join(' ') : '—';
}

function clearRadicals() {
  selectedRadicals.clear();
  renderRadicalGrid();
  const disp = document.getElementById('selected-radicals-display');
  if (disp) disp.textContent = '—';
  const res = document.getElementById('radical-results');
  if (res) res.innerHTML = '<p class="status-msg">Select radicals/components and click Search.</p>';
}

async function searchByRadicals() {
  const res = document.getElementById('radical-results');
  if (!selectedRadicals.size) { alert('Select at least one part.'); return; }
  if (res) res.innerHTML = '<p class="status-msg">Searching…</p>';

  const idx = await loadElementIndex();
  const parts = [...selectedRadicals];

  let set = new Set(idx[parts[0]] || []);
  for (let i = 1; i < parts.length; i++) {
    const next = new Set(idx[parts[i]] || []);
    set = new Set([...set].filter(k => next.has(k)));
  }

  const chars = [...set].slice(0, 180);
  renderKanjiCandidates(chars);
}

function renderKanjiCandidates(chars) {
  const res = document.getElementById('radical-results');
  if (!res) return;

  if (!chars.length) {
    res.innerHTML = '<p class="status-msg">No candidates. Try fewer/different parts (or use handwriting).</p>';
    return;
  }

  res.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:6px">
      ${chars.map(k => `
        <button class="btn btn-sm btn-outline"
          style="font-family:'Noto Serif JP',serif;font-size:1.2rem"
          onclick="document.getElementById('search-input').value='${k}'; showPanel('lookup'); lookupWord();">${k}</button>
      `).join('')}
    </div>
    <p class="status-msg" style="margin-top:8px">Showing ${Math.min(chars.length,180)} candidates.</p>
  `;
}
