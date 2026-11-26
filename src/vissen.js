// Het vislevel (Landlustlaan): een visser op het hoogste balkon met twee karperhengels in de vijver.
// Je kijkt mee met een drone. Een pieper gaat af, hij slaat aan, en een grote vis trekt hem langzaam naar de reling.
// Jij helpt hem trekken (knop of spatiebalk) en hebt één noodknop: dan rent "de rooie" naar buiten en houdt hem vast.
// Het loopt altijd nat af: ze gaan samen over de reling de vijver in, en dan komt de ambulance. Hoe lang houd je het vol?
import * as THREE from "three";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const tussen = (a, b) => a + Math.random() * (b - a);
const zacht = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };

/** Laad een model en geef het een nette maat en richting: de langste kant langs +z, op de grond, midden op 0. */
async function laadModellen() {
  const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([import("../lib/three-addons.js"), import("../lib/meshopt_decoder.mjs")]);
  const L = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder), uit = {};
  await Promise.all(["hengel", "karper", "stoel", "blik", "krat", "molen", "ambulance"].map(async (n) => { uit[n] = await L.loadAsync(`assets/vis/${n}.glb?v=${window.VERSIE ?? ""}`); }));
  for (const g of Object.values(uit)) g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  return uit;
}
/** Alle punten van een model, in de wereld. */
function punten(obj) {
  obj.updateMatrixWorld(true); const p = [];
  obj.traverse((o) => { if (!o.isMesh) return; const a = o.geometry.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < a.count; i += 1) p.push(v.fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld).clone()); });
  return p;
}
/** Zet een model in een groep: gedraaid zodat zijn lengte langs +z ligt, geschaald naar `lengte`, onderkant op 0. */
function recht(scene, lengte, hoek = null) {
  const p = punten(scene), n = p.length; let mx = 0, mz = 0; for (const q of p) { mx += q.x / n; mz += q.z / n; }
  let xx = 0, zz = 0, xz = 0; for (const q of p) { xx += (q.x - mx) ** 2; zz += (q.z - mz) ** 2; xz += (q.x - mx) * (q.z - mz); }
  const h = hoek ?? Math.atan2(2 * xz, zz - xx) / 2; // de hoofdas in het grondvlak, gemeten vanaf +z
  const draai = new THREE.Group(); draai.add(scene); draai.rotation.y = -h;
  const g = new THREE.Group(); g.add(draai); g.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(g), m = b.getSize(new THREE.Vector3()), s = lengte / Math.max(m.x, m.z);
  draai.scale.setScalar(s); draai.position.set(-((b.min.x + b.max.x) / 2) * s, -b.min.y * s, -((b.min.z + b.max.z) / 2) * s);
  if (m.x > m.z) { const om = new THREE.Group(); om.add(g); om.rotation.y = Math.PI / 2; const w = new THREE.Group(); w.add(om); return w; }
  return g;
}

export async function maakVissen({ scene, camera, data, geluid, fx, maakMens, botsers, $, naarMenu }) {
  const M = await laadModellen();
  // ---------- de plek: het balkon (of dakterras) aan de vijverkant ----------
  const st = data.standplaatsen[0], u = V(st.normaal[0], 0, st.normaal[1]).normalize(), t = V(-u.z, 0, u.x);
  const gevel = V(st.pos[0], 0, st.pos[2]).addScaledVector(u, -0.9);
  // het dak: is het hoger dan de vloer van de bovenste verdieping, dan hangt het balkon aan de gevel; anders is het een dakterras
  const ray = new THREE.Raycaster(gevel.clone().addScaledVector(u, -3).setY(80), V(0, -1, 0), 0, 100);
  const dakY = ray.intersectObjects(botsers, false)[0]?.point.y ?? st.pos[1] + 2;
  const terras = dakY < st.pos[1] + 0.6, vloer = terras ? dakY : st.pos[1] - 1.45, DIEP = 3.4, BREED = 6.4;
  const rand = gevel.clone().addScaledVector(u, terras ? -0.25 : DIEP); // waar de reling staat
  const yaw = Math.atan2(u.x, u.z);
  /** r = meters achter de reling, b = opzij, h = boven de vloer. */
  const W = (r, b = 0, h = 0) => V(rand.x - u.x * r + t.x * b, vloer + h, rand.z - u.z * r + t.z * b);
  const decor = new THREE.Group(); scene.add(decor);
  const doos = (bx, by, bz, kleur, r, b, h, extra = {}) => { const m = new THREE.Mesh(new THREE.BoxGeometry(bx, by, bz), new THREE.MeshStandardMaterial({ color: kleur, roughness: 0.7, ...extra })); m.position.copy(W(r, b, h)); m.rotation.y = yaw; m.castShadow = m.receiveShadow = true; decor.add(m); return m; };
  if (!terras) doos(BREED, 0.2, DIEP, "#b9b6ae", DIEP / 2, 0, -0.1); // de balkonplaat (x = opzij, z = naar buiten)
  else doos(BREED, 0.06, DIEP + 0.6, "#8f8a80", DIEP / 2, 0, 0.03); // vlonder op het dak
  // de reling: staanders, glas en een leuning
  const staal = { color: "#3b4046", roughness: 0.4, metalness: 0.6 };
  doos(BREED, 0.05, 0.06, "#3b4046", 0, 0, 1.05, staal);
  for (let i = 0; i <= 6; i++) doos(0.05, 1.05, 0.05, "#3b4046", 0, -BREED / 2 + (i * BREED) / 6, 0.52, staal);
  doos(BREED, 0.85, 0.02, "#bfe0ea", 0, 0, 0.5, { transparent: true, opacity: 0.28, roughness: 0.05 });
  for (const k of [-1, 1]) { const z = doos(0.05, 1.05, DIEP, "#3b4046", DIEP / 2, (k * BREED) / 2, 0.52, { ...staal, transparent: true, opacity: 0.35 }); z.castShadow = false; }
  // de deur waar de rooie door naar buiten komt
  if (terras) {
    // de dakopbouw: een lichte gevel met een schuifpui, en een stalen pergola over het terras (zoals op de foto)
    doos(BREED + 1.6, 2.7, 0.3, "#e3ddcf", DIEP + 0.25, 0, 1.35); doos(BREED + 2, 0.14, 1.2, "#5a5f66", DIEP + 0.3, 0, 2.77, staal);
    doos(2.6, 2.1, 0.06, "#6f8fa3", DIEP + 0.08, -1.3, 1.07, { roughness: 0.08, metalness: 0.5 }); doos(0.05, 2.1, 0.08, "#d9dde0", DIEP + 0.06, -1.3, 1.07);
    for (const [r, b] of [[0.06, -BREED / 2], [0.06, BREED / 2], [0.06, 0]]) doos(0.07, 2.7, 0.07, "#3b4046", r, b, 1.35, staal);
    doos(BREED + 0.1, 0.08, 0.08, "#3b4046", 0.06, 0, 2.7, staal);
    for (let i = 0; i <= 8; i++) doos(0.05, 0.07, DIEP + 0.2, "#3b4046", DIEP / 2 + 0.05, -BREED / 2 + (i * BREED) / 8, 2.7, staal);
  }
  doos(0.95, 2.1, 0.06, "#4a5560", DIEP + (terras ? 0.06 : -0.04), 1.6, 1.05, { roughness: 0.3 });

  // ---------- het water: waar de lijnen in liggen, met waterplanten ----------
  const waters = data.vlakken.filter((v) => v.s === "b_water").map((v) => v.r);
  const inWater = (x, z) => waters.some((r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const a = r[i], b = r[j]; if ((a[1] > z) !== (b[1] > z) && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; });
  let oever = 14; for (let a = 1; a < 80; a += 0.5) { const q = rand.clone().addScaledVector(u, a); if (inWater(q.x, q.z)) { oever = a; break; } }
  const plons = rand.clone().addScaledVector(u, oever + 6).setY(0); // hier zwemt de vis (en landt de rest)
  if (!inWater(plons.x, plons.z)) plons.copy(rand).addScaledVector(u, oever + 2).setY(0);
  // helder water: een glad vlak over de vijver (de grond eronder heeft het steenpatroon van de straat)
  const waterMat = new THREE.MeshStandardMaterial({ color: "#3f8791", roughness: 0.08, metalness: 0.25 });
  for (const r of waters) { if (!r.some((q) => Math.hypot(q[0] - plons.x, q[1] - plons.z) < 160)) continue; const sh = new THREE.Shape(); r.forEach((q, i) => sh[i ? "lineTo" : "moveTo"](q[0], -q[1])); const m = new THREE.Mesh(new THREE.ShapeGeometry(sh).rotateX(-Math.PI / 2), waterMat); m.position.y = 0.045; m.receiveShadow = true; decor.add(m); }
  const plantMat = new THREE.MeshStandardMaterial({ color: "#3f7a36", roughness: 0.6, side: THREE.DoubleSide }), wierMat = new THREE.MeshStandardMaterial({ color: "#1f4a2c", roughness: 0.9, transparent: true, opacity: 0.55 });
  const bloem = new THREE.MeshStandardMaterial({ color: "#f4f0e6", roughness: 0.5 });
  for (let i = 0, n = 0; i < 900 && n < 110; i++) {
    const x = plons.x + tussen(-32, 32), z = plons.z + tussen(-32, 32); if (!inWater(x, z) || Math.hypot(x - plons.x, z - plons.z) < 3) continue; n++;
    if (n % 3) { // een veld waterplanten onder water
      const w = new THREE.Mesh(new THREE.CircleGeometry(tussen(0.8, 2.2), 9).rotateX(-Math.PI / 2), wierMat); w.position.set(x, 0.055, z); w.scale.z = tussen(0.5, 1); w.rotation.y = Math.random() * 3; decor.add(w);
    } else { // een groepje plompenbladeren, soms met een bloem
      for (let k = 0; k < 5; k++) { const r = tussen(0.16, 0.34), b = new THREE.Mesh(new THREE.CircleGeometry(r, 10, 0.5, 5.6).rotateX(-Math.PI / 2), plantMat); b.position.set(x + tussen(-0.9, 0.9), 0.075, z + tussen(-0.9, 0.9)); b.rotation.y = Math.random() * 6; decor.add(b); }
      if (n % 2) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), bloem); f.scale.y = 0.6; f.position.set(x, 0.12, z); decor.add(f); }
    }
  }
  // riet langs de oever aan de kant van het gebouw
  const rietMat = new THREE.MeshStandardMaterial({ color: "#7d8f45", roughness: 0.9 });
  for (let i = 0; i < 26; i++) {
    const q = rand.clone().addScaledVector(u, oever + tussen(0, 0.9)).addScaledVector(t, tussen(-18, 18)); if (!inWater(q.x + u.x, q.z + u.z) || Math.abs((q.x - rand.x) * t.x + (q.z - rand.z) * t.z) < 3.5) continue; // een bosje riet (niet waar de lijnen lopen)
    for (let k = 0; k < 9; k++) { const h = tussen(0.8, 1.6), r = new THREE.Mesh(new THREE.ConeGeometry(0.014, h, 4), rietMat); r.position.set(q.x + tussen(-0.35, 0.35), h / 2, q.z + tussen(-0.35, 0.35)); r.rotation.set(tussen(-0.1, 0.1), 0, tussen(-0.1, 0.1)); decor.add(r); }
  }

  // ---------- de spullen: stoel, blikjes, rodpod met piepers, twee hengels ----------
  const stoel = recht(M.stoel.scene, 0.9); { const b = new THREE.Box3().setFromObject(stoel), s = 0.92 / (b.max.y - b.min.y); stoel.scale.setScalar(s); }
  const STOEL = { r: 2.5, b: -1.7, zit: 0.44 };
  stoel.position.copy(W(STOEL.r, STOEL.b)); stoel.rotation.y = yaw + Math.PI / 2; decor.add(stoel);
  const blikVorm = recht(M.blik.scene, 0.066); { const b = new THREE.Box3().setFromObject(blikVorm); blikVorm.scale.setScalar(0.125 / (b.max.y - b.min.y)); }
  // groen bier: het blikje krijgt een groene wikkel (de bovenkant blijft blank)
  { const groen = new THREE.MeshStandardMaterial({ color: "#16803a", roughness: 0.3, metalness: 0.55 }), blank = new THREE.MeshStandardMaterial({ color: "#c9ccce", roughness: 0.25, metalness: 0.9 });
    blikVorm.updateMatrixWorld(true); const hoog = new THREE.Box3().setFromObject(blikVorm);
    blikVorm.traverse((o) => { if (!o.isMesh) return; const b = new THREE.Box3().setFromObject(o); o.material = (b.max.y - b.min.y) < (hoog.max.y - hoog.min.y) * 0.3 ? blank : groen; o.castShadow = false; }); }
  const blik = () => { const g = new THREE.Group(); g.add(blikVorm.clone()); return g; };
  const leegBlik = (r, b, plat = Math.random() < 0.55) => { const k = blik(); k.position.copy(W(r, b, 0.04)); if (plat) { k.rotation.z = Math.PI / 2; k.position.y += 0.035; } k.rotation.y = Math.random() * 6; decor.add(k); };
  for (let i = 0; i < 26; i++) leegBlik(STOEL.r + tussen(-0.9, 0.9), STOEL.b + tussen(-1.3, 0.9)); // rond zijn stoel
  for (let i = 0; i < 22; i++) leegBlik(tussen(0.25, DIEP - 0.3), tussen(-BREED / 2 + 0.2, BREED / 2 - 0.2)); // en over het hele terras
  for (let laag = 0; laag < 4; laag++) for (let i = 0; i < 4 - laag; i++) { const k = blik(); k.position.copy(W(DIEP - 0.35, 2.55 + (i - (3 - laag) / 2) * 0.075, 0.04 + laag * 0.125)); decor.add(k); } // een torentje van volle
  // kratten (groen), gestapeld tegen de gevel en één naast de stoel als tafeltje
  const kratVorm = recht(M.krat.scene, 0.4); { const mat = new THREE.MeshStandardMaterial({ color: "#1b7a37", roughness: 0.55 }); kratVorm.traverse((o) => { if (o.isMesh) o.material = mat; }); }
  const kratH = new THREE.Box3().setFromObject(kratVorm).max.y;
  const krat = (r, b, n, draai = 0) => { for (let i = 0; i < n; i++) { const k = new THREE.Group(); k.add(kratVorm.clone()); k.position.copy(W(r, b, i * kratH)); k.rotation.y = yaw + draai + tussen(-0.08, 0.08); decor.add(k); } };
  krat(DIEP - 0.3, -2.9, 4); krat(DIEP - 0.3, -2.45, 3, Math.PI / 2); krat(DIEP - 0.32, -1.98, 2); krat(DIEP - 0.9, -2.85, 2, 0.4); krat(STOEL.r + 0.1, STOEL.b + 0.75, 1, 0.2); krat(0.5, 2.7, 3); krat(0.5, 2.25, 1, 0.5);
  for (let i = 0; i < 3; i++) { const k = blik(); k.position.copy(W(STOEL.r + 0.1 + tussen(-0.1, 0.1), STOEL.b + 0.75 + tussen(-0.1, 0.1), kratH + 0.005)); decor.add(k); }
  const handBlik = blik(); scene.add(handBlik);
  // rodpod (zelf gebouwd: hiervan was geen bruikbaar model te vinden): twee dwarsbalken op poten, voor hoger dan achter
  const POD = { voor: 1.15, achter: 2.55, hVoor: 0.86, hAchter: 0.5, b: 0.36 };
  const buis = (a, b, dik = 0.012, kleur = "#15171a") => { const d = b.clone().sub(a), m = new THREE.Mesh(new THREE.CylinderGeometry(dik, dik, d.length(), 6), new THREE.MeshStandardMaterial({ color: kleur, roughness: 0.35, metalness: 0.7 })); m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); m.castShadow = true; decor.add(m); return m; };
  buis(W(POD.voor, -0.55, POD.hVoor), W(POD.voor, 0.55, POD.hVoor)); buis(W(POD.achter, -0.55, POD.hAchter), W(POD.achter, 0.55, POD.hAchter));
  buis(W(POD.voor, 0, POD.hVoor - 0.04), W(POD.achter, 0, POD.hAchter - 0.04), 0.014);
  for (const [r, h, uit] of [[POD.voor, POD.hVoor, -0.35], [POD.achter, POD.hAchter, 0.3]]) for (const k of [-1, 1]) buis(W(r, k * 0.45, h), W(r + uit, k * 0.62, 0), 0.01);
  const piepers = [-1, 1].map((k) => {
    const g = new THREE.Group(); g.position.copy(W(POD.voor, k * POD.b, POD.hVoor + 0.02)); g.rotation.y = yaw;
    const kast = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.09, 0.035), new THREE.MeshStandardMaterial({ color: "#1c1f22", roughness: 0.5 })); kast.position.y = 0.05; g.add(kast);
    for (const s of [-1, 1]) { const oor = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.05, 0.03), kast.material); oor.position.set(s * 0.024, 0.115, 0); oor.rotation.z = -s * 0.25; g.add(oor); }
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), new THREE.MeshStandardMaterial({ color: "#3a0d0d", emissive: k < 0 ? "#ff2a2a" : "#2a6bff", emissiveIntensity: 0 })); led.position.set(0, 0.07, -0.02); g.add(led);
    const steel = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 5), kast.material); steel.position.y = -0.02; g.add(steel);
    decor.add(g); return { g, led, k };
  });
  // de hengels: het model rechtgelegd (handvat op 0, top langs +z), met de molen onder de hengel; buigen kan per punt
  const HENGEL = 3.6;
  const molenVorm = recht(M.molen.scene, 0.15); { const b = new THREE.Box3().setFromObject(molenVorm), w = new THREE.Group(); molenVorm.position.y = -(b.max.y - b.min.y); } // hangt onder de hengel
  const maakHengel = () => {
    const bron = M.hengel.scene.clone(true); let mesh = null; bron.updateMatrixWorld(true); bron.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
    // (de punten in het bestand zijn ingepakt als hele getallen: eerst uitpakken naar gewone meters)
    const bronP = mesh.geometry.attributes.position, n = bronP.count, v = new THREE.Vector3(), uitgepakt = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { v.fromBufferAttribute(bronP, i).applyMatrix4(mesh.matrixWorld); uitgepakt.set([v.x, v.y, v.z], i * 3); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(uitgepakt, 3)); geo.setIndex(mesh.geometry.index);
    if (mesh.geometry.attributes.uv) geo.setAttribute("uv", mesh.geometry.attributes.uv);
    const p = geo.attributes.position;
    // de twee verste punten zijn handvat en top; het handvat is het eind bij de molen (daar zitten de meeste punten)
    let a = v.fromBufferAttribute(p, 0).clone(), b = a.clone(), c = new THREE.Vector3();
    for (let keer = 0; keer < 3; keer++) { let d = -1; const van = keer % 2 ? b : a, naar = keer % 2 ? a : b; for (let i = 0; i < n; i++) { v.fromBufferAttribute(p, i); const dd = v.distanceToSquared(van); if (dd > d) { d = dd; naar.copy(v); } } }
    // het handvat is het dikke eind, de top het dunne: vergelijk hoe ver de punten bij elk eind van de as af liggen
    { const as0 = b.clone().sub(a), L0 = as0.length(); as0.normalize(); let ver = -1, da = 0, na = 0, db = 0, nb = 0;
      for (let i = 0; i < n; i++) { v.fromBufferAttribute(p, i).sub(a); const langs = v.dot(as0), d = v.clone().addScaledVector(as0, -langs).length(); if (langs < L0 * 0.04) { da += d; na++; } else if (langs > L0 * 0.96) { db += d; nb++; } if (d > ver) { ver = d; c.copy(v).add(a); } } // c = wat het verst uitsteekt (molen en ogen): die kant moet naar onderen
      if (db / Math.max(1, nb) > da / Math.max(1, na)) [a, b] = [b, a]; }
    const as = b.clone().sub(a), len = as.length(); as.normalize();
    const zij = c.clone().sub(a); zij.addScaledVector(as, -zij.dot(as)).normalize();
    const basis = new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(zij.clone().negate(), as), zij.clone().negate(), as).invert();
    geo.applyMatrix4(new THREE.Matrix4().makeTranslation(-a.x, -a.y, -a.z)).applyMatrix4(basis).scale((HENGEL / len) * 0.5, (HENGEL / len) * 0.5, HENGEL / len); // een karperhengel is lang en dun
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mesh.material); m.castShadow = true; m.frustumCulled = false;
    const g = new THREE.Group(); g.add(m); scene.add(g);
    // een echte molen onder het handvat (die van het hengelmodel is na het versmallen te klein om te zien)
    { const mo = new THREE.Group(); mo.add(molenVorm.clone()); mo.position.set(0, -0.012, 0.52); g.add(mo); }
    const y0 = Float32Array.from(geo.attributes.position.array);
    const h = { g, bocht: 0, top: new THREE.Vector3(),
      /** Buig de hengel (0 = recht): de top zakt, het meest aan het eind. */
      buig(k) { if (Math.abs(k - h.bocht) < 0.004) return; h.bocht = k; const q = geo.attributes.position; for (let i = 0; i < q.count; i++) { const s = Math.max(0, y0[i * 3 + 2] / HENGEL); q.array[i * 3 + 1] = y0[i * 3 + 1] - k * HENGEL * s ** 2.4; } q.needsUpdate = true; },
      /** Leg hem neer: handvat op p, wijzend naar richting d. Geeft de top (in de wereld) terug. */
      leg(p, d) { g.position.copy(p); g.quaternion.setFromUnitVectors(V(0, 0, 1), d.clone().normalize()); const zij2 = V(0, 1, 0).applyQuaternion(g.quaternion); if (zij2.y < 0) g.rotateZ(Math.PI); g.updateMatrixWorld(true); return h.top.set(0, -h.bocht * HENGEL, HENGEL * (1 - h.bocht * h.bocht * 0.6)).applyMatrix4(g.matrixWorld); } };
    return h;
  };
  const hengels = [maakHengel(), maakHengel()];
  const helling = Math.atan2(POD.hVoor - POD.hAchter, POD.achter - POD.voor), podRichting = u.clone().multiplyScalar(Math.cos(helling)).setY(Math.sin(helling));
  const podPlek = (k) => W(POD.achter + 0.75 * Math.cos(helling), k * POD.b, POD.hAchter + 0.06 - 0.75 * Math.sin(helling));
  // de lijnen: van de top naar het water
  const lijnMat = new THREE.LineBasicMaterial({ color: "#e9f2f5", transparent: true, opacity: 0.75 });
  const lijnen = [0, 1].map(() => { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0, 0, 0), V(0, 0, 0), V(0, 0, 0)]), lijnMat); l.frustumCulled = false; scene.add(l); return l; });
  const inworp = [-1, 1].map((k) => plons.clone().addScaledVector(t, k * 2.2).setY(0.05));
  const zetLijn = (i, top, eind, slap = 0) => { const p = lijnen[i].geometry.attributes.position, mid = top.clone().lerp(eind, 0.5); mid.y -= slap; p.setXYZ(0, top.x, top.y, top.z); p.setXYZ(1, mid.x, mid.y, mid.z); p.setXYZ(2, eind.x, eind.y, eind.z); p.needsUpdate = true; };

  // ---------- de karper ----------
  const karper = recht(M.karper.scene, 1.15); scene.add(karper);
  const visMixer = new THREE.AnimationMixer(M.karper.scene); if (M.karper.animations[0]) visMixer.clipAction(M.karper.animations[0]).play();
  const vis = { p: plons.clone(), h: 0 };

  // ---------- de mensen ----------
  const mens = (rol) => { const m = maakMens(rol), g = new THREE.Group(); g.add(m.object); m.object.visible = true; m.object.position.set(0, 0, 0); m.object.rotation.set(0, 0, 0); scene.add(g); return { m, g, r: 0, b: 0 }; };
  const man = mens("visser"), rooie = mens("rooie");
  man.m.detail(true, true); rooie.m.detail(true, true);
  { const sc = man.m.object.scale; sc.set(sc.x * 1.22, sc.y, sc.z * 1.3); } // een flinke bierbuik
  // hij hikt om de paar tellen: een schokje door zijn lijf en een hikje
  const hik = { over: 2, schok: 0 };
  const hikken = (dt) => { hik.over -= dt; hik.schok = Math.max(0, hik.schok - dt * 5); if (hik.over <= 0) { hik.over = tussen(2.2, 4.5); hik.schok = 1; geluid.toon?.({ freq: 430, freq2: 980, duur: 0.07, type: "sine", gain: 0.07 }); geluid.toon?.({ freq: 300, freq2: 240, duur: 0.06, type: "sine", gain: 0.04, start: 0.09 }); } };

  // ---------- de ambulance ----------
  const ambu = recht(M.ambulance.scene, 6.4); ambu.visible = false; scene.add(ambu);
  { // de voorkant is de lage kant (de cabine): die moet naar +z wijzen
    const p = punten(ambu); let voor = 0, achter = 0; for (const q of p) { if (q.z > 2) voor = Math.max(voor, q.y); if (q.z < -2) achter = Math.max(achter, q.y); }
    if (voor > achter) ambu.children[0].rotation.y += Math.PI;
  }
  const zwaai = [-1, 1].map((k) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.25), new THREE.MeshStandardMaterial({ color: "#12306e", emissive: "#2b6cff", emissiveIntensity: 0 })); l.position.set(k * 0.6, new THREE.Box3().setFromObject(ambu).max.y + 0.06, 1.3); ambu.add(l); return l; });
  // de route: de straat die het dichtst bij het gebouw ligt, de laatste 70 meter
  const route = (() => {
    let best = null;
    for (const l of data.lijnen) { if (l.s !== "weg") continue; const s = []; for (let i = 0; i < l.p.length - 1; i++) { const [a, b] = [l.p[i], l.p[i + 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let d = 0; d < L; d += 1) s.push([a[0] + ((b[0] - a[0]) * d) / L, a[1] + ((b[1] - a[1]) * d) / L]); }
      s.forEach((q, i) => { const d = Math.hypot(q[0] - plons.x, q[1] - plons.z); if (!best || d < best.d) best = { d, s, i }; }); }
    if (!best) return [[plons.x + 40, plons.z], [plons.x + 10, plons.z]];
    const { s, i } = best; return i >= s.length - i ? s.slice(Math.max(0, i - 75), i + 1) : s.slice(i, i + 76).reverse();
  })();

  // ---------- het verloop ----------
  const S = { fase: "uit", t: 0, r: 0, tikken: 0, nood: false, noodT: 0, duur: 0, beet: 0, shot: "", shotT: 0, piepT: 0 };
  const el = { vis: $("#vis"), balk: $("#visBalk i"), trek: $("#visTrek"), nood: $("#visNood"), einde: $("#visEinde"), tijd: $("#visTijd") };
  const R0 = 1.75, RAND = 0.42; // waar hij staat als hij aanslaat, en waar hij tegen de reling staat
  function zetFase(f) { S.fase = f; S.t = 0; el.vis.dataset.fase = f; }
  function reset(metIntro) {
    Object.assign(S, { r: R0, tikken: 0, nood: false, hielp: false, noodT: 0, duur: 0, beet: Math.random() < 0.5 ? 0 : 1, wacht: tussen(4, 8), piepT: 0 });
    man.r = STOEL.r; man.b = STOEL.b; rooie.g.visible = false; ambu.visible = false; man.g.visible = true;
    hengels.forEach((h) => h.buig(0)); vis.p.copy(plons); karper.visible = true;
    for (const p of piepers) p.led.material.emissiveIntensity = 0;
    el.einde.hidden = true; el.vis.hidden = false; el.nood.disabled = false; el.nood.classList.remove("op");
    zetFase(metIntro ? "intro" : "wacht"); shot(metIntro ? "wijd" : "balkon");
  }
  function shot(naam) { S.shot = naam; S.shotT = 0; }
  function trek() { if (S.fase !== "dril") return; S.r = Math.min(R0 + 0.35, S.r + 0.1); S.tikken++; el.trek.classList.remove("tik"); void el.trek.offsetWidth; el.trek.classList.add("tik"); }
  function nood() {
    if (S.fase !== "dril" || S.nood) return; S.nood = true; S.noodT = 0; el.nood.disabled = true; el.nood.classList.add("op");
    rooie.g.visible = true; rooie.r = DIEP - 0.3; rooie.b = 1.6; shot("balkon");
  }
  el.trek.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); trek(); });
  el.nood.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); nood(); });
  $("#visJa").addEventListener("click", () => reset(false));
  $("#visMenu").addEventListener("click", () => { el.vis.hidden = true; zetFase("uit"); naarMenu(); });
  addEventListener("keydown", (e) => { if (S.fase === "uit") return; if (e.code === "Space") { e.preventDefault(); trek(); } else if (e.code === "KeyN" || e.code === "Enter") nood(); });

  const piep = () => { for (let i = 0; i < 5; i++) geluid.toon?.({ freq: 2350, duur: 0.07, type: "sine", gain: 0.035, start: i * 0.11 }); };
  const spetter = (p, n = 30, kracht = 1) => { for (let i = 0; i < n; i++) fx.deeltje(p.clone().add(V(tussen(-0.5, 0.5), 0.1, tussen(-0.5, 0.5))), { leven: tussen(0.5, 1.1), kleur: i % 3 ? "#eaf6fb" : "#bfe3ee", r0: 0.12, r1: 0.5 * kracht, v: V(tussen(-3, 3) * kracht, tussen(3, 8) * kracht, tussen(-3, 3) * kracht), a: 0.9 }); };
  const plonsGeluid = (v = 1) => { geluid.ruisStoot?.({ duur: 0.9, filter: "lowpass", freq: 1800, freq2: 300, gain: 0.9 * v }); geluid.ruisStoot?.({ duur: 0.4, filter: "bandpass", freq: 3500, q: 0.8, gain: 0.5 * v, start: 0.05 }); };
  const sirene = (sec) => { for (let i = 0; i < sec / 0.55; i++) geluid.toon?.({ freq: i % 2 ? 560 : 420, duur: 0.52, type: "triangle", gain: 0.05, start: i * 0.55 }); };

  /** Zet een mens neer: r meter achter de reling, kijkend naar het water, achterover geleund. */
  function zet(p, { h = 0, leun = 0, draai = 0, zwalk = 0 } = {}) { const s = p === man ? hik.schok : 0; p.g.position.copy(W(p.r, p.b, h + s * 0.05)); p.g.rotation.set(-leun - s * 0.14, yaw + draai, zwalk, "YXZ"); p.g.updateMatrixWorld(true); }
  const val = { van: new THREE.Vector3(), t: 0 };
  let klok = 0;

  function stap(dt) {
    if (S.fase === "uit") return false;
    S.t += dt; S.shotT += dt; klok += dt; if (["intro", "wacht", "beet", "dril"].includes(S.fase)) hikken(dt); visMixer.update(dt * (S.fase === "dril" ? 2.5 : 1));
    const beetK = S.beet ? 1 : -1, andere = 1 - S.beet;
    // de hengel die niet meedoet ligt gewoon op de rodpod
    const rust = (i) => { const k = i ? 1 : -1, top = hengels[i].leg(podPlek(k), podRichting); hengels[i].buig(0.02); zetLijn(i, top, inworp[i], 1.2); };
    const zitten = () => { man.r = STOEL.r; man.b = STOEL.b; man.m.zet("zitten"); man.m.mixer.update(dt); man.m.object.position.y = STOEL.zit - man.m.zithoogte(); zet(man, { zwalk: Math.sin(klok * 0.9) * 0.1 + Math.sin(klok * 0.37) * 0.05, leun: 0.1 + Math.sin(klok * 0.6) * 0.05 }); };
    const drinkt = () => { // het blikje in zijn hand, af en toe naar zijn mond
      const slok = Math.max(0, Math.sin(klok * 0.9)) ** 6, borst = man.m.plek("DEF-spine003"), doel = borst.clone().addScaledVector(u, 0.3 - slok * 0.1).add(V(0, -0.12 + slok * 0.36, 0)).addScaledVector(t, 0.16);
      man.m.arm("R", doel, V(0, -1, 0).addScaledVector(t, 0.6)); handBlik.visible = true; handBlik.position.copy(doel).add(V(0, -0.02, 0)); handBlik.rotation.set(slok * 1.1, yaw, 0, "YXZ");
    };
    if (S.fase === "intro" || S.fase === "wacht") {
      zitten(); drinkt(); rust(0); rust(1);
      vis.h += dt * 0.5; vis.p.set(plons.x + Math.cos(vis.h) * 3.2, -0.25, plons.z + Math.sin(vis.h) * 3.2); karper.position.copy(vis.p); karper.rotation.set(0, -vis.h + Math.PI, 0);
      if (S.fase === "intro") { if (S.shot === "wijd" && S.t > 4.2) shot("water"); if (S.t > 8) { zetFase("wacht"); shot("balkon"); } }
      else if (S.t > S.wacht) { zetFase("beet"); piep(); S.piepT = 0.6; shot("pieper"); }
    } else if (S.fase === "beet") {
      // de pieper gilt, hij komt overeind en wankelt naar de hengel
      S.piepT -= dt; if (S.piepT <= 0) { piep(); S.piepT = 0.6; }
      piepers[S.beet].led.material.emissiveIntensity = Math.sin(klok * 30) > 0 ? 3 : 0;
      rust(andere); const k = zacht((S.t - 0.6) / 1.6);
      { const top = hengels[S.beet].leg(podPlek(beetK), podRichting); hengels[S.beet].buig(0.03 + Math.sin(klok * 22) * 0.02); zetLijn(S.beet, top, vis.p.clone().setY(0), 0.1); }
      vis.p.addScaledVector(u, dt * 0.8); karper.position.copy(vis.p);
      if (S.t < 0.6) { zitten(); drinkt(); }
      else { handBlik.visible = false; man.m.object.position.y = 0; man.r = THREE.MathUtils.lerp(STOEL.r, R0 + 0.9, k); man.b = THREE.MathUtils.lerp(STOEL.b, beetK * POD.b * 0.6, k); man.b += Math.sin(klok * 4.2) * 0.14 * Math.sin(k * Math.PI); man.m.zet(k < 1 ? "lopen" : "staan", 0.8); man.m.mixer.update(dt); zet(man, { zwalk: Math.sin(klok * 4.2) * 0.24, leun: Math.sin(klok * 2.1) * 0.1, draai: (1 - k) * 0.8 + Math.sin(klok * 2.1) * 0.25 }); } // hij waggelt naar zijn hengel
      if (S.t > 1.4 && S.shot !== "balkon") shot("balkon");
      if (S.t > 2.4) { zetFase("dril"); S.r = R0; geluid.zwiep?.(1); }
    } else if (S.fase === "dril") {
      S.duur += dt; rust(andere);
      piepers[S.beet].led.material.emissiveIntensity = 3;
      // de vis trekt steeds harder; met de rooie erbij even de helft, maar samen houden ze het ook niet
      if (S.nood) S.noodT += dt;
      const greep = S.nood && S.noodT > 1.1, kracht = (0.16 + S.duur * 0.016) * (greep ? 0.55 : 1) * (1 + Math.sin(klok * 2.3) * 0.5);
      S.r -= kracht * dt;
      if (greep && !S.hielp) { S.hielp = true; S.r = Math.min(R0 + 0.2, S.r + 0.55); }
      man.r = THREE.MathUtils.lerp(man.r, S.r, Math.min(1, dt * 8)); man.b = THREE.MathUtils.lerp(man.b, beetK * POD.b * 0.6 + Math.sin(klok * 1.3) * 0.25, Math.min(1, dt * 3));
      const span = 1 - zacht((S.r - RAND) / (R0 - RAND)), leun = 0.25 + Math.sin(klok * 2.3) * 0.1 - span * 0.1;
      man.m.zet("vechtklaar", 0.6); man.m.mixer.update(dt); man.m.object.position.y = 0; zet(man, { leun, zwalk: Math.sin(klok * 2.2) * 0.17 + Math.sin(klok * 5.3) * 0.05, draai: Math.sin(klok * 1.4) * 0.12 });
      // de vis schiet heen en weer en maakt kolken
      vis.h += dt * (1.6 + span); vis.p.set(plons.x + Math.sin(vis.h) * 4 + u.x * 2, -0.15 + Math.max(0, Math.sin(vis.h * 2.7)) * 0.2, plons.z + Math.cos(vis.h * 0.7) * 3 + u.z * 2);
      karper.position.copy(vis.p); karper.rotation.set(Math.sin(klok * 9) * 0.3, Math.atan2(Math.cos(vis.h) * 4, -Math.sin(vis.h * 0.7) * 2.1), Math.sin(klok * 11) * 0.4);
      if (Math.random() < dt * 5) spetter(vis.p.clone().setY(0.05), 5, 0.5);
      if (Math.random() < dt * 0.5) plonsGeluid(0.25);
      // hij houdt de hengel voor zijn buik, steil omhoog, krom naar het water
      const buik = man.m.plek("DEF-spine001").clone().addScaledVector(u, 0.22), naarVis = vis.p.clone().sub(buik).setY(0).normalize();
      const d = naarVis.multiplyScalar(Math.cos(1.05)).setY(Math.sin(1.05 + Math.sin(klok * 2.3) * 0.1));
      hengels[S.beet].buig(0.3 + span * 0.12 + Math.sin(klok * 2.3) * 0.05);
      const top = hengels[S.beet].leg(buik, d); zetLijn(S.beet, top, vis.p.clone().setY(0));
      man.m.arm("R", buik.clone().addScaledVector(d, 0.5), V(0, -1, 0).addScaledVector(t, 0.5)); man.m.arm("L", buik.clone().addScaledVector(d, 0.12), V(0, -1, 0).addScaledVector(t, -0.5));
      // de rooie: komt de deur uit gerend en slaat zijn armen om hem heen
      if (S.nood) {
        if (!greep) { const k = zacht(S.noodT / 1.1); rooie.r = THREE.MathUtils.lerp(DIEP - 0.3, man.r + 0.42, k); rooie.b = THREE.MathUtils.lerp(1.6, man.b, k); rooie.m.zet("rennen"); rooie.m.mixer.update(dt); zet(rooie, { draai: (1 - k) * -0.6 }); }
        else { rooie.r = man.r + 0.42; rooie.b = man.b; rooie.m.zet("vechtklaar", 0.5); rooie.m.mixer.update(dt); zet(rooie, { leun: leun + 0.12, zwalk: Math.sin(klok * 3.1) * 0.1 });
          const borst = man.m.plek("DEF-spine002"); rooie.m.arm("R", borst.clone().addScaledVector(u, 0.2).addScaledVector(t, 0.1), V(0, -0.2, 0).addScaledVector(t, 1)); rooie.m.arm("L", borst.clone().addScaledVector(u, 0.2).addScaledVector(t, -0.1), V(0, -0.2, 0).addScaledVector(t, -1)); }
      }
      // de drone wisselt van beeld
      if (S.shotT > (S.shot === "dronie" ? 6.5 : 4.5)) shot({ balkon: "dronie", dronie: "water", water: "boven", boven: "balkon" }[S.shot] ?? "balkon");
      el.balk.style.width = `${Math.max(0, Math.min(1, (S.r - RAND) / (R0 - RAND))) * 100}%`;
      if (S.r <= RAND) { zetFase("val"); val.van.copy(man.g.position); geluid.schreeuw?.(0.8); if (S.nood) setTimeout(() => geluid.schreeuw?.(0.6), 300); shot("opzij"); }
    } else if (S.fase === "val") {
      // over de reling, in een boog achter de vis aan het water in
      rust(andere); const T = 2.3, k = Math.min(1, S.t / T), eind = plons.clone().addScaledVector(u, 1.5);
      const p = val.van.clone().lerp(eind, k); p.y = THREE.MathUtils.lerp(val.van.y, -0.6, k * k) + Math.sin(Math.min(1, k * 3) * Math.PI) * 1.3 * (k < 0.34 ? 1 : 0);
      man.g.position.copy(p); man.g.rotation.set(-0.3 + k * 5.5, yaw, Math.sin(k * 9) * 0.4, "YXZ"); man.m.zet("vliegen", 1.4); man.m.mixer.update(dt);
      if (greepNu()) { rooie.g.position.copy(p).addScaledVector(u, -0.6).add(V(0, 0.25 + Math.sin(k * 7) * 0.3, 0)); rooie.g.rotation.set(0.9 + Math.sin(k * 8) * 0.5, yaw, Math.cos(k * 9) * 0.5, "YXZ"); rooie.m.zet("vliegen", 1.6); rooie.m.mixer.update(dt); const voet = man.m.plek("DEF-footL"); rooie.m.arm("R", voet, V(0, -1, 0)); rooie.m.arm("L", voet, V(0, -1, 0)); }
      else if (S.nood) { rooie.m.zet("schrik"); rooie.m.mixer.update(dt); }
      vis.p.lerp(eind.clone().addScaledVector(u, 6).setY(-0.2), dt * 1.5); karper.position.copy(vis.p);
      const buik = man.m.plek("DEF-spine001"), top = hengels[S.beet].leg(buik, vis.p.clone().sub(buik).normalize()); hengels[S.beet].buig(0.12); zetLijn(S.beet, top, vis.p.clone().setY(0));
      if (k >= 1) { zetFase("water"); spetter(eind.clone().setY(0.1), 90, 1.6); plonsGeluid(1.3); if (greepNu()) setTimeout(() => { spetter(eind.clone().addScaledVector(t, 1).setY(0.1), 60, 1.3); plonsGeluid(1); }, 180); val.van.copy(eind); }
    } else if (S.fase === "water") {
      // proestend boven water (het is niet diep); de karper springt er nog één keer overheen
      rust(andere); const op = zacht((S.t - 0.7) / 0.8), dob = Math.sin(klok * 2.4) * 0.05;
      man.g.position.copy(val.van).setY(-2.2 + op * 1.0 + dob); man.g.rotation.set(0, yaw + Math.PI + Math.sin(klok) * 0.4, 0, "YXZ"); man.m.zet("boos", 1.6); man.m.mixer.update(dt);
      if (greepNu()) { rooie.g.position.copy(val.van).addScaledVector(t, 1.3).setY(-2.3 + op * 1.0 - dob); rooie.g.rotation.set(0, yaw + Math.PI - 0.5, 0, "YXZ"); rooie.m.zet("praten", 1.8); rooie.m.mixer.update(dt); }
      hengels[S.beet].g.position.copy(val.van).add(V(1, 0.02, 1)); hengels[S.beet].g.rotation.set(0, klok * 0.2, Math.PI / 2); zetLijn(S.beet, val.van, val.van);
      const sp = Math.min(1, Math.max(0, (S.t - 1.6) / 1.1)); karper.position.copy(val.van).addScaledVector(t, -2 + sp * 4).setY(-0.3 + Math.sin(sp * Math.PI) * 1.7); karper.rotation.set(0, Math.atan2(t.x, t.z) - Math.PI / 2, (0.5 - sp) * 1.6);
      if (S.t > 1.6 && S.t - dt <= 1.6) { spetter(karper.position.clone().setY(0.05), 25, 0.9); plonsGeluid(0.5); }
      if (S.t > 2.7 && S.t - dt <= 2.7) { spetter(karper.position.clone().setY(0.05), 35, 1); plonsGeluid(0.6); }
      if (Math.random() < dt * 6) spetter(man.g.position.clone().setY(0.05), 3, 0.35);
      if (S.t > 4.2) { zetFase("ambulance"); shot("ambulance"); ambu.visible = true; sirene(6); }
    } else if (S.fase === "ambulance") {
      rust(andere); const k = zacht(S.t / 6), i = Math.min(route.length - 2, k * (route.length - 1)), a = route[Math.floor(i)], b = route[Math.floor(i) + 1], f = i % 1;
      ambu.position.set(a[0] + (b[0] - a[0]) * f, 0, a[1] + (b[1] - a[1]) * f); ambu.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]);
      zwaai.forEach((l, n) => { l.material.emissiveIntensity = Math.sin(klok * 14 + n * Math.PI) > 0 ? 4 : 0; });
      man.g.position.y = -1.2 + Math.sin(klok * 2.4) * 0.05; man.m.mixer.update(dt); if (greepNu()) rooie.m.mixer.update(dt);
      if (S.t > 7.5) {
        zetFase("einde"); const sec = Math.round(S.duur), best = Math.max(sec, +(localStorage.getItem("fbs-vis") ?? 0)); localStorage.setItem("fbs-vis", best);
        el.tijd.textContent = `${sec} seconden volgehouden · record ${best}`; el.einde.hidden = false;
      }
    } else if (S.fase === "einde") {
      zwaai.forEach((l, n) => { l.material.emissiveIntensity = Math.sin(klok * 14 + n * Math.PI) > 0 ? 4 : 0; });
      man.m.mixer.update(dt); if (greepNu()) rooie.m.mixer.update(dt);
    }
    if (S.fase !== "intro" && S.fase !== "wacht" && !(S.fase === "beet" && S.t < 0.6)) handBlik.visible = false;
    filmen(dt);
    return true;
  }
  const greepNu = () => S.nood && S.noodT > 1.1;

  // ---------- de drone ----------
  const camP = new THREE.Vector3(), camD = new THREE.Vector3(); let camF = 45, eerste = true;
  function filmen(dt) {
    const mp = man.g.position, midden = rand.clone().lerp(plons, 0.5), s = S.shotT; let p, d, f = 45, hard = S.shotT < dt * 1.5;
    if (S.shot === "wijd") { const h = yaw + 0.9 + s * 0.12; p = midden.clone().add(V(Math.sin(h) * 46, 30 - s * 1.5, Math.cos(h) * 46)); d = midden.clone().setY(5); f = 48; }
    else if (S.shot === "water") { const h = yaw + 2.2 + s * 0.1; p = vis.p.clone().setY(0).add(V(Math.sin(h) * 7, Math.max(1.6, 3.4 - s * 0.35), Math.cos(h) * 7)); d = vis.p.clone().setY(0); f = 30 - Math.min(8, s * 1.4); }
    else if (S.shot === "pieper") { p = W(-1.8, 1.9, 1.5); d = W(POD.voor, 0, POD.hVoor); f = 26; }
    else if (S.shot === "balkon") { p = W(-6.5 - Math.sin(s * 0.4) * 0.6, 2.6 + Math.sin(s * 0.3), 1.9 + Math.sin(s * 0.7) * 0.25); d = W(1.4, 0, 1.15); f = 40; }
    else if (S.shot === "dronie") { const k = zacht(s / 6); p = mp.clone().addScaledVector(u, 2.6 + k * 34).addScaledVector(t, k * 9).add(V(0, 1.5 + k * 15, 0)); d = mp.clone().add(V(0, 1.3, 0)).lerp(midden.clone().setY(4), k * 0.5); f = 44; }
    else if (S.shot === "boven") { p = midden.clone().add(V(Math.sin(s * 0.15) * 4, vloer + 26, Math.cos(s * 0.15) * 4)); d = midden.clone().setY(0).addScaledVector(u, 0.1); f = 50; }
    else if (S.shot === "opzij") { p = midden.clone().addScaledVector(t, 26).setY(vloer * 0.55 + 2); d = (S.fase === "water" ? plons.clone().setY(0.6) : mp.clone().lerp(midden.clone().setY(vloer * 0.5), 0.35)); f = S.fase === "water" ? 26 : 46; }
    else { const v = V(Math.sin(ambu.rotation.y), 0, Math.cos(ambu.rotation.y)); p = ambu.position.clone().addScaledVector(v, 15 - s * 0.6).add(V(v.z * 6, 5.5, -v.x * 6)); d = ambu.position.clone().setY(1.4); f = 40; }
    if (hard || eerste) { camP.copy(p); camD.copy(d); camF = f; eerste = false; } else { const k = Math.min(1, dt * 4); camP.lerp(p, k); camD.lerp(d, k); camF += (f - camF) * k; }
    camera.position.copy(camP); camera.lookAt(camD);
    if (Math.abs(camera.fov - camF) > 0.01) { camera.fov = camF; camera.updateProjectionMatrix(); }
  }
  return { stap, begin: () => reset(true), get fase() { return S.fase; }, S, trek, nood, man, rooie, hengels, karper, ambu, plons, rand, vloer, terras, W };
}
