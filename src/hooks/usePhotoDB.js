import { useCallback } from 'react'
import * as photoDB from '../services/photoDB.js'

export function usePhotoDB() {
  const savePhoto = useCallback((photo) => photoDB.savePhoto(photo), [])
  const getPhotosByCityId = useCallback((cityId) => photoDB.getPhotosByCityId(cityId), [])
  const deletePhotosByCityId = useCallback((cityId) => photoDB.deletePhotosByCityId(cityId), [])

  return { savePhoto, getPhotosByCityId, deletePhotosByCityId }
}
