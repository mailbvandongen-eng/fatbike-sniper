// Iedereen die beweegt: voetgangers, fietsers, auto's en fatbikes. Ze volgen het netwerk uit OSM.
import * as THREE from "three";
import { maakFiets, maakKar, kies, tussen } from "./figuren.js";
import { maakAuto } from "./autos.js";
import { maakMens } from "./mensen.js";

export const AUTO = 1, FIETS = 2, VOET = 4, FAT = 8;
const SPEELSTRAAL = 120; // hier gebeurt het; verder weg keert men terug of verdwijnt

export class Graaf {
  constructor({ knopen, kanten }) {
    this.k = knopen;
    this.c = [0, 0]; // het midden van de drukte: het plein, of waar jij loopt
    this.buren = knopen.map(() => []);
    for (const [a, b, bits, breed, een] of kanten) {
      this.buren[a].push({ n: b, bits, breed });
      if (!een || !(bits & AUTO)) this.buren[b].push({ n: a, bits: een ? bits & ~AUTO : bits, breed });
    }
  }
  /** Een willekeurige knoop met een buur van dit soort, binnen r meter van het midden. */
  startKnoop(bit, r = SPEELSTRAAL, rMin = 0) {
    for (let i = 0; i < 400; i++) {
      const n = (Math.random() * this.k.length) | 0, d = Math.hypot(this.k[n][0] - this.c[0], this.k[n][1] - this.c[1]);
      if (d < r && d >= rMin && this.buren[n].some((b) => b.bits & bit)) return n;
    }
    return 0;
  }
  /** Dichtstbijzijnde knoop met een buur van dit soort. */
  dichtbij(x, z, bit) {
    let best = 0, bd = 1e9;
    this.k.forEach(([kx, kz], i) => { const d = (kx - x) ** 2 + (kz - z) ** 2; if (d < bd && this.buren[i].some((b) => b.bits & bit)) { bd = d; best = i; } });
    return best;
  }
  /** Kortste route (Dijkstra) als lijst van knopen. */
  route(a, b, bit) {
    const n = this.k.length, afst = new Float64Array(n).fill(Infinity), vorige = new Int32Array(n).fill(-1), klaar = new Uint8Array(n);
    afst[a] = 0;
    for (;;) {
      let u = -1, m = Infinity;
      for (let i = 0; i < n; i++) if (!klaar[i] && afst[i] < m) { m = afst[i]; u = i; }
      if (u < 0 || u === b) break;
      klaar[u] = 1;
      for (const nb of this.buren[u]) if (nb.bits & bit) {
        const d = m + Math.hypot(this.k[nb.n][0] - this.k[u][0], this.k[nb.n][1] - this.k[u][1]);
        if (d < afst[nb.n]) { afst[nb.n] = d; vorige[nb.n] = u; }
      }
    }
    if (!isFinite(afst[b])) return null;
    const pad = [];
    for (let u = b; u >= 0; u = vorige[u]) pad.unshift(u);
    return pad;
  }
  volgende(van, via, bit, trek = 1, straal = SPEELSTRAAL) {
    const opties = this.buren[via].filter((b) => b.bits & bit);
    if (!opties.length) return null;
    const terug = opties.length > 1 ? opties.filter((b) => b.n !== van) : opties;
    // weeg naar het speelgebied toe
    const gew = terug.map((b) => {
      const d = Math.hypot(this.k[b.n][0] - this.c[0], this.k[b.n][1] - this.c[1]);
      return d < straal * 0.7 ? 3 * trek : d < straal ? 1.5 : 0.3 / trek;
    });
    let r = Math.random() * gew.reduce((a, b) => a + b, 0);
    for (let i = 0; i < terug.length; i++) if ((r -= gew[i]) <= 0) return terug[i];
    return terug.at(-1);
  }
}

const tmp = new THREE.Vector3();

/** Basis: iets dat over het netwerk rijdt of loopt. */
class Reiziger {
  constructor(graaf, bit, snelheid, zij, traag = 0.5, maxDraai = 2, straal = SPEELSTRAAL) {
    this.straal = straal; // hier blijft hij in de buurt
    this.g = graaf; this.bit = bit; this.v = snelheid; this.vBasis = snelheid; this.zij = zij;
    this.traag = traag; // hoe ruim bochten genomen worden (s): hoger = vloeiender
    this.maxDraai = maxDraai; // rad/s: een fiets keert niet op een dubbeltje
    this.van = graaf.startKnoop(bit, straal);
    const eerste = graaf.volgende(-1, this.van, bit, 1, straal);
    this.naar = eerste?.n ?? this.van; this.breed = eerste?.breed ?? 3;
    this.t = Math.random();
    // pad = het punt op de route; pos/richting = waar hij echt is (vloeiend erachteraan)
    this.pad = new THREE.Vector3(); this.pos = new THREE.Vector3();
    this.richting = 0; this.richtingDoel = 0; this.draaiing = 0;
    this.actief = true; this.wacht = 0;
    this.plaats(true);
  }
  plaats(direct) {
    const a = this.g.k[this.van], b = this.g.k[this.naar];
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
    // rechts houden (vanuit de rijrichting gezien), naar de breedte van de weg
    const off = this.zij(this.breed) + (this.uitwijk ?? 0);
    this.pad.set(a[0] + dx * this.t - (dz / l) * off, 0, a[1] + dz * this.t + (dx / l) * off);
    // niet tegen of in een gevel: dan over het midden van het pad
    if (off && (this.g.blok?.(this.pad.x, this.pad.z, 0.3) || this.g.heg?.(this.pad.x, this.pad.z, 0.1))) this.pad.set(a[0] + dx * this.t, 0, a[1] + dz * this.t);
    this.richtingDoel = Math.atan2(dx, dz);
    if (direct) { this.pos.copy(this.pad); this.richting = this.richtingDoel; }
    this.lengte = l;
  }
  stap(dt) {
    if (this.wacht > 0) this.wacht -= dt;
    else {
      let afstand = this.v * dt;
      while (afstand > 0) {
        const rest = (1 - this.t) * this.lengte;
        if (afstand < rest) { this.t += afstand / this.lengte; break; }
        afstand -= rest;
        const nu = this.naar;
        const vlg = this.g.volgende(this.van, nu, this.bit, this.trek ?? 1, this.bereik());
        if (!vlg) { this.van = nu; this.naar = this.van; this.t = 0; break; }
        this.van = nu; this.naar = vlg.n; this.breed = vlg.breed; this.t = 0;
        const a = this.g.k[this.van], b = this.g.k[this.naar];
        this.lengte = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      }
      this.plaats(false);
    }
    this.glad(dt);
  }
  /** Vloeiend achter het routepunt (this.pad) aan: bochten worden bogen, sprongen verdwijnen. */
  glad(dt) {
    const k = 1 - Math.exp(-dt / this.traag);
    const ox = this.pos.x, oz = this.pos.z;
    this.pos.lerp(this.pad, k);
    // een afgesneden bocht mag niet door een muur gaan: dan recht het routepunt achterna
    if (this.g.blok?.(this.pos.x, this.pos.z, 0.2) && !this.g.blok(this.pad.x, this.pad.z)) this.pos.set(ox, 0, oz).lerp(this.pad, Math.min(1, k * 4));
    // te voet haal je nooit meer dan een sprint (ook niet als je na een ruzie terug moet naar je route)
    if (this.bit === VOET) {
      const sx = this.pos.x - ox, sz = this.pos.z - oz, sl = Math.hypot(sx, sz), max = 4.2 * dt;
      if (sl > max) this.pos.set(ox + (sx / sl) * max, 0, oz + (sz / sl) * max);
    }
    // om geparkeerde auto's heen (ook met de winkelwagen die je voor je uit duwt)
    if (this.bit === AUTO && this.g.uitAuto) {
      // een rijdende auto komt nooit in een geparkeerde auto terecht: hij wordt er langs de kortste weg naast gezet
      // (neus, midden en achterkant; de kortste weg naar buiten, in één keer)
      for (let keer = 0; keer < 2; keer++) for (const k of [1.4, 0, -1.4]) {
        const u = this.g.uitAuto(this.pos.x + Math.sin(this.richting) * k, this.pos.z + Math.cos(this.richting) * k, 0.75, 0.75);
        if (u) { this.pos.x += u[0]; this.pos.z += u[1]; }
      }
    } else if (this.g.uitAuto) {
      const u = this.g.uitAuto(this.pos.x, this.pos.z, 0.32) ?? (this.kar ? this.g.uitAuto(this.pos.x + Math.sin(this.richting) * 0.85, this.pos.z + Math.cos(this.richting) * 0.85, 0.3) : null);
      if (u) { this.pos.x += u[0]; this.pos.z += u[1]; }
    }
    const mx = this.pos.x - ox, mz = this.pos.z - oz;
    const oud = this.richting;
    if (mx * mx + mz * mz > 1e-6) {
      let d = Math.atan2(mx, mz) - this.richting;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      const max = this.maxDraai * dt;
      this.richting += THREE.MathUtils.clamp(d * Math.min(1, dt * 5), -max, max);
    }
    // draaisnelheid (voor het scheef hangen in de bocht), ook vloeiend
    this.snelheid = dt > 0 ? Math.hypot(mx, mz) / dt : 0;
    const w = dt > 0 ? Math.atan2(Math.sin(this.richting - oud), Math.cos(this.richting - oud)) / dt : 0;
    this.draaiing += (w - this.draaiing) * Math.min(1, dt * 4);
  }
  /** Hoe ver van het midden van de drukte hij blijft. Loop je op straat, dan blijft iedereen dichter om je heen (g.krap). */
  bereik() { return this.straal * (this.g.krap ?? 1); }
  verAf() { return Math.hypot(this.pos.x - this.g.c[0], this.pos.z - this.g.c[1]) > this.bereik() * 1.35; }
}

// ---------- ruzie en vechten: iemand tegen wie je oploopt, of die je een klap geeft ----------
/**
 * Begin een ruzie, of deel een klap uit. slaat = hij vecht terug; klap(wie) = wat er met jou gebeurt als hij raakt.
 * geraakt = hij krijgt een klap van jou (zwaar = de laatste van een reeks). Na een paar klappen gaat hij neer;
 * daarna krabbelt hij op en maakt dat hij wegkomt. Niemand raakt gewond.
 */
const vechters = new Set(); // wie er nu met je vecht: ze halen om de beurt uit, niet allemaal tegelijk
function beginRuzie(wie, naar, slaat, klap, geraakt = false, zwaar = false) {
  if (wie.groep.visible === false || wie.ruzieNeer > 0) return false;
  if (geraakt) {
    wie.conditie = (wie.conditie ?? 3) - (zwaar ? 2 : 1);
    wie.ruzieNaar = naar; wie.ruzieKlap = klap; wie.slagT = 0; wie.schrik = 0;
    // de klap duwt hem achteruit
    const dx = wie.pos.x - naar.x, dz = wie.pos.z - naar.z, d = Math.hypot(dx, dz) || 1, kracht = zwaar ? 3.4 : 1.7;
    wie.duwX = (dx / d) * kracht; wie.duwZ = (dz / d) * kracht;
    if (wie.conditie <= 0) { wie.ruzieNeer = 4.4; wie.ruzieT = 4.4; wie.m.zet("liggen", 1, 0); return true; }
    // niet iedereen vecht terug: wie niet durft, rent weg zodra hij weer recht staat
    if (!(wie.ruzieT > 0)) wie.ruzieSlaat = wie.vechter ??= Math.random() < 0.6;
    wie.wankel = 0.5; wie.m.zet("klapHoofd", 1, 0);
    wie.ruzieT = wie.ruzieSlaat ? tussen(7, 10) : 0.5;
    wie.uithaalT = tussen(0.25, 0.9);
    return true;
  }
  if (wie.ruzieT > 0 || wie.ruzieKoel > 0 || wie.schrik > 0) return false;
  wie.ruzieT = slaat ? tussen(5, 7) : tussen(2.2, 3.4); wie.ruzieNaar = naar; wie.ruzieSlaat = slaat; wie.ruzieKlap = klap;
  wie.wankel = 0; wie.slagT = 0; wie.duwX = wie.duwZ = 0; wie.uithaalT = tussen(1.4, 2);
  wie.m.zet("boos", 1, 0);
  return true;
}
/** Eén stap van de ruzie; geeft true zolang hij duurt. */
function stapRuzie(wie, dt) {
  if (wie.ruzieKoel > 0) wie.ruzieKoel -= dt;
  if (!(wie.ruzieT > 0)) return false;
  wie.ruzieT -= dt;
  if (wie.ruzieSlaat) vechters.add(wie);
  const vrij = (x, z) => !(wie.g?.blok?.(x, z, 0.3) || wie.g?.heg?.(x, z, 0.1) || wie.g?.uitAuto?.(x, z, 0.25));
  const dx = wie.ruzieNaar.x - wie.pos.x, dz = wie.ruzieNaar.z - wie.pos.z, d = Math.hypot(dx, dz) || 1;
  // achteruit door de klap
  if (wie.duwX || wie.duwZ) {
    const nx = wie.pos.x + wie.duwX * dt, nz = wie.pos.z + wie.duwZ * dt, rem = Math.exp(-dt * 7);
    if (vrij(nx, nz)) wie.pos.set(nx, 0, nz);
    wie.duwX *= rem; wie.duwZ *= rem;
    if (Math.abs(wie.duwX) + Math.abs(wie.duwZ) < 0.05) wie.duwX = wie.duwZ = 0;
  }
  let weg = false;
  if (wie.ruzieNeer > 0) {
    // neer: liggen, opstaan en wegwezen
    const voor = wie.ruzieNeer; wie.ruzieNeer -= dt;
    if (voor > 1.5 && wie.ruzieNeer <= 1.5) wie.m.zet("opstaan", 1, 0);
    if (wie.ruzieNeer <= 0) { wie.ruzieNeer = 0; wie.ruzieT = 0; wie.conditie = 3; weg = true; }
  } else {
    let h = Math.atan2(dx, dz) - wie.richting; h = Math.atan2(Math.sin(h), Math.cos(h));
    wie.richting += h * Math.min(1, dt * 8);
    if (wie.wankel > 0) {
      wie.wankel -= dt;
      if (wie.wankel <= 0 && !wie.ruzieSlaat) { wie.ruzieT = 0; weg = true; }
    } else if (wie.ruzieSlaat) {
      if (wie.slagT > 0) {
        // de uithaal: je ziet hem aankomen; stap je op tijd achteruit, dan slaat hij mis
        wie.slagT -= dt;
        if (wie.slagT < 0.36 && !wie.ruzieGegeven) { wie.ruzieGegeven = true; if (d < 1.75) wie.ruzieKlap?.(wie); }
        if (wie.slagT <= 0) wie.uithaalT = tussen(0.8, 1.6);
      } else {
        // op armlengte blijven; loop je weg, dan komt hij even achter je aan en laat het dan zitten
        if (d > 1.3) {
          const st = Math.min(d - 1.2, 2.6 * dt), nx = wie.pos.x + (dx / d) * st, nz = wie.pos.z + (dz / d) * st;
          if (vrij(nx, nz)) wie.pos.set(nx, 0, nz);
          wie.m.zet("rennen", 0.8);
          if (d > 9) wie.ruzieT = 0;
        } else wie.m.zet("vechtklaar");
        wie.uithaalT -= dt;
        if (wie.uithaalT <= 0 && d < 1.6) {
          wie.slagT = 0.78; wie.ruzieGegeven = false; wie.m.zet(Math.random() < 0.5 ? "stomp" : "jab", 1.05, 0); wie.zwiep?.();
          for (const v of vechters) if (v !== wie && !(v.slagT > 0)) v.uithaalT = Math.max(v.uithaalT, tussen(1.1, 1.8));
        }
      }
    } else if (wie.m.huidig !== "Idle_No_Loop") wie.m.zet("boos");
  }
  wie.m.mixer.update(dt);
  wie.groep.position.copy(wie.pos); wie.groep.rotation.y = wie.richting;
  if (wie.ruzieT <= 0) {
    vechters.delete(wie);
    wie.ruzieT = 0; wie.ruzieKoel = 20; wie.wacht = 0; wie.duwX = wie.duwZ = 0;
    // verder vanaf het dichtstbijzijnde punt van de stoep (hij kan een eind van zijn route zijn geraakt)
    if (wie.g && wie.plaats && !wie.lijn) {
      wie.van = wie.g.dichtbij(wie.pos.x, wie.pos.z, wie.bit);
      const v = wie.g.volgende(-1, wie.van, wie.bit, 1, wie.straal);
      if (v) { wie.naar = v.n; wie.breed = v.breed; wie.t = 0; wie.plaats(false); }
    }
    if (weg) { wie.schrik = 4.3; if (!wie.g) wie.richting = Math.atan2(-dx, -dz); } // hij rent weg (van je af)
  }
  return true;
}

// ---------- een dreun (honkbalknuppel, ontploffing): door de lucht, even liggen, opstaan en hinkend weg ----------
/** Niemand raakt gewond: het is slapstick. van = waar de klap vandaan komt; kracht ~1 (knuppel) tot 1.6 (ontploffing). */
export function werp(wie, van, kracht = 1) {
  if (wie.worp || wie.groep?.visible === false) return false;
  const dx = wie.pos.x - van.x, dz = wie.pos.z - van.z, d = Math.hypot(dx, dz) || 1;
  // een paar meter, niet meer; en iedereen valt anders: achterover, voorover, opzij rollend, of alleen omver zonder te vliegen
  const soort = kies(["achterover", "achterover", "salto", "opzij", "opzij", "omver"]), k = Math.min(1.5, kracht);
  const vy = soort === "omver" ? 1.6 : tussen(3.2, 4.4) * (0.8 + 0.2 * k), v = (soort === "omver" ? tussen(1.2, 1.8) : tussen(2.2, 3.6)) * (0.75 + 0.25 * k);
  const duur = (2 * vy) / 12; // zo lang is hij in de lucht
  // hoeveel hij in die tijd draait: één keer vloeiend, precies tot hij ligt (geen extra slag onderweg)
  const draai = soort === "salto" ? Math.PI * 2 : soort === "achterover" ? -1.2 : soort === "omver" ? -0.9 : 0;
  wie.worp = { fase: "lucht", vx: (dx / d) * v, vz: (dz / d) * v, vy, y: 0.05, t: 0, tol: draai / duur, rol: soort === "opzij" ? ((Math.random() < 0.5 ? -1 : 1) * Math.PI * 2) / duur : 0,
    ligT: tussen(0.9, 2.6), hink: Math.random() < 0.7 };
  wie.ruzieT = 0; wie.ruzieNeer = 0; wie.schrik = 0; wie.dreigt = false; wie.zit = false;
  wie.richting = Math.atan2(-dx, -dz) + tussen(-0.5, 0.5); // met het gezicht naar de klap, een beetje gedraaid
  wie.m.zet(soort === "omver" ? "klap" : "vliegen", 1, 0);
  return true;
}
/**
 * Er wordt op iemand geschoten (niemand wordt geraakt): hij springt op van schrik, of valt om, en rent dan weg.
 * van = waar het schot vandaan kwam of insloeg; val = omvallen in plaats van opspringen.
 */
export function schrikVan(wie, van, val = Math.random() < 0.5) {
  if (wie.worp || wie.groep?.visible === false) return false;
  const dx = wie.pos.x - van.x, dz = wie.pos.z - van.z, d = Math.hypot(dx, dz) || 1;
  wie.worp = val ? { fase: "lucht", vx: (dx / d) * 1.6, vz: (dz / d) * 1.6, vy: 2.6, y: 0.05, t: 0, tol: (Math.random() < 0.5 ? -1 : 1) * 3.2, ren: true }
    : { fase: "lucht", vx: 0, vz: 0, vy: 3.6, y: 0.05, t: 0, tol: 0, hop: true, ren: true, wx: dx / d, wz: dz / d };
  wie.ruzieT = 0; wie.ruzieNeer = 0; wie.dreigt = false; wie.zit = false;
  wie.m.zet(val ? "klap" : "vliegen", 1, 0);
  return true;
}
/** Na het opspringen of omvallen: wegrennen, van het schot af. */
function renWeg(wie, w) {
  wie.worp = null; wie.groep.rotation.x = wie.groep.rotation.z = 0;
  if (wie.soort === "agent") return;
  if (!wie.g) { wie.richting = Math.atan2(w.wx ?? w.vx, w.wz ?? w.vz) + tussen(-0.5, 0.5); wie.schrik = 4.5; } // staat ergens: rent weg en verdwijnt
  else { wie.schrik = 4.3; wie.wacht = 0; }
}
/** Eén stap van zo'n vlucht; geeft true zolang hij duurt. */
function stapWorp(wie, dt) {
  const w = wie.worp; if (!w) return false;
  w.t += dt;
  const vrij = (x, z) => !(wie.g?.blok?.(x, z, 0.3) ?? false);
  if (w.fase === "lucht") {
    w.vy -= 12 * dt; w.y += w.vy * dt;
    const nx = wie.pos.x + w.vx * dt, nz = wie.pos.z + w.vz * dt;
    if (vrij(nx, nz)) wie.pos.set(nx, 0, nz); else w.vx = w.vz = 0; // tegen een muur: daar valt hij neer
    wie.groep.rotation.x += w.tol * dt; wie.groep.rotation.z += (w.rol ?? 0) * dt;
    if (w.y <= 0 && w.hop) { renWeg(wie, w); return true; }
    if (w.y <= 0) { w.y = 0; w.fase = "ligt"; w.t = 0; wie.groep.rotation.x = 0; wie.groep.rotation.z = 0; wie.m.zet("liggen", 1, "eind"); wie.plof?.(); }
  } else if (w.fase === "ligt") { if (w.t > (w.ren ? 0.7 : w.ligT ?? 1.3)) { w.fase = "op"; w.t = 0; wie.m.zet("opstaan", w.ren ? 1.4 : 1, 0); } }
  else if (w.fase === "op") { if ((w.ren || w.hink === false) && w.t > 1.1) { if (w.hink === false) { w.wx = w.vx || Math.sin(wie.richting + Math.PI); w.wz = w.vz || Math.cos(wie.richting + Math.PI); } renWeg(wie, w); return true; } if (w.t > 1.5) { w.fase = "hinkt"; w.t = 0; wie.richting = Math.atan2(w.vx, w.vz) + tussen(-0.5, 0.5); } }
  else {
    // hinkend weg: langzaam, met een knik bij elke stap
    const nx = wie.pos.x + Math.sin(wie.richting) * 0.85 * dt, nz = wie.pos.z + Math.cos(wie.richting) * 0.85 * dt;
    if (vrij(nx, nz)) wie.pos.set(nx, 0, nz); else wie.richting += 1.2 * dt;
    wie.m.zet("lopen", 0.6);
    const pas = Math.sin(w.t * 5.5); wie.groep.rotation.z = Math.max(0, pas) * 0.16; w.y = Math.max(0, -pas) * 0.03;
    if (w.t > 7) {
      wie.worp = null; wie.groep.rotation.z = 0; wie.ruzieKoel = 20; wie.conditie = 3;
      if (wie.plaats && wie.g && !wie.lijn) { wie.van = wie.g.dichtbij(wie.pos.x, wie.pos.z, wie.bit); const v = wie.g.volgende(-1, wie.van, wie.bit, 1, wie.straal); if (v) { wie.naar = v.n; wie.breed = v.breed; wie.t = 0; wie.plaats(false); } }
      else if (wie.thuis) wie.schrik = 0; else if (!wie.g) wie.weg = true;
      return true;
    }
  }
  wie.m.mixer.update(dt);
  wie.groep.position.set(wie.pos.x, w.y, wie.pos.z); wie.groep.rotation.y = wie.richting;
  return true;
}

// ---------- voetgangers ----------
/** Afspeelsnelheid van de loopbeweging bij een bepaalde vaart (de beweging zelf is gemaakt voor ~1,3 m/s). */
const loopTempo = (v) => THREE.MathUtils.clamp(v / 1.3, 0.6, 1.6);
export class Voetganger extends Reiziger {
  constructor(graaf, scene, straal = 75) {
    // over de stoep naast de rijbaan, aan een vaste kant
    const kant = Math.random() < 0.5 ? 1 : -1, wiebel = tussen(0, 0.6);
    super(graaf, VOET, tussen(1.1, 1.5), (b) => kant * (b > 4 ? b / 2 + 1.0 + wiebel : wiebel), 0.35, 4, straal);
    this.m = maakMens("voetganger");
    this.mens = this.m.object;
    this.kar = !graaf.geenKar && Math.random() < 0.15 ? maakKar() : null;
    this.groep = new THREE.Group();
    this.groep.add(this.mens);
    if (this.kar) { this.kar.position.z = 0.62; this.groep.add(this.kar); this.v *= 0.85; }
    this.schrik = 0;
    this.soort = "voetganger";
    scene.add(this.groep);
    // raakvlakken (lokaal): het lijf
    this.raak = [{ deel: "mens", min: new THREE.Vector3(-0.25, 0, -0.2), max: new THREE.Vector3(0.25, 1.8, 0.2) }];
    this.blijfStaan = Math.random() < 0.15 ? tussen(4, 14) : 0;
    this.belt = Math.random() < 0.3;
  }
  beweeg(dt) {
    const loopt = this.snelheid > 0.25;
    const soort = this.schrik > 4.4 ? "schrik" : !loopt ? (this.kar ? "staan" : this.belt ? "bellen" : "staan") : this.kar ? "duwen" : this.snelheid > 2.5 ? "rennen" : "lopen";
    this.m.zet(soort, soort === "rennen" ? this.snelheid / 3.2 : loopt ? loopTempo(this.snelheid) : 1);
    this.m.mixer.update(dt);
    this.groep.position.copy(this.pos);
    this.groep.rotation.y = this.richting;
    this.handenOpKar();
  }
  /** Beide handen op de duwstang van de winkelwagen. */
  handenOpKar() {
    if (!this.kar || !this.groep.visible || !this.m.hoog.visible) return;
    this.groep.updateMatrixWorld(true);
    const omlaag = new THREE.Vector3(0, -1, 0);
    for (const [k, x] of [["L", 0.18], ["R", -0.18]]) {
      const doel = this.groep.localToWorld(new THREE.Vector3(x, 0.86, 0.32));
      this.m.arm(k, doel, omlaag.clone().add(new THREE.Vector3(Math.sign(x) * 0.4, 0, -0.4).applyQuaternion(this.groep.quaternion)));
    }
  }
  ruzie(naar, slaat, klap, geraakt, zwaar) { return beginRuzie(this, naar, slaat, klap, geraakt, zwaar); }
  stap(dt) {
    if (stapWorp(this, dt)) return;
    if (stapRuzie(this, dt)) return;
    if (this.schrik > 0) {
      this.schrik -= dt;
      this.v = this.schrik > 4.4 ? 0 : 3.4;
      if (this.schrik <= 0) this.v = this.vBasis;
    } else if (this.blijfStaan > 0 && Math.random() < dt * 0.05) { this.wacht = this.blijfStaan; this.blijfStaan = 0; }
    super.stap(dt);
    this.beweeg(dt);
  }
  schrikken() { if (this.schrik <= 0) { this.schrik = 5; this.wacht = 0; } }
  get object() { return this.groep; }
}

// ---------- boodschappers: van de auto naar de winkel en terug ----------
export class Boodschapper extends Voetganger {
  constructor(graaf, scene, auto, winkel) {
    super(graaf, scene);
    if (this.kar) { this.groep.remove(this.kar); this.kar = null; this.v = this.vBasis; }
    this.belt = false;
    this.auto = auto; this.winkel = winkel; this.scene = scene;
    this.fase2 = "heen"; this.binnen = 0;
    this.pos.set(auto.x + tussen(-1, 1), 0, auto.z + tussen(-1, 1)); this.pad.copy(this.pos);
    this.lijn = this.maakLijn([auto.x, auto.z], winkel);
    this.i = 0;
  }
  maakLijn(van, naar) {
    const a = this.g.dichtbij(van[0], van[1], VOET), b = this.g.dichtbij(naar[0], naar[1], VOET);
    const r = this.g.route(a, b, VOET) ?? [a, b];
    return [van, ...r.map((n) => this.g.k[n]), naar];
  }
  stap(dt) {
    if (stapWorp(this, dt)) return;
    if (stapRuzie(this, dt)) return;
    if (this.schrik > 0) { this.schrik -= dt; if (this.schrik <= 0) this.klaar = true; }
    if (this.fase2 === "binnen") {
      this.binnen -= dt;
      if (this.binnen <= 0) {
        // met een kar of met tassen terug naar de auto
        this.fase2 = "terug"; this.groep.visible = true; this.i = 0;
        if (Math.random() < 0.5) { this.kar = maakKar(); this.kar.position.z = 0.62; this.groep.add(this.kar); this.v = this.vBasis * 0.85; }
        else this.tassen = true;
        this.lijn = this.maakLijn(this.winkel, [this.auto.x, this.auto.z]);
      }
      return;
    }
    if (this.fase2 === "inladen") {
      this.binnen -= dt;
      this.m.zet("staan"); this.m.mixer.update(dt); this.handenOpKar();
      if (this.binnen <= 0) this.klaar = true;
      return;
    }
    // langs de lijn lopen
    const snel = this.schrik > 0 ? 3.4 : this.v;
    let rest = snel * dt;
    while (rest > 0 && this.i < this.lijn.length - 1) {
      const b = this.lijn[this.i + 1];
      const dx = b[0] - this.pad.x, dz = b[1] - this.pad.z, d = Math.hypot(dx, dz);
      if (d <= rest) { this.pad.set(b[0], 0, b[1]); rest -= d; this.i++; }
      else { this.pad.x += (dx / d) * rest; this.pad.z += (dz / d) * rest; rest = 0; }
    }
    this.glad(dt);
    // terug bij de auto: ernaast blijven staan (niet erin)
    if (this.i >= this.lijn.length - 1 && this.pos.distanceTo(this.pad) < (this.fase2 === "heen" ? 0.3 : 2.7)) {
      if (this.fase2 === "heen") { this.fase2 = "binnen"; this.binnen = tussen(20, 70); this.groep.visible = false; }
      else { this.fase2 = "inladen"; this.binnen = tussen(3, 7); }
    }
    const loopt = this.snelheid > 0.25;
    this.m.zet(this.schrik > 4.4 ? "schrik" : this.kar ? "duwen" : !loopt ? "staan" : this.snelheid > 2.5 ? "rennen" : this.tassen ? "dragen" : "lopen", loopt ? loopTempo(this.snelheid) : 1);
    this.m.mixer.update(dt);
    this.groep.position.copy(this.pos);
    this.groep.rotation.y = this.richting;
    this.handenOpKar();
  }
  verAf() { return false; }
}

// ---------- mensen die blijven staan of zitten (groepjes, bankjes) ----------
export class Staander {
  constructor(scene, x, z, richting, zit = false, rol = "voetganger") {
    this.m = maakMens(rol); this.mens = this.m.object;
    this.groep = new THREE.Group(); this.groep.add(this.mens);
    this.pos = new THREE.Vector3(x, 0, z); this.pad = this.pos; this.richting = richting; this.zit = zit;
    this.groep.position.copy(this.pos); this.groep.rotation.y = richting;
    this.soort = "voetganger"; this.schrik = 0;
    this.rust = zit ? (Math.random() < 0.5 ? "zittenPraten" : "zitten") : kies(["praten", "praten", "bellen", "armenOver", "staan"]);
    this.raak = [{ deel: "mens", min: new THREE.Vector3(-0.25, 0, -0.25), max: new THREE.Vector3(0.25, zit ? 1.35 : 1.8, 0.25) }];
    scene.add(this.groep);
  }
  ruzie(naar, slaat, klap, geraakt, zwaar) { return this.zit ? false : beginRuzie(this, naar, slaat, klap, geraakt, zwaar); }
  /** Hangjeugd: komt op je af, blijft op een paar meter staan met gebalde vuisten, wijst en schreeuwt. Blijf je te dichtbij, dan haalt er een uit. */
  dreig(dt, spel) {
    const sp = spel.speler, dx = sp.x - this.pos.x, dz = sp.z - this.pos.z, d = Math.hypot(dx, dz) || 1;
    this.thuis ??= this.pos.clone(); this.dreigAfst ??= tussen(2.1, 3.9); this.wisselT ??= 0; this.roepT ??= tussen(0.5, 4);
    if (!this.dreigt) { if (d > 13) return false; this.dreigt = true; }
    else if (d > 19) { this.dreigt = false; return false; }
    let h = Math.atan2(dx, dz) - this.richting; h = Math.atan2(Math.sin(h), Math.cos(h));
    this.richting += h * Math.min(1, dt * 6);
    let loopt = false;
    if (d > this.dreigAfst + 0.3) {
      const st = Math.min(d - this.dreigAfst, 1.9 * dt), nx = this.pos.x + (dx / d) * st, nz = this.pos.z + (dz / d) * st;
      if (spel.vrij?.(nx, nz) ?? true) { this.pos.set(nx, 0, nz); loopt = true; }
    } else if (d < this.dreigAfst - 0.9) { // je komt op hem af: hij wijkt een stapje, maar gaat niet weg
      const nx = this.pos.x - (dx / d) * 1.2 * dt, nz = this.pos.z - (dz / d) * 1.2 * dt;
      if (spel.vrij?.(nx, nz) ?? true) this.pos.set(nx, 0, nz);
    }
    if ((this.wisselT -= dt) <= 0) { this.wisselT = tussen(1.6, 3.4); this.gebaar = kies(["vuisten", "vuisten", "wijzen", "boos"]); this.m.huidig = null; }
    if (loopt) this.m.zet("lopen", 1.3);
    else if (this.gebaar === "boos") this.m.zet("boos"); else if (this.gebaar === "wijzen") this.m.zet("staan"); else this.m.zet("vechtklaar");
    this.m.mixer.update(dt);
    this.groep.position.copy(this.pos); this.groep.rotation.y = this.richting;
    if (this.gebaar === "wijzen" && !loopt && this.m.hoog.visible) {
      this.groep.updateMatrixWorld(true);
      const sch = this.m.plek("DEF-upper_armR").clone(), naar = new THREE.Vector3(sp.x, 1.45, sp.z).sub(sch).normalize();
      this.m.arm("R", sch.addScaledVector(naar, 0.62), new THREE.Vector3(0, -1, 0));
    }
    if ((this.roepT -= dt) <= 0) { this.roepT = tussen(2.5, 6); if (d < 9) spel.schreeuw?.(this.pos); }
    // te lang vlak voor zijn neus: hij haalt uit (hoogstens drie tegelijk)
    if (d < 2.3) { this.dichtT = (this.dichtT ?? 0) + dt; if (this.dichtT > 3 && this.vechter && (spel.hangVecht?.() ?? 0) < 3 && Math.random() < dt * 0.6) { this.dichtT = 0; this.ruzie(sp, true, spel.aangereden); } }
    else this.dichtT = Math.max(0, (this.dichtT ?? 0) - dt);
    return true;
  }
  stap(dt, spel) {
    if (stapWorp(this, dt)) return;
    if (stapRuzie(this, dt)) return;
    if (this.hang && !(this.schrik > 0) && !this.zit) {
      if (spel?.dreig && spel.speler && this.dreig(dt, spel)) return;
      // terug naar de hangplek
      if (this.thuis && this.pos.distanceTo(this.thuis) > 0.8) {
        this.dreigt = false;
        const dx = this.thuis.x - this.pos.x, dz = this.thuis.z - this.pos.z, d = Math.hypot(dx, dz);
        this.pos.x += (dx / d) * 1.3 * dt; this.pos.z += (dz / d) * 1.3 * dt; this.richting = Math.atan2(dx, dz);
        this.m.zet("lopen"); this.m.mixer.update(dt);
        this.groep.position.copy(this.pos); this.groep.rotation.y = this.richting;
        return;
      }
    }
    if (this.schrik > 0) {
      // weg van het geluid
      this.schrik -= dt;
      const v = this.schrik > 4.6 ? 0 : 3.2;
      this.pos.x += Math.sin(this.richting) * v * dt; this.pos.z += Math.cos(this.richting) * v * dt;
      this.m.zet(v ? "rennen" : "schrik");
      if (this.schrik <= 0) this.weg = true;
    } else this.m.zet(this.rust);
    this.m.mixer.update(dt);
    this.groep.position.copy(this.pos); this.groep.rotation.y = this.richting;
  }
  schrikken() {
    if (this.schrik > 0) return;
    this.schrik = 6; this.zit = false;
    this.richting += Math.PI + tussen(-0.8, 0.8);
  }
  verAf() { return false; }
  get object() { return this.groep; }
}

// ---------- fietsers en fatbikes ----------
export class Fietser extends Reiziger {
  constructor(graaf, scene, soort, ronde = 1) {
    const fat = soort === "fatbike";
    // m/s: fatbike 10-14 km/u (goed te volgen in de kijker), gewone fiets 11-15 km/u
    const v = fat ? tussen(2.8, 3.8) * (1 + (ronde - 1) * 0.05) : soort === "ebike" ? tussen(3.8, 4.8) : soort === "bakfiets" ? tussen(2.8, 3.5) : tussen(3, 4.1);
    super(graaf, fat ? FAT : FIETS, v, (b) => (b > 4 ? b / 2 - 0.9 : b > 2 ? 0.5 : 0.2), 0.6, 1.6, fat ? 65 : 100);
    this.soort = soort; this.fat = fat;
    if (fat) this.trek = 1.6;
    this.fiets = maakFiets(soort === "bakfiets" ? "fiets" : soort);
    this.groep = new THREE.Group();
    this.groep.add(this.fiets);
    const fu = this.fiets.userData;
    this.berijders = [maakMens(fat ? "fatbiker" : "voetganger")];
    if (fat && Math.random() < (ronde > 1 ? 0.45 : 0.3)) this.berijders.push(maakMens("fatbiker"));
    this.berijders.forEach((m, i) => {
      // de heup (zoals in de rijbeweging) op het zadel; de bestuurder leunt voorover naar het stuur
      const h = m.zithoogte(), leun = i ? 0.14 : fat ? 0.22 : 0.3;
      m.leun = leun;
      m.object.position.set(0, fu.zadel + 0.07 - h * Math.cos(leun), fu.zadelZ - h * Math.sin(leun) - i * 0.33);
      this.groep.add(m.object);
    });
    this.vlucht = 0;
    this.toestand = "rijden"; // rijden | val | weg
    scene.add(this.groep);
    // raakvlakken: fiets (in lokale ruimte van de groep) + romp en hoofd van de berijders
    this.raak = [...fu.raak];
    this.berijders.forEach((m) => { const y = fu.zadel; this.raak.push({ deel: "mens", min: new THREE.Vector3(-0.21, y + 0.05, m.object.position.z - 0.3), max: new THREE.Vector3(0.21, y + 0.85, m.object.position.z + 0.15) }); });
  }
  stap(dt, spel) {
    if (this.toestand !== "rijden") return;
    if (this.vlucht > 0) { this.vlucht -= dt; this.v = this.vBasis * 1.5; if (this.vlucht <= 0) this.v = this.vBasis; }
    if (this.fat && !this.geenStop && this.vlucht <= 0 && this.wacht <= 0) {
      // fatbikes hangen bij de Jumbo, Bon Appetit en de fietsenrekken
      const plek = spel?.hangplekken?.find((h) => Math.hypot(h.x - this.pos.x, h.z - this.pos.z) < 9);
      if (plek && plek !== this.laatstePlek && Math.random() < dt * 0.8) { this.laatstePlek = plek; this.wacht = tussen(8, 22); }
      // en stoppen af en toe om op hun telefoon te kijken
      else if (Math.random() < dt / 22) this.wacht = tussen(4, 14);
    }
    if (this.vrij) this.vrijRijden(dt);
    else super.stap(dt);
    for (const w of this.fiets.userData.wielen) w.rotation.x += (this.snelheid * dt) / this.fiets.userData.rW;
    const rijdt = this.snelheid > 0.4;
    this.berijders.forEach((m, i) => { m.zet(i ? "fietsen" : rijdt ? "fietsen" : "zittenPraten"); m.mixer.update(dt); });
    // scheef in de bocht: naar de draaisnelheid en de vaart
    this.groep.position.copy(this.pos);
    this.groep.rotation.set(0, this.richting, 0);
    const scheef = THREE.MathUtils.clamp(-this.draaiing * this.snelheid * 0.09, -0.3, 0.3);
    this.fiets.rotation.z = scheef;
    for (const m of this.berijders) m.object.rotation.set(m.leun, 0, scheef);
    // de bestuurder houdt het stuur vast (wie achterop zit niet)
    const m = this.berijders[0];
    if (m && !m.bijgesteld) {
      // schuif de bestuurder zo dat hij het stuur kan pakken (arm ~0,6 m); de modellen verschillen per fiets
      this.groep.updateMatrixWorld(true);
      const hv = this.fiets.userData.handvatten, midden = this.fiets.localToWorld(hv[0].clone().add(hv[1]).multiplyScalar(0.5));
      const sch = this.groep.worldToLocal(m.plek("DEF-upper_armL").clone().add(m.plek("DEF-upper_armR")).multiplyScalar(0.5));
      const doel = this.groep.worldToLocal(midden);
      const d = sch.distanceTo(doel);
      if (d > 0.6) { m.object.position.z += Math.min(0.05, (d - 0.58) * 0.5); m.object.position.y -= Math.min(0.01, (d - 0.58) * 0.08); }
      else m.bijgesteld = true;
      if ((m.stappen = (m.stappen ?? 0) + 1) > 40) m.bijgesteld = true;
    }
    // wie achterop zit, zit strak achter de bestuurder op het zadel en houdt hem vast
    const p = this.berijders[1];
    if (p && m) {
      p.object.position.z = m.object.position.z - 0.33;
      p.object.position.y = this.fiets.userData.zadel + 0.07 - p.zithoogte() * Math.cos(p.leun);
      if (p.hoog.visible) {
        this.groep.updateMatrixWorld(true);
        const heup = m.plek("DEF-hips"), q = this.groep.quaternion;
        const omlaag = new THREE.Vector3(0, -1, -0.3).applyQuaternion(q);
        for (const [k, x] of [["L", 0.17], ["R", -0.17]]) p.arm(k, heup.clone().add(new THREE.Vector3(x, 0.2, 0.02).applyQuaternion(q)), omlaag.clone().add(new THREE.Vector3(x * 4, 0, 0).applyQuaternion(q)));
      }
    }
    if (m?.hoog.visible) {
      this.groep.updateMatrixWorld(true);
      const terug = new THREE.Vector3(0, -0.5, -1).applyQuaternion(this.groep.quaternion);
      this.fiets.userData.handvatten.forEach((h, i) => { // [0] = links (+x), [1] = rechts
        const opzij = new THREE.Vector3(i ? -0.8 : 0.8, 0, 0).applyQuaternion(this.groep.quaternion);
        m.arm(i ? "R" : "L", this.fiets.localToWorld(h.clone()), terug.clone().add(opzij));
      });
    }
  }
  verAf() { return this.vrij || this.missie ? false : super.verAf(); }
  /** Bonus: rechtstreeks van punt naar punt, dwars over straat, fietspad en tramrails. */
  vrijRijden(dt) {
    if (this.wacht > 0) this.wacht -= dt;
    else {
      if (!this.doel || Math.hypot(this.doel[0] - this.pad.x, this.doel[1] - this.pad.z) < 1) {
        // een nieuw punt, liefst ergens anders heen (niet terug)
        // niet te dichtbij, en de rechte lijn ernaartoe mag niet door een gebouw gaan
        const vrijeLijn = (q) => {
          const dx = q[0] - this.pad.x, dz = q[1] - this.pad.z, d = Math.hypot(dx, dz);
          for (let t = 1.5; t < d; t += 1.5) if (this.g.blok?.(this.pad.x + (dx / d) * t, this.pad.z + (dz / d) * t, 0.6)) return false;
          return true;
        };
        let p, i = 0;
        do p = kies(this.vrij); while (++i < 14 && (Math.hypot(p[0] - this.pad.x, p[1] - this.pad.z) < 15 || !vrijeLijn(p)));
        if (!vrijeLijn(p)) { this.wacht = 0.5; return this.glad(dt); } // geen vrije lijn gevonden: even wachten
        this.doel = p;
        if (Math.random() < 0.15) this.wacht = tussen(2, 7); // even stoppen voor de telefoon
      }
      const dx = this.doel[0] - this.pad.x, dz = this.doel[1] - this.pad.z, d = Math.hypot(dx, dz), st = Math.min(d, this.v * dt);
      this.pad.x += (dx / d) * st; this.pad.z += (dz / d) * st;
    }
    this.glad(dt);
  }
  schrikken() { if (this.fat) { this.vlucht = 8; this.wacht = 0; } }
  get object() { return this.groep; }
}

// ---------- auto's ----------
export class Auto extends Reiziger {
  constructor(graaf, scene) {
    super(graaf, AUTO, tussen(4, 6.5), (b) => Math.max(0.2, b / 4), 0.6, 1.1);
    this.auto = maakAuto();
    this.soort = "auto";
    scene.add(this.auto);
    this.raak = this.auto.userData.raak;
    // de bestuurder: links voorin, in de rijhouding
    const [sx, sy, sz] = this.auto.userData.stoel;
    this.m = maakMens("voetganger");
    this.m.zet("fietsen");
    this.m.object.position.set(sx, sy - this.m.zithoogte(), -sz);
    this.auto.add(this.m.object);
  }
  stap(dt, spel) {
    // remmen voor wie er vlak voor zit
    let rem = 1;
    const fx = Math.sin(this.richting), fz = Math.cos(this.richting);
    for (const a of spel.reizigers) {
      if (a === this) continue;
      const dx = a.pos.x - this.pos.x, dz = a.pos.z - this.pos.z;
      const voor = dx * fx + dz * fz, zij = Math.abs(dx * fz - dz * fx);
      if (voor > 0 && voor < 7 && zij < 1.6) rem = Math.min(rem, (voor - 2.6) / 4.4);
    }
    // geparkeerde auto's (en een auto die jij ergens hebt laten staan) die in de weg staan: langzaam eromheen sturen
    let uit = 0;
    const gezien = new Set();
    for (const o of [...(spel.verlaten ?? []), ...(this.g.autosBij?.(this.pos.x + fx * 4, this.pos.z + fz * 4) ?? []), ...(this.g.autosBij?.(this.pos.x + fx * 9, this.pos.z + fz * 9) ?? [])]) {
      if (gezien.has(o)) continue; gezien.add(o);
      const dx = o.position.x - this.pos.x, dz = o.position.z - this.pos.z, voor = dx * fx + dz * fz, links = dx * fz - dz * fx;
      if (voor < -3 || voor > 12 || Math.abs(links) > 3.2) continue;
      const pl = links - (this.uitwijk ?? 0); // waar hij staat ten opzichte van de gewone rijlijn (links = +)
      const nodig = pl >= 0 ? Math.max(0, 2.3 - pl) : Math.min(0, -2.3 - pl);
      if (Math.abs(nodig) > Math.abs(uit)) uit = nodig;
    }
    uit = THREE.MathUtils.clamp(uit, -2.6, 2.6);
    if (Math.abs(uit) > 0.3) rem = Math.min(rem, 0.55);
    this.uitwijk = (this.uitwijk ?? 0) + (uit - (this.uitwijk ?? 0)) * Math.min(1, dt * 1.6);
    // twee auto's die toch in elkaar staan (net verschenen op dezelfde plek, of klem geraakt): rustig uit elkaar
    for (const a of spel.reizigers) {
      if (a === this || !a.wordBoos) continue;
      const dx = this.pos.x - a.pos.x, dz = this.pos.z - a.pos.z, d = Math.hypot(dx, dz);
      if (d < 2.2) { const st = 1.5 * dt, l = d || 1; this.pos.x += (d ? dx / l : fz) * st; this.pos.z += (d ? dz / l : -fx) * st; }
    }
    // kruisend verkeer: wie van rechts komt gaat voor. Sta je te lang stil, dan rijd je toch (anders wacht iedereen op iedereen).
    this.geduld = (this.geduld ?? 0) - dt;
    if (this.geduld <= 0) for (const a of spel.reizigers) {
      if (a === this || !a.wordBoos) continue;
      const dx = a.pos.x - this.pos.x, dz = a.pos.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d > 7.5) continue;
      const voor = dx * fx + dz * fz, links = dx * fz - dz * fx, kruist = Math.abs(Math.sin(a.richting - this.richting)) > 0.5;
      if (voor > 0.5 && kruist && links < 0.5) { rem = Math.min(rem, (d - 4.6) / 3); this.wachtT = (this.wachtT ?? 0) + dt; if (this.wachtT > 4) { this.wachtT = 0; this.geduld = 3; } }
    }
    const sp = spel.speler; // waar je loopt (null als je bij je raam staat)
    if (this.boos > 0 && sp) {
      // kwaad (je schoot op hem of sloeg tegen de auto): recht op je af, zonder te remmen
      this.boos -= dt;
      const dx = sp.x - this.pad.x, dz = sp.z - this.pad.z, d = Math.hypot(dx, dz) || 1, st = Math.min(d, 7.5 * dt);
      this.pad.x += (dx / d) * st; this.pad.z += (dz / d) * st;
      this.glad(dt);
      if (Math.hypot(sp.x - this.pos.x, sp.z - this.pos.z) < 1.7) { spel.aangereden?.(); this.boos = 0; }
      if (this.boos <= 0) {
        // terug de weg op: verder vanaf het dichtstbijzijnde punt
        this.boos = 0;
        this.van = this.g.dichtbij(this.pos.x, this.pos.z, AUTO);
        const v = this.g.volgende(-1, this.van, AUTO, 1, this.straal);
        if (v) { this.naar = v.n; this.breed = v.breed; this.t = 0; this.plaats(false); }
      }
    } else {
      // gewoon: ook remmen als jij voor de auto loopt
      if (sp) {
        const dx = sp.x - this.pos.x, dz = sp.z - this.pos.z, voor = dx * fx + dz * fz, zij = Math.abs(dx * fz - dz * fx);
        if (voor > 0 && voor < 12 && zij < 1.8) rem = Math.min(rem, (voor - 4.6) / 6); // stopt ruim een meter voor je
        // sta je in de weg, dan toetert hij (niet vaker dan eens in de paar seconden)
        this.toeterT = (this.toeterT ?? 0) - dt;
        if (voor > 0 && voor < 7 && zij < 1.8 && this.toeterT <= 0) { this.toeterT = 3 + Math.random() * 3; spel.toeter?.(); }
      }
      this.v = this.vBasis * THREE.MathUtils.clamp(rem, 0, 1) * (Math.hypot(this.pos.x - this.g.c[0], this.pos.z - this.g.c[1]) < 45 ? 0.6 : 1);
      super.stap(dt);
    }
    this.auto.position.copy(this.pos);
    this.auto.rotation.y = this.richting;
    for (const w of this.auto.userData.wielen) w.rotation.x += (this.snelheid * dt) / this.auto.userData.straal;
    if (this.m.hoog.visible) this.m.mixer.update(dt);
  }
  schrikken() {}
  /** Je schoot op de auto of sloeg ertegen: de bestuurder komt op je af. */
  wordBoos() { this.boos = 12; }
  get object() { return this.auto; }
}


// ---------- handhaving en politie: komen te voet achter je aan als je gezocht wordt ----------
export class Agent {
  constructor(graaf, scene, x, z, rol) {
    this.g = graaf; this.rol = rol; this.soort = "agent";
    this.m = maakMens(rol); this.mens = this.m.object;
    this.groep = new THREE.Group(); this.groep.add(this.mens);
    this.pos = new THREE.Vector3(x, 0, z); this.pad = this.pos; this.richting = 0;
    this.v = rol === "agent" ? 4.7 : 3.1; // een handhaver kun je al joggend voorblijven, een agent alleen met sprinten
    this.lijn = []; this.herT = 0; this.zichtT = Math.random() * 0.3; this.ziet = false; this.duwT = 0; this.snelheid = 0;
    this.groep.position.copy(this.pos);
    this.raak = [{ deel: "mens", min: new THREE.Vector3(-0.25, 0, -0.2), max: new THREE.Vector3(0.25, 1.85, 0.2) }];
    scene.add(this.groep);
  }
  /** Probeer een stap; glijd langs muren en heggen. */
  loop(dx, dz, st) {
    const d = Math.hypot(dx, dz) || 1, nx = this.pos.x + (dx / d) * st, nz = this.pos.z + (dz / d) * st;
    const dicht = (x, z) => this.g.blok?.(x, z, 0.35) || this.g.heg?.(x, z, 0.1);
    if (!dicht(nx, nz)) this.pos.set(nx, 0, nz); else if (!dicht(nx, this.pos.z)) this.pos.x = nx; else if (!dicht(this.pos.x, nz)) this.pos.z = nz; else return false;
    let h = Math.atan2(dx, dz) - this.richting; h = Math.atan2(Math.sin(h), Math.cos(h));
    this.richting += h * 0.25;
    return true;
  }
  /** Je slaat een agent: hij vecht terug (en na een paar klappen ligt hij even). */
  ruzie(naar, slaat, klap, geraakt, zwaar) {
    if (this.boeit || this.afdruipen) return false;
    this.vechter = true; this.grijp = 0;
    if (this.conditie === undefined) this.conditie = this.rol === "agent" ? 4 : 3;
    return beginRuzie(this, naar, true, klap, geraakt, zwaar);
  }
  stap(dt, spel) {
    const doel = spel.speler;
    if (this.boeit) {
      // hij slaat je in de boeien: achter je, handen aan je polsen
      this.m.zet("staan"); this.m.mixer.update(dt);
      this.groep.position.copy(this.pos); this.groep.rotation.y = this.richting;
      return;
    }
    if (stapWorp(this, dt)) return;
    if (doel && !this.afdruipen && stapRuzie(this, dt)) return;
    if (this.afdruipen || !doel) {
      // klaar: rustig weglopen en dan verdwijnen
      this.afT = (this.afT ?? 9) - dt; this.ziet = false;
      const weg = doel ? [this.pos.x - doel.x, this.pos.z - doel.z] : [Math.sin(this.richting), Math.cos(this.richting)];
      this.loop(weg[0], weg[1], 1.4 * dt); this.m.zet("lopen");
      if (this.afT <= 0) this.klaar = true;
    } else if (this.duwT > 0) {
      this.duwT -= dt; this.m.zet("schrik"); // even uit het veld geslagen
    } else {
      const dx = doel.x - this.pos.x, dz = doel.z - this.pos.z, d = Math.hypot(dx, dz);
      // zien ze je? (niet te ver weg, en niets ertussen)
      if ((this.zichtT -= dt) <= 0) { this.zichtT = 0.3; this.ziet = d < 55 && spel.zichtVrij(this.pos, doel); }
      // de route: rechtstreeks als dat kan, anders over de paden
      if ((this.herT -= dt) <= 0) {
        this.herT = 1;
        let recht = d < 30;
        if (recht) for (let t = 1; t < d; t += 1) if (this.g.blok?.(this.pos.x + (dx / d) * t, this.pos.z + (dz / d) * t, 0.35) || this.g.heg?.(this.pos.x + (dx / d) * t, this.pos.z + (dz / d) * t, 0.1)) { recht = false; break; }
        if (recht) this.lijn = [];
        else {
          // over alle paden (ook fietspaden): bit FAT zit op elke kant van het netwerk
          const r = this.g.route(this.g.dichtbij(this.pos.x, this.pos.z, FAT), this.g.dichtbij(doel.x, doel.z, FAT), FAT);
          this.lijn = r ? r.map((n) => this.g.k[n]) : [];
          // niet eerst terug naar het dichtstbijzijnde punt als je al onderweg bent naar het volgende
          const af = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]), hier = [this.pos.x, this.pos.z];
          while (this.lijn.length > 1 && af(hier, this.lijn[1]) <= af(this.lijn[0], this.lijn[1]) + 0.5) this.lijn.shift();
        }
      }
      while (this.lijn.length && Math.hypot(this.lijn[0][0] - this.pos.x, this.lijn[0][1] - this.pos.z) < 1) this.lijn.shift();
      const [tx, tz] = this.lijn.length ? this.lijn[0] : [doel.x, doel.z];
      const ox = this.pos.x, oz = this.pos.z;
      if (d > 1.1 && !this.loop(tx - this.pos.x, tz - this.pos.z, this.v * dt)) this.herT = 0;
      this.snelheid = Math.hypot(this.pos.x - ox, this.pos.z - oz) / Math.max(dt, 1e-3);
      this.m.zet(this.snelheid > 3.8 ? "sprinten" : this.snelheid > 0.5 ? "rennen" : "staan", this.snelheid > 3.8 ? this.snelheid / 5.6 : Math.max(0.7, this.snelheid / 3.3));
      // vastpakken: een tel naast je staan en je bent erbij. Sla je hem van je af of ren je weg, dan begint hij opnieuw.
      if (d < 1.45) { this.grijp = (this.grijp ?? 0) + dt; if (this.grijp > 1) { this.grijp = 0; spel.aangehouden?.(this); } }
      else this.grijp = Math.max(0, (this.grijp ?? 0) - dt * 2);
    }
    this.m.mixer.update(dt);
    this.groep.position.copy(this.pos); this.groep.rotation.y = this.richting;
  }
  /** Een duw of klap: hij staat even stil. */
  duw() { this.duwT = 2.4; }
  schrikken() {}
  get object() { return this.groep; }
}
