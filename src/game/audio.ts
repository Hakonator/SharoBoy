/* Крошечный WebAudio-синтезатор для аркадных блипов. Без внешних файлов. */

export class SFX {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;

  ensure() {
    if (!this.ctx) {
      const AC: typeof AudioContext =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.02);
    }
  }

  private blip(
    freq: number,
    dur = 0.09,
    type: OscillatorType = "square",
    vol = 0.22,
    slideTo?: number,
    delay = 0
  ) {
    if (!this.ctx || !this.master || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private noise(dur = 0.12, vol = 0.16, delay = 0) {
    if (!this.ctx || !this.master || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(g).connect(this.master);
    src.start(t0);
  }

  ui() {
    this.blip(660, 0.06, "square", 0.14);
  }
  paddle() {
    this.blip(240, 0.07, "triangle", 0.26, 330);
  }
  wall() {
    this.blip(180, 0.05, "sine", 0.16, 150);
  }
  blockHit(combo: number) {
    this.blip(360 + Math.min(combo, 14) * 42, 0.07, "square", 0.18, 300);
  }
  blockBreak(combo: number) {
    const f = 420 + Math.min(combo, 14) * 55;
    this.blip(f, 0.1, "square", 0.22, f * 1.6);
    this.noise(0.09, 0.1);
  }
  power() {
    this.blip(520, 0.08, "square", 0.2, 780);
    this.blip(780, 0.1, "square", 0.18, 1040, 0.07);
  }
  powerBad() {
    this.blip(300, 0.12, "square", 0.2, 110);
    this.blip(220, 0.14, "square", 0.16, 80, 0.08);
  }
  laser() {
    this.blip(1350, 0.07, "sawtooth", 0.13, 320);
  }
  rocket() {
    this.blip(160, 0.16, "sawtooth", 0.2, 920);
    this.noise(0.1, 0.08, 0.02);
  }
  explosion() {
    this.noise(0.32, 0.26);
    this.blip(120, 0.28, "square", 0.2, 40);
  }
  shieldHit() {
    this.blip(520, 0.12, "sine", 0.24, 880);
    this.blip(880, 0.1, "sine", 0.16, 440, 0.05);
  }
  launch() {
    this.blip(200, 0.14, "sawtooth", 0.2, 520);
  }
  loseLife() {
    this.blip(300, 0.3, "sawtooth", 0.24, 70);
    this.noise(0.3, 0.14, 0.02);
  }
  levelClear() {
    [523, 659, 784, 1047].forEach((f, i) => this.blip(f, 0.14, "square", 0.2, undefined, i * 0.09));
  }
  gameOver() {
    [392, 311, 262, 196].forEach((f, i) => this.blip(f, 0.22, "sawtooth", 0.18, undefined, i * 0.16));
  }
  win() {
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) =>
      this.blip(f, 0.16, "square", 0.2, undefined, i * 0.1)
    );
  }
  burn() {
    this.blip(980, 0.09, "sawtooth", 0.13, 240);
    this.noise(0.06, 0.06);
  }
  bossDie() {
    [520, 392, 311, 233, 155].forEach((f, i) => this.blip(f, 0.2, "sawtooth", 0.2, undefined, i * 0.09));
    this.noise(0.5, 0.2, 0.1);
  }
}
