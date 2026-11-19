// Resolve the light/dark theme before React paints, to avoid a flash of the
// wrong mode. A module (not an inline <script>) so the production CSP needs no
// 'unsafe-inline'.
try {
  let mode = localStorage.getItem("fc-theme");
  if (!mode) mode = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", mode);
} catch {
  document.documentElement.setAttribute("data-theme", "dark");
}

export {};
