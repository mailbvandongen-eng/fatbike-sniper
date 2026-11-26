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
  const rij = []; for (let i = 0; i < 5; i++) { rij.push(await p.evaluate(() => window.__spel.loop.wapen)); await p.tap("#wapen"); }
  console.log("trucs:", rij.join(" → "));
  const cam = (pos, doel) => p.evaluate(([pos, doel]) => { window.__spel.vrijeCamera = pos ? { pos, doel } : null; }, [pos, doel]);
  // verf: op de grond, op een geparkeerde auto, op iemand en op een fatbiker
  await klaar();
  console.log("verf:", await p.evaluate(() => { const s = window.__spel, l = s.loop, T = window.__T = s.camera.position.constructor; s.zetWapen("verf");
    const schiet = (doel) => { s.herlaadNul?.(); const d = new T(doel.x - l.pos.x, doel.y - 1.25, doel.z - l.pos.z).normalize(); s.kijk.yaw = Math.atan2(d.x, d.z); s.kijk.pitch = Math.asin(d.y); s.camera.position.set(l.pos.x, 1.25, l.pos.z); s.camera.lookAt(doel.x, doel.y, doel.z); s.camera.updateMatrixWorld(); s.truc(); let n = 0; while (s.kogels.length && n++ < 200) s.stapKogels(0.01); };
    window.__schiet = schiet; const uit = {};
    let n0 = s.spatten.length; schiet(new T(l.pos.x + 4, 0, l.pos.z + 1)); uit.grond = s.spatten.length - n0;
    const auto = s.stil.filter((x) => x.soort === "auto").sort((a, b) => a.object.position.distanceTo(l.pos) - b.object.position.distanceTo(l.pos))[0]; window.__auto = auto;
    { const ry = auto.object.rotation.y; l.pos.set(auto.object.position.x + Math.cos(ry) * 5.5, 0, auto.object.position.z - Math.sin(ry) * 5.5); }
    n0 = s.spatten.length; for (let i = 0; i < 5; i++) { const ry = auto.object.rotation.y, k = (i - 2) * 0.8; schiet(new T(auto.object.position.x + Math.sin(ry) * k, 0.5 + (i % 3) * 0.35, auto.object.position.z + Math.cos(ry) * k)); } uit.auto = s.spatten.length - n0;
    const m = s.reizigers.filter((r) => r.hang && !r.zit && !r.worp)[0]; m.pos.set(l.pos.x + 4, 0, l.pos.z); m.groep.position.copy(m.pos); m.groep.updateMatrixWorld(true);
    schiet(new T(m.pos.x, 1.1, m.pos.z)); uit.mensSchrikt = !!m.worp;
    const f = s.reizigers.find((r) => r.fat && r.toestand === "rijden"), g = s.spel.geraakt; f.pos.set(l.pos.x, 0, l.pos.z + 5); f.pad.copy(f.pos); f.groep.position.copy(f.pos); f.groep.updateMatrixWorld(true);
    schiet(new T(f.pos.x, 1.0, f.pos.z)); uit.fatbikeOm = s.spel.geraakt - g; uit.kleuren = new Set(s.spatten.map((x) => x.material.color.getHexString())).size;
    return JSON.stringify(uit); }));
  await p.evaluate(() => { const s = window.__spel, a = window.__auto.object.position, l = s.loop; s.vrijeCamera = { pos: [l.pos.x + 1.5, 2.6, l.pos.z + 2], doel: [a.x, 0.7, a.z] }; });
  await p.waitForTimeout(3000); await p.screenshot({ path: `${UIT}/3-verf.png` });
  // groene verf is glad: fatbike, fietser, auto en voetganger; kauwgom: de fatbike slaat over de kop
  console.log("glad:", await p.evaluate(() => { const s = window.__spel, l = s.loop, T = window.__T; let n = 0; while (s.plekken.filter((q) => q.soort === "glad").length === 0 && n++ < 8) window.__schiet(new T(l.pos.x + 3, 0, l.pos.z - 3));
    const pl = s.plekken.find((q) => q.soort === "glad"); if (!pl) return "GEEN gladde plek"; const zet = (r) => { r.pos.set(pl.x, 0, pl.z); r.pad?.copy?.(r.pos); r.snelheid = 3; r.wacht = 0; };
    const g = s.spel.geraakt, f = s.reizigers.find((r) => r.fat && r.toestand === "rijden"), fi = s.reizigers.find((r) => r.fiets && !r.fat), au = s.reizigers.find((r) => r.wordBoos), v = s.reizigers.find((r) => r.ruzie && r.g && r.groep.visible && !r.worp);
    for (const r of [f, fi, au, v]) if (r) zet(r); s.stapTrucs(0.05);
    return JSON.stringify({ schotenTotGroen: n, fatbikeOnderuit: s.spel.geraakt - g, fietserGlijdt: fi ? fi.glij > 0 : "geen fietser", autoSlipt: au ? au.slip > 0 : "geen auto", voetgangerValt: v ? !!v.worp : "geen" }); }));
  console.log("kauwgom:", await p.evaluate(() => { const s = window.__spel, l = s.loop, T = window.__T; s.zetWapen("kauwgom"); window.__schiet(new T(l.pos.x - 3, 0, l.pos.z - 4)); s.zetWapen("verf");
    const pl = s.plekken.find((q) => q.soort === "gom"); if (!pl) return "GEEN kauwgom"; const g = s.spel.geraakt, n0 = s.vallers.length, f = s.reizigers.find((r) => r.fat && r.toestand === "rijden");
    f.pos.set(pl.x, 0, pl.z); f.pad.copy(f.pos); f.groep.position.copy(f.pos); f.snelheid = 5; f.wacht = 0; s.stapTrucs(0.05); const nieuw = s.vallers.slice(n0), fiets = nieuw.find((x) => x.soort === "fiets"), mens = nieuw.find((x) => x.soort === "mens");
    window.__gom = [pl.x, pl.z]; let top = 0, rot = 0; for (let t = 0; t < 0.6; t += 0.02) { s.stapVallers(0.02); top = Math.max(top, fiets.obj.position.y); }
    return JSON.stringify({ fatbikeOm: s.spel.geraakt - g, fietsHoog: +top.toFixed(1), fietsTolt: +(Math.abs(fiets.obj.rotation.x) + Math.abs(fiets.obj.rotation.z)).toFixed(1), berijderVooruit: mens ? +Math.hypot(mens.v.x, mens.v.z).toFixed(1) : null }); }));
  await p.evaluate(() => { const s = window.__spel, [x, z] = window.__gom; s.vrijeCamera = { pos: [x + 5, 2, z + 4], doel: [x, 1, z] }; });
  await p.waitForTimeout(1500); await p.screenshot({ path: `${UIT}/3b-gom.png` });
  // spinnen: mensen springen op en rennen weg, een fatbiker gaat onderuit
  console.log("spin:", await p.evaluate(() => { const s = window.__spel, l = s.loop, T = window.__T; s.zetWapen("spin");
    const m = s.reizigers.filter((r) => r.hang && !r.zit && !r.worp).slice(0, 3); m.forEach((r, i) => { r.pos.set(l.pos.x - 6 + i, 0, l.pos.z + 4 + i); r.groep.position.copy(r.pos); }); window.__m = m;
    window.__schiet(new T(l.pos.x - 5, 0, l.pos.z + 3));
    const uit = { spinnen: s.spinnen.length, springen: m.filter((r) => r.worp?.hop).length }; const p0 = m.map((r) => r.pos.clone());
    window.__sp = [l.pos.x - 5, l.pos.z + 3]; return JSON.stringify(uit); }));
  await p.evaluate(() => { const s = window.__spel, [x, z] = window.__sp; s.vrijeCamera = { pos: [x + 2.2, 1.2, z - 2.2], doel: [x, 0.3, z] }; });
  await p.waitForTimeout(2500); await p.screenshot({ path: `${UIT}/4-spin.png` });
  console.log("  daarna:", await p.evaluate(() => { const s = window.__spel, m = window.__m, p0 = m.map((r) => r.pos.clone()); for (let t = 0; t < 7; t += 0.05) { for (const r of m) r.stap(0.05, s.spel); s.stapTrucs(0.05); } const uit = { weggerend: m.map((r, i) => Math.round(r.pos.distanceTo(p0[i]))) }; for (let t = 0; t < 6; t += 0.05) s.stapTrucs(0.05); uit.spinnenOver = s.spinnen.length; return JSON.stringify(uit); }));
  // heliumballonnen: mensen en fatbikers gaan de lucht in en verdwijnen
  console.log("ballon:", await p.evaluate(() => { const s = window.__spel, l = s.loop; s.zetWapen("ballon"); s.kijk.pitch = -0.2;
    const q = { x: l.pos.x + 7, z: l.pos.z - 2 }; window.__q = q;
    const m = s.reizigers.filter((r) => r.hang && !r.zit && !r.worp && r.groep.visible).slice(0, 3); m.forEach((r, i) => { r.pos.set(q.x + i - 1, 0, q.z + 1); r.groep.position.copy(r.pos); }); window.__m = m;
    const f = s.reizigers.find((r) => r.fat && r.toestand === "rijden"), g = s.spel.geraakt, n0 = s.vallers.length; f.pos.set(q.x, 0, q.z - 1.5); f.pad.copy(f.pos); f.groep.position.copy(f.pos);
    s.bolOpen(new (window.__T)(q.x, 0, q.z));
    return JSON.stringify({ omhoog: m.filter((r) => r.worp?.fase === "ballon").length, fatbikeOm: s.spel.geraakt - g, berijdersAanBallon: s.vallers.slice(n0).filter((x) => x.toestand === "ballon").length }); }));
  await p.evaluate(() => { const s = window.__spel, m = window.__m; for (let t = 0; t < 3.2; t += 0.05) { for (const r of m) r.stap(0.05, s.spel); s.stapVallers(0.05); } const g = m[1].groep.position, l = s.loop; s.vrijeCamera = { pos: [g.x - 9, 3, g.z - 6], doel: [g.x, g.y + 0.5, g.z] }; });
  await p.waitForTimeout(2500); await p.screenshot({ path: `${UIT}/5-ballon.png` });
  console.log("  daarna:", await p.evaluate(() => { const s = window.__spel, m = window.__m; let hoog = 0; for (let t = 0; t < 14; t += 0.05) { for (const r of m) { r.stap(0.05, s.spel); hoog = Math.max(hoog, r.groep.position.y); } s.stapVallers(0.05); } return JSON.stringify({ hoogste: Math.round(hoog), terugOpStraat: m.map((r) => !r.worp && r.groep.visible !== false && Math.round(r.pos.distanceTo(s.loop.pos))), ballonVallersOver: s.vallers.filter((x) => x.toestand === "ballon").length }); }));
  // de gooi zelf (met de boog) en de houding bij het raam
  await cam(); await klaar();
  await p.evaluate(() => { const s = window.__spel; s.zetWapen("ballon"); s.kijk.pitch = -0.25; s.actie(); });
  await p.waitForTimeout(6000);
  console.log("gooi: losse ballonnen", await p.evaluate(() => window.__spel.ballonnen.length), "(niemand in de buurt: er stijgt er één op)");
  await p.evaluate(() => { const s = window.__spel, l = s.loop, y = s.kijk.yaw, fx = Math.sin(y), fz = Math.cos(y); s.zetWapen("verf"); l.richt = 99; s.vrijeCamera = { pos: [l.pos.x + fx * 1.2 + fz * 1.9, 1.4, l.pos.z + fz * 1.2 - fx * 1.9], doel: [l.pos.x + fx * 0.2, 1.15, l.pos.z + fz * 0.2] }; });
  await p.waitForTimeout(3000); await p.screenshot({ path: `${UIT}/6-katapult.png` });
  console.log(fout.join("\n") || "geen fouten");
  await b.close();
})();
