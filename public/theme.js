(function () {
  try {
    var e = document.documentElement;
    var t = localStorage.getItem("pos-universal-theme");
    var p = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var d = t ? t === "dark" : p;
    e.classList.toggle("dark", d);
    e.style.colorScheme = d ? "dark" : "light";
    e.dataset.theme = d ? "dark" : "light";
    e.dataset.themeReady = "true";
  } catch (_) {
    document.documentElement.dataset.themeReady = "true";
  }
})();
