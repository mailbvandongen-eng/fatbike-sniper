// node tools/vissen.cjs — het vislevel (Landlustlaan): het hele verloop, versneld, met beelden in /tmp/fbs/vissen.
const { chromium } = require("/root/tools/pw/node_modules/playwright-core");
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, ".."), UIT = "/tmp/fbs/vissen"; fs.mkdirSync(UIT, { recursive: true });
const T = { ".jpg": "image/jpeg", ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".mp3": "audio/mpeg" };
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  await p.route("http://spel.test/**", (r) => { let f = new URL(r.request().url()).pathname; if (f.endsWith("/")) f += "index.html"; f = path.join(ROOT, f); r.fulfill(fs.existsSync(f) ? { body: fs.readFileSync(f), contentType: T[path.extname(f)] ?? "application/octet-stream" } : { status: 404 }); });
  const fout = []; p.on("pageerror", (e) => { fout.push(e.message); console.log("FOUT", e.message); });
  await p.goto("http://spel.test/?licht=0&level=landlust"); await p.waitForSelector("#start:not([hidden])", { timeout: 240000 });
  await p.screenshot({ path: `${UIT}/0-start.png` });
  await p.tap("#begin"); await p.waitForTimeout(1500);
  const info = await p.evaluate(() => { const v = window.__spel.vis; return JSON.stringify({ fase: v.fase, terras: v.terras, vloer: +v.vloer.toFixed(1), rand: v.rand.toArray().map((x) => +x.toFixed(1)), plons: v.plons.toArray().map((x) => +x.toFixed(1)) }); });
  console.log("begin:", info);
  // vooruitspoelen tot een fase (of een aantal seconden), en dan even echt laten lopen voor het beeld
  const spoel = (tot, max = 120, extra = 0) => p.evaluate(([tot, max, extra]) => { const v = window.__spel.vis; let t = 0; while (v.fase !== tot && t < max) { v.stap(0.05); t += 0.05; } for (let e = 0; e < extra; e += 0.05) v.stap(0.05); return `${v.fase} na ${t.toFixed(1)} s`; }, [tot, max, extra]);
  const beeld = async (naam) => { await p.waitForTimeout(2600); await p.screenshot({ path: `${UIT}/${naam}.png` }); };
  await p.evaluate(() => { const v = window.__spel.vis; for (let t = 0; t < 2; t += 0.05) v.stap(0.05); }); await beeld("1-wijd");
  await p.evaluate(() => { const v = window.__spel.vis; for (let t = 0; t < 3.5; t += 0.05) v.stap(0.05); }); await beeld("2-water");
  console.log("wacht:", await spoel("wacht", 20, 1)); await beeld("3-balkon");
  console.log("beet:", await spoel("beet", 20, 0.3)); await beeld("4-pieper");
  console.log("dril:", await spoel("dril", 20, 1.5)); await beeld("5-dril");
  console.log("knoppen in beeld:", await p.evaluate(() => ["#visTrek", "#visNood", "#visBalk"].map((q) => getComputedStyle(document.querySelector(q)).display !== "none").join(",")));
  // tikken helpt: tien tikken, en kijken of hij verder van de reling staat
  console.log("trekken:", await p.evaluate(() => { const v = window.__spel.vis, r0 = v.S.r; for (let i = 0; i < 6; i++) v.trek(); return `${r0.toFixed(2)} → ${v.S.r.toFixed(2)} m van de reling`; }));
  await p.tap("#visTrek"); console.log("tik op de knop geteld:", await p.evaluate(() => window.__spel.vis.S.tikken));
  await p.evaluate(() => { const v = window.__spel.vis; for (let t = 0; t < 5.5; t += 0.05) { v.stap(0.05); if (Math.random() < 0.3) v.trek(); } }); await beeld("6-dronie");
  await p.evaluate(() => { const v = window.__spel.vis; for (let t = 0; t < 4; t += 0.05) { v.stap(0.05); if (Math.random() < 0.3) v.trek(); } }); await beeld("7-water");
  await p.tap("#visNood"); console.log("nood:", await p.evaluate(() => JSON.stringify({ nood: window.__spel.vis.S.nood, rooieZichtbaar: window.__spel.vis.rooie.g.visible })));
  await p.evaluate(() => { const v = window.__spel.vis; for (let t = 0; t < 2.2; t += 0.05) { v.stap(0.05); v.trek(); } }); await beeld("8-rooie");
  console.log("val:", await spoel("val", 200, 0.9), "| volgehouden", await p.evaluate(() => Math.round(window.__spel.vis.S.duur)), "s"); await beeld("9-val");
  console.log("water:", await spoel("water", 20, 2.2)); await beeld("10-water");
  console.log("ambulance:", await spoel("ambulance", 20, 3)); await beeld("11-ambulance");
  console.log("einde:", await spoel("einde", 30, 0.2)); await beeld("12-einde");
  console.log("vraag:", await p.evaluate(() => document.querySelector("#visEinde").hidden ? "ONTBREEKT" : document.querySelector("#visEinde h2").textContent + " | " + document.querySelector("#visTijd").textContent));
  await p.tap("#visJa"); await p.waitForTimeout(600); console.log("opnieuw:", await p.evaluate(() => window.__spel.vis.fase));
  // zonder de noodknop: hij gaat er alleen overheen, en eerder
  console.log("zonder hulp:", await spoel("val", 200, 0), "| volgehouden", await p.evaluate(() => Math.round(window.__spel.vis.S.duur)), "s");
  console.log(fout.join("\n") || "geen fouten");
  await b.close();
})();
