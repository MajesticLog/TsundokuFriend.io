/* =========================
   INIT
========================= */

window.addEventListener('resize', resizeCanvas);

function initApp() {
  // Canvas + UI
  resizeCanvas();
  clearCanvas(true);

  // Books panel
  renderBookList();

  // Flashcards setup (if user opens tab)
  // no-op here; nav.js will call showFlashcardsSetup when needed
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}

function applyTheme(theme) {
  const t = (theme || "flowers").toLowerCase();
  if (t === "flowers") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", t);
  }
  localStorage.setItem("tsundoku-theme", t);
}

function initThemeUI() {
  const select = document.getElementById("themeSelect");
  const saved = localStorage.getItem("tsundoku-theme") || "flowers";
  applyTheme(saved);
  if (select) {
    select.value = saved;
    select.addEventListener("change", () => applyTheme(select.value));
  }
}

document.addEventListener("DOMContentLoaded", initThemeUI);

