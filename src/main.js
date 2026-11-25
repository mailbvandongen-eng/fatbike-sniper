// Fatbike Sniper: hoofdlus, camera, besturing, schieten, rondes.
import * as THREE from "three";
import { CAMERA, CAMERA_BOTSING, CAMERA_STAND, KIJKEN, SCHOT } from "./config.js";
import { laadKarate, TECHNIEK, STOTEN, TRAPPEN } from "./karate.js";
import { bouwWereld, zetFietsenInRekken, bevries, laadSpeeltoestel, laadNatuur } from "./wereld.js";
import { Graaf, Voetganger, Fietser, Auto, Boodschapper, Staander, werp, schrikVan } from "./verkeer.js";
import { WAPENKAST, HOUVAST, laadWapens, maakWapen, laadWerp, maakWerp, maakRaket } from "./wapens.js";
import { Muziek } from "./muziek.js";
import { kies, tussen, MAT, laadFietsen } from "./figuren.js";
import { laadMensen, maakMens } from "./mensen.js";
import { laadAutos, maakAuto } from "./autos.js";
import { maakStraat } from "./straat.js";
import { Effecten } from "./effecten.js";
import { Geluid } from "./geluid.js";

const $ = (s) => document.querySelector(s);
// het level: uit het adres (?level=), anders de laatste keuze, anders het Julianaplein
const LEVELS = { julianaplein: "Julianaplein", steelaan: "Van Steelaan", buskenhuet: "Busken Huethove" };
const gevraagd = new URLSearchParams(location.search).get("level") ?? localStorage.getItem("fbs-level");
const LOCATIE = LEVELS[gevraagd] ? gevraagd : "julianaplein";
// opties van het beginscherm (bewaard op dit toestel). tijd: null = zoals het level bedoeld is.
const OPTIES = [
  ["handhaving", "Handhaving", ["uit", "aan"]],
  ["tijd", "Tijdslimiet", ["uit", "aan"]],
  ["fatbikes", "Fatbikes", ["normaal", "veel", "heel veel"]],
  ["kogels", "Onbeperkt kogels", ["uit", "aan"]],
  ["mikhulp", "Mikhulp op straat", ["uit", "aan"]],
  ["geluid", "Geluid", ["uit", "aan"]],
  ["muziek", "Muziek", ["uit", "zacht", "gewoon", "hard"]],
  ["sfeer", "Achtergrond", ["uit", "zacht", "gewoon", "hard"]],
  ["markeer", "Fatbikes markeren", ["uit", "aan"]],
];
const opties = { handhaving: 1, tijd: null, fatbikes: 0, kogels: 0, mikhulp: 1, geluid: 1, markeer: 0, muziek: 2, sfeer: 2 };
const GELUIDKEUZES = new Set(["geluid", "muziek", "sfeer"]); // wat je ook tijdens het spelen kunt bijstellen (het nootje in beeld)
let muziek = null, alleenGeluid = false;
/** Zet het volume zoals in de opties gekozen. */
function pasGeluidAan() {
  if (!geluid.ctx) return;
  geluid.uit.gain.value = opties.geluid ? 0.9 : 0;
  geluid.zetSfeer([0, 0.45, 1, 1.9][opties.sfeer] ?? 1);
  muziek ??= new Muziek(geluid.ctx, geluid.uit, "sluip");
  muziek.volume(spel.bezig ? [0, 0.14, 0.3, 0.55][opties.muziek] ?? 0.3 : 0);
}
const merken = [];
try { Object.assign(opties, JSON.parse(localStorage.getItem("fbs-opties") ?? "{}")); } catch {}
localStorage.setItem("fbs-level", LOCATIE);
const KOGEL_V = 850, ZWAARTE = 9.81, NUL_AFSTAND = 75;

// ---------- renderer en scène ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
const telefoon = matchMedia("(pointer: coarse)").matches;
// vaste resolutie: steeds bijstellen maakt het beeld even zwart
// lichte weergave: gaat vanzelf aan als het beeld een keer is weggevallen (te weinig grafisch geheugen), of met ?licht=1
const urlLicht = new URLSearchParams(location.search).get("licht");
if (urlLicht !== null) localStorage.setItem("fbs-licht", urlLicht === "0" ? "0" : "1");
const licht = localStorage.getItem("fbs-licht") === "1";
const pr = licht ? 1 : Math.min(devicePixelRatio, telefoon ? 1.5 : 2);
renderer.setPixelRatio(pr);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = !licht;
// valt het beeld weg (de telefoon pakt het grafisch geheugen af), dan de volgende keer licht starten
renderer.domElement.addEventListener("webglcontextlost", () => {
  localStorage.setItem("fbs-licht", "1");
  localStorage.setItem("fbs-beeldweg", String(+(localStorage.getItem("fbs-beeldweg") ?? 0) + 1));
});
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const LUCHT = new THREE.Color("#cbd8e2");
scene.fog = new THREE.Fog(LUCHT, 140, 520);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 1500);

// lucht
{
  const g = new THREE.SphereGeometry(1200, 24, 12);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { boven: { value: new THREE.Color("#6f9fd0") }, onder: { value: LUCHT } },
    vertexShader: "varying vec3 p; void main(){ p = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }",
    fragmentShader: "uniform vec3 boven; uniform vec3 onder; varying vec3 p; void main(){ float h = clamp(p.y*2.2,0.,1.); gl_FragColor = vec4(mix(onder, boven, pow(h,.7)),1.); }",
  });
  const lucht = new THREE.Mesh(g, m);
  lucht.renderOrder = -1;
  scene.add(lucht);
}
// spiegeling voor autolak en ruiten: lucht boven, straat onder (eenmalig in een kaart gebakken)
{
  const omg = new THREE.Scene();
  omg.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: "varying vec3 p; void main(){ p = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }",
    fragmentShader: "varying vec3 p; void main(){ vec3 lucht = mix(vec3(.85,.9,.95), vec3(.42,.62,.85), clamp(p.y*1.6,0.,1.)); vec3 grond = vec3(.32,.26,.24); vec3 c = p.y > 0. ? lucht : mix(vec3(.55,.5,.47), grond, clamp(-p.y*4.,0.,1.)); c += vec3(1.,.95,.85) * pow(max(dot(p, normalize(vec3(-.6,.7,.2))),0.), 64.) * 6.; gl_FragColor = vec4(c,1.); }",
  })));
  const env = new THREE.PMREMGenerator(renderer).fromScene(omg, 0.02).texture;
  for (const m of [MAT.auto, MAT.glas]) { m.envMap = env; m.needsUpdate = true; }
  MAT.env = env;
  MAT.glas.envMapIntensity = 1.6;
}
const zon = new THREE.DirectionalLight("#fff1dc", 2.6);
zon.position.set(-90, 110, 30);
zon.castShadow = true;
zon.shadow.mapSize.set(telefoon ? 1024 : 2048, telefoon ? 1024 : 2048);
Object.assign(zon.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, near: 10, far: 400 });
zon.shadow.bias = -0.0004; zon.shadow.normalBias = 0.04;
scene.add(zon, zon.target);
scene.add(new THREE.HemisphereLight("#cfe0f0", "#6b6359", 1.05));

// ---------- winter: grijze lucht, lage zon, kale bomen ----------
function winter() {
  const lucht = new THREE.Color("#c9ced3");
  scene.fog.color.copy(lucht); scene.fog.near = 90; scene.fog.far = 420;
  scene.traverse((o) => { if (o.material?.uniforms?.boven) { o.material.uniforms.boven.value.set("#9aa7b3"); o.material.uniforms.onder.value.copy(lucht); } });
  zon.color.set("#ffe2c4"); zon.intensity = 1.5; zon.position.set(-60, 45, 90);
  scene.traverse((o) => { if (o.isHemisphereLight) { o.color.set("#d5dde4"); o.groundColor.set("#5d5650"); o.intensity = 1.25; } });
}

// ---------- staat ----------
const fx = new Effecten(scene);
const geluid = new Geluid();
let wereld, graaf, data;
// standplaatsen: balkons en dak van Pleinzicht, en op de grond achter muurtjes
let standen = [], standNr = 0, standDecor = null, wisselTot = 0;
let schutter = null, geweer = null; // jij, van achteren te zien
let sluiper = null, karateka = null; // in dit level ga je in karatepak de straat op
const oog = new THREE.Vector3(); // waar je ogen zijn (de kogel vertrekt hier)
const wisselt = () => performance.now() < wisselTot;
const reizigers = [];
const stil = []; // geparkeerde auto's en fietsen in rekken: { object, raak, soort }
const vallers = []; // fatbikes en berijders die vallen of vliegen
const spel = { reizigers, ronde: 1, bezig: false, score: 0 };
let tijdSchaal = 1, filmCam = null;

// camera-sturing
const kijk = { yaw: 0, pitch: -0.25, basisYaw: 0, zoom: 1, scoopZoom: 8 };
let terugslag = 0, herlaad = 0, flitsT = 0, flits = null; // flits = het mondingsvuur aan de loop

async function laad() {
  data = await (await fetch(`data/${LOCATIE}.json?v=${window.VERSIE ?? ""}`)).json();
  $("#plek").textContent = data.naam;
  spel.modus = data.modus;
  if (data.seizoen === "winter") winter();
  // bonus: fatbikes rijden vrij rond, ook over de tramrails; punten op straat, rails en fietspaden dicht bij je
  if (data.modus === "bonus") {
    const p = (spel.vrijPunten = []);
    const [sx, , sz] = data.sluipschutter.pos;
    for (const l of data.lijnen) if (["tram", "weg", "fietspad"].includes(l.s)) for (let i = 0; i < l.p.length - 1; i++) {
      const [a, b] = [l.p[i], l.p[i + 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let t = 0; t < L; t += 5) {
        const x = a[0] + ((b[0] - a[0]) * t) / L, z = a[1] + ((b[1] - a[1]) * t) / L;
        if (Math.hypot(x - sx, z - sz) < 75) p.push([x, z]);
      }
    }
  }
  await Promise.all([laadMensen((v) => $("#laden").style.setProperty("--v", v)), laadFietsen(), laadWapens(), laadWerp(), laadNatuur().catch(() => {}), laadAutos((data.vasteAutos ?? []).map((a) => a[4])), data.speeltuinen?.length ? laadSpeeltoestel() : null]);
  if (data.karate) await laadKarate();
  wereld = bouwWereld(data, scene);
  graaf = new Graaf(data.graaf);
  blokken = data.voetafdrukken.map((v) => ({ r: v.ring, x0: Math.min(...v.ring.map((p) => p[0])), x1: Math.max(...v.ring.map((p) => p[0])), z0: Math.min(...v.ring.map((p) => p[1])), z1: Math.max(...v.ring.map((p) => p[1])) }));
  graaf.blok = inGebouw; // niemand rijdt of loopt door een muur
  // heggen en perken: vlakken (met omhullende rechthoek) en lijnen
  hegVlak = data.heggen.filter((h) => h.r).map((h) => ({ r: h.r, x0: Math.min(...h.r.map((p) => p[0])), x1: Math.max(...h.r.map((p) => p[0])), z0: Math.min(...h.r.map((p) => p[1])), z1: Math.max(...h.r.map((p) => p[1])) }));
  hegLijn = data.heggen.filter((h) => h.l).map((h) => h.l);
  graaf.heg = inHeg; // voetgangers en fietsers wijken er niet in uit
  graaf.autosBij = autosBij; // het verkeer stuurt om geparkeerde auto's heen
  graaf.uitAuto = uitAuto; // en ze lopen om geparkeerde auto's heen
  // jij: de schutter met het geweer
  schutter = maakMens(data.karate ? "karateka" : "schutter"); // in het karatelevel draag je het pak ook bij het raam
  geweer = maakWapen("geweer");
  scene.add(geweer); // los in de wereld: elk beeld tegen de schouder gelegd, in de kijkrichting
  for (const id of ZWAAR) scene.add((kast.mesh[id] = maakWapen(id)));
  for (const id of GOOI) { const m = maakWerp(id); if (m) { m.visible = false; scene.add((kast.mesh[id] = m)); } } // in je hand, voor je gooit
  pistool = maakWapen("pistool"); mes = maakWapen("mes"); knuppel = maakWapen("knuppel"); pistool.visible = mes.visible = knuppel.visible = false; scene.add(knuppel);
  scene.add(pistool, mes);
  zetWapen("pistool");
  straat = maakStraat({ scene, reizigers, loop, spel, graaf, data, geluid, $, vrij: (x, z) => !geblokkeerd(x, z), naarBinnen: () => zetLopen(false, true), tekenHud, weg });
  { const echt = straat.strafbaar; straat.strafbaar = (n) => { if (opties.handhaving) echt(n); }; } // handhaving kan uit in de opties
  scene.add(schutter.object);
  sluiper = schutter;
  if (data.karate) karateka = schutter;
  document.body.classList.toggle("karate", !!data.karate);
  // ▲▼ gaan van laag naar hoog: eerst de plekken op de grond, dan de verdiepingen
  standen = data.standplaatsen.map((st, i) => ({ ...st, i })).sort((a, b) => a.pos[1] - b.pos[1]);
  // geen hangplek of groepje vlak bij een standplaats op de grond
  const grondPos = data.standplaatsen.filter((st) => st.soort === "grond").map((st) => st.pos);
  spel.hangplekken = data.hangplekken.filter(([x, z]) => grondPos.every((p) => Math.hypot(p[0] - x, p[2] - z) > 9)).map(([x, z]) => new THREE.Vector3(x, 0, z));
  zetStand(standen.findIndex((st) => st.i === data.startStand));
  for (const a of wereld.geparkeerd) stil.push({ object: a, raak: a.userData.raak, soort: "auto" });
  zetFietsenInRekken(wereld, scene, (f) => stil.push({ object: f, raak: f.userData.raak, soort: "fiets" }));
  bevries(stil.filter((s) => s.soort === "fiets").map((s) => s.object), scene); // de auto's zijn al in één keer getekend
  // druk plein: veel mensen dicht bij de parkeerplaats, boodschappers, groepjes en mensen op bankjes
  graaf.geenKar = !data.winkels?.length; // zonder winkels in de buurt loopt niemand met een winkelwagen
  const druk = data.druk ?? 1; // een hofje is rustiger dan een winkelplein
  for (let i = 0; i < (licht ? 30 : telefoon ? 55 : 75) * druk; i++) reizigers.push(new Voetganger(graaf, scene));
  for (let i = 0; i < (licht ? 6 : telefoon ? 12 : 16); i++) nieuweBoodschapper();
  for (const h of spel.hangplekken.slice(0, data.hangjeugd ? 12 : 4)) nieuweGroep(h);
  for (const [soort, x, z] of data.dingen) if (soort === "bank" && Math.hypot(x, z) < 75 && Math.random() < (data.hangjeugd ? 1 : 0.6)) reizigers.push(new Staander(scene, x + tussen(-0.5, 0.5), z, Math.random() * Math.PI * 2, true, data.hangjeugd ? "fatbiker" : "voetganger"));
  for (let i = 0; i < (licht ? 8 : 14) * Math.min(1, druk * 1.5); i++) reizigers.push(new Fietser(graaf, scene, kies(["fiets", "fiets", "fiets", "ebike", "ebike", "bakfiets"])));
  for (let i = 0; i < (licht ? 7 : 12) * Math.min(1, druk * 1.5); i++) reizigers.push(new Auto(graaf, scene));
  $("#laden").hidden = true;
  $("#start").hidden = false;
  toonStart();
}

// ---------- standplaatsen ----------
function zetStand(nr) {
  standNr = nr;
  const st = standen[nr];
  oog.set(...st.pos);
  if (st.soort === "grond") oog.y = 1.5; // staand, leunend over het muurtje
  camera.position.copy(oog);
  const [nx, nz] = st.normaal;
  kijk.basisYaw = Math.atan2(nx, nz);
  // op de grond kijk je recht over het muurtje; boven kijk je naar de Jumbo
  kijk.yaw = st.soort === "grond" ? kijk.basisYaw : Math.atan2(st.kijk[0] - st.pos[0], st.kijk[2] - st.pos[2]);
  kijk.pitch = st.soort === "grond" ? 0 : st.soort === "dak" ? -0.6 : st.soort === "raam" ? -0.4 : -0.3;
  if (standDecor) scene.remove(standDecor);
  standDecor = bouwDecor(st);
  if (standDecor) scene.add(standDecor);
  document.body.classList.toggle("grond", st.soort === "grond");
  $("#hoger").classList.toggle("uit", nr >= standen.length - 1);
  $("#lager").classList.toggle("uit", nr <= 0);
}
/** Wat er om je heen staat: balkon met borstwering, of de dakrand. Op de grond staat het echte muurtje er al. */
function bouwDecor(st) {
  if (st.soort === "grond") return null;
  const g = new THREE.Group();
  const [nx, nz] = st.normaal;
  const beton = new THREE.MeshStandardMaterial({ color: "#d9d5cc", roughness: 0.9 });
  if (st.soort === "dak") {
    // je staat op het grind, achter de dakrand
    g.position.set(st.pos[0], st.pos[1] - 1.6, st.pos[2]);
    g.rotation.y = Math.atan2(nx, nz);
    // lage dakrand vlak voor je
    const rand = new THREE.Mesh(new THREE.BoxGeometry(8, 0.45, 0.25), beton);
    rand.position.set(0, 0.22, 0.45);
    const kap = new THREE.Mesh(new THREE.BoxGeometry(8, 0.05, 0.32), new THREE.MeshStandardMaterial({ color: "#8d9093", metalness: 0.5, roughness: 0.4 }));
    kap.position.set(0, 0.47, 0.45);
    const vloer = new THREE.Mesh(new THREE.BoxGeometry(8, 0.1, 3), new THREE.MeshStandardMaterial({ color: "#6f6d68", roughness: 1 }));
    vloer.position.set(0, -0.05, -0.6);
    g.add(rand, kap, vloer);
    return g;
  }
  if (st.soort === "raam") {
    // de slaapkamer van binnen: een muur met een open raam waar je uit hangt. Oorsprong: op de vloer, midden onder het raam.
    const uit = 0.35, vloerY = st.pos[1] - 1.45;
    g.position.set(st.pos[0] - nx * uit, vloerY, st.pos[2] - nz * uit);
    g.rotation.y = Math.atan2(nx, nz);
    const muur = new THREE.MeshStandardMaterial({ color: "#d8d2c4", roughness: 1 }), hout = new THREE.MeshStandardMaterial({ color: "#f3f1ea", roughness: 0.6 });
    const doos = (b, h, d, x, y, z, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(b, h, d), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
    const B = 1.5, onder = 0.92, boven = 2.25; // de raamopening
    // een klein slaapkamertje: 2,7 m breed, 3 m diep. De muur met het raam staat een stukje achter de echte gevel
    // (van buiten zie je hem dus niet); de andere muren en het plafond zie je alleen van binnen.
    const KB = 2.7, KD = 3.0, KH = 2.5, z0 = -0.2;
    doos(KB, onder, 0.1, 0, onder / 2, z0, muur); doos(KB, KH - boven, 0.1, 0, (KH + boven) / 2, z0, muur);
    for (const k of [-1, 1]) doos((KB - B) / 2, boven - onder, 0.1, k * (B / 2 + (KB - B) / 4), (onder + boven) / 2, z0, muur);
    const behang = new THREE.MeshStandardMaterial({ color: "#cfd6d2", roughness: 1 }), wit = new THREE.MeshStandardMaterial({ color: "#eeeae2", roughness: 1 });
    const wand = (b, h, x, y, z, ry, rx, mat) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(b, h), mat); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); m.receiveShadow = true; g.add(m); return m; };
    wand(KD, KH, -KB / 2, KH / 2, z0 - KD / 2, Math.PI / 2, 0, behang); wand(KD, KH, KB / 2, KH / 2, z0 - KD / 2, -Math.PI / 2, 0, behang);
    wand(KB, KH, 0, KH / 2, z0 - KD, 0, 0, muur); wand(KB, KD, 0, KH, z0 - KD / 2, 0, Math.PI / 2, wit);
    // van buiten: een donker gat in de gevel (de kamer erachter). Van binnen kijk je er dwars doorheen.
    const gat = new THREE.Mesh(new THREE.PlaneGeometry(B, boven - onder), new THREE.MeshBasicMaterial({ color: "#15171a" }));
    gat.position.set(0, (onder + boven) / 2, 0.015); g.add(gat);
    // inrichting: eenpersoonsbed langs de linkermuur, nachtkastje, kledingkast, deur, radiator onder het raam, gordijnen
    const M_ = (kleur, ruw = 0.9) => new THREE.MeshStandardMaterial({ color: kleur, roughness: ruw });
    const eiken = M_("#b08d5f", 0.7), bx = -KB / 2 + 0.47;
    doos(0.92, 0.28, 2.02, bx, 0.14, z0 - KD + 1.03, eiken); doos(0.9, 0.2, 1.98, bx, 0.38, z0 - KD + 1.03, M_("#f1efe9"));
    doos(0.94, 0.12, 1.35, bx, 0.5, z0 - KD + 1.36, M_("#4f6f8f")); doos(0.6, 0.12, 0.4, bx, 0.52, z0 - KD + 0.3, M_("#fbfaf6"));
    doos(0.94, 0.75, 0.05, bx, 0.6, z0 - KD + 0.03, eiken); // hoofdbord
    doos(0.42, 0.5, 0.4, -KB / 2 + 0.22, 0.25, z0 - KD + 2.35, eiken); doos(0.12, 0.3, 0.12, -KB / 2 + 0.22, 0.65, z0 - KD + 2.35, M_("#e8d9a8")); // nachtkastje met lampje
    doos(0.95, 2.05, 0.58, KB / 2 - 0.5, 1.02, z0 - KD + 0.3, eiken); doos(0.02, 1.9, 0.01, KB / 2 - 0.5, 1.02, z0 - KD + 0.595, M_("#6f5636")); // kledingkast
    doos(0.85, 2.05, 0.04, 0.05, 1.02, z0 - KD + 0.02, M_("#f3f1ea", 0.6)); doos(0.12, 0.03, 0.05, 0.38, 1.05, z0 - KD + 0.06, M_("#8d9093", 0.4)); // deur met klink
    doos(1.2, 0.55, 0.1, 0, 0.42, z0 - 0.12, M_("#f4f2ec", 0.5)); // radiator
    for (const k of [-1, 1]) doos(0.3, boven - 0.15, 0.08, k * (B / 2 + 0.2), (boven + 0.15) / 2 + 0.05, z0 - 0.1, M_("#7d8c7a")); // gordijnen
    doos(B + 0.9, 0.04, 0.04, 0, boven + 0.12, z0 - 0.1, M_("#3a3a3a", 0.5));
    doos(1.5, 0.012, 1.0, 0.35, 0.006, z0 - 1.5, M_("#8a4a3c")); // vloerkleed
    wand(0.5, 0.7, KB / 2 - 0.004, 1.6, z0 - 1.9, -Math.PI / 2, 0, M_("#d7b24a")); // poster
    doos(0.3, 0.14, 0.3, 0, KH - 0.07, z0 - 1.5, M_("#f6f0dc", 0.4)); // plafondlamp
    doos(B + 0.16, 0.05, 0.3, 0, onder, 0.02, hout); // vensterbank
    for (const k of [-1, 1]) doos(0.06, boven - onder, 0.1, k * B / 2, (onder + boven) / 2, 0, hout);
    doos(B, 0.06, 0.1, 0, boven, 0, hout);
    doos(KB, 0.1, KD, 0, -0.05, z0 - KD / 2, new THREE.MeshStandardMaterial({ color: "#a58b68", roughness: 0.8 })); // laminaat
    // de twee raamvleugels staan naar buiten open
    const ruit = new THREE.MeshStandardMaterial({ color: "#9fb3bd", transparent: true, opacity: 0.3, roughness: 0.1 });
    for (const k of [-1, 1]) {
      const vleugel = new THREE.Group(); vleugel.position.set(k * B / 2, (onder + boven) / 2, 0.05); vleugel.rotation.y = -k * 1.25;
      const h = boven - onder - 0.06, b = B / 2;
      for (const [bx, hy, x, y] of [[b, 0.05, -k * b / 2, h / 2], [b, 0.05, -k * b / 2, -h / 2], [0.05, h, -k * b, 0], [0.05, h, 0, 0]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(bx, hy, 0.04), hout); m.position.set(x, y, 0); vleugel.add(m); }
      const gl = new THREE.Mesh(new THREE.BoxGeometry(b - 0.05, h - 0.05, 0.01), ruit); gl.position.set(-k * b / 2, 0, 0); vleugel.add(gl);
      g.add(vleugel);
    }
    return g;
  }
  const diep = st.soort === "diep" ? 1.6 : 0.9;
  g.position.set(st.pos[0] - nx * diep, st.pos[1] - 1.6, st.pos[2] - nz * diep);
  g.rotation.y = Math.atan2(nx, nz);
  if (diep > 1) g.scale.z = diep / 0.9;
  const glas = new THREE.MeshStandardMaterial({ color: "#9fb3bd", transparent: true, opacity: 0.25, roughness: 0.1 });
  const vloer = new THREE.Mesh(new THREE.BoxGeometry(5, 0.2, 1.2), beton);
  vloer.position.set(0, -0.1, 0.6);
  const rand = new THREE.Mesh(new THREE.BoxGeometry(5, 0.08, 0.1), new THREE.MeshStandardMaterial({ color: "#6d7175", metalness: 0.6, roughness: 0.4 }));
  rand.position.set(0, 1.05, 1.15);
  const ruit = new THREE.Mesh(new THREE.BoxGeometry(5, 0.9, 0.02), glas);
  ruit.position.set(0, 0.52, 1.15);
  const plaat = new THREE.Mesh(new THREE.BoxGeometry(5, 0.25, 0.12), beton);
  plaat.position.set(0, -0.12, 1.15);
  g.add(vloer, rand, ruit, plaat);
  return g;
}
/** Naar een andere standplaats: even het trappenhuis in (je kunt dan niet schieten). */
function wisselStand(richting) {
  const nr = standNr + richting;
  if (wisselt() || filmCam || nr < 0 || nr >= standen.length) return;
  wisselTot = performance.now() + 2000;
  zetZoom(1);
  const w = $("#wissel");
  w.classList.add("aan");
  geluid.stappen?.();
  setTimeout(() => zetStand(nr), 700);
  setTimeout(() => w.classList.remove("aan"), 1900);
}

// ---------- lopen: de straat op, zonder kijker (derde persoon) ----------
const loop = { aan: false, pos: new THREE.Vector3(), richting: 0, snelheid: 0, stick: { x: 0, y: 0 }, toets: {}, slag: 0, slagRaak: false, neer: 0, richt: 0, wapen: "pistool", keek: 0, vx: 0, vz: 0, pas: 0, sprint: false, mikken: false, doel: null, camDoel: new THREE.Vector3(), camAfst: 3.2, conditie: 3, wankel: 0, combo: 0, comboT: 0, herstel: 0 };
const WAPENS = ["pistool", "vuist", "mes", "knuppel"];
// de wapenkast: wat je bij het raam gekozen hebt (en mee naar buiten neemt), en hoeveel munitie er nog in zit
const kast = { keuze: "geweer", munitie: {}, mesh: {} };
const ZWAAR = new Set(["mg", "bazooka", "vlam"]), GOOI = new Set(["cobra", "granaat"]);
let vuurVast = false; // houd je de vuurknop ingedrukt (machinegeweer, vlammenwerper)
/** Het wapen waar de vuurknop nu op werkt. */
const huidigWapen = () => (loop.aan ? loop.wapen : loop.raamVuurwerk ? "vuurwerk" : kast.keuze);
let blokken = null; // gebouwen (met omhullende rechthoek) waar je niet doorheen kunt
let pistool = null, mes = null, knuppel = null;
let straat = null; // gezocht-niveau en missies (src/straat.js)
const zichtRay = new THREE.Raycaster();
/** Is er vrij zicht tussen twee mensen (op ooghoogte)? */
function zichtVrij(a, b) {
  const van = new THREE.Vector3(a.x, 1.6, a.z), naar = new THREE.Vector3(b.x - a.x, -0.2, b.z - a.z), d = naar.length();
  zichtRay.set(van, naar.normalize()); zichtRay.far = d - 0.3;
  return !zichtRay.intersectObjects(wereld.botsers, false).length;
}
function zetWapen(w) { loop.wapen = w; if (w !== "pistool") zetMikken(false); toonWapen(w); tekenHud(); }
function zetMikken(aan) { loop.mikken = aan && loop.wapen === "pistool"; document.body.classList.toggle("mikt", loop.mikken); }
/** Mikhulp: de band van de fatbike die het dichtst bij het kruisje staat (ruimer als je richt). */
function zoekDoel() {
  if (!opties.mikhulp) return null;
  const cd = richting(), grens = loop.mikken ? 0.22 : 0.11, kandidaten = [];
  for (const r of reizigers) {
    if (!r.fat || r.toestand !== "rijden") continue;
    for (const w of r.fiets.userData.wielen) {
      const p = w.getWorldPosition(new THREE.Vector3()), naar = p.clone().sub(camera.position), afst = naar.length();
      const hoek = Math.acos(THREE.MathUtils.clamp(naar.dot(cd) / afst, -1, 1));
      if (afst < 70 && hoek < grens) kandidaten.push({ hoek, p, r });
    }
  }
  // alleen een doel dat je vrij kunt raken: geen muur of muurtje tussen je pistool en de band
  kandidaten.sort((a, b) => a.hoek - b.hoek);
  const van = new THREE.Vector3(loop.aan ? loop.pos.x : oog.x, loop.aan ? 1.4 : oog.y, loop.aan ? loop.pos.z : oog.z);
  for (const k of kandidaten.slice(0, 4)) {
    const naar = k.p.clone().sub(van), afst = naar.length();
    ray.set(van, naar.normalize()); ray.far = afst - 0.25;
    if (ray.intersectObjects(wereld.botsers, false).length) continue;
    // ook geen auto, fiets of mens in de schootslijn (tot vlak voor de band)
    const tot = van.clone().lerp(k.p, 1 - 0.5 / afst);
    let vrij = true;
    for (const st of stil) if (st.object.position.distanceToSquared(van) < (afst + 6) ** 2 && raakObject(st.object, st.raak, van, tot)) { vrij = false; break; }
    if (vrij) for (const r of reizigers) if (r !== k.r && (!r.toestand || r.toestand === "rijden") && raakObject(r.object, r.raak, van, tot)) { vrij = false; break; }
    if (vrij) return k;
  }
  return null;
}
/** Wat je bij je hebt: gewoon pistool, vuisten en mes; in karatepak je vuisten en voeten, of een honkbalknuppel. */
const wapens = () => [...(karateka && loop.aan ? ["vuist", "knuppel", "vuurwerk"] : WAPENS), ...(ZWAAR.has(kast.keuze) || GOOI.has(kast.keuze) ? [kast.keuze] : [])];
// Klein vuurwerk (categorie 1: knetteren en vonken, geen schade): je gooit het voor de voeten van de hangjeugd.
const vuurwerk = [];
function gooi(soort = "vuurwerk") {
  const L = loop, knal = GOOI.has(soort);
  if (!L.aan || L.slag > 0 || L.neer > 0 || L.wankel > 0 || L.boeien > 0) return;
  if (knal) { if (!(kast.munitie[soort] > 0)) return; kast.munitie[soort]--; tekenHud(); }
  // naar het groepje waar je naar kijkt (anders een meter of acht voor je uit)
  const kx = Math.sin(kijk.yaw), kz = Math.cos(kijk.yaw);
  let doel = null, best = 0.75;
  for (const r of reizigers) {
    if (!r.ruzie || r.groep.visible === false) continue;
    const dx = r.pos.x - L.pos.x, dz = r.pos.z - L.pos.z, d = Math.hypot(dx, dz);
    if (d < 3 || d > 22) continue;
    const c = (dx * kx + dz * kz) / d + (r.hang ? 0.08 : 0);
    if (c > best) { best = c; doel = r.pos; }
  }
  let naar = doel ? new THREE.Vector3(doel.x - kx * 1.2, 0, doel.z - kz * 1.2) : new THREE.Vector3(L.pos.x + kx * 8, 0, L.pos.z + kz * 8);
  if (knal) { // waar het kruisje op staat, tussen 6 en 28 m (niet voor je eigen voeten)
    const p = richtPunt(), dx = p.x - L.pos.x, dz = p.z - L.pos.z, d = Math.hypot(dx, dz) || 1, r = THREE.MathUtils.clamp(d, 6, 28);
    naar = new THREE.Vector3(L.pos.x + (dx / d) * r, 0, L.pos.z + (dz / d) * r);
  }
  L.richting = Math.atan2(naar.x - L.pos.x, naar.z - L.pos.z);
  Object.assign(L, { slag: 0.95, slagRaakOp: -1, slagRaak: true, slagSoort: "vuurwerk", slagStraks: null, comboT: 0 });
  schutter.zet("gooien", 1.4, 0);
  geluid.sis();
  // het ding verlaat je hand halverwege de worp
  setTimeout(() => { if (loop.aan) lanceer(schutter.plek("DEF-handR").clone(), naar, soort); }, 330);
}
function lanceer(van, naar, soort = "vuurwerk") {
  const T = 0.55 + van.distanceTo(naar) * 0.035;
  // een echte granaat of cobra; het kleine vuurwerk is een rood kokertje
  const m = maakWerp(soort) ?? new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 8), new THREE.MeshStandardMaterial({ color: "#c0261d", emissive: "#ff7a1a", emissiveIntensity: 0.5 }));
  m.position.copy(van); scene.add(m);
  vuurwerk.push({ m, soort, v: new THREE.Vector3((naar.x - van.x) / T, (0.04 - van.y) / T + 4.9 * T, (naar.z - van.z) / T), knetter: -1, tik: 0 });
  geluid.zwiep(0.5);
}
/** Uit het raam: naar de plek waar het kruisje op staat (hoogstens 45 m ver). */
function gooiRaam(soort = "vuurwerk") {
  if (!spel.bezig || herlaad > 0 || filmCam || wisselt()) return;
  if (GOOI.has(soort)) { if (!(kast.munitie[soort] > 0)) return; kast.munitie[soort]--; tekenHud(); }
  herlaad = 0.9;
  const p = richtPunt(), dx = p.x - oog.x, dz = p.z - oog.z, d = Math.hypot(dx, dz) || 1, r = Math.min(d, 45);
  const fx = Math.sin(kijk.yaw), fz = Math.cos(kijk.yaw);
  geluid.sis();
  lanceer(new THREE.Vector3(oog.x + fx * 0.5, oog.y - 0.1, oog.z + fz * 0.5), new THREE.Vector3(oog.x + (dx / d) * r, 0, oog.z + (dz / d) * r), soort);
}
/** Bij het raam (in het level met vuurwerk): wisselen tussen het geweer en vuurwerk. */
function toonWapen(w) { for (const el of document.querySelectorAll("#wapen svg")) el.style.display = el.dataset.w === w ? "" : "none"; }
function stapVuurwerk(dt) {
  for (const w of [...vuurwerk]) {
    if (w.knetter < 0) {
      // door de lucht, met een vonkenspoor
      w.v.y -= 9.8 * dt; w.m.position.addScaledVector(w.v, dt); w.m.rotation.x += dt * 9; w.m.rotation.z += dt * 6;
      if (Math.random() < dt * 25) fx.vonken(w.m.position);
      if (w.m.position.y <= 0.05 && GOOI.has(w.soort)) {
        // een cobra of handgranaat: blijft liggen, de lont sist, en dan de knal
        w.m.position.y = 0.05; w.knetter = WAPENKAST[w.soort].lont; w.lont = true; geluid.sis();
        for (const r of reizigers) if (Math.hypot(r.pos.x - w.m.position.x, r.pos.z - w.m.position.z) < 6) r.schrikken?.(); // wie het ziet liggen, rent
      } else if (w.m.position.y <= 0.05) {
        w.m.position.y = 0.05; w.knetter = 2.2; w.m.rotation.set(Math.PI / 2, 0, 0);
        // iedereen in de buurt schrikt en maakt dat hij wegkomt; wie met je vocht houdt ermee op
        const p = w.m.position;
        for (const r of reizigers) {
          if (Math.hypot(r.pos.x - p.x, r.pos.z - p.z) > 7.5 || r.soort === "agent") continue;
          if (r.ruzie && !(r.ruzieNeer > 0)) { r.ruzieT = 0; r.ruzieKoel = 20; }
          if (r.hang) r.richting = Math.atan2(r.pos.x - p.x, r.pos.z - p.z) + Math.PI + tussen(-0.8, 0.8); // hangjeugd rent van de knallen af (schrikken draait hem om)
          r.schrikken?.();
        }
        straat.strafbaar(0.25);
      }
    } else if (w.lont) {
      w.knetter -= dt; if (Math.random() < dt * 20) fx.vonken(w.m.position);
      if (w.knetter <= 0) { scene.remove(w.m); vuurwerk.splice(vuurwerk.indexOf(w), 1); ontplof(w.m.position.clone().setY(0.3), WAPENKAST[w.soort].straal, w.soort === "cobra"); }
    } else {
      // knetteren op de grond
      w.knetter -= dt; w.tik -= dt;
      if (w.tik <= 0) { w.tik = 0.06 + Math.random() * 0.16; geluid.knal(afstandVol(w.m.position) * (0.6 + Math.random() * 0.4)); fx.vonken(w.m.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.05, (Math.random() - 0.5) * 0.5))); }
      if (w.knetter <= 0) { scene.remove(w.m); vuurwerk.splice(vuurwerk.indexOf(w), 1); }
    }
  }
}
function volgendWapen() { const w = wapens(); zetWapen(w[(w.indexOf(loop.wapen) + 1) % w.length]); }
/** De actieknop: bij je raam schieten met het geweer; lopend het wapen dat je in je hand hebt. */
function actie() {
  if (loop.boeien > 0) return;
  if (!loop.aan && loop.raamVuurwerk && karateka) return gooiRaam();
  if (rij.aan) return geluid.toeter(1); // in de auto: de claxon
  const hw = huidigWapen();
  if (hw === "mg") return vuurMg();
  if (hw === "bazooka") return vuurRaket();
  if (hw === "vlam") return; // vasthouden: zie de hoofdlus
  if (GOOI.has(hw)) return loop.aan ? gooi(hw) : gooiRaam(hw);
  if (!loop.aan || loop.wapen === "pistool") return schiet();
  if (loop.wapen === "vuurwerk") return gooi();
  sla(loop.wapen);
}
function zetLopen(aan, gedwongen = false) {
  if (!gedwongen && (wisselt() || filmCam || !spel.bezig)) return;
  if (!aan && rij.aan) { if (!gedwongen) return; stapUitGedwongen(); } // eerst uitstappen (aangehouden: ze halen je eruit)
  // je kunt niet naar binnen glippen terwijl ze je zien
  if (!aan && !gedwongen && straat && !straat.magNaarBinnen()) {
    const el = $("#sterren"); el.classList.remove("schud"); void el.offsetWidth; el.classList.add("schud");
    return geluid.fout();
  }
  wisselTot = performance.now() + 1500;
  $("#wissel").classList.add("aan");
  geluid.stappen?.();
  setTimeout(() => {
    loop.aan = aan;
    document.body.classList.toggle("loopt", aan);
    if (karateka && aan) zetWapen("vuist");
    if (!aan) toonWapen(loop.raamVuurwerk ? "vuurwerk" : kast.keuze === "geweer" ? "pistool" : kast.keuze);
    else if (!wapens().includes(loop.wapen)) zetWapen(wapens()[0]);
    zetZoom(1);
    if (aan) {
      // begin op het dichtstbijzijnde voetpad bij je standplaats
      const st = standen[standNr], n = graaf.dichtbij(st.pos[0], st.pos[2], 4);
      loop.pos.set(graaf.k[n][0], 0, graaf.k[n][1]);
      // sta je toevallig klem (heg, muur, auto), schuif dan naar de dichtstbijzijnde vrije plek
      for (let r = 0.5; r < 8 && geblokkeerd(loop.pos.x, loop.pos.z); r += 0.5) for (let h = 0; h < 6.3; h += 0.5) {
        const x = graaf.k[n][0] + Math.cos(h) * r, z = graaf.k[n][1] + Math.sin(h) * r;
        if (!geblokkeerd(x, z)) { loop.pos.set(x, 0, z); break; }
      }
      loop.richting = kijk.yaw; kijk.pitch = -0.12;
      Object.assign(loop, { slag: 0, neer: 0, richt: 0, snelheid: 0, vx: 0, vz: 0, sprint: false, camAfst: 3.2 });
      loop.camDoel.set(loop.pos.x, 1.65, loop.pos.z);
      zetMikken(false);
    } else { zetStand(standNr); straat?.reset(); }
  }, 600);
  setTimeout(() => $("#wissel").classList.remove("aan"), 1300);
}
const inRing = (x, z, r) => {
  let i = false;
  for (let a = 0, b = r.length - 1; a < r.length; b = a++) {
    const [xi, zi] = r[a], [xj, zj] = r[b];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) i = !i;
  }
  return i;
};
const lok = new THREE.Vector3();
/** Kun je hier niet staan? Gebouwen, muurtjes en geparkeerde auto's houden je tegen. */
/** Staat dit punt in een gebouw (of binnen r meter van een gevel)? */
function inGebouw(x, z, r = 0) {
  for (const b of blokken) {
    if (x < b.x0 - r || x > b.x1 + r || z < b.z0 - r || z > b.z1 + r) continue;
    if (inRing(x, z, b.r)) return true;
    if (r > 0) for (let i = 0, j = b.r.length - 1; i < b.r.length; j = i++) {
      const [ax, az] = b.r[j], [bx, bz] = b.r[i], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
      if ((x - ax - dx * t) ** 2 + (z - az - dz * t) ** 2 < r * r) return true;
    }
  }
  return false;
}
let hegVlak = [], hegLijn = [];
/** Staat dit punt in een heg of perk (of binnen r meter ervan)? */
function inHeg(x, z, r = 0) {
  for (const b of hegVlak) if (x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r && inRing(x, z, b.r)) return true;
  for (const l of hegLijn) for (let i = 0; i < l.length - 1; i++) {
    const [a, b] = [l[i], l[i + 1]], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2));
    if ((x - a[0] - dx * t) ** 2 + (z - a[1] - dz * t) ** 2 < (0.45 + r) ** 2) return true;
  }
  return false;
}
// Geparkeerde auto's in vakken van 6 m, zodat we alleen de auto's in de buurt hoeven na te lopen.
let autoRooster = null, autoRoosterN = -1;
const verlaten = []; // auto's die jij ergens hebt laten staan (het verkeer rijdt eromheen)
function autosBij(x, z) {
  if (!autoRooster || autoRoosterN !== stil.length) {
    autoRooster = new Map(); autoRoosterN = stil.length;
    for (const st of stil) {
      if (st.soort !== "auto") continue;
      const o = st.object, k = (Math.floor(o.position.x / 6) + 512) * 1024 + Math.floor(o.position.z / 6) + 512;
      (autoRooster.get(k) ?? autoRooster.set(k, []).get(k)).push(o);
    }
  }
  const uit = [], ix = Math.floor(x / 6) + 512, iz = Math.floor(z / 6) + 512;
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = autoRooster.get((ix + a) * 1024 + iz + b); if (l) uit.push(...l); }
  return uit;
}
/** Staat dit punt in een auto (met marge opzij en in de lengte)? Geeft dan de kortste stap naar buiten, anders null. */
function uitRechthoek(o, x, z, mb, ml) {
  const dx = x - o.position.x, dz = z - o.position.z;
  if (dx * dx + dz * dz > 16) return null;
  const c = Math.cos(o.rotation.y), sn = Math.sin(o.rotation.y), lx = dx * c - dz * sn, lz = dx * sn + dz * c;
  const px = o.userData.B / 2 + mb - Math.abs(lx), pz = o.userData.L / 2 + ml - Math.abs(lz);
  if (px <= 0 || pz <= 0) return null;
  const ux = px < pz ? (lx < 0 ? -px : px) : 0, uz = px < pz ? 0 : lz < 0 ? -pz : pz;
  return [ux * c + uz * sn, -ux * sn + uz * c];
}
function uitAuto(x, z, mb = 0.3, ml = mb) {
  for (const o of autosBij(x, z)) { const u = uitRechthoek(o, x, z, mb, ml); if (u) return u; }
  return null;
}
// schuttingen in vakken van 8 m (er zijn er honderden)
let schutRooster = null;
function schuttingBij(x, z) {
  if (!data.schuttingen?.length) return [];
  if (!schutRooster) {
    schutRooster = new Map();
    for (const sg of data.schuttingen) {
      const n = Math.ceil(Math.hypot(sg[2] - sg[0], sg[3] - sg[1]) / 4) + 1, gezien = new Set();
      for (let i = 0; i <= n; i++) { const k = (Math.floor((sg[0] + ((sg[2] - sg[0]) * i) / n) / 8) + 512) * 1024 + Math.floor((sg[1] + ((sg[3] - sg[1]) * i) / n) / 8) + 512; if (!gezien.has(k)) { gezien.add(k); (schutRooster.get(k) ?? schutRooster.set(k, []).get(k)).push(sg); } }
    }
  }
  const uit = [], ix = Math.floor(x / 8) + 512, iz = Math.floor(z / 8) + 512;
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = schutRooster.get((ix + a) * 1024 + iz + b); if (l) uit.push(...l); }
  return uit;
}
function geblokkeerd(x, z) {
  if (inGebouw(x, z, 0.45)) return true; // je bent zelf ook breed: niet half de muur in
  if (inHeg(x, z, 0.15)) return true; // door een heg loop je niet heen
  for (const [bx, bz] of wereld.bomen) if ((x - bx) ** 2 + (z - bz) ** 2 < 0.3) return true; // boomstammen
  for (const [rx, rz, rr] of wereld.rond) if ((x - rx) ** 2 + (z - rz) ** 2 < rr * rr) return true; // speeltoestel
  // schuttingen, tuinheggen en hekken
  for (const [ax, az, bx, bz, soort] of schuttingBij(x, z)) {
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
    if (Math.hypot(x - ax - dx * t, z - az - dz * t) < (soort === "heg" ? 0.6 : 0.4)) return true;
  }
  for (const m of data.muurtjes ?? []) for (let i = 0; i < m.length - 1; i++) {
    const [a, b] = [m[i], m[i + 1]], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2));
    if (Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) < 0.5) return true;
  }
  return !!uitAuto(x, z, 0.3);
}
// ---------- autorijden: je eigen auto (de RAV4) of een gestolen auto ----------
/** Uit de auto gehaald (aangehouden) of een nieuwe ronde: de auto blijft staan. */
function stapUitGedwongen() {
  if (!rij.aan) return;
  const a = rij.auto;
  stil.push({ object: a, raak: a.userData.raak, soort: "auto" }); verlaten.push(a); autoRooster = null;
  rij.aan = false; rij.auto = null; rij.v = 0; rij.gas = rij.rem = false;
  geluid.motor(false); geluid.banden(0); document.body.classList.remove("rijdt");
}
const rij = { aan: false, auto: null, v: 0, stuur: 0, richting: 0, kans: null, instapT: 0, botsT: 0 };
/** De auto waar je naast staat (binnen een paar meter), als je kunt instappen. */
function autoBij() {
  let best = null;
  for (const st of stil) {
    if (st.soort !== "auto") continue;
    const d = Math.hypot(st.object.position.x - loop.pos.x, st.object.position.z - loop.pos.z);
    if (d < 3.4 && (!best || d < best.d)) best = { st, d };
  }
  return best?.st ?? null;
}
/** Instappen. Je eigen auto gaat gewoon open; bij een andere sla je de ruit in (lawaai, alarm, strafbaar). */
function stapIn() {
  const st = rij.kans;
  if (!st || rij.aan || rij.instapT > 0 || loop.neer > 0 || loop.slag > 0) return;
  const u = st.object.userData, eigen = u.soort === "rav4";
  if (eigen) geluid.slot();
  else if (!u.open) {
    // de ruit in: een klap met de elleboog, glas, alarm
    loop.slag = 0.6; loop.slagRaak = true; loop.richting = Math.atan2(st.object.position.x - loop.pos.x, st.object.position.z - loop.pos.z);
    schutter.zet("stomp", 1.25, 0);
    setTimeout(() => { geluid.glas(); geluid.alarm(0.9); fx.inslag(new THREE.Vector3(loop.pos.x, 1.2, loop.pos.z).lerp(st.object.position.clone().setY(1.2), 0.6), "#dfe9f0"); }, 300);
    straat.strafbaar(0.8);
  }
  rij.instapT = eigen || u.open ? 0.35 : 1.1;
  rij.straks = st;
}
function echtInstappen(st) {
  // een geparkeerde auto is een getekende kopie: die verdwijnt, en er komt een echte, rijdende auto voor in de plaats
  let auto = st.object;
  if (!auto.userData.wielen) {
    auto = maakAuto({ soort: st.object.userData.soort, kleur: st.object.userData.kleur });
    auto.position.copy(st.object.position); auto.rotation.y = st.object.rotation.y;
    st.object.userData.weg = true; wereld.autosOpnieuw();
    wereld.geparkeerd.splice(wereld.geparkeerd.indexOf(st.object), 1);
    scene.add(auto);
  }
  auto.userData.open = true;
  stil.splice(stil.indexOf(st), 1); autoRooster = null;
  if (verlaten.includes(auto)) verlaten.splice(verlaten.indexOf(auto), 1);
  geluid.deur();
  Object.assign(rij, { aan: true, auto, v: 0, stuur: 0, richting: auto.rotation.y, kans: null });
  zetMikken(false);
  document.body.classList.add("rijdt");
  kijk.pitch = -0.18;
}
/** Uitstappen: naast de auto; de auto blijft staan waar je hem laat. */
function stapUit() {
  if (!rij.aan) return;
  const a = rij.auto, u = a.userData, c = Math.cos(rij.richting), s = Math.sin(rij.richting);
  // links van de auto, anders rechts, anders erachter
  let plek = null;
  for (const [zij, langs] of [[1, 0], [-1, 0], [0, -1], [0, 1], [1, -1], [-1, -1]]) {
    const x = a.position.x + c * zij * (u.B / 2 + 0.9) + s * langs * (u.L / 2 + 1), z = a.position.z - s * zij * (u.B / 2 + 0.9) + c * langs * (u.L / 2 + 1);
    if (!geblokkeerd(x, z)) { plek = [x, z]; break; }
  }
  if (!plek) return; // klem: eerst een stukje rijden
  stil.push({ object: a, raak: u.raak, soort: "auto" }); verlaten.push(a); autoRooster = null;
  rij.aan = false; rij.auto = null; rij.v = 0; rij.gas = rij.rem = false;
  geluid.motor(false); geluid.banden(0); geluid.deur();
  document.body.classList.remove("rijdt");
  loop.pos.set(plek[0], 0, plek[1]); loop.vx = loop.vz = 0; loop.richting = rij.richting;
  loop.camDoel.set(loop.pos.x, 1.65, loop.pos.z);
}
function stapRijden(dt) {
  const a = rij.auto, u = a.userData, L = loop;
  // zoals GTA op de telefoon: links sturen, rechts een gaspedaal en een rem (die ook achteruit is). Toetsen: W A S D.
  const gas = THREE.MathUtils.clamp((rij.gas ? 1 : 0) - (rij.rem ? 1 : 0) + (L.toets.KeyW ? 1 : 0) - (L.toets.KeyS ? 1 : 0), -1, 1);
  let sx = THREE.MathUtils.clamp(L.stick.x * 1.25 + (L.toets.KeyD ? 1 : 0) - (L.toets.KeyA ? 1 : 0), -1, 1);
  sx *= 0.4 + 0.6 * Math.abs(sx); // rond het midden fijn: een klein tikje is een klein beetje sturen
  const top = u.soort === "bus" ? 11 : 14; // m/s: 40 tot 50 km/u, het is een woonwijk
  const snel0 = Math.abs(rij.v);
  if (gas > 0.05) rij.v += gas * (rij.v < -0.3 ? 12 : 5.4 * (1 - 0.5 * Math.max(0, rij.v) / top)) * dt; // trekt het hardst op vanuit stilstand
  else if (gas < -0.05) rij.v += gas * (rij.v > 0.3 ? 13 : 3.4) * dt;
  else rij.v -= Math.sign(rij.v) * Math.min(snel0, 1.7 * dt); // uitrollen
  rij.v = THREE.MathUtils.clamp(rij.v, -5, top);
  // sturen: het stuur draait soepel, en hoe harder je rijdt, hoe minder ver het gaat (zoveel als de banden houden)
  const asAfstand = u.L * 0.6, maxHoek = Math.min(0.58, Math.atan((6.8 * asAfstand) / Math.max(1, rij.v * rij.v)));
  const doelHoek = sx * maxHoek, tempo = (Math.abs(doelHoek) < Math.abs(rij.stuur) ? 3.4 : 2) * dt; // terug naar het midden gaat vlot
  rij.stuur += THREE.MathUtils.clamp(doelHoek - rij.stuur, -tempo, tempo);
  // piepende banden: vol sturen op snelheid, of hard remmen
  const remt = gas < -0.05 && rij.v > 4, slip = Math.max(Math.abs(sx) > 0.85 && snel0 > 7 ? (snel0 - 7) / 7 : 0, remt ? Math.min(1, rij.v / 10) : 0);
  geluid.banden(slip);
  const oudeRichting = rij.richting, ox = a.position.x, oz = a.position.z;
  rij.richting -= (rij.v * Math.tan(rij.stuur)) / asAfstand * dt;
  const fx = Math.sin(rij.richting), fz = Math.cos(rij.richting);
  const nx = ox + fx * rij.v * dt, nz = oz + fz * rij.v * dt;
  // botsen: de hoeken en het midden van de neus (of de achterkant als je achteruit rijdt), en de flanken
  const hb = u.B / 2 - 0.15, hl = u.L / 2 - 0.25, kant = rij.v >= 0 ? 1 : -1;
  const punten = [[hb, hl * kant], [-hb, hl * kant], [0, hl * kant], [hb, 0], [-hb, 0]]; // links voor, rechts voor, midden, links, rechts
  const raakt = (x0, z0, r) => {
    const rx = Math.sin(r), rz = Math.cos(r);
    let m = 0;
    punten.forEach(([px, pz], i) => { const x = x0 + rz * px + rx * pz, z = z0 - rx * px + rz * pz; if (inGebouw(x, z, 0.1) || inHeg(x, z) || geblokkeerdDoorDing(x, z)) m |= 1 << i; });
    return m;
  };
  // zit er al een auto tegen je aan (hij reed op je in), dan kun je altijd nog wegrijden
  rij.door = false; rij.tegen = null;
  if (raakt(ox, oz, oudeRichting)) rij.door = true;
  rij.tegen = null;
  const m = raakt(nx, nz, rij.richting);
  rij.masker = m;
  if (!m) a.position.set(nx, 0, nz);
  else {
    const links = m & 9, rechts = m & 18;
    let los = false;
    if (kant > 0 && !links !== !rechts) {
      // schampen: de neus draait weg van wat je raakt (niet verder dan nodig) en je schuift erlangs, in plaats van stil te vallen
      const max = Math.min(2.2, 0.4 * snel0);
      zoek: for (const deel of [0.8, 0.35, 0, -0.5]) for (const draai of [0.3, 0.6, 1]) {
        const r2 = oudeRichting + (links ? -1 : 1) * max * draai * dt, x2 = ox + Math.sin(r2) * rij.v * dt * deel, z2 = oz + Math.cos(r2) * rij.v * dt * deel;
        if (raakt(x2, z2, r2)) continue;
        los = true; rij.richting = r2; a.position.set(x2, 0, z2); rij.v *= Math.exp(-dt * (deel > 0 ? 1.3 : 4));
        if (snel0 > 3 && rij.botsT <= 0) { geluid.schuur(Math.min(1, snel0 / 9)); rij.botsT = 0.3; if (rij.tegen) { geluid.toeter(1); straat.strafbaar(0.2); } }
        break zoek;
      }
      if (snel0 < 0.8) los = false; // bijna stil: dan sta je er gewoon tegenaan
    }
    if (!los) {
      if (snel0 > 1.8 && rij.botsT <= 0) {
        geluid.botsing(Math.min(1, snel0 / 10)); rij.botsT = 0.5;
        if (snel0 > 5) { $("#hud").classList.remove("schud"); void $("#hud").offsetWidth; $("#hud").classList.add("schud"); terugslag = Math.min(1.5, snel0 / 6); }
        // tegen een rijdende auto: die toetert, staat even stil, en het telt als aanrijding
        if (rij.tegen) { geluid.toeter(1); rij.tegen.wacht = Math.max(rij.tegen.wacht, 1.5); straat.strafbaar(0.3); }
      }
      rij.v *= -0.18; rij.richting = oudeRichting;
    }
  }
  rij.botsT -= dt;
  a.rotation.y = rij.richting;
  for (const w of u.wielen) { w.rotation.x += (rij.v * dt) / u.straal; if (w.userData.voor) w.rotation.y = -rij.stuur; }
  // wat je raakt: mensen springen opzij, fatbikes gaan onderuit, verkeer en agenten merken het
  const snel = Math.abs(rij.v);
  if (snel > 1.5) for (const r of [...reizigers]) {
    const dx = r.pos.x - a.position.x, dz = r.pos.z - a.position.z;
    const voor = (dx * fx + dz * fz) * kant, zij = Math.abs(dx * fz - dz * fx);
    if (voor < -1 || voor > hl + 3.5 || zij > hb + 1.2) continue;
    const raak = voor < hl + 0.7 && zij < hb + 0.3;
    if (r.fat && r.toestand === "rijden") { if (raak) fatbikeGeraakt(r, "klap", r.pos.clone().setY(0.8)); }
    else if (r.soort === "agent") { if (raak && !r.afdruipen && r.duwT <= 0) { r.duw(); straat.strafbaar(1); } }
    else if (r.wordBoos) continue; // auto's: daar bots je tegen (zie hierboven)
    else if (r.ruzie) {
      // voetgangers zien je komen en maken dat ze wegkomen; scheer je vlak langs ze, dan telt dat
      r.schrikken?.();
      if (raak && !(r.bijnaT > performance.now())) { r.bijnaT = performance.now() + 4000; straat.strafbaar(0.5); geluid.toeter(0.6); }
    } else if (r.fiets && raak && !(r.bijnaT > performance.now())) { r.bijnaT = performance.now() + 4000; r.wacht = 3; straat.strafbaar(0.4); }
  }
  geluid.motor(true, rij.v, Math.abs(gas));
  L.pos.set(a.position.x, 0, a.position.z); L.richting = rij.richting; L.snelheid = snel;
  oog.set(L.pos.x, 1.3, L.pos.z);
  // de camera draait achter de auto aan (achteruit rijdend kijk je achterom), tenzij je net zelf hebt rondgekeken
  if (performance.now() - L.keek > 1200 && snel > 0.6) {
    let c = rij.richting - rij.stuur * 0.35 + (rij.v < -0.6 ? Math.PI : 0) - kijk.yaw; c = Math.atan2(Math.sin(c), Math.cos(c)); // je kijkt iets de bocht in
    kijk.yaw += c * Math.min(1, dt * 3.6);
  }
}
/** Bomen, muurtjes en andere auto's (voor het rijden; gebouwen en heggen apart). */
function geblokkeerdDoorDing(x, z) {
  for (const [bx, bz] of wereld.bomen) if ((x - bx) ** 2 + (z - bz) ** 2 < 0.2) return true;
  for (const m of data.muurtjes ?? []) for (let i = 0; i < m.length - 1; i++) {
    const [p, q] = [m[i], m[i + 1]], dx = q[0] - p[0], dz = q[1] - p[1], L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - p[0]) * dx + (z - p[1]) * dz) / L2));
    if (Math.hypot(x - p[0] - dx * t, z - p[1] - dz * t) < 0.25) return true;
  }
  if (uitAuto(x, z, -0.12, -0.25)) return true; // iets krap: uitparkeren moet te doen zijn
  // rijdend verkeer is net zo hard als een geparkeerde auto
  if (!rij.door) for (const r of reizigers) if (r.wordBoos && uitRechthoek(r.auto, x, z, 0, 0)) { rij.tegen = r; return true; }
  return false;
}

/** Aangehouden: de agent komt achter je staan en slaat je in de boeien. Daarna word je afgevoerd (terug naar je raam). */
let boeiMesh = null;
function arresteer(agent) {
  const L = loop;
  if (!L.aan || L.boeien > 0 || !agent) return;
  if (rij.aan) stapUitGedwongen();
  Object.assign(L, { boeien: 3.6, neer: 0, slag: 0, wankel: 0, vx: 0, vz: 0, snelheid: 0, slagStraks: null });
  zetMikken(false);
  const fx = Math.sin(L.richting), fz = Math.cos(L.richting);
  agent.boeit = true; agent.ruzieT = 0; agent.pos.set(L.pos.x - fx * 0.62, 0, L.pos.z - fz * 0.62); agent.richting = L.richting;
  schutter.zet("staan", 1, 0);
  geluid.boeien();
  if (!boeiMesh) {
    boeiMesh = new THREE.Group();
    const staal = new THREE.MeshStandardMaterial({ color: "#b9bdc2", metalness: 0.9, roughness: 0.3 });
    for (const k of [-1, 1]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.008, 6, 14), staal); r.position.x = k * 0.05; r.rotation.y = Math.PI / 2; boeiMesh.add(r); }
    scene.add(boeiMesh);
  }
}
/**
 * Je krijgt een klap. Van iemand met wie je vecht (wie) wankel je eerst; pas na een paar klappen ga je neer.
 * Zonder wie (een auto die je schept) lig je meteen. Je krabbelt altijd weer op.
 */
function klapKrijgen(wie = null) {
  if (loop.neer > 0 || !loop.aan || rij.aan || loop.boeien > 0) return; // in de auto zit je veilig
  if (wie?.pos && loop.veilig > 0) return; // net geraakt: je krijgt even de tijd om terug te komen
  // karate: sta je stil in kamae (je slaat of loopt niet), dan blok je de klap
  if (wie?.pos && (karateka && loop.aan) && loop.slag <= 0 && loop.wankel <= 0 && loop.snelheid < 0.4) {
    loop.veilig = 0.7; loop.richting = Math.atan2(wie.pos.x - loop.pos.x, wie.pos.z - loop.pos.z);
    Object.assign(loop, { slag: 0.45, slagRaakOp: -1, slagRaak: true, slagSoort: "blok", slagStraks: null, comboT: 0 });
    schutter.zet(Math.random() < 0.5 ? "k_block" : "k_gedan_barai", 2.2, 0.12);
    geluid.tik(1); geluid.zwiep(0.4);
    return;
  }
  loop.veilig = 1.1;
  loop.conditie -= 1; loop.herstel = 5;
  loop.slag = 0; loop.slagStraks = null; loop.comboT = 0;
  geluid.stomp(1); geluid.oef(1);
  terugslag = 1.4;
  $("#hud").classList.remove("schud"); void $("#hud").offsetWidth; $("#hud").classList.add("schud");
  if (!wie?.pos || loop.conditie <= 0) {
    loop.conditie = 3; loop.neer = 3.3; loop.wankel = 0;
    schutter.zet("liggen", 1, 0);
    geluid.klap(1);
    melding("fout");
    return;
  }
  // wankelen: een stap achteruit, even niets kunnen
  loop.wankel = 0.45;
  schutter.zet("klapHoofd", 1, 0);
  const dx = loop.pos.x - wie.pos.x, dz = loop.pos.z - wie.pos.z, d = Math.hypot(dx, dz) || 1;
  loop.vx = (dx / d) * 2.8; loop.vz = (dz / d) * 2.8;
}
// de reeks met je vuisten: twee snelle (links, rechts) en dan een zware die iemand omver slaat
const SLAGEN = [["jab", 0.4, 0.2, 1.7], ["stomp", 0.46, 0.22, 1.75], ["stomp", 0.8, 0.36, 1.05]]; // beweging, duur, moment van raken, tempo
/** Wie of wat je raakt als je nu uithaalt: wie al met je vecht gaat voor, verder wat dichtbij is en waar je naar kijkt. */
function slagDoel() {
  const kx = Math.sin(kijk.yaw), kz = Math.cos(kijk.yaw);
  let best = null;
  for (const r of reizigers) {
    const bereik = r.fat ? (r.toestand === "rijden" ? 3 : 0) : r.wordBoos ? 3.2 : r.soort === "agent" ? (r.afdruipen || r.ruzieNeer > 0 ? 0 : 2.2) : r.ruzie && r.groep.visible !== false && !(r.ruzieNeer > 0) ? 2.5 : 0;
    if (!bereik) continue;
    const dx = r.pos.x - loop.pos.x, dz = r.pos.z - loop.pos.z, d = Math.hypot(dx, dz) || 1e-3;
    if (d > bereik) continue;
    const maat = d - (r.ruzieT > 0 ? 1.5 : 0) - ((dx * kx + dz * kz) / d) * 0.9 - (r.fat ? 0.6 : 0);
    if (!best || maat < best.maat) best = { r, maat, d, dx, dz };
  }
  return best;
}
/** Uithalen met de vuist (fatbiker van zijn fiets, of vechten) of met het mes (band lek steken). */
function sla(soort = "vuist") {
  if (!loop.aan || loop.neer > 0 || loop.wankel > 0 || loop.boeien > 0) return;
  if (loop.slag > 0) { loop.slagStraks = soort; return; } // tik je door, dan volgt de volgende klap meteen
  const karate = (karateka && loop.aan) && soort !== "mes" && soort !== "knuppel";
  let nr, beweging, duur, raak, tempo, zwaar, ver = 0.95;
  if (karate) {
    // karate: stoten en trappen uit het vechtspel van de dojo, in een vaste volgorde
    const lijst = soort === "trap" ? TRAPPEN : STOTEN;
    nr = loop.comboT > 0 ? loop.combo + 1 : 0;
    const naam = lijst[nr % lijst.length], t = TECHNIEK[naam];
    tempo = 1.35; beweging = `k_${naam}`; duur = t.duur / tempo; raak = t.raak / tempo; zwaar = t.zwaar; if (t.trap) ver = 1.2;
    if (zwaar) geluid.kiai();
  } else {
    nr = soort !== "mes" && loop.comboT > 0 ? (loop.combo + 1) % 3 : 0;
    [beweging, duur, raak, tempo] = soort === "mes" ? ["jab", 0.5, 0.24, 1.4] : soort === "knuppel" ? ["zwaai", 0.75, 0.36, 1.25] : SLAGEN[nr];
    zwaar = nr === 2;
    if (soort === "knuppel") { nr = 0; ver = 1.35; }
  }
  Object.assign(loop, { slag: duur, slagRaakOp: duur - raak, slagRaak: false, slagSoort: soort === "mes" || soort === "knuppel" ? soort : "vuist", slagZwaar: zwaar, combo: nr, slagStraks: null });
  // je draait vanzelf naar je tegenstander en doet een stap in, zodat je klap aankomt
  const doel = slagDoel();
  loop.doelwit = doel?.r ?? null;
  if (doel) {
    loop.richting = Math.atan2(doel.dx, doel.dz);
    if (doel.d > ver + 0.1 && !doel.r.wordBoos) { const v = Math.min(3.8, (doel.d - ver) * 9); loop.vx = (doel.dx / doel.d) * v; loop.vz = (doel.dz / doel.d) * v; }
  } else loop.richting = kijk.yaw;
  schutter.zet(beweging, tempo, 0);
  geluid.zwiep(zwaar ? 1 : 0.6);
}
/** Je vuist komt aan bij een voetganger. */
function raakMens(wie, zwaar) {
  const eerste = !(wie.ruzieT > 0);
  if (!wie.ruzie(loop.pos, false, klapKrijgen, true, zwaar)) return;
  geluid.stomp(zwaar ? 1 : 0.7); geluid.oef(0.6);
  fx.inslag(new THREE.Vector3(wie.pos.x, 1.5, wie.pos.z).lerp(new THREE.Vector3(loop.pos.x, 1.5, loop.pos.z), 0.25), "#f1ece2");
  if (zwaar) terugslag = 0.7;
  straat.strafbaar(eerste ? 0.6 : 0.15);
  wie.zwiep = () => geluid.zwiep(0.5);
  // wie het ziet gebeuren, maakt zich uit de voeten
  // hangjeugd rent niet weg: een paar vrienden komen erbij
  let erbij = reizigers.filter((r) => r.hang && r !== wie && r.ruzieT > 0).length + 1; // hoogstens drie tegelijk tegen je
  for (const r of reizigers) {
    if (r === wie || !r.ruzie || r.ruzieT > 0 || r.pos.distanceTo(loop.pos) > 9) continue;
    if (r.hang && wie.hang) { if (erbij < 3 && r.vechter && r.ruzie(loop.pos, true, klapKrijgen)) { erbij++; r.zwiep = () => geluid.zwiep(0.5); } }
    else r.schrikken?.();
  }
}
function stapLopen(dt) {
  const L = loop;
  if (L.boeien > 0) {
    // in de boeien: je staat stil terwijl de camera om je heen draait; daarna word je afgevoerd
    L.boeien -= dt; L.snelheid = L.vx = L.vz = 0;
    kijk.yaw += dt * 0.75; L.keek = performance.now();
    if (L.boeien <= 0) { L.boeien = 0; for (const r of reizigers) if (r.boeit) r.boeit = false; if (boeiMesh) boeiMesh.visible = false; straat.aangehouden(); }
    oog.set(L.pos.x, 1.55, L.pos.z);
    return;
  }
  if (rij.aan) return stapRijden(dt);
  // instappen: even wachten (de ruit, het portier), dan zit je erin
  if (rij.instapT > 0 && (rij.instapT -= dt) <= 0 && rij.straks) { const st = rij.straks; rij.straks = null; if (stil.includes(st)) return echtInstappen(st); }
  rij.kans = L.neer > 0 ? null : autoBij();
  $("#instap").classList.toggle("kan", !!rij.kans);
  L.richt = Math.max(0, L.richt - dt);
  if (L.neer > 0) {
    // neer: vallen, liggen, opstaan
    const voor = L.neer;
    L.neer -= dt;
    if (voor > 1.3 && L.neer <= 1.3) schutter.zet("opstaan", 1, 0);
    L.snelheid = L.vx = L.vz = 0;
  } else {
    // sturen: stick of toetsen, ten opzichte van de kijkrichting
    let jx = L.stick.x + (L.toets.KeyD ? 1 : 0) - (L.toets.KeyA ? 1 : 0), jy = L.stick.y + (L.toets.KeyW ? 1 : 0) - (L.toets.KeyS ? 1 : 0);
    let kracht = Math.min(1, Math.hypot(jx, jy));
    if (L.slag > 0 || L.wankel > 0) kracht = 0;
    if (L.wankel > 0) L.wankel -= dt;
    if (L.veilig > 0) L.veilig -= dt;
    // op adem komen: wat je aan klappen hebt gehad, herstelt vanzelf
    if (L.conditie < 3 && (L.herstel -= dt) <= 0) { L.conditie++; L.herstel = 4; }
    const fx = Math.sin(kijk.yaw), fz = Math.cos(kijk.yaw);
    let mx = fx * jy - fz * jx, mz = fz * jy + fx * jx;
    const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
    // wandelen, joggen of sprinten; richtend loop je langzaam. Stoppen beëindigt het sprinten.
    if (kracht < 0.12) L.sprint = false;
    const sprint = (L.sprint || L.toets.ShiftLeft) && !L.mikken && kracht > 0.5;
    const v = kracht < 0.12 ? 0 : L.mikken ? 1.7 : sprint ? 5.6 : kracht > 0.75 ? 3.4 : 1.5;
    // gewicht: je komt op gang en loopt uit (m/s² begrensd), in plaats van direct op snelheid of stil
    const dvx = mx * v - L.vx, dvz = mz * v - L.vz, dl = Math.hypot(dvx, dvz), acc = (v > L.snelheid ? 12 : 17) * dt;
    if (dl <= acc) { L.vx = mx * v; L.vz = mz * v; } else { L.vx += (dvx / dl) * acc; L.vz += (dvz / dl) * acc; }
    L.snelheid = Math.hypot(L.vx, L.vz);
    if (L.snelheid > 0.05) {
      const nx = L.pos.x + L.vx * dt, nz = L.pos.z + L.vz * dt;
      // langs obstakels glijden: eerst het hele stapje, anders alleen x of alleen z
      if (!geblokkeerd(nx, nz)) L.pos.set(nx, 0, nz);
      else if (!geblokkeerd(nx, L.pos.z)) { L.pos.x = nx; L.vz = 0; }
      else if (!geblokkeerd(L.pos.x, nz)) { L.pos.z = nz; L.vx = 0; }
      else L.vx = L.vz = 0;
      // voetstappen op het ritme van je passen
      L.pas += L.snelheid * dt;
      const paslengte = L.snelheid > 4.5 ? 1.5 : L.snelheid > 2.4 ? 1.15 : 0.72;
      if (L.pas > paslengte) { L.pas = 0; geluid.stap(L.snelheid); }
    }
    // draaien: je lijf draait in een boogje mee met je loop; richtend kijk je waar je mikt
    if (L.mikken) { let d = kijk.yaw - L.richting; d = Math.atan2(Math.sin(d), Math.cos(d)); L.richting += d * Math.min(1, dt * 14); }
    else if (L.snelheid > 0.3 && v > 0) {
      let d = Math.atan2(L.vx, L.vz) - L.richting; d = Math.atan2(Math.sin(d), Math.cos(d));
      L.richting += THREE.MathUtils.clamp(d, -9 * dt, 9 * dt);
      // de camera draait rustig achter je aan, tenzij je net zelf hebt rondgekeken of naar de camera toe loopt
      let c = L.richting - kijk.yaw; c = Math.atan2(Math.sin(c), Math.cos(c));
      if (performance.now() - L.keek > 900 && Math.abs(c) < 2.4) kijk.yaw += THREE.MathUtils.clamp(c, -1, 1) * 1.15 * dt;
    }
    // mensen: je loopt niet door ze heen. Loop of jog je tegen iemand op, dan wacht die even; sprint je iemand omver, dan krijg je ruzie.
    for (const r of reizigers) {
      if (!r.ruzie || r.groep.visible === false) continue;
      const dx = L.pos.x - r.pos.x, dz = L.pos.z - r.pos.z, d = Math.hypot(dx, dz);
      if (d > 0.62 || d < 1e-3) continue;
      if (L.snelheid > 4.5) { if (!(r.ruzieT > 0) && r.ruzie(L.pos, Math.random() < 0.35, klapKrijgen)) { straat.strafbaar(0.2); r.zwiep = () => geluid.zwiep(0.5); } } // alleen iemand omver sprinten geeft ruzie
      else if (r.wacht !== undefined) r.wacht = Math.max(r.wacht, 0.7);
      const ux = L.pos.x + (dx / d) * (0.62 - d), uz = L.pos.z + (dz / d) * (0.62 - d);
      if (!geblokkeerd(ux, uz)) L.pos.set(ux, 0, uz);
    }
    // rijdende auto's (ze remmen voor je): je loopt er niet doorheen
    for (const r of reizigers) {
      if (!r.wordBoos) continue;
      const u = uitRechthoek(r.auto, L.pos.x, L.pos.z, 0.3, 0.3);
      if (u && !geblokkeerd(L.pos.x + u[0], L.pos.z + u[1])) { L.pos.x += u[0]; L.pos.z += u[1]; }
    }
    if (L.slag > 0) {
      L.slag -= dt;
      if (L.slag < L.slagRaakOp && !L.slagRaak) {
        L.slagRaak = true;
        const hx = Math.sin(L.richting), hz = Math.cos(L.richting);
        const voorJe = (r, bereik) => {
          const dx = r.pos.x - L.pos.x, dz = r.pos.z - L.pos.z, d = Math.hypot(dx, dz);
          return d < bereik && (dx * hx + dz * hz) / (d || 1) > 0.2 ? d : Infinity;
        };
        const dichtst = (lijst, bereik) => { const r = lijst.sort((a, b) => voorJe(a, bereik) - voorJe(b, bereik))[0]; return r && voorJe(r, bereik) < Infinity ? r : null; };
        const fat = dichtst(reizigers.filter((r) => r.fat && r.toestand === "rijden"), 2.8);
        if (L.slagSoort === "mes") {
          // het mes is alleen voor banden: de dichtstbijzijnde band van een fatbike
          if (fat) {
            const w = fat.fiets.userData.wielen.map((x) => x.getWorldPosition(new THREE.Vector3())).sort((a, b) => a.distanceTo(L.pos) - b.distanceTo(L.pos))[0];
            fatbikeGeraakt(fat, "band", w);
          }
        } else if (L.slagSoort === "knuppel") {
          // de knuppel is voor fatbikes (en blik): de fiets gaat aan gort, de berijder valt, krabbelt op en rent weg.
          // Mensen sla je er niet mee: wie voor je staat schrikt en maakt dat hij wegkomt.
          const auto = dichtst(reizigers.filter((r) => r.wordBoos), 3.4), kapot = dichtst(reizigers.filter((r) => r.fat && r.toestand === "rijden"), 3.2);
          if (kapot) { geluid.bonk(); geluid.botsing(0.5); fatbikeGeraakt(kapot, "klap", kapot.pos.clone().setY(0.7)); terugslag = 0.6; }
          else if (auto) { geluid.bonk(); geluid.botsing(0.4); auto.wordBoos(); straat.strafbaar(0.4); }
          // mensen voor je vliegen door de lucht, liggen even, staan op en hinken weg (niemand raakt gewond)
          let n = 0;
          for (const r of reizigers) if (r.m && r.groep && !r.fat && !r.fiets && !r.wordBoos && voorJe(r, 2.6) < Infinity && werp(r, L.pos, r.soort === "agent" ? 0.8 : 1)) { n++; r.plof = () => geluid.stomp(0.8); straat.strafbaar(r.soort === "agent" ? 1.5 : 0.6); }
          if (n) { geluid.bonk(); geluid.stomp(1); geluid.oef(1); terugslag = 0.7; for (const r of reizigers) if (r.ruzie && !r.worp && !r.hang && r.pos.distanceTo(L.pos) < 9) r.schrikken?.(); }
        } else {
          // wie je bij het uithalen voor je had, krijgt de klap (niet de fatbike die er toevallig naast staat)
          const mens = L.doelwit?.ruzie && !L.doelwit.fat && L.doelwit.soort !== "agent" && !(L.doelwit.ruzieNeer > 0) && voorJe(L.doelwit, 2.2) < Infinity ? L.doelwit : null;
          const auto = dichtst(reizigers.filter((r) => r.wordBoos), 3.2), agent = dichtst(reizigers.filter((r) => r.soort === "agent" && !r.afdruipen && !(r.ruzieNeer > 0)), 1.9);
          if (mens) raakMens(mens, L.slagZwaar);
          else if (agent) { raakMens(agent, L.slagZwaar); straat.strafbaar(1); } // een agent slaan: hij vecht terug, en het wordt er niet beter op // een agent slaan: hij staat even stil, maar het wordt er niet beter op
          else if (fat) { geluid.stomp(1); fatbikeGeraakt(fat, "klap", fat.pos.clone().setY(1)); }
          else if (auto) { geluid.bonk(); auto.wordBoos(); straat.strafbaar(0.3); } // tegen een auto slaan: de bestuurder pikt het niet
          else { const wie = dichtst(reizigers.filter((r) => r.ruzie && r.groep.visible !== false && !(r.ruzieNeer > 0)), 1.9); if (wie) raakMens(wie, L.slagZwaar); }
        }
      }
      // klaar: nog even tijd om door te slaan (de reeks), en een klap die je al had ingetikt volgt meteen
      if (L.slag <= 0) { L.comboT = 0.65; if (L.slagStraks) sla(L.slagStraks); }
    } else if (L.comboT > 0) L.comboT -= dt;
  }
  oog.set(L.pos.x, 1.55, L.pos.z);
}

// ---------- radar: de buurt van bovenaf, met stipjes voor de fatbikes ----------
// De kaart wordt één keer getekend (straten, gebouwen, gras); per beeld draaien we hem zo dat jouw kijkrichting boven is.
let radarKaart = null, radarTel = 0;
const RADAR_M = 680; // meters die de kaart beslaat
function maakRadarKaart() {
  const N = 1024, c = document.createElement("canvas"); c.width = c.height = N;
  const x = c.getContext("2d"), s = N / RADAR_M, P = ([a, b]) => [(a + RADAR_M / 2) * s, (b + RADAR_M / 2) * s];
  x.fillStyle = "#20252b"; x.fillRect(0, 0, N, N);
  const vlak = (r, kl) => { x.fillStyle = kl; x.beginPath(); r.forEach((p, i) => x[i ? "lineTo" : "moveTo"](...P(p))); x.closePath(); x.fill(); };
  for (const v of data.vlakken) if (v.s === "gras") vlak(v.r, "#2a3a24"); else if (v.s === "parkeer") vlak(v.r, "#3b4047");
  x.lineCap = x.lineJoin = "round";
  for (const [soort, kl, extra] of [["stoep", "#343a41", 0], ["weg", "#5d646d", 1.5], ["fietspad", "#7b4f49", 0.5], ["tram", "#77774a", 0]])
    for (const l of data.lijnen) if (l.s === soort) { x.strokeStyle = kl; x.lineWidth = (l.b + extra) * s; x.beginPath(); l.p.forEach((p, i) => x[i ? "lineTo" : "moveTo"](...P(p))); x.stroke(); }
  for (const v of data.voetafdrukken) vlak(v.ring, "#8a8f96");
  return c;
}
function tekenRadar() {
  if (!data || $("#hud").hidden || radarTel++ % 3) return;
  radarKaart ??= maakRadarKaart();
  const cv = $("#radar"), x = cv.getContext("2d"), W = cv.width, R = W / 2, bereik = 75, s = R / bereik;
  const px = loop.aan ? loop.pos.x : oog.x, pz = loop.aan ? loop.pos.z : oog.z, co = Math.cos(kijk.yaw), si = Math.sin(kijk.yaw);
  // wereld (x, z) -> radar: rechts = dwars op je kijkrichting, boven = recht vooruit
  const naar = (wx, wz) => [R + s * (-co * (wx - px) + si * (wz - pz)), R - s * (si * (wx - px) + co * (wz - pz))];
  x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, W, W);
  x.save(); x.beginPath(); x.arc(R, R, R - 2, 0, 6.3); x.clip();
  x.fillStyle = "#20252b"; x.fillRect(0, 0, W, W);
  const a = -s * co, b = -s * si, c = s * si, d = -s * co;
  x.setTransform(a, b, c, d, R - a * px - c * pz, R - b * px - d * pz);
  x.drawImage(radarKaart, -RADAR_M / 2, -RADAR_M / 2, RADAR_M, RADAR_M);
  x.setTransform(1, 0, 0, 1, 0, 0);
  const stip = (wx, wz, kl, r, rand = true) => {
    let [qx, qy] = naar(wx, wz);
    const dx = qx - R, dy = qy - R, dl = Math.hypot(dx, dy);
    if (dl > R - 7) { if (!rand) return; qx = R + (dx / dl) * (R - 7); qy = R + (dy / dl) * (R - 7); r *= 0.7; } // buiten bereik: op de rand
    x.fillStyle = kl; x.strokeStyle = "#000"; x.lineWidth = 1.5; x.beginPath(); x.arc(qx, qy, r, 0, 6.3); x.fill(); x.stroke();
  };
  // missie: geel vierkant = hier begint er een, rode ruit = daar moet je zijn; blauw = handhaving en politie
  for (const [mx, mz, soort] of straat?.radar() ?? []) {
    if (soort === "agent") { stip(mx, mz, "#3d8bff", 5.5, false); continue; }
    let [qx, qy] = naar(mx, mz); const dx = qx - R, dy = qy - R, dl = Math.hypot(dx, dy);
    if (dl > R - 9) { qx = R + (dx / dl) * (R - 9); qy = R + (dy / dl) * (R - 9); }
    x.save(); x.translate(qx, qy); x.rotate(Math.PI / 4); x.fillStyle = soort === "start" ? "#ffc83d" : "#ff5a3d"; x.strokeStyle = "#000"; x.lineWidth = 1.5; x.fillRect(-5.5, -5.5, 11, 11); x.strokeRect(-5.5, -5.5, 11, 11); x.restore();
  }
  for (const r of reizigers) {
    if (r.fat && r.toestand === "rijden") stip(r.pos.x, r.pos.z, r.missie ? "#ff5a3d" : "#ffc83d", 5.5);
    else if (r.boos > 0) stip(r.pos.x, r.pos.z, "#ff4a3d", 5, false);
  }
  // je raam, als je buiten loopt
  if (loop.aan) { const st = standen[standNr]; let [qx, qy] = naar(st.pos[0], st.pos[2]); const dx = qx - R, dy = qy - R, dl = Math.hypot(dx, dy); if (dl > R - 9) { qx = R + (dx / dl) * (R - 9); qy = R + (dy / dl) * (R - 9); } x.fillStyle = "#fff"; x.strokeStyle = "#000"; x.lineWidth = 1.5; x.fillRect(qx - 4.5, qy - 4.5, 9, 9); x.strokeRect(qx - 4.5, qy - 4.5, 9, 9); }
  x.restore();
  // jij: een pijl in het midden, in de richting waarin je lijf staat
  const h = (loop.aan ? loop.richting : kijk.yaw) - kijk.yaw;
  x.save(); x.translate(R, R); x.rotate(-h);
  x.fillStyle = "#fff"; x.strokeStyle = "#000"; x.lineWidth = 2; x.beginPath(); x.moveTo(0, -9); x.lineTo(6.5, 7); x.lineTo(0, 3.5); x.lineTo(-6.5, 7); x.closePath(); x.fill(); x.stroke();
  x.restore();
  x.strokeStyle = "#ffffff55"; x.lineWidth = 3; x.beginPath(); x.arc(R, R, R - 2, 0, 6.3); x.stroke();
}

// ---------- rondes ----------
function rondeInstellingen(r) {
  const meer = [1, 1.8, 3][opties.fatbikes] ?? 1;
  // bonus: zoveel mogelijk fatbikes in de tijd; kogels en fatbikes onbeperkt, een fout kost tijd
  if (data?.modus === "bonus") return { fatbikes: Infinity, kogels: Infinity, tegelijk: Math.round(7 * [1, 1.5, 2.2][opties.fatbikes]), fouten: Infinity, tijd: opties.tijd === 0 ? Infinity : data.tijd ?? 180 };
  // geen klok (tenzij je die aanzet): je hebt alle tijd. Wel een beperkt aantal kogels (tenzij je dat uitzet).
  const f = (data?.fatDruk ?? 1) * meer, n = Math.round((6 + r * 2) * f); // bij het speeltuintje is het een komen en gaan van fatbikes
  return { fatbikes: n, kogels: opties.kogels ? Infinity : n + 6, tegelijk: Math.min(16, Math.round(Math.min(3 + r, 8) * f)), fouten: 2, tijd: opties.tijd === 1 ? 45 + n * 10 : undefined };
}
/** De opties: elke regel is een knop die naar de volgende keuze springt. Tijdens het spelen alleen de geluidsregels. */
function tekenOpties() {
  const lijst = $("#optieLijst"), bonus = data?.modus === "bonus"; lijst.textContent = "";
  for (const [sleutel, naam, keuzes] of OPTIES) {
    if (alleenGeluid && !GELUIDKEUZES.has(sleutel)) continue;
    const nu = sleutel === "tijd" && opties.tijd === null ? (bonus ? 1 : 0) : opties[sleutel];
    const kn = document.createElement("button");
    kn.innerHTML = `<span>${naam}</span><b class="${keuzes[nu] === "uit" ? "uit" : ""}">${keuzes[nu]}</b>`;
    kn.addEventListener("click", () => { opties[sleutel] = (nu + 1) % keuzes.length; localStorage.setItem("fbs-opties", JSON.stringify(opties)); pasGeluidAan(); if (spel.bezig) tekenOpties(); else toonStart(); });
    lijst.append(kn);
  }
}
function toonStart() {
  const best = +(localStorage.getItem("fbs-best") ?? 0);
  const ri = rondeInstellingen(spel.ronde);
  const bonus = data?.modus === "bonus";
  const bestBonus = +(localStorage.getItem("fbs-best-bonus") ?? 0);
  $("#startRonde").textContent = bonus ? "Bonuslevel" : `Ronde ${spel.ronde}`;
  const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.round(t) % 60).padStart(2, "0")}`;
  $("#startDoel").textContent = bonus ? (isFinite(ri.tijd) ? `Zoveel mogelijk fatbikes in ${Math.round(ri.tijd / 60)} minuten` : "Zoveel mogelijk fatbikes · geen klok")
    : `${ri.fatbikes} fatbikes · ${isFinite(ri.kogels) ? ri.kogels : "∞"} kogels · ${ri.tijd ? mmss(ri.tijd) : "geen haast"}`;
  tekenOpties();
  $("#startBest").textContent = bonus ? (bestBonus ? `Record: ${bestBonus} fatbikes` : "") : best ? `Beste score: ${best}` : "";
  for (const b of document.querySelectorAll("#levels button")) b.classList.toggle("aan", b.dataset.level === LOCATIE);
}
function begin() {
  geluid.start();
  $("#opties").hidden = true;
  stapUitGedwongen();
  if (loop.aan) { loop.aan = false; document.body.classList.remove("loopt"); zetStand(standNr); } // elke ronde begint bij je raam
  straat?.reset();
  const ri = (spel.ri = rondeInstellingen(spel.ronde));
  for (const [id, w] of Object.entries(WAPENKAST)) if (w.munitie) kast.munitie[id] = w.munitie; // elke ronde een volle kast
  Object.assign(spel, { bezig: true, kogels: ri.kogels, fouten: 0, geraakt: 0, gespawnd: 0, rondeScore: 0, schoten: 0, tijd: ri.tijd });
  for (const r of reizigers.filter((r) => r.fat)) weg(r);
  for (let i = 0; i < ri.tegelijk; i++) nieuweFatbike(i === 0);
  $("#start").hidden = $("#einde").hidden = true;
  $("#hud").hidden = false;
  pasGeluidAan();
  tekenHud();
}
// boodschappers: uit een geparkeerde auto naar een winkel en terug
function nieuweBoodschapper() {
  const [cx, cz] = graaf.c;
  const autos = wereld.geparkeerd.filter((a) => Math.hypot(a.position.x - cx, a.position.z - cz) < 70);
  const winkels = data.winkels.filter((w) => ["Jumbo", "Jumbo", "Jumbo", "Albert Heijn", "HEMA", "Action", "Kruidvat", "Etos", "Bruna", "Blokker", "Bon Appetit"].includes(w[0]) && Math.hypot(w[1] - cx, w[2] - cz) < 120);
  // geen winkel of auto in de buurt (je bent van het plein af): dan een gewone voorbijganger
  if (!autos.length || !winkels.length) return void reizigers.push(new Voetganger(graaf, scene));
  const w = kies(winkels.concat(winkels.filter((x) => x[0] === "Jumbo")));
  // de deur: iets voor het bord, op straatniveau
  reizigers.push(new Boodschapper(graaf, scene, kies(autos).position, [w[1] + Math.sin(w[3]) * 1.2, w[2] + Math.cos(w[3]) * 1.2]));
}
function weg(r) {
  scene.remove(r.object);
  reizigers.splice(reizigers.indexOf(r), 1);
}
/** Een groepje dat ergens staat te hangen. Bij een speeltuintje is dat hangjeugd: capuchons, en ze laten zich niet wegjagen. */
function nieuweGroep(h) {
  const hang = !!data.hangjeugd, n = hang ? 3 + ((Math.random() * 3) | 0) : 2 + ((Math.random() * 2) | 0);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + Math.random(), r = hang ? 0.9 + Math.random() * 0.5 : 0.8;
    const x = h.x + Math.cos(a) * r + (hang ? 0 : 1.5), z = h.z + Math.sin(a) * r;
    if (hang && geblokkeerd(x, z)) continue;
    const st = new Staander(scene, x, z, Math.atan2(-Math.cos(a), -Math.sin(a)), false, hang ? kies(["fatbiker", "fatbiker", "f_grijs", "f_sport"]) : "voetganger");
    if (hang) { st.hang = true; st.plek = h; st.vechter = Math.random() < 0.85; }
    reizigers.push(st);
  }
}
function nieuweFatbike(stil = false) {
  const f = new Fietser(graaf, scene, "fatbike", spel.ronde);
  if (stil || Math.random() < 0.35) {
    // staat al op het plein, op zijn telefoon te kijken
    f.van = graaf.startKnoop(8, 55, 10);
    f.wacht = tussen(10, 30);
  } else f.van = graaf.startKnoop(8, 75, 40); // komt van de rand van het plein binnen rijden
  const v = graaf.volgende(-1, f.van, 8, 2);
  if (v) { f.naar = v.n; f.breed = v.breed; f.t = stil ? 0.5 : 0; f.plaats(true); }
  if (spel.vrijPunten?.length) {
    // bonus: vrij rondrijden; begin op een willekeurig punt
    const p = kies(spel.vrijPunten);
    f.vrij = spel.vrijPunten; f.wacht = 0; f.pad.set(p[0], 0, p[1]); f.pos.copy(f.pad);
  }
  reizigers.push(f);
  spel.gespawnd++;
}
function eindeBonus() {
  muziek?.volume(0);
  spel.bezig = false;
  const oud = +(localStorage.getItem("fbs-best-bonus") ?? 0), record = spel.geraakt > oud;
  if (record) localStorage.setItem("fbs-best-bonus", spel.geraakt);
  $("#eindeKop").textContent = "Tijd om!";
  $("#eindeReden").textContent = record ? "Nieuw record!" : oud ? `Record: ${oud}` : "";
  $("#eindeSterren").textContent = spel.geraakt >= 25 ? "★★★" : spel.geraakt >= 15 ? "★★☆" : spel.geraakt >= 6 ? "★☆☆" : "☆☆☆";
  $("#eindeScore").innerHTML = `<b>${spel.geraakt} fatbikes</b><br>${spel.fouten} keer mis (−${spel.fouten * 10} s)`;
  $("#volgende").textContent = "Nog een keer";
  setTimeout(() => { $("#einde").hidden = false; $("#hud").hidden = true; zetZoom(1); }, 900);
}
function eindeRonde(gewonnen, reden) {
  muziek?.volume(0);
  spel.bezig = false;
  const ri = spel.ri;
  let bonus = 0;
  if (gewonnen) bonus = spel.kogels * 100 + (spel.fouten === 0 ? 300 : 0);
  spel.rondeScore += bonus;
  spel.score += spel.rondeScore;
  const sterren = !gewonnen ? 0 : 1 + (spel.fouten === 0 ? 1 : 0) + (spel.schoten <= ri.fatbikes + 1 ? 1 : 0);
  $("#eindeKop").textContent = gewonnen ? `Ronde ${spel.ronde} gehaald!` : "Missie mislukt";
  $("#eindeReden").textContent = reden;
  $("#eindeSterren").textContent = "★".repeat(sterren) + "☆".repeat(3 - sterren);
  $("#eindeScore").innerHTML = `${spel.geraakt} van de ${ri.fatbikes} fatbikes<br>Ronde: ${spel.rondeScore} punten${bonus ? ` (bonus ${bonus})` : ""}<br><b>Totaal: ${spel.score}</b>`;
  const best = Math.max(spel.score, +(localStorage.getItem("fbs-best") ?? 0));
  localStorage.setItem("fbs-best", best);
  $("#volgende").textContent = gewonnen ? "Volgende ronde" : "Opnieuw";
  if (gewonnen) spel.ronde++;
  else { spel.ronde = 1; spel.score = 0; }
  setTimeout(() => { $("#einde").hidden = false; $("#hud").hidden = true; zetZoom(1); }, gewonnen ? 1800 : 900);
}

// ---------- HUD ----------
function tekenHud() {
  if (!spel.ri) return;
  if (spel.modus === "bonus") {
    // bonus: geteld wat je raakt, en de klok
    const t = Math.max(0, Math.ceil(spel.tijd));
    $("#doelen").innerHTML = `<i class="fb"></i><span>${spel.geraakt}</span>`;
    $("#kogels").innerHTML = isFinite(t) ? `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}` : "∞";
    $("#klok").hidden = true;
    $("#kogels").classList.toggle("krap", t <= 15);
    $("#fouten").hidden = true;
    $("#score").hidden = true;
    return;
  }
  const over = spel.ri.fatbikes - spel.geraakt;
  $("#doelen").innerHTML = `<i class="fb"></i><span>${over}</span>`;
  const hw = huidigWapen();
  $("#kogels").innerHTML = `<i class="kogel"></i>${ZWAAR.has(hw) || GOOI.has(hw) ? Math.ceil(kast.munitie[hw] ?? 0) : isFinite(spel.kogels) ? spel.kogels : "∞"}`;
  const tk = Math.max(0, Math.ceil(spel.tijd ?? 0));
  $("#klok").hidden = !spel.ri.tijd; $("#klok").textContent = `${Math.floor(tk / 60)}:${String(tk % 60).padStart(2, "0")}`; $("#klok").classList.toggle("krap", tk <= 15);
  $("#fouten").innerHTML = Array.from({ length: spel.ri.fouten + 1 }, (_, i) => `<i class="${i < spel.fouten ? "x aan" : "x"}">✕</i>`).join("");
  $("#score").textContent = spel.score + spel.rondeScore;
}
/** Geen tekst in beeld: een kort teken midden in het vizier (geel = raak, oranje = accu, rood = fout). */
function melding() {} // de gele en rode kruizen in beeld zijn weg (op verzoek)

// ---------- schieten ----------
const kogels = [];
function richting() {
  const d = new THREE.Vector3();
  camera.getWorldDirection(d);
  return d;
}
function schiet() {
  if (!spel.bezig || herlaad > 0 || spel.kogels <= 0 || filmCam || wisselt() || (loop.aan && (loop.neer > 0 || loop.slag > 0))) return;
  spel.kogels--; spel.schoten++;
  if (loop.aan) geluid.pistool(); else { geluid.schot(); geluid.herladen(); }
  // de kogel vertrekt bij je ogen en gaat naar het punt waar het kruisje op staat
  let doelPunt = richtPunt();
  if (loop.aan) {
    // lopend (zonder kijker) helpt het spel met mikken: staat het kruisje bijna op een fatbike, dan gaat het schot naar zijn band
    const best = zoekDoel();
    if (best) doelPunt = best.p;
    // een schot op straat: wie dichtbij staat schrikt en maakt dat hij wegkomt
    for (const r of reizigers) if (r.pos.distanceTo(loop.pos) < 14) r.schrikken?.();
    loop.richting = kijk.yaw;
  }
  const start = loop.aan ? new THREE.Vector3(loop.pos.x, 1.4, loop.pos.z) : oog; // lopend vertrekt de kogel bij je pistool
  const d = doelPunt.sub(start).normalize();
  // de kijker is op NUL_AFSTAND m afgesteld: de kogel gaat iets omhoog zodat hij daar op de draad zit
  const tVal = NUL_AFSTAND / KOGEL_V;
  const v = d.clone().multiplyScalar(KOGEL_V);
  v.y += (0.5 * ZWAARTE * tVal * tVal) / tVal;
  kogels.push({ p: start.clone().addScaledVector(d, 0.6), v, leeftijd: 0 });
  terugslag = loop.aan ? SCHOT.terugslagPistool : SCHOT.terugslagGeweer; herlaad = loop.aan ? SCHOT.herlaadPistool : SCHOT.herlaadGeweer;
  flitsT = SCHOT.flitsDuur;
  if (loop.aan) { loop.richt = 1.6; straat.strafbaar(0.5); } // schieten op straat trekt aandacht
  $("#flits").classList.remove("aan"); void $("#flits").offsetWidth; $("#flits").classList.add("aan");
  tekenHud();
}

// ---------- de wapenkast ----------
function openKast() {
  const el = $("#kast"), lijst = $("#kastLijst"); lijst.textContent = "";
  const keuzes = [...Object.keys(WAPENKAST).filter((id) => !WAPENKAST[id].alleen || WAPENKAST[id].alleen === (karateka ? "karate" : "gewoon")), ...(karateka ? ["vuurwerk"] : [])];
  for (const id of keuzes) {
    const k = document.createElement("button"), nu = loop.raamVuurwerk ? "vuurwerk" : kast.keuze;
    k.className = id === nu ? "aan" : ""; k.textContent = WAPENKAST[id]?.naam ?? "Vuurwerk";
    k.addEventListener("click", () => {
      loop.raamVuurwerk = id === "vuurwerk"; if (id !== "vuurwerk") kast.keuze = id;
      toonWapen(id === "geweer" ? "pistool" : id); if (ZWAAR.has(id) || GOOI.has(id)) zetZoom(1);
      el.hidden = true; geluid.slot(); tekenHud();
    });
    lijst.append(k);
  }
  el.hidden = false;
}
/**
 * Leg een lang wapen aan: de kolf vóór je rechterschouder (de bazooka erop), de loop in de kijkrichting, je rechterhand
 * aan de greep en je linker onder de voorkant. De maten per wapen staan in HOUVAST (src/wapens.js).
 */
function legAan(m, wapen, soort, yaw, pitch) {
  const H = HOUVAST[soort], fx = Math.sin(yaw), fz = Math.cos(yaw), cp = Math.cos(pitch);
  const links = new THREE.Vector3(fz, 0, -fx), dir = new THREE.Vector3(fx * cp, Math.sin(pitch), fz * cp);
  wapen.position.copy(m.plek("DEF-upper_armR")).addScaledVector(links, H.zij).addScaledVector(dir, H.voor).add(new THREE.Vector3(0, H.op, 0));
  wapen.rotation.set(-pitch, yaw, 0, "YXZ");
  wapen.updateMatrixWorld(true);
  const omlaag = new THREE.Vector3(0, -1, 0);
  m.arm("R", wapen.localToWorld(new THREE.Vector3(...H.R)), omlaag.clone().addScaledVector(links, -0.6));
  m.arm("L", wapen.localToWorld(new THREE.Vector3(...H.L)), omlaag.clone().addScaledVector(links, 0.4));
}
/** Waar een schot met een zwaar wapen vertrekt en heen gaat. */
function loopVan() {
  const doel = richtPunt(), m = kast.mesh[huidigWapen()];
  let van;
  if (m?.visible) { m.updateMatrixWorld(true); van = m.localToWorld(new THREE.Vector3(0, 0.03, m.userData.loop)); }
  else van = loop.aan ? new THREE.Vector3(loop.pos.x, 1.4, loop.pos.z) : oog.clone();
  return { van, d: doel.sub(van).normalize() };
}
function magVuren() { return spel.bezig && !filmCam && !wisselt() && !(loop.aan && (loop.neer > 0 || loop.slag > 0 || loop.boeien > 0 || rij.aan)); }
/** Machinegeweer: zolang je de knop vasthoudt. Kogels gelden zoals die van het geweer (een mens raken is een fout). */
function vuurMg() {
  const W = WAPENKAST.mg;
  if (!magVuren() || herlaad > 0 || !(kast.munitie.mg > 0)) return;
  kast.munitie.mg--; spel.schoten++;
  const { van, d } = loopVan();
  d.x += (Math.random() - 0.5) * 2 * W.spreiding; d.y += (Math.random() - 0.5) * 2 * W.spreiding; d.z += (Math.random() - 0.5) * 2 * W.spreiding; d.normalize();
  kogels.push({ p: van.clone().addScaledVector(d, 0.3), v: d.multiplyScalar(KOGEL_V), leeftijd: 0 });
  herlaad = W.tussen; terugslag = Math.min(0.6, terugslag + 0.22); flitsT = 0.05;
  geluid.mg();
  if (loop.aan) { loop.richt = 1.2; loop.richting = kijk.yaw; if (kast.munitie.mg % 6 === 0) { straat.strafbaar(0.5); for (const r of reizigers) if (r.pos.distanceTo(loop.pos) < 16) r.schrikken?.(); } }
  tekenHud();
}
/** Bazooka: een raket die ontploft waar hij iets raakt. */
function vuurRaket() {
  const W = WAPENKAST.bazooka;
  if (!magVuren() || herlaad > 0 || !(kast.munitie.bazooka > 0)) return;
  kast.munitie.bazooka--; spel.schoten++;
  const { van, d } = loopVan();
  const m = maakRaket() ?? new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.5, 8).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#59613f" }));
  m.position.copy(van); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d); scene.add(m);
  kogels.push({ p: van.clone().addScaledVector(d, 0.4), v: d.multiplyScalar(W.snelheid), leeftijd: 0, raket: m });
  herlaad = W.tussen; terugslag = 1.3; flitsT = 0.1;
  geluid.raket();
  if (loop.aan) { loop.richt = 1.6; loop.richting = kijk.yaw; }
  tekenHud();
}
/** Een ontploffing: fatbikes binnen bereik gaan eraan, auto's slaan alarm, mensen vliegen door de lucht en hinken daarna weg. */
function ontplof(p, R = WAPENKAST.bazooka.straal, cobra = false) {
  // een cobra is vooral een enorme knal met een flits; een granaat of raket geeft ook een vuurbal
  if (cobra) { geluid.knal(Math.min(1.6, afstandVol(p) * 3)); fx.klap(p); } else fx.ontploffing(p);
  geluid.boem(Math.min(1.6, afstandVol(p) * (cobra ? 1.6 : 2.2)));
  for (let i = 0; i < 14; i++) fx.vonken(p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 1.5, (Math.random() - 0.5) * 3)));
  terugslag = Math.max(terugslag, 1.2 * afstandVol(p) * 3);
  $("#hud").classList.remove("schud"); void $("#hud").offsetWidth; $("#hud").classList.add("schud");
  for (const r of [...reizigers]) {
    const d = Math.hypot(r.pos.x - p.x, r.pos.z - p.z);
    if (r.fat && r.toestand === "rijden") { if (d < R) fatbikeGeraakt(r, "accu", r.pos.clone().setY(0.7)); else if (d < R * 2.5) r.schrikken?.(); }
    else if (r.wordBoos) { if (d < R) { r.wacht = Math.max(r.wacht ?? 0, 4); geluid.toeter(afstandVol(p)); } }
    else if (r.m && r.groep && !r.fiets) { if (d < R + 1) { if (werp(r, p, 1.2 + (1 - d / (R + 1)) * 0.5)) r.plof = () => geluid.stomp(afstandVol(r.pos) * 2); } else if (d < R * 3) r.schrikken?.(); }
    else if (d < R * 2.5) r.schrikken?.();
  }
  for (const st of [...stil]) {
    if (st.soort === "auto" && st.object.position.distanceTo(p) < R) { knipper(st.object); geluid.alarm(afstandVol(p) * 2); }
    else if (st.soort === "wrak" && st.groep.position.distanceTo(p) < R) wrakOntploft(st, st.groep.position.clone().setY(0.4));
  }
  if (loop.aan && !rij.aan && Math.hypot(loop.pos.x - p.x, loop.pos.z - p.z) < R * 0.7) klapKrijgen(); // te dichtbij: je ligt zelf ook
  straat?.strafbaar(1.5);
}
/** Vlammenwerper: zolang je de knop vasthoudt. Fatbikes in de vlam vliegen in brand; mensen maken dat ze wegkomen (niemand brandt). */
function vuurVlam(dt) {
  const W = WAPENKAST.vlam;
  if (!magVuren() || !(kast.munitie.vlam > 0)) return geluid.vlam(false);
  kast.munitie.vlam = Math.max(0, kast.munitie.vlam - dt);
  const { van, d } = loopVan();
  geluid.vlam(true);
  if (loop.aan) { loop.richt = 0.6; loop.richting = kijk.yaw; }
  for (let i = 0; i < 3; i++) {
    const v = d.clone().multiplyScalar(11 + Math.random() * 5).add(new THREE.Vector3((Math.random() - 0.5) * 2.2, (Math.random() - 0.2) * 1.6, (Math.random() - 0.5) * 2.2));
    fx.deeltje(van.clone().addScaledVector(d, 0.2 + Math.random() * 0.5), { leven: 0.5 + Math.random() * 0.35, kleur: ["#ffd24a", "#ff9a2e", "#ff5a1e", "#fff0a0"][(Math.random() * 4) | 0], r0: 0.12, r1: 1.1, v, licht: true });
  }
  for (const r of reizigers) {
    const dx = r.pos.x - van.x, dz = r.pos.z - van.z, a = Math.hypot(dx, dz) || 1;
    if (a > W.bereik + 4) continue;
    const inVlam = a < W.bereik && (dx * d.x + dz * d.z) / a > Math.cos(W.hoek);
    if (r.fat && r.toestand === "rijden") { if (inVlam && (r.heet = (r.heet ?? 0) + dt) > 0.35) fatbikeGeraakt(r, "accu", r.pos.clone().setY(0.7)); }
    else if (inVlam || a < 6) { if (r.ruzieT > 0) r.ruzieT = 0; r.schrikken?.(); }
  }
  if (loop.aan && Math.random() < dt * 0.5) straat.strafbaar(0.4);
  if ((spel.vlamTik = (spel.vlamTik ?? 0) + dt) > 0.25) { spel.vlamTik = 0; tekenHud(); }
}

const ray = new THREE.Raycaster();
/** Het punt in de wereld waar het kruisje op staat (gebouw, grond, of ver weg). */
function richtPunt() {
  const d = richting();
  ray.set(camera.position, d); ray.far = 600;
  let afst = 600;
  const raak = ray.intersectObjects(wereld.botsers, false)[0];
  if (raak) afst = raak.distance;
  if (d.y < 0) afst = Math.min(afst, -camera.position.y / d.y);
  // ook wie of wat er onder het kruisje staat: anders schiet je er vanaf je schouder naast (de camera staat achter je)
  const ver = camera.position.clone().addScaledVector(d, afst);
  for (const r of reizigers) { if (r.toestand && r.toestand !== "rijden") continue; const h = raakObject(r.object, r.raak, camera.position, ver); if (h && h.t > 0.01) afst = Math.min(afst, h.t * camera.position.distanceTo(ver)); }
  return camera.position.clone().addScaledVector(d, afst);
}
const inv = new THREE.Matrix4(), a3 = new THREE.Vector3(), b3 = new THREE.Vector3();
/** Snijdt het lijnstuk a-b met de raakvlakken van een object. Geeft t (0..1) en het deel. */
function raakObject(obj, raak, a, b) {
  obj.updateMatrixWorld();
  inv.copy(obj.matrixWorld).invert();
  a3.copy(a).applyMatrix4(inv); b3.copy(b).applyMatrix4(inv);
  let best = null;
  for (const r of raak) {
    let t0 = 0, t1 = 1, ok = true;
    for (const as of ["x", "y", "z"]) {
      const d = b3[as] - a3[as];
      if (Math.abs(d) < 1e-9) { if (a3[as] < r.min[as] || a3[as] > r.max[as]) { ok = false; break; } continue; }
      let u = (r.min[as] - a3[as]) / d, w = (r.max[as] - a3[as]) / d;
      if (u > w) [u, w] = [w, u];
      t0 = Math.max(t0, u); t1 = Math.min(t1, w);
      if (t0 > t1) { ok = false; break; }
    }
    // mens gaat voor fiets-frame als ze overlappen; band en accu gaan voor frame
    const voorrang = { accu: 0, band: 0.002, mens: 0.001, frame: 0.004, auto: 0 }[r.deel] ?? 0;
    if (ok && (!best || t0 + voorrang < best.t + best.vr)) best = { t: t0, deel: r.deel, vr: voorrang };
  }
  return best;
}
function stapKogels(dt) {
  for (const k of [...kogels]) {
    const a = k.p.clone();
    if (k.raket) { k.raket.position.copy(k.p); fx.vonken(k.p); if (Math.random() < 0.6) fx.deeltje(k.p.clone(), { leven: 0.7, kleur: "#c9c5bd", r0: 0.1, r1: 0.8, v: new THREE.Vector3(0, 0.6, 0) }); }
    else k.v.y -= ZWAARTE * dt;
    k.p.addScaledVector(k.v, dt);
    k.leeftijd += dt;
    const b = k.p;
    let raak = null;
    const bekijk = (obj, lijst, wie, soort) => {
      const h = raakObject(obj, lijst, a, b);
      if (h && (!raak || h.t < raak.t)) raak = { ...h, wie, soort };
    };
    for (const r of reizigers) if (!r.toestand || r.toestand === "rijden") bekijk(r.object, r.raak, r, r.soort);
    for (const s of stil) if ((s.groep ?? s.object).position.distanceToSquared(a) < (KOGEL_V * dt + 6) ** 2) bekijk(s.object, s.raak, s, s.soort);
    // gebouwen en grond
    const lengte = a.distanceTo(b);
    ray.set(a, b.clone().sub(a).normalize()); ray.far = lengte;
    const muur = ray.intersectObjects(wereld.botsers, false)[0];
    if (muur && (!raak || muur.distance / lengte < raak.t)) raak = { t: muur.distance / lengte, deel: "muur" };
    if (b.y < 0 && (!raak || a.y / (a.y - b.y) < raak.t)) raak = { t: a.y / (a.y - b.y), deel: "grond" };
    if (raak) {
      const p = a.clone().lerp(b, raak.t);
      if (k.raket) { scene.remove(k.raket); ontplof(p); } else treffer(raak, p);
      kogels.splice(kogels.indexOf(k), 1);
    } else if (k.leeftijd > (k.raket ? 5 : 1.2)) { if (k.raket) { scene.remove(k.raket); ontplof(k.p.clone()); } kogels.splice(kogels.indexOf(k), 1); }
  }
}
function afstandVol(p) { return 1 / (1 + p.distanceTo(camera.position) / 60); }

function treffer(r, p) {
  spel.laatste = { deel: r.deel, soort: r.soort, p: p.toArray().map((v) => +v.toFixed(2)) };
  // iedereen in de buurt schrikt; fatbikes geven gas
  const mens = (x) => x.m && x.groep && !x.fiets && !x.wordBoos && x.soort !== "agent";
  for (const x of reizigers) {
    const d = x.pos.distanceTo(p);
    // vlak naast de inslag: opspringen (of omvallen) en wegrennen; verder weg: schrikken
    if (d < 4 && mens(x) && x !== r.wie) schrikVan(x, p, Math.random() < 0.3);
    else if (d < (x.fat ? 30 : 12)) x.schrikken();
  }
  if (r.wie?.soort === "wrak") return wrakOntploft(r.wie, p);
  if (r.deel === "muur" || r.deel === "grond") { fx.inslag(p, r.deel === "grond" ? "#9b968c" : "#b9a89a"); geluid.tik(afstandVol(p)); return; }
  const wie = r.wie;
  if (r.deel === "mens") {
    // niemand raakt gewond: de kogel scheert langs en ze schrikken zich rot
    straat?.strafbaar(wie.soort === "agent" ? 1.5 : 1);
    fout("Bijna een mens geraakt!", "Schiet op de fiets, niet op de mensen");
    // er is op hem geschoten: hij valt om van schrik, krabbelt op en rent weg
    if (mens(wie)) schrikVan(wie, loop.aan ? loop.pos : oog, true); else if (wie.mens) wie.schrikken();
    return;
  }
  if (wie.soort === "auto") {
    fx.inslag(p, "#ddd");
    geluid.tik(); geluid.alarm(afstandVol(p) * 2);
    knipper(wie.object);
    if (loop.aan) wie.wordBoos?.(); // sta je op straat, dan komt de bestuurder op je af
    straat?.strafbaar(0.7);
    fout("Auto geraakt!", "Het alarm gaat af");
    return;
  }
  if (wie.fat) return fatbikeGeraakt(wie, r.deel, p);
  // gewone fiets (rijdend of in het rek)
  fx.klap(p); geluid.klap(afstandVol(p));
  fout("Gewone fiets geraakt!", "Kijk naar de dikke banden");
  if (wie instanceof Fietser) { wie.wacht = 4; wie.vBasis *= 0.5; wie.v = wie.vBasis; }
}
function fout(tekst, sub) {
  spel.fouten++;
  if (spel.modus === "bonus") spel.tijd -= 10;
  geluid.fout();
  melding("fout");
  $("#hud").classList.remove("schud"); void $("#hud").offsetWidth; $("#hud").classList.add("schud");
  tekenHud();
  if (spel.fouten > spel.ri.fouten) eindeRonde(false, "Je hebt te vaak iets anders geraakt dan een fatbike.");
}
function knipper(auto) {
  // stilstaande auto's zijn samengevoegd: het alarm wordt knipperend oranje licht (geen echte lamp: dat kost een shader-wissel)
  const p = auto.getWorldPosition(new THREE.Vector3());
  const L = auto.userData.L ?? 4.2, h = auto.rotation.y;
  let n = 0;
  const iv = setInterval(() => {
    if (!(n % 2)) for (const k of [-1, 1]) for (const e of [-1, 1])
      fx.deeltje(new THREE.Vector3(p.x + Math.sin(h) * e * L * 0.47 + Math.cos(h) * k * 0.65, 0.75, p.z + Math.cos(h) * e * L * 0.47 - Math.sin(h) * k * 0.65), { leven: 0.24, kleur: "#ffa22a", licht: true, r0: 0.7, r1: 0.9 });
    if (++n > 14) clearInterval(iv);
  }, 250);
}

// ---------- fatbike geraakt: vallen, vliegen, branden ----------
function fatbikeGeraakt(f, deel, p) {
  f.toestand = "val";
  if (f.missie) straat.doelGeraakt(f); else spel.geraakt++; // een doelwit van een missie telt niet voor de ronde
  straat?.strafbaar(0.2); // vernieling: een paar keer kan, maar het telt op
  const accu = deel === "accu", klap = deel === "klap";
  const punten = { accu: 250, band: 100, frame: 75, klap: 150 }[deel] ?? 75;
  spel.rondeScore += punten;
  geluid.goed();
  melding(accu ? "accu" : "goed");
  const vooruit = new THREE.Vector3(Math.sin(f.richting), 0, Math.cos(f.richting));
  const v = vooruit.clone().multiplyScalar(f.snelheid ?? f.v);
  // fiets wordt los object in de wereld
  const fiets = f.fiets;
  fiets.updateMatrixWorld();
  if (accu) {
    fx.ontploffing(p); geluid.boem(afstandVol(p) * 1.4);
    fx.brand(fiets, 10);
    vallers.push({ obj: f.groep, v: v.clone().multiplyScalar(0.3).add(new THREE.Vector3(tussen(-1, 1), 6.5, tussen(-1, 1))), w: new THREE.Vector3(tussen(-4, 4), tussen(-3, 3), tussen(-5, 5)), soort: "fiets", r: 0.25 });
    for (const w of fiets.userData.wielen) w.material = w.material.clone(), w.material.color?.set("#444");
    fiets.userData.hoofd.material = fiets.userData.hoofd.material.clone();
    fiets.userData.hoofd.material.color.set("#555");
  } else {
    if (klap) geluid.tik(1); else { fx.klap(p); geluid.klap(afstandVol(p)); }
    const zij = Math.random() < 0.5 ? 1 : -1;
    vallers.push({ obj: f.groep, v, w: new THREE.Vector3(0, tussen(-1, 1), 0), soort: "fiets", r: 0, kantel: zij, kantelT: 0 });
    // de accu is nog heel: zolang de fiets er ligt kun je hem alsnog opblazen
    stil.push({ object: fiets, raak: fiets.userData.raak, soort: "wrak", groep: f.groep });
    // lekke band: platter
    const wi = deel === "band" ? fiets.userData.wielen[p.distanceTo(fiets.userData.wielen[0].getWorldPosition(new THREE.Vector3())) < p.distanceTo(fiets.userData.wielen[1].getWorldPosition(new THREE.Vector3())) ? 0 : 1] : null;
    if (wi) wi.scale.set(1, 0.82, 1.06);
  }
  // berijders vliegen eraf
  for (const m of f.berijders) {
    const o = m.object;
    o.updateMatrixWorld();
    const pos = new THREE.Vector3(); o.getWorldPosition(pos);
    const h = m.zithoogte();
    const spil = new THREE.Group();
    spil.position.copy(pos).add(new THREE.Vector3(0, m.zithoogte(), 0));
    spil.rotation.y = f.richting;
    scene.add(spil);
    o.position.set(0, -h, 0); o.rotation.set(0, 0, 0);
    spil.add(o);
    m.zet("klap");
    const kracht = accu ? 1 : 0.75;
    const vm = v.clone().multiplyScalar(kracht).add(new THREE.Vector3(tussen(-1.2, 1.2), accu ? tussen(7, 9.5) : tussen(2.5, 3.8), tussen(-1.2, 1.2)));
    vallers.push({ obj: spil, m, h, v: vm, w: new THREE.Vector3(accu ? tussen(-7, 7) : tussen(3, 6), tussen(-2, 2), tussen(-3, 3)), soort: "mens", toestand: "vliegt", t: 0, vlucht: klap });
  }
  f.berijders = [];
  reizigers.splice(reizigers.indexOf(f), 1);
  f.groep.userData.fat = f;
  // de laatste: vertraagd camerashot
  if (!f.missie && spel.geraakt >= spel.ri.fatbikes) {
    filmCam = { doel: f.groep, t: 0, duur: 2.6, kant: Math.random() < 0.5 ? 1 : -1 };
    setTimeout(() => eindeRonde(true, "Alle fatbikes zijn uitgeschakeld."), 2600);
  } else if (accu && Math.random() < 0.5) filmCam = { doel: f.groep, t: 0, duur: 1.4, kant: Math.random() < 0.5 ? 1 : -1 };
  tekenHud();
}

function stapVallers(dt) {
  for (const x of [...vallers]) {
    const o = x.obj;
    if (x.soort === "fiets") {
      x.v.y -= (x.r ? ZWAARTE : 0) * dt;
      o.position.addScaledVector(x.v, dt);
      if (x.r) {
        o.rotation.x += x.w.x * dt; o.rotation.y += x.w.y * dt; o.rotation.z += x.w.z * dt;
        if (o.position.y <= 0 && x.v.y < 0) {
          o.position.y = 0; x.v.y *= -0.25; x.v.x *= 0.5; x.v.z *= 0.5; x.w.multiplyScalar(0.5);
          if (Math.abs(x.v.y) < 0.6) { x.r = 0; x.kantel = Math.sign(Math.sin(o.rotation.z)) || 1; x.kantelT = 0; o.rotation.x = 0; o.rotation.z = 0; }
        }
      } else {
        // glijden en omvallen
        const sn = x.v.length();
        if (sn > 0) x.v.multiplyScalar(Math.max(0, sn - 5.5 * dt) / sn);
        x.kantelT = Math.min(1, x.kantelT + dt * 2.2);
        const f = o.userData.fat?.fiets ?? o;
        f.rotation.z = x.kantel * (Math.PI / 2 - 0.12) * (x.kantelT * x.kantelT);
        f.position.y = 0.09 * x.kantelT;
        o.position.y = 0;
        o.rotation.y += x.w.y * dt * (sn / 8);
        if (sn < 0.05 && x.kantelT >= 1) { vallers.splice(vallers.indexOf(x), 1); opruimen(o, 25); }
      }
    } else {
      x.t += dt;
      const m = x.m;
      m.mixer.update(dt);
      if (x.toestand === "vliegt") {
        x.v.y -= ZWAARTE * dt;
        o.position.addScaledVector(x.v, dt);
        o.rotation.x += x.w.x * dt; o.rotation.z += x.w.z * dt;
        if (x.t > 0.35) m.zet("vliegen");
        if (o.position.y < x.h * 0.5 && x.v.y < 0) {
          if (Math.abs(x.v.y) > 4) { x.v.y *= -0.3; x.v.x *= 0.6; x.v.z *= 0.6; o.position.y = x.h * 0.5; x.w.multiplyScalar(0.5); }
          else { x.toestand = "glijdt"; x.t = 0; x.rx = o.rotation.x; x.rz = o.rotation.z; m.zet("liggen", 1, "eind"); }
        }
      } else if (x.toestand === "glijdt") {
        // de beweging legt hem op de grond; de spil draait terug en zakt naar heuphoogte
        const sn = Math.hypot(x.v.x, x.v.z);
        if (sn > 0) { const n = Math.max(0, sn - 7 * dt) / sn; x.v.x *= n; x.v.z *= n; }
        o.position.x += x.v.x * dt; o.position.z += x.v.z * dt;
        const k = Math.min(1, x.t * 5);
        o.rotation.x = THREE.MathUtils.lerp(x.rx, 0, k); o.rotation.z = THREE.MathUtils.lerp(x.rz, 0, k);
        o.position.y = THREE.MathUtils.lerp(o.position.y, x.h, k);
        if (x.t > 2.4) { x.toestand = "opstaan"; x.t = 0; m.zet("opstaan", 1, 0); }
      } else if (x.toestand === "opstaan") {
        // draai naar de flat
        const doel = Math.atan2(oog.x - o.position.x, oog.z - o.position.z);
        let d = doel - o.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
        o.rotation.y += d * Math.min(1, dt * 2);
        if (x.t > 1.3 && x.vlucht) {
          // van de fiets geslagen: wegrennen, van jou af
          x.toestand = "rent"; x.t = 0; m.zet("rennen");
          o.rotation.y = Math.atan2(o.position.x - loop.pos.x, o.position.z - loop.pos.z) + tussen(-0.4, 0.4);
        } else if (x.t > 1.3) { x.toestand = "boos"; x.t = 0; m.zet("boos"); }
      } else if (x.toestand === "boos") {
        if (x.t > 3.2) { x.toestand = "loopt"; x.t = 0; o.rotation.y += Math.PI + tussen(-0.6, 0.6); m.zet("lopen"); }
      } else if (x.toestand === "rent") {
        o.position.x += Math.sin(o.rotation.y) * 3.6 * dt; o.position.z += Math.cos(o.rotation.y) * 3.6 * dt;
        if (x.t > 9) { vallers.splice(vallers.indexOf(x), 1); scene.remove(o); }
      } else if (x.toestand === "loopt") {
        o.position.x += Math.sin(o.rotation.y) * 1.3 * dt; o.position.z += Math.cos(o.rotation.y) * 1.3 * dt;
        if (x.t > 18) { vallers.splice(vallers.indexOf(x), 1); scene.remove(o); }
      }
    }
  }
}
function opruimen(obj, na) { setTimeout(() => { scene.remove(obj); const i = stil.findIndex((s) => s.groep === obj); if (i >= 0) stil.splice(i, 1); }, na * 1000); }
/** De accu van een fatbike die al op de grond ligt: een knal, de fiets vliegt de lucht in en de berijders die er nog bij zijn ook. */
function wrakOntploft(w, p) {
  const i = stil.indexOf(w); if (i < 0) return; stil.splice(i, 1);
  const g = w.groep, fiets = w.object;
  spel.rondeScore += 150; spel.laatste = { deel: "accu", soort: "wrak", p: p.toArray().map((v) => +v.toFixed(2)) };
  fx.ontploffing(p); geluid.boem(afstandVol(p) * 1.4); fx.brand(fiets, 10);
  for (const wi of fiets.userData.wielen) { wi.material = wi.material.clone(); wi.material.color?.set("#444"); }
  const oud = vallers.findIndex((x) => x.obj === g); if (oud >= 0) vallers.splice(oud, 1);
  vallers.push({ obj: g, v: new THREE.Vector3(tussen(-1, 1), 6.5, tussen(-1, 1)), w: new THREE.Vector3(tussen(-4, 4), tussen(-3, 3), tussen(-5, 5)), soort: "fiets", r: 0.25 });
  // de berijders die er nog bij liggen, staan of lopen
  for (const x of vallers) {
    if (x.soort !== "mens" || x.toestand === "vliegt" || x.toestand === "rent") continue;
    const dx = x.obj.position.x - p.x, dz = x.obj.position.z - p.z, d = Math.hypot(dx, dz) || 1;
    if (d > 6) continue;
    Object.assign(x, { toestand: "vliegt", t: 0.4, vlucht: true });
    x.v.set((dx / d) * tussen(2, 4), tussen(7, 9.5), (dz / d) * tussen(2, 4)); x.w.set(tussen(-7, 7), tussen(-2, 2), tussen(-3, 3));
    x.m.zet("vliegen", 1, 0);
  }
  // en omstanders vlakbij
  for (const r of reizigers) { const d = Math.hypot(r.pos.x - p.x, r.pos.z - p.z); if (d < 3.5 && r.m && r.groep && !r.fiets && !r.wordBoos) werp(r, p, 1.1); else if (d < 14) r.schrikken?.(); }
  tekenHud();
}

// ---------- besturing ----------
const RICHT = { pitchMin: -0.95, pitchMax: 0.3, yawMax: 1.35 };
const vingers = new Map();
let knijp = null;
function fov() { return loop.aan ? (rij.aan ? 55 + Math.min(13, Math.abs(rij.v)) : loop.mikken ? CAMERA.richten.fov : loop.snelheid > 4.5 ? CAMERA.sprint.fov : CAMERA.lopen.fov) : 55 / kijk.zoom; }
function zetZoom(z) {
  kijk.zoom = loop.aan ? 1 : THREE.MathUtils.clamp(z, 1, 40); // lopend geen kijker
  if (kijk.zoom > 1.5) kijk.scoopZoom = kijk.zoom;
  const scoop = kijk.zoom > 1.5;
  document.body.classList.toggle("scoop", scoop);
  $("#zoomWaarde").textContent = `${kijk.zoom.toFixed(kijk.zoom < 10 ? 1 : 0)}×`;
  $("#zoom").style.setProperty("--p", zoomNaarSchuif(kijk.zoom) / 1000);
}
function draai(dx, dy) {
  const k = (fov() * Math.PI) / 180 / innerHeight;
  kijk.yaw -= dx * k * KIJKEN.gevoeligheid; kijk.pitch -= dy * k * KIJKEN.gevoeligheid;
  if (loop.aan) { kijk.pitch = THREE.MathUtils.clamp(kijk.pitch, KIJKEN.omlaag, KIJKEN.omhoog); loop.keek = performance.now(); return; } // lopend kijk je vrij rond
  let d = kijk.yaw - kijk.basisYaw; d = Math.atan2(Math.sin(d), Math.cos(d));
  kijk.yaw = kijk.basisYaw + THREE.MathUtils.clamp(d, -RICHT.yawMax, RICHT.yawMax);
  const soort = standen[standNr]?.soort;
  kijk.pitch = THREE.MathUtils.clamp(kijk.pitch, soort === "dak" ? -1.3 : soort === "grond" ? -0.4 : RICHT.pitchMin, RICHT.pitchMax);
}
const doek = renderer.domElement;
/**
 * Slepen op een element, met een vinger of de muis. Elke vinger wordt apart gevolgd (touch-events met hun eigen nummer),
 * zodat lopen, kijken en schieten tegelijk kunnen. h = { start(p), beweeg(p), einde(p) } met p.clientX/clientY.
 */
function sleepbaar(el, h) {
  let id = null;
  el.addEventListener("touchstart", (e) => {
    e.preventDefault(); e.stopPropagation();
    if (id !== null && ![...e.touches].some((t) => t.identifier === id)) id = null; // loslaten gemist
    if (id !== null) return;
    const t = e.changedTouches[0]; id = t.identifier; h.start?.(t); h.beweeg?.(t);
  }, { passive: false });
  el.addEventListener("touchmove", (e) => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === id) h.beweeg?.(t); }, { passive: false });
  const eind = (e) => { for (const t of e.changedTouches) if (t.identifier === id) { id = null; h.einde?.(t); } };
  el.addEventListener("touchend", eind); el.addEventListener("touchcancel", eind);
  el.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation(); h.start?.(e); h.beweeg?.(e);
    const mv = (m) => h.beweeg?.(m), up = (m) => { removeEventListener("mousemove", mv); removeEventListener("mouseup", up); h.einde?.(m); };
    addEventListener("mousemove", mv); addEventListener("mouseup", up);
  });
}
// kijken: vingers op het beeld zelf. Eén vinger = draaien, twee = knijpen om te zoomen.
const sync = (e) => { for (const k of [...vingers.keys()]) if (![...e.touches].some((t) => t.identifier === k)) vingers.delete(k); if (vingers.size < 2) knijp = null; };
doek.addEventListener("touchstart", (e) => {
  e.preventDefault(); sync(e);
  for (const t of e.changedTouches) vingers.set(t.identifier, { x: t.clientX, y: t.clientY });
  if (vingers.size === 2) { const [a, b] = [...vingers.values()]; knijp = { d: Math.hypot(a.x - b.x, a.y - b.y), z: kijk.zoom }; }
}, { passive: false });
doek.addEventListener("touchmove", (e) => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    const v = vingers.get(t.identifier);
    if (!v) continue;
    const dx = t.clientX - v.x, dy = t.clientY - v.y;
    v.x = t.clientX; v.y = t.clientY;
    if (vingers.size === 2 && knijp) { const [a, b] = [...vingers.values()]; zetZoom(knijp.z * (Math.hypot(a.x - b.x, a.y - b.y) / knijp.d)); }
    else if (vingers.size === 1) draai(dx, dy);
  }
}, { passive: false });
for (const n of ["touchend", "touchcancel"]) doek.addEventListener(n, (e) => { for (const t of e.changedTouches) vingers.delete(t.identifier); if (vingers.size < 2) knijp = null; });
// muis: slepen = kijken, korte klik = actie, rechtsklik = kijker
let muis = null;
doek.addEventListener("mousedown", (e) => {
  if (e.button === 2) return zetZoom(kijk.zoom > 1.5 ? 1 : kijk.scoopZoom);
  muis = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() };
});
addEventListener("mousemove", (e) => { if (!muis) return; draai(e.clientX - muis.x, e.clientY - muis.y); muis.x = e.clientX; muis.y = e.clientY; });
addEventListener("mouseup", (e) => {
  if (muis && e.button === 0 && Math.hypot(e.clientX - muis.sx, e.clientY - muis.sy) < 5 && performance.now() - muis.t < 400) actie();
  muis = null;
});
doek.addEventListener("contextmenu", (e) => e.preventDefault());
addEventListener("wheel", (e) => { zetZoom(kijk.zoom * Math.exp(-e.deltaY * 0.0015)); }, { passive: true });
addEventListener("keydown", (e) => {
  if (e.repeat) return;
  loop.toets[e.code] = true;
  if (e.code === "Space" || e.code === "KeyF" || e.code === "Enter") actie();
  if (e.code === "KeyQ") zetZoom(kijk.zoom > 1.5 ? 1 : kijk.scoopZoom);
  if (e.code === "KeyG") zetLopen(!loop.aan);
  if (e.code === "KeyX" || e.code === "ControlLeft") zetMikken(!loop.mikken);
  if (e.code === "Tab" || e.code === "KeyR") { e.preventDefault(); volgendWapen(); }
  const nr = ["Digit1", "Digit2", "Digit3"].indexOf(e.code);
  if (nr >= 0 && wapens()[nr]) zetWapen(wapens()[nr]);
});
addEventListener("keyup", (e) => { loop.toets[e.code] = false; });
const knop = (sel, neer, op) => {
  const el = $(sel);
  sleepbaar(el, { start: () => { el.classList.add("in"); neer?.(); }, einde: () => { el.classList.remove("in"); op?.(); } });
};
knop("#vuur", () => { vuurVast = true; actie(); }, () => { vuurVast = false; });
knop("#hoger", () => wisselStand(1));
knop("#loopKnop", () => zetLopen(!loop.aan));
knop("#wapen", () => { if (loop.aan) return volgendWapen(); openKast(); });
knop("#instap", () => (rij.aan ? stapUit() : stapIn()));
addEventListener("keydown", (e) => { if (!e.repeat && e.code === "KeyT" && loop.aan) rij.aan ? stapUit() : stapIn(); });
knop("#richt", () => ((karateka && loop.aan) ? sla("trap") : zetMikken(!loop.mikken)));
addEventListener("keydown", (e) => { if (!e.repeat && loop.aan && (karateka && loop.aan)) { if (e.code === "KeyJ") sla("vuist"); if (e.code === "KeyK") sla("trap"); } });
knop("#sprint", () => { loop.sprint = !loop.sprint; });
// in de auto: gaspedaal en rem (ingedrukt houden), en de claxon
$("#optieKnop").addEventListener("click", () => { alleenGeluid = false; tekenOpties(); $("#opties").hidden = !$("#opties").hidden; });
knop("#geluidKnop", () => { geluid.start(); alleenGeluid = true; tekenOpties(); $("#opties").hidden = false; });
$("#optieDicht").addEventListener("click", () => { $("#opties").hidden = true; });
knop("#gas", () => { rij.gas = true; }, () => { rij.gas = false; });
knop("#rem", () => { rij.rem = true; }, () => { rij.rem = false; });
knop("#claxon", () => geluid.toeter(1));
// stuurknuppel: verschijnt waar je links je duim neerzet (zoals bij GTA op de telefoon)
{
  const vlak = $("#loopVlak"), st = $("#stick"), duim = $("#stickDuim"), R = 56;
  let o = null;
  sleepbaar(vlak, {
    start: (p) => { o = { x: p.clientX, y: p.clientY }; st.style.left = `${o.x - R}px`; st.style.top = `${o.y - R}px`; st.style.bottom = "auto"; st.classList.add("vast"); },
    beweeg: (p) => {
      if (!o) return;
      let x = (p.clientX - o.x) / R, y = -(p.clientY - o.y) / R;
      const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
      loop.stick.x = x; loop.stick.y = y;
      duim.style.transform = `translate(${x * R * 0.7}px, ${-y * R * 0.7}px)`;
    },
    einde: () => { o = null; loop.stick.x = loop.stick.y = 0; duim.style.transform = ""; st.classList.remove("vast"); st.style.left = st.style.top = st.style.bottom = ""; },
  });
}
knop("#lager", () => wisselStand(-1));
addEventListener("keydown", (e) => { if (e.code === "PageUp" || e.code === "KeyE") wisselStand(1); if (e.code === "PageDown" || e.code === "KeyC") wisselStand(-1); });
// schuif: onderste 8% = gewoon kijken, daarboven 2× tot 40×, logaritmisch (fijn bij weinig zoom)
const ZMAX = 40, ZMIN = 2, ONDER = 80;
const schuifNaarZoom = (v) => (v < ONDER ? 1 : ZMIN * Math.pow(ZMAX / ZMIN, (v - ONDER) / (1000 - ONDER)));
function zoomNaarSchuif(z) { return z < 1.5 ? 0 : ONDER + ((1000 - ONDER) * Math.log(z / ZMIN)) / Math.log(ZMAX / ZMIN); }
// eigen verticale schuif: de plek van je vinger in het vak bepaalt de zoom
{
  const vak = $("#zoom");
  sleepbaar(vak, { beweeg: (e) => {
    const r = vak.getBoundingClientRect();
    zetZoom(schuifNaarZoom(THREE.MathUtils.clamp(1 - (e.clientY - r.top - 18) / Math.max(1, r.height - 36), 0, 1) * 1000));
  } });
}
$("#begin").addEventListener("click", begin);
// level kiezen: een ander level laadt een andere wereld, dus de pagina opnieuw
$("#kooiKnop").addEventListener("click", () => { location.href = `./kooi.html?v=${window.VERSIE ?? ""}`; });
for (const b of document.querySelectorAll("#levels button[data-level]")) b.addEventListener("click", () => {
  if (b.dataset.level === LOCATIE) return;
  localStorage.setItem("fbs-level", b.dataset.level);
  location.replace(`./?level=${b.dataset.level}&v=${window.VERSIE ?? ""}`);
});

// ---------- nieuwe versie? ----------
// Een app op het beginscherm van de iPhone blijft vaak de oude pagina tonen. Daarom vragen we bij het openen
// en elke keer dat het spel weer naar voren komt versie.json op (zonder cache). Is die anders, dan laden we
// opnieuw met de nieuwe versie in het adres, zodat de browser alles vers ophaalt. Nooit midden in een ronde.
let nieuweVersie = null;
async function kijkVersie() {
  try {
    const r = await fetch(`versie.json?t=${Date.now()}`, { cache: "no-store" });
    const { versie } = await r.json();
    if (versie && window.VERSIE && versie !== window.VERSIE) { nieuweVersie = versie; ververs(); }
  } catch {}
}
function ververs() {
  if (!nieuweVersie || spel.bezig) return;
  location.replace(`./?v=${nieuweVersie}&level=${LOCATIE}`);
}
$("#versie").textContent = (window.VERSIE_DATUM ? `Versie van ${window.VERSIE_DATUM}` : "") + (licht ? " · lichte weergave" : "") + (localStorage.getItem("fbs-beeldweg") ? ` · beeld weg: ${localStorage.getItem("fbs-beeldweg")}×` : "");
kijkVersie();
document.addEventListener("visibilitychange", () => { if (!document.hidden) kijkVersie(); });
addEventListener("pageshow", (e) => { if (e.persisted) kijkVersie(); });
$("#volgende").addEventListener("click", () => {
  if (nieuweVersie) return ververs(); $("#einde").hidden = true; $("#start").hidden = false; toonStart(); });
addEventListener("resize", () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// ---------- detail: dichtbij (of in de kijker) de fijne mens, ver weg de lichte ----------
const dp = new THREE.Vector3();
function zetDetail() {
  const z = kijk.zoom > 1.5 ? kijk.zoom : 1;
  const alle = [];
  const meet = (m) => { m.object.getWorldPosition(dp); alle.push([dp.distanceTo(camera.position), m]); };
  for (const r of reizigers) { if (r.m) meet(r.m); if (r.berijders) r.berijders.forEach(meet); }
  for (const x of vallers) if (x.m) meet(x.m);
  // de zware versie alleen voor wie dichtbij is (of groot in de kijker), en nooit meer dan een handvol tegelijk:
  // op straat staan er anders tientallen mensen om je heen in volle kwaliteit
  alle.sort((a, b) => a[0] - b[0]);
  const max = licht ? 6 : telefoon ? 10 : 24;
  alle.forEach(([d, m], i) => m.detail(i < max && (d / z < 30 || d < 14), !licht && d < 70));
  if (schutter) schutter.detail(true, !licht);
}

// ---------- meevolgen ----------
let volg = null;
const hoekNaar = (p) => [Math.atan2(p.x - camera.position.x, p.z - camera.position.z), Math.atan2(p.y - camera.position.y, Math.hypot(p.x - camera.position.x, p.z - camera.position.z))];
function volgDoel() {
  const grens = 0.35 * (fov() * Math.PI / 180); // binnen ongeveer een derde van het beeld
  let best = null;
  for (const r of reizigers) {
    if (!r.fat || (r.toestand && r.toestand !== "rijden")) continue;
    const p = r.pos.clone(); p.y = 0.8;
    const [y, x] = hoekNaar(p);
    let dy = y - kijk.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const d = Math.hypot(dy, x - kijk.pitch);
    if (d < grens && (!best || d < best.d)) best = { r, d, y, x };
  }
  if (best && volg?.r === best.r) {
    let dy = best.y - volg.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    // alleen kleine stapjes volgen: verspringt de fatbike (opnieuw verschenen), dan niet meedraaien
    if (Math.abs(dy) < 0.02 && Math.abs(best.x - volg.x) < 0.02) { kijk.yaw += dy * 0.85; kijk.pitch += (best.x - volg.x) * 0.85; }
  }
  volg = best ? { r: best.r, y: best.y, x: best.x } : null;
}

// ---------- lus ----------
const klok = new THREE.Timer();
let tijd = 0;
function lus() {
  klok.update();
  const echt = Math.min(klok.getDelta(), 0.05);
  tijdSchaal = THREE.MathUtils.lerp(tijdSchaal, filmCam ? 0.18 : 1, Math.min(1, echt * 8));
  const dt = echt * tijdSchaal;
  tijd += dt;

  // spel
  if (spel.bezig && !filmCam) {
    if (spel.modus === "bonus") {
      spel.tijd -= echt;
      if (Math.floor(spel.tijd) !== spel.klokTik) { spel.klokTik = Math.floor(spel.tijd); tekenHud(); }
      if (spel.tijd <= 0) eindeBonus();
    } else if (spel.ri.tijd) {
      // tijdslimiet aangezet: de ronde moet binnen de tijd af
      spel.tijd -= echt;
      if (Math.floor(spel.tijd) !== spel.klokTik) { spel.klokTik = Math.floor(spel.tijd); tekenHud(); }
      if (spel.tijd <= 0) eindeRonde(false, "De tijd is om.");
    }
    // kogels op en er rijden nog fatbikes rond
    // (op straat heb je ook je vuisten en je mes, dus daar eindigt de ronde niet)
    if (spel.kogels <= 0 && !kogels.length && spel.geraakt < spel.ri.fatbikes && !loop.aan) eindeRonde(false, "Je kogels zijn op.");
    const actief = reizigers.filter((r) => r.fat && !r.missie).length;
    if (actief < spel.ri.tegelijk && spel.gespawnd < spel.ri.fatbikes && Math.random() < echt * 0.6) nieuweFatbike();
    // staat er niets op het plein, dan komt er een aanrijden
    const dichtbij = spel.modus === "bonus" || reizigers.some((r) => r.fat && !r.missie && Math.hypot(r.pos.x - graaf.c[0], r.pos.z - graaf.c[1]) < 60);
    spel.leeg = dichtbij ? 0 : (spel.leeg ?? 0) + echt;
    if (spel.leeg > 6) {
      spel.leeg = 0;
      const f = reizigers.find((r) => r.fat && !r.missie && !(r.toestand && r.toestand !== "rijden"));
      if (f) { f.van = graaf.startKnoop(8, 60, 35); const v = graaf.volgende(-1, f.van, 8, 2, 65); if (v) { f.naar = v.n; f.breed = v.breed; f.t = 0; f.plaats(true); } }
      else if (spel.gespawnd < spel.ri.fatbikes) nieuweFatbike();
    }
  }
  for (const r of reizigers) {
    r.stap(dt, spel);
    if (r.verAf?.() && !(r.toestand && r.toestand !== "rijden")) {
      // te ver achtergebleven: opnieuw de buurt in, bij voorkeur buiten beeld (achter je, of ver genoeg weg)
      const R = r.bereik(), min = r.mens ? (loop.aan ? 18 : 0) : R * 0.6;
      const cyw = Math.sin(kijk.yaw), czw = Math.cos(kijk.yaw);
      for (let i = 0; i < 8; i++) {
        r.van = graaf.startKnoop(r.bit, R * 0.95, min);
        if (!loop.aan) break;
        const dx = graaf.k[r.van][0] - loop.pos.x, dz = graaf.k[r.van][1] - loop.pos.z, d = Math.hypot(dx, dz) || 1;
        if (d > 34 || (dx * cyw + dz * czw) / d < 0.35) break;
      }
      const v = graaf.volgende(-1, r.van, r.bit, 1, R);
      if (v) { r.naar = v.n; r.breed = v.breed; r.t = 0; r.plaats(true); }
    }
    if (!r.fat && r instanceof Fietser && Math.random() < dt * 0.01) geluid.bel(afstandVol(r.pos));
  }
  // klaar met boodschappen of weggerend: opruimen en een nieuwe laten komen
  for (const r of [...reizigers]) if (r.klaar || r.weg) {
    scene.remove(r.object); reizigers.splice(reizigers.indexOf(r), 1);
    if (r instanceof Boodschapper) nieuweBoodschapper();
  }
  // op de grond: je gluurt over het muurtje, met de kijker kom je omhoog
  if (loop.aan) { stapLopen(echt); $("#sprint").classList.toggle("aan", loop.sprint); $("#richt").classList.toggle("aan", loop.mikken); }
  spel.speler = loop.aan ? loop.pos : null; spel.aangereden = klapKrijgen; spel.toeter = () => geluid.toeter(1);
  spel.zichtVrij = zichtVrij;
  // hangjeugd komt dreigend op je af als je in karatepak buiten loopt
  spel.dreig = !!(karateka && loop.aan && !rij.aan && !(loop.boeien > 0)); spel.vrij = (x, z) => !geblokkeerd(x, z);
  spel.schreeuw = (p) => geluid.schreeuw(afstandVol(p) * 1.6);
  spel.hangVecht = () => reizigers.filter((r) => r.hang && r.ruzieT > 0 && r.ruzieSlaat).length;
  spel.aangehouden = (agent) => { if (!(rij.aan && Math.abs(rij.v) > 1.5)) arresteer(agent); }; // uit een rijdende auto halen ze je niet
  // lig je op de grond en staat er een agent bij, dan ben je erbij
  if (loop.aan && loop.neer > 0 && !(loop.boeien > 0)) { const a = reizigers.find((r) => r.soort === "agent" && !r.afdruipen && !(r.ruzieNeer > 0) && r.pos.distanceTo(loop.pos) < 3); if (a) arresteer(a); }
  straat.stap(echt, tijd);
  tekenRadar();
  // hangjeugd die is weggerend komt na een tijdje terug (niet vlak voor je neus)
  if (data.hangjeugd && (spel.hangT = (spel.hangT ?? 6) - echt) <= 0) {
    spel.hangT = 6;
    if (reizigers.filter((r) => r.hang).length < spel.hangplekken.length * 3) {
      const h = kies(spel.hangplekken);
      if (!loop.aan || Math.hypot(h.x - loop.pos.x, h.z - loop.pos.z) > 14) nieuweGroep(h);
    }
  }
  // geluid om je heen: vogels (of kraaien in de winter), en het zoemen van een fatbike die dichtbij rijdt
  geluid.sfeerStap(echt);
  if ((spel.drukT = (spel.drukT ?? 0) - echt) <= 0) {
    // geroezemoes: hoe meer mensen dicht bij je (of bij het plein waar je op uitkijkt), hoe harder
    spel.drukT = 0.5;
    const px = loop.aan ? loop.pos.x : graaf.c[0], pz = loop.aan ? loop.pos.z : graaf.c[1], R = loop.aan ? 18 : 45;
    let n = 0; for (const r of reizigers) if (r.ruzie && Math.hypot(r.pos.x - px, r.pos.z - pz) < R) n++;
    geluid.drukte((n / (loop.aan ? 14 : 45)) * (loop.aan ? 1 : 0.6));
  }
  {
    let dichtst = 1e9, vaart = 0;
    if (loop.aan && !rij.aan) for (const r of reizigers) if (r.fat && r.toestand === "rijden" && r.snelheid > 0.5) { const d = r.pos.distanceTo(loop.pos); if (d < dichtst) { dichtst = d; vaart = r.snelheid; } }
    geluid.zoem(Math.max(0, 1 - dichtst / 26) ** 2, vaart);
  }
  $("#pijn").style.opacity = loop.aan ? (3 - loop.conditie) * 0.3 : 0;
  // de wereld schuift met je mee als je loopt: scherpe grond, geparkeerde auto's en de drukte op straat
  graaf.krap = loop.aan ? 0.62 : 1; // op straat blijft de drukte dicht om je heen; vanaf het balkon verspreid over het plein
  if (loop.aan) { wereld.bij(loop.pos.x, loop.pos.z); graaf.c[0] = loop.pos.x; graaf.c[1] = loop.pos.z; }
  else if (graaf.c[0] || graaf.c[1]) { graaf.c[0] = graaf.c[1] = 0; wereld.bij(0, 0, true); }
  zetDetail();
  if (vuurVast && huidigWapen() === "mg") vuurMg();
  if (vuurVast && huidigWapen() === "vlam") vuurVlam(echt); else geluid.vlam(false);
  stapKogels(dt);
  stapVuurwerk(dt);
  stapVallers(dt);
  fx.stap(dt);

  herlaad = Math.max(0, herlaad - echt);
  $("#vuur").classList.toggle("laadt", herlaad > 0);
  terugslag = Math.max(0, terugslag - echt * 3.5);

  // camera
  camera.fov = THREE.MathUtils.lerp(camera.fov, fov(), Math.min(1, echt * 14));
  if (filmCam) {
    filmCam.t += echt;
    const p = new THREE.Vector3(); filmCam.doel.getWorldPosition(p);
    const r = 6, h = Math.atan2(camera.position.x - p.x, camera.position.z - p.z) + filmCam.kant * (1.1 + filmCam.t * 0.25);
    const cam = filmCam.cam ?? (filmCam.cam = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 1500));
    cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix();
    cam.position.set(p.x + Math.sin(h) * r, 1.8 + filmCam.t * 0.4, p.z + Math.cos(h) * r);
    cam.lookAt(p.x, 0.8, p.z);
    document.body.classList.add("film");
    if (filmCam.t > filmCam.duur) { filmCam = null; document.body.classList.remove("film"); }
  }
  const scoop = kijk.zoom > 1.5;
  // door de kijker staat niets dichtbij: een verder voorvlak geeft een scherper dieptebeeld (geen geflikker van vlakken)
  const voorvlak = scoop ? 1.2 : 0.15;
  if (camera.near !== voorvlak) { camera.near = voorvlak; camera.updateProjectionMatrix(); }
  // meevolgen: staat het vizier op een fatbike, dan draait het een beetje met hem mee
  if (scoop && !filmCam) volgDoel();
  else volg = null;
  // stabiel vizier: alleen een rustige ademhaling, iets op en neer
  const zwaai = scoop ? 0.0009 / Math.sqrt(kijk.zoom) : 0;
  const sy = zwaai * 0.25 * Math.sin(tijd * 0.37);
  const sp = zwaai * Math.sin(tijd * 1.6);
  const e = new THREE.Euler(kijk.pitch + sp + terugslag * 0.035 * (scoop ? 1 : 0.5), kijk.yaw + Math.PI + sy, 0, "YXZ");
  camera.quaternion.setFromEuler(e);
  camera.updateProjectionMatrix();
  // door de kijker kijk je vanuit je eigen ogen; anders sta je in beeld en kijk je over je schouder mee
  const st = standen[standNr];
  if (schutter && loop.aan && rij.aan) {
    // in de auto: je zit achter het stuur; de camera hangt achter de auto en gaat verder weg als je hard rijdt
    const a = rij.auto, u = a.userData, [sx, sy, sz] = u.stoel ?? [0.36, 0.4, 0];
    a.updateMatrixWorld(true);
    schutter.zet("fietsen"); schutter.mixer.update(echt);
    schutter.object.position.copy(a.localToWorld(new THREE.Vector3(sx, sy - schutter.zithoogte(), -sz)));
    schutter.object.rotation.set(0, rij.richting, 0);
    schutter.object.visible = true; geweer.visible = pistool.visible = mes.visible = knuppel.visible = false; $("#slot").hidden = true;
    for (const m of Object.values(kast.mesh)) m.visible = false;
    const cy = Math.sin(kijk.yaw), cz = Math.cos(kijk.yaw), cp = Math.cos(kijk.pitch);
    loop.camDoel.lerp(new THREE.Vector3(a.position.x, 1.5, a.position.z), 1 - Math.exp(-echt * 12));
    const terug = new THREE.Vector3(-cy * cp, -Math.sin(kijk.pitch), -cz * cp);
    let afst = 6.2 + Math.abs(rij.v) * 0.14;
    ray.set(loop.camDoel, terug); ray.far = afst + 0.3;
    const muur = ray.intersectObjects(wereld.botsers, false)[0];
    if (muur) afst = Math.max(2.5, muur.distance - 0.3);
    loop.camAfst += (afst - loop.camAfst) * Math.min(1, echt * (afst < loop.camAfst ? 20 : 4));
    camera.position.copy(loop.camDoel).addScaledVector(terug, loop.camAfst);
    if (camera.position.y < 0.4) camera.position.y = 0.4;
  } else if (schutter && loop.aan) {
    // lopen: je ziet jezelf van achteren; het geweer laag, of in de aanslag vlak na een schot
    const L = loop, zwaar = ZWAAR.has(L.wapen), richtend = (L.richt > 0 || L.mikken || zwaar) && L.neer <= 0 && L.slag <= 0;
    const kijkt = richtend ? kijk.yaw : L.richting;
    schutter.object.position.copy(L.pos);
    schutter.object.rotation.set(0, kijkt, 0);
    // de beweging loopt op het tempo van je vaart, zodat je voeten niet over de grond glijden
    if (L.neer <= 0 && L.slag <= 0 && L.wankel <= 0) {
      const v = L.snelheid;
      if (richtend && (L.wapen === "pistool" || zwaar) && v <= 0.25) schutter.zet("richten");
      else if (L.wapen === "knuppel" && v <= 0.25) schutter.zet("knuppel");
      else if ((karateka && loop.aan) && v <= 0.25 && reizigers.some((r) => r.ruzieT > 0 && !(r.ruzieNeer > 0) && r.pos.distanceToSquared(L.pos) < 36)) schutter.zet("k_idle"); // kamae: klaar voor de volgende
      else if (v > 4.6) schutter.zet("sprinten", v / 5.6); else if (v > 2.3) schutter.zet("rennen", v / 3.3); else if (v > 0.25) schutter.zet("lopen", THREE.MathUtils.clamp(v / 1.4, 0.7, 1.5)); else schutter.zet("staan");
    }
    schutter.mixer.update(echt);
    schutter.object.updateMatrixWorld(true);
    schutter.object.visible = true;
    // het geweer blijft bij het raam; in je hand heb je het pistool of het mes (of niets: vuisten)
    geweer.visible = false;
    const ding = L.neer > 0 || L.boeien > 0 ? null : L.wapen === "pistool" ? pistool : L.wapen === "mes" ? mes : L.wapen === "knuppel" ? knuppel : zwaar || GOOI.has(L.wapen) ? kast.mesh[L.wapen] ?? null : null;
    pistool.visible = ding === pistool; mes.visible = ding === mes; knuppel.visible = ding === knuppel;
    for (const m of Object.values(kast.mesh)) m.visible = ding === m && !(GOOI.has(L.wapen) && L.slag > 0); // tijdens de worp is je hand leeg
    schutter.los("DEF-spine002"); schutter.los("DEF-shoulderR");
    if (L.boeien > 0 && L.boeien < 3.1) {
      // handen op de rug, de boeien om je polsen
      const bx = Math.sin(L.richting), bz = Math.cos(L.richting), heup = schutter.plek("DEF-hips");
      const links = new THREE.Vector3(bz, 0, -bx), rug = new THREE.Vector3(-bx, 0, -bz);
      for (const [k, z] of [["L", 1], ["R", -1]]) schutter.arm(k, heup.clone().addScaledVector(rug, 0.19).addScaledVector(links, z * 0.05).add(new THREE.Vector3(0, 0.05, 0)), rug.clone().multiplyScalar(0.7).addScaledVector(links, z).add(new THREE.Vector3(0, -0.2, 0)));
      boeiMesh.visible = true;
      boeiMesh.position.copy(schutter.plek("DEF-handL")).lerp(schutter.plek("DEF-handR"), 0.5).add(new THREE.Vector3(0, 0.03, 0));
      boeiMesh.rotation.y = L.richting;
    } else if (boeiMesh) boeiMesh.visible = false;
    if (ding) {
      const fx = Math.sin(kijkt), fz = Math.cos(kijkt);
      if (zwaar && richtend) {
        // een lang wapen: in de schouder, met twee handen; je bovenlijf gaat mee omhoog of omlaag
        const plat = new THREE.Vector3(fx, 0, fz), dir = new THREE.Vector3(fx * Math.cos(kijk.pitch), Math.sin(kijk.pitch), fz * Math.cos(kijk.pitch));
        schutter.buig("DEF-spine002", plat, plat.clone().lerp(dir, 0.45));
        legAan(schutter, ding, L.wapen, kijkt, kijk.pitch);
      } else if (ding === pistool && richtend) {
        // arm gestrekt naar waar je mikt
        const dir = new THREE.Vector3(fx * Math.cos(kijk.pitch), Math.sin(kijk.pitch), fz * Math.cos(kijk.pitch));
        // je bovenlijf gaat mee omhoog of omlaag, en je schouder komt naar voren: zo komt de arm echt uit je schouder
        const plat = new THREE.Vector3(fx, 0, fz);
        schutter.buig("DEF-spine002", plat, plat.clone().lerp(dir, 0.45));
        const sleutel = schutter.plek("DEF-shoulderR"), kop = schutter.plek("DEF-upper_armR").sub(sleutel);
        schutter.buig("DEF-shoulderR", kop, kop.clone().addScaledVector(dir, kop.length() * 0.55));
        const schouder = schutter.plek("DEF-upper_armR");
        // met twee handen, het pistool iets naar het midden
        const links = new THREE.Vector3(fz, 0, -fx);
        schutter.arm("R", schouder.clone().addScaledVector(dir, 0.52).addScaledVector(links, 0.13), new THREE.Vector3(0, -1, 0).addScaledVector(links, -0.5));
        schutter.arm("L", schutter.plek("DEF-handR").addScaledVector(links, 0.05).add(new THREE.Vector3(0, -0.03, 0)), new THREE.Vector3(0, -1, 0).addScaledVector(links, 0.6));
        ding.position.copy(schutter.plek("DEF-handR")).addScaledVector(dir, 0.06);
        ding.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      } else if (ding === knuppel) {
        // in de vuist, dwars op de hand (zoals je een knuppel of een zwaard vasthoudt)
        let hb = null; schutter.object.traverse((o) => { if (o.isBone && o.name === "DEF-handR") hb = o; });
        const q = hb.getWorldQuaternion(new THREE.Quaternion()), as = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
        ding.position.copy(schutter.plek("DEF-handR")).addScaledVector(new THREE.Vector3(0, 1, 0).applyQuaternion(q), 0.07);
        ding.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), as);
      } else {
        // in de hand, in het verlengde van je onderarm
        const hand = schutter.plek("DEF-handR"), elleboog = schutter.plek("DEF-forearmR");
        const langs = hand.clone().sub(elleboog).normalize();
        ding.position.copy(hand).addScaledVector(langs, 0.07);
        ding.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), langs);
      }
    }
    // camera achter je, iets over de rechterschouder. Ze veert mee (loopt een fractie achter), komt dichterbij als je
    // richt, gaat wat verder weg als je sprint, en schuift naar voren als er een muur achter je staat.
    // De getallen staan in src/config.js (CAMERA en CAMERA_BOTSING).
    const cy = Math.sin(kijk.yaw), cz = Math.cos(kijk.yaw), cp = Math.cos(kijk.pitch);
    const C = L.mikken ? CAMERA.richten : L.snelheid > 4.5 ? CAMERA.sprint : CAMERA.lopen, B = CAMERA_BOTSING;
    L.camZij = (L.camZij ?? C.schouder) + (C.schouder - (L.camZij ?? C.schouder)) * Math.min(1, echt * 8);
    L.camHoog = (L.camHoog ?? C.hoogte) + (C.hoogte - (L.camHoog ?? C.hoogte)) * Math.min(1, echt * 8);
    const doel = new THREE.Vector3(L.pos.x - cz * L.camZij, L.camHoog, L.pos.z + cy * L.camZij);
    // staat er iets tussen jou en het draaipunt (je staat met je rechterschouder tegen een muur), dan schuift het naar je toe
    const naarZij = doel.clone().sub(new THREE.Vector3(L.pos.x, L.camHoog, L.pos.z)), zl = naarZij.length();
    if (zl > 0.05) { ray.set(new THREE.Vector3(L.pos.x, L.camHoog, L.pos.z), naarZij.normalize()); ray.far = zl + 0.25; const h = ray.intersectObjects(wereld.botsers, false)[0]; if (h) doel.set(L.pos.x, L.camHoog, L.pos.z).addScaledVector(naarZij, Math.max(0, h.distance - 0.25)); }
    L.camDoel.lerp(doel, 1 - Math.exp(-echt * C.demping));
    const terug = new THREE.Vector3(-cy * cp, -Math.sin(kijk.pitch), -cz * cp);
    let afst = C.afstand;
    // een "bol" in plaats van één straal: ook stralen links, rechts en boven langs, zodat de camera niet half in een muur hangt
    const rechts = new THREE.Vector3(-cz, 0, cy);
    const camBots = (wereld.camBots ??= wereld.heg ? [...wereld.botsers, wereld.heg] : wereld.botsers);
    for (const [zx, zy] of [[0, 0], [B.bol, 0], [-B.bol, 0], [0, B.bol]]) {
      ray.set(L.camDoel.clone().addScaledVector(rechts, zx).add(new THREE.Vector3(0, zy, 0)), terug); ray.far = C.afstand + B.marge;
      const muur = ray.intersectObjects(camBots, false)[0];
      if (muur) afst = Math.min(afst, muur.distance - B.marge);
    }
    // boomstammen (die zitten niet in de botsvormen): niet met de camera in of achter een stam
    for (const [bx, bz] of wereld.bomen) {
      const dx = bx - L.camDoel.x, dz = bz - L.camDoel.z, langs = dx * terug.x + dz * terug.z;
      if (langs < 0.2 || langs > afst + B.boomstam) continue;
      if (Math.abs(dx * terug.z - dz * terug.x) < B.boomstam) afst = Math.min(afst, langs - B.boomstam);
    }
    afst = Math.max(B.minAfstand, afst);
    L.camAfst += (afst - L.camAfst) * Math.min(1, echt * (afst < L.camAfst ? B.naarVoren : B.terug)); // snel naar voren, rustig terug
    camera.position.copy(L.camDoel).addScaledVector(terug, L.camAfst);
    if (camera.position.y < 0.3) camera.position.y = 0.3;
    // het doelwit van de mikhulp krijgt een markering
    L.doel = L.wapen === "pistool" && L.neer <= 0 ? zoekDoel() : null;
    const slot = $("#slot");
    if (L.doel) {
      const q = L.doel.p.clone().project(camera);
      slot.style.transform = `translate(${(q.x * 0.5 + 0.5) * innerWidth}px, ${(-q.y * 0.5 + 0.5) * innerHeight}px)`;
      slot.hidden = false;
    } else slot.hidden = true;
  } else if (schutter && st) {
    const fx = Math.sin(kijk.yaw), fz = Math.cos(kijk.yaw);
    // staan en (op straat) iets voorover leunen over het muurtje; het lijf staat een stukje achter het oog
    const grond = st.soort === "grond", raam = st.soort === "raam";
    // uit het raam hangen: je voeten staan binnen, je bovenlijf leunt ver over de vensterbank
    const terug = raam ? 0.8 : grond ? 0.3 : 0.15;
    schutter.object.position.set(oog.x - fx * terug, grond ? 0 : oog.y - (raam ? 1.45 : 1.6), oog.z - fz * terug);
    schutter.object.rotation.set(raam ? 0.16 : grond ? 0.14 : 0.05, kijk.yaw, 0, "YXZ");
    schutter.zet("staan");
    schutter.mixer.update(echt);
    schutter.object.updateMatrixWorld(true);
    schutter.los("DEF-spine001"); schutter.los("DEF-neck");
    if (raam) {
      // over de vensterbank: je buigt in je heup naar buiten en kijkt weer op
      const op = new THREE.Vector3(0, 1, 0), buk = (h) => new THREE.Vector3(fx * Math.sin(h), Math.cos(h), fz * Math.sin(h));
      schutter.buig("DEF-spine001", op, buk(0.72));
      schutter.buig("DEF-neck", buk(0.72), buk(0.25));
    }
    // het geweer: kolf tegen de rechterschouder, loop in de kijkrichting, iets naar het midden
    const schouder = schutter.plek("DEF-upper_armR");
    const links = new THREE.Vector3(fz, 0, -fx); // de linkerkant van de schutter (hij kijkt naar +z)
    const dir = new THREE.Vector3(Math.sin(kijk.yaw) * Math.cos(kijk.pitch), Math.sin(kijk.pitch), Math.cos(kijk.yaw) * Math.cos(kijk.pitch));
    schutter.object.visible = !scoop;
    const rw = ZWAAR.has(kast.keuze) && !loop.raamVuurwerk ? kast.mesh[kast.keuze] : null;
    legAan(schutter, rw ?? geweer, rw ? kast.keuze : "geweer", kijk.yaw, kijk.pitch);
    geweer.visible = !scoop && !rw;
    for (const m of Object.values(kast.mesh)) m.visible = !scoop && m === rw;
    pistool.visible = mes.visible = knuppel.visible = false;
    $("#slot").hidden = true;
    if (scoop) camera.position.copy(oog);
    else {
      // over de schouder: per plek een andere afstand en hoogte (op het dak hoger, anders zie je alleen grind)
      const [ach, rechts, op] = CAMERA_STAND[st.soort];
      camera.position.set(oog.x - fx * ach - fz * rechts, oog.y + op, oog.z - fz * ach + fx * rechts);
    }
  }
  // mondingsvuur: een korte, felle flits aan het eind van de loop
  if (flitsT > 0) {
    flitsT -= echt;
    const hw = huidigWapen(), wapen = ZWAAR.has(hw) ? kast.mesh[hw] : loop.aan ? pistool : geweer;
    if (!flits) {
      flits = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color: "#ffe9a8", transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
      const kern = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat), tong = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.22, 8), mat);
      tong.rotation.x = Math.PI / 2; tong.position.z = 0.12; flits.add(kern, tong); scene.add(flits);
    }
    flits.visible = flitsT > 0 && wapen.visible;
    if (flits.visible) { wapen.updateMatrixWorld(true); flits.position.copy(wapen.localToWorld(new THREE.Vector3(0, 0.02, (wapen.userData.loop ?? 0.2) + 0.03))); flits.quaternion.copy(wapen.getWorldQuaternion(new THREE.Quaternion())); flits.scale.setScalar((loop.aan ? 0.7 : 1) * (0.7 + Math.random() * 0.6)); }
  } else if (flits) flits.visible = false;
  // fatbikes markeren (optie): een geel pijltje boven elke rijdende fatbike
  if (opties.markeer || merken.length) {
    let n = 0;
    if (opties.markeer && spel.bezig) for (const r of reizigers) {
      if (!r.fat || r.toestand !== "rijden") continue;
      const m = (merken[n] ??= (() => { const k = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 4), new THREE.MeshBasicMaterial({ color: "#ffc83d", depthTest: false, transparent: true, opacity: 0.9 })); k.rotation.x = Math.PI; k.renderOrder = 9; scene.add(k); return k; })());
      n++; m.visible = true; m.position.set(r.pos.x, 2.25 + Math.sin(tijd * 4 + n) * 0.06, r.pos.z); m.rotation.y = tijd * 2;
      const d = m.position.distanceTo(camera.position); m.scale.setScalar(Math.max(1, d / 22) / (kijk.zoom > 1.5 ? Math.sqrt(kijk.zoom) : 1));
    }
    for (let i = n; i < merken.length; i++) merken[i].visible = false;
  }
  // alleen voor tests: een vaste camera ergens anders
  const vc = window.__spel?.vrijeCamera;
  if (vc) { camera.position.set(...vc.pos); camera.lookAt(...vc.doel); }
  renderer.render(scene, filmCam?.cam ?? camera);

  // prestaties: bij een trage telefoon de resolutie omlaag
  requestAnimationFrame(lus);
}
zetZoom(1);
laad().then(() => requestAnimationFrame(lus)).catch((e) => { $("#laden").textContent = "Laden mislukt: " + e.message; console.error(e); });
window.__spel = { uitAuto, get muziek() { return muziek; }, geluid, opties, kast, openKast, ontplof, vuurMg, vuurRaket, vuurVlam, kogels, get schutter() { return schutter; }, vuurwerk, stapVuurwerk, karate: () => Object.keys(TECHNIEK), spel, reizigers, stil, uitAuto, verlaten, get herlaad() { return herlaad; }, kijk, camera, oog, loop, rij, stapIn, stapUit, stapLopen, get straat() { return straat; }, get graaf() { return graaf; }, zetLopen, sla, actie, zetWapen, klapKrijgen, vallers, schiet, begin, zetZoom, draai, scene, renderer, stand: () => standen[standNr]?.naam };
