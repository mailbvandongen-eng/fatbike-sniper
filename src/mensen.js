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
  // duwen (winkelwagen) = gewoon lopen; de handen gaan met armsturing naar de duwstang
  lopen: "Walk_Loop", rennen: "Jog_Fwd_Loop", sprinten: "Sprint_Loop", duwen: "Walk_Loop", dragen: "Walk_Loop",
  zitten: "Sitting_Idle_Loop", zittenPraten: "Sitting_Talking_Loop", fietsen: "Driving_Loop", achterop: "Sitting_Idle_Loop",
  schrik: "Hit_Chest", vliegen: "Jump_Loop", klap: "Hit_Knockback", liggen: "Death01", opstaan: "LayToIdle", boos: "Idle_No_Loop",
  hurken: "Crouch_Idle_Loop", richten: "Pistol_Aim_Neutral",
};
const EENMALIG = new Set(["Hit_Chest", "Death01", "LayToIdle", "Hit_Knockback"]);

let modellen = {}, clips = {}, zithoogte = {};
const KLEIN = matchMedia("(pointer: coarse)").matches;
const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), v4 = new THREE.Vector3(), v5 = new THREE.Vector3(),
  v6 = new THREE.Vector3(), v7 = new THREE.Vector3(), v8 = new THREE.Vector3(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion();
/** Draai een bot (in de wereld) zo dat richting van -> naar wijst. */
function draaiBot(bot, van, naar) {
  const delta = q1.setFromUnitVectors(van.normalize(), naar.normalize());
  bot.getWorldQuaternion(q2).premultiply(delta);
  const ouder = bot.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
  bot.quaternion.copy(ouder.multiply(q2));
}
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
      // op de telefoon de textuur verkleinen (1024 -> 512): scheelt 4x geheugen, op afstand zie je het verschil niet
      if (KLEIN && m.map?.image && !m.map.userData.klein) {
        const c = document.createElement("canvas"); c.width = c.height = 512;
        c.getContext("2d").drawImage(m.map.image, 0, 0, 512, 512);
        m.map.image = c; m.map.userData.klein = true; m.map.needsUpdate = true;
      }
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
  const bot = {};
  object.traverse((o) => { if (o.isBone) { bot[o.name] = o; if (/DEF-hips/.test(o.name)) heup = o; } });
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
    /** Waar een bot nu in de wereld staat (na mixer.update en updateMatrixWorld). */
    plek: (n, uit = new THREE.Vector3()) => bot[n].getWorldPosition(uit),
    /**
     * Armsturing (twee botten): zet de hand (kant "L" of "R") op het punt doel (wereld).
     * buig = richting (wereld) waarheen de elleboog wijst. Roep aan na mixer.update().
     */
    arm(kant, doel, buig) {
      const A = bot[`DEF-upper_arm${kant}`], B = bot[`DEF-forearm${kant}`], C = bot[`DEF-hand${kant}`]; // three haalt de punt uit de naam
      if (!A || !B || !C) return;
      A.updateWorldMatrix(true, true);
      const a = A.getWorldPosition(v1), b = B.getWorldPosition(v2), c = C.getWorldPosition(v3);
      const la = a.distanceTo(b), lb = b.distanceTo(c);
      const naar = v4.copy(doel).sub(a);
      const d = THREE.MathUtils.clamp(naar.length(), Math.abs(la - lb) + 1e-3, la + lb - 1e-3);
      const n = naar.normalize();
      // waar de elleboog moet komen: wet van de cosinus, in het vlak van de buigrichting
      const p = v5.copy(buig).addScaledVector(n, -buig.dot(n)).normalize();
      const hoek = Math.acos(THREE.MathUtils.clamp((la * la + d * d - lb * lb) / (2 * la * d), -1, 1));
      const elleboog = v6.copy(a).addScaledVector(n, la * Math.cos(hoek)).addScaledVector(p, la * Math.sin(hoek));
      draaiBot(A, v7.copy(b).sub(a), v8.copy(elleboog).sub(a));
      A.updateWorldMatrix(false, true);
      B.getWorldPosition(b); C.getWorldPosition(c);
      draaiBot(B, v7.copy(c).sub(b), v8.copy(doel).sub(b));
      B.updateWorldMatrix(false, true);
    },
  };
  m.detail(false, false);
  return m;
}
export const mensenGeladen = () => Object.keys(modellen).length > 0;
