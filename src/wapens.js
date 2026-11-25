// De wapenkast bij je raam: echte modellen (Sketchfab, CC BY 4.0; zie tools/wapens) die je ook mee naar buiten neemt.
import * as THREE from "three";
import { GLTFLoader } from "../lib/three-addons.js";
import { MeshoptDecoder } from "../lib/meshopt_decoder.mjs";

/**
 * Wat er in de kast ligt. as = de kant waar de loop in het model naartoe wijst; lengte in meters; greep = waar je hand zit
 * (deel van de lengte, vanaf de achterkant); munitie per ronde; tussen = seconden tussen twee schoten.
 */
export const WAPENKAST = {
  geweer: { naam: "Geweer" },
  mg: { naam: "Machinegeweer", as: "x", lengte: 1.2, greep: 0.3, munitie: 90, tussen: 0.085, spreiding: 0.012 },
  bazooka: { naam: "Bazooka", as: "x", lengte: 1.3, greep: 0.45, munitie: 5, tussen: 1.4, snelheid: 45, straal: 6.5 },
  vlam: { naam: "Vlammenwerper", as: "z", lengte: 1.1, greep: 0.28, munitie: 14, bereik: 11, hoek: 0.32 }, // munitie = seconden vuur
};
const model = {};
export async function laadWapens() {
  const L = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder), v = window.VERSIE ?? "";
  await Promise.all(Object.entries(WAPENKAST).filter(([, w]) => w.as).map(async ([id, w]) => {
    const g = (await L.loadAsync(`assets/wapens/${id}.glb?v=${v}`)).scene;
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.material.metalness = Math.min(o.material.metalness ?? 0, 0.35); o.material.roughness = Math.max(o.material.roughness ?? 1, 0.55); } });
    // de loop naar +z, op maat, en de greep op de oorsprong
    const draai = new THREE.Group(); draai.add(g); if (w.as === "x") draai.rotation.y = -Math.PI / 2;
    draai.updateMatrixWorld(true);
    let b = new THREE.Box3().setFromObject(draai); const s = w.lengte / (b.max.z - b.min.z); draai.scale.setScalar(s); draai.updateMatrixWorld(true);
    b = new THREE.Box3().setFromObject(draai);
    draai.position.set(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2 + 0.04, -(b.min.z + w.lengte * w.greep));
    const uit = new THREE.Group(); uit.add(draai); uit.userData.loop = w.lengte * (1 - w.greep);
    model[id] = uit;
  }));
}
/** Een exemplaar van een wapen: +z = de loop, de oorsprong = je hand; userData.loop = afstand tot de monding. */
export function maakWapen(id) { const m = model[id].clone(); m.userData.loop = model[id].userData.loop; m.visible = false; return m; }
