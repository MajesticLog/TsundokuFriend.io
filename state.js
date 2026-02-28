// =========================
// Config (endpoints)
// =========================
window.TSUNDOKU_CONFIG = {
  jishoApi: "https://jisho.org/api/v1/search/words?keyword=",
  handwriteEndpoint: "https://minireader.zoe-caudron.workers.dev/handwrite",
};

/* =========================
   STATE
========================= */
let books = JSON.parse(localStorage.getItem('rdbooks') || '[]');
let activeBook = null;
let selectedRadicals = new Set();
