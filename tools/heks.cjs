// Test van de tovenares: kiezen, vuurbal, bevriezen en omduwen (standbeeld breekt en klikt weer vast), zweven.   node tools/heks.cjs [uitmap]
const { chromium } = require("/root/tools/pw/node_modules/playwright-core");
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const UIT = process.argv[2] ?? "/tmp/fbs/heks";
const T = { ".jpg": "image/jpeg", ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".mp3": "audio/mpeg" };
(async () => {
  fs.mkdirSync(UIT, { recursive: true });
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  await p.route("http://spel.test/**", (r) => { let f = new URL(r.request().url()).pathname; if (f.endsWith("/")) f += "index.html"; f = path.join(ROOT, f); r.fulfill(fs.existsSync(f) ? { body: fs.readFileSync(f), contentType: T[path.extname(f)] ?? "application/octet-stream" } : { status: 404 }); });
  const fout = []; p.on("pageerror", (e) => { fout.push(e.message); console.log("FOUT", e.message); });
  await p.goto("http://spel.test/?licht=0&level=julianaplein"); await p.waitForSelector("#start:not([hidden])", { timeout: 180000 });
  console.log("spelers:", await p.evaluate(() => [...document.querySelectorAll("#spelers button")].map((k) => k.textContent + (k.classList.contains("aan") ? "*" : "")).join(", ")));
  await p.evaluate(() => [...document.querySelectorAll("#spelers button")].find((k) => k.textContent.startsWith("Tovenares")).click());
  await p.waitForTimeout(500); await p.screenshot({ path: `${UIT}/0-start.png` });
  await p.tap("#begin"); await p.waitForTimeout(3000); await p.screenshot({ path: `${UIT}/1-raam.png` });
  const klaar = () => p.waitForFunction(() => window.__spel.herlaad <= 0 && !document.body.classList.contains("film"), null, { timeout: 120000 });
  // vuurbal vanaf het raam op een fatbike
  const g0 = await p.evaluate(() => { const s = window.__spel, o = s.oog; s.stil.length = 0; const f = s.reizigers.find((r) => r.fat); f.wacht = 1e9; f.schrikken = () => {}; f.pos.set(4, 0, -14); f.pad.copy(f.pos);
    s.kijk.yaw = Math.atan2(4 - o.x, -14 - o.z); s.kijk.pitch = Math.atan2(0.5 - o.y, Math.hypot(4 - o.x, -14 - o.z)); return s.spel.geraakt; });
  await p.waitForTimeout(3000); await klaar(); await p.tap("#vuur");
  await p.waitForFunction((g) => window.__spel.spel.geraakt > g, g0, { timeout: 120000 }).then(() => console.log("vuurbal: fatbike opgeblazen")).catch(() => console.log("vuurbal MIS"));
  // naar buiten
  await p.waitForFunction(() => !document.body.classList.contains("film"), null, { timeout: 60000 });
  for (let i = 0; i < 10 && !(await p.evaluate(() => window.__spel.loop.aan)); i++) { await p.tap("#loopKnop"); await p.waitForTimeout(6000); }
  await p.evaluate(() => { const s = window.__spel; s.straat.strafbaar = () => {}; s.kijk.pitch = -0.05; s.loop.keek = performance.now() + 1e7; });
  const rij = []; for (let i = 0; i < 4; i++) { rij.push(await p.evaluate(() => window.__spel.loop.wapen)); await p.tap("#wapen"); }
  console.log("spreuken:", rij.join(" → "));
  const cam = (ver = 3.2) => p.evaluate((ver) => { const s = window.__spel, l = s.loop, y = s.kijk.yaw, fx = Math.sin(y), fz = Math.cos(y); s.vrijeCamera = { pos: [l.pos.x - fz * ver + fx * 1.2, 1.5, l.pos.z + fx * ver + fz * 1.2], doel: [l.pos.x + fx * 1.2, 1.0, l.pos.z + fz * 1.2] }; }, ver);
  await cam(2.6); await p.waitForTimeout(2600); await p.screenshot({ path: `${UIT}/2-rust.png` });
  await p.evaluate(() => { const s = window.__spel, l = s.loop, y = s.kijk.yaw, fx = Math.sin(y), fz = Math.cos(y); s.vrijeCamera = { pos: [l.pos.x + fx * 1.5 + fz * 0.5, 1.55, l.pos.z + fz * 1.5 - fx * 0.5], doel: [l.pos.x, 1.35, l.pos.z] }; });
  await p.waitForTimeout(2600); await p.screenshot({ path: `${UIT}/2b-gezicht.png` });
  // bevriezen
  await p.evaluate(() => { const s = window.__spel, l = s.loop, fx = Math.sin(s.kijk.yaw), fz = Math.cos(s.kijk.yaw); s.vrijeCamera = null; s.zetWapen("bevries");
    for (const r of s.reizigers) if (r.pos.distanceTo(l.pos) < 10) { r.pos.set(300, 0, 300); r.pad?.copy?.(r.pos); }
    const v = s.reizigers.find((r) => r.ruzie && r.g && r.groep.visible && !r.kar && !r.worp); v.pos.set(l.pos.x + fx * 3, 0, l.pos.z + fz * 3); v.pad.copy(v.pos); v.wacht = 1e9; v.groep.position.copy(v.pos); window.__v = v; });
  await p.waitForTimeout(3000); await klaar(); await p.tap("#vuur");
  await p.waitForFunction(() => window.__spel.magie.beelden.length > 0, null, { timeout: 60000 }).then(() => console.log("straal raak")).catch(() => console.log("straal mis"));
  await p.evaluate(() => { const m = window.__spel.magie; if (m.beelden[0]?.wie !== window.__v) { while (m.beelden.length) { let n = 0; m.beelden[0].t = 99; m.stap(0.02, null); if (n++ > 5) break; } m.bevries(window.__v); } }); // voor de beelden: zeker degene vlak voor de camera
  await p.waitForFunction(() => window.__spel.magie.beelden.length > 0, null, { timeout: 60000 }).then(() => console.log("bevroren")).catch(() => console.log("NIET bevroren"));
  await cam(); await p.waitForTimeout(2600); await p.screenshot({ path: `${UIT}/3-ijs.png` });
  console.log("beeld:", await p.evaluate(() => { const b = window.__spel.magie.beelden[0]; return JSON.stringify({ stukken: b.delen.map((d) => d.soort + ":" + d.stuk.geometry.attributes.position.count / 3), mensZichtbaar: b.wie.groep.visible }); }));
  // omduwen: de regels vooruitspoelen, een beeld per fase
  const fase = async (naam, tot) => { await p.evaluate((tot) => { const s = window.__spel, m = s.magie, b = m.beelden[0]; if (!b) return; if (b.fase === "staat") m.duwOm(b, s.loop.pos); let n = 0; while (m.beelden[0] && !tot.includes(m.beelden[0].fase + ":" + (m.beelden[0].t > 0.8 ? "laat" : "vroeg")) && n++ < 400) m.stap(0.02, null); clearInterval(window.__iv); const t = m.beelden[0]?.t; window.__iv = setInterval(() => { if (m.beelden[0]) m.beelden[0].t = t; }, 5); }, tot); await p.waitForTimeout(2600); await p.screenshot({ path: `${UIT}/4-${naam}.png` }); };
  await fase("valt", ["valt:vroeg"]); await fase("stuk", ["stuk:laat"]); await fase("heel", ["heel:vroeg"]);
  console.log("na het ontdooien:", await p.evaluate(() => { const s = window.__spel, m = s.magie, v = window.__v; clearInterval(window.__iv); let n = 0; while (m.beelden.length && n++ < 600) m.stap(0.02, null); const p0 = v.pos.clone(); const uit = { zichtbaar: v.groep.visible, fase: v.worp?.fase }; for (let t = 0; t < 6; t += 0.05) v.stap(0.05, s.spel); return JSON.stringify({ ...uit, daarna: v.worp ? v.worp.fase : v.schrik > 0 ? "rent" : "loopt", weg: +v.pos.distanceTo(p0).toFixed(1) }); }));
  // zweven
  await p.evaluate(() => { const s = window.__spel, l = s.loop, fx = Math.sin(s.kijk.yaw), fz = Math.cos(s.kijk.yaw); s.vrijeCamera = null; s.zetWapen("zweef"); s.kijk.pitch = -0.2;
    const f = s.reizigers.find((r) => r.fat && r.toestand === "rijden"); f.wacht = 1e9; f.pos.set(l.pos.x + fx * 6, 0, l.pos.z + fz * 6); f.pad.copy(f.pos); window.__f = f;
    const m = s.reizigers.filter((r) => r.ruzie && r.g && r.groep.visible && !r.worp).slice(0, 2); m.forEach((r, i) => { r.pos.set(l.pos.x + fx * 6 + i * 1.5 - 1, 0, l.pos.z + fz * 6 + 1.5); r.pad.copy(r.pos); r.wacht = 1e9; }); window.__m = m; });
  const g1 = await p.evaluate(() => window.__spel.spel.geraakt);
  await p.waitForTimeout(3000); await klaar(); await p.tap("#vuur");
  console.log("  debug:", await p.evaluate(() => { const s = window.__spel, l = s.loop; return JSON.stringify({ wapen: l.wapen, herlaad: s.herlaad, slag: l.slag, df: +window.__f.pos.distanceTo(l.pos).toFixed(1), toestand: window.__f.toestand, schoten: s.spel.schoten }); }));
  await p.waitForFunction(() => window.__f.zweef || window.__m.some((r) => r.worp), null, { timeout: 60000 }).then(() => console.log("zweefspreuk raak")).catch(() => console.log("zweef MIS"));
  console.log("zweven:", await p.evaluate(() => JSON.stringify({ fatbike: !!window.__f.zweef, mensen: window.__m.filter((r) => r.worp?.fase === "zweef").length })));
  await p.waitForFunction(() => window.__f.groep.position.y > 1.5, null, { timeout: 120000 }).catch(() => {});
  await p.screenshot({ path: `${UIT}/5-zweef.png` });
  await p.waitForFunction((g) => window.__spel.spel.geraakt > g, g1, { timeout: 200000 }).then(() => console.log("fatbike gevallen en kapot")).catch(() => console.log("fatbike NIET gevallen"));
  console.log(fout.join("\n") || "geen fouten");
  await b.close();
})();
