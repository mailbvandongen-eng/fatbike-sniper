// Test van het meisje: kauwgom (vastplakken), dansmuziek en slijm.   node tools/meisje.cjs [uitmap]
const { chromium } = require("/root/tools/pw/node_modules/playwright-core");
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const UIT = process.argv[2] ?? "/tmp/fbs/meisje";
const T = { ".jpg": "image/jpeg", ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".mp3": "audio/mpeg" };
(async () => {
  fs.mkdirSync(UIT, { recursive: true });
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  await p.route("http://spel.test/**", (r) => { let f = new URL(r.request().url()).pathname; if (f.endsWith("/")) f += "index.html"; f = path.join(ROOT, f); r.fulfill(fs.existsSync(f) ? { body: fs.readFileSync(f), contentType: T[path.extname(f)] ?? "application/octet-stream" } : { status: 404 }); });
  const fout = []; p.on("pageerror", (e) => { fout.push(e.message); console.log("FOUT", e.message); });
  await p.goto("http://spel.test/?licht=0&level=buskenhuet"); await p.waitForSelector("#start:not([hidden])", { timeout: 180000 });
  await p.evaluate(() => document.querySelector("#spelers button[data-speler=meisje]").click());
  await p.tap("#begin"); await p.waitForTimeout(3500); await p.screenshot({ path: `${UIT}/1-raam.png` });
  for (let i = 0; i < 10 && !(await p.evaluate(() => window.__spel.loop.aan)); i++) { await p.tap("#loopKnop"); await p.waitForTimeout(5000); }
  await p.evaluate(() => { const s = window.__spel, l = s.loop; s.kijk.pitch = -0.15; l.keek = performance.now() + 1e7; for (const r of s.reizigers) if (r.pos.distanceTo(l.pos) < 12) { r.pos.set(300, 0, 300); r.pad?.copy?.(r.pos); } });
  await p.evaluate(() => { const s = window.__spel, l = s.loop, y = s.kijk.yaw, fx = Math.sin(y), fz = Math.cos(y); s.vrijeCamera = { pos: [l.pos.x + fx * 2.2 + fz * 1.2, 1.4, l.pos.z + fz * 2.2 - fx * 1.2], doel: [l.pos.x, 1.0, l.pos.z] }; });
  await p.waitForTimeout(3000); await p.screenshot({ path: `${UIT}/2-meisje.png` }); await p.evaluate(() => { window.__spel.vrijeCamera = null; });
  const klaar = () => p.waitForFunction(() => window.__spel.herlaad <= 0 && !document.body.classList.contains("film"), null, { timeout: 120000 });
  const rij = []; for (let i = 0; i < 4; i++) { rij.push(await p.evaluate(() => window.__spel.loop.wapen)); await p.tap("#wapen"); }
  console.log("trucs:", rij.join(" → "));
  // kauwgom op iemand vlak voor je
  await klaar();
  console.log("kauwgom:", await p.evaluate(() => { const s = window.__spel, l = s.loop, fx = Math.sin(s.kijk.yaw), fz = Math.cos(s.kijk.yaw); s.zetWapen("kauwgom");
    const m = s.reizigers.filter((r) => r.hang && !r.zit && !r.worp).slice(0, 2); m.forEach((r, i) => { r.pos.set(l.pos.x + fx * 5 + i * 0.8, 0, l.pos.z + fz * 5); r.thuis = r.pos.clone(); r.groep.position.copy(r.pos); r.groep.updateMatrixWorld(true); }); window.__m = m;
    s.kijk.pitch = 0; s.actie(); let n = 0; while (s.kogels.length && n++ < 100) { s.stapKogels(0.02); } return JSON.stringify({ plakken: m.filter((r) => r.worp?.fase === "plak").length }); }));
  await p.waitForTimeout(3000); await p.screenshot({ path: `${UIT}/3-plak.png` });
  console.log("  daarna:", await p.evaluate(() => { const s = window.__spel, m = window.__m, p0 = m.map((r) => r.pos.clone()); for (let t = 0; t < 4; t += 0.05) for (const r of m) r.stap(0.05, s.spel); const vast = m.map((r, i) => +r.pos.distanceTo(p0[i]).toFixed(1)); for (let t = 0; t < 6; t += 0.05) for (const r of m) r.stap(0.05, s.spel); return JSON.stringify({ bewogenTijdensPlakken: vast, daarnaWeg: m.map((r, i) => Math.round(r.pos.distanceTo(p0[i]))) }); }));
  // dansen
  await klaar();
  console.log("dans:", await p.evaluate(() => { const s = window.__spel; s.zetWapen("dans"); const q = s.vizierPunt(); const m = s.reizigers.filter((r) => r.hang && !r.zit && !r.worp).slice(0, 4); m.forEach((r, i) => { r.pos.set(q.x + i - 1.5, 0, q.z + 1.5); r.thuis = r.pos.clone(); }); window.__d = m;
    const f = s.reizigers.find((r) => r.fat && r.toestand === "rijden"); f.wacht = 0; f.pos.set(q.x + 3, 0, q.z); f.pad.copy(f.pos); s.actie(); return JSON.stringify({ dansen: m.filter((r) => r.worp?.fase === "dans").length, fatbikeWacht: Math.round(f.wacht), box: s.boxen.length }); }));
  await p.waitForTimeout(3500); await p.screenshot({ path: `${UIT}/4-dans.png` });
  // slijm
  await klaar();
  console.log("slijm:", await p.evaluate(() => { const s = window.__spel; s.zetWapen("slijm"); const q = s.vizierPunt(), g = s.spel.geraakt; s.maakPlas?.(q.x, q.z); s.actie(); return "gegooid " + g; }));
  await p.waitForFunction(() => window.__spel.plassen.length > 0, null, { timeout: 60000 }).then(() => console.log("  plas ligt er")).catch(() => console.log("  GEEN plas"));
  console.log("  ", await p.evaluate(() => { const s = window.__spel, pl = s.plassen[0], g = s.spel.geraakt; const f = s.reizigers.find((r) => r.fat && r.toestand === "rijden"); f.wacht = 0; f.snelheid = 3; f.pos.set(pl.x, 0, pl.z); f.pad.copy(f.pos);
    const v = s.reizigers.find((r) => r.ruzie && r.g && r.groep.visible && !r.worp); v.pos.set(pl.x + 1, 0, pl.z); v.pad.copy(v.pos); v.snelheid = 1; s.stapTrucs(0.05); return JSON.stringify({ fatbikeOnderuit: s.spel.geraakt - g, voetgangerGlijdtUit: !!v.worp }); }));
  await p.waitForTimeout(3000); await p.screenshot({ path: `${UIT}/5-slijm.png` });
  console.log(fout.join("\n") || "geen fouten");
  await b.close();
})();
