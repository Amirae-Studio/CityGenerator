// Resolve the light/dark theme before React paints, to avoid a flash of the
// wrong mode. Light is the default; dark only applies once the visitor picks
// it with the toggle. A module (not an inline <script>) so the production CSP
// needs no 'unsafe-inline'.
try {
  const mode = localStorage.getItem("cg-theme") === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", mode);
} catch {
  document.documentElement.setAttribute("data-theme", "light");
}

export {};
