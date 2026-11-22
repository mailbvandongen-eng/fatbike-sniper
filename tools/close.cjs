// Close-up van figuren: zet een fatbike, een fiets en een voetganger stil voor de camera en maakt foto's.
//   node tools/close.cjs [uitmap]
const { chromium } = require("/root/tools/pw/node_modules/playwright-core");
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const UIT = process.argv[2] ?? "/tmp/fbs/close";
const TYPE = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml" };
(async () => {
  fs.mkdirSync(UIT, { recursive: true });
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
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
  await page.click("#begin");
  await page.waitForTimeout(500);
  // drie fatbikes en een gewone fiets op een rij in de lucht boven het balkon zetten is lastig; we zetten de camera naar beneden
  await page.evaluate(() => {
    const s = window.__spel;
    const fat = s.reizigers.filter((r) => r.fat);
    const fiets = s.reizigers.find((r) => r.soort === "fiets");
    const loper = s.reizigers.find((r) => r.soort === "voetganger");
    const rij = [...fat.slice(0, 2), fiets, loper];
    rij.forEach((r, i) => { r.wacht = 1e9; r.pos.set(-6 + i * 2.2, 0, -30); r.richting = Math.PI / 2; });
    s.camera.position.set(-2.7, 1.5, -25.5);
    s.kijk.basisYaw = Math.PI; s.kijk.yaw = Math.PI; s.kijk.pitch = -0.08;
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${UIT}/rij.png` });
  await page.evaluate(() => { const s = window.__spel; s.kijk.yaw = Math.PI - 0.9; s.camera.position.set(-6.5, 1.3, -27); });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${UIT}/schuin.png` });
  console.log(fouten.join("\n") || "geen fouten");
  await browser.close();
})();
