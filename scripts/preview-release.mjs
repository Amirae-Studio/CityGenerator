// Serves the production build the way MakerLab does, to catch release problems
// before uploading:
// - from a versioned sub-path (/v1/), so any absolute "/…" asset path breaks
//   here exactly as it would on https://<appId>.mwapps.com/<version>/
// - with the production CSP from makerlab/config.production.json, so any host
//   missing from connect-src/img-src, or anything else the CSP blocks, shows up
//   as a violation in the browser console.
//
// Usage: npm run build && npm run preview:release
//        http://localhost:4175/sandbox  (inside a sandboxed iframe like MakerLab;
//        ?same=0 without allow-same-origin)
//        npm run preview:release -- --strict   (also drops 'unsafe-inline' from
//        style-src, to check whether the app really needs it; --port 4176 to
//        run both side by side; --drop api.mapbox.com to remove a host from
//        the CSP and check how the app reports it)
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dist = join(root, "dist");
const arg = (name) => process.argv.includes(name);
const portArg = process.argv[process.argv.indexOf("--port") + 1];
const port = Number(arg("--port") ? portArg : process.env.PORT) || 4175;
const strictStyle = arg("--strict") || !!process.env.STRICT_STYLE;
const base = "/v1/";

const config = JSON.parse(await readFile(join(root, "makerlab/config.production.json"), "utf8"));
const directives = { ...config.csp };
if (strictStyle) {
  directives["style-src"] = directives["style-src"].replace(/\s*'unsafe-inline'/, "");
}
// --drop <host> removes a host from every directive, to see how the app
// reports a host the real CSP doesn't allow.
if (arg("--drop")) {
  const host = process.argv[process.argv.indexOf("--drop") + 1];
  for (const k of Object.keys(directives)) directives[k] = directives[k].split(/\s+/).filter((s) => !s.includes(host)).join(" ");
}
// Browsers POST every violation to report-uri; they're printed below, so a
// blocked host or inline style shows up in this terminal even when it happens
// during page load.
const csp = [...Object.entries(directives).map(([k, v]) => `${k} ${v}`), "report-uri /csp-report"].join("; ");
const seen = new Set();

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".wasm": "application/wasm",
  ".stl": "model/stl",
  ".woff2": "font/woff2",
};

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (req.method === "POST" && path === "/csp-report") {
    let body = "";
    for await (const chunk of req) body += chunk;
    try {
      const r = JSON.parse(body)["csp-report"] ?? {};
      const line = `[CSP blocked] ${r["violated-directive"]} ← ${r["blocked-uri"]}${r["source-file"] ? `  (${r["source-file"]}:${r["line-number"]})` : ""}`;
      if (!seen.has(line)) {
        seen.add(line);
        console.warn(line);
      }
    } catch {
      /* not a CSP report */
    }
    res.writeHead(204).end();
    return;
  }
  // /sandbox wraps the app in a sandboxed iframe like MakerLab's host page.
  // ?same=0 drops allow-same-origin, to see what breaks without it.
  if (path === "/sandbox") {
    const same = new URL(req.url, "http://x").searchParams.get("same") !== "0";
    const sandbox = ["allow-scripts", same && "allow-same-origin"].filter(Boolean).join(" ");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<!doctype html><meta charset="utf-8"><title>Sandbox (${sandbox})</title>
<style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%}</style>
<iframe sandbox="${sandbox}" src="${base}"></iframe>`);
    return;
  }
  if (path === "/" || path === "/v1") {
    res.writeHead(302, { Location: base }).end();
    return;
  }
  if (!path.startsWith(base)) {
    // Anything requested outside the versioned path would 404 on MakerLab too.
    // (/favicon.ico is the browser's own automatic request, not the app's.)
    if (path !== "/favicon.ico") console.warn(`[404] outside ${base}: ${path}  ← absolute path in the build?`);
    res.writeHead(404).end("Not found (outside the versioned path)");
    return;
  }
  const rel = path.slice(base.length) || "index.html";
  const file = normalize(join(dist, rel));
  if (!file.startsWith(dist)) {
    res.writeHead(403).end();
    return;
  }
  try {
    if (!(await stat(file)).isFile()) throw new Error("not a file");
    res.writeHead(200, {
      "Content-Type": types[extname(file)] ?? "application/octet-stream",
      "Content-Security-Policy": csp,
    });
    res.end(await readFile(file));
  } catch {
    console.warn(`[404] ${path}`);
    res.writeHead(404).end("Not found");
  }
}).listen(port, () => {
  console.log(`Release preview: http://localhost:${port}${base}`);
  console.log(`CSP: ${csp}`);
});
