// Geeft het spel een versienummer, zodat telefoons (ook als app op het beginscherm) zichzelf verversen.
//   node tools/versie.mjs        (draait vanzelf vóór elke commit via .git/hooks/pre-commit)
// - De versie is een hash van alle spelbestanden: verandert er iets, dan verandert de versie.
// - versie.json: de telefoon vraagt die op (zonder cache) en vergelijkt met de versie in de pagina.
// - index.html: elk bestand krijgt ?v=<versie> in de importmap, zodat de browser nooit een oud bestand pakt.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const bestanden = [
  ...readdirSync("src").map((f) => `src/${f}`),
  ...readdirSync("data").filter((f) => f.endsWith(".json")).map((f) => `data/${f}`),
  ...readdirSync("lib").filter((f) => /\.m?js$/.test(f)).map((f) => `lib/${f}`),
  ...["mensen", "fietsen", "autos", "kar", "speel", "karate", "geluid", "dieren", "wapens", "natuur", "grond", "vis"].flatMap((m) => readdirSync(`assets/${m}`).map((f) => `assets/${m}/${f}`)),
].sort();
const h = createHash("sha1");
for (const f of bestanden) h.update(f).update(readFileSync(f));
// de pagina zelf telt mee zonder de versie-regels (anders verandert de hash door zichzelf)
const html = readFileSync("index.html", "utf8");
h.update(html.replace(/<!-- versie -->[\s\S]*?<!-- \/versie -->/, ""));
// het kooigevecht is een tweede pagina met dezelfde versie
const kooi = readFileSync("kooi.html", "utf8");
h.update(kooi.replace(/<!-- versie -->[\s\S]*?<!-- \/versie -->/, ""));
const v = h.digest("hex").slice(0, 10);

const nu = new Date().toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
const oud = html.match(/window\.VERSIE = "([^"]+)"/)?.[1];
if (oud === v) { console.log(`versie ongewijzigd: ${v}`); process.exit(0); }

const imports = { three: `./lib/three.module.js?v=${v}`, "./lib/three.module.js": `./lib/three.module.js?v=${v}` };
for (const f of readdirSync("lib").filter((f) => /\.m?js$/.test(f) && f !== "three.module.js")) imports[`./lib/${f}`] = `./lib/${f}?v=${v}`;
for (const f of readdirSync("src")) imports[`./src/${f}`] = `./src/${f}?v=${v}`;
const blok = `<!-- versie -->
<script>window.VERSIE = "${v}"; window.VERSIE_DATUM = "${nu}";</script>
<script type="importmap">${JSON.stringify({ imports })}</script>
<script type="module" src="./src/main.js?v=${v}"></script>
<!-- /versie -->`;
writeFileSync("index.html", html.replace(/<!-- versie -->[\s\S]*?<!-- \/versie -->/, blok));
writeFileSync("kooi.html", kooi.replace(/<!-- versie -->[\s\S]*?<!-- \/versie -->/, blok.replace('<script type="module" src="./src/main.js?v=', '<script type="module" src="./src/kooi.js?v=')));
writeFileSync("versie.json", JSON.stringify({ versie: v, datum: nu }) + "\n");
console.log(`nieuwe versie: ${v} (${nu})`);
