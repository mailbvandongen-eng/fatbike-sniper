// Echte automodellen (Sketchfab, CC BY 4.0; zie tools/autos). Geparkeerde auto's zijn kopieën van hetzelfde model
// (InstancedMesh: één keer in het geheugen), rijdende auto's hebben draaiende wielen en een bestuurder.
import * as THREE from "three";
import { GLTFLoader } from "../lib/three-addons.js";
import { MeshoptDecoder } from "../lib/meshopt_decoder.mjs";
import { MAT, kies } from "./figuren.js";

const NAMEN = ["hatchback", "hatchback", "klein", "sedan", "sedan", "bus"];
// Zoals op het plein: vooral zwart, grijs, zilver en wit; af en toe een kleur.
const LAK = [
  ...Array(9).fill("#16171a"), ...Array(4).fill("#2c2e33"), ...Array(5).fill("#50545a"), ...Array(6).fill("#a9adb2"), ...Array(7).fill("#e6e7e9"),
  "#1f3b6e", "#2f5fa0", "#7d1a1a", "#a8201c", "#6f7d70", "#c9c3b3", "#2d4a3a",
];
const M = {};
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// getinte ruiten (achterin): bijna zwart
const GLAS_DONKER = new THREE.MeshStandardMaterial({ color: "#07090b", transparent: true, opacity: 0.93, roughness: 0.05, metalness: 0.6, depthWrite: false });
/** Laadt de gewone auto's, plus extra modellen die alleen op een vaste plek staan (per level). */
export async function laadAutos(extra = []) {
  const L = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder), v = window.VERSIE ?? "";
  GLAS_DONKER.envMap = MAT.env ?? null;
  await Promise.all([...new Set([...NAMEN, ...extra])].map(async (n) => {
    const [g, meta] = await Promise.all([L.loadAsync(`assets/autos/${n}.glb?v=${v}`), fetch(`assets/autos/${n}.json?v=${v}`).then((r) => r.json())]);
    g.scene.updateMatrixWorld(true);
    const lak = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.3, metalness: 0.4, envMap: MAT.env ?? null, side: THREE.DoubleSide, vertexColors: false });
    const glas = MAT.glas;
    const mats = new Map();
    const mat = (m) => {
      if (meta.lak.includes(m.name)) return lak;
      if (meta.glas.includes(m.name)) return glas;
      if (meta.glasDonker?.includes(m.name)) return GLAS_DONKER;
      if (!mats.has(m)) { m.metalness = Math.min(m.metalness, 0.5); if (m.transparent && !m.map) { m.transparent = false; } if (m.map) { m.alphaTest = 0.4; m.transparent = false; } mats.set(m, m); }
      return m;
    };
    // onderdelen: romp (per materiaal), wielen (per wiel per materiaal), en de lichte versie
    const romp = [], wielen = {}, ver = [];
    g.scene.traverse((o) => {
      if (!o.isMesh) return;
      let top = o; while (top.parent && top.parent !== g.scene && !/^(romp|ver|wiel_)/.test(top.name)) top = top.parent;
      const deel = { geo: o.geometry, mat: mat(o.material), m: o.matrixWorld.clone() };
      if (top.name.startsWith("wiel_")) {
        // de as uit de maten (blender x, y, z -> three x, z, -y); de knoop zelf is door het verkleinen verschoven en geschaald
        const [wx, wy, wz] = meta.wielen[top.name], pos = V(wx, wz, -wy);
        (wielen[top.name] ??= { delen: [], pos }).delen.push({ ...deel, m: new THREE.Matrix4().makeTranslation(-pos.x, -pos.y, -pos.z).multiply(o.matrixWorld) });
      } else if (top.name.startsWith("ver")) ver.push(deel);
      else romp.push(deel);
    });
    const [bx, ly, hz] = meta.maat;
    M[n] = { romp, wielen, ver, lak, meta, L: ly, B: bx, H: hz, stoel: meta.stoel ?? [0.36, 0.4, 0] };
  }));
}
export const autosGeladen = () => Object.keys(M).length > 0;
const raakVan = (a) => [{ deel: "auto", min: V(-a.B / 2, 0.15, -a.L / 2), max: V(a.B / 2, a.H, a.L / 2) }];

/** Een rijdende auto: eigen lakkleur, losse wielen. */
export function maakAuto(o = {}) {
  const naam = o.soort && M[o.soort] ? o.soort : kies(NAMEN), a = M[naam];
  const g = new THREE.Group();
  const lak = a.lak.clone(); lak.color.set(o.kleur ?? kies(LAK));
  const voeg = (ouder, d) => { const m = new THREE.Mesh(d.geo, d.mat === a.lak ? lak : d.mat); m.applyMatrix4(d.m); m.castShadow = d.mat === a.lak; m.receiveShadow = true; ouder.add(m); };
  for (const d of a.romp) voeg(g, d);
  const wielen = [];
  for (const w of Object.values(a.wielen)) { const wg = new THREE.Group(); wg.position.copy(w.pos); for (const d of w.delen) voeg(wg, d); g.add(wg); wielen.push(wg); }
  g.userData = { soort: naam, L: a.L, B: a.B, H: a.H, raak: raakVan(a), wielen, straal: a.meta.straal, stoel: a.stoel };
  return g;
}

/** Een geparkeerde auto: alleen een plek en een raakvlak; het tekenen gaat in één keer met zetGeparkeerd. */
export function parkeer(x, z, hoek, haaks, vast = null, kleur = null) {
  const naam = vast ?? (haaks ? kies(NAMEN) : kies(["hatchback", "klein", "sedan"])), a = M[naam];
  const p = new THREE.Object3D();
  p.position.set(x, 0, z); p.rotation.y = hoek;
  p.userData = { soort: naam, L: a.L, B: a.B, H: a.H, raak: raakVan(a), kleur: kleur ?? kies(LAK) };
  return p;
}

/** Voegt onderdelen met hetzelfde materiaal samen tot één geometrie (positie, normaal, uv). */
function voegSamen(delen) {
  const perMat = new Map();
  for (const d of delen) (perMat.get(d.mat) ?? perMat.set(d.mat, []).get(d.mat)).push(d);
  const uit = [];
  for (const [mat, lijst] of perMat) {
    // de modellen zijn met meshopt verkleind: de getallen zijn gehele waarden met een eigen schaal. Daarom lezen we
    // punt voor punt (getX geeft de echte waarde) en rekenen we zelf om, in plaats van de geometrie te verplaatsen.
    const gs = lijst.map((d) => ({ g: d.geo.index ? d.geo.toNonIndexed() : d.geo, m: d.m, nm: new THREE.Matrix3().getNormalMatrix(d.m) }));
    const n = gs.reduce((s, x) => s + x.g.attributes.position.count, 0);
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3).fill(1);
    const v = new THREE.Vector3();
    let o = 0;
    for (const { g, m, nm } of gs) {
      const k = g.attributes.position.count, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, K = g.attributes.color;
      for (let i = 0; i < k; i++) {
        v.fromBufferAttribute(P, i).applyMatrix4(m); pos[(o + i) * 3] = v.x; pos[(o + i) * 3 + 1] = v.y; pos[(o + i) * 3 + 2] = v.z;
        if (N) { v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor[(o + i) * 3] = v.x; nor[(o + i) * 3 + 1] = v.y; nor[(o + i) * 3 + 2] = v.z; }
        if (U) { uv[(o + i) * 2] = U.getX(i); uv[(o + i) * 2 + 1] = U.getY(i); }
        if (K) { col[(o + i) * 3] = K.getX(i); col[(o + i) * 3 + 1] = K.getY(i); col[(o + i) * 3 + 2] = K.getZ(i); }
      }
      o += k;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    uit.push({ geo, mat });
  }
  return uit;
}

/** Tekent alle geparkeerde auto's: per model en per materiaal één InstancedMesh; dichtbij het hele model, ver weg het lichte. */
export function zetGeparkeerd(plekken, scene, grensVer = 55) {
  for (const naam of Object.keys(M)) {
    const a = M[naam];
    const alle = plekken.filter((p) => p.userData.soort === naam);
    const wielDelen = Object.values(a.wielen).flatMap((w) => w.delen.map((d) => ({ ...d, m: new THREE.Matrix4().makeTranslation(w.pos.x, w.pos.y, w.pos.z).multiply(d.m) })));
    for (const [lijst, delen] of [[alle.filter((p) => Math.hypot(p.position.x, p.position.z) <= grensVer), [...a.romp, ...wielDelen]], [alle.filter((p) => Math.hypot(p.position.x, p.position.z) > grensVer), a.ver]]) {
      if (!lijst.length) continue;
      for (const { geo, mat } of voegSamen(delen)) {
        const im = new THREE.InstancedMesh(geo, mat, lijst.length);
        const k = new THREE.Color();
        lijst.forEach((p, i) => { p.updateMatrix(); im.setMatrixAt(i, p.matrix); if (mat === a.lak) im.setColorAt(i, k.set(p.userData.kleur)); });
        im.castShadow = mat === a.lak; im.receiveShadow = true;
        if (mat === MAT.glas || mat === GLAS_DONKER) im.renderOrder = 2;
        im.frustumCulled = false;
        scene.add(im);
      }
    }
  }
}
