// Opent het spel in Chromium zonder webserver (bestanden komen rechtstreeks van schijf) en maakt schermafbeeldingen.
//   node tools/kijk.cjs [uitmap] [telefoon]
const { chromium, devices } = require("/root/tools/pw/node_modules/playwright-core");
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const UIT = process.argv[2] ?? "/tmp/fbs/shots";
const TEL = process.argv[3] === "telefoon";
const TYPE = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".glb": "model/gltf-binary", ".webmanifest": "application/manifest+json" };

(async () => {
  fs.mkdirSync(UIT, { recursive: true });
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const ctx = await browser.newContext(TEL ? { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await ctx.route("http://spel.test/**", (route) => {
    let p = decodeURIComponent(new URL(route.request().url()).pathname);
    if (p.endsWith("/")) p += "index.html";
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) return route.fulfill({ status: 404, body: "nee" });
    route.fulfill({ status: 200, body: fs.readFileSync(f), contentType: TYPE[path.extname(f)] ?? "application/octet-stream" });
  });
  const page = await ctx.newPage();
  const fouten = [];
  page.on("pageerror", (e) => fouten.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") fouten.push(m.type() + ": " + m.text()); });
  page.on("request", (r) => { if (/three/.test(r.url())) fouten.push("laadt " + r.url().replace("http://spel.test", "")); });
  const t0 = Date.now();
  await page.goto("http://spel.test/");
  await page.waitForSelector("#start:not([hidden])", { timeout: 120000 });
  console.log("geladen in", Date.now() - t0, "ms");
  await page.screenshot({ path: `${UIT}/1-start.png` });
  await page.click("#begin");
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${UIT}/2-overzicht.png` });
  console.log("draw calls", await page.evaluate(() => window.__spel.renderer.info.render.calls), "driehoeken", await page.evaluate(() => window.__spel.renderer.info.render.triangles));
  // kijker op de parkeerplaats
  await page.evaluate(() => { const s = window.__spel; s.zetZoom(4); });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${UIT}/3-kijker.png` });
  // richt op de dichtstbijzijnde fatbike en schiet
  // even wachten tot de fatbikes het plein op rijden
  await page.waitForFunction(() => window.__spel.reizigers.some((r) => r.fat && Math.hypot(r.pos.x, r.pos.z) < 45), null, { timeout: 120000 }).catch(() => console.log("geen fatbike dichtbij"));
  for (let i = 0; i < 6; i++) {
    const r = await page.evaluate((i) => {
      const s = window.__spel;
      const f = s.reizigers.filter((r) => r.fat)[0];
      if (!f) return "geen fatbike";
      // vrij schootsveld: geparkeerde auto's staan elke keer anders en maken de test anders wisselvallig
      s.stil.length = 0;
      for (const r of s.reizigers) if (!r.fat) { r.wacht = 1e9; r.pos.set(500, 0, 500); if (r.pad?.copy && r.pad !== r.pos) r.pad.copy(r.pos); }
      // zet hem stil op een vrije plek op de parkeerplaats, dwars op de kijklijn
      const plek = [[4, -14], [-2, -30], [8, -22], [-12, -24], [-15, -20], [20, -5]][i % 6];
      f.wacht = 1e9; f.vlucht = 0; f.schrikken = () => {}; f.pos.set(plek[0], 0, plek[1]); f.pad.copy(f.pos); f.richting = 1.3;
      f.groep.position.copy(f.pos); f.groep.rotation.y = f.richting; f.groep.updateMatrixWorld(true);
      // mik op het achterwiel, vanuit je ogen
      const c = s.oog;
      const p = i % 2 ? f.fiets.localToWorld(f.pos.clone().set(0, 0.6, 0.1)) : f.fiets.userData.wielen[0].getWorldPosition(f.pos.clone());
      // even voorhouden
      
      s.kijk.yaw = Math.atan2(p.x - c.x, p.z - c.z);
      s.kijk.pitch = Math.atan2(p.y - c.y, Math.hypot(p.x - c.x, p.z - c.z));
      s.zetZoom(12);
      return `fatbike op ${Math.round(Math.hypot(p.x - c.x, p.z - c.z))} m`;
    }, i);
    await page.waitForFunction(() => window.__spel.herlaad <= 0 && !document.body.classList.contains("film"), null, { timeout: 120000 });
    if (i === 0) await page.screenshot({ path: `${UIT}/4-mikken.png` });
    await page.evaluate(() => { window.__spel.schiet(); });
    await page.waitForTimeout(700);
    if (i < 2) await page.screenshot({ path: `${UIT}/5-raak${i}.png` });
    await page.waitForTimeout(800);
    console.log(i, r, await page.evaluate(() => JSON.stringify({ geraakt: window.__spel.spel.geraakt, fouten: window.__spel.spel.fouten, kogels: window.__spel.spel.kogels, laatste: window.__spel.spel.laatste })));
  }
  // de laatste fatbike: vertraagd camerashot en het eindscherm
  const nogBezig = await page.evaluate(() => window.__spel.spel.bezig && window.__spel.reizigers.some((r) => r.fat));
  if (nogBezig) {
    await page.waitForFunction(() => window.__spel.herlaad <= 0 && !document.body.classList.contains("film"), null, { timeout: 60000 });
    await page.evaluate(() => {
      const s = window.__spel;
      s.spel.geraakt = s.spel.ri.fatbikes - 1; s.spel.fouten = 0;
      // vrij schootsveld: geparkeerde auto's en anderen tellen even niet mee
      s.stil.length = 0;
      for (const r of s.reizigers) if (!r.fat) { r.wacht = 1e9; r.pos.set(500, 0, 500); r.pad.copy(r.pos); }
      const f = s.reizigers.find((r) => r.fat);
      f.wacht = 1e9; f.vlucht = 0; f.schrikken = () => {}; f.pos.set(4, 0, -14); f.pad.copy(f.pos); f.richting = 1.3;
      f.groep.position.copy(f.pos); f.groep.rotation.y = f.richting; f.groep.updateMatrixWorld(true);
      s.zetZoom(12);
      const c = s.oog, p = f.fiets.userData.wielen[1].getWorldPosition(f.pos.clone());
      s.kijk.yaw = Math.atan2(p.x - c.x, p.z - c.z); s.kijk.pitch = Math.atan2(p.y - c.y, Math.hypot(p.x - c.x, p.z - c.z));
    });
    // in swiftshader duurt één beeld soms een seconde: wacht tot de camera echt gedraaid is
    await page.waitForTimeout(3000);
    console.log("richt", await page.evaluate(() => { const s = window.__spel, f = s.reizigers.find((r) => r.fat), d = s.camera.getWorldDirection(f.pos.clone()); return JSON.stringify({ fpos: f.pos.toArray(), wacht: f.wacht, d: d.toArray().map((v) => +v.toFixed(3)), yaw: s.kijk.yaw, pitch: s.kijk.pitch }); }));
    console.log("voor schot", await page.evaluate(() => JSON.stringify({ k: window.__spel.spel.kogels, g: window.__spel.spel.geraakt, b: window.__spel.spel.bezig })));
    await page.evaluate(() => { window.__spel.schiet(); });
    await page.waitForTimeout(2000);
    console.log("na schot", await page.evaluate(() => JSON.stringify({ k: window.__spel.spel.kogels, g: window.__spel.spel.geraakt, f: window.__spel.spel.fouten, film: document.body.className, laatste: window.__spel.spel.laatste, cam: window.__spel.camera.position.toArray(), pos: window.__spel.reizigers.find((r) => r.fat)?.pos.toArray() })));
    await page.waitForFunction(() => document.body.classList.contains("film"), null, { timeout: 30000 }).catch(() => console.log("geen filmshot"));
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${UIT}/6-film.png` });
    await page.waitForSelector("#einde:not([hidden])", { timeout: 120000 }).catch(() => console.log("geen eindscherm"));
  }
  await page.screenshot({ path: `${UIT}/7-einde.png` });
  console.log("einde:", await page.evaluate(() => document.querySelector("#eindeKop").textContent + " | " + document.querySelector("#eindeScore").textContent));
  console.log(fouten.slice(0, 15).join("\n") || "geen fouten");
  await browser.close();
})();
