/**
 * THE HANG (morning-after). The next open after a GO, one card at the top of
 * Home: "LAST NIGHT — Bar Nera, 21:40." → Hang it (marks Been, fires the
 * picture-light) or Didn't go (guilt-free dismiss). Closing the loop is the
 * whole product thesis; this is the surface that converts a Want into a Been.
 */
import { useMemo, useState } from 'react'
import type { Pin } from '../data/types'
import { pendingMorningAfter, dismissGo, type GoEvent } from '../lib/goEvents'
import { useSaveFlow } from '../data/queries'
import { haptics } from '../lib/haptics'

function whenLabel(at: number): string {
  const d = new Date(at)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return sameDay ? `EARLIER · ${hh}:${mm}` : `LAST NIGHT · ${hh}:${mm}`
}

export function MorningAfterCard({ pins }: { pins: Pin[] }) {
  const { setStatus } = useSaveFlow()
  // Snapshot the pending GO once per mount so acting on it (which mutates the
  // pin out of "want") doesn't reselect a different card underfoot.
  const initial = useMemo(() => pendingMorningAfter(pins), [])
  const [event, setEvent] = useState<GoEvent | null>(initial)
  if (!event) return null

  const hang = () => {
    haptics.success()
    setStatus.mutate({ pinId: event.placeId, status: 'been' })
    dismissGo(event.placeId)
    setEvent(null)
  }

  const didnt = () => {
    haptics.tap()
    dismissGo(event.placeId)
    setEvent(null)
  }

  return (
    <section className="morning-after">
      <p className="eyebrow">{whenLabel(event.at)}</p>
      <h2 className="t-title morning-after-q">Did you make it to {event.name}?</h2>
      <div className="morning-after-actions">
        <button className="pill pill-primary press" onClick={hang}>Hang it</button>
        <button className="pill pill-ghost press" onClick={didnt}>Didn’t go</button>
      </div>
    </section>
  )
}
