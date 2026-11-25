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
    this.laadOpnames();
  }
  /** Echte opnames voor de achtergrond (Wikimedia Commons, publiek domein en CC0; zie tools/geluid). Geen ruis meer. */
  async laadOpnames() {
    const ctx = this.ctx, v = window.VERSIE ?? "";
    this.opname = {};
    this.sfeer = ctx.createGain(); this.sfeer.gain.value = this.sfeerVolume ?? 1; this.sfeer.connect(this.uit);
    await Promise.all(["straat", "mensen", "auto1", "auto2", "meeuw"].map(async (n) => {
      try {
        const data = await (await fetch(`assets/geluid/${n}.mp3?v=${v}`)).arrayBuffer();
        this.opname[n] = await new Promise((ok, mis) => ctx.decodeAudioData(data, ok, mis));
      } catch { /* zonder deze opname is het hier gewoon stil */ }
    }));
    // twee doorlopende lagen: de straat (vogels, verkeer in de verte) en pratende mensen (harder waar het druk is)
    const laag = (n, sterkte) => {
      if (!this.opname[n]) return null;
      const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = this.opname[n]; s.loop = true; g.gain.value = sterkte;
      s.connect(g); g.connect(this.sfeer); s.start(0, Math.random() * s.buffer.duration);
      return g;
    };
    this.straatLaag = this.binnen ? null : laag("straat", 0.55); this.mensenLaag = laag("mensen", 0); // binnen (de kooi) geen vogels en verkeer
  }
  /** Hoe hard de achtergrond klinkt (vogels, verkeer, geroezemoes): 0 = uit, 1 = gewoon. */
  zetSfeer(v) { this.sfeerVolume = v; this.sfeer?.gain.setTargetAtTime(v, this.t, 0.2); }
  /** Speel een opname één keer af. */
  speel(n, sterkte = 1, tempo = 1) {
    if (!this.ctx || !this.opname?.[n]) return;
    const s = this.ctx.createBufferSource(), g = this.ctx.createGain(); s.buffer = this.opname[n]; s.playbackRate.value = tempo; g.gain.value = sterkte;
    s.connect(g); g.connect(this.sfeer); s.start();
  }
  /** Hoe druk het om je heen is (0..1): zo hard klinkt het geroezemoes. */
  drukte(d) { if (this.mensenLaag) this.mensenLaag.gain.setTargetAtTime(Math.min(1, d) * 0.6, this.t, 0.8); }
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
  /** Geweer met demper: een droge, doffe plof en het mechaniek. Geen knal en geen galm. */
  schot() {
    this.ruisStoot({ duur: 0.07, freq: 1500, freq2: 260, gain: 1.2 });
    this.ruisStoot({ duur: 0.16, filter: "bandpass", freq: 520, q: 0.8, gain: 0.5, start: 0.01 });
    this.toon({ freq: 150, freq2: 70, duur: 0.07, gain: 0.45 });
    this.ruisStoot({ duur: 0.02, filter: "bandpass", freq: 3400, q: 5, gain: 0.3, start: 0.05 }); // het sluitstuk
  }
  herladen() {
    this.ruisStoot({ duur: 0.05, filter: "bandpass", freq: 2500, q: 4, gain: 0.45, start: 0.35 });
    this.ruisStoot({ duur: 0.06, filter: "bandpass", freq: 1800, q: 4, gain: 0.45, start: 0.6 });
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
  /** Af en toe een auto die langskomt en optrekt, en een meeuw: echte opnames, op wisselende afstand. */
  sfeerStap(dt) {
    if (!this.ctx || !this.opname) return;
    this.autoT = (this.autoT ?? 6) - dt; this.meeuwT = (this.meeuwT ?? 14) - dt;
    if (this.autoT <= 0) { this.autoT = 9 + Math.random() * 16; this.speel(Math.random() < 0.5 ? "auto1" : "auto2", 0.25 + Math.random() * 0.4, 0.9 + Math.random() * 0.25); }
    if (this.meeuwT <= 0) { this.meeuwT = 18 + Math.random() * 40; this.speel("meeuw", 0.2 + Math.random() * 0.5, 0.92 + Math.random() * 0.16); }
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
  /** Eén knalletje van klein vuurwerk (knalerwt, rotje uit een grondbloem): droog en kort. */
  knal(v = 1) {
    this.ruisStoot({ duur: 0.05, filter: "highpass", freq: 1800, gain: 1.1 * v, echo: 0.35 });
    this.ruisStoot({ duur: 0.09, freq: 2600, freq2: 500, gain: 0.6 * v });
  }
  /** Het sissen van een lontje. */
  sis() { this.ruisStoot({ duur: 0.55, filter: "bandpass", freq: 5200, q: 1.5, gain: 0.18 }); }
  /** Handboeien die dichtklikken: twee keer een ratel en een klik. */
  boeien() {
    for (const start of [0.35, 1.0]) {
      for (let i = 0; i < 6; i++) this.ruisStoot({ duur: 0.018, filter: "bandpass", freq: 4200, q: 6, gain: 0.5, start: start + i * 0.035 });
      this.toon({ freq: 2100, duur: 0.05, type: "square", gain: 0.08, start: start + 0.23 });
    }
  }
  /** Een schreeuw van een afstand ("hé!", "wat moet je!"): een of twee korte, rauwe uithalen. */
  schreeuw(v = 1) {
    if (!this.ctx || v < 0.03) return;
    const ctx = this.ctx, n = 1 + ((Math.random() * 2) | 0), laag = 130 + Math.random() * 90;
    for (let i = 0; i < n; i++) {
      const t = this.t + i * (0.2 + Math.random() * 0.1), duur = 0.16 + Math.random() * 0.2;
      const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = "sawtooth"; o.frequency.setValueAtTime(laag * (1.1 + Math.random() * 0.3), t); o.frequency.exponentialRampToValueAtTime(laag * 0.85, t + duur);
      f.type = "bandpass"; f.Q.value = 2; f.frequency.setValueAtTime(700 + Math.random() * 500, t); f.frequency.exponentialRampToValueAtTime(1100 + Math.random() * 400, t + duur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.min(0.3, 0.22 * v), t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + duur);
      o.connect(f); f.connect(g); g.connect(this.uit); o.start(t); o.stop(t + duur + 0.05);
      const e = ctx.createGain(); e.gain.value = 0.25; g.connect(e); e.connect(this.echo);
    }
  }
  /** Het publiek joelt: een golf van geroep die aanzwelt en wegzakt, met losse kreten erdoorheen. v = 0..1. */
  juich(v = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = this.t, duur = 1 + v * 1.6;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = this.ruis; s.loop = true;
    f.type = "bandpass"; f.Q.value = 0.7; f.frequency.setValueAtTime(700, t); f.frequency.linearRampToValueAtTime(1300, t + duur * 0.4); f.frequency.linearRampToValueAtTime(800, t + duur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22 * v, t + duur * 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + duur);
    s.connect(f); f.connect(g); g.connect(this.uit); s.start(t); s.stop(t + duur + 0.05);
    for (let i = 0; i < 3 + v * 6; i++) setTimeout(() => this.schreeuw(0.5 + Math.random() * 0.6), Math.random() * duur * 600);
  }
  /** Eén schot van het machinegeweer: kort, droog en hard. */
  mg() { this.ruisStoot({ duur: 0.06, freq: 3200, freq2: 500, gain: 1.1 }); this.toon({ freq: 170, freq2: 80, duur: 0.05, gain: 0.5 }); }
  /** Een raket die vertrekt: een plof en het sissen van de motor. */
  raket() { this.ruisStoot({ duur: 0.12, freq: 900, freq2: 200, gain: 1.2 }); this.ruisStoot({ duur: 1.1, filter: "bandpass", freq: 2600, freq2: 700, q: 1, gain: 0.5, start: 0.05 }); }
  /** De vlammenwerper: een brullende ruis zolang hij aan staat. */
  vlam(aan) {
    if (!aan && !this.lussen?.vlam) return;
    const v = this.lus("vlam", (ctx) => {
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = this.ruis; s.loop = true;
      f.type = "bandpass"; f.frequency.value = 520; f.Q.value = 0.5; g.gain.value = 0; s.connect(f); f.connect(g); g.connect(this.uit); s.start();
      return { g, f };
    });
    if (!v) return;
    v.g.gain.setTargetAtTime(aan ? 0.55 : 0, this.t, aan ? 0.04 : 0.1);
    if (aan) v.f.frequency.setTargetAtTime(420 + Math.random() * 260, this.t, 0.05);
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
  /** Pistool met demper: korter en lichter dan het geweer, met de klik van de slede. Geen galm. */
  pistool() {
    this.ruisStoot({ duur: 0.05, freq: 2200, freq2: 380, gain: 1 });
    this.ruisStoot({ duur: 0.1, filter: "bandpass", freq: 800, q: 0.9, gain: 0.35, start: 0.008 });
    this.ruisStoot({ duur: 0.018, filter: "bandpass", freq: 3800, q: 5, gain: 0.35, start: 0.045 });
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
  goed() {} // geen piepjes meer bij een treffer of een fout (op verzoek)
  fout() {}
}
