// Test van het lopen: de straat op, vooruit lopen, een fatbiker van zijn fiets slaan, ruzie en een klap krijgen.
//   node tools/loop.cjs [uitmap]
const { chromium } = require("/root/tools/pw/node_modules/playwright-core");
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const UIT = process.argv[2] ?? "/tmp/fbs/loop";
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
  await page.goto("http://spel.test/?level=julianaplein");
  await page.waitForSelector("#start:not([hidden])", { timeout: 120000 });
  await page.tap("#begin");
  await page.waitForTimeout(1500);
  await page.tap("#loopKnop");
  await page.waitForFunction(() => window.__spel.loop.aan, null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { window.__spel.straat.strafbaar = () => {}; }); // deze test gaat over lopen en vechten, niet over gezocht worden
  const S = () => page.evaluate(() => { const s = window.__spel, l = s.loop; return JSON.stringify({ pos: [+l.pos.x.toFixed(1), +l.pos.z.toFixed(1)], v: +l.snelheid.toFixed(1), neer: +l.neer.toFixed(1), geraakt: s.spel.geraakt, zoom: s.kijk.zoom }); });
  console.log("op straat", await S());
  await page.screenshot({ path: `${UIT}/1-straat.png` });
  // stick naar voren houden
  const r = { x: 150, y: 280, R: 56 }; // ergens links op het scherm: daar verschijnt de stuurknuppel
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: r.x, y: r.y, id: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: r.x, y: r.y - r.R * 0.95, id: 1 }] });
  await page.waitForTimeout(4000);
  // tweede vinger op de actieknop terwijl je loopt: schieten met het pistool
  const vu = await page.evaluate(() => { const v = document.querySelector("#vuur").getBoundingClientRect(); return { x: v.x + v.width / 2, y: v.y + v.height / 2 }; });
  const k0 = await page.evaluate(() => window.__spel.spel.kogels);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: r.x, y: r.y - r.R * 0.95, id: 1 }, { x: vu.x, y: vu.y, id: 2 }] });
  await page.waitForTimeout(400);
  // de tweede vinger weer los (de eerste blijft liggen)
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: r.x, y: r.y - r.R * 0.95, id: 1 }] });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${UIT}/2b-pistool.png` });
  console.log("schieten tijdens het lopen:", await page.evaluate((k0) => `kogels ${k0} -> ${window.__spel.spel.kogels}, stick nog vast: ${window.__spel.loop.stick.y.toFixed(2)}`, k0));
  console.log("na lopen", await S());
  await page.screenshot({ path: `${UIT}/2-lopen.png` });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  // een fatbike voor je neus en slaan
  await page.evaluate(() => {
    const s = window.__spel, l = s.loop, f = s.reizigers.find((r) => r.fat);
    const fx = Math.sin(s.kijk.yaw), fz = Math.cos(s.kijk.yaw);
    f.wacht = 1e9; f.vlucht = 0; f.schrikken = () => {}; f.vrij = null;
    const zet = () => { if (f.toestand === "rijden") { f.pos.set(l.pos.x + fx * 1.6, 0, l.pos.z + fz * 1.6); f.pad.copy(f.pos); } };
    zet(); window.__iv = setInterval(zet, 30);
  });
  await page.waitForTimeout(2500);
  await page.tap("#wapen"); // pistool -> vuisten
  console.log("wapen:", await page.evaluate(() => window.__spel.loop.wapen));
  await page.tap("#vuur");
  await page.waitForFunction(() => window.__spel.spel.geraakt > 0, null, { timeout: 120000 }).then(() => console.log("fatbiker van zijn fiets geslagen")).catch(() => console.log("slaan MISLUKT"));
  await page.evaluate(() => clearInterval(window.__iv));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${UIT}/3-slaan.png` });
  await page.waitForFunction(() => window.__spel.vallers.some((v) => v.toestand === "rent"), null, { timeout: 300000 }).then(() => console.log("fatbiker rent weg")).catch(() => console.log("fatbiker rent NIET weg"));
  await page.screenshot({ path: `${UIT}/3b-rent.png` });
  // ruzie: iemand voor je neus die uithaalt
  await page.evaluate(() => {
    const s = window.__spel, l = s.loop, v = s.reizigers.find((r) => r.ruzie && r.groep.visible && !r.zit);
    const fx = Math.sin(s.kijk.yaw), fz = Math.cos(s.kijk.yaw);
    v.pos.set(l.pos.x + fx * 1.2, 0, l.pos.z + fz * 1.2); if (v.pad?.copy && v.pad !== v.pos) v.pad.copy(v.pos);
    v.ruzie(l.pos, true, s.klapKrijgen);
  });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${UIT}/4-ruzie.png` });
  await page.waitForFunction(() => window.__spel.loop.conditie < 3 || window.__spel.loop.neer > 0, null, { timeout: 200000 }).then(() => console.log("klap gekregen: wankelt")).catch(() => console.log("GEEN klap gekregen"));
  await page.evaluate(() => window.__spel.klapKrijgen()); // en een harde klap (zoals van een auto): neer
  await page.waitForFunction(() => window.__spel.loop.neer > 0, null, { timeout: 200000 }).then(() => console.log("harde klap: neer")).catch(() => console.log("NIET neer"));
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${UIT}/4b-neer.png` });
  await page.waitForFunction(() => window.__spel.loop.neer <= 0, null, { timeout: 300000 }).then(() => console.log("weer opgestaan")).catch(() => console.log("NIET opgestaan"));
  // mes: band lek steken
  await page.tap("#wapen");
  console.log("wapen:", await page.evaluate(() => window.__spel.loop.wapen));
  const g0 = await page.evaluate(() => {
    const s = window.__spel, l = s.loop, f = s.reizigers.find((r) => r.fat && r.toestand === "rijden");
    const fx = Math.sin(s.kijk.yaw), fz = Math.cos(s.kijk.yaw);
    f.wacht = 1e9; f.vlucht = 0; f.schrikken = () => {}; f.vrij = null;
    const zet = () => { if (f.toestand === "rijden") { f.pos.set(l.pos.x + fx * 1.6, 0, l.pos.z + fz * 1.6); f.pad.copy(f.pos); } };
    zet(); window.__iv = setInterval(zet, 30);
    return s.spel.geraakt;
  });
  await page.waitForTimeout(2500);
  await page.tap("#vuur");
  await page.waitForFunction((g0) => window.__spel.spel.geraakt > g0, g0, { timeout: 120000 }).then(() => console.log("band lek gestoken")).catch(() => console.log("mes MISLUKT"));
  console.log("laatste treffer:", await page.evaluate(() => JSON.stringify(window.__spel.spel.laatste ?? null)));
  await page.evaluate(() => clearInterval(window.__iv));
  await page.screenshot({ path: `${UIT}/4c-mes.png` });
  console.log("eind", await S());
  await page.tap("#loopKnop");
  await page.waitForFunction(() => !window.__spel.loop.aan, null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${UIT}/5-terug.png` });
  console.log("terug bij het raam:", await page.evaluate(() => window.__spel.stand()));
  console.log(fouten.join("\n") || "geen fouten");
  await browser.close();
})();
