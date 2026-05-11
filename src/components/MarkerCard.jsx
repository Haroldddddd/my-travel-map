import { useState, useEffect } from 'react'
import { getPhotosByCityId } from '../services/photoDB.js'

export default function MarkerCard({ city, onClose, onDelete, onViewDetail }) {
  const [thumbUrls, setThumbUrls] = useState([])

  useEffect(() => {
    if (!city) return
    let blobUrls = []
    getPhotosByCityId(city.id, city).then(photos => {
      const urls = photos.slice(0, 4).map(p => {
        if (p.thumbnailBlob) {
          const u = URL.createObjectURL(p.thumbnailBlob)
          blobUrls.push(u)
          return u
        }
        return p.url
      })
      setThumbUrls(urls)
    })
    return () => blobUrls.forEach(u => URL.revokeObjectURL(u))
  }, [city?.id])

  if (!city) return null
  const photoCount = city.visits?.reduce((s, v) => s + (v.photoCount || 0), 0) ?? 0
  const regionLabel = city.domestic ? city.province : city.country

  function handleDelete() {
    if (window.confirm(`确认删除「${city.name}」的足迹记录？`)) {
      onDelete(city.id)
    }
  }

  return (
    <div className="marker-card-wrap" onClick={onClose}>
      <div className="marker-card" onClick={e => e.stopPropagation()}>
        <button className="card-close" onClick={onClose}>✕</button>

        <div className="card-thumb" style={{ background: city.color || '#e8e4db' }}>
          {thumbUrls.length > 0 ? (
            <div className="card-thumb-photos" style={{
              gridTemplateColumns: thumbUrls.length === 1 ? '1fr' : 'repeat(2, 1fr)',
              gridTemplateRows: thumbUrls.length <= 2 ? '1fr' : 'repeat(2, 1fr)',
            }}>
              {thumbUrls.map((url, i) => (
                <img key={i} src={url} alt="" className="card-thumb-photo" />
              ))}
            </div>
          ) : (
            <span style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 44,
              fontWeight: 700,
              color: 'rgba(26,26,26,0.22)',
              lineHeight: 1,
              letterSpacing: '-1px',
              userSelect: 'none',
            }}>
              {city.name.slice(0, 2)}
            </span>
          )}
          <span className="card-thumb-tag">{regionLabel}</span>
        </div>

        <div className="card-body">
          <div className="card-title-row">
            <span className="card-title">{city.name}</span>
            <span className="card-date">{city.firstVisit?.slice(0, 7)}</span>
          </div>

          {city.note && <p className="card-note">"{city.note}"</p>}

          <div className="card-stats">
            <span>{city.visits?.length ?? 0} 次到访</span>
            <span className="card-dot" />
            <span>{photoCount} 张照片</span>
            <span className="card-dot" />
            <span>首次 {city.firstVisit}</span>
          </div>

          <div className="card-actions">
            <button className="card-action primary" onClick={() => onViewDetail(city)}>查看详情</button>
            <button className="card-action ghost" onClick={handleDelete}
              style={{ color: '#e05252', borderColor: '#e05252' }}>
              删除地点
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
