// Test van vechten, om auto's heen lopen en botsen met rijdend verkeer. De spelregels worden vooruitgespoeld (geen wachten op beeld).
//   node tools/gevecht.cjs [uitmap]
const { chromium } = require("/root/tools/pw/node_modules/playwright-core");
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const UIT = process.argv[2] ?? "/tmp/fbs/gevecht";
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
  await page.goto("http://spel.test/?licht=0&level=steelaan");
  await page.waitForSelector("#start:not([hidden])", { timeout: 120000 });
  await page.tap("#begin"); await page.waitForTimeout(1500);
  await page.tap("#loopKnop"); await page.waitForFunction(() => window.__spel.loop.aan, null, { timeout: 30000 }); await page.waitForTimeout(1500);
  await page.evaluate(() => { const s = window.__spel; s.straat.strafbaar = () => {}; s.zetWapen("vuist"); });
  // ---------- vechten ----------
  const r1 = await page.evaluate(() => {
    const s = window.__spel, l = s.loop, uit = {};
    const v = s.reizigers.find((r) => r.ruzie && r.g && r.groep.visible && !r.kar && !r.lijn);
    window.__v = v; v.vechter = true; v.schrikken = () => {}; v.wacht = 100;
    const fx = Math.sin(s.kijk.yaw), fz = Math.cos(s.kijk.yaw);
    const zet = () => { v.pos.set(l.pos.x + fx * 1.5, 0, l.pos.z + fz * 1.5); v.pad.copy(v.pos); };
    const stap = (sec) => { for (let t = 0; t < sec; t += 0.05) { s.stapLopen(0.05); v.stap(0.05, s.spel); } };
    zet(); s.sla(); stap(0.6);
    uit.eersteKlap = { conditie: v.conditie, vecht: v.ruzieT > 0 && v.ruzieSlaat, combo: l.combo };
    // hij slaat terug: stilstaan tot je er een krijgt
    let t = 0; while (l.conditie === 3 && t < 6) { stap(0.1); t += 0.1; }
    uit.teruggeslagen = { naSec: +t.toFixed(1), conditie: l.conditie, wankel: l.wankel > 0, neer: l.neer > 0 };
    stap(0.6);
    // de reeks: drie keer achter elkaar tikken
    v.conditie = 3; v.uithaalT = 9; v.slagT = 0;
    const reeks = [];
    for (let i = 0; i < 3; i++) { s.sla(); stap(0.15); s.sla(); let n = 0; while (l.slag > 0 && n++ < 30) stap(0.05); reeks.push(l.combo); if (v.ruzieNeer > 0) break; }
    uit.reeks = reeks; uit.neer = v.ruzieNeer > 0; uit.houding = v.m.huidig;
    return uit;
  });
  console.log("vechten:", JSON.stringify(r1));
  await page.waitForTimeout(2500); await page.screenshot({ path: `${UIT}/1-neer.png` });
  const r2 = await page.evaluate(() => {
    const s = window.__spel, v = window.__v;
    for (let t = 0; t < 5.5; t += 0.05) v.stap(0.05, s.spel);
    const d0 = v.pos.distanceTo(s.loop.pos);
    for (let t = 0; t < 2; t += 0.05) v.stap(0.05, s.spel);
    return { opgestaan: !(v.ruzieNeer > 0), rentWeg: v.schrik > 0, verder: +(v.pos.distanceTo(s.loop.pos) - d0).toFixed(1), conditie: v.conditie };
  });
  console.log("daarna:", JSON.stringify(r2));
  // ---------- om auto's heen ----------
  const r3 = await page.evaluate(() => {
    const s = window.__spel, lopers = s.reizigers.filter((r) => r.ruzie && r.g);
    // iemand met een winkelwagen midden in een geparkeerde auto zetten: hij moet eruit geduwd worden
    const auto = s.stil.find((x) => x.soort === "auto").object, w = lopers[0];
    w.pos.set(auto.position.x, 0, auto.position.z); w.pad.copy(w.pos); w.glad(0.05);
    const eruit = !s.uitAuto(w.pos.x, w.pos.z, 0);
    // en een tijd lang iedereen laten lopen: nooit iemand in een auto
    let erin = 0, stappen = 0, langs = 0;
    for (let t = 0; t < 40; t += 0.05) for (const r of lopers) { if (r.ruzieT > 0 || r.groep.visible === false) continue; r.stap(0.05, s.spel); stappen++; if (s.uitAuto(r.pos.x, r.pos.z, 0.1)) erin++; if (s.uitAuto(r.pos.x, r.pos.z, 0.6)) langs++; }
    return { eruit, lopers: lopers.length, stappen, vlakLangsEenAuto: langs, inEenAuto: erin };
  });
  console.log("om auto's heen:", JSON.stringify(r3));
  // ---------- rijden: sturen en botsen ----------
  const r4 = await page.evaluate(() => {
    const s = window.__spel, l = s.loop, uit = {};
    const st = s.stil.find((x) => x.object.userData.soort === "rav4"), o = st.object;
    l.pos.set(o.position.x + Math.cos(o.rotation.y) * 2, 0, o.position.z - Math.sin(o.rotation.y) * 2);
    s.stapLopen(0.05); s.stapIn(); for (let t = 0; t < 0.6; t += 0.05) s.stapLopen(0.05);
    uit.rijdt = s.rij.aan;
    // op een vrij stuk weg zetten: de langste autokant in de buurt
    const g = s.graaf; let best = null;
    g.buren.forEach((lijst, a) => { for (const { n, bits } of lijst) { if (!(bits & 1)) continue; const p = g.k[a], q = g.k[n], L = Math.hypot(q[0] - p[0], q[1] - p[1]); if (Math.hypot(p[0] - l.pos.x, p[1] - l.pos.z) < 150 && (!best || L > best.L)) best = { p, q, L }; } });
    uit.weg = best ? +best.L.toFixed(0) : null;
    const A = s.rij.auto, r0 = Math.atan2(best.q[0] - best.p[0], best.q[1] - best.p[1]);
    const terug = () => { A.position.set(best.p[0] + Math.sin(r0) * 6, 0, best.p[1] + Math.cos(r0) * 6); s.rij.richting = r0; s.rij.v = 0; s.rij.stuur = 0; };
    const stap = (sec) => { for (let t = 0; t < sec; t += 0.05) s.stapLopen(0.05); };
    // ander verkeer uit de weg
    for (const r of s.reizigers) if (r.wordBoos) { r.pos.set(9999, 0, 9999); r.auto.position.copy(r.pos); r.stap = () => {}; }
    terug(); s.rij.gas = true; stap(2);
    uit.optrekken = +s.rij.v.toFixed(1);
    // sturen op snelheid: de hoek loopt soepel op en blijft klein; stilstaand mag hij ver
    l.stick.x = 1; stap(0.2); const h1 = s.rij.stuur; stap(0.5); uit.stuurOpSnelheid = [+h1.toFixed(2), +s.rij.stuur.toFixed(2), +s.rij.v.toFixed(1)];
    l.stick.x = 0; stap(0.4); uit.stuurTerug = +s.rij.stuur.toFixed(2);
    s.rij.gas = false; s.rij.rem = true; stap(1.5); s.rij.rem = false; uit.geremd = +s.rij.v.toFixed(1);
    // botsen op een rijdende auto die voor je stilstaat
    const ander = s.reizigers.find((r) => r.wordBoos);
    terug();
    const zetAnder = () => { ander.pos.set(A.position.x, 0, A.position.z); ander.pos.x = best.p[0] + Math.sin(r0) * 22; ander.pos.z = best.p[1] + Math.cos(r0) * 22; ander.pad.copy(ander.pos); ander.wacht = 1e9; ander.stap = () => {}; ander.auto.position.copy(ander.pos); ander.auto.rotation.y = r0; };
    zetAnder(); s.rij.gas = true;
    let min = 1e9, vmax = 0;
    for (let t = 0; t < 4; t += 0.05) { s.stapLopen(0.05); min = Math.min(min, A.position.distanceTo(ander.pos)); vmax = Math.max(vmax, s.rij.v); }
    s.rij.gas = false;
    uit.botsing = { kleinsteAfstand: +min.toFixed(2), lengtes: +((A.userData.L + ander.auto.userData.L) / 2).toFixed(2), vmax: +vmax.toFixed(1), vNa: +s.rij.v.toFixed(1) };
    // schampen: half naast een stilstaande auto erop af; de neus draait weg (gedraaid) en je verliest geleidelijk vaart.
    // Of je erlangs komt hangt af van de ruimte ernaast.
    terug(); zetAnder();
    ander.pos.x += Math.cos(r0) * 1.15; ander.pos.z -= Math.sin(r0) * 1.15; ander.auto.position.copy(ander.pos); ander.pad.copy(ander.pos);
    s.rij.gas = true; let vmin = 99, tegen = false;
    for (let t = 0; t < 5; t += 0.05) { s.stapLopen(0.05); if (t > 1.5) vmin = Math.min(vmin, s.rij.v); }
    s.rij.gas = false;
    const dx = A.position.x - best.p[0], dz = A.position.z - best.p[1];
    uit.schampen = { ver: +(dx * Math.sin(r0) + dz * Math.cos(r0)).toFixed(0), traagst: +vmin.toFixed(1), gedraaid: +(s.rij.richting - r0).toFixed(2) };
    return uit;
  });
  console.log("rijden:", JSON.stringify(r4));
  await page.waitForTimeout(3000); await page.screenshot({ path: `${UIT}/2-botsing.png` });
  console.log("pedalen zichtbaar:", await page.evaluate(() => ["#gas", "#rem", "#claxon", "#vuur"].map((q) => getComputedStyle(document.querySelector(q)).display).join(" ")));
  // gaspedaal met de vinger
  const cdp = await page.context().newCDPSession(page);
  const vak = await page.evaluate(() => { const b = document.querySelector("#gas").getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: vak[0], y: vak[1], id: 1 }] });
  console.log("gas ingedrukt:", await page.evaluate(() => window.__spel.rij.gas));
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  console.log("gas los:", await page.evaluate(() => window.__spel.rij.gas));
  console.log(fouten.join("\n") || "geen fouten");
  await browser.close();
})();
