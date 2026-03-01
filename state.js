// =========================
// Config (endpoints)
// =========================
window.TSUNDOKU_CONFIG = {
  jishoApi: "https://minireader.zoe-caudron.workers.dev/?keyword=",
  handwriteEndpoint: "https://minireader.zoe-caudron.workers.dev/handwrite",
};

/* =========================
   STATE
========================= */
let books = JSON.parse(localStorage.getItem('rdbooks') || '[]');
let activeBook = null;
let selectedRadicals = new Set();
