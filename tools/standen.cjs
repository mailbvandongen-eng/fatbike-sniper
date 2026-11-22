// Loopt alle standplaatsen af (▲▼), maakt van elk een foto en test op de grond het gezien worden.
//   node tools/standen.cjs [uitmap]
const { chromium } = require("/root/tools/pw/node_modules/playwright-core");
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const UIT = process.argv[2] ?? "/tmp/fbs/standen";
const TYPE = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml" };
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
  await page.goto("http://spel.test/");
  await page.waitForSelector("#start:not([hidden])", { timeout: 120000 });
  await page.tap("#begin");
  await page.waitForTimeout(1500);
  // helemaal naar beneden
  for (let i = 0; i < 8; i++) { await page.tap("#lager").catch(() => {}); await page.waitForTimeout(2600); }
  for (let i = 0; i < 7; i++) {
    const naam = await page.evaluate(() => document.querySelector("#wissel b").textContent || "start");
    const cam = await page.evaluate(() => window.__spel.camera.position.toArray().map((v) => +v.toFixed(1)));
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${UIT}/${i}.png` });
    console.log(i, naam, JSON.stringify(cam));
    if (i === 0) {
      // op de grond: met de kijker omhoog en blijven staan
      await page.evaluate(() => window.__spel.zetZoom(4));
      const t0 = Date.now();
      await page.waitForFunction(() => window.__spel.spel.gezienKoel, null, { timeout: 240000 }).then(() => console.log("  gezien na", Math.round((Date.now() - t0) / 1000), "s (echte tijd, traag in swiftshader)")).catch(() => console.log("  niet gezien"));
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `${UIT}/0-gezien.png` });
      await page.evaluate(() => window.__spel.zetZoom(1));
      await page.waitForTimeout(1500);
    }
    await page.tap("#hoger").catch(() => {});
    await page.waitForTimeout(2600);
  }
  console.log(fouten.join("\n") || "geen fouten");
  await browser.close();
})();
