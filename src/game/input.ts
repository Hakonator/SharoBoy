/**
 * Контроллер ввода: клавиатура, мышь/тач и pointer lock.
 * Ничего не знает о фазах игры — все решения принимает хост (Game)
 * через узкий интерфейс InputHost. Состояние ввода (клавиши, позиция
 * указателя, захват мыши) хост читает напрямую.
 */
import { clamp } from "./utils"

export interface InputKeys {
  left: boolean
  right: boolean
  space: boolean
}

/** Мост между контроллером ввода и игрой. */
export interface InputHost {
  /** X ракетки — начальная точка виртуальной координаты при pointer lock. */
  paddleX(): number
  /** Y ракетки — для определения зоны тач-поворота. */
  paddleY(): number
  /** Текущая ширина ракетки — для зоны тач-поворота. */
  paddleWidth(): number
  /** Ширина игрового мира — для ограничения координат указателя. */
  worldWidth(): number
  /** Разблокировка звука по первому пользовательскому вводу. */
  sfxEnsure(): void
  /** Идёт ли сейчас партия (запуск шара и захват мыши — только в игре). */
  isPlaying(): boolean
  /** Space/Enter: старт из меню/финальных экранов или запуск шара в игре. */
  primaryAction(): void
  /** Клик/тап: запуск шара, если партия идёт. */
  launchIfPlaying(): void
  /** Первый тач-ввод: хост адаптируется (поднимает ракетку над пальцем). */
  onTouchInput(): void
  /** Пауза/снятие паузы (клавиши P/Esc). */
  togglePause(): void
  /** Захват мыши потерян без запроса хоста (первый Esc при pointer lock
   *  браузер перехватывает и keydown не доставляет). Хост решает сам:
   *  обычно ставит паузу, как будто пользователь нажал паузу. */
  onLockLostUnexpectedly(): void
  /** Переключение звука (клавиша M). */
  toggleMute(): void
  /** Окно потеряло фокус — хост ставит паузу, если партия шла. */
  onBlur(): void
}

export class InputController {
  /** Состояние клавиш — читается игровым циклом. */
  readonly keys: InputKeys = { left: false, right: false, space: false }
  /** Игровая X-координата указателя; null — управление клавишами. */
  pointerX: number | null = null
  /** Захвачена ли мышь (pointer lock) — влияет на чувствительность ракетки. */
  locked = false
  /** Нажата ли левая кнопка мыши (для поворота ракетки в режиме отладки). */
  leftButton = false
  /** Нажата ли правая кнопка мыши (для поворота ракетки в режиме отладки). */
  rightButton = false
  /** PointerId пальца, который вращает ракетку (тач); -1 — нет такого пальца. */
  private touchRotateId = -1

  private virtualX: number | null = null
  private tapFire = false
  /** true — снятие захвата инициировано самим контроллером (releaseLock),
   *  а не пользователем: не трактуем как нажатие Esc. */
  private expectedUnlock = false
  /** До этого момента (performance.now) подавляем mousemove без захвата —
   *  браузер после снятия pointer lock отдаёт «хвостовой» mousemove с
   *  реальной позицией курсора, и ракетка прыгала к нему. */
  private suppressMouseUntil = 0

  constructor(
    private canvas: HTMLCanvasElement,
    private host: InputHost
  ) {}

  /** Разовый «огонь» по тапу: прочитать и сбросить. */
  consumeTapFire(): boolean {
    const was = this.tapFire
    this.tapFire = false
    return was
  }

  /** Сбросить клавиши (потеря фокуса и т.п.). */
  clearKeys() {
    this.keys.left = false
    this.keys.right = false
    this.keys.space = false
    this.leftButton = false
    this.rightButton = false
    this.touchRotateId = -1
  }

  private handleMouseDown = (e: MouseEvent) => {
    if (e.button === 0) this.leftButton = true
    if (e.button === 2) this.rightButton = true
  }

  private handleMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.leftButton = false
    if (e.button === 2) this.rightButton = false
  }

  private handleContextMenu = (e: Event) => {
    e.preventDefault()
  }

  attach() {
    window.addEventListener("keydown", this.handleKeyDown)
    window.addEventListener("keyup", this.handleKeyUp)
    window.addEventListener("blur", this.handleBlur)
    window.addEventListener("pointermove", this.handlePointerMove)
    window.addEventListener("mousemove", this.handlePointerMove)
    document.addEventListener("pointerlockchange", this.handleLockChange)
    this.canvas.addEventListener("pointerdown", this.handlePointerDown)
    this.canvas.addEventListener("pointerup", this.handlePointerUp)
    this.canvas.addEventListener("pointercancel", this.handlePointerUp)
    this.canvas.addEventListener("mousedown", this.handleMouseDown)
    window.addEventListener("mouseup", this.handleMouseUp)
    this.canvas.addEventListener("contextmenu", this.handleContextMenu)
  }

  destroy() {
    window.removeEventListener("keydown", this.handleKeyDown)
    window.removeEventListener("keyup", this.handleKeyUp)
    window.removeEventListener("blur", this.handleBlur)
    window.removeEventListener("pointermove", this.handlePointerMove)
    window.removeEventListener("mousemove", this.handlePointerMove)
    document.removeEventListener("pointerlockchange", this.handleLockChange)
    this.canvas.removeEventListener("pointerdown", this.handlePointerDown)
    this.canvas.removeEventListener("pointerup", this.handlePointerUp)
    this.canvas.removeEventListener("pointercancel", this.handlePointerUp)
    this.canvas.removeEventListener("mousedown", this.handleMouseDown)
    window.removeEventListener("mouseup", this.handleMouseUp)
    this.canvas.removeEventListener("contextmenu", this.handleContextMenu)
  }

  /** Отпустить захват мыши (пауза, конец партии). Помечаем снятие как
   *  «запрошенное самим контроллером», чтобы pointerlockchange от этого
   *  выхода не трактовался как пользовательское нажатие Esc. */
  releaseLock() {
    try {
      if (document.pointerLockElement) {
        this.expectedUnlock = true
        document.exitPointerLock?.()
      }
    } catch {
      /* ignore */
    }
  }

  private requestLock() {
    if (this.locked) return
    try {
      const el = this.canvas as HTMLCanvasElement & {
        requestPointerLock?: () => Promise<void> | void
      }
      if (typeof el.requestPointerLock !== "function") return
      const res = el.requestPointerLock()
      if (res && typeof (res as Promise<void>).catch === "function") {
        ;(res as Promise<void>).catch(() => {
          /* запрос захвата отклонён — играем без pointer lock */
        })
      }
    } catch {
      /* ignore */
    }
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    const c = e.code
    if (c === "ArrowLeft" || c === "KeyA") this.keys.left = true
    if (c === "ArrowRight" || c === "KeyD") this.keys.right = true
    if (c === "Space") e.preventDefault()
    if (c === "Space" || c === "Enter") this.host.primaryAction()
    if (c === "Space") this.keys.space = true
    if (c === "KeyP" || c === "Escape") this.host.togglePause()
    if (c === "KeyM") this.host.toggleMute()
  }

  private handleKeyUp = (e: KeyboardEvent) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") this.keys.left = false
    if (e.code === "ArrowRight" || e.code === "KeyD") this.keys.right = false
    if (e.code === "Space") this.keys.space = false
  }

  private handleBlur = () => {
    this.clearKeys()
    this.pointerX = null
    this.host.onBlur()
  }

  /* Координата указателя (clientX) → игровая координата X.
     Canvas растянут на весь экран, но прямоугольник считаем через
     getBoundingClientRect, чтобы компенсировать любые смещения/масштабы. */
  private clientToGameX(clientX: number): number {
    const rect = this.canvas.getBoundingClientRect()
    if (rect.width > 0) return ((clientX - rect.left) / rect.width) * this.host.worldWidth()
    return clientX - rect.left
  }

  /* Координата указателя (clientY) → игровая координата Y. */
  private clientToGameY(clientY: number): number {
    const rect = this.canvas.getBoundingClientRect()
    if (rect.height > 0) return ((clientY - rect.top) / rect.height) * this.canvas.height
    return clientY - rect.top
  }

  /* Сколько игровых пикселей приходится на один CSS-пиксель канваса
     (для дельты movementX в режиме pointer lock). */
  private worldPerCssPx(): number {
    const rect = this.canvas.getBoundingClientRect()
    return rect.width > 0 ? this.host.worldWidth() / rect.width : 1
  }

  private handlePointerMove = (e: PointerEvent | MouseEvent) => {
    if (this.locked) {
      const vx = (this.virtualX ?? this.host.paddleX()) + e.movementX * this.worldPerCssPx()
      this.virtualX = clamp(vx, 0, this.host.worldWidth())
      this.pointerX = this.virtualX
      return
    }
    // Сразу после снятия захвата браузер шлёт mousemove с реальной позицией
    // курсора — игнорируем короткое окно, чтобы ракетка не прыгала.
    if (performance.now() < this.suppressMouseUntil) return
    this.pointerX = this.clientToGameX(e.clientX)
  }

  private handlePointerDown = (e: PointerEvent) => {
    this.host.sfxEnsure()
    if (e.pointerType === "touch") this.host.onTouchInput()
    this.tapFire = true
    // Ракетку в точку касания НЕ перекидываем — палец/мышь могут быть далеко
    // от ракетки, и ракетка «уезжала» к месту тапа.
    if (this.host.isPlaying()) {
      if (e.pointerType === "touch") {
        // Тач: если палец попал в зону ракетки (сама ракетка + область чуть
        // ниже неё), вращаем ракетку: левая половина — поворот левой стороны
        // по часовой (leftButton), правая — наоборот (rightButton).
        const gx = this.clientToGameX(e.clientX)
        const gy = this.clientToGameY(e.clientY)
        const px = this.host.paddleX()
        const py = this.host.paddleY()
        const pw = this.host.paddleWidth()
        const inX = Math.abs(gx - px) <= pw / 2 + 14
        const inY = gy >= py - 44 && gy <= py + 90
        if (inX && inY) {
          this.touchRotateId = e.pointerId
          this.leftButton = false
          this.rightButton = false
          if (gx < px) this.leftButton = true
          else this.rightButton = true
          return // палец занят поворотом — шар при отпускании не запускаем
        }
        return // обычный тач: шар запускается при отпускании (handlePointerUp)
      }
      // Мышь/стилус: запуск сразу + pointer lock, как раньше.
      this.host.launchIfPlaying()
      this.requestLock()
    }
  }

  /* Отпускание пальца на таче = запуск шара (если он на ракетке),
     кроме пальца, который вращал ракетку. */
  private handlePointerUp = (e: PointerEvent) => {
    if (this.touchRotateId === e.pointerId) {
      this.touchRotateId = -1
      this.leftButton = false
      this.rightButton = false
      return
    }
    if (this.host.isPlaying() && (e.pointerType === "touch" || e.pointerType === "pen")) {
      this.host.launchIfPlaying()
    }
  }

  private handleLockChange = () => {
    this.locked = document.pointerLockElement === this.canvas
    if (this.locked) {
      this.virtualX = this.pointerX ?? this.host.paddleX()
      this.expectedUnlock = false
      this.suppressMouseUntil = 0
      return
    }
    this.expectedUnlock = false
    // Браузер снимает захват по первому Esc и НЕ доставляет keydown странице
    // (Pointer Lock API). Внезапная потеря захвата без нашего запроса =
    // пользователь нажал Esc — сообщаем хосту, он ставит паузу.
    this.suppressMouseUntil = performance.now() + 150
    if (this.virtualX !== null) this.pointerX = this.virtualX
    this.host.onLockLostUnexpectedly()
  }
}
