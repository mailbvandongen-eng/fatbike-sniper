// Test van de wapenkast (bazooka, machinegeweer, vlammenwerper) en de honkbalknuppel op mensen.   node tools/kast.cjs [uitmap]
const { chromium } = require("/root/tools/pw/node_modules/playwright-core");
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const UIT = process.argv[2] ?? "/tmp/fbs/kast";
const T = { ".jpg": "image/jpeg", ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".mp3": "audio/mpeg" };
(async () => {
  fs.mkdirSync(UIT, { recursive: true });
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  await p.route("http://spel.test/**", (r) => { let f = new URL(r.request().url()).pathname; if (f.endsWith("/")) f += "index.html"; f = path.join(ROOT, f); r.fulfill(fs.existsSync(f) ? { body: fs.readFileSync(f), contentType: T[path.extname(f)] ?? "application/octet-stream" } : { status: 404 }); });
  const fout = []; p.on("pageerror", (e) => { fout.push(e.message); console.log("FOUT", e.message); });
  await p.goto("http://spel.test/?licht=0&level=julianaplein"); await p.waitForSelector("#start:not([hidden])", { timeout: 180000 });
  await p.tap("#begin"); await p.waitForTimeout(2500);
  const kies = async (naam) => { await p.tap("#wapen"); await p.waitForSelector("#kast:not([hidden])"); if (naam === "Bazooka") await p.screenshot({ path: `${UIT}/1-kast.png` }); await p.evaluate((n) => [...document.querySelectorAll("#kastLijst button")].find((k) => k.textContent === n).click(), naam); };
  // ---------- bazooka uit het raam ----------
  await kies("Bazooka");
  const mik = () => p.evaluate(() => { const s = window.__spel, o = s.oog, f = s.reizigers.find((r) => r.fat && r.toestand === "rijden");
    f.wacht = 1e9; f.pos.set(4, 0, -14); f.pad.copy(f.pos); f.schrikken = () => {};
    const m = s.reizigers.filter((r) => r.ruzie && r.g && r.groep.visible).slice(0, 3); m.forEach((r, i) => { r.pos.set(6 + i, 0, -13 + i); r.pad.copy(r.pos); r.wacht = 1e9; r.schrikken = () => {}; }); window.__m = m;
    s.kijk.yaw = Math.atan2(4 - o.x, -14 - o.z); s.kijk.pitch = Math.atan2(0.4 - o.y, Math.hypot(4 - o.x, -14 - o.z)); return s.spel.geraakt; });
  const g0 = await mik(); await p.waitForTimeout(3500); await p.screenshot({ path: `${UIT}/2-bazooka.png` });
  await p.tap("#vuur");
  await p.waitForFunction((g0) => window.__spel.spel.geraakt > g0, g0, { timeout: 120000 }).then(() => console.log("bazooka: fatbike opgeblazen")).catch(() => console.log("bazooka MIS"));
  console.log(await p.evaluate(() => JSON.stringify({ raketten: window.__spel.kast.munitie.bazooka, mensenDoorDeLucht: window.__m.filter((r) => r.worp).length, fouten: window.__spel.spel.fouten })));
  await p.waitForTimeout(1500); await p.screenshot({ path: `${UIT}/3-boem.png` });
  // ze staan weer op en hinken weg
  console.log("daarna:", await p.evaluate(() => { const s = window.__spel, m = window.__m; const fases = []; for (let t = 0; t < 6; t += 0.05) for (const r of m) r.stap(0.05, s.spel); return JSON.stringify(m.map((r) => r.worp?.fase ?? "klaar")); }));
  await p.waitForTimeout(3000); await p.screenshot({ path: `${UIT}/4-hinken.png` });
  // ---------- machinegeweer ----------
  await kies("Machinegeweer");
  const cdp = await p.context().newCDPSession(p);
  const vak = await p.evaluate(() => { const b = document.querySelector("#vuur").getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: vak[0], y: vak[1], id: 1 }] });
  await p.waitForTimeout(6000); await p.screenshot({ path: `${UIT}/5-mg.png` });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  console.log("machinegeweer na vasthouden:", await p.evaluate(() => `${window.__spel.kast.munitie.mg} van 90 over, teller in beeld: ${document.querySelector("#kogels").textContent}`));
  // ---------- naar buiten met de vlammenwerper ----------
  await kies("Vlammenwerper");
  await p.tap("#loopKnop"); await p.waitForFunction(() => window.__spel.loop.aan, null, { timeout: 60000 }); await p.waitForTimeout(1500);
  await p.evaluate(() => { window.__spel.straat.strafbaar = () => {}; });
  const rij = []; for (let i = 0; i < 6; i++) { rij.push(await p.evaluate(() => window.__spel.loop.wapen)); await p.tap("#wapen"); }
  console.log("buiten bij je:", rij.join(" → "));
  const g1 = await p.evaluate(() => { const s = window.__spel, l = s.loop; s.zetWapen("vlam"); s.kijk.pitch = -0.1;
    const f = s.reizigers.find((r) => r.fat && r.toestand === "rijden"), fx = Math.sin(s.kijk.yaw), fz = Math.cos(s.kijk.yaw);
    f.wacht = 1e9; f.schrikken = () => {}; window.__iv = setInterval(() => { if (f.toestand === "rijden") { f.pos.set(l.pos.x + fx * 5, 0, l.pos.z + fz * 5); f.pad.copy(f.pos); } }, 30); return s.spel.geraakt; });
  await p.waitForTimeout(2500);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: vak[0], y: vak[1], id: 2 }] });
  await p.waitForTimeout(3500); await p.screenshot({ path: `${UIT}/6-vlam.png` });
  await p.waitForFunction((g) => window.__spel.spel.geraakt > g, g1, { timeout: 120000 }).then(() => console.log("vlammenwerper: fatbike in brand")).catch(() => console.log("vlammenwerper MIS"));
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  console.log("brandstof over:", await p.evaluate(() => +window.__spel.kast.munitie.vlam.toFixed(1)));
  // ---------- de honkbalknuppel op mensen ----------
  const k = await p.evaluate(() => { const s = window.__spel, l = s.loop; clearInterval(window.__iv); s.zetWapen("knuppel");
    const v = s.reizigers.find((r) => r.ruzie && r.g && r.groep.visible && !r.worp && !r.kar), fx = Math.sin(s.kijk.yaw), fz = Math.cos(s.kijk.yaw);
    v.pos.set(l.pos.x + fx * 1.4, 0, l.pos.z + fz * 1.4); v.pad.copy(v.pos); v.wacht = 1e9; window.__v = v; const p0 = v.pos.clone();
    s.sla("knuppel"); for (let t = 0; t < 0.8; t += 0.05) s.stapLopen(0.05);
    const uit = { vliegt: v.worp?.fase }; let hoogst = 0; const fases = new Set();
    for (let t = 0; t < 12; t += 0.05) { v.stap(0.05, s.spel); hoogst = Math.max(hoogst, v.groep.position.y); if (v.worp) fases.add(v.worp.fase); }
    return { ...uit, hoogte: +hoogst.toFixed(1), ver: +v.pos.distanceTo(p0).toFixed(1), fases: [...fases].join(" → "), daarna: v.worp ? "nog bezig" : "loopt weer gewoon" }; });
  console.log("knuppel:", JSON.stringify(k));
  await p.evaluate(() => { const s = window.__spel, l = s.loop, v = s.reizigers.find((r) => r.ruzie && r.g && r.groep.visible && !r.worp && !r.kar && r !== window.__v), fx = Math.sin(s.kijk.yaw), fz = Math.cos(s.kijk.yaw);
    v.pos.set(l.pos.x + fx * 1.4, 0, l.pos.z + fz * 1.4); v.pad.copy(v.pos); v.wacht = 1e9; l.slag = 0; s.sla("knuppel"); });
  await p.waitForFunction(() => window.__spel.reizigers.some((r) => r.worp?.fase === "lucht" && r.groep.position.y > 0.5), null, { timeout: 60000 }).catch(() => {});
  await p.screenshot({ path: `${UIT}/7-knuppel.png` });
  console.log(fout.join("\n") || "geen fouten");
  await b.close();
})();
