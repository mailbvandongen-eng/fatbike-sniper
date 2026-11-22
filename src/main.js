// Fatbike Sniper: hoofdlus, camera, besturing, schieten, rondes.
import * as THREE from "three";
import { bouwWereld, zetFietsenInRekken, bevries } from "./wereld.js";
import { Graaf, Voetganger, Fietser, Auto } from "./verkeer.js";
import { houding, kies, tussen } from "./figuren.js";
import { Effecten } from "./effecten.js";
import { Geluid } from "./geluid.js";

const $ = (s) => document.querySelector(s);
const LOCATIE = "julianaplein";
const KOGEL_V = 850, ZWAARTE = 9.81, NUL_AFSTAND = 75;

// ---------- renderer en scène ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
const telefoon = matchMedia("(pointer: coarse)").matches;
let pr = Math.min(devicePixelRatio, telefoon ? 1.6 : 2);
renderer.setPixelRatio(pr);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
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
const zon = new THREE.DirectionalLight("#fff1dc", 2.6);
zon.position.set(-90, 110, 30);
zon.castShadow = true;
zon.shadow.mapSize.set(2048, 2048);
Object.assign(zon.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, near: 10, far: 400 });
zon.shadow.bias = -0.0004; zon.shadow.normalBias = 0.04;
scene.add(zon, zon.target);
scene.add(new THREE.HemisphereLight("#cfe0f0", "#6b6359", 1.05));

// ---------- staat ----------
const fx = new Effecten(scene);
const geluid = new Geluid();
let wereld, graaf, data, sluip;
const reizigers = [];
const stil = []; // geparkeerde auto's en fietsen in rekken: { object, raak, soort }
const vallers = []; // fatbikes en berijders die vallen of vliegen
const spel = { reizigers, jumbo: new THREE.Vector3(), ronde: 1, bezig: false, score: 0 };
let tijdSchaal = 1, filmCam = null;

// camera-sturing
const kijk = { yaw: 0, pitch: -0.25, basisYaw: 0, zoom: 1, scoopZoom: 5 };
const adem = { vast: false, voorraad: 1, moe: 0, hart: 0 };
let terugslag = 0, herlaad = 0;

async function laad() {
  data = await (await fetch(`data/${LOCATIE}.json?v=${window.VERSIE ?? ""}`)).json();
  $("#plek").textContent = data.naam;
  wereld = bouwWereld(data, scene);
  graaf = new Graaf(data.graaf);
  sluip = data.sluipschutter;
  camera.position.set(...sluip.pos);
  const n = sluip.muur.normaal;
  kijk.basisYaw = Math.atan2(n[0], n[1]);
  kijk.yaw = Math.atan2(sluip.kijk[0] - sluip.pos[0], sluip.kijk[2] - sluip.pos[2]);
  spel.jumbo.set(sluip.kijk[0], 0, sluip.kijk[2]);
  bouwBalkon();
  for (const a of wereld.geparkeerd) stil.push({ object: a, raak: a.userData.raak, soort: "auto" });
  zetFietsenInRekken(wereld, scene, (f) => stil.push({ object: f, raak: f.userData.raak, soort: "fiets" }));
  bevries(stil.map((s) => s.object), scene);
  for (let i = 0; i < (telefoon ? 34 : 46); i++) reizigers.push(new Voetganger(graaf, scene));
  for (let i = 0; i < 12; i++) reizigers.push(new Fietser(graaf, scene, kies(["fiets", "fiets", "fiets", "ebike", "ebike", "bakfiets"])));
  for (let i = 0; i < 9; i++) reizigers.push(new Auto(graaf, scene));
  $("#laden").hidden = true;
  $("#start").hidden = false;
  toonStart();
}

// het balkon waar je op staat: vloer, borstwering, stukje gevel
function bouwBalkon() {
  const g = new THREE.Group();
  const n = sluip.muur.normaal;
  g.position.set(sluip.pos[0] - n[0] * 0.9, sluip.pos[1] - 1.6, sluip.pos[2] - n[1] * 0.9);
  g.rotation.y = Math.atan2(n[0], n[1]);
  const beton = new THREE.MeshStandardMaterial({ color: "#d9d5cc", roughness: 0.9 });
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
  for (const x of [-2.45, 2.45]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.8, 1.2), beton); w.position.set(x, 1.3, 0.6); g.add(w); }
  scene.add(g);
}

// ---------- rondes ----------
function rondeInstellingen(r) {
  // geen klok: je hebt alle tijd. Wel een beperkt aantal kogels.
  return { fatbikes: 3 + r, kogels: 3 + r + 5, tegelijk: Math.min(1 + r, 5), fouten: 2 };
}
function toonStart() {
  const best = +(localStorage.getItem("fbs-best") ?? 0);
  const ri = rondeInstellingen(spel.ronde);
  $("#startRonde").textContent = `Ronde ${spel.ronde}`;
  $("#startDoel").textContent = `${ri.fatbikes} fatbikes · ${ri.kogels} kogels · geen haast`;
  $("#startBest").textContent = best ? `Beste score: ${best}` : "";
}
function begin() {
  geluid.start();
  const ri = (spel.ri = rondeInstellingen(spel.ronde));
  Object.assign(spel, { bezig: true, kogels: ri.kogels, fouten: 0, geraakt: 0, gespawnd: 0, rondeScore: 0, schoten: 0 });
  for (const r of reizigers.filter((r) => r.fat)) weg(r);
  for (let i = 0; i < ri.tegelijk; i++) nieuweFatbike(i === 0);
  $("#start").hidden = $("#einde").hidden = true;
  $("#hud").hidden = false;
  tekenHud();
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
  } else f.van = graaf.startKnoop(8, 115, 60); // komt van de rand binnen rijden
  const v = graaf.volgende(-1, f.van, 8, 2);
  if (v) { f.naar = v.n; f.breed = v.breed; f.t = stil ? 0.5 : 0; f.plaats(true); }
  reizigers.push(f);
  spel.gespawnd++;
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
  const over = spel.ri.fatbikes - spel.geraakt;
  $("#doelen").innerHTML = Array.from({ length: spel.ri.fatbikes }, (_, i) => `<i class="fb${i < spel.geraakt ? " weg" : ""}"></i>`).join("") + `<span>${over}</span>`;
  $("#kogels").innerHTML = `<i class="kogel"></i>${spel.kogels}`;
  $("#fouten").innerHTML = Array.from({ length: spel.ri.fouten + 1 }, (_, i) => `<i class="${i < spel.fouten ? "x aan" : "x"}">✕</i>`).join("");
  $("#score").textContent = spel.score + spel.rondeScore;
}
function melding(tekst, soort = "goed", sub = "") {
  const m = document.createElement("div");
  m.className = `melding ${soort}`;
  m.innerHTML = `${tekst}${sub ? `<small>${sub}</small>` : ""}`;
  $("#meldingen").append(m);
  setTimeout(() => m.remove(), 1900);
}

// ---------- schieten ----------
const kogels = [];
function richting() {
  const d = new THREE.Vector3();
  camera.getWorldDirection(d);
  return d;
}
function schiet() {
  if (!spel.bezig || herlaad > 0 || spel.kogels <= 0 || filmCam) return;
  spel.kogels--; spel.schoten++;
  geluid.schot(); geluid.herladen();
  const d = richting();
  // de kijker is op NUL_AFSTAND m afgesteld: de kogel gaat iets omhoog zodat hij daar op de draad zit
  const tVal = NUL_AFSTAND / KOGEL_V;
  const v = d.clone().multiplyScalar(KOGEL_V);
  v.y += (0.5 * ZWAARTE * tVal * tVal) / tVal;
  kogels.push({ p: camera.position.clone().addScaledVector(d, 0.6), v, leeftijd: 0 });
  terugslag = 1; herlaad = 1.1;
  $("#flits").classList.remove("aan"); void $("#flits").offsetWidth; $("#flits").classList.add("aan");
  tekenHud();
}

const ray = new THREE.Raycaster();
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
  geluid.fout();
  melding(tekst, "fout", sub);
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
  const accu = deel === "accu";
  const punten = { accu: 250, band: 100, frame: 75 }[deel] ?? 75;
  spel.rondeScore += punten;
  geluid.goed();
  melding(accu ? "ACCU!" : deel === "band" ? "BAND LEK!" : "RAAK!", accu ? "accu" : "goed", `+${punten}`);
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
    fx.klap(p); geluid.klap(afstandVol(p));
    const zij = Math.random() < 0.5 ? 1 : -1;
    vallers.push({ obj: f.groep, v, w: new THREE.Vector3(0, tussen(-1, 1), 0), soort: "fiets", r: 0, kantel: zij, kantelT: 0 });
    // lekke band: platter
    const wi = deel === "band" ? fiets.userData.wielen[p.distanceTo(fiets.userData.wielen[0].getWorldPosition(new THREE.Vector3())) < p.distanceTo(fiets.userData.wielen[1].getWorldPosition(new THREE.Vector3())) ? 0 : 1] : null;
    if (wi) wi.scale.set(1, 0.82, 1.06);
  }
  // berijders vliegen eraf
  for (const m of f.berijders) {
    m.updateMatrixWorld();
    const pos = new THREE.Vector3(); m.getWorldPosition(pos);
    const spil = new THREE.Group();
    spil.position.copy(pos).add(new THREE.Vector3(0, 0.95 * m.scale.y, 0));
    spil.rotation.y = f.richting;
    scene.add(spil);
    m.position.set(0, -0.95 * m.scale.y, 0);
    m.rotation.set(0, 0, 0);
    spil.add(m);
    const kracht = accu ? 1 : 0.75;
    const vm = v.clone().multiplyScalar(kracht).add(new THREE.Vector3(tussen(-1.2, 1.2), accu ? tussen(7, 9.5) : tussen(2.5, 3.8), tussen(-1.2, 1.2)));
    vallers.push({ obj: spil, mens: m, v: vm, w: new THREE.Vector3(accu ? tussen(-7, 7) : tussen(3, 6), tussen(-2, 2), tussen(-3, 3)), soort: "mens", fase: 0, toestand: "vliegt", t: 0 });
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
      x.t += dt; x.fase += dt * 6;
      const m = x.mens;
      if (x.toestand === "vliegt") {
        x.v.y -= ZWAARTE * dt;
        o.position.addScaledVector(x.v, dt);
        o.rotation.x += x.w.x * dt; o.rotation.z += x.w.z * dt;
        houding(m, "vliegen", x.fase);
        if (o.position.y < 0.3 && x.v.y < 0) {
          if (Math.abs(x.v.y) > 4) { x.v.y *= -0.3; x.v.x *= 0.6; x.v.z *= 0.6; o.position.y = 0.3; x.w.multiplyScalar(0.5); }
          else { x.toestand = "glijdt"; x.t = 0; x.rx = o.rotation.x; x.rz = o.rotation.z; }
        }
      } else if (x.toestand === "glijdt") {
        const sn = Math.hypot(x.v.x, x.v.z);
        if (sn > 0) { const n = Math.max(0, sn - 7 * dt) / sn; x.v.x *= n; x.v.z *= n; }
        o.position.x += x.v.x * dt; o.position.z += x.v.z * dt;
        const k = Math.min(1, x.t * 4);
        o.rotation.x = THREE.MathUtils.lerp(x.rx, -Math.PI / 2, k); o.rotation.z = THREE.MathUtils.lerp(x.rz, 0, k);
        o.position.y = THREE.MathUtils.lerp(o.position.y, 0.14, k);
        houding(m, "liggen", x.fase, 1, 1);
        if (x.t > 2.2) { x.toestand = "opstaan"; x.t = 0; }
      } else if (x.toestand === "opstaan") {
        const k = Math.min(1, x.t / 0.9);
        o.rotation.x = THREE.MathUtils.lerp(-Math.PI / 2, 0, k * k);
        o.position.y = THREE.MathUtils.lerp(0.14, 0.95 * m.scale.y, k);
        // draai naar de flat
        const doel = Math.atan2(camera.position.x - o.position.x, camera.position.z - o.position.z);
        let d = doel - o.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
        o.rotation.y += d * Math.min(1, dt * 4);
        houding(m, "staan", x.fase);
        if (k >= 1) { x.toestand = "boos"; x.t = 0; }
      } else if (x.toestand === "boos") {
        houding(m, "boos", x.fase * 1.6);
        if (x.t > 3.2) { x.toestand = "loopt"; x.t = 0; o.rotation.y += Math.PI + tussen(-0.6, 0.6); }
      } else if (x.toestand === "loopt") {
        o.position.x += Math.sin(o.rotation.y) * 1.5 * dt; o.position.z += Math.cos(o.rotation.y) * 1.5 * dt;
        houding(m, "lopen", x.fase * 0.9);
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
  kijk.zoom = THREE.MathUtils.clamp(z, 1, 20);
  if (kijk.zoom > 1.5) kijk.scoopZoom = kijk.zoom;
  const scoop = kijk.zoom > 1.5;
  document.body.classList.toggle("scoop", scoop);
  $("#zoomWaarde").textContent = `${kijk.zoom.toFixed(kijk.zoom < 10 ? 1 : 0)}×`;
  $("#zoomSchuif").value = kijk.zoom;
}
function draai(dx, dy) {
  const k = (fov() * Math.PI) / 180 / innerHeight;
  kijk.yaw -= dx * k * 1.05; kijk.pitch -= dy * k * 1.05;
  let d = kijk.yaw - kijk.basisYaw; d = Math.atan2(Math.sin(d), Math.cos(d));
  kijk.yaw = kijk.basisYaw + THREE.MathUtils.clamp(d, -RICHT.yawMax, RICHT.yawMax);
  kijk.pitch = THREE.MathUtils.clamp(kijk.pitch, RICHT.pitchMin, RICHT.pitchMax);
}
const doek = renderer.domElement;
doek.addEventListener("pointerdown", (e) => {
  doek.setPointerCapture(e.pointerId);
  vingers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
  if (vingers.size === 2) { const [a, b] = [...vingers.values()]; knijp = { d: Math.hypot(a.x - b.x, a.y - b.y), z: kijk.zoom }; }
  if (e.pointerType === "mouse" && e.button === 2) zetZoom(kijk.zoom > 1.5 ? 1 : kijk.scoopZoom);
});
doek.addEventListener("pointermove", (e) => {
  const v = vingers.get(e.pointerId);
  if (!v) return;
  const dx = e.clientX - v.x, dy = e.clientY - v.y;
  v.x = e.clientX; v.y = e.clientY;
  if (vingers.size === 2 && knijp) {
    const [a, b] = [...vingers.values()];
    zetZoom(knijp.z * (Math.hypot(a.x - b.x, a.y - b.y) / knijp.d));
  } else if (vingers.size === 1) draai(dx, dy);
});
const los = (e) => {
  const v = vingers.get(e.pointerId);
  vingers.delete(e.pointerId);
  if (vingers.size < 2) knijp = null;
  // muis: korte klik zonder slepen = schieten
  if (v && e.pointerType === "mouse" && e.button === 0 && Math.hypot(e.clientX - v.sx, e.clientY - v.sy) < 5 && performance.now() - v.t < 400) schiet();
};
doek.addEventListener("pointerup", los);
doek.addEventListener("pointercancel", los);
doek.addEventListener("contextmenu", (e) => e.preventDefault());
addEventListener("wheel", (e) => { zetZoom(kijk.zoom * Math.exp(-e.deltaY * 0.0015)); }, { passive: true });
addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.code === "ShiftLeft") adem.vast = true;
  if (e.code === "KeyF" || e.code === "Enter") schiet();
  if (e.code === "KeyQ") zetZoom(kijk.zoom > 1.5 ? 1 : kijk.scoopZoom);
});
addEventListener("keyup", (e) => { if (e.code === "Space" || e.code === "ShiftLeft") adem.vast = false; });
const knop = (sel, neer, op) => {
  const el = $(sel);
  el.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); el.classList.add("in"); neer?.(); });
  const uit = (e) => { el.classList.remove("in"); op?.(); };
  el.addEventListener("pointerup", uit); el.addEventListener("pointercancel", uit); el.addEventListener("pointerleave", uit);
};
knop("#vuur", schiet);
knop("#adem", () => (adem.vast = true), () => (adem.vast = false));
knop("#scoopKnop", () => zetZoom(kijk.zoom > 1.5 ? 1 : kijk.scoopZoom));
$("#zoomSchuif").addEventListener("input", (e) => zetZoom(+e.target.value));
$("#begin").addEventListener("click", begin);

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
  location.replace(`./?v=${nieuweVersie}`);
}
$("#versie").textContent = window.VERSIE_DATUM ? `Versie van ${window.VERSIE_DATUM}` : "";
kijkVersie();
document.addEventListener("visibilitychange", () => { if (!document.hidden) kijkVersie(); });
addEventListener("pageshow", (e) => { if (e.persisted) kijkVersie(); });
$("#volgende").addEventListener("click", () => {
  if (nieuweVersie) return ververs(); $("#einde").hidden = true; $("#start").hidden = false; toonStart(); });
addEventListener("resize", () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// ---------- lus ----------
const klok = new THREE.Timer();
let tijd = 0, fpsT = 0, fpsN = 0;
function lus() {
  klok.update();
  const echt = Math.min(klok.getDelta(), 0.05);
  tijdSchaal = THREE.MathUtils.lerp(tijdSchaal, filmCam ? 0.18 : 1, Math.min(1, echt * 8));
  const dt = echt * tijdSchaal;
  tijd += dt;

  // spel
  if (spel.bezig && !filmCam) {
    // kogels op en er rijden nog fatbikes rond
    if (spel.kogels <= 0 && !kogels.length && spel.geraakt < spel.ri.fatbikes) eindeRonde(false, "Je kogels zijn op.");
    const actief = reizigers.filter((r) => r.fat).length;
    if (actief < spel.ri.tegelijk && spel.gespawnd < spel.ri.fatbikes && Math.random() < echt * 0.25) nieuweFatbike();
  }
  for (const r of reizigers) {
    r.stap(dt, spel);
    if (r.verAf?.() && !(r.toestand && r.toestand !== "rijden")) {
      // terug naar het speelgebied
      r.van = graaf.startKnoop(r.bit, 115, r.fat ? 70 : 0);
      const v = graaf.volgende(-1, r.van, r.bit);
      if (v) { r.naar = v.n; r.breed = v.breed; r.t = 0; r.plaats(true); }
    }
    if (!r.fat && r instanceof Fietser && Math.random() < dt * 0.01) geluid.bel(afstandVol(r.pos));
  }
  stapKogels(dt);
  stapVallers(dt);
  fx.stap(dt);

  // adem
  if (adem.vast && adem.moe <= 0 && adem.voorraad > 0) {
    adem.voorraad -= echt / 5;
    if (adem.voorraad <= 0) { adem.voorraad = 0; adem.moe = 2.5; }
    adem.hart -= echt; if (adem.hart <= 0) { adem.hart = 0.9; geluid.hart(); }
  } else adem.voorraad = Math.min(1, adem.voorraad + echt / 4);
  if (adem.moe > 0) adem.moe -= echt;
  $("#ademBalk").style.setProperty("--v", adem.voorraad);
  $("#adem").classList.toggle("moe", adem.moe > 0);
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
  const zwaai = scoop ? (adem.vast && adem.moe <= 0 ? 0.12 : 1) * (adem.moe > 0 ? 2.4 : 1) * 0.0045 : 0;
  const sy = zwaai * (Math.sin(tijd * 0.83) + 0.45 * Math.sin(tijd * 2.13 + 1));
  const sp = zwaai * (Math.sin(tijd * 1.21 + 2) * 0.8 + 0.35 * Math.sin(tijd * 2.7));
  // three kijkt langs -z, dus +PI bij de yaw
  const e = new THREE.Euler(kijk.pitch + sp + terugslag * 0.035 * (scoop ? 1 : 0.5), kijk.yaw + Math.PI + sy, 0, "YXZ");
  camera.quaternion.setFromEuler(e);
  camera.updateProjectionMatrix();
  renderer.render(scene, filmCam?.cam ?? camera);

  // prestaties: bij een trage telefoon de resolutie omlaag
  fpsT += echt; fpsN++;
  if (fpsT > 2) {
    const fps = fpsN / fpsT; fpsT = 0; fpsN = 0;
    if (fps < 40 && pr > 1) { pr = Math.max(1, pr - 0.2); renderer.setPixelRatio(pr); }
  }
  requestAnimationFrame(lus);
}
zetZoom(1);
laad().then(() => requestAnimationFrame(lus)).catch((e) => { $("#laden").textContent = "Laden mislukt: " + e.message; console.error(e); });
window.__spel = { spel, reizigers, stil, kijk, camera, schiet, begin, zetZoom, draai, scene, adem, renderer };
