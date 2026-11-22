// Alle figuren worden in code opgebouwd: mensen (één SkinnedMesh met 12 botten), fietsen, fatbikes, auto's.
// Voorkant = +z. Eén draw call per figuur waar het kan (vertex-kleuren).
import * as THREE from "three";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const kleur = new THREE.Color();

/** Voeg een geometrie toe aan een bak: maakt hem niet-geïndexeerd, transformeert, kleurt, en geeft botgewicht. */
function stuk(bak, geo, kl, m, bot = 0) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (m) g.applyMatrix4(m);
  const n = g.attributes.position.count;
  kleur.set(kl);
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = kleur.r; c[i * 3 + 1] = kleur.g; c[i * 3 + 2] = kleur.b; }
  g.setAttribute("color", new THREE.BufferAttribute(c, 3));
  if (!g.attributes.normal) g.computeVertexNormals();
  g.deleteAttribute("uv");
  bak.push({ g, bot });
}
function plak(bak, metBotten) {
  let n = 0;
  for (const { g } of bak) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const si = metBotten ? new Uint16Array(n * 4) : null, sw = metBotten ? new Float32Array(n * 4) : null;
  let o = 0;
  for (const { g, bot } of bak) {
    const k = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    col.set(g.attributes.color.array, o * 3);
    if (metBotten) for (let i = 0; i < k; i++) { si[(o + i) * 4] = bot; sw[(o + i) * 4] = 1; }
    o += k;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  if (metBotten) { geo.setAttribute("skinIndex", new THREE.BufferAttribute(si, 4)); geo.setAttribute("skinWeight", new THREE.BufferAttribute(sw, 4)); }
  geo.computeBoundingSphere();
  return geo;
}
const M = (p = V(0, 0, 0), r = [0, 0, 0], s = [1, 1, 1]) =>
  new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), V(...s));
/** Buis van a naar b. */
function buis(bak, a, b, r, kl, bot = 0, zijden = 6) {
  const d = b.clone().sub(a), l = d.length();
  const geo = new THREE.CylinderGeometry(r, r, l, zijden, 1);
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize());
  stuk(bak, geo, kl, new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, V(1, 1, 1)), bot);
}
const blok = (bak, w, h, d, p, kl, r, bot = 0) => stuk(bak, new THREE.BoxGeometry(w, h, d), kl, M(p, r), bot);
const bol = (bak, rad, p, kl, s = [1, 1, 1], bot = 0, seg = 8) => stuk(bak, new THREE.SphereGeometry(rad, seg, Math.max(4, seg - 2)), kl, M(p, [0, 0, 0], s), bot);

export const kies = (a) => a[Math.floor(Math.random() * a.length)];
export const tussen = (a, b) => a + Math.random() * (b - a);

// ---------- mensen ----------
const HUID = ["#f1c7a5", "#e0ac84", "#c68b62", "#a8714c", "#7d5034", "#5b3a26"];
const HAAR = ["#1d1511", "#3b2a1e", "#6b4a2d", "#a57a45", "#d8c08a", "#8a8a8a", "#e8e2d6", "#7a2e1a"];
const KLEREN = ["#2a3b5c", "#5b6b7a", "#7c2d2d", "#3d5a3a", "#c9b79c", "#e8e4dc", "#36454f", "#8c6a4f", "#b84a62", "#d9a441", "#4a7fb5", "#6d5b8c", "#1f1f22"];
const BROEK = ["#22304a", "#2f2f33", "#4a4a52", "#5b4a3a", "#3a4a5c", "#8b8070", "#1b1b1e"];

// botten: 0 wortel, 1 heup, 2 romp, 3 hoofd, 4/5 arm L boven/onder, 6/7 arm R, 8/9 been L boven/onder, 10/11 been R
const BOTPOS = [V(0, 0, 0), V(0, 0.93, 0), V(0, 1.05, 0), V(0, 1.5, 0), V(0.2, 1.42, 0), V(0.22, 1.14, 0), V(-0.2, 1.42, 0), V(-0.22, 1.14, 0), V(0.1, 0.93, 0), V(0.1, 0.5, 0), V(-0.1, 0.93, 0), V(-0.1, 0.5, 0)];
const OUDER = [-1, 0, 1, 2, 2, 4, 2, 6, 1, 8, 1, 10];

export function maakMens(o = {}) {
  const huid = o.huid ?? kies(HUID), shirt = o.shirt ?? kies(KLEREN), broek = o.broek ?? kies(BROEK);
  const haar = o.haar ?? kies(HAAR), schoen = o.schoen ?? kies(["#1a1a1a", "#f2f2f2", "#5a3a22", "#2a2a3a"]);
  const lang = o.lang ?? 0.9 + Math.random() * 0.2, breed = o.breed ?? 0.9 + Math.random() * 0.3;
  const bak = [];
  // benen
  for (const [s, b1, b2] of [[1, 8, 9], [-1, 10, 11]]) {
    stuk(bak, new THREE.CapsuleGeometry(0.075, 0.33, 1, 6), broek, M(V(0.1 * s, 0.72, 0)), b1);
    stuk(bak, new THREE.CapsuleGeometry(0.06, 0.34, 1, 6), broek, M(V(0.1 * s, 0.3, 0)), b2);
    blok(bak, 0.1, 0.08, 0.25, V(0.1 * s, 0.04, 0.04), schoen, [0, 0, 0], b2);
  }
  // heup en romp
  blok(bak, 0.32, 0.18, 0.2, V(0, 0.94, 0), broek, [0, 0, 0], 1);
  stuk(bak, new THREE.CapsuleGeometry(0.15, 0.32, 2, 8), shirt, M(V(0, 1.24, 0), [0, 0, 0], [1.2 * breed, 1, 0.78 * breed]), 2);
  if (o.capuchon) stuk(bak, new THREE.SphereGeometry(0.15, 9, 7), shirt, M(V(0, 1.47, -0.07), [0, 0, 0], [1, 0.8, 0.9]), 2);
  if (o.tas) blok(bak, 0.28, 0.32, 0.12, V(0, 1.22, -0.17), o.tas, [0, 0, 0], 2);
  stuk(bak, new THREE.CylinderGeometry(0.05, 0.055, 0.1, 7), huid, M(V(0, 1.47, 0)), 2);
  // hoofd
  stuk(bak, new THREE.SphereGeometry(0.105, 12, 9), huid, M(V(0, 1.6, 0.01), [0, 0, 0], [0.92, 1.08, 1]), 3);
  blok(bak, 0.03, 0.05, 0.03, V(0, 1.59, 0.105), huid, [0, 0, 0], 3);
  for (const s of [1, -1]) bol(bak, 0.012, V(0.035 * s, 1.625, 0.095), "#1a1410", [1, 1, 1], 3, 5);
  if (o.pet) {
    stuk(bak, new THREE.SphereGeometry(0.112, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), o.pet, M(V(0, 1.63, 0)), 3);
    blok(bak, 0.18, 0.015, 0.1, V(0, 1.64, 0.12), o.pet, [0, 0, 0], 3);
  } else if (o.capuchon) {
    stuk(bak, new THREE.SphereGeometry(0.125, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), shirt, M(V(0, 1.6, -0.01), [-0.25, 0, 0]), 3);
  } else {
    const kort = o.kort ?? Math.random() < 0.55;
    stuk(bak, new THREE.SphereGeometry(0.113, 10, 7, 0, Math.PI * 2, 0, kort ? Math.PI * 0.5 : Math.PI * 0.62), haar, M(V(0, 1.615, -0.008), [-0.3, 0, 0]), 3);
    if (!kort) blok(bak, 0.2, 0.22, 0.06, V(0, 1.49, -0.08), haar, [0.15, 0, 0], kort ? 3 : 2);
  }
  // armen
  const mouw = o.korteMouw ? huid : shirt;
  for (const [s, b1, b2] of [[1, 4, 5], [-1, 6, 7]]) {
    stuk(bak, new THREE.CapsuleGeometry(0.052, 0.22, 1, 5), shirt, M(V(0.22 * s, 1.28, 0)), b1);
    stuk(bak, new THREE.CapsuleGeometry(0.044, 0.22, 1, 5), mouw, M(V(0.225 * s, 1.0, 0)), b2);
    bol(bak, 0.045, V(0.225 * s, 0.84, 0.01), huid, [0.8, 1.1, 1], b2, 6);
  }
  const geo = plak(bak, true);
  const botten = BOTPOS.map(() => new THREE.Bone());
  BOTPOS.forEach((p, i) => {
    const b = botten[i];
    b.position.copy(OUDER[i] < 0 ? p : p.clone().sub(BOTPOS[OUDER[i]]));
    if (OUDER[i] >= 0) botten[OUDER[i]].add(b);
  });
  const mesh = new THREE.SkinnedMesh(geo, MAT.mens);
  mesh.add(botten[0]);
  mesh.bind(new THREE.Skeleton(botten));
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  mesh.scale.setScalar(lang);
  mesh.userData.botten = botten;
  return mesh;
}

/** Zet de houding van een mens. f = fase (rad), soort = lopen|rennen|duwen|staan|bellen|fietsen|trappen|achterop|wachten|wijzen|zitten|boos|schrik|vliegen|liggen */
export function houding(mens, soort, f, sterkte = 1, extra = 0) {
  const b = mens.userData.botten;
  for (let i = 1; i < 12; i++) b[i].rotation.set(0, 0, 0);
  b[1].position.y = 0.93;
  const s = Math.sin(f), c = Math.cos(f);
  if (soort === "lopen" || soort === "rennen" || soort === "duwen") {
    const a = (soort === "rennen" ? 0.75 : 0.45) * sterkte;
    b[8].rotation.x = -s * a; b[10].rotation.x = s * a;
    b[9].rotation.x = Math.max(0, c) * a * 1.3; b[11].rotation.x = Math.max(0, -c) * a * 1.3;
    b[1].position.y = 0.93 + Math.abs(c) * 0.025 * sterkte;
    if (soort === "duwen") {
      b[4].rotation.x = b[6].rotation.x = -1.1; b[5].rotation.x = b[7].rotation.x = -0.35;
      b[2].rotation.x = 0.12;
    } else {
      b[4].rotation.x = s * a * 0.9; b[6].rotation.x = -s * a * 0.9;
      b[5].rotation.x = b[7].rotation.x = -0.25 - (soort === "rennen" ? 0.9 : 0);
      if (soort === "rennen") b[2].rotation.x = 0.25;
      b[4].rotation.z = 0.08; b[6].rotation.z = -0.08;
    }
  } else if (soort === "staan" || soort === "bellen") {
    b[2].rotation.y = Math.sin(f * 0.3) * 0.08;
    b[3].rotation.y = Math.sin(f * 0.21 + 1) * 0.4;
    b[4].rotation.z = 0.06; b[6].rotation.z = -0.06;
    if (soort === "bellen") { b[6].rotation.x = -0.4; b[6].rotation.z = -0.3; b[7].rotation.x = -2.3; b[3].rotation.x = 0.35; b[3].rotation.y = 0; }
  } else if (soort === "fietsen" || soort === "trappen" || soort === "achterop") {
    // zitten; extra = hoe ver de armen naar voren moeten
    b[2].rotation.x = soort === "achterop" ? 0.05 : 0.3;
    const t = soort === "trappen" ? 0.35 : 0;
    b[8].rotation.x = -1.25 - s * t; b[10].rotation.x = -1.25 + s * t;
    b[9].rotation.x = 1.25 + c * t * 1.2; b[11].rotation.x = 1.25 - c * t * 1.2;
    b[8].rotation.z = 0.12; b[10].rotation.z = -0.12;
    if (soort === "achterop") {
      b[4].rotation.x = b[6].rotation.x = -0.6; b[5].rotation.x = b[7].rotation.x = -0.9;
      b[4].rotation.z = 0.5; b[6].rotation.z = -0.5;
      b[3].rotation.y = Math.sin(f * 0.2) * 0.5;
    } else {
      b[4].rotation.x = b[6].rotation.x = -1.05 - extra; b[5].rotation.x = b[7].rotation.x = -0.3;
      b[4].rotation.z = 0.25; b[6].rotation.z = -0.25;
      b[3].rotation.x = -0.25;
    }
  } else if (soort === "wachten") {
    // stil op het zadel: één voet aan de grond, telefoon in de hand
    b[2].rotation.x = 0.05;
    b[8].rotation.x = -1.2; b[9].rotation.x = 1.2; b[8].rotation.z = 0.15;
    b[10].rotation.x = -0.25; b[10].rotation.z = -0.22; b[11].rotation.x = 0.1;
    b[4].rotation.x = -0.9; b[5].rotation.x = -0.4; b[4].rotation.z = 0.25;
    b[6].rotation.x = -0.5; b[6].rotation.z = -0.3; b[7].rotation.x = -1.9;
    b[3].rotation.x = 0.4; b[3].rotation.y = Math.sin(f * 0.2) * 0.15;
  } else if (soort === "wijzen") {
    // arm gestrekt omhoog naar de flat, andere hand voor de mond
    b[6].rotation.x = -2.2; b[6].rotation.z = -0.15; b[7].rotation.x = -0.1;
    b[4].rotation.x = -1.6; b[4].rotation.z = 0.5; b[5].rotation.x = -1.9;
    b[3].rotation.x = -0.45; b[2].rotation.x = -0.08;
  } else if (soort === "zitten") {
    // op een bankje: heup op zithoogte
    b[1].position.y = 0.5;
    b[8].rotation.x = b[10].rotation.x = -1.5; b[9].rotation.x = b[11].rotation.x = 1.45;
    b[8].rotation.z = 0.08; b[10].rotation.z = -0.08;
    b[4].rotation.x = b[6].rotation.x = -0.5; b[5].rotation.x = b[7].rotation.x = -0.6;
    b[3].rotation.y = Math.sin(f * 0.25) * 0.5; b[3].rotation.x = 0.1;
  } else if (soort === "boos") {
    // vuisten schudden en stampen
    b[4].rotation.x = -2.3 + s * 0.4; b[6].rotation.x = -2.3 - s * 0.4;
    b[5].rotation.x = b[7].rotation.x = -1.2;
    b[4].rotation.z = 0.3; b[6].rotation.z = -0.3;
    b[8].rotation.x = Math.max(0, s) * -0.5; b[9].rotation.x = Math.max(0, s) * 0.7;
    b[3].rotation.x = -0.2;
  } else if (soort === "schrik") {
    b[4].rotation.x = b[6].rotation.x = -2.6; b[4].rotation.z = 0.5; b[6].rotation.z = -0.5;
    b[5].rotation.x = b[7].rotation.x = -0.6; b[2].rotation.x = -0.15;
  } else if (soort === "vliegen") {
    // armen en benen maaien
    b[4].rotation.x = -2 + Math.sin(f * 2.3) * 1.2; b[6].rotation.x = -2 + Math.sin(f * 2.7 + 1) * 1.2;
    b[4].rotation.z = 0.9; b[6].rotation.z = -0.9;
    b[8].rotation.x = Math.sin(f * 2.1) * 0.9; b[10].rotation.x = Math.sin(f * 2.5 + 2) * 0.9;
    b[9].rotation.x = 0.8 + Math.sin(f * 3) * 0.5; b[11].rotation.x = 0.8 + Math.sin(f * 3.4) * 0.5;
  } else if (soort === "liggen") {
    b[4].rotation.z = 1.2 + extra * 0.2; b[6].rotation.z = -1.0; b[4].rotation.x = -0.4;
    b[8].rotation.z = 0.2; b[10].rotation.x = -0.6; b[11].rotation.x = 1.0;
    b[3].rotation.y = Math.sin(f * 0.8) * 0.4 * extra;
  }
}

// ---------- fietsen ----------
function wiel(r, band, velg, kl = "#1b1b1b", spaken = true) {
  const bak = [];
  stuk(bak, new THREE.TorusGeometry(r - band, band, 6, 18), kl, M(V(), [0, Math.PI / 2, 0]));
  stuk(bak, new THREE.TorusGeometry(r - band * 2, 0.012, 3, 14), velg, M(V(), [0, Math.PI / 2, 0]));
  stuk(bak, new THREE.CylinderGeometry(0.035, 0.035, 0.08, 8), velg, M(V(), [0, 0, Math.PI / 2]));
  if (spaken) for (let i = 0; i < 6; i++) blok(bak, 0.005, (r - band * 2) * 2, 0.005, V(), velg, [(i * Math.PI) / 6, 0, 0]);
  else stuk(bak, new THREE.CylinderGeometry(r - band * 2, r - band * 2, 0.03, 16), velg, M(V(), [0, 0, Math.PI / 2]));
  const m = new THREE.Mesh(plak(bak), MAT.voertuig);
  m.castShadow = true;
  return m;
}

/** soort: fatbike | fiets | ebike | bakfiets. Geeft een Group met wielen in userData en raakvlakken (in lokale ruimte). */
export function maakFiets(soort, o = {}) {
  const g = new THREE.Group(), bak = [];
  const raak = [];
  let rW, band, wielbasis, zadel, stuurP, kl = o.kleur;
  if (soort === "fatbike") {
    kl ??= kies(["#151515", "#151515", "#1e1e1e", "#3c3f33", "#b9ab8e", "#e9e9e6", "#28324a"]);
    rW = 0.34; band = 0.085; wielbasis = 1.18; zadel = 0.86;
    const a = V(0, rW, -wielbasis / 2), v = V(0, rW, wielbasis / 2);
    const stuurB = V(0, 1.0, wielbasis / 2 - 0.16);
    // dik frame
    buis(bak, a, V(0, 0.62, -0.08), 0.03, kl, 0, 6);
    buis(bak, V(0, 0.42, 0.08), stuurB.clone().add(V(0, -0.22, 0)), 0.042, kl);
    buis(bak, a, V(0, 0.42, 0.06), 0.028, kl);
    buis(bak, V(0, 0.42, 0.06), V(0, zadel - 0.08, -0.12), 0.034, kl);
    // grote accu in het frame (doelwit)
    blok(bak, 0.13, 0.17, 0.4, V(0, 0.6, 0.1), "#262626", [-0.35, 0, 0]);
    blok(bak, 0.135, 0.03, 0.41, V(0, 0.69, 0.12), "#7fd34e", [-0.35, 0, 0]);
    raak.push({ deel: "accu", min: V(-0.08, 0.47, -0.13), max: V(0.08, 0.76, 0.32) });
    // lange buddyseat
    blok(bak, 0.22, 0.09, 0.62, V(0, zadel, -0.2), "#1b1b1b");
    blok(bak, 0.18, 0.03, 0.4, V(0, zadel - 0.07, -0.48), kl);
    // voorvork + stuur
    buis(bak, v, stuurB.clone().add(V(0, -0.2, -0.02)), 0.03, "#2a2a2a");
    buis(bak, stuurB.clone().add(V(0, -0.2, 0)), stuurB, 0.022, "#2a2a2a");
    buis(bak, stuurB.clone().add(V(-0.34, 0.04, -0.06)), stuurB.clone().add(V(0.34, 0.04, -0.06)), 0.016, "#1a1a1a");
    bol(bak, 0.075, stuurB.clone().add(V(0, -0.14, 0.09)), "#dedede", [1, 1, 0.6]);
    // spatborden en voetsteunen
    stuk(bak, new THREE.TorusGeometry(rW + 0.04, 0.05, 3, 10, Math.PI * 0.7), "#151515", M(a.clone(), [0, Math.PI / 2, 0], [1, 1, 1.4]).multiply(M(V(), [0, 0, Math.PI * 0.15])));
    blok(bak, 0.46, 0.025, 0.06, V(0, 0.28, -0.1), "#2b2b2b");
    raak.push({ deel: "frame", min: V(-0.1, 0.3, -0.55), max: V(0.1, 1.0, 0.5) });
    stuurP = stuurB;
  } else {
    kl ??= kies(soort === "ebike" ? ["#d8d8d6", "#4a4f57", "#1f2a3d", "#6c7a6a", "#a7b3bf"] : ["#101820", "#1c2b4a", "#283d2b", "#5a1f1f", "#202020", "#7a7a75", "#a3332b", "#3f5e7a"]);
    rW = 0.35; band = 0.02; wielbasis = soort === "bakfiets" ? 1.9 : 1.1; zadel = 0.98;
    const a = V(0, rW, -wielbasis / 2), v = V(0, rW, wielbasis / 2);
    const trap = V(0, 0.3, soort === "bakfiets" ? -0.25 : -0.05);
    const zadelP = V(0, zadel - 0.05, trap.z - 0.18);
    const stuurB = V(0, 1.1, soort === "bakfiets" ? 0.25 : wielbasis / 2 - 0.12);
    buis(bak, a, trap, 0.016, kl);
    buis(bak, a, zadelP, 0.014, kl);
    buis(bak, trap, zadelP, 0.019, kl);
    buis(bak, trap, stuurB.clone().add(V(0, -0.3, -0.03)), 0.022, kl);
    if (soort === "bakfiets") {
      buis(bak, stuurB.clone().add(V(0, -0.3, -0.03)), V(0, 0.25, wielbasis / 2 - 0.55), 0.025, kl);
      blok(bak, 0.62, 0.42, 0.75, V(0, 0.52, wielbasis / 2 - 0.42), kies(["#7a5a3a", "#2f3b45", "#a4472f"]));
      raak.push({ deel: "frame", min: V(-0.33, 0.25, -0.2), max: V(0.33, 0.8, wielbasis / 2) });
    } else buis(bak, stuurB.clone().add(V(0, -0.3, -0.03)), v, 0.016, "#333");
    buis(bak, stuurB.clone().add(V(0, -0.3, -0.03)), stuurB, 0.016, "#333");
    stuk(bak, new THREE.TorusGeometry(0.2, 0.012, 4, 10, Math.PI), "#222", M(stuurB.clone().add(V(0, 0, -0.12)), [Math.PI / 2, 0, 0]));
    blok(bak, 0.16, 0.06, 0.25, zadelP.clone().add(V(0, 0.06, 0)), "#2a1f19");
    blok(bak, 0.03, 0.16, 0.5, V(0.07, 0.3, trap.z - 0.18), kl); // kettingkast
    if (soort !== "bakfiets") {
      stuk(bak, new THREE.TorusGeometry(rW + 0.02, 0.016, 3, 10, Math.PI * 0.75), kl, M(a.clone(), [0, Math.PI / 2, 0]).multiply(M(V(), [0, 0, Math.PI * 0.1])));
      stuk(bak, new THREE.TorusGeometry(rW + 0.02, 0.016, 3, 10, Math.PI * 0.6), kl, M(v.clone(), [0, Math.PI / 2, 0]).multiply(M(V(), [0, 0, Math.PI * 0.15])));
      blok(bak, 0.14, 0.02, 0.34, V(0, 0.75, a.z + 0.05), "#2b2b2b"); // bagagedrager
      if (Math.random() < 0.35) blok(bak, 0.3, 0.32, 0.36, V(0.17, 0.62, a.z + 0.05), kies(["#3a5a3a", "#5a3a3a", "#2a3a5a", "#d4c6a1"]));
      if (Math.random() < 0.3) blok(bak, 0.3, 0.2, 0.25, stuurB.clone().add(V(0, -0.22, 0.25)), "#6b4b2b");
    }
    if (soort === "ebike") {
      blok(bak, 0.1, 0.09, 0.36, V(0, 0.82, a.z + 0.1), "#2a2a2a");
      raak.push({ deel: "frame", min: V(-0.06, 0.76, a.z - 0.1), max: V(0.06, 0.88, a.z + 0.3) });
    }
    raak.push({ deel: "frame", min: V(-0.06, 0.25, -wielbasis / 2), max: V(0.06, 1.1, wielbasis / 2) });
    stuurP = stuurB;
  }
  const m = new THREE.Mesh(plak(bak), MAT.voertuig);
  m.castShadow = true;
  g.add(m);
  const velg = soort === "fatbike" ? "#2e2e2e" : "#b9b9b9";
  const wa = wiel(rW, band, velg, "#161616", soort !== "fatbike");
  const wv = wiel(soort === "bakfiets" ? 0.25 : rW, band, velg, "#161616", soort !== "fatbike");
  wa.position.set(0, rW, -wielbasis / 2);
  wv.position.set(0, soort === "bakfiets" ? 0.25 : rW, wielbasis / 2);
  g.add(wa, wv);
  raak.push({ deel: "band", min: V(-band - 0.02, 0, -wielbasis / 2 - rW), max: V(band + 0.02, rW * 2, -wielbasis / 2 + rW) });
  raak.push({ deel: "band", min: V(-band - 0.02, 0, wielbasis / 2 - rW), max: V(band + 0.02, rW * 2, wielbasis / 2 + rW) });
  g.userData = { soort, wielen: [wa, wv], rW, raak, zadel, stuur: stuurP, wielbasis, hoofd: m };
  return g;
}

// ---------- auto's ----------
// Zoals op het plein (Google 3D): vooral zwart, donkergrijs, zilver en wit; af en toe blauw, rood of een gele taxi.
const AUTOKLEUR = [
  ...Array(9).fill("#141517"), ...Array(4).fill("#2a2c30"), ...Array(5).fill("#4a4d52"), ...Array(6).fill("#a9adb2"), ...Array(7).fill("#e9eaec"),
  "#1f3b6e", "#2f5fa0", "#8b1e1e", "#b3241f", "#e2b021", "#6f7d70", "#c9c3b3",
];
export function maakAuto(o = {}) {
  const bak = [];
  const kl = o.kleur ?? kies(AUTOKLEUR);
  const soort = o.soort ?? kies(["hatch", "hatch", "sedan", "suv", "busje"]);
  const L = { hatch: 3.9, sedan: 4.6, suv: 4.5, busje: 5.0 }[soort];
  const B = soort === "busje" ? 1.95 : soort === "suv" ? 1.85 : 1.76;
  const H = { hatch: 1.48, sedan: 1.45, suv: 1.68, busje: 2.1 }[soort];
  const vorm = new THREE.Shape();
  const z0 = -L / 2, z1 = L / 2;
  // zijprofiel in (z, y)
  const pts = soort === "busje"
    ? [[z0, 0.3], [z1, 0.3], [z1, 0.95], [z1 - 0.45, 1.3], [z1 - 0.8, H], [z0, H]]
    : soort === "hatch"
    ? [[z0, 0.3], [z1, 0.3], [z1, 0.78], [z1 - 0.9, 0.92], [z1 - 1.6, H], [z0 + 0.4, H], [z0 + 0.05, 0.98]]
    : soort === "suv"
    ? [[z0, 0.35], [z1, 0.35], [z1, 0.95], [z1 - 1.0, 1.08], [z1 - 1.6, H], [z0 + 0.35, H], [z0, 1.05]]
    : [[z0, 0.3], [z1, 0.3], [z1, 0.75], [z1 - 1.1, 0.88], [z1 - 1.75, H], [z0 + 1.0, H], [z0 + 0.45, 0.95], [z0, 0.88]];
  vorm.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts.slice(1)) vorm.lineTo(p[0], p[1]);
  const romp = new THREE.ExtrudeGeometry(vorm, { depth: B, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 1 });
  romp.translate(0, 0, -B / 2);
  stuk(bak, romp, kl, M(V(), [0, -Math.PI / 2, 0]));
  // ruiten: iets kleiner profiel van het bovenste deel, donker
  const ram = new THREE.Shape();
  const top = pts.filter((p) => p[1] > 0.85);
  const midY = soort === "busje" ? 1.0 : soort === "suv" ? 1.1 : 0.95;
  const rpts = [[top[0][0] - 0.05, midY], ...top.map(([z, y]) => [z * 0.97, Math.min(y, H) - 0.07])].filter((p) => p[1] >= midY - 0.01);
  ram.moveTo(rpts[0][0], midY);
  for (const p of rpts) ram.lineTo(p[0], Math.max(p[1], midY));
  ram.lineTo(rpts.at(-1)[0], midY);
  const ruit = new THREE.ExtrudeGeometry(ram, { depth: B + 0.1, bevelEnabled: false });
  ruit.translate(0, 0, -(B + 0.1) / 2);
  stuk(bak, ruit, "#1d2630", M(V(), [0, -Math.PI / 2, 0], [0.985, 1, 1]));
  for (const z of [z0 + 0.75, z1 - 0.75]) for (const x of [-B / 2 + 0.02, B / 2 - 0.02])
    stuk(bak, new THREE.CylinderGeometry(0.31, 0.31, 0.22, 10), "#151515", M(V(x, 0.31, z), [0, 0, Math.PI / 2]));
  for (const x of [-B / 2 + 0.3, B / 2 - 0.3]) {
    blok(bak, 0.3, 0.1, 0.05, V(x, 0.72, z1 + 0.05), "#f4f1e0");
    blok(bak, 0.3, 0.1, 0.05, V(x, 0.8, z0 - 0.05), "#8e1111");
  }
  blok(bak, B * 0.4, 0.12, 0.04, V(0, 0.45, z1 + 0.06), "#e9e6d0"); // kenteken
  const mesh = new THREE.Mesh(plak(bak), MAT.auto);
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.userData = { soort, L, B, H, raak: [{ deel: "auto", min: V(-B / 2, 0.15, z0), max: V(B / 2, H, z1) }] };
  return mesh;
}

/** Winkelwagentje. */
export function maakKar() {
  const bak = [];
  for (const [w, h, d, p] of [[0.5, 0.02, 0.8, V(0, 0.45, 0)], [0.02, 0.4, 0.8, V(0.25, 0.65, 0)], [0.02, 0.4, 0.8, V(-0.25, 0.65, 0)], [0.5, 0.4, 0.02, V(0, 0.65, 0.4)], [0.5, 0.4, 0.02, V(0, 0.65, -0.4)], [0.5, 0.03, 0.03, V(0, 0.98, -0.5)]])
    blok(bak, w, h, d, p, "#a9adb3");
  if (Math.random() < 0.8) blok(bak, 0.4, 0.25, 0.6, V(0, 0.6, 0), kies(["#c8a46a", "#e3e0d6", "#6f8c4a", "#c44"]));
  for (const x of [-0.2, 0.2]) for (const z of [-0.35, 0.35]) bol(bak, 0.05, V(x, 0.05, z), "#222", [1, 1, 1], 0, 5);
  buis(bak, V(0, 0.08, -0.35), V(0, 0.45, -0.38), 0.015, "#a9adb3");
  const m = new THREE.Mesh(plak(bak), MAT.voertuig);
  m.castShadow = true;
  return m;
}

export const MAT = {
  mens: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }),
  voertuig: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.15 }),
  auto: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.35 }),
};
export { plak, stuk, blok, buis, bol, M, V };
