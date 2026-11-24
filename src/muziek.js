// Spannende muziek in de stijl van een 16-bit vechtspel, helemaal gemaakt met de Web Audio API:
// een stuwende bas, een arpeggio met blokgolven en drums van ruis. Vier maten die blijven doorlopen.
const NOOT = (n) => 440 * 2 ** ((n - 69) / 12); // midi -> Hz
// A-mineur: Am, F, G, Em (elk een maat van 16 stappen)
const AKKOORD = [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]];
const BAS = [45, 41, 43, 40];
const MELODIE = [76, 0, 72, 0, 69, 72, 76, 0, 77, 0, 72, 0, 69, 0, 72, 77, 79, 0, 74, 0, 71, 74, 79, 0, 76, 0, 71, 0, 67, 71, 76, 0,
  76, 0, 72, 0, 69, 72, 81, 0, 77, 0, 81, 0, 77, 0, 72, 0, 79, 0, 83, 0, 79, 74, 71, 0, 76, 79, 76, 71, 67, 0, 64, 0];
export class Muziek {
  /** @param {AudioContext} ctx @param {AudioNode} uit */
  constructor(ctx, uit) {
    this.ctx = ctx; this.gain = ctx.createGain(); this.gain.gain.value = 0; this.gain.connect(uit);
    const n = ctx.sampleRate * 0.5; this.ruis = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = this.ruis.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    this.bpm = 148; this.stap = 0; this.volgende = 0; this.timer = null;
  }
  start(volume = 0.5) {
    if (this.timer) return;
    this.volgende = this.ctx.currentTime + 0.1; this.gain.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.3);
    this.timer = setInterval(() => { while (this.volgende < this.ctx.currentTime + 0.25) { this.speelStap(this.stap, this.volgende); this.volgende += 60 / this.bpm / 4; this.stap = (this.stap + 1) % 64; } }, 60);
  }
  stop() { clearInterval(this.timer); this.timer = null; this.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2); }
  /** Spanning: bij weinig tijd of weinig leven gaat het tempo omhoog. */
  tempo(bpm) { this.bpm = bpm; }
  toon(freq, t, duur, type, sterkte) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(sterkte, t); g.gain.setValueAtTime(sterkte, t + duur * 0.7); g.gain.linearRampToValueAtTime(0.0001, t + duur);
    o.connect(g); g.connect(this.gain); o.start(t); o.stop(t + duur + 0.02);
  }
  tik(t, duur, freq, sterkte, type = "highpass") {
    const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain(); s.buffer = this.ruis; f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(sterkte, t); g.gain.exponentialRampToValueAtTime(0.001, t + duur);
    s.connect(f); f.connect(g); g.connect(this.gain); s.start(t, Math.random() * 0.3); s.stop(t + duur + 0.02);
  }
  speelStap(i, t) {
    const maat = (i >> 4) % 4, s = i % 16, st = 60 / this.bpm / 4;
    // bas: achtsten, met een octaafsprong
    if (s % 2 === 0) this.toon(NOOT(BAS[maat] + (s % 8 === 6 ? 12 : 0)), t, st * 1.7, "triangle", 0.34);
    // arpeggio: zestienden door het akkoord, zacht
    this.toon(NOOT(AKKOORD[maat][s % 3] + (s % 4 === 3 ? 12 : 0)), t, st * 0.8, "square", 0.045);
    // melodie
    const m = MELODIE[i]; if (m) this.toon(NOOT(m), t, st * 1.8, "square", 0.085);
    // drums: kick op 1 en 3 (en een opmaat), snare op 2 en 4, hihat op de achtsten
    if (s === 0 || s === 8 || s === 11) { const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.11); g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15); o.connect(g); g.connect(this.gain); o.start(t); o.stop(t + 0.17); }
    if (s === 4 || s === 12) this.tik(t, 0.13, 1400, 0.3, "bandpass");
    if (s % 2 === 0) this.tik(t, 0.03, 7000, 0.1);
    if (maat === 3 && s >= 12) this.tik(t, 0.07, 900, 0.22, "bandpass"); // roffel naar de volgende ronde van vier maten
  }
}
