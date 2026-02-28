/* =========================
   BOOKS & WORD LISTS
========================= */
function saveBooks() { localStorage.setItem('rdbooks', JSON.stringify(books)); }

function addBook() {
  const inp = document.getElementById('new-book-input');
  const title = inp.value.trim();
  if (!title) return;
  const book = { id: 'bk' + Date.now(), title, words: [] };
  books.push(book);
  saveBooks();
  inp.value = '';
  renderBookList();
}

function renderBookList() {
  const bl = document.getElementById('book-list');
  bl.innerHTML = '';
  if (!books.length) { bl.innerHTML = '<p class="status-msg">No books yet. Add one above.</p>'; return; }
  books.forEach(book => {
    const d = document.createElement('div');
    d.className = 'book-item' + (activeBook === book.id ? ' active' : '');
    d.innerHTML = `<div>${escapeHTML(book.title)}</div><div class="book-count">${book.words.length} words</div>`;
    d.onclick = () => { activeBook = book.id; renderBookList(); renderWordList(); };
    bl.appendChild(d);
  });
}

function renderWordList() {
  const book = books.find(b => b.id === activeBook);
  const c = document.getElementById('word-list-content');
  document.getElementById('list-title').textContent = book ? `${book.title} — 単語リスト` : 'Word List';

  if (!book) {
    c.innerHTML = '<p class="empty-state">Select or create a book.</p>';
    return;
  }

  if (!book.words.length) {
    c.innerHTML = '<p class="empty-state">No words yet. Look up words and add them here.</p>';
    return;
  }

  let html = `<div style="margin-bottom:10px;display:flex;gap:8px;flex-wrap:wrap">
    <button class="btn btn-sm btn-outline" onclick="exportCSV()">Export CSV</button>
    <button class="btn btn-sm btn-outline" style="color:var(--red);border-color:var(--red)" onclick="deleteBook()">Delete Book</button>
  </div>
  <table class="words-table">
    <thead><tr><th>Kanji</th><th>Reading</th><th>Meaning</th><th></th></tr></thead>
    <tbody>`;

  book.words.forEach((w, i) => {
    html += `<tr>
      <td class="kanji-cell">${escapeHTML(w.word)}</td>
      <td class="reading-cell">${escapeHTML(w.reading)}</td>
      <td class="meaning-cell">${escapeHTML(w.meaning)}</td>
      <td class="action-cell"><button class="del-btn" onclick="removeWord(${i})" title="Remove">✕</button></td>
    </tr>`;
  });

  html += '</tbody></table>';
  c.innerHTML = html;
}

function removeWord(idx) {
  const book = books.find(b => b.id === activeBook);
  if (!book) return;
  book.words.splice(idx, 1);
  saveBooks();
  renderWordList();
}

function deleteBook() {
  if (!confirm('Delete this book and all its words?')) return;
  books = books.filter(b => b.id !== activeBook);
  activeBook = null;
  saveBooks();
  renderBookList();
  document.getElementById('word-list-content').innerHTML = '<p class="empty-state">Select or create a book.</p>';
}

function exportCSV() {
  const book = books.find(b => b.id === activeBook);
  if (!book) return;
  const rows = [['Word','Reading','Meaning'], ...book.words.map(w => [w.word, w.reading, w.meaning])];
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = (book.title || 'wordlist') + '.csv';
  a.click();
}
