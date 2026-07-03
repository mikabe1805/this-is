/** A friend avatar — an initial in a colored disc (no external image calls). */
export function Avatar({ name, hex, size = 34 }: { name: string; hex: string; size?: number }) {
  const initial = name.trim()[0]?.toUpperCase() ?? '·'
  return (
    <span
      className="avatar-initial"
      style={{
        background: hex,
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
      }}
      aria-hidden
    >
      {initial}
    </span>
  )
}
