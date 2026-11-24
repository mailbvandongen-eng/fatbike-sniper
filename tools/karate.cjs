// Test van level 3: uit het raam hangen, hangjeugd bij het speeltuintje, en de karatetechnieken op straat (een beeld per techniek).
//   node tools/karate.cjs [uitmap]
const { chromium } = require("/root/tools/pw/node_modules/playwright-core");
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const UIT = process.argv[2] ?? "/tmp/fbs/karate";
const T = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".glb": "model/gltf-binary", ".svg": "image/svg+xml" };
(async () => {
  fs.mkdirSync(UIT, { recursive: true });
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  await p.route("http://spel.test/**", (r) => { let f = new URL(r.request().url()).pathname; if (f.endsWith("/")) f += "index.html"; f = path.join(ROOT, f); r.fulfill(fs.existsSync(f) ? { body: fs.readFileSync(f), contentType: T[path.extname(f)] ?? "application/octet-stream" } : { status: 404 }); });
  const fout = []; p.on("pageerror", (e) => fout.push(e.message));
  await p.goto("http://spel.test/?licht=0&level=buskenhuet"); await p.waitForSelector("#start:not([hidden])", { timeout: 120000 });
  await p.tap("#begin"); await p.waitForTimeout(5000);
  await p.screenshot({ path: `${UIT}/1-raam.png` });
  console.log(await p.evaluate(() => { const s = window.__spel; return JSON.stringify({ hangjeugd: s.reizigers.filter((r) => r.hang).length, fatbikes: s.reizigers.filter((r) => r.fat).length, ri: s.spel.ri }); }));
  // het raam van buiten
  await p.evaluate(() => { const s = window.__spel, o = s.oog, y = s.kijk.yaw; s.vrijeCamera = { pos: [o.x + Math.sin(y) * 5 + Math.cos(y) * 2.5, o.y + 0.6, o.z + Math.cos(y) * 5 - Math.sin(y) * 2.5], doel: [o.x, o.y - 0.3, o.z] }; });
  await p.waitForTimeout(4000); await p.screenshot({ path: `${UIT}/2-raam-buiten.png` });
  await p.evaluate(() => { window.__spel.vrijeCamera = { pos: [14, 7, 8], doel: [3, 1, -2] }; });
  await p.waitForTimeout(4000); await p.screenshot({ path: `${UIT}/3-speeltuin.png` });
  await p.evaluate(() => { window.__spel.vrijeCamera = null; });
  // naar buiten: karatepak
  await p.tap("#loopKnop"); await p.waitForFunction(() => window.__spel.loop.aan, null, { timeout: 60000 });
  await p.evaluate(() => { const s = window.__spel; s.straat.strafbaar = () => {}; s.loop.pos.set(-6, 0, 8); s.kijk.yaw = 0.6; s.loop.richting = 0.6; });
  await p.waitForTimeout(4000); await p.screenshot({ path: `${UIT}/4-pak.png` });
  console.log("knoppen:", await p.evaluate(() => ["#wapen", "#richt", "#vuur"].map((q) => getComputedStyle(document.querySelector(q)).display).join(" ")));
  // elke techniek: stilgezet op het moment van raken, van opzij bekeken
  const namen = await p.evaluate(() => { const s = window.__spel; return s.karate(); });
  console.log("technieken:", JSON.stringify(namen));
  for (const [soort, n] of [["vuist", 4], ["trap", 5]]) for (let i = 0; i < n; i++) {
    const r = await p.evaluate(([soort, i]) => {
      const s = window.__spel, l = s.loop;
      l.slag = 0; l.comboT = i ? 1 : 0; l.combo = i - 1; l.wankel = 0; l.neer = 0;
      s.sla(soort);
      // doorspoelen tot het raakmoment, en daar de tijd stilzetten
      let k = 0; while (!l.slagRaak && k++ < 80) s.stapLopen(0.02);
      const y = l.richting, fx = Math.sin(y), fz = Math.cos(y);
      s.vrijeCamera = { pos: [l.pos.x - fz * 3.2 + fx * 0.4, 1.2, l.pos.z + fx * 3.2 + fz * 0.4], doel: [l.pos.x + fx * 0.4, 1.0, l.pos.z + fz * 0.4] };
      window.__vast = l.slag; clearInterval(window.__iv); window.__iv = setInterval(() => { l.slag = window.__vast; l.slagRaak = true; }, 5);
      return k;
    }, [soort, i]);
    await p.waitForTimeout(2600);
    await p.screenshot({ path: `${UIT}/5-${soort}${i}.png`, clip: { x: 222, y: 0, width: 400, height: 390 } });
    await p.evaluate(() => { clearInterval(window.__iv); window.__spel.loop.slag = 0; });
  }
  // vechten met de hangjeugd: een zware trap, vrienden komen erbij
  const v = await p.evaluate(() => {
    const s = window.__spel, l = s.loop; s.vrijeCamera = null;
    const h = s.reizigers.filter((r) => r.hang && !r.zit).sort((a, b) => a.pos.distanceTo(l.pos) - b.pos.distanceTo(l.pos))[0];
    for (const r of s.reizigers) if (r.fat) { r.pos.set(300, 0, 300); r.pad.copy(r.pos); r.wacht = 1e9; } // fatbikes even weg
    l.pos.set(h.pos.x - 1.4, 0, h.pos.z); l.slag = 0; l.comboT = 0;
    const stap = (sec) => { for (let t = 0; t < sec; t += 0.05) { s.stapLopen(0.05); for (const r of s.reizigers) if (r.hang) r.stap(0.05, s.spel); } };
    let laagst = 3, neerGeweest = 0;
    for (let i = 0; i < 16; i++) { s.sla(i % 3 === 2 ? "trap" : "vuist"); stap(0.8); l.comboT = 1; laagst = Math.min(laagst, l.conditie); if (l.neer > 0) { neerGeweest++; stap(3.5); } }
    const hang = s.reizigers.filter((r) => r.hang);
    return { geraakt: hang.filter((r) => r.conditie !== undefined).length, liggen: hang.filter((r) => r.ruzieNeer > 0).length, vechtenMee: hang.filter((r) => r.ruzieT > 0 && !(r.ruzieNeer > 0)).length, jijLaagst: laagst, jijNeer: neerGeweest };
  });
  console.log("gevecht:", JSON.stringify(v));
  await p.waitForTimeout(3000); await p.screenshot({ path: `${UIT}/6-gevecht.png` });
  // de honkbalknuppel: fatbike aan gort, berijder rent weg; mensen sla je er niet mee, die schrikken en rennen
  const k = await p.evaluate(() => {
    const s = window.__spel, l = s.loop; l.neer = 0; l.wankel = 0; l.slag = 0; l.conditie = 3;
    for (const r of s.reizigers) if (r.hang) { r.ruzieT = 0; r.ruzieNeer = 0; }
    s.zetWapen("knuppel");
    const f = s.reizigers.find((r) => r.fat && r.toestand === "rijden"), g0 = s.spel.geraakt;
    const fx = Math.sin(s.kijk.yaw), fz = Math.cos(s.kijk.yaw);
    l.pos.set(40, 0, 40); f.pos.set(40 + fx * 1.8, 0, 40 + fz * 1.8); f.pad.copy(f.pos); f.wacht = 1e9;
    s.sla("knuppel"); for (let t = 0; t < 0.9; t += 0.05) s.stapLopen(0.05);
    const fiets = s.spel.geraakt - g0;
    const h = s.reizigers.find((r) => r.hang && !r.zit && !(r.schrik > 0)); const c0 = h.conditie;
    l.pos.set(h.pos.x - 1.3, 0, h.pos.z); l.slag = 0;
    s.sla("knuppel"); for (let t = 0; t < 0.9; t += 0.05) s.stapLopen(0.05);
    return { wapen: l.wapen, fatbikeKapot: fiets, mensGeraakt: h.conditie !== c0, mensRentWeg: h.schrik > 0, rennenWeg: s.reizigers.filter((r) => r.hang && r.schrik > 0).length, d: +h.pos.distanceTo(l.pos).toFixed(1), hoek: +(Math.atan2(h.pos.x - l.pos.x, h.pos.z - l.pos.z) - l.richting).toFixed(2), slagSoort: l.slagSoort };
  });
  console.log("knuppel:", JSON.stringify(k));
  await p.waitForTimeout(2500); await p.screenshot({ path: `${UIT}/7-knuppel.png` });
  console.log(fout.join("\n") || "geen fouten");
  await b.close();
})();
