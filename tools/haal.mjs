// Haalt de ruwe gegevens van een locatie op en zet ze in data/ruw/<locatie>/.
//   node tools/haal.mjs julianaplein
// Bronnen: 3D BAG (gebouwen, CC BY 4.0), OpenStreetMap (straten, bomen, parkeervakken, ODbL).
import { mkdirSync, writeFileSync } from "node:fs";
import { LOCATIES } from "./locaties.mjs";

const id = process.argv[2] ?? "julianaplein";
const L = LOCATIES[id];
const map = `data/ruw/${id}`;
mkdirSync(map, { recursive: true });
const UA = { "User-Agent": "fatbike-sniper (bobvindt.nl)" };

async function haal(url, keer = 4) {
  for (let i = 0; ; i++) {
    const r = await fetch(url, { headers: UA });
    if (r.ok) return r.json();
    if (i >= keer) throw new Error(`${r.status} ${url}`);
    await new Promise((z) => setTimeout(z, 2000 * 2 ** i));
  }
}

// 3D BAG: alle panden in het vierkant rond het midden, per pagina.
const [x, y] = L.midden, r = L.straalGebouwen;
// numberMatched telt elk pand twee keer (Building en BuildingPart); de "next"-links volgen gaat goed.
const panden = new Map();
let url = `https://api.3dbag.nl/collections/pand/items?bbox=${x - r},${y - r},${x + r},${y + r}&limit=100`;
while (url) {
  const d = await haal(url);
  const t = d.metadata?.transform ?? d.transform;
  for (const f of d.features) panden.set(f.id, { ...f, transform: f.transform ?? t });
  url = d.links?.find((l) => l.rel === "next")?.href;
  process.stdout.write(`\r3D BAG: ${panden.size} van ${d.numberMatched / 2}`);
}
writeFileSync(`${map}/3dbag.json`, JSON.stringify([...panden.values()]));
console.log();

// OpenStreetMap: alles in het kleinere speelgebied.
const [s, w, n, e] = L.osmBbox;
const osm = await haal(`https://api.openstreetmap.org/api/0.6/map.json?bbox=${w},${s},${e},${n}`);
writeFileSync(`${map}/osm.json`, JSON.stringify(osm));
console.log(`OSM: ${osm.elements.length} elementen`);

// BGT (Basisregistratie Grootschalige Topografie, PDOK, CC0): tuinen (erven), bestrating, groen, bomen en heggen
// op de decimeter nauwkeurig. Alleen voor locaties met bgt: true.
if (L.bgt) {
  const lagen = ["onbegroeidterreindeel", "begroeidterreindeel", "wegdeel", "ondersteunendwegdeel", "waterdeel", "vegetatieobject_punt", "vegetatieobject_lijn", "scheiding_lijn", "paal", "straatmeubilair"];
  const bgt = {};
  for (const laag of lagen) {
    bgt[laag] = [];
    let u = `https://api.pdok.nl/lv/bgt/ogc/v1/collections/${laag}/items?bbox=${w},${s},${e},${n}&limit=1000&f=json`;
    while (u) {
      const d = await haal(u);
      for (const f of d.features) {
        const p = f.properties;
        if (p.eind_registratie) continue; // vervallen
        bgt[laag].push({ soort: p.fysiek_voorkomen ?? p.type ?? null, functie: p.functie ?? null, plus: p.plus_fysiek_voorkomen ?? p.plus_type ?? p.plus_functie ?? null, g: f.geometry });
      }
      u = d.links?.find((l) => l.rel === "next")?.href;
    }
    console.log(`BGT ${laag}: ${bgt[laag].length}`);
  }
  writeFileSync(`${map}/bgt.json`, JSON.stringify(bgt));
}
