// node tools/mensen/proef.cjs <uit.png> [mensen,komma] [bewegingen,komma]
const { chromium } = require("/root/tools/pw/node_modules/playwright-core");
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const TYPE = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".glb": "model/gltf-binary" };
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage({ viewport: { width: 1600, height: 600 } });
  await p.route("http://spel.test/**", (r) => {
    const f = path.join(ROOT, new URL(r.request().url()).pathname);
    r.fulfill(fs.existsSync(f) ? { body: fs.readFileSync(f), contentType: TYPE[path.extname(f)] ?? "application/octet-stream" } : { status: 404 });
  });
  const fout = []; p.on("pageerror", (e) => fout.push(e.message)); p.on("console", (m) => (m.type() === "error" || m.text().startsWith("m")) && fout.push(m.text()));
  const q = new URLSearchParams(); if (process.argv[3]) q.set("m", process.argv[3]); if (process.argv[4]) q.set("c", process.argv[4]); if (process.argv[5] === "1") q.set("dicht", "1"); if (process.argv[6] === "1") q.set("vlak", "1"); if (process.argv[7] === "1") q.set("norm", "1"); if (process.argv[8]) q.set("afstand", process.argv[8]);
  await p.goto(`http://spel.test/tools/mensen/proef.html?${q}`);
  await p.waitForFunction(() => window.klaar, null, { timeout: 120000 });
  await p.waitForTimeout(3000);
  await p.screenshot({ path: process.argv[2] ?? "/tmp/fbs/mens/proef.png" });
  console.log(fout.join("\n") || "geen fouten");
  await b.close();
})();
