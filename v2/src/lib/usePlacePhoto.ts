/**
 * Live Google photo for a place, under the daily media budget. Shared by every
 * card that shows a room (discovery + friend feed) so the budget accounting and
 * the ToS posture (ref lookup free-tier, media never cached, attributed) live
 * in one place.
 */
import { useEffect, useState } from 'react'
import { getPhotoRef, photoUrl, placesEnabled } from './places'
import { takePhotoSlot } from './photoBudget'
import { rawPid } from '../data/types'

export function usePlacePhoto(placeId: string): { src?: string; credit?: string } {
  const [photo, setPhoto] = useState<{ src: string; credit?: string } | null>(null)
  useEffect(() => {
    let live = true
    if (!placesEnabled || !takePhotoSlot(placeId)) return
    void getPhotoRef(rawPid(placeId)).then(ref => {
      if (!live || !ref?.photoResourceName) return
      const src = photoUrl(ref.photoResourceName, 640)
      if (src) setPhoto({ src, credit: ref.photoAttribution })
    })
    return () => { live = false }
  }, [placeId])
  return photo ?? {}
}
