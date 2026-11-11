// Stand-in for Caddy: one origin serving the app and passing server paths (incl. WebSocket) to :8787.
const http = require("http"), fs = require("fs"), path = require("path"), net = require("net");
const ROOT = process.argv[2], API = /^\/(live|health|sync|sessions|guests|notices|programs|events|public|public\.json|club)(\/|$|\?)/;
const types = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".png": "image/png", ".json": "application/json", ".webmanifest": "application/manifest+json", ".woff2": "font/woff2" };
const srv = http.createServer((req, res) => {
  if (API.test(req.url)) { const p = http.request({ host: "127.0.0.1", port: 8787, path: req.url, method: req.method, headers: req.headers }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); }); req.pipe(p); return; }
  let f = path.join(ROOT, decodeURIComponent(req.url.split("?")[0])); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(ROOT, "index.html");
  res.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
});
srv.on("upgrade", (req, sock, head) => { const up = net.connect(8787, "127.0.0.1", () => { up.write(`${req.method} ${req.url} HTTP/1.1\r\n` + Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join("\r\n") + "\r\n\r\n"); up.write(head); sock.pipe(up).pipe(sock); }); up.on("error", () => sock.destroy()); });
srv.listen(4180);
