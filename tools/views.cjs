// Vaste camerastandpunten om de wereld te vergelijken met foto's.
//   node tools/views.cjs [uitmap]
const { chromium } = require("/root/tools/pw/node_modules/playwright-core");
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const UIT = process.argv[2] ?? "/tmp/fbs/views";
const TYPE = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".glb": "model/gltf-binary" };
// [naam, camera x,y,z, doel x,y,z, zoom]
const VIEWS = [
  ["balkon-zuid", null, [15, 0, 40], 1],
  ["balkon-oost", null, [120, 5, 10], 1],
  ["jumbo-vanaf-balkon", null, [29.6, 3, 49.7], 5],
  ["zeilschip", [60, 1.7, 20], [214, 15, 46], 1],
  ["pleinzicht-vanaf-parkeerplaats", [10, 1.7, 5], [10, 12, -60], 1],
  ["oostkant-winkels", [60, 1.7, 25], [115, 6, 0], 1],
  ["overkapping", [100, 1.7, 50], [90, 4, 38], 1],
];
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
  const start = await page.evaluate(() => window.__spel.camera.position.toArray());
  for (const [naam, cam, doel, zoom] of VIEWS) {
    await page.evaluate(([cam, doel, zoom, start]) => {
      const s = window.__spel, c = cam ?? start;
      s.camera.position.set(...c);
      s.kijk.basisYaw = s.kijk.yaw = Math.atan2(doel[0] - c[0], doel[2] - c[2]);
      s.kijk.pitch = Math.atan2(doel[1] - c[1], Math.hypot(doel[0] - c[0], doel[2] - c[2]));
      s.zetZoom(zoom);
    }, [cam, doel, zoom, start]);
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `${UIT}/${naam}.png` });
  }
  console.log(fouten.join("\n") || "geen fouten");
  await browser.close();
})();
