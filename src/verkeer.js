// Iedereen die beweegt: voetgangers, fietsers, auto's en fatbikes. Ze volgen het netwerk uit OSM.
import * as THREE from "three";
import { maakMens, houding, maakFiets, maakAuto, maakKar, kies, tussen } from "./figuren.js";

export const AUTO = 1, FIETS = 2, VOET = 4, FAT = 8;
const SPEELSTRAAL = 120; // hier gebeurt het; verder weg keert men terug of verdwijnt

export class Graaf {
  constructor({ knopen, kanten }) {
    this.k = knopen;
    this.buren = knopen.map(() => []);
    for (const [a, b, bits, breed, een] of kanten) {
      this.buren[a].push({ n: b, bits, breed });
      if (!een || !(bits & AUTO)) this.buren[b].push({ n: a, bits: een ? bits & ~AUTO : bits, breed });
    }
  }
  /** Een willekeurige knoop met een buur van dit soort, binnen r meter van het midden. */
  startKnoop(bit, r = SPEELSTRAAL, rMin = 0) {
    for (let i = 0; i < 400; i++) {
      const n = (Math.random() * this.k.length) | 0, d = Math.hypot(...this.k[n]);
      if (d < r && d >= rMin && this.buren[n].some((b) => b.bits & bit)) return n;
    }
    return 0;
  }
  volgende(van, via, bit, trek = 1) {
    const opties = this.buren[via].filter((b) => b.bits & bit);
    if (!opties.length) return null;
    const terug = opties.length > 1 ? opties.filter((b) => b.n !== van) : opties;
    // weeg naar het speelgebied toe
    const gew = terug.map((b) => {
      const d = Math.hypot(...this.k[b.n]);
      return d < SPEELSTRAAL * 0.7 ? 3 * trek : d < SPEELSTRAAL ? 1.5 : 0.3 / trek;
    });
    let r = Math.random() * gew.reduce((a, b) => a + b, 0);
    for (let i = 0; i < terug.length; i++) if ((r -= gew[i]) <= 0) return terug[i];
    return terug.at(-1);
  }
}

const tmp = new THREE.Vector3();

/** Basis: iets dat over het netwerk rijdt of loopt. */
class Reiziger {
  constructor(graaf, bit, snelheid, zij, traag = 0.5, maxDraai = 2) {
    this.g = graaf; this.bit = bit; this.v = snelheid; this.vBasis = snelheid; this.zij = zij;
    this.traag = traag; // hoe ruim bochten genomen worden (s): hoger = vloeiender
    this.maxDraai = maxDraai; // rad/s: een fiets keert niet op een dubbeltje
    this.van = graaf.startKnoop(bit);
    const eerste = graaf.volgende(-1, this.van, bit);
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
    const off = this.zij(this.breed);
    this.pad.set(a[0] + dx * this.t - (dz / l) * off, 0, a[1] + dz * this.t + (dx / l) * off);
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
        const vlg = this.g.volgende(this.van, nu, this.bit, this.trek ?? 1);
        if (!vlg) { this.van = nu; this.naar = this.van; this.t = 0; break; }
        this.van = nu; this.naar = vlg.n; this.breed = vlg.breed; this.t = 0;
        const a = this.g.k[this.van], b = this.g.k[this.naar];
        this.lengte = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      }
      this.plaats(false);
    }
    // vloeiend achter het routepunt aan: bochten worden bogen, sprongen verdwijnen
    const k = 1 - Math.exp(-dt / this.traag);
    const ox = this.pos.x, oz = this.pos.z;
    this.pos.lerp(this.pad, k);
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
  verAf() { return Math.hypot(this.pos.x, this.pos.z) > SPEELSTRAAL * 1.35; }
}

// ---------- voetgangers ----------
export class Voetganger extends Reiziger {
  constructor(graaf, scene) {
    // over de stoep naast de rijbaan, aan een vaste kant
    const kant = Math.random() < 0.5 ? 1 : -1, wiebel = tussen(0, 0.6);
    super(graaf, VOET, tussen(1.1, 1.5), (b) => kant * (b > 4 ? b / 2 + 1.0 + wiebel : wiebel), 0.35, 4);
    this.mens = maakMens({ tas: Math.random() < 0.2 ? kies(["#3a2a1a", "#222", "#6a1a2a"]) : null, pet: Math.random() < 0.1 ? kies(["#222", "#a33", "#335"]) : null });
    this.kar = Math.random() < 0.18 ? maakKar() : null;
    this.groep = new THREE.Group();
    this.groep.add(this.mens);
    if (this.kar) { this.kar.position.z = 0.75; this.groep.add(this.kar); this.v *= 0.85; }
    this.fase = Math.random() * 6;
    this.schrik = 0;
    this.soort = "voetganger";
    scene.add(this.groep);
    // raakvlakken (lokaal): het lijf
    this.raak = [{ deel: "mens", min: new THREE.Vector3(-0.25, 0, -0.2), max: new THREE.Vector3(0.25, 1.8, 0.2) }];
    this.blijfStaan = Math.random() < 0.15 ? tussen(4, 14) : 0;
  }
  stap(dt) {
    if (this.schrik > 0) {
      this.schrik -= dt;
      this.v = this.schrik > 4.4 ? 0 : 3.6;
      if (this.schrik <= 0) this.v = this.vBasis;
    } else if (this.blijfStaan > 0 && Math.random() < dt * 0.05) { this.wacht = this.blijfStaan; this.blijfStaan = 0; }
    super.stap(dt);
    const loopt = this.snelheid > 0.25;
    this.fase += dt * (loopt ? this.snelheid * 4.4 : 1);
    const soort = this.schrik > 4.4 ? "schrik" : !loopt ? (this.kar ? "duwen" : Math.random() < 0.002 ? "bellen" : this.vorige === "bellen" ? "bellen" : "staan") : this.kar ? "duwen" : this.snelheid > 2.5 ? "rennen" : "lopen";
    this.vorige = soort;
    houding(this.mens, soort, this.fase, loopt ? Math.min(1, this.snelheid / 1.2) : 0);
    this.groep.position.copy(this.pos);
    this.groep.rotation.y = this.richting;
  }
  schrikken() { if (this.schrik <= 0) { this.schrik = 5; this.wacht = 0; } }
  get object() { return this.groep; }
}

// ---------- fietsers en fatbikes ----------
export class Fietser extends Reiziger {
  constructor(graaf, scene, soort, ronde = 1) {
    const fat = soort === "fatbike";
    // m/s: fatbike 14-19 km/u, gewone fiets 11-15 km/u
    const v = fat ? tussen(3.9, 5.2) * (1 + (ronde - 1) * 0.05) : soort === "ebike" ? tussen(3.8, 4.8) : soort === "bakfiets" ? tussen(2.8, 3.5) : tussen(3, 4.1);
    super(graaf, fat ? FAT : FIETS, v, (b) => (b > 4 ? b / 2 - 0.9 : b > 2 ? 0.5 : 0.2), 0.6, 1.6);
    this.soort = soort; this.fat = fat;
    if (fat) this.trek = 1.6;
    this.fiets = maakFiets(soort);
    this.groep = new THREE.Group();
    this.groep.add(this.fiets);
    const fu = this.fiets.userData;
    this.berijders = [];
    const berijder = maakMens(fat ? { capuchon: Math.random() < 0.6, shirt: kies(["#1b1b1b", "#2a2a2a", "#3a3f4a", "#575c63", "#e8e8e8", "#4a5a3a"]), broek: kies(["#1b1b1b", "#3a3a3a", "#5a5e66"]), schoen: "#f2f2f2", lang: tussen(0.92, 1.02) } : { pet: Math.random() < 0.08 ? "#222" : null });
    this.berijders.push(berijder);
    if (fat && Math.random() < (ronde > 1 ? 0.45 : 0.3)) this.berijders.push(maakMens({ capuchon: Math.random() < 0.5, shirt: kies(["#1b1b1b", "#c9b79c", "#e8e4dc", "#6d5b8c"]), lang: tussen(0.9, 1.0) }));
    this.berijders.forEach((m, i) => {
      // zithoogte: heup (0.93 * schaal) op zadelhoogte
      m.position.set(0, fu.zadel + 0.05 - 0.93 * m.scale.y, (fat ? -0.05 : -0.3) - i * 0.42);
      this.groep.add(m);
    });
    this.fase = Math.random() * 6;
    this.vlucht = 0;
    this.hangen = 0;
    this.toestand = "rijden"; // rijden | val | weg
    scene.add(this.groep);
    // raakvlakken: fiets (in lokale ruimte van de groep) + berijders
    this.raak = [...fu.raak];
    // romp en hoofd van de berijders (zittend: de heup zit op zadelhoogte)
    this.berijders.forEach((m) => this.raak.push({ deel: "mens", min: new THREE.Vector3(-0.21, m.position.y + 0.9 * m.scale.y, m.position.z - 0.28), max: new THREE.Vector3(0.21, m.position.y + 1.72 * m.scale.y, m.position.z + 0.12) }));
  }
  stap(dt, spel) {
    if (this.toestand !== "rijden") return;
    if (this.vlucht > 0) { this.vlucht -= dt; this.v = this.vBasis * 1.5; if (this.vlucht <= 0) this.v = this.vBasis; }
    if (this.fat && this.vlucht <= 0 && this.wacht <= 0) {
      // fatbikes hangen soms bij de ingang van de Jumbo
      if (spel?.jumbo && this.hangen === 0 && this.pos.distanceTo(spel.jumbo) < 14 && Math.random() < dt * 0.6) { this.hangen = -1; this.wacht = tussen(8, 20); }
      // en stoppen af en toe om op hun telefoon te kijken
      else if (Math.random() < dt / 22) this.wacht = tussen(4, 14);
    }
    super.stap(dt);
    const rijdt = this.snelheid > 0.4;
    this.fase += dt * (rijdt ? this.snelheid / this.fiets.userData.rW : 0.8);
    for (const w of this.fiets.userData.wielen) w.rotation.x += (this.snelheid * dt) / this.fiets.userData.rW;
    this.berijders.forEach((m, i) => houding(m, i ? "achterop" : !rijdt ? "wachten" : this.fat ? "fietsen" : "trappen", this.fase * (this.fat ? 0.3 : 0.5)));
    // scheef in de bocht: naar de draaisnelheid en de vaart
    this.groep.position.copy(this.pos);
    this.groep.rotation.set(0, this.richting, 0);
    const scheef = THREE.MathUtils.clamp(-this.draaiing * this.snelheid * 0.09, -0.3, 0.3);
    for (const o of [this.fiets, ...this.berijders]) o.rotation.z = scheef;
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
    this.alarm = 0;
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
    this.v = this.vBasis * THREE.MathUtils.clamp(rem, 0, 1) * (Math.hypot(this.pos.x, this.pos.z) < 45 ? 0.6 : 1);
    super.stap(dt);
    this.auto.position.copy(this.pos);
    this.auto.rotation.y = this.richting;
  }
  schrikken() {}
  get object() { return this.auto; }
}
