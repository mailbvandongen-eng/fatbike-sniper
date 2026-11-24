// Test van het autorijden: instappen in de eigen RAV4 (zonder straf), rijden, sturen, botsen, uitstappen, en een andere auto stelen.
//   node tools/rijden.cjs [uitmap]
const { chromium } = require("/root/tools/pw/node_modules/playwright-core");
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const UIT = process.argv[2] ?? "/tmp/fbs/rijden";
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
  await page.goto("http://spel.test/?licht=0&level=steelaan");
  await page.waitForSelector("#start:not([hidden])", { timeout: 120000 });
  await page.tap("#begin"); await page.waitForTimeout(1500);
  await page.tap("#loopKnop"); await page.waitForFunction(() => window.__spel.loop.aan, null, { timeout: 30000 }); await page.waitForTimeout(1500);
  const stap = (sec) => page.evaluate((sec) => { const s = window.__spel; for (let t = 0; t < sec; t += 0.05) s.stapLopen(0.05); }, sec);
  const S = () => page.evaluate(() => { const s = window.__spel, r = s.rij; return JSON.stringify({ rijdt: r.aan, soort: r.auto?.userData.soort, v: +r.v.toFixed(1), pos: [+s.loop.pos.x.toFixed(1), +s.loop.pos.z.toFixed(1)], sterren: s.straat.sterren(), hitte: +s.straat.hitte.toFixed(2) }); });
  // ---------- de eigen RAV4 ----------
  const rav = await page.evaluate(() => { const s = window.__spel, st = s.stil.find((x) => x.object.userData.soort === "rav4"); if (!st) return null; const o = st.object; s.loop.pos.set(o.position.x + Math.cos(o.rotation.y) * 2, 0, o.position.z - Math.sin(o.rotation.y) * 2); return [o.position.x, o.position.z]; });
  console.log("RAV4 staat op", JSON.stringify(rav));
  await stap(0.1);
  console.log("knop zichtbaar:", await page.evaluate(() => document.querySelector("#instap").classList.contains("kan")));
  await page.evaluate(() => { const s = window.__spel; s.kijk.yaw = Math.atan2(s.rij.kans.object.position.x - s.loop.pos.x, s.rij.kans.object.position.z - s.loop.pos.z) + 0.5; s.loop.keek = performance.now() + 4000; });
  await page.waitForTimeout(3000); await page.screenshot({ path: `${UIT}/1-bij-rav4.png` });
  await page.tap("#instap"); await stap(0.6);
  await page.evaluate(() => { const r = window.__spel.rij; r.auto.userData.r0 = r.richting; });
  console.log("ingestapt in eigen auto:", await S());
  // wegrijden uit het parkeervak: gas en naar de rijbaan sturen (we proberen links, en anders rechts)
  const p0 = await page.evaluate(() => window.__spel.loop.pos.toArray());
  for (const kant of ["KeyA", "KeyD"]) {
    await page.evaluate((k) => { const t = window.__spel.loop.toets; t.KeyW = true; t[k] = true; }, kant); await stap(1.6);
    await page.evaluate((k) => { window.__spel.loop.toets[k] = false; }, kant); await stap(0.3);
    const tegen = kant === "KeyA" ? "KeyD" : "KeyA";
    await page.evaluate((k) => { window.__spel.loop.toets[k] = true; }, tegen); await stap(1.2);
    await page.evaluate((k) => { window.__spel.loop.toets[k] = false; }, tegen); await stap(3);
    const d = await page.evaluate((p0) => Math.hypot(window.__spel.loop.pos.x - p0[0], window.__spel.loop.pos.z - p0[2]), p0);
    console.log("wegrijden met", kant === "KeyA" ? "links" : "rechts", "sturen:", d.toFixed(0), "m verder,", await S());
    if (d > 25) break;
    // terug naar het begin voor de andere kant
    await page.evaluate((p0) => { const s = window.__spel; s.loop.toets.KeyW = false; s.rij.v = 0; s.rij.auto.position.set(p0[0], 0, p0[2]); s.rij.richting = s.rij.auto.userData.r0 ?? s.rij.richting; }, p0);
  }
  await page.waitForTimeout(3500); await page.screenshot({ path: `${UIT}/2-rijden.png` });
  await page.evaluate(() => { const t = window.__spel.loop.toets; t.KeyW = false; t.KeyS = true; }); await stap(1.2);
  console.log("remmen:", await S());
  await page.evaluate(() => { window.__spel.loop.toets.KeyS = false; }); await stap(4);
  console.log("uitgerold:", await S());
  await page.tap("#instap"); await stap(0.1);
  console.log("uitgestapt:", await S(), "auto staat er nog:", await page.evaluate(() => window.__spel.stil.some((x) => x.object.userData.soort === "rav4" && x.object.userData.wielen)));
  await page.waitForTimeout(3000); await page.screenshot({ path: `${UIT}/3-uitgestapt.png` });
  // ---------- een andere auto stelen ----------
  await page.evaluate(() => { const s = window.__spel, st = s.stil.filter((x) => x.soort === "auto" && !["rav4", "colt"].includes(x.object.userData.soort)).sort((a, b) => a.object.position.distanceTo(s.loop.pos) - b.object.position.distanceTo(s.loop.pos))[0]; const o = st.object; s.loop.pos.set(o.position.x + Math.cos(o.rotation.y) * 1.9, 0, o.position.z - Math.sin(o.rotation.y) * 1.9); });
  await stap(0.1);
  await page.tap("#instap"); await stap(0.3);
  console.log("ruit ingeslagen, nog niet binnen:", await S());
  await stap(1.2);
  console.log("gestolen auto:", await S());
  await page.evaluate(() => { window.__spel.loop.toets.KeyW = true; }); await stap(2.5);
  await page.waitForTimeout(3500); await page.screenshot({ path: `${UIT}/4-gestolen.png` });
  console.log(fouten.join("\n") || "geen fouten");
  await browser.close();
})();
