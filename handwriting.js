/* =========================
   HANDWRITING RECOGNITION
   (Google Input Tools)
========================= */
async function recognizeHandwriting() {
  const status = document.getElementById("hw-status");
  const out = document.getElementById("hw-candidates");

  const usable = strokes.filter(st => st && st.length >= 2);
  if (!usable.length) {
    status.textContent = "Draw a kanji first 🙂";
    out.innerHTML = "";
    return;
  }

  status.textContent = "Recognizing…";
  out.innerHTML = "";

  // Convert strokes into the format expected by Google:
  // ink = [ [x1,x2...], [y1,y2...] ] per stroke
  const ink = usable.map(st => ([
    st.map(p => Math.round(p.x)),
    st.map(p => Math.round(p.y)),
  ]));

  const payload = JSON.stringify([
    "ja",
    [canvas.width, canvas.height],
    ink,
    0,
    0
  ]);

  try {
    const r = await fetch(
      "https://inputtools.google.com/request?itc=ja-t-i0-handwrit&app=translate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      }
    );

    const data = await r.json();
    // Expected: ["SUCCESS", [[<ignored>, [candidates...], ...]]]
    if (!Array.isArray(data) || data[0] !== "SUCCESS") {
      status.textContent = "No result. Try writing larger / clearer.";
      return;
    }

    const candidates = data?.[1]?.[0]?.[1] || [];
    if (!candidates.length) {
      status.textContent = "No candidates returned. Try again.";
      return;
    }

    status.textContent = "Pick the correct kanji:";
    candidates.slice(0, 12).forEach(c => {
      const btn = document.createElement("button");
      btn.className = "btn btn-sm btn-outline";
      btn.textContent = c;
      btn.style.fontFamily = "'Noto Serif JP', serif";
      btn.onclick = () => {
        document.getElementById("search-input").value = c;
        showPanel("lookup");
        lookupWord();
      };
      out.appendChild(btn);
    });
  } catch (e) {
    status.textContent = "Recognition failed (network blocked). Try again, or use radicals.";
  }
}
