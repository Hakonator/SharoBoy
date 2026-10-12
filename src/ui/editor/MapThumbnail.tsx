import type { PlayerMapSpec } from "../../game/mapSpec"

export interface MapThumbnailProps {
  spec: PlayerMapSpec
  className?: string
  alt?: string
}

export function MapThumbnail({ spec, className = "", alt = "Миниатюра карты" }: MapThumbnailProps) {
  const blocks = spec?.blocks ?? []

  return (
    <div
      aria-label={alt}
      className={`relative aspect-video select-none overflow-hidden rounded-lg border border-line bg-abyss/90 ${className}`}
      role="img"
    >
      {blocks.map((block) => {
        const width = Math.max(1.5, (block.size.width / 1920) * 100)
        const height = Math.max(1.5, (block.size.height / 1080) * 100)
        const left = (block.position.x / 1920) * 100
        const top = (block.position.y / 1080) * 100
        const isCircle = block.shape === "circle"
        const colorClass =
          block.hp >= 3
            ? "border-gold/80 bg-gold/35"
            : block.hp === 2
              ? "border-mint/80 bg-mint/35"
              : "border-cyan-neon/80 bg-cyan-neon/35"

        return (
          <span
            className={`pointer-events-none absolute border ${colorClass} ${
              isCircle ? "rounded-full" : "rounded-[35%]"
            }`}
            key={block.id}
            style={{
              height: `${height}%`,
              left: `${left}%`,
              top: `${top}%`,
              transform: `translate(-50%, -50%) rotate(${block.rotation ?? 0}deg)`,
              width: `${width}%`,
            }}
          />
        )
      })}
      {blocks.length === 0 && (
        <span className="flex h-full w-full items-center justify-center text-[10px] text-dim">
          Пусто
        </span>
      )}
    </div>
  )
}
