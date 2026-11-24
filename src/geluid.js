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
  /** Tweetonige sirene, in de verte. */
  sirene(v = 1) { for (let i = 0; i < 4; i++) this.toon({ freq: i % 2 ? 620 : 470, duur: 0.5, type: "sawtooth", gain: 0.05 * v, start: i * 0.5 }); }
  /** Claxon van een auto die voor je moet stoppen. */
  toeter(v = 1) {
    for (const f of [392, 494]) this.toon({ freq: f, duur: 0.45, type: "square", gain: 0.07 * v });
  }
  hart() { this.toon({ freq: 55, freq2: 40, duur: 0.18, gain: 0.5 }); this.toon({ freq: 50, freq2: 38, duur: 0.16, gain: 0.35, start: 0.22 }); }
  goed() { this.toon({ freq: 880, duur: 0.12, gain: 0.15 }); this.toon({ freq: 1320, duur: 0.2, gain: 0.15, start: 0.09 }); }
  fout() { this.toon({ freq: 220, duur: 0.35, type: "sawtooth", gain: 0.12 }); this.toon({ freq: 160, duur: 0.45, type: "sawtooth", gain: 0.12, start: 0.15 }); }
}
