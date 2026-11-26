// Kooigevecht: twee vechters in een achthoekige kooi, publiek eromheen, muziek erbij. K.O. wint.
// Een eigen pagina (kooi.html) die de mensen, de karatebewegingen en het geluid van het spel hergebruikt.
import * as THREE from "three";
import { laadMensen, laadModel, maakMens } from "./mensen.js";
import { GLTFLoader } from "../lib/three-addons.js";
import { MeshoptDecoder } from "../lib/meshopt_decoder.mjs";
import { laadKarate, TECHNIEK } from "./karate.js";
import { Geluid } from "./geluid.js";
import { Muziek } from "./muziek.js";

/**
 * De vechters. Een nieuwe vechter toevoegen = hier een regel erbij (en een model in tools/mensen/mensen.json).
 * stoot/trap = hoe hard hij raakt; trapTempo = hoe snel hij trapt; stamina = hoeveel adem; herstel = adem per seconde.
 */
export const VECHTERS = [
  { id: "bokser", naam: "Bonk", stijl: "Bokser", model: "schutter", stoot: 1.3, trap: 0.5, trapTempo: 0.8, snel: 1.25, leven: 110, stamina: 150, herstel: 14,
    stoten: ["jab", "jab", "gyaku", "shita", "jodan_tsuki"], trappen: ["gedan", "mae"], balken: [0.8, 0.3, 1, 0.6] },
  { id: "karateka", naam: "Blitz", stijl: "Kyokushin", model: "karateka", stoot: 0.95, trap: 1.2, trapTempo: 1.0, stamina: 105, herstel: 11,
    stoten: ["jab", "gyaku", "shita", "hiji", "jodan_tsuki"], trappen: ["gedan", "mae", "chudan_mawashi", "jodan_mawashi", "ushiro_mawashi"], balken: [0.6, 0.85, 0.65, 0.65] },
  // de dieren: een eigen lijf (assets/dieren/lijf_*.glb) met een dierenkop erop (kop_*.glb)
  { id: "beer", naam: "Grom", stijl: "Krachtpatser", model: "beer", dier: true, schaal: 1.12, kop: [0, 0.03, 0.03, 1.15], kopTint: "#c79a66", stoot: 1.62, trap: 1.1, trapTempo: 0.85, tempo: 0.8, snel: 0.8, leven: 135, stug: true, stamina: 76, herstel: 7.5,
    stoten: ["gyaku", "shita", "hiji", "jodan_tsuki"], trappen: ["gedan", "mae", "hiza"], balken: [1, 0.55, 0.4, 0.35] },
  { id: "wolf", naam: "Storm", stijl: "Snel en fel", model: "wolf", dier: true, schaal: 0.97, kop: [0, 0.0, 0.05, 1], staart: true, stoot: 0.78, trap: 0.85, trapTempo: 1.15, tempo: 1.25, snel: 1.35, leven: 82, stamina: 125, herstel: 15,
    stoten: ["jab", "jab", "gyaku", "jab", "shita"], trappen: ["gedan", "mae", "chudan_mawashi", "ushiro_geri"], balken: [0.45, 0.5, 0.85, 1] },
];
/** Afstellen van het gevecht. */
export const KOOI = {
  straal: 3.7, // zo ver kun je van het midden (de kooi zelf is 4,6 m)
  loopSnel: 1.6, achteruit: 1.25, // rustig voetenwerk: stappen, niet rennen
  draai: 1.1, // hoe snel de camera meedraait als de vechters om elkaar heen gaan (lager = rustiger beeld)
  bereikStoot: 1.25, bereikTrap: 1.6,
  kostStoot: 7, kostTrap: 10, // adem per aanval
  blok: 0.2, // zoveel schade komt er nog door een blok
  rondeTijd: 60, herstelRonde: 20, // seconden per ronde; leven dat je tussen de rondes terugkrijgt
  tempo: 1.3, // afspeelsnelheid van de technieken
  ai: { wacht: [0.45, 1.1], blokKans: 0.42 }, // hoe snel de tegenstander weer aanvalt, en hoe vaak hij blokt
};
const SCHADE = { jab: 4, gyaku: 7, shita: 8, hiji: 9, jodan_tsuki: 11, gedan: 8, mae: 9, hiza: 10, chudan_mawashi: 12, ushiro_geri: 13, jodan_mawashi: 17, ushiro_mawashi: 20 };

const $ = (s) => document.querySelector(s);
const tussen = (a, b) => a + Math.random() * (b - a), kies = (a) => a[(Math.random() * a.length) | 0];
const telefoon = matchMedia("(pointer: coarse)").matches;
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, telefoon ? 1.5 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = !telefoon;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color("#06070a"); scene.fog = new THREE.Fog("#06070a", 12, 26);
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 60);
const pasAan = () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); };
addEventListener("resize", pasAan); pasAan();
const geluid = new Geluid(); geluid.binnen = true;
let muziek = null;

// ---------- de kooi ----------
function bouwKooi() {
  const R = 4.6, N = 8;
  // de vloer: een grijze mat met een ring en een donkere rand
  const c = document.createElement("canvas"); c.width = c.height = 512; const x = c.getContext("2d");
  x.fillStyle = "#2b2e33"; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 4000; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? 255 : 0},${Math.random() < 0.5 ? 255 : 0},${Math.random() < 0.5 ? 255 : 0},0.03)`; x.fillRect(Math.random() * 512, Math.random() * 512, 2, 2); }
  x.strokeStyle = "#c92a20"; x.lineWidth = 10; x.beginPath(); x.arc(256, 256, 150, 0, 7); x.stroke();
  x.strokeStyle = "#e9e6de"; x.lineWidth = 4; x.beginPath(); x.arc(256, 256, 60, 0, 7); x.stroke();
  const mat = new THREE.CanvasTexture(c); mat.colorSpace = THREE.SRGBColorSpace;
  const vloer = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.4, N), [new THREE.MeshStandardMaterial({ color: "#15161a" }), new THREE.MeshStandardMaterial({ map: mat, roughness: 0.9 }), new THREE.MeshStandardMaterial({ color: "#15161a" })]);
  vloer.rotation.y = Math.PI / N; vloer.position.y = -0.2; vloer.receiveShadow = true; scene.add(vloer);
  // gaas: een ruitjespatroon, doorzichtig
  const g = document.createElement("canvas"); g.width = g.height = 64; const y = g.getContext("2d");
  y.strokeStyle = "#9aa0a8"; y.lineWidth = 3; for (const [a, b, c2, d] of [[0, 0, 64, 64], [64, 0, 0, 64], [-32, 32, 32, 96], [32, -32, 96, 32], [32, 96, 96, 32], [-32, 32, 32, -32]]) { y.beginPath(); y.moveTo(a, b); y.lineTo(c2, d); y.stroke(); }
  const gaas = new THREE.CanvasTexture(g); gaas.wrapS = gaas.wrapT = THREE.RepeatWrapping; gaas.colorSpace = THREE.SRGBColorSpace;
  const zijde = 2 * R * Math.sin(Math.PI / N), apo = R * Math.cos(Math.PI / N);
  const gm = new THREE.MeshBasicMaterial({ map: gaas, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide }); gaas.repeat.set(zijde / 0.16, 1.9 / 0.16);
  const zwart = new THREE.MeshStandardMaterial({ color: "#101114", roughness: 0.6 }), rood = new THREE.MeshStandardMaterial({ color: "#b3221a", roughness: 0.7 });
  for (let i = 0; i < N; i++) {
    const h = (i / N) * Math.PI * 2, px = Math.sin(h) * apo, pz = Math.cos(h) * apo;
    const paneel = new THREE.Mesh(new THREE.PlaneGeometry(zijde, 1.9), gm); paneel.position.set(px, 0.95, pz); paneel.rotation.y = h; scene.add(paneel);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(zijde, 0.14, 0.14), i % 2 ? rood : zwart); rail.position.set(px, 1.95, pz); rail.rotation.y = h; scene.add(rail);
    const hh = h + Math.PI / N, paal = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.05, 8), zwart); paal.position.set(Math.sin(hh) * R, 1.02, Math.cos(hh) * R); scene.add(paal);
  }
  // de zaal: een donkere vloer en een verhoging voor de achterste rij
  const zaal = new THREE.Mesh(new THREE.CircleGeometry(14, 32), new THREE.MeshStandardMaterial({ color: "#0e0f12", roughness: 1 })); zaal.rotation.x = -Math.PI / 2; zaal.position.y = -0.4; scene.add(zaal);
  const trede = new THREE.Mesh(new THREE.LatheGeometry([[7.4, -0.4], [7.4, 0.15], [10.5, 0.15], [10.5, -0.4]].map(([r, h]) => new THREE.Vector2(r, h)), 32), new THREE.MeshStandardMaterial({ color: "#131418", roughness: 1 })); scene.add(trede);
  // licht: fel van boven op de kooi, rood en blauw uit de hoeken
  scene.add(new THREE.HemisphereLight("#a9b8d6", "#3a2c22", 1.0));
  const spot = new THREE.DirectionalLight("#fff4e0", 2.4); spot.position.set(1.5, 9, 2); spot.castShadow = !telefoon; spot.shadow.mapSize.set(1024, 1024);
  Object.assign(spot.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 20 }); scene.add(spot);
  const vul = new THREE.DirectionalLight("#dfe6ff", 1.3); vul.position.set(-3, 5, -4); scene.add(vul); // van de andere kant, zodat niemand een zwart silhouet wordt
  const r = new THREE.PointLight("#ff3b2e", 40, 14); r.position.set(-5, 3.2, -4); const b = new THREE.PointLight("#3b7bff", 40, 14); b.position.set(5, 3.2, 4); scene.add(r, b);
}

// ---------- het publiek ----------
const publiek = [];
function bouwPubliek() {
  const namen = ["m_wit", "m_spijker", "m_jas", "m_streep", "m_groen", "v_spijker", "v_kort", "v_lang", "f_zwart", "f_grijs", "f_sport", "m_pak", "v_net"];
  const n = telefoon ? 22 : 40;
  for (let i = 0; i < n; i++) {
    const achter = i % 2, h = (i / n) * Math.PI * 2 + tussen(-0.05, 0.05), r = achter ? tussen(7.7, 8.6) : tussen(5.5, 6.6);
    const m = maakMens(namen[i % namen.length]); m.detail(false, false);
    m.object.position.set(Math.sin(h) * r, achter ? 0.15 : -0.4, Math.cos(h) * r); m.object.rotation.y = h + Math.PI;
    scene.add(m.object);
    publiek.push({ m, t: Math.random() * 3, juich: 0, y: m.object.position.y });
  }
}
/** Het publiek reageert: v = 0..1. Een deel springt op, en je hoort ze joelen. */
function joel(v) {
  geluid.juich(v);
  for (const p of publiek) if (Math.random() < 0.25 + v * 0.6) p.juich = 0.8 + Math.random() * (0.6 + v);
}
function stapPubliek(dt, beeld) {
  publiek.forEach((p, i) => {
    p.t -= dt;
    if (p.juich > 0) { p.juich -= dt; p.m.zet(i % 3 ? "vechtklaar" : "gooien", 1.4); p.m.object.position.y = p.y + Math.abs(Math.sin(p.juich * 9 + i)) * 0.16; if (p.juich <= 0) { p.m.object.position.y = p.y; p.t = 0; } }
    else if (p.t <= 0) { p.t = tussen(1.5, 5); p.m.huidig = null; p.m.zet(kies(["boos", "vechtklaar", "praten", "praten", "armenOver", "staan"]), 1, 0); }
    if ((i + beeld) % 2 === 0) p.m.mixer.update(dt * 2); // om en om: scheelt de helft van het rekenwerk
  });
}

// ---------- dieren: een kop (en staart) op het lijf ----------
const koppen = {};
async function laadDieren() {
  const L = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder), v = window.VERSIE ?? "";
  await Promise.all(VECHTERS.filter((d) => d.dier).map(async (d) => {
    const [, g] = await Promise.all([laadModel(d.model, `assets/dieren/lijf_${d.model}.glb?v=${v}`), L.loadAsync(`assets/dieren/kop_${d.model}.glb?v=${v}`)]);
    koppen[d.model] = g.scene;
  }));
}
/** De dierenkop over het hoofd (hij beweegt mee met het hoofd), en bij de wolf een staart aan de heup. */
function zetKop(m, def) {
  const o = m.object; o.updateMatrixWorld(true);
  let hoofd = null, heup = null; o.traverse((b) => { if (b.isBone && b.name === "DEF-head") hoofd = b; if (b.isBone && b.name === "DEF-hips") heup = b; });
  const [kx, ky, kz, maat] = def.kop, top = new THREE.Box3().setFromObject(m.hoog).max.y, hp = hoofd.getWorldPosition(new THREE.Vector3()), s = def.schaal ?? 1;
  const kop = koppen[def.model].clone(); kop.traverse((c) => { if (c.isMesh) { c.castShadow = true; if (def.kopTint) { c.material = c.material.clone(); c.material.color.set(def.kopTint); } } });
  kop.scale.setScalar(maat * s); kop.position.set(hp.x + kx, top - 0.13 * s + ky, hp.z + kz * s);
  o.attach(kop); kop.updateMatrixWorld(true); hoofd.attach(kop);
  if (def.staart) {
    const staart = new THREE.Mesh(new THREE.ConeGeometry(0.055 * s, 0.5 * s, 8), new THREE.MeshStandardMaterial({ color: "#8d8a84", roughness: 1 }));
    const h = heup.getWorldPosition(new THREE.Vector3()); staart.position.set(h.x, h.y - 0.12 * s, h.z - 0.2 * s); staart.rotation.x = -2.2; staart.castShadow = true;
    o.attach(staart); staart.updateMatrixWorld(true); heup.attach(staart);
  }
}

// ---------- de vechters ----------
class Vechter {
  constructor(def, x) {
    this.def = def; this.m = maakMens(def.model); this.m.detail(true, true);
    if (def.schaal) this.m.object.scale.setScalar(def.schaal);
    if (def.kop) zetKop(this.m, def);
    this.leven = def.leven ?? 100;
    this.pos = new THREE.Vector3(x, 0, 0); this.start = x; this.richting = 0;
    scene.add(this.m.object);
    this.reset(true);
  }
  reset(alles) {
    this.pos.set(this.start, 0, 0); this.st = this.def.stamina; if (alles) this.hp = this.leven;
    Object.assign(this, { aanval: null, blok: false, wankel: 0, ko: false, combo: -1, comboT: 0, duwX: 0, duwZ: 0, veilig: 0, reeks: 0, reeksT: 0 });
    this.m.huidig = null; this.m.zet("k_idle");
  }
  /** Begin een stoot of trap (de volgende uit de reeks als je snel doortikt). */
  val(soort) {
    if (this.aanval || this.wankel > 0 || this.ko) return false;
    const d = this.def, lijst = soort === "trap" ? d.trappen : d.stoten;
    this.combo = this.comboT > 0 && this.laatste === soort ? this.combo + 1 : 0; this.laatste = soort;
    const naam = lijst[this.combo % lijst.length], t = TECHNIEK[naam], kost = soort === "trap" ? KOOI.kostTrap : KOOI.kostStoot;
    const moe = this.st < kost; // buiten adem: trager
    const tempo = KOOI.tempo * (d.tempo ?? 1) * (soort === "trap" ? d.trapTempo : 1) * (moe ? 0.7 : 1);
    this.st = Math.max(0, this.st - kost);
    this.aanval = { naam, soort, t: 0, raak: t.raak / tempo, duur: t.duur / tempo, hit: false, zwaar: t.zwaar };
    this.blok = false;
    this.m.zet(`k_${naam}`, tempo, 0);
    geluid.zwiep(t.zwaar ? 1 : 0.6);
    return true;
  }
  /** in = { x, z (wereld, lengte hoogstens 1), stoot, trap, blok } */
  stap(dt, ander, inn) {
    const dx = ander.pos.x - this.pos.x, dz = ander.pos.z - this.pos.z, d = Math.hypot(dx, dz) || 1;
    this.veilig = Math.max(0, (this.veilig ?? 0) - dt); this.reeksT = Math.max(0, (this.reeksT ?? 0) - dt);
    if (!this.ko) { let h = Math.atan2(dx, dz) - this.richting; h = Math.atan2(Math.sin(h), Math.cos(h)); this.richting += h * Math.min(1, dt * 8); }
    // achteruit door een klap
    if (this.duwX || this.duwZ) { this.pos.x += this.duwX * dt; this.pos.z += this.duwZ * dt; const rem = Math.exp(-dt * 7); this.duwX *= rem; this.duwZ *= rem; if (Math.abs(this.duwX) + Math.abs(this.duwZ) < 0.05) this.duwX = this.duwZ = 0; }
    if (this.ko) { /* ligt */ }
    else if (this.wankel > 0) this.wankel -= dt;
    else if (this.aanval) {
      const a = this.aanval; a.t += dt;
      // een stapje in, zodat de techniek aankomt
      const bereik = a.soort === "trap" ? KOOI.bereikTrap : KOOI.bereikStoot;
      if (a.t < a.raak && d > bereik * 0.8) { this.pos.x += (dx / d) * 2.4 * dt; this.pos.z += (dz / d) * 2.4 * dt; }
      if (!a.hit && a.t >= a.raak) { a.hit = true; if (d < bereik + 0.1 && !ander.ko) raak(this, ander, a); }
      if (a.t >= a.duur) { this.aanval = null; this.comboT = 0.6; }
    } else {
      this.comboT -= dt;
      if (inn.stoot) this.val("stoot"); else if (inn.trap) this.val("trap");
      else {
        this.blok = !!inn.blok;
        const kracht = Math.min(1, Math.hypot(inn.x, inn.z));
        if (this.blok) { if (this.m.huidig !== "k_block") this.m.zet("k_block", 2, 0.1); if (this.m.actie && this.m.actie.time > 0.3) this.m.actie.paused = true; }
        else if (kracht > 0.15) {
          const naar = (inn.x * dx + inn.z * dz) / d, v = (naar < -0.3 ? KOOI.achteruit : KOOI.loopSnel) * (this.def.snel ?? 1);
          this.pos.x += inn.x * v * dt; this.pos.z += inn.z * v * dt;
          // de stapbeweging op het tempo van de voeten, zodat ze niet glijden
          this.m.zet(naar < -0.3 ? "k_retreat" : "k_advance", 0.55 + kracht * 0.75 * (this.def.snel ?? 1));
        } else this.m.zet("k_idle");
        this.st = Math.min(this.def.stamina, this.st + this.def.herstel * dt * (this.blok ? 0.5 : 1));
      }
    }
    // niet door elkaar heen, en binnen de kooi
    const nd = Math.hypot(ander.pos.x - this.pos.x, ander.pos.z - this.pos.z);
    if (nd < 0.75 && nd > 1e-3 && !this.ko && !ander.ko) { const u = (0.75 - nd) / 2; this.pos.x -= ((ander.pos.x - this.pos.x) / nd) * u; this.pos.z -= ((ander.pos.z - this.pos.z) / nd) * u; }
    const r = Math.hypot(this.pos.x, this.pos.z); if (r > KOOI.straal) { this.pos.x *= KOOI.straal / r; this.pos.z *= KOOI.straal / r; }
    this.m.mixer.update(dt);
    this.m.object.position.copy(this.pos); this.m.object.rotation.y = this.richting;
  }
}
/** Een techniek komt aan. */
function raak(van, doel, a) {
  const d = van.def, kracht = (a.soort === "trap" ? d.trap : d.stoot) * (0.55 + 0.45 * (van.st / d.stamina));
  let schade = SCHADE[a.naam] * kracht;
  const dx = doel.pos.x - van.pos.x, dz = doel.pos.z - van.pos.z, l = Math.hypot(dx, dz) || 1;
  const p = new THREE.Vector3((van.pos.x + doel.pos.x * 2) / 3, a.soort === "trap" && a.naam === "gedan" ? 0.6 : 1.35, (van.pos.z + doel.pos.z * 2) / 3);
  if (doel.veilig > 0) return; // net uit een reeks geslagen: even buiten bereik
  if (doel.blok && !doel.aanval && doel.wankel <= 0) {
    schade *= KOOI.blok; doel.st = Math.max(0, doel.st - 6);
    doel.duwX = (dx / l) * 1.2; doel.duwZ = (dz / l) * 1.2;
    geluid.tik(1); vonk(p, "#cfd6e0", 0.5);
  } else {
    // hoogstens drie klappen achter elkaar: de derde (of een zware) slaat je uit elkaar, en dan heb je even lucht
    doel.reeks = doel.reeksT > 0 ? doel.reeks + 1 : 1; doel.reeksT = 1.1;
    const los = doel.reeks >= 3 || a.zwaar;
    if (los) { doel.reeks = 0; doel.veilig = 0.75; }
    // een lichte stoot stopt een trap die al onderweg is niet: je incasseert hem, maar je trap komt nog
    // (en de beer is zo stug dat een lichte klap hem helemaal niet van zijn stuk brengt)
    const doorzetten = !a.zwaar && (doel.def.stug || (doel.aanval?.soort === "trap" && !doel.aanval.hit));
    if (doorzetten) { doel.hp = Math.max(0, doel.hp - schade); geluid.stomp(0.6); vonk(p, "#fff1c9", 0.7); if (doel.hp <= 0) knockOut(van, doel); tekenBalken(); return; }
    doel.wankel = a.zwaar ? 0.5 : 0.26; doel.aanval = null; doel.blok = false;
    doel.duwX = (dx / l) * (los ? 3.6 : 1.6); doel.duwZ = (dz / l) * (los ? 3.6 : 1.6);
    doel.m.zet(a.soort === "trap" && a.naam !== "jodan_mawashi" && a.naam !== "ushiro_mawashi" ? "schrik" : "klapHoofd", 1, 0);
    geluid.stomp(a.zwaar ? 1 : 0.7); geluid.oef(0.7);
    vonk(p, "#fff1c9", a.zwaar ? 1.2 : 0.8);
    schud = Math.max(schud, a.zwaar ? 0.14 : 0.06);
    if (a.zwaar || Math.random() < 0.3) joel(a.zwaar ? 0.7 : 0.35);
  }
  doel.hp = Math.max(0, doel.hp - schade);
  if (doel.hp <= 0) knockOut(van, doel);
  tekenBalken();
}
// een korte flits op de plek van de klap
const vonken = [];
function vonk(p, kleur, maat) {
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), new THREE.MeshBasicMaterial({ color: kleur, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.position.copy(p); m.scale.setScalar(maat); scene.add(m); vonken.push({ m, t: 0.14 });
}

// ---------- het gevecht ----------
const spel = { fase: "kies", ronde: 1, rondes: 3, tijd: KOOI.rondeTijd, pauze: 0, keuze: 0 };
let A = null, B = null, schud = 0, beeld = 0; // A = jij, B = de tegenstander
const invoer = { x: 0, y: 0, toets: {}, stoot: false, trap: false, blok: false };
let ai = nieuwBrein();

function knockOut(winnaar, verliezer) {
  verliezer.ko = true; verliezer.aanval = null; verliezer.m.zet("liggen", 1, 0);
  spel.fase = "ko"; spel.pauze = 4.2; spel.winnaar = winnaar;
  joel(1); setTimeout(() => joel(0.8), 900);
  geluid.klap(1);
  toon("K.O.", 1600);
  setTimeout(() => winnaar.m.zet("k_victory", 1, 0), 900);
  muziek?.tempo(120);
}
function toon(tekst, ms = 1400) { const el = $("#groot"); el.textContent = tekst; el.classList.remove("aan"); void el.offsetWidth; el.classList.add("aan"); clearTimeout(toon.t); toon.t = setTimeout(() => el.classList.remove("aan"), ms); }
function tekenBalken() {
  for (const [v, k] of [[A, "a"], [B, "b"]]) { $(`#hp-${k}`).style.transform = `scaleX(${v.hp / v.leven})`; $(`#st-${k}`).style.transform = `scaleX(${v.st / v.def.stamina})`; }
  const t = Math.max(0, Math.ceil(spel.tijd)); $("#klok").textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; $("#ronde").textContent = `${spel.ronde} / ${spel.rondes}`;
}
function beginRonde(eerste) {
  A.reset(eerste); B.reset(eerste);
  if (!eerste) for (const v of [A, B]) v.hp = Math.min(v.leven, v.hp + KOOI.herstelRonde);
  spel.tijd = KOOI.rondeTijd; spel.fase = "klaar"; spel.pauze = 1.8;
  toon(`Ronde ${spel.ronde}`, 1500); tekenBalken(); muziek?.tempo(148);
}
function beginGevecht() {
  geluid.start();
  if (!muziek && geluid.ctx) muziek = new Muziek(geluid.ctx, geluid.uit);
  // dezelfde volumes als in de opties van het spel
  let o = {}; try { o = JSON.parse(localStorage.getItem("fbs-opties") ?? "{}"); } catch {}
  geluid.uit.gain.value = o.geluid === 0 ? 0 : 0.9; geluid.zetSfeer([0, 0.45, 1, 1.9][o.sfeer ?? 2]);
  muziek?.volume([0, 0.2, 0.42, 0.7][o.muziek ?? 2]);
  geluid.drukte(1.5);
  for (const v of [A, B]) if (v) scene.remove(v.m.object);
  const mijn = VECHTERS[spel.keuze], zijn = spel.tegen != null ? VECHTERS[spel.tegen] : VECHTERS.filter((v) => v !== mijn)[(Math.random() * (VECHTERS.length - 1)) | 0];
  A = new Vechter(mijn, -1.6); B = new Vechter(zijn, 1.6);
  $("#naam-a").textContent = mijn.naam; $("#naam-b").textContent = zijn.naam;
  spel.ronde = 1; spel.winnaar = null; spel.punten = false; ai = nieuwBrein();
  $("#kies").hidden = true; $("#uitslag").hidden = true; $("#hud").hidden = false;
  joel(0.8);
  beginRonde(true);
}
function einde(tekst) {
  spel.fase = "klaar-af";
  $("#uitslagKop").textContent = spel.winnaar === A ? "Gewonnen" : spel.winnaar === B ? "Verloren" : "Gelijk";
  $("#uitslagTekst").textContent = tekst;
  $("#uitslag").hidden = false; $("#hud").hidden = true;
  muziek?.stop();
}
/**
 * De computer. Rustig voetenwerk zoals echte vechters: recht op de ander af, op afstand blijven staan in de vechthouding,
 * af en toe een kleine stap opzij of terug, en dan uithalen. Geen rondjes rennen.
 */
function denk(dt, ik, hij, ai) {
  const dx = hij.pos.x - ik.pos.x, dz = hij.pos.z - ik.pos.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d, uit = { x: 0, z: 0, stoot: false, trap: false, blok: false };
  ai.wacht -= dt; ai.faseT -= dt;
  if (hij.aanval && !hij.aanval.hit && d < 2 && ai.blokT <= 0 && Math.random() < KOOI.ai.blokKans * dt * 12) ai.blokT = 0.5;
  if (ai.blokT > 0) { ai.blokT -= dt; uit.blok = true; return uit; }
  // buiten adem: achteruit stappen met de dekking hoog, tot hij weer lucht heeft
  if (ik.st < 20) ai.moe = true; else if (ik.st > ik.def.stamina * 0.55) ai.moe = false;
  if (ai.moe) { if (d < 2.6) { uit.x = -ux * 0.8; uit.z = -uz * 0.8; } if (d < 1.3) uit.blok = true; return uit; }
  const trapper = ik.def.trap > ik.def.stoot, ver = trapper ? KOOI.bereikTrap - 0.15 : KOOI.bereikStoot - 0.1;
  if (d > ver + 0.25) { const v = d > 2.4 ? 0.95 : 0.6; uit.x = ux * v; uit.z = uz * v; return uit; } // recht erop af; dichtbij voorzichtiger
  if (ai.wacht <= 0 && d <= ver + 0.25) {
    // wie het van zijn vuisten moet hebben, stapt in met een stoot; een trapper trapt van afstand
    const trap = trapper ? d > KOOI.bereikStoot - 0.1 || Math.random() < 0.5 : Math.random() < 0.12;
    if (trap) uit.trap = true; else uit.stoot = true;
    ai.wacht = ik.comboT > 0 && Math.random() < 0.4 ? 0.05 : tussen(...KOOI.ai.wacht); // soms een reeks
    return uit;
  }
  // op afstand: meestal stilstaan in de vechthouding; af en toe een kort stapje opzij, in of uit
  if (ai.faseT <= 0) { const r = Math.random(); ai.fase = r < 0.55 ? "sta" : r < 0.8 ? "zij" : r < 0.92 ? "uit" : "in"; ai.faseT = ai.fase === "sta" ? tussen(0.5, 1.3) : tussen(0.25, 0.45); ai.zij = Math.random() < 0.5 ? -1 : 1; }
  if (ai.fase === "zij") { uit.x = -uz * ai.zij * 0.6; uit.z = ux * ai.zij * 0.6; }
  else if (ai.fase === "uit") { uit.x = -ux * 0.6; uit.z = -uz * 0.6; }
  else if (ai.fase === "in" && d > 0.95) { uit.x = ux * 0.5; uit.z = uz * 0.5; }
  return uit;
}
function nieuwBrein() { return { wacht: 1, blokT: 0, zij: 1, faseT: 0, fase: "sta", moe: false }; }
/** Eén stap van het gevecht (los van het beeld, zodat een test het kan vooruitspoelen). mijn = wat de speler doet. */
function stapGevecht(dt, mijn) {
  A.stap(dt, B, mijn); B.stap(dt, A, denk(dt, B, A, ai));
  spel.tijd -= dt;
}

const camDoel = new THREE.Vector3(0, 1.4, 6), kijkDoel = new THREE.Vector3(0, 1.05, 0), loodrecht = new THREE.Vector3(0, 0, 1);
function lus(nu) {
  const dt = Math.min(0.05, (nu - (lus.t ?? nu)) / 1000); lus.t = nu; beeld++;
  if (A && B) {
    if (spel.fase === "vecht") {
      // jouw invoer: de stuurknuppel ten opzichte van het beeld
      const rechts = new THREE.Vector3().crossVectors(camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize(), new THREE.Vector3(0, 1, 0));
      const vooruit = new THREE.Vector3(-rechts.z, 0, rechts.x).negate();
      const sx = invoer.x + (invoer.toets.KeyD ? 1 : 0) - (invoer.toets.KeyA ? 1 : 0), sy = invoer.y + (invoer.toets.KeyW ? 1 : 0) - (invoer.toets.KeyS ? 1 : 0);
      stapGevecht(dt, spel.demo ? denk(dt, A, B, spel.demo) : { x: rechts.x * sx + vooruit.x * sy, z: rechts.z * sx + vooruit.z * sy, stoot: invoer.stoot, trap: invoer.trap, blok: invoer.blok || invoer.toets.KeyL });
      invoer.stoot = invoer.trap = false;
      if (Math.floor(spel.tijd) !== spel.tik) { spel.tik = Math.floor(spel.tijd); if (spel.tijd < 10) muziek?.tempo(164); }
      if (spel.tijd <= 0 && spel.fase === "vecht") {
        if (spel.ronde >= spel.rondes) { spel.winnaar = A.hp / A.leven > B.hp / B.leven + 0.005 ? A : B.hp / B.leven > A.hp / A.leven + 0.005 ? B : null; spel.fase = "ko"; spel.pauze = 2.5; toon("Tijd", 1500); joel(0.6); spel.punten = true; }
        else { spel.ronde++; joel(0.4); beginRonde(false); }
      }
      tekenBalken();
    } else {
      const stil = { x: 0, z: 0 };
      A.stap(dt, B, stil); B.stap(dt, A, stil);
      spel.pauze -= dt;
      if (spel.fase === "klaar" && spel.pauze <= 0) { spel.fase = "vecht"; toon("Vecht!", 700); geluid.bel?.(1.5); }
      if (spel.fase === "ko" && spel.pauze <= 0) einde(spel.punten ? `Op punten: ${Math.round((A.hp / A.leven) * 100)} tegen ${Math.round((B.hp / B.leven) * 100)}` : `K.O. in ronde ${spel.ronde}`);
    }
    // camera: van opzij, loodrecht op de lijn tussen de vechters, en verder weg als ze uit elkaar staan
    const mx = (A.pos.x + B.pos.x) / 2, mz = (A.pos.z + B.pos.z) / 2, lx = B.pos.x - A.pos.x, lz = B.pos.z - A.pos.z, afst = Math.hypot(lx, lz) || 1;
    const p = new THREE.Vector3(-lz / afst, 0, lx / afst); if (p.dot(loodrecht) < 0) p.negate();
    loodrecht.lerp(p, Math.min(1, dt * KOOI.draai)).normalize();
    const ver = 3.0 + afst * 0.55, doel = new THREE.Vector3(mx + loodrecht.x * ver, 1.45, mz + loodrecht.z * ver);
    const r = Math.hypot(doel.x, doel.z); if (r > 4.25) { doel.x *= 4.25 / r; doel.z *= 4.25 / r; } // binnen het gaas blijven
    camDoel.lerp(doel, 1 - Math.exp(-dt * 5)); kijkDoel.lerp(new THREE.Vector3(mx, 1.05, mz), 1 - Math.exp(-dt * 8));
    camera.position.copy(camDoel);
    if (schud > 0) { camera.position.x += (Math.random() - 0.5) * schud; camera.position.y += (Math.random() - 0.5) * schud; schud = Math.max(0, schud - dt * 0.6); }
    camera.lookAt(kijkDoel);
  } else {
    // keuzescherm: langzaam om de kooi draaien
    const h = nu / 6000; camera.position.set(Math.sin(h) * 7.5, 2.6, Math.cos(h) * 7.5); camera.lookAt(0, 1, 0);
  }
  const vc = window.__kooi.vrijeCamera; if (vc) { camera.position.set(...vc.pos); camera.lookAt(...vc.doel); } // alleen voor tests
  for (const v of [...vonken]) { v.t -= dt; v.m.scale.multiplyScalar(1 + dt * 14); v.m.material.opacity = Math.max(0, v.t / 0.14); if (v.t <= 0) { scene.remove(v.m); vonken.splice(vonken.indexOf(v), 1); } }
  stapPubliek(dt, beeld);
  renderer.render(scene, camera);
  requestAnimationFrame(lus);
}

// ---------- bediening ----------
function knoppen() {
  const houd = (sel, neer, op) => { const el = $(sel); const a = (e) => { e.preventDefault(); el.classList.add("in"); neer(); }, b = (e) => { e.preventDefault(); el.classList.remove("in"); op?.(); };
    el.addEventListener("touchstart", a, { passive: false }); el.addEventListener("touchend", b); el.addEventListener("touchcancel", b); el.addEventListener("mousedown", a); addEventListener("mouseup", () => el.classList.contains("in") && b(new Event("x"))); };
  houd("#stoot", () => { invoer.stoot = true; }); houd("#trap", () => { invoer.trap = true; }); houd("#blok", () => { invoer.blok = true; }, () => { invoer.blok = false; });
  // stuurknuppel: verschijnt waar je links je duim neerzet
  const vlak = $("#vlak"), st = $("#stick"), duim = $("#duim"), R = 52; let id = null, o = null;
  vlak.addEventListener("touchstart", (e) => { e.preventDefault(); const t = e.changedTouches[0]; id = t.identifier; o = [t.clientX, t.clientY]; st.style.left = `${o[0] - R}px`; st.style.top = `${o[1] - R}px`; st.style.bottom = "auto"; }, { passive: false });
  vlak.addEventListener("touchmove", (e) => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === id) { let x = (t.clientX - o[0]) / R, y = -(t.clientY - o[1]) / R; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } invoer.x = x; invoer.y = y; duim.style.transform = `translate(${x * R * 0.7}px, ${-y * R * 0.7}px)`; } }, { passive: false });
  const los = (e) => { for (const t of e.changedTouches) if (t.identifier === id) { id = null; invoer.x = invoer.y = 0; duim.style.transform = ""; st.style.left = st.style.top = st.style.bottom = ""; } };
  vlak.addEventListener("touchend", los); vlak.addEventListener("touchcancel", los);
  addEventListener("keydown", (e) => { invoer.toets[e.code] = true; if (!e.repeat) { if (e.code === "KeyJ") invoer.stoot = true; if (e.code === "KeyK") invoer.trap = true; } });
  addEventListener("keyup", (e) => { invoer.toets[e.code] = false; });
  // keuzescherm
  const lijst = $("#vechters");
  const teken = () => {
    lijst.textContent = "";
    VECHTERS.forEach((v, i) => {
      const k = document.createElement("button"); k.className = i === spel.keuze ? "aan" : "";
      k.innerHTML = `<b>${v.naam}</b><span>${v.stijl}</span>` + ["Stoten", "Trappen", "Adem", "Snelheid"].map((n, j) => `<i>${n}<u><s style="width:${v.balken[j] * 100}%"></s></u></i>`).join("");
      k.addEventListener("click", () => { spel.keuze = i; teken(); }); lijst.append(k);
    });
    for (const b of document.querySelectorAll("#rondes button")) b.classList.toggle("aan", +b.dataset.n === spel.rondes);
  };
  for (const b of document.querySelectorAll("#rondes button")) b.addEventListener("click", () => { spel.rondes = +b.dataset.n; teken(); });
  $("#start").addEventListener("click", beginGevecht); $("#opnieuw").addEventListener("click", beginGevecht);
  $("#anders").addEventListener("click", () => { $("#uitslag").hidden = true; $("#kies").hidden = false; for (const v of [A, B]) scene.remove(v.m.object); A = B = null; });
  teken();
}

(async () => {
  bouwKooi();
  await laadMensen((v) => { $("#laden").style.setProperty("--v", v); });
  await laadKarate();
  await laadDieren();
  bouwPubliek();
  knoppen();
  $("#laden").hidden = true; $("#kies").hidden = false;
  requestAnimationFrame(lus);
})().catch((e) => { $("#laden").textContent = "Laden mislukt: " + e.message; console.error(e); });
window.__kooi = { stapGevecht, denk, nieuwBrein, beginRonde, spel, invoer, VECHTERS, KOOI, get A() { return A; }, get B() { return B; }, beginGevecht, publiek, get muziek() { return muziek; }, geluid };
