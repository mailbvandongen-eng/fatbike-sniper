// Test van het level Hoekerkade en het jongetje met zijn telefoon (gat, brandende accu, bellen, sproeier).   node tools/kind.cjs [uitmap]
const { chromium } = require("/root/tools/pw/node_modules/playwright-core");
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const UIT = process.argv[2] ?? "/tmp/fbs/kind";
const T = { ".jpg": "image/jpeg", ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".mp3": "audio/mpeg" };
(async () => {
  fs.mkdirSync(UIT, { recursive: true });
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  await p.route("http://spel.test/**", (r) => { let f = new URL(r.request().url()).pathname; if (f.endsWith("/")) f += "index.html"; f = path.join(ROOT, f); r.fulfill(fs.existsSync(f) ? { body: fs.readFileSync(f), contentType: T[path.extname(f)] ?? "application/octet-stream" } : { status: 404 }); });
  const fout = []; p.on("pageerror", (e) => { fout.push(e.message); console.log("FOUT", e.message); });
  await p.goto("http://spel.test/?licht=0&level=hoekerkade"); await p.waitForSelector("#start:not([hidden])", { timeout: 180000 });
  await p.evaluate(() => [...document.querySelectorAll("#spelers button")].find((k) => k.textContent.startsWith("Jongetje")).click());
  await p.waitForTimeout(400); await p.tap("#begin"); await p.waitForTimeout(3500); await p.screenshot({ path: `${UIT}/1-raam.png` });
  console.log(await p.evaluate(() => { const s = window.__spel; return JSON.stringify({ hangjeugd: s.reizigers.filter((r) => r.hang).length, fatbikes: s.reizigers.filter((r) => r.fat).length, rav4: s.stil.filter((x) => x.object.userData.soort === "rav4duo").map((x) => x.object.position.toArray().map((v) => +v.toFixed(1))) }); }));
  for (const [n, c] of [["2-straat", { pos: [14, 5, -4], doel: [-3, 1.5, 14] }], ["3-rav4", { pos: [3, 2, 7], doel: [-3.7, 0.8, 12.3] }], ["4-boven", { pos: [0, 60, 12], doel: [0, 0, 8] }]]) { await p.evaluate((c) => { window.__spel.vrijeCamera = c; }, c); await p.waitForTimeout(3500); await p.screenshot({ path: `${UIT}/${n}.png` }); }
  await p.evaluate(() => { window.__spel.vrijeCamera = null; });
  for (let i = 0; i < 10 && !(await p.evaluate(() => window.__spel.loop.aan)); i++) { await p.tap("#loopKnop"); await p.waitForTimeout(5000); }
  const klaar = () => p.waitForFunction(() => window.__spel.herlaad <= 0 && !document.body.classList.contains("film"), null, { timeout: 120000 });
  const zet = () => p.evaluate(() => { const s = window.__spel, l = s.loop; s.kijk.pitch = -0.22; l.keek = performance.now() + 1e7; const q = s.vizierPunt(); return [q.x, q.z, Math.hypot(q.x - l.pos.x, q.z - l.pos.z)]; });
  await p.evaluate(() => { const s = window.__spel, l = s.loop; for (const r of s.reizigers) if (r.pos.distanceTo(l.pos) < 14) { r.pos.set(300, 0, 300); r.pad?.copy?.(r.pos); } });
  await p.waitForTimeout(2500); const v = await zet(); console.log("vizier op", v[2].toFixed(1), "m");
  // gat: drie hangjongeren en een fatbike in het vizier (neerzetten en tikken in hetzelfde beeld, want het vizier beweegt met de camera)
  const zetNeer = `const s = window.__spel, q = s.vizierPunt(); const m = s.reizigers.filter((r) => r.hang && !r.zit && !r.worp).slice(0, 3); m.forEach((r, i) => { r.pos.set(q.x + i * 0.9 - 0.9, 0, q.z + 0.6); r.thuis = r.pos.clone(); r.groep.position.copy(r.pos); }); window.__m = m;
    const f = s.reizigers.find((r) => r.fat && r.toestand === "rijden"); f.wacht = 1e9; f.pos.set(q.x, 0, q.z - 1.2); f.pad.copy(f.pos); window.__f = f;`;
  await p.evaluate(`(() => { ${zetNeer} })()`);
  await p.waitForTimeout(3000); await p.screenshot({ path: `${UIT}/5-vizier.png` }); await klaar();
  const g0 = await p.evaluate(`(() => { ${zetNeer} const g = s.spel.geraakt; s.actie(); return g; })()`);
  console.log(await p.evaluate((g0) => { const s = window.__spel; return JSON.stringify({ gat: s.gaten.length, vallenErin: window.__m.filter((r) => r.worp?.fase === "gat").length, fatbikeGeraakt: s.spel.geraakt - g0, fouten: s.spel.fouten, sterren: s.straat.sterren() }); }, g0));
  await p.waitForTimeout(2500); await p.screenshot({ path: `${UIT}/6-gat.png` });
  console.log("daarna:", await p.evaluate(() => { const s = window.__spel, m = window.__m; let diep = 0; for (let t = 0; t < 7; t += 0.05) for (const r of m) { r.stap(0.05, s.spel); diep = Math.min(diep, r.groep.position.y); } return JSON.stringify({ diepst: +diep.toFixed(1), nu: m.map((r) => r.worp ? r.worp.fase : r.schrik > 0 ? "rent weg" : "terug") }); }));
  await p.waitForFunction(() => !document.body.classList.contains("film"), null, { timeout: 60000 });
  await p.tap("#wapen"); await klaar();
  console.log("bellen:", await p.evaluate(() => { const s = window.__spel, q = s.vizierPunt(), f = s.reizigers.find((r) => r.fat && r.toestand === "rijden"); f.wacht = 0; f.pos.set(q.x + 2, 0, q.z); f.pad.copy(f.pos); s.actie(); return `${s.loop.wapen}: fatbike wacht ${Math.round(f.wacht)} s`; }));
  await p.tap("#wapen"); await klaar();
  console.log("sproeier:", await p.evaluate(() => { const s = window.__spel, q = s.vizierPunt(), f = s.reizigers.find((r) => r.fat && r.toestand === "rijden"), g = s.spel.geraakt; f.pos.set(q.x + 1, 0, q.z); f.pad.copy(f.pos); s.actie(); return s.loop.wapen + " " + g; }));
  await p.waitForTimeout(4000); await p.screenshot({ path: `${UIT}/7-sproei.png` });
  console.log("fatbikes geraakt in totaal:", await p.evaluate(() => window.__spel.spel.geraakt));
  console.log(fout.join("\n") || "geen fouten");
  await b.close();
})();
