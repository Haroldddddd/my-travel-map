import { useState, useEffect } from 'react'
import { getPhotosByCityId } from '../services/photoDB.js'

export default function CityThumb({ city, size = 36, radius = 8 }) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    let objectUrl = null
    getPhotosByCityId(city.id, city).then(photos => {
      if (photos.length > 0) {
        const p = photos[0]
        if (p.thumbnailBlob) {
          objectUrl = URL.createObjectURL(p.thumbnailBlob)
          setUrl(objectUrl)
        } else if (p.url) {
          setUrl(p.url)
        }
      }
    })
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [city.id, city.photos?.length])

  const style = {
    width: size, height: size, borderRadius: radius,
    border: '1.5px solid var(--ink)',
    flexShrink: 0, overflow: 'hidden',
    background: city.color || '#e5e3de',
  }

  return (
    <div style={style}>
      {url && (
        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      )}
    </div>
  )
}
