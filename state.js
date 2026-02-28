/* =========================
   STATE
========================= */
let books = JSON.parse(localStorage.getItem('rdbooks') || '[]');
let activeBook = null;
let selectedRadicals = new Set();
