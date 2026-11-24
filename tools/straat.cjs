// Test van de straat: missies (aanbod, beginnen, doelen uitschakelen, beloning) en gezocht worden (sterren, agenten, aanhouding, ontsnappen).
//   node tools/straat.cjs [uitmap]
// De testbrowser is traag (±1 beeld/s, en per beeld telt het spel hooguit 0,05 s); waar het om tijd gaat, zetten we de
// spelregels zelf een stuk vooruit met straat.stap() en r.stap().
const { chromium } = require("/root/tools/pw/node_modules/playwright-core");
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const UIT = process.argv[2] ?? "/tmp/fbs/straat";
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
  await page.goto("http://spel.test/?licht=0&level=julianaplein");
  await page.waitForSelector("#start:not([hidden])", { timeout: 120000 });
  await page.evaluate(() => localStorage.removeItem("fbs-missies"));
  await page.reload(); await page.waitForSelector("#start:not([hidden])", { timeout: 120000 });
  await page.tap("#begin"); await page.waitForTimeout(1500);
  const buiten = async () => { await page.tap("#loopKnop"); await page.waitForFunction(() => window.__spel.loop.aan, null, { timeout: 30000 }); await page.waitForTimeout(1500); };
  await buiten();
  const vooruit = (sec) => page.evaluate((sec) => { const s = window.__spel; s.graaf.c[0] = s.loop.pos.x; s.graaf.c[1] = s.loop.pos.z; for (let t = 0; t < sec; t += 0.1) { s.straat.stap(0.1, t); for (const r of [...s.reizigers]) if (r.soort === "agent" || r.missie) r.stap(0.1, s.spel); } }, sec);

  // ---------- drie missies achter elkaar ----------
  for (let nr = 0; nr < 3; nr++) {
    await vooruit(8);
    const a = await page.evaluate(() => { const a = window.__spel.straat.aanbod; return a && { soort: a.soort, start: a.start, plek: a.plek }; });
    if (!a) { console.log("missie", nr, "GEEN aanbod"); break; }
    await page.waitForTimeout(2500);
    if (nr === 0) await page.screenshot({ path: `${UIT}/1-aanbod.png` });
    await page.evaluate((a) => { const l = window.__spel.loop; l.pos.set(a.start[0], 0, a.start[1]); }, a);
    await vooruit(0.3);
    const m = await page.evaluate(() => { const M = window.__spel.straat.missie; return M && { soort: M.soort, n: M.n, tijd: M.tijd, afst: M.doelen.map((f) => Math.round(Math.hypot(f.pos.x - window.__spel.loop.pos.x, f.pos.z - window.__spel.loop.pos.z))) }; });
    console.log("missie", nr, JSON.stringify(a.soort), "->", JSON.stringify(m));
    if (!m) break;
    // naar de doelen toe en ze één voor één uitschakelen: mes bij de geparkeerde, vuist bij de rest
    const score0 = await page.evaluate(() => window.__spel.spel.rondeScore);
    for (let i = 0; i < m.n; i++) {
      await page.evaluate((mes) => {
        const s = window.__spel, l = s.loop, f = s.straat.missie?.doelen.find((f) => f.toestand === "rijden");
        if (!f) return;
        f.vrij = null; f.wacht = 1e6; f.vlucht = 0; // stilzetten voor de test
        l.pos.set(f.pos.x - 1.4, 0, f.pos.z); l.slag = 0; l.neer = 0;
        s.kijk.yaw = Math.PI / 2; s.zetWapen(mes ? "mes" : "vuist"); s.actie();
        for (let t = 0; t < 0.9; t += 0.05) s.stapLopen(0.05);
      }, m.soort === "banden");
      if (nr === 0 && i === 0) { await page.waitForTimeout(2500); await page.screenshot({ path: `${UIT}/2-missie.png` }); }
    }
    const na = await page.evaluate(() => ({ missie: !!window.__spel.straat.missie, klaar: window.__spel.straat.missie?.klaar, score: window.__spel.spel.rondeScore, volgnr: window.__spel.straat.volgnr, pil: document.querySelector("#missie").className, hitte: +window.__spel.straat.hitte.toFixed(2) }));
    console.log("   na de doelen:", JSON.stringify(na), "score +", na.score - score0);
    await page.evaluate(() => { window.__spel.straat.reset(false); }); // sterren weg voor de volgende missie
  }

  // ---------- gezocht ----------
  await page.evaluate(() => { const s = window.__spel; s.loop.pos.set(-2, 0, -10); s.zetWapen("pistool"); s.straat.strafbaar(0.5); s.straat.strafbaar(0.6); });
  await vooruit(4);
  const lijst = () => page.evaluate(() => JSON.stringify({ sterren: window.__spel.straat.sterren(), agenten: window.__spel.reizigers.filter((r) => r.soort === "agent" && !r.afdruipen).map((r) => r.rol + " " + Math.round(r.pos.distanceTo(window.__spel.loop.pos)) + " m" + (r.ziet ? " ziet je" : "")) }));
  console.log("na twee schoten:", await lijst());
  await vooruit(4);
  console.log("4 s later:     ", await lijst(), await page.evaluate(() => JSON.stringify(window.__spel.reizigers.filter((r) => r.soort === "agent").map((r) => ({ lijn: r.lijn.length, v: +r.snelheid.toFixed(1), pos: [Math.round(r.pos.x), Math.round(r.pos.z)], doel: r.lijn[0]?.map(Math.round) })))));
  // een handhaver op een paar meter, voor de foto
  await page.evaluate(() => { const s = window.__spel, a = s.reizigers.find((r) => r.soort === "agent"); if (a) a.pos.set(s.loop.pos.x + 2.5, 0, s.loop.pos.z + 4); s.kijk.yaw = 0.55; s.loop.keek = performance.now() + 1e9; });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${UIT}/3-gezocht.png` });
  console.log("naar binnen terwijl ze je zien:", await page.evaluate(() => { const s = window.__spel; s.reizigers.filter((r) => r.soort === "agent").forEach((a) => (a.ziet = true)); return s.straat.sterren() >= 1 && !s.straat.magNaarBinnen() ? "mag niet" : "MAG (fout)"; }));
  // ontsnappen: ver weg, uit het zicht
  await page.evaluate(() => { const s = window.__spel; s.loop.pos.set(-150, 0, 120); for (const a of s.reizigers) if (a.soort === "agent") a.pos.set(-2, 0, -10); });
  await vooruit(4);
  console.log("net uit het zicht:", await lijst());
  await vooruit(16);
  console.log("ontsnapt:", await page.evaluate(() => JSON.stringify({ sterren: window.__spel.straat.sterren(), afdruipend: window.__spel.reizigers.filter((r) => r.soort === "agent" && r.afdruipen).length })));
  // drie sterren: politie, en gepakt worden als je blijft staan
  await page.evaluate(() => { const s = window.__spel; s.loop.pos.set(-2, 0, -10); s.straat.strafbaar(3.5); });
  await vooruit(7);
  console.log("3 sterren:", await lijst());
  await vooruit(30);
  await page.waitForFunction(() => !window.__spel.loop.aan, null, { timeout: 60000 }).then(() => console.log("aangehouden: terug bij het raam")).catch(() => console.log("NIET aangehouden"));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${UIT}/4-gepakt.png` });
  await page.waitForTimeout(4000);
  console.log("daarna:", await page.evaluate(() => JSON.stringify({ sterren: window.__spel.straat.sterren(), agenten: window.__spel.reizigers.filter((r) => r.soort === "agent").length, gepakt: document.body.classList.contains("gepakt"), score: window.__spel.spel.rondeScore })));
  console.log(fouten.join("\n") || "geen fouten");
  await browser.close();
})();
