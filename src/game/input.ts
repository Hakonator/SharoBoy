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
  /** Высота игрового мира — для перевода касаний в координаты ракетки. */
  worldHeight(): number
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
    // Эмулированные браузером mouse-события после тача игнорируем:
    // иначе тап по зоне поворота давал ложный leftButton/rightButton.
    if (performance.now() < this.suppressMouseUntil) return
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
    this.canvas.addEventListener("pointercancel", this.handlePointerCancel)
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
    this.canvas.removeEventListener("pointercancel", this.handlePointerCancel)
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

  /* Сторона тач-поворота: -1 — левая зона, +1 — правая, 0 — не в зоне.
     Зоны лежат СНАРУЖИ краёв ракетки (не в её пределах): касание самой
     ракетки или под ней остаётся обычным управлением движением. Считаем
     в CSS-пикселях (физических), а не в мировых: мировые единицы на
     телефоне равны доле от 1920-эталона и сотни «мировых» единиц
     превращаются там в пару пикселей — меньше пальца. */
  private touchRotateSide(clientX: number, clientY: number): -1 | 0 | 1 {
    const rect = this.canvas.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return 0
    const gx = clientX - rect.left
    const gy = clientY - rect.top
    const px = (this.host.paddleX() / this.host.worldWidth()) * rect.width
    const py = (this.host.paddleY() / this.host.worldHeight()) * rect.height
    const halfW = ((this.host.paddleWidth() / this.host.worldWidth()) * rect.width) / 2
    const inY = gy >= py - 32 && gy <= py + 90
    if (!inY) return 0
    const gap = 8 // зазор от края ракетки
    const zone = 70 // ширина зоны наружу от края
    if (gx >= px - halfW - gap - zone && gx <= px - halfW - gap) return -1
    if (gx >= px + halfW + gap && gx <= px + halfW + gap + zone) return 1
    return 0
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
    // Палец, вращающий ракетку, её не двигает — иначе ракетка «прыгала»
    // к месту касания при попытке повернуть. Вращение и движение —
    // независимые жесты (вращающий палец фиксируется в handlePointerDown).
    const pid = (e as PointerEvent).pointerId
    if (pid !== undefined && pid === this.touchRotateId) return
    // Подавляем только эмулированные мышиные события после тача (у MouseEvent
    // нет pointerId). Настоящие pointer-события от пальца/стилуса работают
    // сразу — иначе движение ракетки «замирало» на полсекунды после касания.
    if (pid === undefined && performance.now() < this.suppressMouseUntil) return
    // Сразу после снятия захвата браузер шлёт mousemove с реальной позицией
    // курсора — игнорируем короткое окно, чтобы ракетка не прыгала.
    this.pointerX = this.clientToGameX(e.clientX)
  }

  private handlePointerDown = (e: PointerEvent) => {
    this.host.sfxEnsure()
    if (e.pointerType === "touch") {
      this.host.onTouchInput()
      // Браузер после отпускания пальца эмулирует мышь (mousemove/mousedown)
      // в точке касания: без подавления ракетка «прыгала» к пальцу после
      // поворота, а эмулированный mousedown давал ложный импульс вращения.
      this.suppressMouseUntil = performance.now() + 600
    }
    this.tapFire = true
    // Ракетку в точку касания НЕ перекидываем — палец/мышь могут быть далеко
    // от ракетки, и ракетка «уезжала» к месту тапа.
    if (this.host.isPlaying()) {
      if (e.pointerType === "touch") {
        // Тач: зоны поворота — левый/правый край ракетки (+чуть ниже).
        // Центр — «мёртвая зона»: нажатие под серединой не вращает ракетку.
        const side = this.touchRotateSide(e.clientX, e.clientY)
        if (side !== 0) {
          this.touchRotateId = e.pointerId
          this.leftButton = side < 0
          this.rightButton = side > 0
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
      // Долгий поворот: окно подавления от pointerdown могло истечь —
      // продлеваем, чтобы эмулированный mousemove не дёрнул ракетку.
      if (e.pointerType === "touch") this.suppressMouseUntil = performance.now() + 600
      return
    }
    if (this.host.isPlaying() && (e.pointerType === "touch" || e.pointerType === "pen")) {
      this.host.launchIfPlaying()
      if (e.pointerType === "touch") this.suppressMouseUntil = performance.now() + 600
    }
  }

  /* Отмена касания браузером (системный жест, смена пальца) — указатель
     теряется без pointerup. Сбрасываем кнопки поворота, шар не запускаем. */
  private handlePointerCancel = (e: PointerEvent) => {
    if (this.touchRotateId === e.pointerId) {
      this.touchRotateId = -1
      this.leftButton = false
      this.rightButton = false
    }
    if (e.pointerType === "touch") this.suppressMouseUntil = performance.now() + 600
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
