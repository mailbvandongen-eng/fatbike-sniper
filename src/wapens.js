// De wapenkast bij je raam: echte modellen (Sketchfab, CC BY 4.0; zie tools/wapens) die je ook mee naar buiten neemt.
import * as THREE from "three";
import { GLTFLoader } from "../lib/three-addons.js";
import { MeshoptDecoder } from "../lib/meshopt_decoder.mjs";

/**
 * Wat er in de kast ligt. as = de kant waar de loop in het model naartoe wijst; lengte in meters; greep = waar je hand zit
 * (deel van de lengte, vanaf de achterkant); munitie per ronde; tussen = seconden tussen twee schoten.
 */
export const WAPENKAST = {
  geweer: { naam: "Geweer", as: "x", lengte: 1.2, greep: 0 }, // de oorsprong ligt bij de kolf
  mg: { naam: "Machinegeweer", as: "x", lengte: 1.2, greep: 0.3, munitie: 90, tussen: 0.085, spreiding: 0.012 },
  bazooka: { naam: "Bazooka", as: "x", lengte: 1.3, greep: 0.45, munitie: 5, tussen: 1.4, snelheid: 45, straal: 6.5 },
  // gooien (geen model in je hand): na de lont een ontploffing. alleen = in welke levels het in de kast ligt
  cobra: { naam: "Cobra's", gooi: true, munitie: 6, straal: 3.5, lont: 1.1, alleen: "karate" },
  granaat: { naam: "Handgranaten", gooi: true, munitie: 4, straal: 5.5, lont: 1.4, alleen: "gewoon" },
  vlam: { naam: "Vlammenwerper", as: "z", lengte: 1.1, greep: 0.28, munitie: 14, bereik: 11, hoek: 0.32 }, // munitie = seconden vuur
};
/** Wat je in je hand hebt op straat (ligt niet in de kast). op = hoe ver het model omhoog schuift zodat de greep in je hand ligt. */
export const HANDWAPENS = {
  pistool: { as: "x", lengte: 0.22, greep: 0.2, op: 0.05 },
  mes: { as: "x", lengte: 0.3, greep: 0.2, op: 0 },
  knuppel: { as: "-x", lengte: 0.84, greep: 0.1, op: 0 },
  staf: { as: "-x", lengte: 0.4, greep: 0.14, op: 0 }, // een houten toverstokje: dun, de punt naar voren
};
/**
 * Hoe je een lang wapen vasthoudt (legAan in main.js): waar de oorsprong van het wapen komt ten opzichte van je rechterschouder
 * (voor = in de kijkrichting, zij = naar links, op = omhoog) en waar je handen het pakken (in het wapen: x, y, z langs de loop).
 * De kolf ligt vóór de schouder en niet erdoorheen; de bazooka ligt óp de schouder.
 */
export const HOUVAST = {
  geweer: { voor: 0.12, zij: 0.05, op: 0.0, R: [0, -0.05, 0.33], L: [0, -0.02, 0.62] },
  mg: { voor: 0.5, zij: 0.05, op: -0.02, R: [0, -0.05, 0.0], L: [0, -0.03, 0.34] },
  vlam: { voor: 0.44, zij: 0.05, op: -0.06, R: [0, -0.05, 0.0], L: [0, -0.03, 0.36] },
  bazooka: { voor: 0.22, zij: -0.04, op: 0.1, R: [0, -0.11, 0.0], L: [0, -0.11, 0.24] },
};
const model = {};
let raket = null;
/**
 * Maakt een geladen model geschikt om te kopiëren en vast te houden: onderdelen die aan een skelet hangen worden gewone
 * vaste vormen (anders verdwijnen ze bij het kopiëren), en bijna-zwart wordt donkergrijs zodat je het wapen ziet.
 */
function maakVast(g) {
  g.updateMatrixWorld(true);
  const skin = []; g.traverse((o) => { if (o.isSkinnedMesh) skin.push(o); });
  const v = new THREE.Vector3();
  for (const o of skin) {
    const P = o.geometry.attributes.position, pos = new Float32Array(P.count * 3);
    for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i); o.applyBoneTransform(i, v); v.toArray(pos, i * 3); }
    let geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); if (o.geometry.index) geo.setIndex(o.geometry.index);
    geo = geo.toNonIndexed(); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, o.material); m.name = o.name;
    // na het skelet staan de punten in de ruimte van het hele model
    g.attach(m); m.matrix.identity(); m.position.set(0, 0, 0); m.quaternion.identity(); m.scale.set(1, 1, 1);
    m.applyMatrix4(new THREE.Matrix4().copy(g.matrixWorld).invert().multiply(o.matrixWorld));
    o.removeFromParent();
  }
  g.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; const mat = o.material;
    mat.metalness = Math.min(mat.metalness ?? 0, 0.35); mat.roughness = Math.max(mat.roughness ?? 1, 0.55);
    const c = mat.color; if (c && !mat.map && c.r + c.g + c.b < 0.18) c.lerp(new THREE.Color(0.075, 0.078, 0.085), 0.8);
  });
  g.updateMatrixWorld(true);
}
export async function laadWapens() {
  const L = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder), v = window.VERSIE ?? "";
  await Promise.all(Object.entries({ ...WAPENKAST, ...HANDWAPENS }).filter(([, w]) => w.as).map(async ([id, w]) => {
    const g = (await L.loadAsync(`assets/wapens/${id}.glb?v=${v}`)).scene;
    if (w.weg) { const weg = []; g.traverse((o) => { if (o.isMesh && w.weg.test(o.name)) weg.push(o); }); for (const o of weg) o.removeFromParent(); }
    maakVast(g);
    // de loop naar +z, op maat, en de greep op de oorsprong
    const draai = new THREE.Group(); draai.add(g); if (w.as === "x") draai.rotation.y = -Math.PI / 2; else if (w.as === "-x") draai.rotation.y = Math.PI / 2; else if (w.as === "y") draai.rotation.x = Math.PI / 2;
    draai.updateMatrixWorld(true);
    let b = new THREE.Box3().setFromObject(draai); const s = w.lengte / (b.max.z - b.min.z); draai.scale.setScalar(s); draai.updateMatrixWorld(true);
    b = new THREE.Box3().setFromObject(draai);
    draai.position.set(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2 + (w.op ?? 0.04), -(b.min.z + w.lengte * w.greep));
    const uit = new THREE.Group(); uit.add(draai); uit.userData.loop = w.lengte * (1 - w.greep);
    model[id] = uit;
  }));
  // de raket: de kop die voor uit de bazooka steekt, als los model
  if (model.bazooka) {
    const r = model.bazooka.clone(); r.updateMatrixWorld(true);
    const weg = []; r.traverse((o) => { if (o.isMesh && !/Cylinder\.?0?(27|13)_/.test(o.name)) weg.push(o); }); for (const o of weg) o.removeFromParent();
    const b = new THREE.Box3().setFromObject(r);
    if (!b.isEmpty()) { r.position.sub(b.getCenter(new THREE.Vector3())); raket = new THREE.Group(); raket.add(r); }
  }
}
/** De dingen die je gooit: op ware grootte, midden op de oorsprong. hoog = lengte in meters. */
const WERP = { granaat: 0.12, cobra: 0.2 };
const werp = {};
export async function laadWerp() {
  const L = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder), v = window.VERSIE ?? "";
  await Promise.all(Object.entries(WERP).map(async ([id, hoog]) => {
    const g = (await L.loadAsync(`assets/wapens/${id}.glb?v=${v}`)).scene;
    const weg = []; g.traverse((o) => { if (o.isMesh) { if (/Icosphere/.test(o.name)) weg.push(o); else o.castShadow = true; } }); for (const o of weg) o.removeFromParent(); // los bolletje dat niet bij het model hoort
    maakVast(g);
    let b = new THREE.Box3().setFromObject(g); const m = b.getSize(new THREE.Vector3()), s = hoog / Math.max(m.x, m.y, m.z);
    g.scale.multiplyScalar(s); g.updateMatrixWorld(true); b = new THREE.Box3().setFromObject(g); g.position.sub(b.getCenter(new THREE.Vector3()));
    const uit = new THREE.Group(); uit.add(g); werp[id] = uit;
  }));
}
/** Een raket (de kop van de bazooka), +z = vooruit; null als het model die niet los heeft. */
export function maakRaket() { return raket?.clone() ?? null; }
/** Een exemplaar van een granaat of cobra (of null als het model er niet is). */
export function maakWerp(id) { return werp[id]?.clone() ?? null; }
/** Een exemplaar van een wapen: +z = de loop, de oorsprong = je hand; userData.loop = afstand tot de monding. */
export function maakWapen(id) { const m = model[id].clone(); m.userData.loop = model[id].userData.loop; m.visible = false; return m; }
