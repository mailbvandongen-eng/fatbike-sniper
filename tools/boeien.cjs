// Test van handhaving: vechten met een handhaver (hij vecht terug en gaat neer) en aangehouden worden (in de boeien, dan afgevoerd).
//   node tools/boeien.cjs [uitmap]
const { chromium } = require("/root/tools/pw/node_modules/playwright-core");
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const UIT = process.argv[2] ?? "/tmp/fbs/boeien";
const T = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".glb": "model/gltf-binary", ".svg": "image/svg+xml" };
(async () => {
  fs.mkdirSync(UIT, { recursive: true });
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  await p.route("http://spel.test/**", (r) => { let f = new URL(r.request().url()).pathname; if (f.endsWith("/")) f += "index.html"; f = path.join(ROOT, f); r.fulfill(fs.existsSync(f) ? { body: fs.readFileSync(f), contentType: T[path.extname(f)] ?? "application/octet-stream" } : { status: 404 }); });
  const fout = []; p.on("pageerror", (e) => fout.push(e.message));
  await p.goto("http://spel.test/?licht=0&level=steelaan"); await p.waitForSelector("#start:not([hidden])", { timeout: 120000 });
  await p.screenshot({ path: `${UIT}/0-start.png` });
  console.log("uitleg op het startscherm:", await p.evaluate(() => !!document.querySelector(".uitleg")));
  await p.tap("#begin"); await p.waitForTimeout(1500);
  await p.tap("#loopKnop"); await p.waitForFunction(() => window.__spel.loop.aan, null, { timeout: 60000 }); await p.waitForTimeout(1200);
  // gezocht worden tot er handhavers zijn
  const r1 = await p.evaluate(() => {
    const s = window.__spel, l = s.loop; s.zetWapen("vuist");
    for (let i = 0; i < 3; i++) s.straat.strafbaar(1);
    let t = 0; while (!s.reizigers.some((r) => r.soort === "agent") && t < 30) { s.straat.stap(0.1, t); t += 0.1; }
    const a = s.reizigers.find((r) => r.soort === "agent"); if (!a) return { agenten: 0 };
    window.__a = a;
    for (const r of s.reizigers) if (r.soort === "agent" && r !== a) { r.pos.set(l.pos.x + 60, 0, l.pos.z + 60); r.stap = () => {}; } // één tegelijk
    const fx = Math.sin(s.kijk.yaw), fz = Math.cos(s.kijk.yaw);
    a.pos.set(l.pos.x + fx * 1.5, 0, l.pos.z + fz * 1.5);
    const stap = (sec) => { for (let k = 0; k < sec / 0.05; k++) { s.stapLopen(0.05); a.stap(0.05, s.spel); } };
    const uit = { rol: a.rol, klappen: [] };
    for (let i = 0; i < 8 && !(a.ruzieNeer > 0); i++) { s.sla("vuist"); stap(0.7); l.comboT = 1; uit.klappen.push(a.conditie); if (l.boeien > 0) break; }
    uit.neer = a.ruzieNeer > 0; uit.jij = l.conditie; uit.boeien = l.boeien > 0;
    return uit;
  });
  console.log("vechten met handhaving:", JSON.stringify(r1));
  await p.waitForTimeout(2500); await p.screenshot({ path: `${UIT}/1-neer.png` });
  // nu niets doen: hij staat op, pakt je vast en slaat je in de boeien
  const r2 = await p.evaluate(() => {
    const s = window.__spel, l = s.loop, a = window.__a;
    let t = 0; while (!(l.boeien > 0) && t < 25) { s.stapLopen(0.05); a.stap(0.05, s.spel); t += 0.05; }
    const uit = { naSec: +t.toFixed(1), boeien: l.boeien > 0, agentAchterJe: +a.pos.distanceTo(l.pos).toFixed(2) };
    for (let k = 0; k < 14; k++) s.stapLopen(0.05); // tot je handen op je rug zijn
    return uit;
  });
  console.log("aangehouden:", JSON.stringify(r2));
  await p.waitForTimeout(2600); await p.screenshot({ path: `${UIT}/2-boeien.png` });
  await p.evaluate(() => { const s = window.__spel, l = s.loop, fx = Math.sin(l.richting), fz = Math.cos(l.richting); s.vrijeCamera = { pos: [l.pos.x - fx * 2.2 + fz * 1.2, 1.4, l.pos.z - fz * 2.2 - fx * 1.2], doel: [l.pos.x, 1.05, l.pos.z] }; });
  await p.waitForTimeout(2600); await p.screenshot({ path: `${UIT}/3-rug.png` });
  await p.evaluate(() => { const s = window.__spel; s.vrijeCamera = null; for (let k = 0; k < 80 && s.loop.boeien > 0; k++) s.stapLopen(0.05); });
  await p.waitForFunction(() => !window.__spel.loop.aan, null, { timeout: 60000 }).then(() => console.log("afgevoerd: terug bij het raam")).catch(() => console.log("NIET afgevoerd"));
  console.log(fout.join("\n") || "geen fouten");
  await b.close();
})();
