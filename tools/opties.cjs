// Test van de opties op het beginscherm.   node tools/opties.cjs [uitmap]
const { chromium } = require("/root/tools/pw/node_modules/playwright-core");
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const UIT = process.argv[2] ?? "/tmp/fbs/opties";
const T = { ".jpg": "image/jpeg", ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".glb": "model/gltf-binary", ".svg": "image/svg+xml" };
(async () => {
  fs.mkdirSync(UIT, { recursive: true });
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  await p.route("http://spel.test/**", (r) => { let f = new URL(r.request().url()).pathname; if (f.endsWith("/")) f += "index.html"; f = path.join(ROOT, f); r.fulfill(fs.existsSync(f) ? { body: fs.readFileSync(f), contentType: T[path.extname(f)] ?? "application/octet-stream" } : { status: 404 }); });
  const fout = []; p.on("pageerror", (e) => fout.push(e.message));
  await p.goto("http://spel.test/?licht=0&level=buskenhuet"); await p.waitForSelector("#start:not([hidden])", { timeout: 120000 });
  console.log("standaard:", await p.textContent("#startDoel"));
  await p.screenshot({ path: `${UIT}/0-start.png` });
  await p.tap("#optieKnop"); await p.waitForTimeout(500);
  const tik = async (naam, keer = 1) => { for (let i = 0; i < keer; i++) await p.evaluate((naam) => [...document.querySelectorAll("#optieLijst button")].find((k) => k.textContent.startsWith(naam)).click(), naam); };
  await tik("Handhaving"); await tik("Tijdslimiet"); await tik("Fatbikes", 2); await tik("Onbeperkt"); await tik("Mikhulp");
  await p.screenshot({ path: `${UIT}/1-opties.png` });
  console.log("keuzes:", await p.evaluate(() => [...document.querySelectorAll("#optieLijst button")].map((k) => k.textContent).join(" | ")));
  await p.tap("#optieDicht");
  console.log("nu:", await p.textContent("#startDoel"));
  await p.tap("#begin"); await p.waitForTimeout(3000);
  console.log(await p.evaluate(() => { const s = window.__spel; s.straat.strafbaar(5); return JSON.stringify({ ri: s.spel.ri, kogels: String(s.spel.kogels), sterren: s.straat.sterren(), klok: document.querySelector("#klok").textContent, klokZichtbaar: !document.querySelector("#klok").hidden, fatbikes: s.reizigers.filter((r) => r.fat).length }); }));
  await p.screenshot({ path: `${UIT}/2-spel.png` });
  await p.evaluate(() => { window.__spel.spel.tijd = 0.5; });
  await p.waitForSelector("#einde:not([hidden])", { timeout: 60000 }).then(() => console.log("tijd om: ronde voorbij")).catch(() => console.log("GEEN einde"));
  // bewaard na herladen
  await p.reload(); await p.waitForSelector("#start:not([hidden])", { timeout: 120000 });
  console.log("na herladen:", await p.textContent("#startDoel"));
  console.log(fout.join("\n") || "geen fouten");
  await b.close();
})();
