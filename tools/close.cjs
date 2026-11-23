// Close-up van figuren: zet een fatbike, een fiets en een voetganger stil voor de camera en maakt foto's.
//   node tools/close.cjs [uitmap]
const { chromium } = require("/root/tools/pw/node_modules/playwright-core");
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const UIT = process.argv[2] ?? "/tmp/fbs/close";
const TYPE = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".glb": "model/gltf-binary" };
(async () => {
  fs.mkdirSync(UIT, { recursive: true });
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
  await page.route("http://spel.test/**", (route) => {
    let p = new URL(route.request().url()).pathname;
    if (p.endsWith("/")) p += "index.html";
    const f = path.join(ROOT, p);
    if (!fs.existsSync(f)) return route.fulfill({ status: 404, body: "" });
    route.fulfill({ status: 200, body: fs.readFileSync(f), contentType: TYPE[path.extname(f)] ?? "application/octet-stream" });
  });
  const fouten = [];
  page.on("pageerror", (e) => fouten.push(e.message));
  await page.goto("http://spel.test/");
  await page.waitForSelector("#start:not([hidden])", { timeout: 120000 });
  await page.click("#begin");
  await page.waitForTimeout(500);
  // drie fatbikes en een gewone fiets op een rij in de lucht boven het balkon zetten is lastig; we zetten de camera naar beneden
  await page.evaluate(() => {
    const s = window.__spel;
    const fat = s.reizigers.filter((r) => r.fat);
    const fiets = s.reizigers.find((r) => r.soort === "fiets");
    const kar = s.reizigers.find((r) => r.kar && !r.lijn);
    const rij = [fat[0], fiets, kar].filter(Boolean);
    rij.forEach((r, i) => { r.wacht = 1e9; r.v = 0; r.vBasis = 0; r.pos.set(-6 + i * 2.6, 0, -30); r.pad.copy(r.pos); r.richting = Math.PI / 2; });
    window.__vast = () => rij.forEach((r, i) => { r.pos.set(-6 + i * 2.6, 0, -30); r.pad.copy(r.pos); r.richting = Math.PI / 2; });
    setInterval(window.__vast, 50);
    s.zetZoom(1);
  });
  // camera los van de schutter: kijk van opzij naar de rij
  await page.evaluate(() => { const s = window.__spel; s.vrijeCamera = { pos: [-3.4, 1.4, -26.2], doel: [-3.4, 0.9, -30] }; });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${UIT}/rij.png` });
  await page.evaluate(() => { const s = window.__spel; s.vrijeCamera = { pos: [-1.2, 1.3, -32.5], doel: [-6, 1, -29.5] }; });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${UIT}/schuin.png` });
  // door de kijker vanaf het balkon naar de rij (zoals de speler het ziet)
  await page.evaluate(() => { const s = window.__spel; s.vrijeCamera = null; const o = s.oog; s.kijk.yaw = Math.atan2(-4.7 - o.x, -30 - o.z); s.kijk.pitch = Math.atan2(0.9 - o.y, Math.hypot(-4.7 - o.x, -30 - o.z)); s.zetZoom(5); });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${UIT}/kijker.png` });
  await page.evaluate(() => window.__spel.zetZoom(1));
  // een geparkeerde auto van dichtbij
  await page.evaluate(() => { const s = window.__spel; s.vrijeCamera = { pos: [8, 1.8, -16], doel: [4, 0.8, -10] }; });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${UIT}/auto.png` });
  // een rijdende auto met bestuurder, stilgezet
  await page.evaluate(() => { const s = window.__spel; const a = s.reizigers.find((r) => r.soort === "auto"); a.vBasis = 0; a.pos.set(-3, 0, -24); a.pad.copy(a.pos); a.richting = 2.2; window.__a = a; setInterval(() => { a.pos.set(-3, 0, -24); a.pad.copy(a.pos); a.richting = 2.2; }, 50); s.vrijeCamera = { pos: [1.2, 1.5, -19.5], doel: [-3, 0.8, -24] }; });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${UIT}/rijdend.png` });
  // de schutter van opzij, op het balkon
  await page.evaluate(() => { const s = window.__spel; const o = s.oog; s.vrijeCamera = { pos: [o.x + 2.2, o.y, o.z + 0.6], doel: [o.x, o.y - 0.3, o.z] }; });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${UIT}/schutter.png` });
  console.log(fouten.join("\n") || "geen fouten");
  await browser.close();
})();
