
// === Cloudflare Worker endpoints ===
// IMPORTANT: keep this in sync with your deployed Worker.
const WORKER_BASE = "https://minireader.zoe-caudron.workers.dev";
const JISHO_ENDPOINT = WORKER_BASE + "/?keyword=";
const HANDWRITE_ENDPOINT = WORKER_BASE + "/handwrite";
const RADICAL_ENDPOINT = WORKER_BASE + "/radicals?radicals=";

/* =========================
   STATE
========================= */
let books = JSON.parse(localStorage.getItem('rdbooks') || '[]');
let activeBook = null;
let selectedRadicals = new Set();
