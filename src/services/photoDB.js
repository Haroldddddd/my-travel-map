import { openDB } from 'idb'
import * as github from './github.js'

const DB_NAME = 'travel-photos'
const DB_VERSION = 1

let dbPromise = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore('photos', { keyPath: 'id' })
        store.createIndex('cityId', 'cityId')
      },
    })
  }
  return dbPromise
}

export async function savePhoto({ id, cityId, date, thumbnailBlob, originalFilename }) {
  const db = await getDB()
  await db.put('photos', { id, cityId, date, thumbnailBlob, originalFilename })
  if (github.isConfigured()) {
    await github.uploadPhoto(cityId, id, thumbnailBlob)
  }
  return { id, cityId, date, thumbnailBlob, originalFilename }
}

// Look up each photo by ID from IndexedDB; fall back to GitHub URL if not cached locally.
export async function getPhotosByCityId(cityId, city) {
  const photoIds = city?.photos || []
  if (photoIds.length === 0) return []

  const db = await getDB()
  const photos = await Promise.all(photoIds.map(async id => {
    const local = await db.get('photos', id)
    if (local?.thumbnailBlob) return local
    if (github.isConfigured()) {
      return { id, cityId, url: github.getPhotoUrl(cityId, id) }
    }
    return null
  }))
  return photos.filter(Boolean)
}

export async function deletePhotosByCityId(cityId, photoIds) {
  if (github.isConfigured()) {
    await Promise.all((photoIds || []).map(id => github.deletePhoto(cityId, id).catch(() => {})))
  }
  const db = await getDB()
  const tx = db.transaction('photos', 'readwrite')
  for (const id of (photoIds || [])) {
    await tx.store.delete(id)
  }
  await tx.done
}

export async function deleteSinglePhoto(cityId, photoId) {
  const db = await getDB()
  await db.delete('photos', photoId)
  if (github.isConfigured()) {
    await github.deletePhoto(cityId, photoId).catch(() => {})
  }
}
