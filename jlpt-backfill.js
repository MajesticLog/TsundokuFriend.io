/* =============================================================
   JLPT Backfill
   One-time patch: for any vocab entry saved without a JLPT
   level, fetches it from kanjiapi and updates localStorage.
   Runs once on page load, marks itself done so it never repeats.
   ============================================================= */
(async function backfillJlpt() {
  if (localStorage.getItem('jlpt-backfill-done')) return;

  let shelf;
  try { shelf = JSON.parse(localStorage.getItem('tsundoku-shelf') || '[]'); }
  catch (_) { return; }

  let anyUpdated = false;

  for (const entry of shelf) {
    if (!entry.vocab || !entry.vocab.length) continue;
    for (const vocab of entry.vocab) {
      if (vocab.jlpt) continue; // already has JLPT, skip

      // Find the first kanji character in the word
      const kanji = [...(vocab.word || '')].find(c => /[\u4e00-\u9fff\u3400-\u4dbf]/.test(c));
      if (!kanji) continue;

      try {
        const r = await fetch('https://kanjiapi.dev/v1/kanji/' + encodeURIComponent(kanji), {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(2000),
        });
        if (!r.ok) continue;
        const k = await r.json();
        if (!k.jlpt) continue;
        vocab.jlpt = 'jlpt-' + k.jlpt.toLowerCase(); // e.g. "jlpt-n3"
        anyUpdated = true;
      } catch (_) {
        // skip this word, leave blank
      }

      // Small delay between requests to be polite to kanjiapi
      await new Promise(res => setTimeout(res, 80));
    }
  }

  if (anyUpdated) {
    localStorage.setItem('tsundoku-shelf', JSON.stringify(shelf));
    if (typeof renderShelfDetail === 'function') renderShelfDetail();
    if (typeof renderShelf === 'function') renderShelf();
    console.log('[jlpt-backfill] Done — updated JLPT levels');
  }

  localStorage.setItem('jlpt-backfill-done', '1');
})();
