/**
 * User photos — the long-term escape from the Google photo budget. Your photo
 * becomes the pin's cover: uploaded to Storage under pin-photos/{uid}/, the
 * download URL written onto the pin, rendered by every card from then on.
 *
 * firebase/storage is imported dynamically so it only loads when someone
 * actually adds a photo.
 */
import { doc, getDoc, writeBatch } from 'firebase/firestore'
import { db } from '../lib/firebaseImpl'
import { requireUid } from '../state/session'
import type { Pin } from './types'

const MAX_EDGE = 1600
const JPEG_QUALITY = 0.85

/** Downscale to a sane web size client-side; phones hand us 3–8MB originals. */
async function shrink(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && file.size < 1_500_000) return file
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, w, h)
    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
    )
    return blob ?? file
  } catch {
    // HEIC or anything the browser can't decode — upload as-is (≤8MB rule).
    return file
  }
}

export async function uploadPinPhoto(pinId: string, file: File): Promise<string> {
  const uid = requireUid()
  const [{ getStorage, ref, uploadBytes, getDownloadURL }, { default: app }] =
    await Promise.all([import('firebase/storage'), import('../lib/firebaseImpl')])
  const blob = await shrink(file)
  const storageRef = ref(getStorage(app), `pin-photos/${uid}/${pinId}-${Date.now()}.jpg`)
  await uploadBytes(storageRef, blob, { contentType: blob.type || 'image/jpeg' })
  const url = await getDownloadURL(storageRef)

  const pinRef = doc(db, 'users', uid, 'pins', pinId)
  const snap = await getDoc(pinRef)
  if (snap.exists()) {
    const pin = snap.data() as Omit<Pin, 'id'>
    await writeBatch(db)
      .set(pinRef, { ...pin, userPhotoPath: url, lastTouchedAt: Date.now() })
      .commit()
  }
  return url
}
