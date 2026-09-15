/** MP3-дорожки из src/assets/music/*.mp3 — единый набор для всех экранов,
 *  подхватывается автоматически (Vite glob). Пустая папка → встроенный трекер. */
const FILE_TRACKS = import.meta.glob("../assets/music/*.mp3", {
  query: "?url",
  import: "default",
  eager: true,
}) as Record<string, string>

/** Общий список MP3-файлов (стабильный порядок — для выбора «не тот же»). */
const MUSIC_FILES: string[] = Object.values(FILE_TRACKS)

/** Громкость файловой музыки и длительность плавного перехода (мс). */
const MUSIC_VOLUME = 0.4
const MUSIC_FADE_MS = 900

type MusicKind = "menu" | "game"

/** Крошечный WebAudio-синтезатор: короткие блипы на каждое действие +
 *  8-битная фоновая музыка (встроенный трекер, без внешних файлов). */
export class SFX {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noiseBuf: AudioBuffer | null = null
  /** Выключить звуковые эффекты (не влияет на музыку). */
  muted = false
  /** Выключить фоновую музыку (не влияет на эффекты). */
  musicMuted = false
  private musicOn = false
  private musicTimer: number | null = null
  private nextBeat = 0
  private musicStep = 0
  /** Активный трек. */
  private track: MusicKind = "menu"
  /** MP3-режим: играет файл из общего набора (вместо встроенного секвенсора). */
  private fileAudio: HTMLAudioElement | null = null
  private fileMode = MUSIC_FILES.length > 0
  private fileUrl: string | null = null
  /** Активные fade-переходы громкости: элемент → id интервала. */
  private fades = new Map<HTMLAudioElement, number>()

  /** MIDI-нота → частота Гц (С4 = 60). */
  private static midi(m: number): number {
    return 440 * Math.pow(2, (m - 69) / 12)
  }

  /** Размер шага (восьмая нота) для трека. Меню — медленно и «душевно». */
  private static stepFor(track: MusicKind): number {
    return track === "menu" ? 60 / 76 / 2 : 60 / 144 / 2
  }

  /** Вкл/выкл музыку во время игры: файл — пауза/продолжение с места,
   *  секвенсор — продолжение с актуального ритм-курсора. */
  setMusicMuted(v: boolean) {
    this.musicMuted = v
    if (v) {
      this.fileAudio?.pause()
      return
    }
    if (this.fileAudio) {
      this.fileAudio.volume = MUSIC_VOLUME
      void this.fileAudio.play().catch(() => {})
    } else if (this.musicOn && this.musicTimer === null && !this.fileMode) this.scheduleMusic()
  }

  /** Переключение фоновой музыки. Каждый вызов (старт уровня, переход на
   *  следующий уровень, выход в меню) запускает НОВЫЙ случайный MP3-трек из
   *  набора с плавным переходом; без файлов — встроенный трекер по фазе. */
  setTrack(track: MusicKind) {
    this.track = track
    this.musicStep = 0
    this.fileMode = MUSIC_FILES.length > 0
    if (!this.ctx) return // ensure ещё не был — настроится при первом жесте
    this.nextBeat = this.ctx.currentTime + 0.05
    if (!this.musicOn) return
    if (this.fileMode) {
      if (!this.musicMuted) this.playFileMusic()
    } else {
      this.stopFileMusic()
      this.scheduleMusic()
    }
  }

  /** Случайный MP3-трек из общего набора (без повтора предыдущего) с плавным
   *  кроссфейдом: предыдущий трек гаснет, новый нарастает. */
  private playFileMusic() {
    if (!MUSIC_FILES.length) return
    let pick = MUSIC_FILES[Math.floor(Math.random() * MUSIC_FILES.length)]
    if (MUSIC_FILES.length > 1 && pick === this.fileUrl) {
      pick = MUSIC_FILES[(MUSIC_FILES.indexOf(pick) + 1) % MUSIC_FILES.length]
    }
    this.fileUrl = pick
    const a = new Audio(pick)
    a.volume = 0
    a.addEventListener("ended", () => {
      // Трек кончился — следующий случайный из набора
      if (this.musicOn && !this.musicMuted) this.playFileMusic()
    })
    const prev = this.fileAudio
    if (prev && prev !== a) this.fadeAudio(prev, 0, () => prev.pause())
    this.fileAudio = a
    void a.play().catch(() => {})
    this.fadeAudio(a, MUSIC_VOLUME)
  }

  /** Плавно меняет громкость элемента за MUSIC_FADE_MS. */
  private fadeAudio(a: HTMLAudioElement, target: number, done?: () => void) {
    const runningId = this.fades.get(a)
    if (runningId !== undefined) window.clearInterval(runningId)
    const from = a.volume
    const steps = 14
    let i = 0
    const id = window.setInterval(() => {
      i++
      a.volume = Math.max(0, Math.min(1, from + (target - from) * (i / steps)))
      if (i >= steps) {
        this.fades.delete(a)
        window.clearInterval(id)
        done?.()
      }
    }, MUSIC_FADE_MS / steps)
    this.fades.set(a, id)
  }

  private stopFileMusic() {
    for (const [el, id] of this.fades) {
      window.clearInterval(id)
      el.pause()
    }
    this.fades.clear()
    if (this.fileAudio) {
      this.fileAudio.pause()
      this.fileAudio = null
    }
    this.fileUrl = null
  }

  /** Медленный душевный трек меню: квадрат-мелодия + тихий треугольник-бас.
   *  Ля минор, 64 восьмых (~25 c при 76 BPM). Задумчивое арпеджио. */
  private static MENU_LEAD = [
    57,
    60,
    64,
    60,
    57,
    60,
    64,
    60,
    55,
    59,
    62,
    59,
    55,
    59,
    62,
    59, //
    57,
    60,
    64,
    60,
    57,
    60,
    64,
    60,
    53,
    57,
    60,
    57,
    53,
    57,
    60,
    57, //
    55,
    59,
    62,
    59,
    55,
    59,
    62,
    59,
    52,
    55,
    59,
    55,
    52,
    55,
    59,
    55, //
    57,
    60,
    64,
    60,
    57,
    60,
    64,
    60,
    55,
    59,
    62,
    64,
    62,
    59,
    55,
    52, //
  ]
  private static MENU_BASS = [
    45,
    0,
    45,
    0,
    45,
    0,
    45,
    0,
    43,
    0,
    43,
    0,
    43,
    0,
    43,
    0, //
    45,
    0,
    45,
    0,
    45,
    0,
    45,
    0,
    41,
    0,
    41,
    0,
    41,
    0,
    41,
    0, //
    43,
    0,
    43,
    0,
    43,
    0,
    43,
    0,
    40,
    0,
    40,
    0,
    40,
    0,
    40,
    0, //
    45,
    0,
    45,
    0,
    45,
    0,
    45,
    0,
    43,
    0,
    43,
    0,
    43,
    0,
    43,
    0, //
  ]

  /** Игровой трек: 3 голоса, длинный цикл (96 восьмых × 4 = 384 → 3 раза по
   *  32... вариант с развитием). Мелодия-квадрат с арпеджио и басом. */
  private static GAME_LEAD = [
    57,
    60,
    64,
    60,
    57,
    60,
    64,
    60,
    57,
    60,
    64,
    60,
    57,
    60,
    64,
    60, //
    55,
    59,
    62,
    59,
    55,
    59,
    62,
    59,
    55,
    59,
    62,
    59,
    55,
    59,
    62,
    59, //
    57,
    60,
    64,
    60,
    57,
    60,
    64,
    60,
    57,
    60,
    64,
    60,
    57,
    60,
    64,
    60, //
    53,
    57,
    60,
    57,
    53,
    57,
    60,
    57,
    53,
    57,
    60,
    57,
    53,
    57,
    60,
    57, //
    55,
    59,
    62,
    59,
    55,
    59,
    62,
    59,
    55,
    59,
    62,
    59,
    55,
    59,
    62,
    59, //
    57,
    60,
    64,
    60,
    57,
    60,
    64,
    60,
    57,
    60,
    64,
    60,
    57,
    60,
    64,
    60, //
    55,
    59,
    62,
    66,
    64,
    62,
    59,
    55,
    57,
    60,
    64,
    60,
    57,
    60,
    64,
    67, //
    72,
    76,
    81,
    76,
    72,
    76,
    81,
    76,
    76,
    81,
    84,
    88,
    84,
    81,
    76,
    72, //
  ]
  private static GAME_BASS = [
    45,
    0,
    0,
    0,
    45,
    0,
    0,
    0,
    45,
    0,
    0,
    0,
    45,
    0,
    0,
    0, //
    43,
    0,
    0,
    0,
    43,
    0,
    0,
    0,
    43,
    0,
    0,
    0,
    43,
    0,
    0,
    0, //
    45,
    0,
    0,
    0,
    45,
    0,
    0,
    0,
    45,
    0,
    0,
    0,
    45,
    0,
    0,
    0, //
    41,
    0,
    0,
    0,
    41,
    0,
    0,
    0,
    41,
    0,
    0,
    0,
    41,
    0,
    0,
    0, //
    43,
    0,
    0,
    0,
    43,
    0,
    0,
    0,
    43,
    0,
    0,
    0,
    43,
    0,
    0,
    0, //
    45,
    0,
    0,
    0,
    45,
    0,
    0,
    0,
    45,
    0,
    0,
    0,
    45,
    0,
    0,
    0, //
    43,
    0,
    0,
    0,
    43,
    0,
    0,
    0,
    40,
    0,
    0,
    0,
    40,
    0,
    0,
    0, //
    45,
    0,
    0,
    0,
    45,
    0,
    0,
    0,
    52,
    0,
    0,
    0,
    52,
    0,
    52,
    0, //
  ]
  /** Арпеджио-«главная тема»: третий голос, съёминает на октаву выше баса. */
  private static GAME_THEME = [
    72,
    0,
    76,
    0,
    72,
    0,
    76,
    0,
    72,
    0,
    76,
    0,
    72,
    0,
    76,
    0, //
    71,
    0,
    74,
    0,
    71,
    0,
    74,
    0,
    71,
    0,
    74,
    0,
    71,
    0,
    74,
    0, //
    72,
    0,
    76,
    0,
    72,
    0,
    76,
    0,
    72,
    0,
    76,
    0,
    72,
    0,
    76,
    0, //
    68,
    0,
    72,
    0,
    68,
    0,
    72,
    0,
    68,
    0,
    72,
    0,
    68,
    0,
    72,
    0, //
    71,
    0,
    74,
    0,
    71,
    0,
    74,
    0,
    71,
    0,
    74,
    0,
    71,
    0,
    74,
    0, //
    72,
    0,
    76,
    0,
    72,
    0,
    76,
    0,
    72,
    0,
    76,
    0,
    72,
    0,
    76,
    0, //
    71,
    0,
    74,
    0,
    79,
    0,
    83,
    0,
    69,
    0,
    72,
    0,
    76,
    0,
    72,
    0, //
    88,
    0,
    84,
    0,
    81,
    0,
    76,
    0,
    84,
    0,
    88,
    0,
    91,
    0,
    91,
    0, //
  ]

  /** Запускает зацикленную 8-битную тему (idempotent). */
  startMusic() {
    if (this.musicOn) {
      // Страховка: если что-то остановилось — возобновляем (файл — с места,
      // секвенсор — перезапуском), иначе музыка «умирает» до перезагрузки.
      if (!this.musicMuted) {
        if (this.fileAudio && this.fileAudio.paused) void this.fileAudio.play().catch(() => {})
        if (this.musicTimer === null && !this.fileAudio) this.scheduleMusic()
      }
      return
    }
    if (!this.ctx || !this.master) return
    this.musicOn = true
    this.nextBeat = this.ctx.currentTime + 0.06
    this.musicStep = 0
    if (this.fileMode && !this.musicMuted) this.playFileMusic()
    else if (!this.musicMuted) this.scheduleMusic()
  }

  stopMusic() {
    this.musicOn = false
    this.stopFileMusic()
    if (this.musicTimer !== null) {
      clearTimeout(this.musicTimer)
      this.musicTimer = null
    }
  }

  /** Lookahead-секвенсор: планирует ноты заранее, чтобы луп не «спотыкался». */
  private scheduleMusic = () => {
    if (!this.musicOn || !this.ctx || this.fileMode) return // mp3 управляет собой
    if (this.musicMuted) {
      // Музыка выключена: держим ритм-курсор актуальным и продолжаем тикать,
      // чтобы при включении трек продолжился с текущего места без скачка.
      this.nextBeat = this.ctx.currentTime + 0.06
      this.musicStep = Math.floor(this.nextBeat / SFX.stepFor(this.track))
      this.musicTimer = window.setTimeout(this.scheduleMusic, 100)
      return
    }
    const step = SFX.stepFor(this.track)
    const lead = this.track === "menu" ? SFX.MENU_LEAD : SFX.GAME_LEAD
    const bass = this.track === "menu" ? SFX.MENU_BASS : SFX.GAME_BASS
    const theme = this.track === "menu" ? null : SFX.GAME_THEME
    const L = lead.length
    while (this.nextBeat < this.ctx.currentTime + 0.5) {
      const i = this.musicStep % L
      const t0 = this.ctx.currentTime
      const delay = this.nextBeat - t0
      const m = lead[i]
      const b = bass[i]
      const th = theme?.[i]
      const isMenu = this.track === "menu"
      if (m > 0)
        this.tone(
          SFX.midi(m),
          step * 0.8,
          isMenu ? "triangle" : "square",
          isMenu ? 0.05 : 0.06,
          undefined,
          delay
        )
      if (b > 0) this.tone(SFX.midi(b), step, "triangle", 0.07, undefined, delay)
      if (th !== undefined && th > 0)
        this.tone(SFX.midi(th), step * 0.7, "triangle", 0.045, undefined, delay)
      this.musicStep++
      this.nextBeat += step
    }
    this.musicTimer = window.setTimeout(this.scheduleMusic, 50)
  }

  ensure() {
    try {
      if (!this.ctx) {
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!AC) return
        this.ctx = new AC()
        this.master = this.ctx.createGain()
        this.master.gain.value = 0.42
        this.master.connect(this.ctx.destination)
        const len = Math.floor(this.ctx.sampleRate * 0.4)
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
        const data = this.noiseBuf.getChannelData(0)
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
      }
      if (this.ctx.state === "suspended") void this.ctx.resume()
      this.startMusic()
    } catch {
      /* нет доступа к WebAudio — игра работает без звука */
      this.ctx = null
      this.master = null
    }
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    slideTo?: number,
    delay = 0
  ) {
    if (!this.ctx || !this.master) return
    const t = this.ctx.currentTime + delay
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(Math.max(1, freq), t)
    if (slideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur)
    }
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(g)
    g.connect(this.master)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  private blip(
    freq: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    slideTo?: number,
    delay = 0
  ) {
    if (this.muted) return
    this.tone(freq, dur, type, vol, slideTo, delay)
  }

  private noise(dur: number, vol: number, delay = 0) {
    if (!this.ctx || !this.master || this.muted || !this.noiseBuf) return
    const t = this.ctx.currentTime + delay
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuf
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(g)
    g.connect(this.master)
    src.start(t)
    src.stop(t + dur + 0.02)
  }

  paddle(intensity: number) {
    this.blip(240 + intensity * 140, 0.06, "square", 0.22, 340)
  }
  wall() {
    this.blip(190, 0.04, "triangle", 0.14, 150)
  }
  brick(hp: number) {
    this.blip(420 + hp * 90, 0.07, "square", 0.2, 300 + hp * 60)
    this.noise(0.05, 0.1)
  }
  destroy(tier: number) {
    this.blip(660 + tier * 120, 0.09, "square", 0.22, 990 + tier * 140)
    this.blip(330, 0.12, "triangle", 0.14, 220, 0.02)
    this.noise(0.09, 0.14)
  }
  launch() {
    this.blip(300, 0.12, "sawtooth", 0.16, 640)
  }
  loseLife() {
    this.blip(320, 0.14, "sawtooth", 0.22, 180)
    this.blip(220, 0.18, "sawtooth", 0.2, 90, 0.1)
    this.noise(0.2, 0.16, 0.05)
  }
  power() {
    this.blip(520, 0.08, "square", 0.2, 780)
    this.blip(780, 0.1, "square", 0.18, 1040, 0.07)
  }
  powerBad() {
    this.blip(300, 0.12, "square", 0.2, 110)
    this.blip(220, 0.14, "square", 0.16, 80, 0.08)
  }
  laser() {
    this.blip(1350, 0.07, "sawtooth", 0.13, 320)
  }
  rocket() {
    this.blip(160, 0.16, "sawtooth", 0.2, 920)
    this.noise(0.1, 0.08, 0.02)
  }
  explosion() {
    this.noise(0.32, 0.26)
    this.blip(120, 0.28, "square", 0.2, 40)
  }
  shieldHit() {
    this.blip(520, 0.12, "sine", 0.24, 880)
    this.blip(880, 0.1, "sine", 0.16, 440, 0.05)
  }
  burn() {
    this.blip(980, 0.09, "sawtooth", 0.13, 240)
    this.noise(0.06, 0.06)
  }
  bossDie() {
    ;[520, 392, 311, 233, 155].forEach((f, i) =>
      this.blip(f, 0.2, "sawtooth", 0.2, undefined, i * 0.09)
    )
    this.noise(0.5, 0.2, 0.1)
  }
  coin() {
    this.blip(1320, 0.07, "triangle", 0.2, 1980)
    this.blip(1980, 0.09, "triangle", 0.16, 2640, 0.05)
  }
  achievement() {
    ;[523, 784, 1047, 1568].forEach((f, i) =>
      this.blip(f, 0.14, "square", 0.18, undefined, i * 0.08)
    )
    this.blip(2093, 0.2, "triangle", 0.14, undefined, 0.34)
  }
  gameOver() {
    ;[392, 311, 233, 155].forEach((f, i) =>
      this.blip(f, 0.22, "sawtooth", 0.2, undefined, i * 0.12)
    )
  }
  win() {
    ;[523, 659, 784, 1047, 1319, 1568].forEach((f, i) =>
      this.blip(f, 0.16, "square", 0.2, undefined, i * 0.1)
    )
  }
  levelClear() {
    ;[523, 659, 784, 1047].forEach((f, i) => this.blip(f, 0.14, "square", 0.2, undefined, i * 0.09))
  }
  ui() {
    this.blip(880, 0.05, "square", 0.12, 660)
  }
}
