import { useCallback, useEffect, useRef, useState } from "react";
import { Game, type HudData } from "./game/game";

const INITIAL_HUD: HudData = {
  phase: "menu",
  score: 0,
  best: 0,
  lives: 3,
  level: 1,
  levelCount: 4,
  levelName: "СТРЕЛА",
  combo: 0,
  blocksLeft: 0,
  muted: false,
  banner: null,
  stuck: true,
  newRecord: false,
  shield: 0,
  wideOn: false,
  slowOn: false,
  fastOn: false,
  shrinkOn: false,
  laserOn: false,
  laserArmed: false,
  rocketOn: false,
  fireOn: false,
  magnetOn: false,
  top: [],
  topEndless: [],
  mode: "campaign",
  wave: 0,
  coins: 0,
};

/* ---------- inline icons ---------- */
const IconPause = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
    <rect x="6" y="5" width="4" height="14" rx="1.4" />
    <rect x="14" y="5" width="4" height="14" rx="1.4" />
  </svg>
);
const IconPlay = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
    <path d="M8 5.5v13a1 1 0 0 0 1.52.86l10.4-6.5a1 1 0 0 0 0-1.72L9.52 4.64A1 1 0 0 0 8 5.5Z" />
  </svg>
);
const IconSound = ({ off }: { off: boolean }) => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
    <path d="M4 9v6h4l5 4V5L8 9H4Z" />
    {off ? (
      <path d="m16.5 9.5 5 5m0-5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    ) : (
      <path
        d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    )}
  </svg>
);
const IconMouse = () => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="7" y="3" width="10" height="18" rx="5" />
    <path d="M12 7v3" strokeLinecap="round" />
  </svg>
);
const IconBall = ({ color, className }: { color: string; className?: string }) => (
  <svg viewBox="0 0 20 20" className={className}>
    <defs>
      <radialGradient id={`g-${color.replace("#", "")}`} cx="35%" cy="30%" r="80%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
        <stop offset="45%" stopColor={color} />
        <stop offset="100%" stopColor={color} stopOpacity="0.55" />
      </radialGradient>
    </defs>
    <circle cx="10" cy="10" r="8.5" fill={`url(#g-${color.replace("#", "")})`} />
  </svg>
);

const Key = ({ children, wide }: { children: React.ReactNode; wide?: boolean }) => (
  <span
    className={`inline-flex h-8 items-center justify-center border border-line bg-deep px-2 font-display text-[11px] text-cyan-neon shadow-[0_3px_0_rgba(3,14,21,0.9),inset_0_1px_0_rgba(141,220,255,0.15)] ${
      wide ? "min-w-16" : "min-w-8"
    }`}
    style={{ clipPath: "polygon(5px 0,100% 0,100% calc(100% - 5px),calc(100% - 5px) 100%,0 100%,0 5px)" }}
  >
    {children}
  </span>
);

const EffectChip = ({ keyVal, label, good }: { keyVal: string; label: string; good: boolean }) => (
  <div
    key={keyVal}
    className={`hud-chip px-2.5 py-1 font-display text-[11px] tracking-wider ${
      good ? "text-[#7dffb9]" : "text-[#ff8d84]"
    }`}
  >
    {label}
  </div>
);

function ControlsPanel() {
  return (
    <div className="hud-chip p-4 sm:p-5">
      <div className="hud-label mb-3">Управление</div>
      <ul className="space-y-2.5 text-sm text-foam/90">
        <li className="flex items-center gap-3">
          <span className="text-cyan-neon">
            <IconMouse />
          </span>
          <span>
            Мышь / палец — двигать ракетку, <b className="text-cyan-neon">клик</b> — запуск
          </span>
        </li>
        <li className="flex items-center gap-3">
          <span className="flex gap-1">
            <Key>←</Key>
            <Key>→</Key>
          </span>
          <span>
            или <Key>A</Key> <Key>D</Key> — движение
          </span>
        </li>
        <li className="flex items-center gap-3">
          <Key wide>ПРОБЕЛ</Key>
          <span>запуск шара, выстрел ракетами и лазером</span>
        </li>
        <li className="flex items-center gap-3">
          <span className="flex gap-1">
            <Key>P</Key>
            <Key>ESC</Key>
          </span>
          <span>пауза</span>
          <Key>M</Key>
          <span>звук</span>
        </li>
      </ul>
    </div>
  );
}

/* ---------- menu decorations ---------- */
function FloatingBalls() {
  const balls = [
    { c: "#ff6a5c", s: 74, x: "78%", y: "16%", d: "0s", t: "-6deg" },
    { c: "#ffc94d", s: 46, x: "70%", y: "34%", d: "0.6s", t: "4deg" },
    { c: "#5dffb0", s: 58, x: "86%", y: "40%", d: "1.1s", t: "0deg" },
    { c: "#ff5ca8", s: 34, x: "64%", y: "58%", d: "0.3s", t: "8deg" },
    { c: "#35e0ff", s: 90, x: "80%", y: "66%", d: "1.6s", t: "-3deg" },
    { c: "#ffc94d", s: 26, x: "92%", y: "24%", d: "0.9s", t: "0deg" },
  ];
  return (
    <>
      {balls.map((b, i) => (
        <div
          key={i}
          className="anim-bob pointer-events-none absolute hidden md:block"
          style={{ left: b.x, top: b.y, width: b.s, height: b.s, animationDelay: b.d, ["--tilt" as string]: b.t }}
        >
          <div
            className="h-full w-full rounded-full"
            style={{
              background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.95), ${b.c} 45%, rgba(0,0,0,0.35) 100%)`,
              boxShadow: `0 0 34px ${b.c}66, inset 0 -8px 16px rgba(0,0,0,0.35)`,
            }}
          />
        </div>
      ))}
    </>
  );
}

/* ---------- app ---------- */
export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [hud, setHud] = useState<HudData>(INITIAL_HUD);

  const onHud = useCallback((h: HudData) => setHud(h), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = new Game(canvas, onHud);
    gameRef.current = game;
    game.attach();
    return () => game.destroy();
  }, [onHud]);

  const g = () => gameRef.current;
  const inGame = hud.phase === "playing" || hud.phase === "paused";

  return (
    <div className="relative h-full w-full overflow-hidden font-body">
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* ================= HUD ================= */}
      {inGame && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3 sm:p-4">
          <div className="flex items-start gap-2">
            <div className="hud-chip px-3.5 py-2">
              <div className="hud-label">Счёт</div>
              <div className="font-display text-xl leading-none text-foam tabular-nums sm:text-2xl">
                {hud.score.toLocaleString("ru-RU")}
              </div>
            </div>
            <div className="hud-chip hidden px-3.5 py-2 sm:block">
              <div className="hud-label">Рекорд</div>
              <div className="font-display text-xl leading-none text-gold tabular-nums sm:text-2xl">
                {hud.best.toLocaleString("ru-RU")}
              </div>
            </div>
            {hud.combo >= 2 && (
              <div key={`combo-${hud.combo}`} className="hud-chip anim-combo px-3.5 py-2">
                <div className="hud-label">Серия</div>
                <div className="font-display text-xl leading-none text-punch sm:text-2xl">×{hud.combo}</div>
              </div>
            )}
            {hud.coins > 0 && (
              <div className="hud-chip px-3.5 py-2">
                <div className="hud-label">Монеты</div>
                <div className="font-display text-xl leading-none text-gold tabular-nums sm:text-2xl">
                  {hud.coins}
                </div>
              </div>
            )}
            {hud.shield > 0 && (
              <div key={`shield-${hud.shield}`} className="hud-chip anim-combo px-3.5 py-2">
                <div className="hud-label">Щит</div>
                <div className="mt-1 flex gap-1">
                  {Array.from({ length: hud.shield }).map((_, i) => (
                    <span
                      key={i}
                      className="h-3.5 w-3.5 rounded-full bg-[#4dff9e] shadow-[0_0_8px_rgba(77,255,158,0.8)]"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="hud-chip stripe-hazard hidden px-5 py-2 text-center md:block">
            <div className="hud-label">
              {hud.mode === "endless"
                ? `Волна ${hud.wave} · ∞`
                : `Уровень ${hud.level}/${hud.levelCount} · ${hud.levelName}`}
            </div>
            <div className="font-display text-lg leading-tight text-cyan-neon">
              ЦЕЛИ: <span className="text-foam tabular-nums">{hud.blocksLeft}</span>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <div className="hud-chip px-3.5 py-2">
              <div className="hud-label">Жизни</div>
              <div className="mt-1 flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <IconBall
                    key={i}
                    color="#35e0ff"
                    className={`h-4 w-4 ${i < hud.lives ? "opacity-100" : "opacity-20 grayscale"}`}
                  />
                ))}
              </div>
            </div>
            <button
              className="icon-btn pointer-events-auto flex h-10 w-10 items-center justify-center"
              onClick={() => g()?.togglePause()}
              aria-label="Пауза"
            >
              {hud.phase === "paused" ? <IconPlay /> : <IconPause />}
            </button>
            <button
              className="icon-btn pointer-events-auto flex h-10 w-10 items-center justify-center"
              onClick={() => g()?.toggleMute()}
              aria-label="Звук"
            >
              <IconSound off={hud.muted} />
            </button>
          </div>
        </div>
      )}

      {/* mobile level chip */}
      {inGame && (
        <div className="pointer-events-none absolute left-1/2 top-[68px] z-20 -translate-x-1/2 md:hidden">
          <div className="hud-chip px-3 py-1 font-display text-xs text-cyan-neon">
            {hud.mode === "endless" ? `ВОЛНА ${hud.wave}` : `УР. ${hud.level}/${hud.levelCount}`} · ЦЕЛИ{" "}
            {hud.blocksLeft}
          </div>
        </div>
      )}

      {/* подсказки: оружие и запуск */}
      {hud.phase === "playing" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[96px] z-20 flex flex-col items-center gap-2 sm:bottom-[102px]">
          {hud.laserArmed && (
            <div className="anim-blink hud-chip px-4 py-2 font-display text-sm tracking-wider text-[#9df2ff]">
              ЛАЗЕР ГОТОВ — ПРОБЕЛ / ТАП
            </div>
          )}
          {hud.rocketOn && (
            <div className="anim-blink hud-chip px-4 py-2 font-display text-sm tracking-wider text-mint">
              РАКЕТЫ — ПРОБЕЛ / ТАП
            </div>
          )}
          {hud.stuck && (
            <div className="anim-blink hud-chip px-4 py-2 font-display text-sm tracking-wider text-cyan-neon">
              КЛИК / ПРОБЕЛ — ЗАПУСК
            </div>
          )}
        </div>
      )}

      {/* активные эффекты */}
      {inGame && (hud.wideOn || hud.slowOn || hud.fastOn || hud.shrinkOn || hud.fireOn) && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-20 flex max-w-[46vw] flex-wrap gap-1.5 sm:bottom-4 sm:left-4">
          {hud.wideOn && <EffectChip keyVal="wide" label="ШИРЕ" good />}
          {hud.fireOn && <EffectChip keyVal="fire" label="ОГНЬ" good />}
          {hud.magnetOn && <EffectChip keyVal="magnet" label="МАГНИТ" good />}
          {hud.slowOn && <EffectChip keyVal="slow" label="МЕДЛЕННЕЕ" good />}
          {hud.fastOn && <EffectChip keyVal="fast" label="БЫСТРЕЕ" good={false} />}
          {hud.shrinkOn && <EffectChip keyVal="shrink" label="УЗКАЯ" good={false} />}
        </div>
      )}

      {/* level banner */}
      {hud.banner && inGame && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <div className="anim-banner px-6 text-center">
            <div
              className="font-display text-3xl tracking-wide text-foam title-glow sm:text-5xl"
              style={{ textShadow: "0 0 24px rgba(53,224,255,0.8), 0 4px 0 rgba(4,18,26,0.9)" }}
            >
              {hud.banner}
            </div>
          </div>
        </div>
      )}

      {/* ================= MENU ================= */}
      {hud.phase === "menu" && (
        <div className="absolute inset-0 z-40 overflow-y-auto">
          <FloatingBalls />
          <div className="relative flex min-h-full flex-col items-start justify-center gap-8 p-6 md:flex-row md:items-center md:gap-16 md:p-16 lg:p-24">
            <div className="anim-rise max-w-xl">
              <h1 className="font-display leading-[0.95]">
                <span className="title-glow block text-6xl text-foam sm:text-7xl lg:text-8xl">ШАРО</span>
                <span className="title-glow block text-6xl text-cyan-neon sm:text-7xl lg:text-8xl">
                  БОЙ<span className="text-punch">!</span>
                </span>
              </h1>
              <p className="mt-5 max-w-md text-base leading-relaxed text-foam/80 sm:text-lg">
                Вместо кирпичей — <b className="text-mint">шары</b> и <b className="text-gold">овалы</b> разной
                величины. Отбивай ракеткой, собирай серии, лови бонусы, одолей{" "}
                <b className="text-cyan-neon">4 уровня с боссом</b> — или выживай в{" "}
                <b className="text-punch">бесконечных волнах</b>.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-4">
                <button className="btn-arcade px-8 py-4 text-lg sm:text-xl" onClick={() => g()?.startGame()}>
                  Кампания
                </button>
                <button
                  className="btn-ghost px-6 py-4 font-display text-base sm:text-lg"
                  onClick={() => g()?.startEndless()}
                >
                  Бесконечный
                </button>
                {hud.best > 0 && (
                  <div className="hud-chip px-4 py-3">
                    <div className="hud-label">Рекорд</div>
                    <div className="font-display text-xl text-gold tabular-nums">
                      {hud.best.toLocaleString("ru-RU")}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-7 flex flex-wrap gap-2 text-xs text-dim">
                <span className="hud-chip px-3 py-1.5">
                  <b className="text-mint">зелёные</b> — 1 удар
                </span>
                <span className="hud-chip px-3 py-1.5">
                  <b className="text-gold">жёлтые</b> — 2 удара
                </span>
                <span className="hud-chip px-3 py-1.5">
                  <b className="text-coral">красные</b> — 3 удара
                </span>
                <span className="hud-chip px-3 py-1.5">
                  <b className="text-mint">с шариками внутри</b> — рассыпаются
                </span>
              </div>
            </div>

            <div className="anim-rise w-full max-w-sm" style={{ animationDelay: "0.12s" }}>
              {hud.top.length > 0 && (
                <div className="hud-chip mb-3 p-4 sm:p-5">
                  <div className="hud-label mb-3">Рекорды кампании</div>
                  <ol className="space-y-1.5">
                    {hud.top.map((s, i) => (
                      <li key={`c-${s}-${i}`} className="flex items-center font-display text-sm">
                        <span
                          className={
                            i === 0 ? "text-gold" : i === 1 ? "text-foam" : i === 2 ? "text-coral" : "text-dim"
                          }
                        >
                          {i + 1}.
                        </span>
                        <span className="mx-3 flex-1 border-b border-dotted border-line" />
                        <span className="text-foam tabular-nums">{s.toLocaleString("ru-RU")}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {hud.topEndless.length > 0 && (
                <div className="hud-chip mb-3 p-4 sm:p-5">
                  <div className="hud-label mb-3">Рекорды — бесконечный</div>
                  <ol className="space-y-1.5">
                    {hud.topEndless.map((s, i) => (
                      <li key={`e-${s}-${i}`} className="flex items-center font-display text-sm">
                        <span
                          className={
                            i === 0 ? "text-gold" : i === 1 ? "text-foam" : i === 2 ? "text-coral" : "text-dim"
                          }
                        >
                          {i + 1}.
                        </span>
                        <span className="mx-3 flex-1 border-b border-dotted border-line" />
                        <span className="text-foam tabular-nums">{s.toLocaleString("ru-RU")}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              <ControlsPanel />
              <div className="hud-chip mt-3 p-4">
                <div className="hud-label mb-2">Бонусы и анти-бонусы</div>
                <div className="grid grid-cols-1 gap-1.5 text-sm text-foam/90 sm:grid-cols-2">
                  <span>
                    <b className="text-[#4dff9e]">«ШИР»</b> — шире ракетка
                  </span>
                  <span>
                    <b className="text-[#4dff9e]">«×3»</b> — тройной шар
                  </span>
                  <span>
                    <b className="text-[#4dff9e]">«+1»</b> — жизнь
                  </span>
                  <span>
                    <b className="text-[#4dff9e]">«СК↓»</b> — медленнее
                  </span>
                  <span>
                    <b className="text-[#4dff9e]">«ЩИТ»</b> — экран внизу
                  </span>
                  <span>
                    <b className="text-[#4dff9e]">«ЛАЗ»</b> — луч на 2 с, выстрел — пробел
                  </span>
                  <span>
                    <b className="text-[#4dff9e]">«РКТ»</b> — ракеты (пробел)
                  </span>
                  <span>
                    <b className="text-[#4dff9e]">«ОГНЬ»</b> — ядро прожигает блоки
                  </span>
                  <span className="col-span-2 mt-1 border-t border-line pt-2 text-dim">
                    Анти-бонусы — красные:
                  </span>
                  <span>
                    <b className="text-[#ff5347]">«СК↑»</b> — шар быстрее
                  </span>
                  <span>
                    <b className="text-[#ff5347]">«УЗК»</b> — узкая ракетка
                  </span>
                </div>
                <div className="mt-3 border-t border-line pt-2.5 text-xs text-dim">
                  Тёмные <b className="text-coral">бомбы с фитилём</b> детонируют по площади — собирай цепочки!
                  Поле периодически пополняется и дрейфует.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= PAUSE ================= */}
      {hud.phase === "paused" && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-abyss/70 p-6">
          <div className="anim-pop w-full max-w-sm">
            <div className="hud-chip p-6 sm:p-8">
              <div className="hud-label mb-1">Пауза</div>
              <h2 className="font-display title-glow text-4xl text-foam">СТОП-КАДР</h2>
              <div className="mt-6 flex flex-col gap-3">
                <button
                  className="btn-arcade flex items-center justify-center gap-2 px-6 py-3.5"
                  onClick={() => g()?.togglePause()}
                >
                  <IconPlay /> Продолжить
                </button>
                <button
                  className="btn-ghost px-6 py-3"
                  onClick={() => (hud.mode === "endless" ? g()?.startEndless() : g()?.startGame())}
                >
                  Заново
                </button>
                <button className="btn-ghost px-6 py-3" onClick={() => g()?.toMenu()}>
                  В меню
                </button>
              </div>
              <div className="mt-6 border-t border-line pt-4">
                <ControlsPanel />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= GAME OVER ================= */}
      {hud.phase === "over" && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-abyss/70 p-6">
          <div className="anim-pop w-full max-w-md text-center">
            <div className="hud-label mb-2 tracking-[0.35em]">Шары уронили тебя</div>
            <h2
              className="font-display text-5xl text-coral sm:text-6xl"
              style={{ textShadow: "0 0 26px rgba(255,106,92,0.65), 0 4px 0 rgba(4,18,26,0.9)" }}
            >
              ИГРА ОКОНЧЕНА
            </h2>
            {hud.newRecord && (
              <div className="anim-banner mx-auto mt-4 inline-block border border-gold bg-gold/15 px-4 py-1.5 font-display text-sm tracking-widest text-gold">
                НОВЫЙ РЕКОРД!
              </div>
            )}
            {hud.mode === "endless" && (
              <div className="mt-4 font-display text-sm tracking-wider text-cyan-neon">
                ДОСТИГНУТА ВОЛНА {hud.wave}
              </div>
            )}
            <div className="mt-6 flex justify-center gap-3">
              <div className="hud-chip px-6 py-3">
                <div className="hud-label">Счёт</div>
                <div className="font-display text-3xl text-foam tabular-nums">
                  {hud.score.toLocaleString("ru-RU")}
                </div>
              </div>
              <div className="hud-chip px-6 py-3">
                <div className="hud-label">Рекорд</div>
                <div className="font-display text-3xl text-gold tabular-nums">
                  {hud.best.toLocaleString("ru-RU")}
                </div>
              </div>
            </div>
            {hud.mode === "endless" && hud.topEndless.length > 0 && (
              <div className="hud-chip mx-auto mt-4 max-w-xs p-3 text-left">
                <div className="hud-label mb-2">Лучшие результаты</div>
                {hud.topEndless.map((s, i) => (
                  <div key={`eo-${s}-${i}`} className="flex justify-between font-display text-xs text-foam/85">
                    <span className={i === 0 ? "text-gold" : "text-dim"}>{i + 1}.</span>
                    <span className="tabular-nums">{s.toLocaleString("ru-RU")}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <button
                className="btn-arcade px-8 py-3.5 text-lg"
                onClick={() => (hud.mode === "endless" ? g()?.startEndless() : g()?.startGame())}
              >
                Ещё раз
              </button>
              <button className="btn-ghost px-6 py-3.5" onClick={() => g()?.toMenu()}>
                В меню
              </button>
            </div>
            <div className="mt-4 text-xs text-dim">
              или жми <Key wide>ПРОБЕЛ</Key>
            </div>
          </div>
        </div>
      )}

      {/* ================= WIN ================= */}
      {hud.phase === "won" && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-6">
          <div className="anim-pop w-full max-w-md text-center">
            <div className="hud-label mb-2 tracking-[0.35em]">Царь-шар повержен</div>
            <h2
              className="font-display text-6xl text-mint sm:text-7xl"
              style={{ textShadow: "0 0 30px rgba(93,255,176,0.7), 0 4px 0 rgba(4,18,26,0.9)" }}
            >
              ПОБЕДА!
            </h2>
            <div className="mx-auto mt-5 flex justify-center gap-2">
              {["#35e0ff", "#5dffb0", "#ffc94d", "#ff6a5c", "#ff5ca8"].map((c) => (
                <IconBall key={c} color={c} className="anim-bob h-8 w-8" />
              ))}
            </div>
            {hud.newRecord && (
              <div className="anim-banner mx-auto mt-4 inline-block border border-gold bg-gold/15 px-4 py-1.5 font-display text-sm tracking-widest text-gold">
                НОВЫЙ РЕКОРД!
              </div>
            )}
            <div className="mt-6 flex justify-center gap-3">
              <div className="hud-chip px-6 py-3">
                <div className="hud-label">Счёт</div>
                <div className="font-display text-3xl text-foam tabular-nums">
                  {hud.score.toLocaleString("ru-RU")}
                </div>
              </div>
              <div className="hud-chip px-6 py-3">
                <div className="hud-label">Рекорд</div>
                <div className="font-display text-3xl text-gold tabular-nums">
                  {hud.best.toLocaleString("ru-RU")}
                </div>
              </div>
            </div>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <button className="btn-arcade px-8 py-3.5 text-lg" onClick={() => g()?.startGame()}>
                Сыграть снова
              </button>
              <button className="btn-ghost px-6 py-3.5" onClick={() => g()?.toMenu()}>
                В меню
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
