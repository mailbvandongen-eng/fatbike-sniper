// Bouwt uit de ruwe gegevens de wereld van een locatie: data/<locatie>.json
//   node tools/bouw.mjs julianaplein
// Assen in het spel: x = oost, y = omhoog, z = zuid (meters, oorsprong = midden van de locatie).
import { readFileSync, writeFileSync } from "node:fs";
import { ShapeUtils, Vector2 } from "../lib/three.module.js";
import { LOCATIES, GEDEELD } from "./locaties.mjs";
import { naarRD } from "./rd.mjs";

const id = process.argv[2] ?? "julianaplein";
const L = LOCATIES[id];
const [OX, OY] = L.midden;
const VER = 320; // tot hier staat alles in de kaart: je kunt van het ene level naar het andere lopen
const panden = JSON.parse(readFileSync(`data/ruw/${id}/3dbag.json`));
const osm = JSON.parse(readFileSync(`data/ruw/${id}/osm.json`)).elements;

const r1 = (v) => Math.round(v * 100) / 100;
const lokaal = (lat, lon) => { const [x, y] = naarRD(lat, lon); return [x - OX, -(y - OY)]; };

// ---------- OSM ----------
const knoop = new Map();
for (const e of osm) if (e.type === "node") knoop.set(e.id, e);
const wegen = osm.filter((e) => e.type === "way" && e.tags);
const punten = (w) => w.nodes.map((n) => knoop.get(n)).filter(Boolean).map((n) => lokaal(n.lat, n.lon));
const binnen = (p, ring) => {
  let in_ = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if (zi > p[1] !== zj > p[1] && p[0] < ((xj - xi) * (p[1] - zi)) / (zj - zi) + xi) in_ = !in_;
  }
  return in_;
};
const osmGebouwen = wegen.filter((w) => w.tags.building).map((w) => ({ t: w.tags, ring: punten(w) }));

// ---------- gebouwen uit 3D BAG ----------
const N = (a) => { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); };
function newell(pts) {
  const n = [0, 0, 0];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return N(n);
}
function driehoeken(ringen) {
  // ringen[0] = buitenrand, rest = gaten; punten in [x,y,z]
  const n = newell(ringen[0]);
  const ax = Math.abs(n[0]) > Math.abs(n[1]) ? (Math.abs(n[0]) > Math.abs(n[2]) ? 0 : 2) : Math.abs(n[1]) > Math.abs(n[2]) ? 1 : 2;
  const [i, j] = [[1, 2], [2, 0], [0, 1]][ax];
  const v2 = (r) => r.map((p) => new Vector2(p[i], p[j]));
  const alle = ringen.flat();
  const tris = ShapeUtils.triangulateShape(v2(ringen[0]), ringen.slice(1).map(v2));
  // triangulateShape draait de omloop om naar tegen de klok in (in 2D); zet elke driehoek weer met de normaal mee
  return {
    n,
    tris: tris.map((t) => {
      const [a, b, c] = t.map((k) => alle[k]);
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const tn = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
      return tn[0] * n[0] + tn[1] * n[1] + tn[2] * n[2] < 0 ? [a, c, b] : [a, b, c];
    }),
  };
}

const maaivelden = [];
// Gevelstijlen, gekozen op functie, hoogte en bouwjaar (BAG):
//   jaren50 roodbruine baksteen · jaren60 gele baksteen · galerij beton met witte schotten (hoogbouw 1960-1980)
//   kop rode kopgevel van die galerijflats · winkel glazen pui met lichte luifelband · huis rijtjeshuis
//   modern licht metselwerk (1990-2010) · nieuw donker metselwerk (na 2010)
const stijlen = ["jaren50", "bruinwit", "portiek", "geel", "creme", "zeilschip", "galerij", "kop", "winkel", "huis", "modern", "nieuw", "jaren70"];
const muren = Object.fromEntries(stijlen.map((s) => [s, { pos: [], uv: [] }]));
const daken = { plat: { pos: [] }, pannen: { pos: [] } };
const voetafdrukken = [];
let sluip = null;

for (const f of panden) {
  const t = f.transform;
  const V = f.vertices.map((v) => [v[0] * t.scale[0] + t.translate[0] - OX, v[2] * t.scale[2] + t.translate[2], -(v[1] * t.scale[1] + t.translate[1] - OY)]);
  const gebouw = Object.values(f.CityObjects).find((o) => o.type === "Building");
  const a = gebouw?.attributes ?? {};
  maaivelden.push(a.b3_h_maaiveld ?? 0);
  for (const deel of Object.values(f.CityObjects).filter((o) => o.type === "BuildingPart")) {
    const ver = Math.hypot(...V[deel.geometry[0].boundaries[0][0][0][0]].filter((_, k) => k !== 1));
    const lod = ver < 270 ? "2.2" : "1.2";
    const g = deel.geometry.find((x) => x.lod === lod) ?? deel.geometry.at(-1);
    const sem = g.semantics;
    const vlakken = g.boundaries[0];
    // voetafdruk en stijl
    const grondIdx = vlakken.findIndex((_, k) => sem.surfaces[sem.values[0][k]].type === "GroundSurface");
    const grond = grondIdx >= 0 ? vlakken[grondIdx][0].map((k) => [V[k][0], V[k][2]]) : null;
    if (!grond) continue;
    const mid = grond.reduce((s, p) => [s[0] + p[0] / grond.length, s[1] + p[1] / grond.length], [0, 0]);
    const og = osmGebouwen.find((o) => o.ring.length > 2 && binnen(mid, o.ring));
    const lagen = +(og?.t["building:levels"] ?? a.b3_bouwlagen ?? 2);
    const jaar = +(a.oorspronkelijkbouwjaar ?? og?.t.start_date?.slice(0, 4) ?? 1958);
    let stijl = "jaren50";
    const woonhuis = ["house", "terrace", "residential", "apartments", "detached", "semidetached_house"].includes(og?.t.building);
    if (["retail", "commercial", "industrial"].includes(og?.t.building) || (!woonhuis && lagen <= 2 && jaar >= 1960 && jaar < 1990 && a.b3_dak_type !== "slanted")) stijl = "winkel";
    else if (woonhuis && jaar >= 1965 && jaar < 1990 && a.b3_dak_type !== "slanted" && lagen <= 4) stijl = "jaren70"; // rijtjeshuizen en lage flats met plat dak
    else if (og?.t.building === "house" || (lagen <= 3 && a.b3_dak_type === "slanted" && jaar >= 1960)) stijl = "huis";
    else if (jaar >= 2010) stijl = "nieuw";
    else if (jaar >= 1990) stijl = "modern";
    else if (lagen >= 8 && jaar >= 1960) stijl = "galerij";
    else if (jaar >= 1955) stijl = "bruinwit"; // donkerbruine baksteen met witte raambanden, zoals rond het plein
    for (const g of GEDEELD.stijlGebieden) if (stijl === g.van && Math.hypot(mid[0] + OX - g.midden[0], OY - mid[1] - g.midden[1]) < g.straal) stijl = g.naar;
    const eigen = GEDEELD.stijlPerPand[f.id.replace("NL.IMBAG.Pand.", "")];
    if (eigen) stijl = eigen;
    // lange as van het gebouw: de korte gevels van galerijflats zijn de rode kopgevels
    let as = [1, 0], langst = 0;
    for (let i = 0; i < grond.length - 1; i++) {
      const l = Math.hypot(grond[i + 1][0] - grond[i][0], grond[i + 1][1] - grond[i][1]);
      if (l > langst) { langst = l; as = [(grond[i + 1][0] - grond[i][0]) / l, (grond[i + 1][1] - grond[i][1]) / l]; }
    }
    voetafdrukken.push({ ring: grond.map((p) => p.map(r1)), h: r1(a.b3_h_dak_70p ?? 6), naam: og?.t.name });
    const isFlat = L.flatPand ? f.id.endsWith(L.flatPand) : og?.t.name === L.flat;
    if (isFlat && !sluip) sluip = { grond, h0: a.b3_h_maaiveld ?? 0, lagen, dak: a.b3_h_dak_70p ?? 28 };
    const pannen = a.b3_dak_type === "slanted" && (stijl === "huis" || stijl === "jaren50");
    vlakken.forEach((vlak, k) => {
      const soort = sem.surfaces[sem.values[0][k]].type;
      if (soort === "GroundSurface") return;
      const ringen = vlak.map((ring) => ring.map((i) => V[i]));
      const { n, tris } = driehoeken(ringen);
      if (soort === "WallSurface") {
        const tan = N([-n[2], 0, n[0]]);
        // kopgevel: een brede muur haaks op de lange as (smalle schotten tussen balkons blijven wit/beton)
        let breedte = 0;
        if (stijl === "galerij") { const r0 = ringen[0]; for (const p of r0) for (const q of r0) breedte = Math.max(breedte, Math.hypot(p[0] - q[0], p[2] - q[2])); }
        const kop = stijl === "galerij" && Math.abs(n[0] * as[0] + n[2] * as[1]) > 0.7 && breedte > 6;
        const m = muren[kop ? "kop" : stijl];
        for (const tri of tris) for (const p of tri) { m.pos.push(...p); m.uv.push(p[0] * tan[0] + p[2] * tan[2], p[1]); }
      } else {
        const d = pannen && Math.abs(n[1]) < 0.97 ? daken.pannen : daken.plat;
        // zorg dat daken naar boven wijzen
        for (const tri of tris) (n[1] < 0 ? [...tri].reverse() : tri).forEach((p) => d.pos.push(...p));
      }
    });
  }
}
maaivelden.sort((a, b) => a - b);
const H0 = maaivelden[maaivelden.length >> 1];
const rond = (arr, isY) => arr.map((v, i) => r1(i % 3 === 1 && isY ? v - H0 : v));
for (const s of stijlen) { muren[s].pos = rond(muren[s].pos, true); muren[s].uv = muren[s].uv.map((v, i) => r1(i % 2 ? v - H0 : v)); }
for (const d of Object.values(daken)) d.pos = rond(d.pos, true);

// ---------- de plek van de sluipschutter ----------
if (!sluip) throw new Error(`flat ${L.flat ?? L.flatPand} niet gevonden`);
const [jx, jy] = L.kijkpunt, J = [jx - OX, -(jy - OY)];
// De gevel die het meest naar de parkeerplaats kijkt; daarop het stuk dat er het dichtst bij ligt.
const g = sluip.grond, kandidaten = [];
for (let i = 0; i < g.length; i++) {
  const a = g[i], b = g[(i + 1) % g.length];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (len < 3) continue;
  let nrm = [(b[1] - a[1]) / len, -(b[0] - a[0]) / len];
  const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  if (binnen([m[0] + nrm[0], m[1] + nrm[1]], g)) nrm = nrm.map((v) => -v); // naar buiten
  const naarP = N([J[0] - m[0], J[1] - m[1]]);
  kandidaten.push({ dot: nrm[0] * naarP[0] + nrm[1] * naarP[1], m, nrm, len, afst: Math.hypot(...m) });
}
const maxDot = Math.max(...kandidaten.map((k) => k.dot));
const beste = kandidaten.filter((k) => k.dot > maxDot - 0.12).sort((a, b) => a.afst - b.afst)[0];
// een vast raam (RD): de plek op die gevel die het dichtst bij dat punt ligt
if (L.raam) {
  const rp = [L.raam[0] - OX, -(L.raam[1] - OY)];
  const t = (rp[0] - beste.m[0]) * -beste.nrm[1] + (rp[1] - beste.m[1]) * beste.nrm[0];
  const tt = Math.max(-beste.len / 2 + 1, Math.min(beste.len / 2 - 1, t));
  beste.m = [beste.m[0] - beste.nrm[1] * tt, beste.m[1] + beste.nrm[0] * tt];
}
// buiten de muur, op de galerij of het balkon van de 4e verdieping
// vloer van de eerste woonlaag (standaard 3,4 m, bij een verhoogd parterre ~1,2 m), daarna 2,8 m per laag
const verdiepingHoogte = (v) => sluip.h0 - H0 + (L.parterre ?? 3.4) + (v - 1) * 2.8 + 1.45;
const ooghoogte = verdiepingHoogte(L.verdieping ?? 1);
const sluipschutter = {
  pos: [r1(beste.m[0] + beste.nrm[0] * 0.9), r1(ooghoogte), r1(beste.m[1] + beste.nrm[1] * 0.9)],
  muur: { normaal: beste.nrm.map(r1), breedte: r1(beste.len) },
  kijk: [r1(J[0]), 1, r1(J[1])],
};

// ---------- grond, straten, groen ----------
const vlakken = [], lijnen = [], bomen = [], heggen = [], dingen = [], muurtjes = [];
const isDicht = (w) => w.nodes.length > 3 && w.nodes[0] === w.nodes.at(-1);
const BREED = { secondary: 8, tertiary: 7, residential: 5.5, unclassified: 5, service: 4, living_street: 5, cycleway: 2.4, footway: 2.2, pedestrian: 5, path: 1.8, steps: 2 };
for (const w of wegen) {
  const t = w.tags, p = punten(w).map((q) => q.map(r1));
  if (p.length < 2) continue;
  if (isDicht(w) && !t.highway) {
    let soort = null;
    if (t.amenity === "parking" && t.parking === "street_side") soort = "strook";
    else if (t.amenity === "parking" && t.parking !== "underground") soort = "parkeer";
    else if (t.amenity === "parking_space") soort = "vak";
    else if (t.landuse === "grass" || t.leisure === "garden" || t.landuse === "forest" || t.leisure === "park") soort = "gras";
    else if (t.natural === "shrubbery" || t.man_made === "planter") soort = "struik";
    else if (t["area:highway"] === "traffic_island") soort = "eiland";
    else if (t.leisure === "playground") soort = t.surface === "artificial_turf" ? "speelgroen" : "speel";
    else if (t.amenity === "bicycle_parking") soort = "fietsvlak";
    if (soort) vlakken.push({ s: soort, r: p });
    if (soort === "struik") heggen.push({ r: p, h: 0.9 });
  }
  if (t.highway && t.area === "yes" && isDicht(w)) vlakken.push({ s: "plein", r: p });
  else if (t.highway && BREED[t.highway]) {
    let b = BREED[t.highway];
    if (t.service === "parking_aisle") b = 5.5;
    if (t.width && +t.width) b = +t.width;
    lijnen.push({ s: t.highway === "cycleway" ? "fietspad" : ["footway", "pedestrian", "path", "steps"].includes(t.highway) ? "stoep" : "weg", b, p, ...(t.service === "parking_aisle" ? { gang: 1 } : {}), ...(t.surface === "asphalt" ? { asfalt: 1 } : {}) });
    if (t.covered === "yes") lijnen.push({ s: "overkapping", b: Math.max(b, 6), p });
  }
  if (t.railway === "tram") lijnen.push({ s: "tram", b: 1.6, p });
  if (t.barrier === "hedge") heggen.push({ l: p, h: 1.2 });
  if ((t.barrier === "wall" || t.barrier === "retaining_wall") && Math.hypot(...p[0]) < VER) muurtjes.push(p);
  if (t.natural === "tree_row") for (let i = 0; i < p.length - 1; i++) {
    const [a, b] = [p[i], p[i + 1]], d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let s = 0; s < d; s += 8) bomen.push([r1(a[0] + ((b[0] - a[0]) * s) / d), r1(a[1] + ((b[1] - a[1]) * s) / d), 9]);
  }
}
for (const n of knoop.values()) {
  const t = n.tags; if (!t) continue;
  const [x, z] = lokaal(n.lat, n.lon).map(r1);
  if (t.natural === "tree") bomen.push([x, z, +(t.height ?? 0) || 8 + ((n.id % 7) - 3)]);
  else if (t.amenity === "bench") dingen.push(["bank", x, z]);
  else if (t.amenity === "waste_basket") dingen.push(["bak", x, z]);
  else if (t.barrier === "bollard") dingen.push(["paal", x, z]);
  else if (t.amenity === "bicycle_parking") dingen.push(["rek", x, z, +(t.capacity ?? 0) || 8]);
  else if (t.amenity === "recycling") dingen.push(["container", x, z]);
  else if (t.railway === "tram_stop") dingen.push(["halte", x, z]);
  else if (t.highway === "street_lamp") dingen.push(["lamp", x, z]);
}

// ---------- winkelborden: elke winkel met een naam op de dichtstbijzijnde gevel ----------
const winkels = [];
for (const n of knoop.values()) {
  const t = n.tags;
  if (!t?.name || !(t.shop || ["fast_food", "restaurant", "cafe", "bank", "pharmacy", "ice_cream"].includes(t.amenity))) continue;
  const p = lokaal(n.lat, n.lon);
  if (Math.hypot(...p) > VER) continue;
  let best = null;
  for (const v of voetafdrukken) {
    const r = v.ring;
    for (let i = 0; i < r.length - 1; i++) {
      const [a, b] = [r[i], r[i + 1]], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz;
      if (L2 < 9) continue;
      const u = Math.max(0.15, Math.min(0.85, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2));
      const q = [a[0] + dx * u, a[1] + dz * u], d = Math.hypot(p[0] - q[0], p[1] - q[1]);
      if (d < 30 && (!best || d < best.d)) {
        const L = Math.sqrt(L2);
        let nrm = [dz / L, -dx / L];
        if (binnen([q[0] + nrm[0] * 0.5, q[1] + nrm[1] * 0.5], r)) nrm = [-nrm[0], -nrm[1]];
        best = { d, q, nrm, h: v.h };
      }
    }
  }
  if (!best) continue;
  const h = Math.min(3.6, Math.max(2.6, best.h - 0.9));
  winkels.push([t.name, r1(best.q[0] + best.nrm[0] * 0.12), r1(best.q[1] + best.nrm[1] * 0.12), r1(Math.atan2(best.nrm[0], best.nrm[1])), r1(h)]);
}

// ---------- oversteken: zebra op straat, dambord over de parkeergangen ----------
const oversteken = [];
for (const w of wegen) {
  const h = w.tags.highway;
  if (!h || !(["secondary", "tertiary", "residential", "unclassified", "service", "living_street", "cycleway"].includes(h))) continue;
  for (let i = 0; i < w.nodes.length; i++) {
    const n = knoop.get(w.nodes[i]);
    if (n?.tags?.highway !== "crossing") continue;
    const p = lokaal(n.lat, n.lon);
    if (Math.hypot(...p) > VER) continue;
    const a = knoop.get(w.nodes[Math.max(0, i - 1)]), b = knoop.get(w.nodes[Math.min(w.nodes.length - 1, i + 1)]);
    if (!a || !b) continue;
    const [pa, pb] = [lokaal(a.lat, a.lon), lokaal(b.lat, b.lon)];
    const soort = n.tags["crossing:markings"] === "no" ? (w.tags.service === "parking_aisle" ? "dambord" : null) : h === "cycleway" ? "blokken" : w.tags.service === "parking_aisle" ? "dambord" : "zebra";
    if (!soort) continue;
    oversteken.push([soort, r1(p[0]), r1(p[1]), r1(Math.atan2(pb[0] - pa[0], pb[1] - pa[1])), r1(BREED[h] ?? 5)]);
  }
}

// ---------- parkeerplekken ----------
// [x, z, hoek, haaks(1)/langs(0)]: uit parkeervakken, uit stroken langs de straat en langs de gangen van de parkeerplaats.
const plekken = [];
function rijVakken(ring) {
  let best = 0, a, b;
  for (let i = 0; i < ring.length - 1; i++) {
    const l = Math.hypot(ring[i + 1][0] - ring[i][0], ring[i + 1][1] - ring[i][1]);
    if (l > best) { best = l; a = ring[i]; b = ring[i + 1]; }
  }
  const dx = (b[0] - a[0]) / best, dz = (b[1] - a[1]) / best;
  let diep = 0;
  for (const p of ring) { const d = (p[0] - a[0]) * -dz + (p[1] - a[1]) * dx; if (Math.abs(d) > Math.abs(diep)) diep = d; }
  const n = [-dz * Math.sign(diep), dx * Math.sign(diep)];
  diep = Math.abs(diep);
  if (diep < 1.6) return;
  const haaks = diep > 4, stap = haaks ? 2.5 : 5.6;
  for (let s = stap / 2; s < best - stap / 2 + 0.3; s += stap)
    plekken.push([r1(a[0] + dx * s + (n[0] * diep) / 2), r1(a[1] + dz * s + (n[1] * diep) / 2), r1(haaks ? Math.atan2(n[0], n[1]) : Math.atan2(dx, dz)), haaks ? 1 : 0]);
}
for (const v of vlakken) if ((v.s === "vak" || v.s === "strook") && Math.hypot(...v.r[0]) < VER) rijVakken(v.r);
const terreinen = vlakken.filter((v) => v.s === "parkeer");
const gangen = lijnen.filter((l) => l.gang);
const afstLijn = (p, l) => {
  let m = 1e9;
  for (let i = 0; i < l.p.length - 1; i++) {
    const [a, b] = [l.p[i], l.p[i + 1]], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2));
    m = Math.min(m, Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t));
  }
  return m;
};
const autoWegen = lijnen.filter((l) => l.s === "weg" || l.s === "stoep");
for (const g of gangen) for (let i = 0; i < g.p.length - 1; i++) {
  const [a, b] = [g.p[i], g.p[i + 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[0] - a[0]) / L, dz = (b[1] - a[1]) / L;
  for (const kant of [1, -1]) for (let s = 3.5; s < L - 3; s += 2.5) {
    const n = [-dz * kant, dx * kant], off = g.b / 2 + 2.5;
    const p = [a[0] + dx * s + n[0] * off, a[1] + dz * s + n[1] * off];
    const hoek = [p[0] + n[0] * 2.3, p[1] + n[1] * 2.3];
    if (!terreinen.some((t) => binnen(p, t.r) && binnen(hoek, t.r))) continue;
    if (autoWegen.some((w) => w !== g && afstLijn(p, w) < w.b / 2 + (w.s === "stoep" ? 1.4 : 2.3))) continue;
    if (bomen.some(([x, z]) => Math.hypot(x - p[0], z - p[1]) < 1.6)) continue;
    if (plekken.some(([x, z]) => Math.hypot(x - p[0], z - p[1]) < 2.2)) continue;
    plekken.push([r1(p[0]), r1(p[1]), r1(Math.atan2(n[0], n[1])), 1]);
  }
}

// ---------- looproutes: het netwerk voor auto's, fietsen en voetgangers ----------
// Bits: 1 = auto, 2 = fiets, 4 = voetganger, 8 = fatbike
const AUTO = new Set(["secondary", "tertiary", "residential", "unclassified", "service", "living_street"]);
const graafKnoop = new Map(), knopen = [], kanten = [];
const pandBox = voetafdrukken.map((v) => ({ r: v.ring, x0: Math.min(...v.ring.map((p) => p[0])), x1: Math.max(...v.ring.map((p) => p[0])), z0: Math.min(...v.ring.map((p) => p[1])), z1: Math.max(...v.ring.map((p) => p[1])) }));
const inPand = (p) => pandBox.some((b) => p[0] > b.x0 && p[0] < b.x1 && p[1] > b.z0 && p[1] < b.z1 && binnen(p, b.r));
const kIdx = (nid) => {
  if (!graafKnoop.has(nid)) { const n = knoop.get(nid); graafKnoop.set(nid, knopen.length); knopen.push(lokaal(n.lat, n.lon).map(r1)); }
  return graafKnoop.get(nid);
};
for (const w of wegen) {
  const h = w.tags.highway;
  if (!h || w.tags.area === "yes" || !BREED[h] || h === "steps") continue;
  if (w.tags.access === "private" && !AUTO.has(h)) continue;
  let bits = 8;
  if (AUTO.has(h)) bits |= 1 | 2 | 4;
  if (h === "cycleway") bits |= 2;
  if (h === "footway" || h === "pedestrian" || h === "path") bits |= 4;
  if (h === "pedestrian" || (h === "footway" && w.tags.bicycle === "yes")) bits |= 2;
  const ns = w.nodes.filter((n) => knoop.has(n));
  const een = w.tags.oneway === "yes" ? 1 : 0;
  for (let i = 0; i < ns.length - 1; i++) {
    // geen stukken die door een gebouw lopen (onderdoorgangen): niemand rijdt of loopt door een muur
    const [pa, pb] = [lokaal(ns[i].lat ?? knoop.get(ns[i]).lat, ns[i].lon ?? knoop.get(ns[i]).lon), lokaal(knoop.get(ns[i + 1]).lat, knoop.get(ns[i + 1]).lon)];
    if ([0.25, 0.5, 0.75].some((t) => inPand([pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t]))) continue;
    kanten.push([kIdx(ns[i]), kIdx(ns[i + 1]), bits, r1(BREED[h]), een]);
  }
}

// ---------- standplaatsen ----------
// Op Pleinzicht (1e, 4e, 7e verdieping en het dak) en op de grond achter drie muurtjes rond de parkeerplaats.
const standplaatsen = [];
const [gx, gz] = [beste.m[0], beste.m[1]], [gnx, gnz] = beste.nrm;
const uitGevel = L.uit ?? 0.9; // hoe ver je voor de gevel staat (balkondiepte)
for (const [v, naam] of L.verdiepingen ?? [[1, "1e verdieping"], [4, "4e verdieping"], [7, "7e verdieping"]]) standplaatsen.push({ naam: `${L.flat ?? ""}${L.flat ? ", " : ""}${naam}`, soort: L.raamStand ? "raam" : L.uit ? "diep" : "balkon", pos: [r1(gx + gnx * uitGevel), r1(verdiepingHoogte(v)), r1(gz + gnz * uitGevel)], normaal: [r1(gnx), r1(gnz)], kijk: sluipschutter.kijk });
if (L.dak !== false) standplaatsen.push({ naam: `${L.flat}, dak`, soort: "dak", pos: [r1(gx - gnx * 0.45), r1(sluip.dak - H0 + 1.6), r1(gz - gnz * 0.45)], normaal: [r1(gnx), r1(gnz)], kijk: sluipschutter.kijk });
const opMuur = (doel, naam) => {
  let best = null;
  for (const m of muurtjes) for (let i = 0; i < m.length - 1; i++) {
    const [a, b] = [m[i], m[i + 1]], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz;
    if (L2 < 4) continue;
    const u = Math.max(0.2, Math.min(0.8, ((doel[0] - a[0]) * dx + (doel[1] - a[1]) * dz) / L2));
    const q = [a[0] + dx * u, a[1] + dz * u], d = Math.hypot(doel[0] - q[0], doel[1] - q[1]);
    const l = Math.sqrt(L2), lq = Math.hypot(...q) || 1;
    // alleen muurtjes waar je overheen naar de parkeerplaats kijkt (niet langs of dwars)
    if (Math.abs((-dz / l) * (-q[0] / lq) + (dx / l) * (-q[1] / lq)) < 0.6) continue;
    if (!best || d < best.d) {
      let n = [-dz / l, dx / l];
      // achter de muur = de kant die van het midden van de parkeerplaats af ligt
      if (n[0] * -q[0] + n[1] * -q[1] > 0) n = [-n[0], -n[1]];
      best = { d, q, n };
    }
  }
  if (!best) return;
  const { q, n } = best;
  standplaatsen.push({ naam, soort: "grond", pos: [r1(q[0] + n[0] * 0.65), 1.45, r1(q[1] + n[1] * 0.65)], muur: [r1(q[0]), r1(q[1])], normaal: [r1(-n[0]), r1(-n[1])], kijk: [0, 0.8, 0] });
};
for (const [x, z, naam] of L.muurplekken ?? []) opMuur([x, z], naam);
// de startplek: de verdieping uit de locatie
const startStand = Math.max(0, standplaatsen.findIndex((x) => x.pos[1] === r1(verdiepingHoogte(L.verdieping ?? 1))));

// ---------- haagbogen over het middenpad en het boogje op Bon Appetit ----------
const B = GEDEELD.bogen, bb = [B.bij[0] - OX, -(B.bij[1] - OY)], bn = [B.nietBij[0] - OX, -(B.nietBij[1] - OY)];
const terrein = vlakken.filter((v) => v.s === "parkeer").sort((a, b) => Math.hypot(a.r[0][0] - bb[0], a.r[0][1] - bb[1]) - Math.hypot(b.r[0][0] - bb[0], b.r[0][1] - bb[1]))[0];
const bogen = [];
for (const l of lijnen) if (l.s === "stoep" && terrein) for (let i = 0; i < l.p.length - 1; i++) {
  const [a, b] = [l.p[i], l.p[i + 1]], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  for (let t = 2; t < len - 1; t += 3.2) {
    const p = [a[0] + ((b[0] - a[0]) * t) / len, a[1] + ((b[1] - a[1]) * t) / len];
    if (!binnen(p, terrein.r) || Math.hypot(p[0] - bb[0], p[1] - bb[1]) > B.straal) continue;
    if (Math.hypot(p[0] - bn[0], p[1] - bn[1]) < B.nietStraal) continue; // niet op het pad vlak voor de flat: daar staat er in het echt geen
    if (bomen.some(([x, z]) => Math.hypot(x - p[0], z - p[1]) < 2.2)) continue;
    if (bogen.some(([x, z]) => Math.hypot(x - p[0], z - p[1]) < 3)) continue;
    bogen.push([r1(p[0]), r1(p[1]), r1(Math.atan2(b[0] - a[0], b[1] - a[1])), r1(Math.max(2.2, l.b))]);
  }
}
const bon = winkels.find((w) => w[0] === "Bon Appetit");
let dakboog = null;
if (bon) {
  const v = voetafdrukken.filter((v) => v.h - H0 < 7).map((v) => ({ v, c: v.ring.reduce((s, p) => [s[0] + p[0] / v.ring.length, s[1] + p[1] / v.ring.length], [0, 0]) }))
    .sort((a, b) => Math.hypot(a.c[0] - bon[1], a.c[1] - bon[2]) - Math.hypot(b.c[0] - bon[1], b.c[1] - bon[2]))[0];
  if (v) dakboog = [r1(v.c[0]), r1(v.c[1]), r1(v.v.h - H0), bon[3]];
}

// ---------- vaste auto's: op de parkeerplekken het dichtst bij de voordeur ----------
const vasteAutos = [];
for (const va of GEDEELD.vasteAutos) {
  const [bx, bz] = [va.bij[0] - OX, -(va.bij[1] - OY)];
  const vrij = plekken.filter((p) => !p.bezet).sort((a, b) => Math.hypot(a[0] - bx, a[1] - bz) - Math.hypot(b[0] - bx, b[1] - bz))[0];
  if (vrij && Math.hypot(vrij[0] - bx, vrij[1] - bz) > 40) break; // geen plek in de buurt (valt buiten deze kaart)
  if (!vrij) break;
  vrij.bezet = true;
  vasteAutos.push([vrij[0], vrij[1], vrij[2], vrij[3], va.soort, va.kleur]);
  // de plek recht voor een vaste auto blijft leeg, zodat je er zonder steken uit kunt rijden
  const [hx, hz] = [Math.sin(vrij[2]), Math.cos(vrij[2])];
  for (const q of plekken) {
    const dx = q[0] - vrij[0], dz = q[1] - vrij[1], voor = dx * hx + dz * hz, zij = Math.abs(dx * hz - dz * hx);
    if (!q.bezet && voor > 1 && voor < 8 && zij < 1.6) q.bezet = true;
  }
}

// ---------- hangplekken voor fatbikes ----------
const hangplekken = [];
for (const w of winkels) if (["Jumbo", "Bon Appetit", "Albert Heijn", "HEMA", "Action"].includes(w[0])) hangplekken.push([r1(w[1] + Math.sin(w[3]) * 3), r1(w[2] + Math.cos(w[3]) * 3)]);
for (const [s2, x, z] of dingen) if (s2 === "rek" && Math.hypot(x, z) < 70) hangplekken.push([x, z]);
// en bij een speeltuintje
const speeltuinen = [];
for (const v of vlakken) if (v.s.startsWith("speel")) {
  const c = v.r.reduce((m, q) => [m[0] + q[0] / v.r.length, m[1] + q[1] / v.r.length], [0, 0]);
  const straal = Math.min(...v.r.map((q) => Math.hypot(q[0] - c[0], q[1] - c[1])));
  speeltuinen.push([r1(c[0]), r1(c[1]), r1(straal)]);
  // hangjeugd: groepjes rondom, net buiten de rand en op het kunstgras
  if (Math.hypot(...c) < 90) for (let i = 0; i < (L.hangjeugd ? 7 : 1); i++) { const h = i * 0.9 + 0.3, r = i === 6 ? straal * 0.55 : straal + 1.6; hangplekken.push([r1(c[0] + Math.cos(h) * r), r1(c[1] + Math.sin(h) * r)]); }
}

const uit = {
  naam: L.naam, kort: L.kort, modus: L.modus ?? "rondes", seizoen: L.seizoen ?? "zomer", tijd: L.tijd, grond: L.grond, druk: L.druk, karate: L.karate, hangjeugd: L.hangjeugd, fatDruk: L.fatDruk, bron: "3D BAG (CC BY 4.0), © OpenStreetMap-bijdragers (ODbL)",
  sluipschutter, muren, daken, voetafdrukken: voetafdrukken.filter((v) => Math.hypot(...v.ring[0]) < VER + 20),
  vlakken, lijnen, bomen, heggen, dingen, plekken: plekken.filter((p) => !p.bezet), vasteAutos, winkels, oversteken, muurtjes, standplaatsen, startStand, bogen, dakboog, hangplekken, speeltuinen, graaf: { knopen, kanten },
};
writeFileSync(`data/${id}.json`, JSON.stringify(uit));
const tri = Object.values(muren).reduce((s, m) => s + m.pos.length / 9, 0) + Object.values(daken).reduce((s, m) => s + m.pos.length / 9, 0);
console.log(`${id}: ${plekken.length} parkeerplekken, ${voetafdrukken.length} gebouwen, ${Math.round(tri)} driehoeken, ${bomen.length} bomen, ${knopen.length} knopen, ${kanten.length} kanten`);
console.log("standplaatsen", standplaatsen.map((x) => x.naam + " " + x.pos.join(",")).join(" | "));
console.log("bogen", bogen.length, "dakboog", JSON.stringify(dakboog), "hangplekken", hangplekken.length, "muurtjes", muurtjes.length);
