// Test van het bonuslevel (Van Steelaan): laden, rondkijken, schieten, klok en eindscherm.
//   node tools/bonus.cjs [uitmap]
const { chromium } = require("/root/tools/pw/node_modules/playwright-core");
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const UIT = process.argv[2] ?? "/tmp/fbs/bonus";
const TYPE = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".glb": "model/gltf-binary", ".png": "image/png" };
(async () => {
  fs.mkdirSync(UIT, { recursive: true });
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  await page.route("http://spel.test/**", (route) => {
    let p = new URL(route.request().url()).pathname;
    if (p.endsWith("/")) p += "index.html";
    const f = path.join(ROOT, p);
    if (!fs.existsSync(f)) return route.fulfill({ status: 404, body: "" });
    route.fulfill({ status: 200, body: fs.readFileSync(f), contentType: TYPE[path.extname(f)] ?? "application/octet-stream" });
  });
  const fouten = [];
  page.on("pageerror", (e) => fouten.push(e.message));
  await page.goto("http://spel.test/?level=steelaan");
  await page.waitForSelector("#start:not([hidden])", { timeout: 120000 });
  await page.screenshot({ path: `${UIT}/1-start.png` });
  await page.tap("#begin");
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${UIT}/2-raam.png` });
  console.log("draw", await page.evaluate(() => window.__spel.renderer.info.render.calls), "driehoeken", await page.evaluate(() => window.__spel.renderer.info.render.triangles));
  // de dichtstbijzijnde fatbike in de kijker en schieten
  for (let i = 0; i < 4; i++) {
    const r = await page.evaluate(() => {
      const s = window.__spel, o = s.oog;
      const f = s.reizigers.filter((r) => r.fat).sort((a, b) => a.pos.distanceTo(o) - b.pos.distanceTo(o))[0];
      if (!f) return "geen";
      f.wacht = 1e9; f.vlucht = 0; f.schrikken = () => {};
      s.zetZoom(6);
      const p = f.fiets.userData.wielen[0].getWorldPosition(f.pos.clone());
      s.kijk.yaw = Math.atan2(p.x - o.x, p.z - o.z); s.kijk.pitch = Math.atan2(p.y - o.y, Math.hypot(p.x - o.x, p.z - o.z));
      return `fatbike op ${Math.round(Math.hypot(p.x - o.x, p.z - o.z))} m`;
    });
    await page.waitForTimeout(3000);
    if (i === 0) await page.screenshot({ path: `${UIT}/3-kijker.png` });
    await page.waitForFunction(() => !document.querySelector("#vuur").classList.contains("laadt") && !document.body.classList.contains("film"), null, { timeout: 120000 });
    await page.evaluate(() => window.__spel.schiet());
    await page.waitForTimeout(2500);
    console.log(i, r, await page.evaluate(() => JSON.stringify({ geraakt: window.__spel.spel.geraakt, fouten: window.__spel.spel.fouten, tijd: Math.round(window.__spel.spel.tijd), fatbikes: window.__spel.reizigers.filter((r) => r.fat).length, laatste: window.__spel.spel.laatste })));
  }
  await page.evaluate(() => window.__spel.zetZoom(1));
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${UIT}/4-na.png` });
  await page.evaluate(() => { window.__spel.spel.tijd = 1; });
  await page.waitForSelector("#einde:not([hidden])", { timeout: 60000 }).catch(() => console.log("geen eindscherm"));
  await page.screenshot({ path: `${UIT}/5-einde.png` });
  console.log("einde:", await page.evaluate(() => document.querySelector("#eindeKop").textContent + " | " + document.querySelector("#eindeScore").textContent));
  console.log(fouten.join("\n") || "geen fouten");
  await browser.close();
})();
