/* =========================
   FLASHCARDS
========================= */
let fc = {
  deck: [],
  queue: [],
  current: null,
  idx: 0,
  flipped: false,
  mode: 'kanji-to-meaning',
  stats: { again: 0, hard: 0, good: 0, easy: 0 },
  againWords: [],
  selectedBooks: new Set(),
};

function showFlashcardsSetup() {
  const grid = document.getElementById('fc-book-grid');
  grid.innerHTML = '';
  if (!books.length) {
    grid.innerHTML = '<p class="status-msg">No books yet. Add words in the Lookup tab first.</p>';
    return;
  }
  books.forEach(b => {
    const btn = document.createElement('button');
    btn.className = 'fc-book-opt' + (fc.selectedBooks.has(b.id) ? ' selected' : '');
    btn.innerHTML = `${escapeHTML(b.title)} <span style="font-size:0.75rem;opacity:0.6">(${b.words.length})</span>`;
    btn.onclick = () => {
      if (fc.selectedBooks.has(b.id)) fc.selectedBooks.delete(b.id);
      else fc.selectedBooks.add(b.id);
      btn.classList.toggle('selected');
    };
    grid.appendChild(btn);
  });
}

function startFlashcards() {
  if (!fc.selectedBooks.size) {
    books.forEach(b => fc.selectedBooks.add(b.id));
  }

  let words = [];
  books.filter(b => fc.selectedBooks.has(b.id)).forEach(b => {
    b.words.forEach(w => words.push({ ...w, bookId: b.id }));
  });

  if (!words.length) { alert('No words in selected books. Add words first!'); return; }

  fc.mode = document.getElementById('fc-mode').value;
  const order = document.getElementById('fc-order').value;
  const limit = parseInt(document.getElementById('fc-limit').value, 10);

  if (order === 'random') words = words.sort(() => Math.random() - 0.5);
  else if (order === 'hard-first') {
    const scores = JSON.parse(localStorage.getItem('fc-scores') || '{}');
    words.sort((a, b) => (scores[a.word]?.ease || 2.5) - (scores[b.word]?.ease || 2.5));
  }

  if (limit > 0) words = words.slice(0, limit);

  fc.deck = words;
  fc.queue = [...words];
  fc.idx = 0;
  fc.stats = { again: 0, hard: 0, good: 0, easy: 0 };
  fc.againWords = [];
  fc.flipped = false;

  document.getElementById('fc-setup').style.display = 'none';
  document.getElementById('fc-results').classList.remove('active');
  document.getElementById('fc-study').classList.add('active');

  loadCard();
}

function loadCard() {
  if (fc.idx >= fc.queue.length) { showResults(); return; }

  fc.current = fc.queue[fc.idx];
  fc.flipped = false;

  const scene = document.getElementById('fc-card-scene');
  scene.classList.remove('flipped');
  document.getElementById('fc-ratings').classList.remove('visible');

  const total = fc.queue.length;
  const done = fc.idx;
  document.getElementById('fc-count').textContent = `${done + 1} / ${total}`;
  document.getElementById('fc-progress-fill').style.width = `${(done / total) * 100}%`;
  document.getElementById('stat-again').textContent = fc.stats.again;
  document.getElementById('stat-hard').textContent = fc.stats.hard;
  document.getElementById('stat-good').textContent = fc.stats.good;
  document.getElementById('stat-easy').textContent = fc.stats.easy;

  const w = fc.current;
  const m = fc.mode;
  const frontHint = document.getElementById('fc-front-hint');
  const frontWord = document.getElementById('fc-front-word');
  const frontSub = document.getElementById('fc-front-sub');
  const backWord = document.getElementById('fc-back-word');
  const backMeaning = document.getElementById('fc-back-meaning');
  const backReading = document.getElementById('fc-back-reading');

  if (m === 'kanji-to-meaning') {
    frontHint.textContent = 'KANJI';
    frontWord.textContent = w.word;
    frontWord.style.fontSize = w.word.length > 4 ? '2.8rem' : '4.5rem';
    frontSub.textContent = '';
    backWord.textContent = w.word;
    backMeaning.textContent = w.meaning;
    backReading.textContent = w.reading;
  } else if (m === 'meaning-to-kanji') {
    frontHint.textContent = 'MEANING';
    frontWord.textContent = w.meaning;
    frontWord.style.fontSize = w.meaning.length > 20 ? '1.2rem' : '1.8rem';
    frontSub.textContent = '';
    backWord.textContent = w.word;
    backMeaning.textContent = w.meaning;
    backReading.textContent = w.reading;
  } else {
    frontHint.textContent = 'READING';
    frontWord.textContent = w.reading;
    frontWord.style.fontSize = '3rem';
    frontSub.textContent = '';
    backWord.textContent = w.word;
    backMeaning.textContent = w.meaning;
    backReading.textContent = w.reading;
  }
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
  const easeMap = { again: -0.3, hard: -0.15, good: 0, easy: 0.15 };

  prev.ease = Math.max(1.3, prev.ease + easeMap[rating]);
  if (rating === 'again') { prev.interval = 1; prev.reps = 0; fc.againWords.push(fc.current); }
  else { prev.reps++; prev.interval = Math.round(prev.interval * prev.ease); }

  scores[word] = prev;
  localStorage.setItem('fc-scores', JSON.stringify(scores));

  fc.idx++;
  loadCard();
}

function endSession() {
  if (confirm('End session early?')) showResults();
}

function showResults() {
  document.getElementById('fc-study').classList.remove('active');

  const { again, hard, good, easy } = fc.stats;
  const total = again + hard + good + easy;
  const pct = total > 0 ? Math.round(((good + easy) / total) * 100) : 0;

  document.getElementById('fc-results-grid').innerHTML = `
    <div class="fc-results-stat"><div class="big" style="color:var(--red)">${again}</div><div class="lbl">Again</div></div>
    <div class="fc-results-stat"><div class="big" style="color:#e67e22">${hard}</div><div class="lbl">Hard</div></div>
    <div class="fc-results-stat"><div class="big" style="color:#27ae60">${good}</div><div class="lbl">Good</div></div>
    <div class="fc-results-stat"><div class="big" style="color:#2980b9">${easy}</div><div class="lbl">Easy</div></div>
    <div class="fc-results-stat" style="grid-column:span 4"><div class="big">${pct}%</div><div class="lbl">Known</div></div>
  `;

  const againList = document.getElementById('fc-again-list');
  if (fc.againWords.length) {
    againList.style.display = 'block';
    document.getElementById('fc-again-items').innerHTML = fc.againWords.map(w =>
      `<div class="fc-again-item">
        <span class="k">${escapeHTML(w.word)}</span>
        <span class="r">${escapeHTML(w.reading)}</span>
        <span class="m">${escapeHTML(w.meaning)}</span>
      </div>`
    ).join('');
  } else {
    againList.style.display = 'none';
  }

  document.getElementById('fc-results').classList.add('active');
}

function restartSession() {
  document.getElementById('fc-results').classList.remove('active');
  startFlashcards();
}

function backToSetup() {
  document.getElementById('fc-results').classList.remove('active');
  document.getElementById('fc-study').classList.remove('active');
  document.getElementById('fc-setup').style.display = 'block';
  showFlashcardsSetup();
}

document.addEventListener('keydown', e => {
  const studyActive = document.getElementById('fc-study').classList.contains('active');
  if (!studyActive) return;

  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    if (!fc.flipped) flipCard();
  }
  if (fc.flipped) {
    if (e.key === '1') rateCard('again');
    if (e.key === '2') rateCard('hard');
    if (e.key === '3') rateCard('good');
    if (e.key === '4') rateCard('easy');
  }
});
