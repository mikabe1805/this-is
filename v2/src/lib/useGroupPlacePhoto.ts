import { useEffect, useState } from 'react'
import { fetchGroupPhoto, groupPhotosEnabled } from '../data/groupPhotos'
import { isPairPrototype } from './prototypeMode'
import { takePhotoSlot } from './photoBudget'

export interface RenderedGroupPhoto {
  src?: string
  attribution?: string
  sourceUri?: string
}

export function useGroupPlacePhoto(
  groupId: string,
  placeId: string,
  visible: boolean,
): RenderedGroupPhoto {
  const [photo, setPhoto] = useState<RenderedGroupPhoto>({})
  useEffect(() => {
    let live = true
    let objectUrl: string | undefined
    const controller = new AbortController()
    setPhoto({})
    if (!visible || !groupPhotosEnabled || isPairPrototype() || !takePhotoSlot(placeId)) return
    void fetchGroupPhoto(groupId, placeId, controller.signal).then(result => {
      if (!result) return
      objectUrl = URL.createObjectURL(result.blob)
      if (!live) {
        URL.revokeObjectURL(objectUrl)
        return
      }
      setPhoto({ src: objectUrl, attribution: result.attribution, sourceUri: result.sourceUri })
    }).catch(() => {
      if (live) setPhoto({})
    })
    return () => {
      live = false
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [groupId, placeId, visible])
  return photo
}
