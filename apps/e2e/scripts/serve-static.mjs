// Minimal static file server for built sites (the Storybook build) — no
// dependencies. Usage: node scripts/serve-static.mjs <dir> <port>
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const [root = ".", port = "3106"] = process.argv.slice(2);
const base = path.resolve(root);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".map": "application/json",
};

if (!fs.existsSync(path.join(base, "index.html"))) {
  console.error(`No build found in ${base}. Run the build first.`);
  process.exit(1);
}

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    let file = path.join(base, decodeURIComponent(url.pathname));
    if (!file.startsWith(base)) {
      res.writeHead(403).end();
      return;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      file = path.join(file, "index.html");
    }
    if (!fs.existsSync(file)) {
      res.writeHead(404).end("Not found");
      return;
    }
    res.writeHead(200, {
      "content-type": TYPES[path.extname(file)] ?? "application/octet-stream",
    });
    fs.createReadStream(file).pipe(res);
  })
  .listen(Number(port), () => {
    console.log(`Serving ${base} on http://localhost:${port}`);
  });
