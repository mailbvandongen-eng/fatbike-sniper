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
      const d = Math.hypot(...this.k[b.n]);
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
        const vlg = this.g.volgende(this.van, nu, this.bit, this.trek ?? 1, this.straal);
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
  verAf() { return Math.hypot(this.pos.x, this.pos.z) > this.straal * 1.35; }
}

// ---------- ruzie: iemand tegen wie je oploopt (of die je een duw geeft) ----------
/** Begin een ruzie. slaat = hij haalt aan het eind uit; klap() = wat er dan met jou gebeurt; geraakt = hij kreeg zelf een tik. */
function beginRuzie(wie, naar, slaat, klap, geraakt = false) {
  if (wie.ruzieT > 0 || wie.ruzieKoel > 0 || wie.schrik > 0 || wie.groep.visible === false) return false;
  wie.ruzieT = tussen(2.2, 3.4); wie.ruzieNaar = naar; wie.ruzieSlaat = slaat; wie.ruzieKlap = klap; wie.ruzieGegeven = false;
  wie.m.zet(geraakt ? "schrik" : "boos", 1, 0);
  wie.ruzieStart = geraakt ? 0.7 : 0;
  return true;
}
/** Eén stap van de ruzie; geeft true zolang hij duurt. */
function stapRuzie(wie, dt) {
  if (wie.ruzieKoel > 0) wie.ruzieKoel -= dt;
  if (!(wie.ruzieT > 0)) return false;
  wie.ruzieT -= dt; wie.ruzieStart -= dt;
  // naar je toe draaien
  const doel = Math.atan2(wie.ruzieNaar.x - wie.pos.x, wie.ruzieNaar.z - wie.pos.z);
  let d = doel - wie.richting; d = Math.atan2(Math.sin(d), Math.cos(d));
  wie.richting += d * Math.min(1, dt * 7);
  if (wie.ruzieSlaat && wie.ruzieT < 0.75) {
    wie.m.zet("stomp");
    if (wie.ruzieT < 0.4 && !wie.ruzieGegeven) {
      wie.ruzieGegeven = true;
      if (Math.hypot(wie.ruzieNaar.x - wie.pos.x, wie.ruzieNaar.z - wie.pos.z) < 1.8) wie.ruzieKlap?.();
    }
  } else if (wie.ruzieStart <= 0) wie.m.zet("boos");
  wie.m.mixer.update(dt);
  wie.groep.position.copy(wie.pos); wie.groep.rotation.y = wie.richting;
  if (wie.ruzieT <= 0) { wie.ruzieKoel = 20; wie.wacht = 0; }
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
    this.kar = Math.random() < 0.15 ? maakKar() : null;
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
  ruzie(naar, slaat, klap, geraakt) { return beginRuzie(this, naar, slaat, klap, geraakt); }
  stap(dt) {
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
    if (this.i >= this.lijn.length - 1 && this.pos.distanceTo(this.pad) < 0.3) {
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
  constructor(scene, x, z, richting, zit = false) {
    this.m = maakMens("voetganger"); this.mens = this.m.object;
    this.groep = new THREE.Group(); this.groep.add(this.mens);
    this.pos = new THREE.Vector3(x, 0, z); this.pad = this.pos; this.richting = richting; this.zit = zit;
    this.groep.position.copy(this.pos); this.groep.rotation.y = richting;
    this.soort = "voetganger"; this.schrik = 0;
    this.rust = zit ? (Math.random() < 0.5 ? "zittenPraten" : "zitten") : kies(["praten", "praten", "bellen", "armenOver", "staan"]);
    this.raak = [{ deel: "mens", min: new THREE.Vector3(-0.25, 0, -0.25), max: new THREE.Vector3(0.25, zit ? 1.35 : 1.8, 0.25) }];
    scene.add(this.groep);
  }
  ruzie(naar, slaat, klap, geraakt) { return this.zit ? false : beginRuzie(this, naar, slaat, klap, geraakt); }
  stap(dt) {
    if (stapRuzie(this, dt)) return;
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
      const h = m.zithoogte(), leun = i ? 0.05 : fat ? 0.22 : 0.3;
      m.leun = leun;
      m.object.position.set(0, fu.zadel + 0.07 - h * Math.cos(leun), fu.zadelZ - h * Math.sin(leun) - i * 0.45);
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
    if (this.fat && this.vlucht <= 0 && this.wacht <= 0) {
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
    this.berijders.forEach((m, i) => { m.zet(i ? "achterop" : rijdt ? "fietsen" : "zittenPraten"); m.mixer.update(dt); });
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
    if (m?.hoog.visible) {
      this.groep.updateMatrixWorld(true);
      const terug = new THREE.Vector3(0, -0.5, -1).applyQuaternion(this.groep.quaternion);
      this.fiets.userData.handvatten.forEach((h, i) => { // [0] = links (+x), [1] = rechts
        const opzij = new THREE.Vector3(i ? -0.8 : 0.8, 0, 0).applyQuaternion(this.groep.quaternion);
        m.arm(i ? "R" : "L", this.fiets.localToWorld(h.clone()), terug.clone().add(opzij));
      });
    }
  }
  verAf() { return this.vrij ? false : super.verAf(); }
  /** Bonus: rechtstreeks van punt naar punt, dwars over straat, fietspad en tramrails. */
  vrijRijden(dt) {
    if (this.wacht > 0) this.wacht -= dt;
    else {
      if (!this.doel || Math.hypot(this.doel[0] - this.pad.x, this.doel[1] - this.pad.z) < 1) {
        // een nieuw punt, liefst ergens anders heen (niet terug)
        let p, i = 0;
        do p = kies(this.vrij); while (++i < 8 && Math.hypot(p[0] - this.pad.x, p[1] - this.pad.z) < 15);
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
      }
      this.v = this.vBasis * THREE.MathUtils.clamp(rem, 0, 1) * (Math.hypot(this.pos.x, this.pos.z) < 45 ? 0.6 : 1);
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
