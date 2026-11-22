// Echte mensen: gemaakt met MakeHuman (CC0), bewegingen uit de Universal Animation Library van Quaternius (CC0).
// Zie tools/mensen/. Elke mens is één SkinnedMesh met één textuur, in een gedetailleerde en een lichte versie.
import * as THREE from "three";
import { GLTFLoader, SkeletonUtils } from "../lib/three-addons.js";
import { MeshoptDecoder } from "../lib/meshopt_decoder.mjs";

const ROLLEN = {
  voetganger: ["m_wit", "m_spijker", "m_jas", "m_streep", "m_pak", "m_groen", "v_spijker", "v_kort", "v_net", "v_lang"],
  fatbiker: ["f_zwart", "f_grijs", "f_sport"],
  schutter: ["schutter"],
};
// houding in het spel -> beweging uit de bibliotheek
const CLIP = {
  staan: "Idle_Loop", praten: "Idle_Talking_Loop", bellen: "Idle_TalkingPhone_Loop", armenOver: "Idle_FoldArms_Loop",
  lopen: "Walk_Loop", rennen: "Jog_Fwd_Loop", sprinten: "Sprint_Loop", duwen: "Push_Loop", dragen: "Walk_Carry_Loop",
  zitten: "Sitting_Idle_Loop", zittenPraten: "Sitting_Talking_Loop", fietsen: "Driving_Loop", achterop: "Sitting_Idle_Loop",
  schrik: "Hit_Chest", vliegen: "Jump_Loop", klap: "Hit_Knockback", liggen: "Death01", opstaan: "LayToIdle", boos: "Idle_No_Loop",
  hurken: "Crouch_Idle_Loop", richten: "Pistol_Aim_Neutral",
};
const EENMALIG = new Set(["Hit_Chest", "Death01", "LayToIdle", "Hit_Knockback"]);

let modellen = {}, clips = {}, zithoogte = {};
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

export async function laadMensen(voortgang) {
  const namen = Object.values(ROLLEN).flat();
  let klaar = 0;
  const bew = loader.loadAsync(`assets/mensen/bewegingen.glb?v=${window.VERSIE ?? ""}`).then((g) => {
    for (const c of g.animations) {
      // alleen draaiingen (en de heup op hoogte): de botten van elke mens staan op zijn eigen gewrichten
      c.tracks = c.tracks.filter((t) => t.name.endsWith(".quaternion") || /DEF-hips\.position$/.test(t.name));
      clips[c.name] = c;
    }
  });
  await Promise.all([bew, ...namen.map(async (n) => {
    const g = await loader.loadAsync(`assets/mensen/${n}.glb?v=${window.VERSIE ?? ""}`);
    g.scene.traverse((o) => {
      if (!o.isMesh) return;
      const m = o.material;
      // de exporter zet het materiaal op mengen; wij knippen uit en schrijven diepte, anders vechten de vlakjes
      Object.assign(m, { transparent: false, depthWrite: true, alphaTest: 0.5, side: THREE.FrontSide, metalness: 0, roughness: 0.85 });
      o.frustumCulled = false;
    });
    modellen[n] = g.scene;
    voortgang?.(++klaar / namen.length);
  })]);
  // hoe hoog zit de heup bij het fietsen (om de berijder op het zadel te zetten)
  for (const n of namen) {
    const m = maakMens(n);
    m.zet("fietsen"); m.mixer.update(0.01); m.object.updateMatrixWorld(true);
    zithoogte[n] = m.heup.getWorldPosition(new THREE.Vector3()).y;
  }
}

/** Een nieuwe mens. rol = voetganger | fatbiker | schutter, of een vaste naam. */
export function maakMens(rol = "voetganger") {
  const naam = modellen[rol] ? rol : ROLLEN[rol][(Math.random() * ROLLEN[rol].length) | 0];
  const object = SkeletonUtils.clone(modellen[naam]);
  let hoog = null, laag = null;
  object.traverse((o) => { if (o.isMesh) { if (o.name.includes("Laag")) laag = o; else hoog = o; } });
  const schaal = rol === "schutter" ? 1 : 0.94 + Math.random() * 0.12;
  object.scale.setScalar(schaal);
  const mixer = new THREE.AnimationMixer(object);
  let heup = null;
  object.traverse((o) => { if (o.isBone && /DEF-hips/.test(o.name)) heup = o; });
  const m = {
    naam, object, mixer, hoog, laag, heup, schaal, huidig: null, actie: null,
    /** Speel een houding; overgang van 0,25 s. snelheid = afspeelsnelheid. */
    zet(soort, snelheid = 1, vanaf = null) {
      const cn = CLIP[soort] ?? soort;
      if (this.huidig === cn && vanaf === null) { if (this.actie) this.actie.timeScale = snelheid; return; }
      const c = clips[cn];
      if (!c) return;
      const a = mixer.clipAction(c);
      a.reset(); a.timeScale = snelheid;
      if (EENMALIG.has(cn)) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
      if (vanaf === "eind") a.time = c.duration - 0.01;
      else if (vanaf !== null) a.time = vanaf;
      else if (!EENMALIG.has(cn)) a.time = Math.random() * c.duration;
      a.play();
      if (this.actie && this.actie !== a) this.actie.crossFadeTo(a, vanaf === "eind" ? 0.05 : 0.25, false);
      this.actie = a; this.huidig = cn;
    },
    /** Gedetailleerd dichtbij (of in de kijker), licht ver weg. */
    detail(fijn, schaduw) {
      if (hoog) { hoog.visible = fijn; hoog.castShadow = fijn && schaduw; }
      if (laag) { laag.visible = !fijn; laag.castShadow = false; }
    },
    zithoogte: () => zithoogte[naam] ?? 0.55,
  };
  m.detail(false, false);
  return m;
}
export const mensenGeladen = () => Object.keys(modellen).length > 0;
