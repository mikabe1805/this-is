/** A persistent truth label for the separately configured family dogfood app. */
export function ReleaseChannelMark() {
  if (import.meta.env.VITE_RELEASE_CHANNEL !== 'family-alpha') return null
  return (
    <div className="release-channel-mark eyebrow" role="status">
      FAMILY ALPHA · PRIVATE DOGFOOD
    </div>
  )
}

