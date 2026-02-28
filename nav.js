/* =========================
   NAV
========================= */
function showPanel(id, btn) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  document.getElementById('panel-' + id).classList.add('active');

  if (btnEl) {
    btnEl.classList.add('active');
  } else {
    const map = { lookup: 0, lists: 1, writing: 2, radicals: 3, flashcards: 4 };
    const i = map[id];
    const btns = document.querySelectorAll('nav button');
    if (btns[i]) btns[i].classList.add('active');
  }

  if (id === 'lists') renderBookList();
  if (id === 'radicals') renderRadicals();
  if (id === 'flashcards') {
    document.getElementById('fc-setup').style.display = 'block';
    document.getElementById('fc-study').classList.remove('active');
    document.getElementById('fc-results').classList.remove('active');
    showFlashcardsSetup();
  }
  if (id === 'writing') {
    if (typeof hwResizeAll === 'function') hwResizeAll();
  }
}
