// Alle geluid wordt met de Web Audio API gemaakt: geen bestanden nodig.
export class Geluid {
  constructor() { this.ctx = null; }
  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    const ctx = (this.ctx = new C());
    this.uit = ctx.createGain(); this.uit.gain.value = 0.9; this.uit.connect(ctx.destination);
    // echo tussen de gebouwen
    this.echo = ctx.createDelay(1); this.echo.delayTime.value = 0.23;
    const terug = ctx.createGain(); terug.gain.value = 0.32;
    const dof = ctx.createBiquadFilter(); dof.type = "lowpass"; dof.frequency.value = 1400;
    this.echo.connect(dof); dof.connect(terug); terug.connect(this.echo); dof.connect(this.uit);
    const n = ctx.sampleRate * 2;
    this.ruis = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = this.ruis.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    // bruine ruis voor de stad
    this.bruin = ctx.createBuffer(1, n, ctx.sampleRate);
    const b = this.bruin.getChannelData(0);
    let l = 0;
    for (let i = 0; i < n; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = l * 3.5; }
    const stad = ctx.createBufferSource(); stad.buffer = this.bruin; stad.loop = true;
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 500;
    this.sfeer = ctx.createGain(); this.sfeer.gain.value = 0.22;
    stad.connect(f); f.connect(this.sfeer); this.sfeer.connect(this.uit); stad.start();
  }
  get t() { return this.ctx.currentTime; }
  ruisStoot({ duur, filter = "lowpass", freq = 2000, freq2, q = 0.7, gain = 1, echo = 0, start = 0, buffer }) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = this.t + start;
    const s = ctx.createBufferSource(); s.buffer = buffer ?? this.ruis;
    const f = ctx.createBiquadFilter(); f.type = filter; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (freq2) f.frequency.exponentialRampToValueAtTime(freq2, t + duur);
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + duur);
    s.connect(f); f.connect(g); g.connect(this.uit);
    if (echo) { const e = ctx.createGain(); e.gain.value = echo; g.connect(e); e.connect(this.echo); }
    s.start(t, Math.random()); s.stop(t + duur + 0.05);
  }
  toon({ freq, freq2, duur, type = "sine", gain = 0.5, start = 0 }) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = this.t + start;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (freq2) o.frequency.exponentialRampToValueAtTime(freq2, t + duur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + duur);
    o.connect(g); g.connect(this.uit); o.start(t); o.stop(t + duur + 0.05);
  }
  schot() {
    this.ruisStoot({ duur: 0.35, freq: 4500, freq2: 300, gain: 1.4, echo: 0.9 });
    this.toon({ freq: 120, freq2: 38, duur: 0.3, gain: 0.9 });
    this.ruisStoot({ duur: 1.2, freq: 700, freq2: 120, gain: 0.25, echo: 0.6, start: 0.05 });
  }
  herladen() {
    this.ruisStoot({ duur: 0.05, filter: "bandpass", freq: 2500, q: 4, gain: 0.6, start: 0.35 });
    this.ruisStoot({ duur: 0.06, filter: "bandpass", freq: 1800, q: 4, gain: 0.6, start: 0.6 });
    this.toon({ freq: 900, duur: 0.04, type: "square", gain: 0.05, start: 0.62 });
  }
  /** v = afstandsfactor 0..1 */
  klap(v = 1) {
    this.ruisStoot({ duur: 0.12, filter: "highpass", freq: 900, gain: 1.1 * v, start: 0.12 });
    this.ruisStoot({ duur: 0.5, freq: 1500, freq2: 200, gain: 0.4 * v, start: 0.13 });
  }
  boem(v = 1) {
    this.ruisStoot({ duur: 2.2, freq: 900, freq2: 60, gain: 1.6 * v, echo: 0.8, start: 0.12 });
    this.toon({ freq: 70, freq2: 25, duur: 1.2, gain: 1 * v, start: 0.12 });
  }
  tik(v = 1) { this.ruisStoot({ duur: 0.06, filter: "bandpass", freq: 3000, q: 2, gain: 0.5 * v, start: 0.12 }); }
  alarm(v = 0.5) {
    for (let i = 0; i < 14; i++) this.toon({ freq: i % 2 ? 1250 : 850, duur: 0.22, type: "square", gain: 0.06 * v, start: 0.15 + i * 0.25 });
  }
  bel(v = 0.4) { this.toon({ freq: 2300, duur: 0.6, gain: 0.12 * v }); this.toon({ freq: 3480, duur: 0.4, gain: 0.06 * v, start: 0.12 }); }
  stappen() { for (let i = 0; i < 6; i++) this.ruisStoot({ duur: 0.07, filter: "bandpass", freq: 500 + Math.random() * 200, q: 1.5, gain: 0.35, start: i * 0.22 }); }
  /** Een voetstap; harder en doffer naarmate je sneller gaat. */
  stap(v = 1.5) { this.ruisStoot({ duur: 0.055, filter: "bandpass", freq: 320 + Math.random() * 160, q: 1.2, gain: Math.min(0.5, 0.12 + v * 0.06) }); }
  /** Een doorlopend geluid (motor, banden, zoemen): wordt één keer gemaakt en daarna alleen bijgestuurd. */
  lus(naam, maak) { if (!this.ctx) return null; return ((this.lussen ??= {})[naam] ??= maak(this.ctx)); }
  /** Motorgeluid van de auto waarin je rijdt: toeren lopen op per versnelling en vallen terug bij het schakelen. */
  motor(aan, v = 0, gas = 0) {
    const m = this.lus("motor", (ctx) => {
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), o3 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = "sawtooth"; o2.type = "square"; o3.type = "sawtooth"; f.type = "lowpass"; f.Q.value = 1.2; g.gain.value = 0;
      o.connect(f); o2.connect(f); o3.connect(f); f.connect(g); g.connect(this.uit); o.start(); o2.start(); o3.start();
      return { o, o2, o3, f, g };
    });
    if (!m) return;
    const s = Math.abs(v), G = [0, 4.2, 8, 11.5, 16];
    let i = 0; while (i < 3 && s > G[i + 1]) i++;
    const toeren = v < 0 ? 0.2 + s / 6 : (i ? 0.38 : 0.12) + (i ? 0.62 : 0.88) * ((s - G[i]) / (G[i + 1] - G[i]));
    const t = this.t, toon = 34 + toeren * 64;
    m.o.frequency.setTargetAtTime(toon, t, 0.07); m.o2.frequency.setTargetAtTime(toon * 0.5, t, 0.07); m.o3.frequency.setTargetAtTime(toon * 1.506, t, 0.07);
    m.f.frequency.setTargetAtTime(230 + toeren * 420 + gas * 520, t, 0.1);
    m.g.gain.setTargetAtTime(aan ? 0.035 + gas * 0.035 + toeren * 0.02 : 0, t, 0.1);
  }
  /** Piepende banden; sterkte 0..1 (0 = stil). */
  banden(sterkte = 0) {
    if (!sterkte && !this.lussen?.banden) return;
    const b = this.lus("banden", (ctx) => {
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = this.ruis; s.loop = true; f.type = "bandpass"; f.frequency.value = 1450; f.Q.value = 9; f2.type = "bandpass"; f2.frequency.value = 2150; f2.Q.value = 12; g.gain.value = 0;
      s.connect(f); s.connect(f2); f.connect(g); f2.connect(g); g.connect(this.uit); s.start();
      return { g, f };
    });
    if (!b) return;
    b.f.frequency.setTargetAtTime(1300 + sterkte * 350, this.t, 0.1);
    b.g.gain.setTargetAtTime(Math.min(1, sterkte) * 0.5, this.t, sterkte ? 0.05 : 0.12);
  }
  /** Het zoemen van een fatbike vlakbij: zo hoor je ze aankomen. sterkte 0..1 naar de afstand. */
  zoem(sterkte = 0, v = 3) {
    if (!sterkte && !this.lussen?.zoem) return;
    const z = this.lus("zoem", (ctx) => {
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), band = ctx.createBufferSource(), bf = ctx.createBiquadFilter(), bg = ctx.createGain();
      o.type = "sawtooth"; o2.type = "triangle"; f.type = "lowpass"; f.frequency.value = 900; g.gain.value = 0;
      o.connect(f); o2.connect(f); f.connect(g); g.connect(this.uit); o.start(); o2.start();
      // brede banden op de straat: een zacht geruis erbij
      band.buffer = this.ruis; band.loop = true; bf.type = "bandpass"; bf.frequency.value = 520; bf.Q.value = 0.8; bg.gain.value = 0.5;
      band.connect(bf); bf.connect(bg); bg.connect(g); band.start();
      return { o, o2, g };
    });
    if (!z) return;
    z.o.frequency.setTargetAtTime(90 + v * 34, this.t, 0.15); z.o2.frequency.setTargetAtTime(360 + v * 120, this.t, 0.15);
    z.g.gain.setTargetAtTime(sterkte * 0.09, this.t, 0.15);
  }
  /** Vogels, of kraaien in de winter: af en toe, op wisselende afstand. */
  sfeerStap(dt, winter = false) {
    if (!this.ctx) return;
    this.vogelT = (this.vogelT ?? 3) - dt;
    if (this.vogelT > 0) return;
    this.vogelT = winter ? 6 + Math.random() * 14 : 2.5 + Math.random() * 7;
    const ver = 0.35 + Math.random() * 0.65;
    if (winter) {
      // kraai: twee of drie keer een schor "kra"
      const n = 2 + ((Math.random() * 2) | 0), hoog = 520 + Math.random() * 90;
      for (let i = 0; i < n; i++) { this.toon({ freq: hoog, freq2: hoog * 0.72, duur: 0.22, type: "sawtooth", gain: 0.035 * ver, start: i * 0.34 }); this.ruisStoot({ duur: 0.2, filter: "bandpass", freq: 1500, q: 2, gain: 0.07 * ver, start: i * 0.34 }); }
    } else if (Math.random() < 0.6) {
      // merel of mees: een riedeltje van korte fluittonen
      const n = 3 + ((Math.random() * 5) | 0), basis = 2400 + Math.random() * 1500;
      for (let i = 0; i < n; i++) { const f = basis * (0.8 + Math.random() * 0.5); this.toon({ freq: f, freq2: f * (Math.random() < 0.5 ? 1.25 : 0.8), duur: 0.07 + Math.random() * 0.07, gain: 0.03 * ver, start: i * (0.09 + Math.random() * 0.05) }); }
    } else {
      // duif: laag koeren
      for (let i = 0; i < 3; i++) this.toon({ freq: 470, freq2: 400, duur: i === 1 ? 0.42 : 0.2, gain: 0.03 * ver, start: i * 0.3 });
    }
  }
  /** De lucht die je vuist of het mes verplaatst. */
  zwiep(v = 1) { this.ruisStoot({ duur: 0.14, filter: "bandpass", freq: 450, freq2: 2600, q: 1.4, gain: 0.3 * v }); }
  /** Een vuist die aankomt: dof en kort. */
  stomp(v = 1) {
    this.ruisStoot({ duur: 0.1, freq: 1100, freq2: 140, gain: 1.3 * v });
    this.toon({ freq: 150, freq2: 52, duur: 0.16, gain: 0.8 * v });
    this.ruisStoot({ duur: 0.03, filter: "highpass", freq: 2500, gain: 0.35 * v });
  }
  /** "Oef": de lucht die uit iemand geslagen wordt. */
  oef(v = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = this.t + 0.03, laag = 105 + Math.random() * 45;
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = "sawtooth"; o.frequency.setValueAtTime(laag * 1.25, t); o.frequency.exponentialRampToValueAtTime(laag * 0.8, t + 0.2);
    f.type = "bandpass"; f.Q.value = 3; f.frequency.setValueAtTime(760, t); f.frequency.exponentialRampToValueAtTime(420, t + 0.2);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5 * v, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(f); f.connect(g); g.connect(this.uit); o.start(t); o.stop(t + 0.3);
    this.ruisStoot({ duur: 0.16, filter: "bandpass", freq: 900, q: 1, gain: 0.12 * v, start: 0.03 });
  }
  /** Kiai: de korte kreet bij een zware techniek. */
  kiai() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = this.t, laag = 190 + Math.random() * 40;
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = "sawtooth"; o.frequency.setValueAtTime(laag, t); o.frequency.exponentialRampToValueAtTime(laag * 1.5, t + 0.07); o.frequency.exponentialRampToValueAtTime(laag * 1.1, t + 0.24);
    f.type = "bandpass"; f.Q.value = 2.5; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(1400, t + 0.2);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    o.connect(f); f.connect(g); g.connect(this.uit); o.start(t); o.stop(t + 0.3);
  }
  /** Met je vuist op het plaatwerk van een auto. */
  bonk() { this.ruisStoot({ duur: 0.12, freq: 700, freq2: 160, gain: 1.1 }); this.toon({ freq: 190, freq2: 120, duur: 0.22, type: "triangle", gain: 0.5 }); }
  /** Een aanrijding: blik, plastic en bij een harde klap glas. v = 0..1 naar de snelheid. */
  botsing(v = 1) {
    this.ruisStoot({ duur: 0.45, freq: 3000, freq2: 160, gain: 1.7 * v, echo: 0.35 });
    this.toon({ freq: 100, freq2: 38, duur: 0.32, gain: 1 * v });
    for (const f of [310, 470, 730]) this.toon({ freq: f * (0.9 + Math.random() * 0.2), duur: 0.18, type: "square", gain: 0.05 * v });
    this.ruisStoot({ duur: 0.2, filter: "bandpass", freq: 1300, q: 3, gain: 0.8 * v, start: 0.04 });
    if (v > 0.65) for (let i = 0; i < 6; i++) this.toon({ freq: 2400 + Math.random() * 3000, duur: 0.1, gain: 0.05, start: 0.08 + i * 0.05 });
  }
  /** Langs iets schuren met de flank van de auto. */
  schuur(v = 1) { this.ruisStoot({ duur: 0.32, filter: "bandpass", freq: 2100, freq2: 900, q: 3, gain: 0.6 * v }); this.ruisStoot({ duur: 0.3, freq: 400, gain: 0.3 * v }); }
  /** Pistoolschot op straat: korter en scherper dan het geweer. */
  pistool() {
    this.ruisStoot({ duur: 0.16, freq: 6000, freq2: 700, gain: 1.3, echo: 0.6 });
    this.toon({ freq: 240, freq2: 70, duur: 0.12, gain: 0.7 });
    this.ruisStoot({ duur: 0.6, freq: 900, freq2: 200, gain: 0.16, echo: 0.5, start: 0.04 });
    this.ruisStoot({ duur: 0.03, filter: "bandpass", freq: 3200, q: 5, gain: 0.3, start: 0.11 }); // de slede
  }
  /** Een portier dat dichtvalt. */
  deur() { this.ruisStoot({ duur: 0.08, freq: 600, freq2: 110, gain: 1 }); this.toon({ freq: 95, freq2: 58, duur: 0.13, gain: 0.5 }); this.ruisStoot({ duur: 0.03, filter: "bandpass", freq: 2400, q: 4, gain: 0.25, start: 0.02 }); }
  /** Een ruit die sneuvelt. */
  glas() { this.ruisStoot({ duur: 0.25, filter: "highpass", freq: 3200, gain: 0.9 }); for (let i = 0; i < 5; i++) this.toon({ freq: 2200 + Math.random() * 2600, duur: 0.12, gain: 0.07, start: 0.03 + i * 0.035 }); }
  /** Je eigen auto gaat van het slot. */
  slot() { this.toon({ freq: 1500, duur: 0.07, type: "square", gain: 0.06 }); this.toon({ freq: 1500, duur: 0.07, type: "square", gain: 0.06, start: 0.14 }); }
  /** Tweetonige sirene, in de verte. */
  sirene(v = 1) { for (let i = 0; i < 4; i++) this.toon({ freq: i % 2 ? 620 : 470, duur: 0.5, type: "sawtooth", gain: 0.05 * v, start: i * 0.5 }); }
  /** Claxon: twee tonen tegelijk, een beetje scherp, zoals een echte auto. */
  toeter(v = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = this.t, duur = 0.42 + Math.random() * 0.25;
    const f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = "bandpass"; f.frequency.value = 1500; f.Q.value = 0.6;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16 * v, t + 0.015); g.gain.setValueAtTime(0.16 * v, t + duur - 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + duur);
    for (const hz of [415, 523]) { const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = hz * (0.995 + Math.random() * 0.01); o.connect(f); o.start(t); o.stop(t + duur + 0.05); }
    f.connect(g); g.connect(this.uit);
    const e = ctx.createGain(); e.gain.value = 0.3; g.connect(e); e.connect(this.echo);
  }
  hart() { this.toon({ freq: 55, freq2: 40, duur: 0.18, gain: 0.5 }); this.toon({ freq: 50, freq2: 38, duur: 0.16, gain: 0.35, start: 0.22 }); }
  goed() { this.toon({ freq: 880, duur: 0.12, gain: 0.15 }); this.toon({ freq: 1320, duur: 0.2, gain: 0.15, start: 0.09 }); }
  fout() { this.toon({ freq: 220, duur: 0.35, type: "sawtooth", gain: 0.12 }); this.toon({ freq: 160, duur: 0.45, type: "sawtooth", gain: 0.12, start: 0.15 }); }
}
