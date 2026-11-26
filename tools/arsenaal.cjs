// node tools/arsenaal.cjs — Bonk heeft buiten zijn hele arsenaal; raketten, granaten en de vlammenwerper laten auto's uitbranden.
const { chromium } = require("/root/tools/pw/node_modules/playwright-core");
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, ".."), UIT = "/tmp/fbs/arsenaal"; fs.mkdirSync(UIT, { recursive: true });
const T = { ".jpg": "image/jpeg", ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".mp3": "audio/mpeg" };
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  await p.route("http://spel.test/**", (r) => { let f = new URL(r.request().url()).pathname; if (f.endsWith("/")) f += "index.html"; f = path.join(ROOT, f); r.fulfill(fs.existsSync(f) ? { body: fs.readFileSync(f), contentType: T[path.extname(f)] ?? "application/octet-stream" } : { status: 404 }); });
  const fout = []; p.on("pageerror", (e) => { fout.push(e.message); console.log("FOUT", e.message); });
  await p.goto("http://spel.test/?licht=0&level=buskenhuet"); await p.waitForSelector("#start:not([hidden])", { timeout: 180000 });
  await p.evaluate(() => document.querySelector("#spelers button[data-speler=kale]").click());
  await p.tap("#begin"); await p.waitForTimeout(3000);
  await p.evaluate(() => window.__spel.openKast());
  console.log("kast:", await p.evaluate(() => [...document.querySelectorAll("#kastLijst button")].map((k) => k.textContent).join(", ")));
  await p.evaluate(() => { document.querySelector("#kast").hidden = true; });
  for (let i = 0; i < 10 && !(await p.evaluate(() => window.__spel.loop.aan)); i++) { await p.tap("#loopKnop"); await p.waitForTimeout(5000); }
  console.log("buiten:", await p.evaluate(() => window.__spel.wapens().join(", ")));
  const rij = []; for (let i = 0; i < 10; i++) { rij.push(await p.evaluate(() => window.__spel.loop.wapen)); await p.tap("#wapen"); await p.waitForTimeout(300); }
  console.log("wapenknop:", rij.join(" → "));
  // bazooka op een geparkeerde auto
  console.log("raket:", await p.evaluate(() => { const s = window.__spel, l = s.loop; const autos = s.stil.filter((x) => x.soort === "auto").sort((a, b) => a.object.position.distanceTo(l.pos) - b.object.position.distanceTo(l.pos));
    const a = autos[0]; window.__a = a; const n0 = s.branders.length; s.ontplof(a.object.position.clone().setY(0.6), 6.5);
    return JSON.stringify({ branden: s.branders.length - n0, echteAuto: !!a.object.userData.wielen, brandt: !!a.object.userData.brandt }); }));
  await p.evaluate(() => { const s = window.__spel, a = window.__a.object.position; s.loop.pos.set(a.x + 9, 0, a.z + 6); s.vrijeCamera = { pos: [a.x + 6, 2.4, a.z + 5], doel: [a.x, 0.8, a.z] }; });
  await p.waitForTimeout(4000); await p.screenshot({ path: `${UIT}/1-brand.png` });
  console.log("  na 25 s:", await p.evaluate(() => { const s = window.__spel, a = window.__a.object; for (let t = 0; t < 25; t += 0.05) s.stapTrucs(0.05); let k = null; a.traverse((o) => { if (o.isMesh && !k && !o.material.transparent) k = o.material.color.getHexString(); }); return JSON.stringify({ lak: k, instappen: s.stil.includes(window.__a) }); }));
  await p.waitForTimeout(9000); await p.screenshot({ path: `${UIT}/2-uitgebrand.png` });
  // vlammenwerper op de volgende auto, en een rijdende auto
  console.log("vlam:", await p.evaluate(() => { const s = window.__spel, l = s.loop; const a = s.stil.filter((x) => x.soort === "auto" && !x.object.userData.brandt).sort((a, b) => a.object.position.distanceTo(l.pos) - b.object.position.distanceTo(l.pos))[0];
    const ap = a.object.position; l.pos.set(ap.x + 6, 0, ap.z); s.kijk.yaw = Math.atan2(ap.x - l.pos.x, ap.z - l.pos.z); s.kijk.pitch = -0.1; s.camera.position.set(l.pos.x, 1.5, l.pos.z); s.camera.lookAt(ap.x, 0.8, ap.z); s.camera.updateMatrixWorld();
    s.zetWapen("vlam"); for (const m of Object.values(s.kast.mesh)) m.visible = false; let t = 0; while (!a.object.userData.brandt && t < 3) { s.vuurVlam(0.05); t += 0.05; }
    const r = s.reizigers.find((x) => x.wordBoos); const n = s.reizigers.length; r.pos.set(l.pos.x - 6, 0, l.pos.z); r.auto.position.copy(r.pos); s.ontplof(r.pos.clone().setY(0.5), 6.5);
    return JSON.stringify({ geparkeerdVatVlamNa: +t.toFixed(2), rijdendeAutoStaatStil: !s.reizigers.includes(r) && s.stil.some((x) => x.object === r.auto), bestuurderRentWeg: s.reizigers.length === n }); }));
  await p.evaluate(() => { const s = window.__spel, l = s.loop; s.vrijeCamera = null; });
  await p.waitForTimeout(4000); await p.screenshot({ path: `${UIT}/3-vlam.png` });
  console.log(fout.join("\n") || "geen fouten");
  await b.close();
})();
