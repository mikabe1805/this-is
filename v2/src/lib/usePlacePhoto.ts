import { useEffect, useState } from 'react'
import { budgetedPhotosEnabled, fetchSavedPlacePhoto } from '../data/groupPhotos'
import { takePhotoSlot } from './photoBudget'
import { isPairPrototype } from './prototypeMode'

/** Live, uncached imagery for one canonical personal save. The client flag and
 * local slot are only rendering brakes; the authenticated server owns the
 * project allowance, authorization, Google key, and attribution response. */
export function usePlacePhoto(
  placeId: string,
  visible = true,
): { src?: string; credit?: string; sourceUri?: string } {
  const [photo, setPhoto] = useState<{ src: string; credit?: string; sourceUri?: string } | null>(null)
  useEffect(() => {
    let live = true
    let objectUrl: string | undefined
    const controller = new AbortController()
    setPhoto(null)
    if (!visible || !placeId.startsWith('g:') || !budgetedPhotosEnabled
      || isPairPrototype() || !takePhotoSlot(placeId)) return
    void fetchSavedPlacePhoto(placeId, controller.signal).then(result => {
      if (!result) return
      objectUrl = URL.createObjectURL(result.blob)
      if (!live) {
        URL.revokeObjectURL(objectUrl)
        return
      }
      setPhoto({ src: objectUrl, credit: result.attribution, sourceUri: result.sourceUri })
    }).catch(() => {
      if (live) setPhoto(null)
    })
    return () => {
      live = false
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [placeId, visible])
  return photo ?? {}
}
