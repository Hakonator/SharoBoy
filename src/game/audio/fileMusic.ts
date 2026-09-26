/**
 * Плеер файловой музыки (MP3 из src/assets/music): случайный трек из набора
 * с плавным кроссфейдом. Инкапсулирован от SFX через колбэки состояния.
 */
/** MP3-дорожки из src/assets/music/*.mp3 — единый набор для всех экранов,
 *  подхватывается автоматически (Vite glob). Пустая папка → встроенный трекер. */
const FILE_TRACKS = import.meta.glob("../../assets/music/*.mp3", {
  query: "?url",
  import: "default",
  eager: true,
}) as Record<string, string>

/** Общий список MP3-файлов (стабильный порядок — для выбора «не тот же»). */
export const MUSIC_FILES: string[] = Object.values(FILE_TRACKS)

/** Базовая громкость MP3-музыки — умножается на ползунок музыки. */
export const MUSIC_VOLUME = 0.4
/** Длительность плавного перехода между треками (мс). */
const MUSIC_FADE_MS = 900

/** Fisher–Yates: перемешать набор и не повторить последний трек на стыке циклов. */
export function shuffleMusicTracks(
  tracks: readonly string[],
  previous: string | null,
  random: () => number = Math.random
): string[] {
  const shuffled = [...tracks]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  if (shuffled.length > 1 && shuffled[0] === previous) {
    const swapIndex = 1 + Math.floor(random() * (shuffled.length - 1))
    ;[shuffled[0], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[0]]
  }
  return shuffled
}

/** Создать аудиоэлемент для MP3-трека. Возвращает null, если окружение без
 *  медиа-элементов (тесты в node) — тогда музыка просто не играет. */
function createAudio(src: string): HTMLAudioElement | null {
  if (typeof Audio === "undefined") return null
  const el = new Audio(src)
  el.preload = "auto"
  return el
}

export class FileMusicPlayer {
  private audio: HTMLAudioElement | null = null
  private url: string | null = null
  private lastPlayedUrl: string | null = null
  private trackQueue: string[] = []
  /** Активные fade-переходы громкости: элемент → id интервала. */
  private fades = new Map<HTMLAudioElement, number>()

  constructor(
    /** Текущая целевая громкость (базовая × ползунок музыки). */
    private readonly getVolume: () => number,
    /** Должна ли музыка играть сейчас (musicOn && !musicMuted в SFX). */
    private readonly shouldPlay: () => boolean
  ) {}

  /** Активен ли файловый трек (в отличие от встроенного секвенсора). */
  get active(): boolean {
    return this.audio !== null
  }

  /** Возобновить/запустить текущий трек с актуальной громкостью. */
  resume() {
    if (!this.audio) return
    this.audio.volume = this.getVolume()
    void this.audio.play().catch(() => {})
  }

  /** Пауза (mute музыки). */
  pause() {
    this.audio?.pause()
  }

  /** Обновить громкость без перезапуска (ползунок музыки). */
  setVolume(v: number) {
    if (this.audio) this.audio.volume = v
  }

  play() {
    if (!MUSIC_FILES.length) return
    if (!this.trackQueue.length) {
      this.trackQueue = shuffleMusicTracks(MUSIC_FILES, this.lastPlayedUrl)
    }
    const pick = this.trackQueue.pop()!
    const a = createAudio(pick)
    if (!a) return // окружение без медиа-элементов (тесты) — музыки нет
    this.url = pick
    this.lastPlayedUrl = pick
    a.volume = 0
    a.addEventListener("ended", () => {
      // Трек кончился — следующий случайный из набора
      if (this.shouldPlay()) this.play()
    })
    const prev = this.audio
    if (prev && prev !== a) this.fadeAudio(prev, 0, () => prev.pause())
    this.audio = a
    void a.play().catch(() => {})
    this.fadeAudio(a, this.getVolume())
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

  stop() {
    for (const [el, id] of this.fades) {
      window.clearInterval(id)
      el.pause()
    }
    this.fades.clear()
    if (this.audio) {
      this.audio.pause()
      this.audio = null
    }
    this.url = null
  }
}
