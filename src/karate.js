// Karate: de bewegingen uit het vechtspel van Dojo Hokori Meiyo (motion capture van een Kyokushin-karateka, CC0, en van
// een vechtsporter van ACCAD, CC BY 3.0). De opnames bevatten per bot per beeld een "anatomisch frame": een draaiing
// waarvan de eerste as langs het bot wijst en de tweede naar de voorkant van het lichaam. Voor ons skelet rekenen we
// één keer uit hoe dat frame in rust staat (K); de draaiing van een bot is dan opname × K. Zo passen de bewegingen op
// elk mensmodel. We zetten ze bij het laden om naar gewone animaties, zodat ze net als lopen en vallen afgespeeld worden.
import * as THREE from "three";
import { maakMens, registreerClip } from "./mensen.js";

const BOTTEN = ["Hips", "Spine", "Spine1", "Spine2", "Neck", "Head",
  "LeftShoulder", "LeftArm", "LeftForeArm", "LeftHand", "LeftUpLeg", "LeftLeg", "LeftFoot",
  "RightShoulder", "RightArm", "RightForeArm", "RightHand", "RightUpLeg", "RightLeg", "RightFoot"];
// naam in de opname -> bot in ons skelet (three haalt de punten uit de namen)
const ONS = { Hips: "DEF-hips", Spine: "DEF-spine001", Spine1: "DEF-spine002", Spine2: "DEF-spine003", Neck: "DEF-neck", Head: "DEF-head" };
const KIND = { Hips: "Spine1", Spine: "Spine1", Spine1: "Spine2", Spine2: "Neck", Neck: "Head", Head: "op" };
for (const [lang, kort] of [["Left", "L"], ["Right", "R"]]) {
  Object.assign(ONS, { [`${lang}Shoulder`]: `DEF-shoulder${kort}`, [`${lang}Arm`]: `DEF-upper_arm${kort}`, [`${lang}ForeArm`]: `DEF-forearm${kort}`, [`${lang}Hand`]: `DEF-hand${kort}`,
    [`${lang}UpLeg`]: `DEF-thigh${kort}`, [`${lang}Leg`]: `DEF-shin${kort}`, [`${lang}Foot`]: `DEF-foot${kort}`, [`${lang}Vinger`]: `DEF-f_middle01${kort}`, [`${lang}Teen`]: `DEF-toe${kort}` });
  Object.assign(KIND, { [`${lang}Shoulder`]: `${lang}Arm`, [`${lang}Arm`]: `${lang}ForeArm`, [`${lang}ForeArm`]: `${lang}Hand`, [`${lang}Hand`]: `${lang}Vinger`, [`${lang}UpLeg`]: `${lang}Leg`, [`${lang}Leg`]: `${lang}Foot`, [`${lang}Foot`]: `${lang}Teen` });
}
const _m = new THREE.Matrix4();
function anatFrame(p, s) {
  const a = p.clone().normalize(), b = s.clone().sub(a.clone().multiplyScalar(s.dot(a))).normalize(), c = new THREE.Vector3().crossVectors(a, b);
  return new THREE.Quaternion().setFromRotationMatrix(_m.makeBasis(a, b, c));
}

/** De technieken: naam, soort (stoot of trap), wanneer hij raakt en hoe lang hij duurt (seconden), en of het een zware is. */
export const TECHNIEK = {};
// alle aanvallen uit het vechtspel: vijf met de armen (stoten en de elleboog), negen met de benen (trappen en de knie)
export const STOTEN = ["jab", "gyaku", "shita", "hiji", "jodan_tsuki"];
export const TRAPPEN = ["gedan", "mae", "chudan_mawashi", "hiza", "jodan_mawashi", "ushiro_geri", "kakato", "ushiro_mawashi", "rol"];
const ZWAAR = new Set(["jodan_tsuki", "hiji", "hiza", "jodan_mawashi", "ushiro_geri", "kakato", "ushiro_mawashi", "rol"]);

export async function laadKarate() {
  const j = await (await fetch(`assets/karate/clips.json?v=${window.VERSIE ?? ""}`)).json();
  // een model in rust: daaruit halen we K per bot, en daarop rekenen we elke opname om
  const m = maakMens("karateka"), ruimte = m.object;
  ruimte.position.set(0, 0, 0); ruimte.rotation.set(0, 0, 0); ruimte.updateMatrixWorld(true);
  const B = {}; ruimte.traverse((o) => { if (o.isBone) B[o.name] = o; });
  const bot = (n) => B[ONS[n]];
  const inv = new THREE.Matrix4().copy(ruimte.matrixWorld).invert();
  const pos = (n) => bot(n).getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
  const ruimteQ = ruimte.getWorldQuaternion(new THREE.Quaternion()), ruimteQi = ruimteQ.clone().invert();
  const rot = (n) => ruimteQi.clone().multiply(bot(n).getWorldQuaternion(new THREE.Quaternion()));
  const links = pos("LeftUpLeg").sub(pos("RightUpLeg")); links.y = 0; links.normalize();
  const op = new THREE.Vector3(0, 1, 0), voor = new THREE.Vector3().crossVectors(links, op);
  const K = {};
  for (const n of BOTTEN) {
    let p;
    if (n === "Hips") p = pos("Spine1").sub(pos("LeftUpLeg").add(pos("RightUpLeg")).multiplyScalar(0.5));
    else if (KIND[n] === "op") p = op.clone();
    else p = pos(KIND[n]).sub(pos(n));
    p.normalize();
    const tweede = n.endsWith("Foot") ? op : n === "Hips" ? voor : Math.abs(p.dot(voor)) < 0.8 ? voor : op;
    K[n] = anatFrame(p, tweede).invert().multiply(rot(n));
  }
  const heupH = pos("Hips").y, heup = bot("Hips"), heupOuder = heup.parent;
  heupOuder.updateWorldMatrix(true, false);
  const ouderNaarRuimte = new THREE.Matrix4().copy(inv).multiply(heupOuder.matrixWorld), ruimteNaarOuder = ouderNaarRuimte.clone().invert();
  const W = new THREE.Quaternion(), ouderQ = new THREE.Quaternion(), v = new THREE.Vector3();
  for (const [naam, c] of Object.entries(j.clips)) {
    const n = c.frames, tijden = new Float32Array(n), qs = BOTTEN.map(() => new Float32Array(n * 4)), hp = new Float32Array(n * 3);
    for (let f = 0; f < n; f++) {
      tijden[f] = f / c.fps;
      v.set(c.hips[f][0] * heupH, c.hips[f][1] * heupH, c.hips[f][2] * heupH).applyMatrix4(ruimteNaarOuder);
      heup.position.copy(v); v.toArray(hp, f * 3);
      // van de heup naar buiten: elk bot krijgt zijn draaiing ten opzichte van zijn echte ouder
      BOTTEN.forEach((bn, i) => {
        const b = bot(bn);
        W.fromArray(c.q[f], i * 4).multiply(K[bn]); // in de ruimte van het model
        b.parent.getWorldQuaternion(ouderQ);
        b.quaternion.copy(ouderQ.invert().multiply(ruimteQ).multiply(W));
        b.updateWorldMatrix(false, false);
        // dezelfde kant op als het vorige beeld (anders draait de overgang de lange weg om)
        if (f > 0) { const o = qs[i], k = (f - 1) * 4; if (o[k] * b.quaternion.x + o[k + 1] * b.quaternion.y + o[k + 2] * b.quaternion.z + o[k + 3] * b.quaternion.w < 0) b.quaternion.set(-b.quaternion.x, -b.quaternion.y, -b.quaternion.z, -b.quaternion.w); }
        b.quaternion.toArray(qs[i], f * 4);
      });
    }
    const sporen = BOTTEN.map((bn, i) => new THREE.QuaternionKeyframeTrack(`${ONS[bn]}.quaternion`, tijden, qs[i]));
    sporen.push(new THREE.VectorKeyframeTrack(`${ONS.Hips}.position`, tijden, hp));
    registreerClip(`k_${naam}`, new THREE.AnimationClip(`k_${naam}`, (n - 1) / c.fps, sporen), c.kind !== "loop");
    if (c.kind === "attack") TECHNIEK[naam] = { raak: c.ev.hits[0], duur: Math.min(c.ev.off, c.ev.hits[0] + 0.45), hoogte: c.hitY, zwaar: ZWAAR.has(naam), trap: !/Hand|Elbow/.test(c.eff) };
  }
}
