import { lsGet, lsSet } from "./utils"
import { FileMusicPlayer, MUSIC_FILES, MUSIC_VOLUME } from "./audio/fileMusic"
import { GAME_BASS, GAME_LEAD } from "./audio/tracks/game"
import { GAME_THEME } from "./audio/tracks/gameTheme"
import { MAP_BASS, MAP_LEAD } from "./audio/tracks/map"
import { MENU_BASS, MENU_LEAD } from "./audio/tracks/menu"

/** Базовая громкость эффектов (мастер-гейн) и файловой музыки. */
const MASTER_VOLUME = 0.42

/** Длительность плавного перехода между треками (мс) — см. audio/fileMusic.ts. */
/** Ключи сохранения ползунков громкости (0..1). */
const VOL_MUSIC_KEY = "sharoboy-vol-music"
const VOL_SFX_KEY = "sharoboy-vol-sfx"

/** Ограничить громкость диапазоном 0..1. */
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

/** Прочитать сохранённую громкость; мусор в хранилище → значение по умолчанию. */
function loadVolume(key: string, def: number): number {
  const raw = lsGet(key)
  if (raw === null) return def
  const n = Number(raw)
  return Number.isFinite(n) ? clamp01(n) : def
}

type MusicKind = "menu" | "game" | "map"
/** Крошечный WebAudio-синтезатор: короткие блипы на каждое действие +
 *  8-битная фоновая музыка (встроенный трекер, без внешних файлов). */
export class SFX {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  /** Отдельный тракт музыки: ползунок музыки не влияет на эффекты. */
  private musicGain: GainNode | null = null
  private noiseBuf: AudioBuffer | null = null
  /** Выключить звуковые эффекты (не влияет на музыку). */
  muted = false
  /** Выключить фоновую музыку (не влияет на эффекты). */
  musicMuted = false
  /** Громкость музыки 0..1 (ползунок у иконки ноты), сохраняется в localStorage. */
  musicVolume: number
  /** Громкость эффектов 0..1 (ползунок у иконки динамика), сохраняется. */
  sfxVolume: number
  private musicOn = false
  private musicTimer: number | null = null
  private nextBeat = 0
  private musicStep = 0
  /** Активный трек. */
  private track: MusicKind = "menu"
  /** MP3-режим: играет файл из общего набора (вместо встроенного секвенсора). */
  /** MP3-режим: играет файл из общего набора (вместо встроенного секвенсора). */
  private fileMode = MUSIC_FILES.length > 0
  /** Плеер файловой музыки: выбор трека, кроссфейд, пауза/возобновление. */
  private readonly filePlayer = new FileMusicPlayer(
    () => this.fileVolume(),
    () => this.musicOn && !this.musicMuted
  )
  /** Слушатели первого ввода уже навешены (разблокировка автозвука). */
  private unlockBound = false
  constructor() {
    this.musicVolume = loadVolume(VOL_MUSIC_KEY, 1)
    this.sfxVolume = loadVolume(VOL_SFX_KEY, 1)
  }

  /** MIDI-нота → частота Гц (С4 = 60). */
  private static midi(m: number): number {
    return 440 * Math.pow(2, (m - 69) / 12)
  }

  /** Размер шага (восьмая нота) для трека. Меню — медленно и «душевно»,
   *  карта кампании — совсем неторопливо и загадочно. */
  private static stepFor(track: MusicKind): number {
    return track === "menu" ? 60 / 76 / 2 : track === "map" ? 60 / 48 / 2 : 60 / 144 / 2
  }

  /** Вкл/выкл музыку во время игры: файл — пауза/продолжение с места,
   *  секвенсор — продолжение с актуального ритм-курсора. */
  setMusicMuted(v: boolean) {
    this.musicMuted = v
    if (v) {
      this.filePlayer.pause()
      return
    }
    if (this.filePlayer.active) {
      this.filePlayer.resume()
    } else if (this.musicOn) {
      // Трек был пропущен из-за mute — запускаем его при включении музыки
      if (this.fileMode) this.playFileMusic()
      else if (this.musicTimer === null) this.scheduleMusic()
    }
  }

  /** Громкость MP3-трека с учётом ползунка музыки. */
  private fileVolume(): number {
    return MUSIC_VOLUME * this.musicVolume
  }

  /** Ползунок громкости музыки (0..1): файл — сразу, синтез — через musicGain. */
  setMusicVolume(v: number) {
    this.musicVolume = clamp01(v)
    lsSet(VOL_MUSIC_KEY, String(this.musicVolume))
    if (this.musicGain) this.musicGain.gain.value = MASTER_VOLUME * this.musicVolume
    this.filePlayer.setVolume(this.fileVolume())
  }

  /** Ползунок громкости эффектов (0..1): мастер-гейн WebAudio. */
  setSfxVolume(v: number) {
    this.sfxVolume = clamp01(v)
    lsSet(VOL_SFX_KEY, String(this.sfxVolume))
    if (this.master) this.master.gain.value = MASTER_VOLUME * this.sfxVolume
  }

  /** Запустить музыку сразу при открытии игры, не дожидаясь жеста. Браузеры
   *  блокируют автозвук до первого ввода: пробуем немедленно, а если не
   *  вышло — повторяем при первом клике/тапе/клавише. */
  autostart() {
    this.ensure()
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume()
  }

  /** Первый ввод пользователя — легальная разблокировка звука. */
  private armGestureUnlock() {
    if (this.unlockBound) return
    if (typeof window === "undefined") return
    this.unlockBound = true
    const onInput = () => {
      this.ensure()
      if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume()
    }
    window.addEventListener("pointerdown", onInput)
    window.addEventListener("keydown", onInput)
    window.addEventListener("touchstart", onInput, { passive: true })
  }

  /** Переключение фоновой музыки. Каждый вызов (старт уровня, переход на
   *  следующий уровень, выход в меню) запускает НОВЫЙ случайный MP3-трек из
   *  набора с плавным переходом; для карты кампании MP3 не тратится — там
   *  играет собственный тихий синт-трек; без файлов — встроенный трекер. */
  setTrack(track: MusicKind) {
    this.track = track
    this.musicStep = 0
    this.fileMode = track !== "map" && MUSIC_FILES.length > 0
    // Файловая музыка работает и без WebAudio; секвенсору нужен контекст.
    if (!this.ctx && !this.fileMode) return // ensure ещё не был — дождётся жеста
    this.nextBeat = this.ctx ? this.ctx.currentTime + 0.05 : 0
    if (!this.musicOn) return
    if (this.fileMode) {
      if (!this.musicMuted) this.playFileMusic()
    } else {
      this.filePlayer.stop()
      this.scheduleMusic()
    }
  }
  /** Случайный MP3-трек с плавным кроссфейдом (делегирует файловому плееру). */
  private playFileMusic() {
    this.filePlayer.play()
  }

  /** Запускает зацикленную 8-битную тему (idempotent). */
  startMusic() {
    if (this.musicOn) {
      // Страховка: если что-то остановилось — возобновляем (файл — с места,
      // секвенсор — перезапуском), иначе музыка «умирает» до перезагрузки.
      if (!this.musicMuted) {
        if (this.filePlayer.active) this.filePlayer.resume()
        if (this.musicTimer === null && !this.filePlayer.active) this.scheduleMusic()
      }
      return
    }
    // MP3-режим не зависит от WebAudio — играет даже без контекста.
    if (!this.fileMode && (!this.ctx || !this.master)) return
    this.musicOn = true
    this.nextBeat = this.ctx ? this.ctx.currentTime + 0.06 : 0
    this.musicStep = 0
    if (this.fileMode && !this.musicMuted) this.playFileMusic()
    else if (!this.musicMuted) this.scheduleMusic()
  }

  stopMusic() {
    this.musicOn = false
    this.filePlayer.stop()
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
    const isMap = this.track === "map"
    const lead = this.track === "menu" ? MENU_LEAD : isMap ? MAP_LEAD : GAME_LEAD
    const bass = this.track === "menu" ? MENU_BASS : isMap ? MAP_BASS : GAME_BASS
    const theme = this.track === "game" ? GAME_THEME : null
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
          // карта: ноты долгие и «тающие» — эффект подводной загадки
          isMap ? step * 4 : step * 0.8,
          isMenu || isMap ? "triangle" : "square",
          isMap ? 0.07 : isMenu ? 0.05 : 0.06,
          undefined,
          delay,
          this.musicGain
        )
      if (b > 0)
        this.tone(
          SFX.midi(b),
          // карта: бас — почти органный пунктик, тянется через такт
          isMap ? step * 7 : step,
          "triangle",
          isMap ? 0.09 : 0.07,
          undefined,
          delay,
          this.musicGain
        )
      if (th !== undefined && th > 0)
        this.tone(SFX.midi(th), step * 0.7, "triangle", 0.045, undefined, delay, this.musicGain)
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
        // Без WebAudio MP3-музыка всё равно возможна — контекст не обязателен.
        if (AC) {
          this.ctx = new AC()
          this.master = this.ctx.createGain()
          this.master.gain.value = MASTER_VOLUME * this.sfxVolume
          this.master.connect(this.ctx.destination)
          // Музыкальный тракт отдельный: ползунок звука не влияет на музыку.
          this.musicGain = this.ctx.createGain()
          this.musicGain.gain.value = MASTER_VOLUME * this.musicVolume
          this.musicGain.connect(this.ctx.destination)
          const len = Math.floor(this.ctx.sampleRate * 0.4)
          this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
          const data = this.noiseBuf.getChannelData(0)
          for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
        }
      }
      if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume()
    } catch {
      /* нет доступа к WebAudio — игра работает без звука */
      this.ctx = null
      this.master = null
      this.musicGain = null
    }
    this.armGestureUnlock()
    // Запуск вне try: MP3-музыка играет даже там, где WebAudio недоступен.
    this.startMusic()
  }
  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    slideTo?: number,
    delay = 0,
    /** Адресат звука: null — эффекты (мастер-гейн), musicGain — музыка. */
    bus: GainNode | null = null
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
    g.connect(bus ?? this.master)
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
