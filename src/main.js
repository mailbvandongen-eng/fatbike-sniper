// Fatbike Sniper: hoofdlus, camera, besturing, schieten, rondes.
import * as THREE from "three";
import { bouwWereld, zetFietsenInRekken, bevries } from "./wereld.js";
import { Graaf, Voetganger, Fietser, Auto, Boodschapper, Staander } from "./verkeer.js";
import { kies, tussen, maakGeweer, maakPistool, maakMes, MAT, laadFietsen } from "./figuren.js";
import { laadMensen, maakMens } from "./mensen.js";
import { laadAutos } from "./autos.js";
import { Effecten } from "./effecten.js";
import { Geluid } from "./geluid.js";

const $ = (s) => document.querySelector(s);
// het level: uit het adres (?level=), anders de laatste keuze, anders het Julianaplein
const LEVELS = { julianaplein: "Julianaplein", steelaan: "Van Steelaan" };
const gevraagd = new URLSearchParams(location.search).get("level") ?? localStorage.getItem("fbs-level");
const LOCATIE = LEVELS[gevraagd] ? gevraagd : "julianaplein";
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
const oog = new THREE.Vector3(); // waar je ogen zijn (de kogel vertrekt hier)
const wisselt = () => performance.now() < wisselTot;
const reizigers = [];
const stil = []; // geparkeerde auto's en fietsen in rekken: { object, raak, soort }
const vallers = []; // fatbikes en berijders die vallen of vliegen
const spel = { reizigers, ronde: 1, bezig: false, score: 0 };
let tijdSchaal = 1, filmCam = null;

// camera-sturing
const kijk = { yaw: 0, pitch: -0.25, basisYaw: 0, zoom: 1, scoopZoom: 8 };
let terugslag = 0, herlaad = 0;

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
  await Promise.all([laadMensen((v) => $("#laden").style.setProperty("--v", v)), laadFietsen(), laadAutos((data.vasteAutos ?? []).map((a) => a[4]))]);
  wereld = bouwWereld(data, scene);
  graaf = new Graaf(data.graaf);
  blokken = data.voetafdrukken.map((v) => ({ r: v.ring, x0: Math.min(...v.ring.map((p) => p[0])), x1: Math.max(...v.ring.map((p) => p[0])), z0: Math.min(...v.ring.map((p) => p[1])), z1: Math.max(...v.ring.map((p) => p[1])) }));
  graaf.blok = inGebouw; // niemand rijdt of loopt door een muur
  // heggen en perken: vlakken (met omhullende rechthoek) en lijnen
  hegVlak = data.heggen.filter((h) => h.r).map((h) => ({ r: h.r, x0: Math.min(...h.r.map((p) => p[0])), x1: Math.max(...h.r.map((p) => p[0])), z0: Math.min(...h.r.map((p) => p[1])), z1: Math.max(...h.r.map((p) => p[1])) }));
  hegLijn = data.heggen.filter((h) => h.l).map((h) => h.l);
  graaf.heg = inHeg; // voetgangers en fietsers wijken er niet in uit
  // jij: de schutter met het geweer
  schutter = maakMens("schutter");
  geweer = maakGeweer();
  scene.add(geweer); // los in de wereld: elk beeld tegen de schouder gelegd, in de kijkrichting
  pistool = maakPistool(); mes = maakMes(); pistool.visible = mes.visible = false;
  scene.add(pistool, mes);
  zetWapen("pistool");
  scene.add(schutter.object);
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
  for (let i = 0; i < (licht ? 30 : telefoon ? 55 : 75); i++) reizigers.push(new Voetganger(graaf, scene));
  for (let i = 0; i < (licht ? 6 : telefoon ? 12 : 16); i++) nieuweBoodschapper();
  for (const h of spel.hangplekken.slice(0, 4)) {
    const n = 2 + ((Math.random() * 2) | 0);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + Math.random();
      reizigers.push(new Staander(scene, h.x + Math.cos(a) * 0.8 + 1.5, h.z + Math.sin(a) * 0.8, Math.atan2(-Math.cos(a), -Math.sin(a))));
    }
  }
  for (const [soort, x, z] of data.dingen) if (soort === "bank" && Math.hypot(x, z) < 75 && Math.random() < 0.6) reizigers.push(new Staander(scene, x + tussen(-0.5, 0.5), z, Math.random() * Math.PI * 2, true));
  for (let i = 0; i < 12; i++) reizigers.push(new Fietser(graaf, scene, kies(["fiets", "fiets", "fiets", "ebike", "ebike", "bakfiets"])));
  for (let i = 0; i < 9; i++) reizigers.push(new Auto(graaf, scene));
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
  kijk.pitch = st.soort === "grond" ? 0 : st.soort === "dak" ? -0.6 : -0.3;
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
const loop = { aan: false, pos: new THREE.Vector3(), richting: 0, snelheid: 0, stick: { x: 0, y: 0 }, toets: {}, slag: 0, slagRaak: false, neer: 0, richt: 0, wapen: "pistool", keek: 0 };
const WAPENS = ["pistool", "vuist", "mes"];
let blokken = null; // gebouwen (met omhullende rechthoek) waar je niet doorheen kunt
let pistool = null, mes = null;
function zetWapen(w) { loop.wapen = w; for (const el of document.querySelectorAll("#wapen svg")) el.style.display = el.dataset.w === w ? "" : "none"; }
function volgendWapen() { zetWapen(WAPENS[(WAPENS.indexOf(loop.wapen) + 1) % WAPENS.length]); }
/** De actieknop: bij je raam schieten met het geweer; lopend het wapen dat je in je hand hebt. */
function actie() {
  if (!loop.aan || loop.wapen === "pistool") return schiet();
  sla(loop.wapen);
}
function zetLopen(aan) {
  if (wisselt() || filmCam || !spel.bezig) return;
  wisselTot = performance.now() + 1500;
  $("#wissel").classList.add("aan");
  geluid.stappen?.();
  setTimeout(() => {
    loop.aan = aan;
    document.body.classList.toggle("loopt", aan);
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
      Object.assign(loop, { slag: 0, neer: 0, richt: 0, snelheid: 0 });
    } else zetStand(standNr);
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
function geblokkeerd(x, z) {
  if (inGebouw(x, z, 0.45)) return true; // je bent zelf ook breed: niet half de muur in
  if (inHeg(x, z, 0.15)) return true; // door een heg loop je niet heen
  for (const [bx, bz] of wereld.bomen) if ((x - bx) ** 2 + (z - bz) ** 2 < 0.3) return true; // boomstammen
  for (const m of data.muurtjes ?? []) for (let i = 0; i < m.length - 1; i++) {
    const [a, b] = [m[i], m[i + 1]], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2));
    if (Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) < 0.5) return true;
  }
  for (const st of stil) {
    if (st.soort !== "auto") continue;
    const o = st.object, dx = x - o.position.x, dz = z - o.position.z;
    if (dx * dx + dz * dz > 12) continue;
    const c = Math.cos(o.rotation.y), sn = Math.sin(o.rotation.y);
    const lx = dx * c - dz * sn, lz = dx * sn + dz * c;
    if (Math.abs(lx) < o.userData.B / 2 + 0.3 && Math.abs(lz) < o.userData.L / 2 + 0.3) return true;
  }
  return false;
}
/** Je krijgt een klap: je gaat neer en krabbelt weer op. */
function klapKrijgen() {
  if (loop.neer > 0 || !loop.aan) return;
  loop.neer = 3.3; loop.slag = 0;
  schutter.zet("liggen", 1, 0);
  geluid.klap(1);
  melding("fout");
  $("#hud").classList.remove("schud"); void $("#hud").offsetWidth; $("#hud").classList.add("schud");
}
/** Uithalen met de vuist (fatbiker van zijn fiets, of ruzie) of met het mes (band lek steken). */
function sla(soort = "vuist") {
  if (!loop.aan || loop.slag > 0 || loop.neer > 0) return;
  loop.slag = 0.62; loop.slagRaak = false; loop.slagSoort = soort;
  // draai naar de dichtstbijzijnde fatbike binnen bereik, anders naar waar je kijkt
  const doel = reizigers.filter((r) => r.fat && r.toestand === "rijden" && r.pos.distanceTo(loop.pos) < 3).sort((a, b) => a.pos.distanceTo(loop.pos) - b.pos.distanceTo(loop.pos))[0];
  loop.richting = doel ? Math.atan2(doel.pos.x - loop.pos.x, doel.pos.z - loop.pos.z) : kijk.yaw;
  schutter.zet(soort === "mes" ? "jab" : "stomp", 1.25, 0);
}
function stapLopen(dt) {
  const L = loop;
  L.richt = Math.max(0, L.richt - dt);
  if (L.neer > 0) {
    // neer: vallen, liggen, opstaan
    const voor = L.neer;
    L.neer -= dt;
    if (voor > 1.3 && L.neer <= 1.3) schutter.zet("opstaan", 1, 0);
    L.snelheid = 0;
  } else {
    // sturen: stick of toetsen, ten opzichte van de kijkrichting
    let jx = L.stick.x + (L.toets.KeyD ? 1 : 0) - (L.toets.KeyA ? 1 : 0), jy = L.stick.y + (L.toets.KeyW ? 1 : 0) - (L.toets.KeyS ? 1 : 0);
    let kracht = Math.min(1, Math.hypot(jx, jy));
    if (L.slag > 0) kracht = 0;
    const fx = Math.sin(kijk.yaw), fz = Math.cos(kijk.yaw);
    let mx = fx * jy - fz * jx, mz = fz * jy + fx * jx;
    const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
    const v = kracht < 0.12 ? 0 : kracht > 0.8 ? 3.8 : 1.6;
    L.snelheid += (v - L.snelheid) * Math.min(1, dt * 8);
    if (v > 0) {
      const nx = L.pos.x + mx * L.snelheid * dt, nz = L.pos.z + mz * L.snelheid * dt;
      // langs obstakels glijden: eerst het hele stapje, anders alleen x of alleen z
      if (!geblokkeerd(nx, nz)) L.pos.set(nx, 0, nz);
      else if (!geblokkeerd(nx, L.pos.z)) L.pos.x = nx;
      else if (!geblokkeerd(L.pos.x, nz)) L.pos.z = nz;
      let d = Math.atan2(mx, mz) - L.richting; d = Math.atan2(Math.sin(d), Math.cos(d));
      L.richting += d * Math.min(1, dt * 10);
      // de camera draait rustig achter je aan, tenzij je net zelf hebt rondgekeken of naar de camera toe loopt
      let c = L.richting - kijk.yaw; c = Math.atan2(Math.sin(c), Math.cos(c));
      if (performance.now() - L.keek > 900 && Math.abs(c) < 2.4) kijk.yaw += THREE.MathUtils.clamp(c, -1, 1) * 1.15 * dt;
      // tegen iemand oplopen geeft ruzie; soms krijg je een klap
      for (const r of reizigers) if (r.ruzie && Math.hypot(r.pos.x - L.pos.x, r.pos.z - L.pos.z) < 0.7) r.ruzie(L.pos, Math.random() < 0.35, klapKrijgen);
    }
    if (L.slag > 0) {
      L.slag -= dt;
      if (L.slag < 0.36 && !L.slagRaak) {
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
        } else {
          const auto = dichtst(reizigers.filter((r) => r.wordBoos), 3.2);
          if (fat) fatbikeGeraakt(fat, "klap", fat.pos.clone().setY(1));
          else if (auto) { geluid.tik(1); auto.wordBoos(); } // tegen een auto slaan: de bestuurder pikt het niet
          else { const wie = dichtst(reizigers.filter((r) => r.ruzie), 1.8); if (wie) { geluid.tik(1); wie.ruzie(L.pos, Math.random() < 0.6, klapKrijgen, true); } }
        }
      }
    }
  }
  oog.set(L.pos.x, 1.55, L.pos.z);
}

// ---------- rondes ----------
function rondeInstellingen(r) {
  // bonus: zoveel mogelijk fatbikes in de tijd; kogels en fatbikes onbeperkt, een fout kost tijd
  if (data?.modus === "bonus") return { fatbikes: Infinity, kogels: Infinity, tegelijk: 7, fouten: Infinity, tijd: data.tijd ?? 180 };
  // geen klok: je hebt alle tijd. Wel een beperkt aantal kogels.
  return { fatbikes: 6 + r * 2, kogels: 6 + r * 2 + 6, tegelijk: Math.min(3 + r, 8), fouten: 2 };
}
function toonStart() {
  const best = +(localStorage.getItem("fbs-best") ?? 0);
  const ri = rondeInstellingen(spel.ronde);
  const bonus = data?.modus === "bonus";
  const bestBonus = +(localStorage.getItem("fbs-best-bonus") ?? 0);
  $("#startRonde").textContent = bonus ? "Bonuslevel" : `Ronde ${spel.ronde}`;
  $("#startDoel").textContent = bonus ? `Zoveel mogelijk fatbikes in ${Math.round(ri.tijd / 60)} minuten` : `${ri.fatbikes} fatbikes · ${ri.kogels} kogels · geen haast`;
  $("#startBest").textContent = bonus ? (bestBonus ? `Record: ${bestBonus} fatbikes` : "") : best ? `Beste score: ${best}` : "";
  $("#uitlegPlek").textContent = bonus
    ? "Je staat bij het raam van de woonkamer, een halve trap boven de straat. Voor je ligt de tramlijn. Het is winter."
    : "Je staat op het balkon van de 4e verdieping. Onder je ligt de parkeerplaats, met de Jumbo erachter.";
  $("#uitlegRegel").innerHTML = bonus
    ? "Raak <b>geen mensen, gewone fietsen of auto's</b>: dat kost 10 seconden. Kogels genoeg."
    : "Raak <b>geen mensen, gewone fietsen of auto's</b>. Na 3 fouten ben je af. Je hebt alle tijd: alleen je kogels zijn op te maken.";
  for (const b of document.querySelectorAll("#levels button")) b.classList.toggle("aan", b.dataset.level === LOCATIE);
}
function begin() {
  geluid.start();
  if (loop.aan) { loop.aan = false; document.body.classList.remove("loopt"); zetStand(standNr); } // elke ronde begint bij je raam
  const ri = (spel.ri = rondeInstellingen(spel.ronde));
  Object.assign(spel, { bezig: true, kogels: ri.kogels, fouten: 0, geraakt: 0, gespawnd: 0, rondeScore: 0, schoten: 0, tijd: ri.tijd });
  for (const r of reizigers.filter((r) => r.fat)) weg(r);
  for (let i = 0; i < ri.tegelijk; i++) nieuweFatbike(i === 0);
  $("#start").hidden = $("#einde").hidden = true;
  $("#hud").hidden = false;
  tekenHud();
}
// boodschappers: uit een geparkeerde auto naar een winkel en terug
function nieuweBoodschapper() {
  const autos = wereld.geparkeerd.filter((a) => Math.hypot(a.position.x, a.position.z) < 70);
  const winkels = data.winkels.filter((w) => ["Jumbo", "Jumbo", "Jumbo", "Albert Heijn", "HEMA", "Action", "Kruidvat", "Etos", "Bruna", "Blokker", "Bon Appetit"].includes(w[0]) && Math.hypot(w[1], w[2]) < 120);
  if (!autos.length || !winkels.length) return;
  const w = kies(winkels.concat(winkels.filter((x) => x[0] === "Jumbo")));
  // de deur: iets voor het bord, op straatniveau
  reizigers.push(new Boodschapper(graaf, scene, kies(autos).position, [w[1] + Math.sin(w[3]) * 1.2, w[2] + Math.cos(w[3]) * 1.2]));
}
function weg(r) {
  scene.remove(r.object);
  reizigers.splice(reizigers.indexOf(r), 1);
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
    $("#kogels").innerHTML = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
    $("#kogels").classList.toggle("krap", t <= 15);
    $("#fouten").hidden = true;
    $("#score").hidden = true;
    return;
  }
  const over = spel.ri.fatbikes - spel.geraakt;
  $("#doelen").innerHTML = `<i class="fb"></i><span>${over}</span>`;
  $("#kogels").innerHTML = `<i class="kogel"></i>${spel.kogels}`;
  $("#fouten").innerHTML = Array.from({ length: spel.ri.fouten + 1 }, (_, i) => `<i class="${i < spel.fouten ? "x aan" : "x"}">✕</i>`).join("");
  $("#score").textContent = spel.score + spel.rondeScore;
}
/** Geen tekst in beeld: een kort teken midden in het vizier (geel = raak, oranje = accu, rood = fout). */
function melding(soort = "goed") {
  const m = $("#raakteken");
  m.className = ""; void m.offsetWidth; m.className = `aan ${soort}`;
}

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
  geluid.schot(); geluid.herladen();
  // de kogel vertrekt bij je ogen en gaat naar het punt waar het kruisje op staat
  let doelPunt = richtPunt();
  if (loop.aan) {
    // lopend (zonder kijker) helpt het spel met mikken: staat het kruisje bijna op een fatbike, dan gaat het schot naar zijn band
    const cd = richting();
    let best = null;
    for (const r of reizigers) {
      if (!r.fat || r.toestand !== "rijden") continue;
      for (const w of r.fiets.userData.wielen) {
        const p = w.getWorldPosition(new THREE.Vector3()), naar = p.clone().sub(camera.position), afst = naar.length();
        const hoek = Math.acos(THREE.MathUtils.clamp(naar.dot(cd) / afst, -1, 1));
        if (afst < 70 && hoek < 0.11 && (!best || hoek < best.hoek)) best = { hoek, p };
      }
    }
    if (best) doelPunt = best.p;
    loop.richting = kijk.yaw;
  }
  const d = doelPunt.sub(oog).normalize();
  // de kijker is op NUL_AFSTAND m afgesteld: de kogel gaat iets omhoog zodat hij daar op de draad zit
  const tVal = NUL_AFSTAND / KOGEL_V;
  const v = d.clone().multiplyScalar(KOGEL_V);
  v.y += (0.5 * ZWAARTE * tVal * tVal) / tVal;
  kogels.push({ p: oog.clone().addScaledVector(d, 0.6), v, leeftijd: 0 });
  terugslag = 1; herlaad = 1.1;
  if (loop.aan) loop.richt = 1.6;
  $("#flits").classList.remove("aan"); void $("#flits").offsetWidth; $("#flits").classList.add("aan");
  tekenHud();
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
    k.v.y -= ZWAARTE * dt;
    k.p.addScaledVector(k.v, dt);
    k.leeftijd += dt;
    const b = k.p;
    let raak = null;
    const bekijk = (obj, lijst, wie, soort) => {
      const h = raakObject(obj, lijst, a, b);
      if (h && (!raak || h.t < raak.t)) raak = { ...h, wie, soort };
    };
    for (const r of reizigers) if (!r.toestand || r.toestand === "rijden") bekijk(r.object, r.raak, r, r.soort);
    for (const s of stil) if (s.object.position.distanceToSquared(a) < (KOGEL_V * dt + 6) ** 2) bekijk(s.object, s.raak, s, s.soort);
    // gebouwen en grond
    const lengte = a.distanceTo(b);
    ray.set(a, b.clone().sub(a).normalize()); ray.far = lengte;
    const muur = ray.intersectObjects(wereld.botsers, false)[0];
    if (muur && (!raak || muur.distance / lengte < raak.t)) raak = { t: muur.distance / lengte, deel: "muur" };
    if (b.y < 0 && (!raak || a.y / (a.y - b.y) < raak.t)) raak = { t: a.y / (a.y - b.y), deel: "grond" };
    if (raak) {
      const p = a.clone().lerp(b, raak.t);
      treffer(raak, p);
      kogels.splice(kogels.indexOf(k), 1);
    } else if (k.leeftijd > 1.2) kogels.splice(kogels.indexOf(k), 1);
  }
}
function afstandVol(p) { return 1 / (1 + p.distanceTo(camera.position) / 60); }

function treffer(r, p) {
  spel.laatste = { deel: r.deel, soort: r.soort, p: p.toArray().map((v) => +v.toFixed(2)) };
  // iedereen in de buurt schrikt; fatbikes geven gas
  for (const x of reizigers) if (x.pos.distanceTo(p) < (x.fat ? 30 : 12)) x.schrikken();
  if (r.deel === "muur" || r.deel === "grond") { fx.inslag(p, r.deel === "grond" ? "#9b968c" : "#b9a89a"); geluid.tik(afstandVol(p)); return; }
  const wie = r.wie;
  if (r.deel === "mens") {
    // niemand raakt gewond: de kogel scheert langs en ze schrikken zich rot
    fout("Bijna een mens geraakt!", "Schiet op de fiets, niet op de mensen");
    if (wie.mens) wie.schrikken();
    return;
  }
  if (wie.soort === "auto") {
    fx.inslag(p, "#ddd");
    geluid.tik(); geluid.alarm(afstandVol(p) * 2);
    knipper(wie.object);
    if (loop.aan) wie.wordBoos?.(); // sta je op straat, dan komt de bestuurder op je af
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
  spel.geraakt++;
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
  if (spel.geraakt >= spel.ri.fatbikes) {
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
function opruimen(obj, na) { setTimeout(() => scene.remove(obj), na * 1000); }

// ---------- besturing ----------
const RICHT = { pitchMin: -0.95, pitchMax: 0.3, yawMax: 1.35 };
const vingers = new Map();
let knijp = null;
function fov() { return 55 / kijk.zoom; }
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
  kijk.yaw -= dx * k * 1.05; kijk.pitch -= dy * k * 1.05;
  if (loop.aan) { kijk.pitch = THREE.MathUtils.clamp(kijk.pitch, -0.7, 0.45); loop.keek = performance.now(); return; } // lopend kijk je vrij rond
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
  if (e.code === "Tab" || e.code === "KeyR") { e.preventDefault(); volgendWapen(); }
  const nr = ["Digit1", "Digit2", "Digit3"].indexOf(e.code);
  if (nr >= 0) zetWapen(WAPENS[nr]);
});
addEventListener("keyup", (e) => { loop.toets[e.code] = false; });
const knop = (sel, neer, op) => {
  const el = $(sel);
  sleepbaar(el, { start: () => { el.classList.add("in"); neer?.(); }, einde: () => { el.classList.remove("in"); op?.(); } });
};
knop("#vuur", () => actie());
knop("#hoger", () => wisselStand(1));
knop("#loopKnop", () => zetLopen(!loop.aan));
knop("#wapen", () => volgendWapen());
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
for (const b of document.querySelectorAll("#levels button")) b.addEventListener("click", () => {
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
    }
    // kogels op en er rijden nog fatbikes rond
    if (spel.kogels <= 0 && !kogels.length && spel.geraakt < spel.ri.fatbikes) eindeRonde(false, "Je kogels zijn op.");
    const actief = reizigers.filter((r) => r.fat).length;
    if (actief < spel.ri.tegelijk && spel.gespawnd < spel.ri.fatbikes && Math.random() < echt * 0.6) nieuweFatbike();
    // staat er niets op het plein, dan komt er een aanrijden
    const dichtbij = spel.modus === "bonus" || reizigers.some((r) => r.fat && Math.hypot(r.pos.x, r.pos.z) < 60);
    spel.leeg = dichtbij ? 0 : (spel.leeg ?? 0) + echt;
    if (spel.leeg > 6) {
      spel.leeg = 0;
      const f = reizigers.find((r) => r.fat && !(r.toestand && r.toestand !== "rijden"));
      if (f) { f.van = graaf.startKnoop(8, 60, 35); const v = graaf.volgende(-1, f.van, 8, 2, 65); if (v) { f.naar = v.n; f.breed = v.breed; f.t = 0; f.plaats(true); } }
      else if (spel.gespawnd < spel.ri.fatbikes) nieuweFatbike();
    }
  }
  for (const r of reizigers) {
    r.stap(dt, spel);
    if (r.verAf?.() && !(r.toestand && r.toestand !== "rijden")) {
      // terug naar het speelgebied
      r.van = graaf.startKnoop(r.bit, r.straal * 0.95, r.fat ? r.straal * 0.6 : 0);
      const v = graaf.volgende(-1, r.van, r.bit, 1, r.straal);
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
  if (loop.aan) stapLopen(echt);
  spel.speler = loop.aan ? loop.pos : null; spel.aangereden = klapKrijgen;
  zetDetail();
  stapKogels(dt);
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
  if (schutter && loop.aan) {
    // lopen: je ziet jezelf van achteren; het geweer laag, of in de aanslag vlak na een schot
    const L = loop, richtend = L.richt > 0 && L.neer <= 0 && L.slag <= 0;
    const kijkt = richtend || L.slag > 0 ? kijk.yaw : L.richting;
    schutter.object.position.copy(L.pos);
    schutter.object.rotation.set(0, kijkt, 0);
    if (L.neer <= 0 && L.slag <= 0) schutter.zet(L.snelheid > 2.6 ? "rennen" : L.snelheid > 0.3 ? "lopen" : "staan", L.snelheid > 2.6 ? L.snelheid / 3.2 : 1);
    schutter.mixer.update(echt);
    schutter.object.updateMatrixWorld(true);
    schutter.object.visible = true;
    // het geweer blijft bij het raam; in je hand heb je het pistool of het mes (of niets: vuisten)
    geweer.visible = false;
    const ding = L.neer > 0 ? null : L.wapen === "pistool" ? pistool : L.wapen === "mes" ? mes : null;
    pistool.visible = ding === pistool; mes.visible = ding === mes;
    if (ding) {
      const fx = Math.sin(kijkt), fz = Math.cos(kijkt);
      if (ding === pistool && richtend) {
        // arm gestrekt naar waar je mikt
        const dir = new THREE.Vector3(fx * Math.cos(kijk.pitch), Math.sin(kijk.pitch), fz * Math.cos(kijk.pitch));
        const schouder = schutter.plek("DEF-upper_armR");
        schutter.arm("R", schouder.clone().addScaledVector(dir, 0.56), new THREE.Vector3(0, -1, 0).addScaledVector(new THREE.Vector3(fz, 0, -fx), -0.5));
        ding.position.copy(schutter.plek("DEF-handR")).addScaledVector(dir, 0.06);
        ding.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      } else {
        // in de hand, in het verlengde van je onderarm
        const hand = schutter.plek("DEF-handR"), elleboog = schutter.plek("DEF-forearmR");
        const langs = hand.clone().sub(elleboog).normalize();
        ding.position.copy(hand).addScaledVector(langs, 0.07);
        ding.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), langs);
      }
    }
    // camera achter je, iets over de rechterschouder; niet door muren heen
    const cy = Math.sin(kijk.yaw), cz = Math.cos(kijk.yaw), cp = Math.cos(kijk.pitch);
    const doel = new THREE.Vector3(L.pos.x - cz * 0.45, 1.65, L.pos.z + cy * 0.45);
    const terug = new THREE.Vector3(-cy * cp, -Math.sin(kijk.pitch), -cz * cp);
    let afst = 3.3;
    ray.set(doel, terug); ray.far = afst + 0.3;
    const muur = ray.intersectObjects(wereld.botsers, false)[0];
    if (muur) afst = Math.max(0.6, muur.distance - 0.3);
    camera.position.copy(doel).addScaledVector(terug, afst);
    if (camera.position.y < 0.3) camera.position.y = 0.3;
  } else if (schutter && st) {
    const fx = Math.sin(kijk.yaw), fz = Math.cos(kijk.yaw);
    // staan en (op straat) iets voorover leunen over het muurtje; het lijf staat een stukje achter het oog
    const grond = st.soort === "grond";
    schutter.object.position.set(oog.x - fx * (grond ? 0.3 : 0.15), grond ? 0 : oog.y - 1.6, oog.z - fz * (grond ? 0.3 : 0.15));
    schutter.object.rotation.set(grond ? 0.14 : 0.05, kijk.yaw, 0, "YXZ");
    schutter.zet("staan");
    schutter.mixer.update(echt);
    schutter.object.updateMatrixWorld(true);
    // het geweer: kolf tegen de rechterschouder, loop in de kijkrichting, iets naar het midden
    const schouder = schutter.plek("DEF-upper_armR");
    const links = new THREE.Vector3(fz, 0, -fx); // de linkerkant van de schutter (hij kijkt naar +z)
    const dir = new THREE.Vector3(Math.sin(kijk.yaw) * Math.cos(kijk.pitch), Math.sin(kijk.pitch), Math.cos(kijk.yaw) * Math.cos(kijk.pitch));
    geweer.position.copy(schouder).addScaledVector(links, 0.07).addScaledVector(dir, -0.1).add(new THREE.Vector3(0, 0.03, 0));
    geweer.rotation.set(-kijk.pitch, kijk.yaw, 0, "YXZ");
    geweer.updateMatrixWorld(true);
    // handen aan het geweer: rechts om de greep, links onder de voorkant; ellebogen omlaag
    const omlaag = new THREE.Vector3(0, -1, 0);
    schutter.arm("R", geweer.localToWorld(new THREE.Vector3(0, -0.06, 0.2)), omlaag.clone().addScaledVector(links, -0.6));
    schutter.arm("L", geweer.localToWorld(new THREE.Vector3(0, -0.04, 0.58)), omlaag.clone().addScaledVector(links, 0.4));
    schutter.object.visible = geweer.visible = !scoop;
    pistool.visible = mes.visible = false;
    if (scoop) camera.position.copy(oog);
    else {
      // over de schouder: per plek een andere afstand en hoogte (op het dak hoger, anders zie je alleen grind)
      const [ach, rechts, op] = { balkon: [2.9, 0.75, 0.55], diep: [1.35, 0.55, 0.45], dak: [2.1, 0.6, 1.35], grond: [2.4, 0.6, 0.5] }[st.soort];
      camera.position.set(oog.x - fx * ach - fz * rechts, oog.y + op, oog.z - fz * ach + fx * rechts);
    }
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
window.__spel = { spel, reizigers, stil, kijk, camera, oog, loop, zetLopen, sla, actie, zetWapen, klapKrijgen, vallers, schiet, begin, zetZoom, draai, scene, renderer, stand: () => standen[standNr]?.naam };
