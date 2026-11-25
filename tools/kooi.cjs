// Test van het kooigevecht: kiezen, vechten (de regels vooruitgespoeld), K.O. en de uitslag.   node tools/kooi.cjs [uitmap]
const { chromium } = require("/root/tools/pw/node_modules/playwright-core");
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const UIT = process.argv[2] ?? "/tmp/fbs/kooi";
const T = { ".jpg": "image/jpeg", ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".glb": "model/gltf-binary", ".mp3": "audio/mpeg" };
(async () => {
  fs.mkdirSync(UIT, { recursive: true });
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] });
  const p = await b.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  await p.route("http://spel.test/**", (r) => { let f = new URL(r.request().url()).pathname; if (f.endsWith("/")) f += "index.html"; f = path.join(ROOT, f); r.fulfill(fs.existsSync(f) ? { body: fs.readFileSync(f), contentType: T[path.extname(f)] ?? "application/octet-stream" } : { status: 404 }); });
  const fout = []; p.on("pageerror", (e) => { fout.push(e.message); console.log("FOUT", e.message, (e.stack || "").split("\n").slice(1, 4).join(" | ")); }); p.on("console", (m) => { if (m.type() === "error") console.log("console:", m.text().slice(0, 300)); });
  await p.goto("http://spel.test/kooi.html"); await p.waitForSelector("#kies:not([hidden])", { timeout: 240000 });
  if (!process.env.SNEL) {
  await p.waitForTimeout(2500); await p.screenshot({ path: `${UIT}/1-kies.png` });
  await p.evaluate(() => { document.querySelectorAll("#vechters button")[2].click(); window.__kooi.spel.tegen = 3; }); // de beer tegen de wolf
  await p.evaluate(() => document.querySelector('#rondes button[data-n="1"]').click());
  await p.tap("#start");
  await p.waitForFunction(() => window.__kooi.spel.fase === "vecht", null, { timeout: 120000 });
  console.log("vechters:", await p.evaluate(() => `${window.__kooi.A.def.naam} tegen ${window.__kooi.B.def.naam}, muziek ${!!window.__kooi.muziek?.timer}, publiek ${window.__kooi.publiek.length}`));
  // een paar tellen laten vechten: jij trapt steeds als je kunt
  const iv = setInterval(() => p.evaluate(() => { const k = window.__kooi; k.invoer.x = 0; k.invoer.toets.KeyD = k.A.pos.x < k.B.pos.x; k.invoer.toets.KeyA = !k.invoer.toets.KeyD; if (Math.random() < 0.6) k.invoer.trap = true; else k.invoer.stoot = true; }).catch(() => {}), 400);
  await p.waitForTimeout(9000); await p.screenshot({ path: `${UIT}/2-vecht.png` });
  console.log("na een tijdje:", await p.evaluate(() => { const k = window.__kooi; return JSON.stringify({ jij: Math.round(k.A.hp), hij: Math.round(k.B.hp), ademJij: Math.round(k.A.st), ademHij: Math.round(k.B.st), afstand: +k.A.pos.distanceTo(k.B.pos).toFixed(1) }); }));
  await p.waitForTimeout(14000); await p.screenshot({ path: `${UIT}/3-vecht.png` });
  clearInterval(iv);
  // de laatste klap
  await p.evaluate(() => { const k = window.__kooi; k.B.hp = 1; k.A.pos.set(k.B.pos.x - 1.1, 0, k.B.pos.z); k.invoer.stoot = true; });
  await p.waitForFunction(() => window.__kooi.spel.fase !== "vecht", null, { timeout: 120000 }).then(() => console.log("einde gevecht, fase", "ko")).catch(() => console.log("GEEN einde"));
  await p.waitForTimeout(2500); await p.screenshot({ path: `${UIT}/4-ko.png` });
  await p.waitForSelector("#uitslag:not([hidden])", { timeout: 120000 });
  console.log("uitslag:", await p.textContent("#uitslagKop"), "|", await p.textContent("#uitslagTekst"));
  }
  // balans: elke vechter tegen elke andere, tien gevechten per paar, computer tegen computer, alleen de regels (geen beeld)
  console.log("balans:", await p.evaluate(() => {
    const k = window.__kooi, N = k.VECHTERS.length, winst = {}, paren = {}; let duur = 0, n = 0, ko = 0;
    for (let a = 0; a < N; a++) for (let b = a + 1; b < N; b++) for (let g = 0; g < 10; g++) {
      k.spel.keuze = g % 2 ? a : b; k.spel.tegen = g % 2 ? b : a; k.spel.rondes = 3; k.beginGevecht(); k.spel.fase = "vecht";
      const brein = k.nieuwBrein(); let t = 0, ronde = 1;
      while (k.spel.fase === "vecht" && t < 200) {
        k.stapGevecht(0.05, k.denk(0.05, k.A, k.B, brein)); t += 0.05;
        if (k.spel.tijd <= 0) { if (ronde >= 3) break; ronde++; k.beginRonde(false); k.spel.fase = "vecht"; }
      }
      const w = k.A.ko ? k.B : k.B.ko ? k.A : k.A.hp / k.A.leven > k.B.hp / k.B.leven ? k.A : k.B, sl = `${k.VECHTERS[a].naam}-${k.VECHTERS[b].naam}`;
      winst[w.def.naam] = (winst[w.def.naam] ?? 0) + 1; (paren[sl] ??= [0, 0])[w.def === k.VECHTERS[a] ? 0 : 1]++;
      duur += t; n++; if (k.A.ko || k.B.ko) ko++;
    }
    k.spel.tegen = null;
    return JSON.stringify({ winst, paren, gemiddeld: Math.round(duur / n), ko: `${ko}/${n}` });
  }));
  console.log(fout.join("\n") || "geen fouten");
  await b.close();
})();
