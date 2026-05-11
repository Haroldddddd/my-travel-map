import { useCallback } from 'react'
import exifr from 'exifr'

async function createThumbnail(file, maxWidth = 400) {
  let imageFile = file

  // HEIC fallback: try heic2any if available
  if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
    try {
      const heic2any = (await import('heic2any')).default
      const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.8 })
      imageFile = Array.isArray(blob) ? blob[0] : blob
    } catch {
      return null
    }
  }

  try {
    const bitmap = await createImageBitmap(imageFile)
    const scale = Math.min(1, maxWidth / bitmap.width)
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)
    const canvas = new OffscreenCanvas(w, h)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()
    return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.75 })
  } catch {
    return null
  }
}

async function processFile(file) {
  // Create thumbnail regardless of whether GPS exists
  const thumbnail = await createThumbnail(file)
  if (!thumbnail) return null  // unreadable file

  try {
    const exif = await exifr.parse(file, {
      gps: true,
      tiff: true,
      ifd0: ['DateTimeOriginal', 'CreateDate'],
    })
    return {
      file,
      lat: exif?.latitude ?? null,
      lng: exif?.longitude ?? null,
      date: exif?.DateTimeOriginal || exif?.CreateDate || new Date(),
      thumbnail,
    }
  } catch {
    // EXIF parse failed — keep the photo, just no metadata
    return { file, lat: null, lng: null, date: new Date(), thumbnail }
  }
}

export function useExifExtract() {
  const processFiles = useCallback(async (files) => {
    const settled = await Promise.all(Array.from(files).map(processFile))
    return settled.filter(Boolean)
  }, [])

  return { processFiles }
}
