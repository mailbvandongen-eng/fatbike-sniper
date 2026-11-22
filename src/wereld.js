// Bouwt de 3D-wereld uit data/<locatie>.json: gebouwen (3D BAG), grond (OSM), bomen, heggen, straatmeubilair, geparkeerde auto's.
import * as THREE from "three";
import { maakAuto, maakFiets, kies, tussen, plak, stuk, blok, buis, bol, M, V } from "./figuren.js";

// ---------- gevels: per stijl een tegel van 1 verdieping hoog ----------
const GEVEL = {
  baksteen: { b: 3.0, h: 2.8, steen: ["#8a4b36", "#7d4331", "#94553d"], raam: [1.5, 1.45], kozijn: "#efeae0", voeg: "#b9a89a" },
  flat: { b: 3.2, h: 2.8, steen: ["#a49a8a", "#b8afa0"], raam: [2.2, 1.5], kozijn: "#dcdcdc", voeg: "#8d8478", balkon: "#c9c6bf" },
  beton: { b: 3.3, h: 2.8, steen: ["#c8c3b8", "#bfb9ad"], raam: [2.4, 1.55], kozijn: "#5b5f63", voeg: "#a19b90", balkon: "#e4e1da" },
  winkel: { b: 4.0, h: 4.2, steen: ["#6c6660", "#7a6f63"], raam: [3.4, 2.6], kozijn: "#2b2b2b", voeg: "#5a544e", winkel: true },
  huis: { b: 2.6, h: 2.7, steen: ["#9a5a40", "#8b4a35", "#a46a4e"], raam: [1.3, 1.4], kozijn: "#f5f3ee", voeg: "#c2b2a2" },
};
function gevelTextuur(st) {
  const P = 64, c = document.createElement("canvas");
  c.width = st.b * P; c.height = st.h * P;
  const x = c.getContext("2d");
  x.fillStyle = st.steen[0]; x.fillRect(0, 0, c.width, c.height);
  // stenen
  for (let y = 0; y < c.height; y += 5) for (let i = (y / 5) % 2 ? -8 : 0; i < c.width; i += 16) {
    x.fillStyle = st.steen[(Math.random() * st.steen.length) | 0];
    x.globalAlpha = 0.55; x.fillRect(i + 1, y + 1, 14, 3.5);
  }
  x.globalAlpha = 1;
  const [rb, rh] = st.raam, rx = ((st.b - rb) / 2) * P, ry = st.winkel ? 0.35 * P : ((st.h - rh) / 2 - 0.1) * P;
  if (st.balkon) { x.fillStyle = st.balkon; x.fillRect(0, c.height - 0.18 * P, c.width, 0.18 * P); }
  x.fillStyle = st.kozijn; x.fillRect(rx - 5, ry - 5, rb * P + 10, rh * P + 10);
  const lucht = x.createLinearGradient(0, ry, 0, ry + rh * P);
  lucht.addColorStop(0, "#9fb4c6"); lucht.addColorStop(0.5, "#40505f"); lucht.addColorStop(1, "#262d35");
  x.fillStyle = lucht; x.fillRect(rx, ry, rb * P, rh * P);
  x.fillStyle = st.kozijn;
  x.fillRect(rx + (rb * P) / 2 - 3, ry, 6, rh * P);
  if (!st.winkel) x.fillRect(rx, ry + rh * P * 0.3, rb * P, 5);
  // gordijn of lamp
  x.globalAlpha = 0.5; x.fillStyle = ["#d9cdb6", "#9a8f80", "#c46a50", "#e6e0d0"][(Math.random() * 4) | 0];
  x.fillRect(rx + 2, ry + 2, rb * P * 0.18, rh * P - 4);
  x.globalAlpha = 1;
  if (st.balkon) { x.fillStyle = "#00000030"; x.fillRect(0, c.height - 0.5 * P, c.width, 0.32 * P); x.fillStyle = st.balkon; x.fillRect(0, c.height - 0.55 * P, c.width, 0.06 * P); }
  if (st.winkel) { x.fillStyle = "#3d3d3d"; x.fillRect(0, (st.h - 0.9) * P - 2, c.width, 0.9 * P); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / st.b, -1 / st.h);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ---------- grond ----------
const GRONDKLEUR = {
  basis: "#a7a39b", plein: "#b5aea3", stoep: "#bdb5a8", weg: "#4b4c50", parkeer: "#56575c", fietspad: "#9c4a3e", gras: "#5f7f42", struik: "#3f5f2f",
  eiland: "#9d988e", speel: "#c4ad7f", fietsvlak: "#a9a196", tram: "#6d6a63", gebouw: "#3c3a37",
};
function tekenGrond(d, midden, maat, px) {
  const c = document.createElement("canvas");
  c.width = c.height = px;
  const x = c.getContext("2d");
  const s = px / maat, o = maat / 2;
  const P = ([a, b]) => [(a - midden[0] + o) * s, (b - midden[1] + o) * s];
  x.fillStyle = GRONDKLEUR.basis; x.fillRect(0, 0, px, px);
  // klinkers: fijne ruis
  const ruis = x.createImageData(px, px);
  for (let i = 0; i < ruis.data.length; i += 4) { const v = Math.random() * 30; ruis.data[i] = ruis.data[i + 1] = ruis.data[i + 2] = v; ruis.data[i + 3] = 40; }
  const vlak = (ring, kl) => { x.fillStyle = kl; x.beginPath(); ring.forEach((p, i) => x[i ? "lineTo" : "moveTo"](...P(p))); x.closePath(); x.fill(); };
  for (const v of d.vlakken) if (["gras", "speel", "plein"].includes(v.s)) vlak(v.r, GRONDKLEUR[v.s]);
  x.lineCap = x.lineJoin = "round";
  const lijn = (l, kl, b) => { x.strokeStyle = kl; x.lineWidth = b * s; x.beginPath(); l.p.forEach((p, i) => x[i ? "lineTo" : "moveTo"](...P(p))); x.stroke(); };
  for (const soort of ["stoep", "weg", "fietspad"]) for (const l of d.lijnen) if (l.s === soort) lijn(l, GRONDKLEUR[soort], l.b + (soort === "weg" ? 3.2 : 0));
  // stoepen langs wegen eerst breder, dan de weg erover
  for (const l of d.lijnen) if (l.s === "weg") lijn(l, GRONDKLEUR.weg, l.b);
  for (const v of d.vlakken) if (["parkeer", "eiland", "fietsvlak"].includes(v.s)) vlak(v.r, GRONDKLEUR[v.s]);
  for (const l of d.lijnen) if (l.gang) lijn(l, GRONDKLEUR.weg, l.b);
  for (const v of d.vlakken) if (v.s === "struik") vlak(v.r, GRONDKLEUR.struik);
  for (const l of d.lijnen) if (l.s === "fietspad") lijn(l, GRONDKLEUR.fietspad, l.b);
  // middenstrepen
  x.setLineDash([3 * s, 4 * s]);
  for (const l of d.lijnen) if (l.s === "weg" && l.b >= 6) lijn(l, "#d8d6cc", 0.12);
  x.setLineDash([]);
  for (const l of d.lijnen) if (l.s === "tram") { lijn(l, GRONDKLEUR.tram, 2.2); lijn(l, "#9b9890", 0.1); }
  // parkeervakken: witte lijnen links en rechts van elke haakse plek
  for (const v of d.vlakken) if (v.s === "vak" || v.s === "strook") vlak(v.r, GRONDKLEUR.parkeer);
  x.strokeStyle = "#e4e2da"; x.lineWidth = Math.max(1, 0.12 * s);
  x.beginPath();
  for (const [px, pz, h, haaks] of d.plekken) {
    if (!haaks) continue;
    const fx = Math.sin(h), fz = Math.cos(h), zx = fz, zz = -fx;
    for (const k of [-1.25, 1.25]) {
      x.moveTo(...P([px + zx * k - fx * 2.5, pz + zz * k - fz * 2.5]));
      x.lineTo(...P([px + zx * k + fx * 2.3, pz + zz * k + fz * 2.3]));
    }
  }
  x.stroke();
  for (const v of d.voetafdrukken) vlak(v.ring, GRONDKLEUR.gebouw);
  // ruis erover
  const r2 = document.createElement("canvas"); r2.width = r2.height = px; r2.getContext("2d").putImageData(ruis, 0, 0);
  x.globalCompositeOperation = "multiply"; x.globalAlpha = 0.25; x.drawImage(r2, 0, 0);
  x.globalCompositeOperation = "source-over"; x.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export function bouwWereld(d, scene) {
  const wereld = { botsers: [], statisch: [], gevels: [] };
  // gebouwen
  for (const [stijl, m] of Object.entries(d.muren)) {
    if (!m.pos.length) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(m.pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(m.uv, 2));
    g.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ map: gevelTextuur(GEVEL[stijl]), roughness: 0.85 });
    const mesh = new THREE.Mesh(g, mat);
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh); wereld.botsers.push(mesh);
  }
  for (const [soort, m] of Object.entries(d.daken)) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(m.pos, 3));
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: soort === "pannen" ? "#6e3a2c" : "#5d5c59", roughness: 0.95 }));
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh); wereld.botsers.push(mesh);
  }
  // grond: groot (680 m) en fijn (170 m rond de parkeerplaats)
  for (const [maat, px, y] of [[680, 2048, -0.02], [170, 2048, 0]]) {
    const t = tekenGrond(d, [0, 0], maat, px);
    const g = new THREE.PlaneGeometry(maat, maat);
    g.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, polygonOffset: y === 0, polygonOffsetFactor: -1 }));
    mesh.position.y = y;
    mesh.receiveShadow = true;
    scene.add(mesh);
    if (y === 0) wereld.grond = mesh;
  }
  // stoepranden: lage randen langs wegen in het speelgebied zijn te duur; we laten ze weg.

  // bomen (instanced): stam + twee kruinen
  const bomen = d.bomen.filter((b) => Math.hypot(b[0], b[1]) < 300);
  const stam = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.2, 1, 6).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: "#4e3d2e", roughness: 1 }), bomen.length);
  const kruinGeo = new THREE.IcosahedronGeometry(1, 1);
  const p = kruinGeo.attributes.position;
  for (let i = 0; i < p.count; i++) { const f = 0.88 + Math.random() * 0.2; p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * 0.9, p.getZ(i) * f); }
  kruinGeo.computeVertexNormals();
  const kruin = new THREE.InstancedMesh(kruinGeo, new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.95 }), bomen.length * 2);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), kl = new THREE.Color();
  bomen.forEach(([x, z, h], i) => {
    h = Math.max(5, Math.min(h, 14));
    stam.setMatrixAt(i, m4.compose(V(x, 0, z), q, V(0.8, h * 0.72, 0.8)));
    const r = h * 0.2;
    for (let k = 0; k < 2; k++) {
      q.setFromEuler(new THREE.Euler(0, Math.random() * 6, 0));
      kruin.setMatrixAt(i * 2 + k, m4.compose(V(x + tussen(-0.5, 0.5), h * (0.72 + k * 0.14), z + tussen(-0.5, 0.5)), q, V(r * (1 - k * 0.3), r * (0.9 - k * 0.2), r * (1 - k * 0.3))));
      kruin.setColorAt(i * 2 + k, kl.setHSL(0.2 + Math.random() * 0.07, 0.35 + Math.random() * 0.15, 0.22 + Math.random() * 0.1));
    }
  });
  q.identity();
  stam.castShadow = kruin.castShadow = true;
  scene.add(stam, kruin);
  wereld.bomen = bomen;

  // heggen en perken
  const hegBak = [];
  for (const h of d.heggen) {
    if (h.r && Math.hypot(...h.r[0]) < 200 && h.r.length > 2) {
      const vorm = new THREE.Shape(h.r.map(([x, z]) => new THREE.Vector2(x, -z)));
      const g = new THREE.ExtrudeGeometry(vorm, { depth: h.h, bevelEnabled: false });
      g.rotateX(-Math.PI / 2);
      stuk(hegBak, g, kies(["#3c5a2c", "#456631", "#36522a"]));
    } else if (h.l) for (let i = 0; i < h.l.length - 1; i++) {
      const [a, b] = [h.l[i], h.l[i + 1]];
      buis(hegBak, V(a[0], 0.6, a[1]), V(b[0], 0.6, b[1]), 0.45, "#3f5e2e", 0, 4);
    }
  }
  if (hegBak.length) {
    const heg = new THREE.Mesh(plak(hegBak), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
    heg.castShadow = heg.receiveShadow = true;
    scene.add(heg);
  }

  // straatmeubilair
  const meubel = [];
  wereld.rekken = [];
  for (const [soort, x, z, n] of d.dingen) {
    if (Math.hypot(x, z) > 180) continue;
    if (soort === "paal") buis(meubel, V(x, 0, z), V(x, 0.9, z), 0.06, "#3a3a3a", 0, 6);
    else if (soort === "bak") { buis(meubel, V(x, 0, z), V(x, 0.85, z), 0.22, "#2f4a3a", 0, 8); }
    else if (soort === "bank") { blok(meubel, 1.8, 0.08, 0.45, V(x, 0.45, z), "#7a5a3c"); blok(meubel, 1.8, 0.4, 0.06, V(x, 0.7, z - 0.22), "#7a5a3c"); blok(meubel, 1.6, 0.45, 0.35, V(x, 0.22, z), "#333"); }
    else if (soort === "container") blok(meubel, 1.3, 1.6, 1.3, V(x, 0.8, z), kies(["#5a6a52", "#7a7a7a", "#4a5a6a"]));
    else if (soort === "rek") wereld.rekken.push({ x, z, n: Math.min(n, 14) });
  }
  if (meubel.length) {
    const mm = new THREE.Mesh(plak(meubel), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }));
    mm.castShadow = true;
    scene.add(mm);
  }

  // geparkeerde auto's in de vakken
  wereld.geparkeerd = [];
  for (const [x, z, hoek, haaks] of d.plekken) {
    if (Math.hypot(x, z) > 170 || Math.random() < 0.28) continue;
    const auto = maakAuto({ soort: haaks ? undefined : kies(["hatch", "sedan", "hatch"]) });
    auto.position.set(x + tussen(-0.15, 0.15), 0, z + tussen(-0.15, 0.15));
    // haaks: meestal met de neus het vak in
    auto.rotation.y = hoek + (haaks ? (Math.random() < 0.75 ? 0 : Math.PI) : Math.random() < 0.5 ? Math.PI : 0) + tussen(-0.05, 0.05);
    scene.add(auto);
    wereld.geparkeerd.push(auto);
  }
  return wereld;
}

/** Fietsen in de rekken (stilstaand, wel raakbaar). */
export function zetFietsenInRekken(wereld, scene, voegToe) {
  for (const r of wereld.rekken) {
    const hoek = Math.random() * Math.PI;
    const dx = Math.cos(hoek), dz = Math.sin(hoek);
    for (let i = 0; i < r.n; i++) {
      if (Math.random() < 0.35) continue;
      const f = maakFiets(Math.random() < 0.25 ? "ebike" : "fiets");
      const s = (i - r.n / 2) * 0.6;
      f.position.set(r.x + dx * s, 0, r.z + dz * s);
      f.rotation.y = hoek + Math.PI / 2 + (i % 2 ? Math.PI : 0) + tussen(-0.1, 0.1);
      scene.add(f);
      voegToe(f);
    }
  }
}

/** Voegt stilstaande figuren samen tot één mesh per materiaal (veel minder draw calls).
 *  De losse objecten blijven bestaan buiten de scène, voor het raken. */
export function bevries(objecten, scene) {
  const perMat = new Map();
  for (const o of objecten) {
    o.updateMatrixWorld(true);
    o.traverse((m) => {
      if (!m.isMesh) return;
      const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
      if (!perMat.has(m.material)) perMat.set(m.material, []);
      perMat.get(m.material).push({ g, bot: 0 });
    });
    scene.remove(o);
  }
  for (const [mat, bak] of perMat) {
    const mesh = new THREE.Mesh(plak(bak), mat);
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
  }
}
