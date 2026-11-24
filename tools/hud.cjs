// Controleert of knoppen elkaar of het midden van het beeld overlappen, op kleine en grote telefoons, bij het raam, lopend en rijdend.
//   node tools/hud.cjs [uitmap]
const { chromium } = require("/root/tools/pw/node_modules/playwright-core");
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const UIT = process.argv[2] ?? "/tmp/fbs/hud";
const T = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".mp3": "audio/mpeg" };
(async () => {
  fs.mkdirSync(UIT, { recursive: true });
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const fout = [];
  for (const [w, h] of [[667, 375], [844, 390], [932, 430]]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
    await p.route("http://spel.test/**", (r) => { let f = new URL(r.request().url()).pathname; if (f.endsWith("/")) f += "index.html"; f = path.join(ROOT, f); r.fulfill(fs.existsSync(f) ? { body: fs.readFileSync(f), contentType: T[path.extname(f)] ?? "application/octet-stream" } : { status: 404 }); });
    p.on("pageerror", (e) => fout.push(e.message));
    await p.goto("http://spel.test/?licht=0&level=buskenhuet"); await p.waitForSelector("#start:not([hidden])", { timeout: 120000 });
    await p.tap("#begin"); await p.waitForTimeout(2500);
    const meet = (naam) => p.evaluate((naam) => {
      const els = [...document.querySelectorAll("#hud .knop, #hud .pil, #radar, #zoom, #stick")].filter((e) => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return s.display !== "none" && !e.hidden && r.width > 0 && s.opacity !== "0"; });
      const R = els.map((e) => [e.id, e.getBoundingClientRect()]), uit = [];
      for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) { const a = R[i][1], c = R[j][1]; const ox = Math.min(a.right, c.right) - Math.max(a.left, c.left), oy = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top); if (ox > 3 && oy > 3) uit.push(`${R[i][0]}×${R[j][0]}`); }
      const mx = innerWidth / 2, my = innerHeight / 2;
      for (const [id, r] of R) { if (r.left < mx + 60 && r.right > mx - 60 && r.top < my + 50 && r.bottom > my - 50) uit.push(`${id} in het midden`); if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) uit.push(`${id} buiten beeld`); }
      return `${naam}: ${uit.join(", ") || "vrij"}`;
    }, naam);
    console.log(`${w}×${h}`, await meet("raam"));
    await p.tap("#loopKnop"); await p.waitForFunction(() => window.__spel.loop.aan, null, { timeout: 60000 }); await p.waitForTimeout(1500);
    console.log(`${w}×${h}`, await meet("lopen"));
    if (w === 667) { await p.waitForTimeout(2500); await p.screenshot({ path: `${UIT}/lopen-${w}.png` }); }
    await p.evaluate(() => { document.body.classList.add("rijdt"); });
    console.log(`${w}×${h}`, await meet("rijden"));
    await p.close();
  }
  console.log(fout.join("\n") || "geen fouten");
  await b.close();
})();
