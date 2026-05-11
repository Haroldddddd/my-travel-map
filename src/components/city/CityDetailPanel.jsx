import { useState, useEffect, useRef } from 'react'
import { getPhotosByCityId } from '../../services/photoDB.js'

const IconX = ({ size = 10 }) => (
  <svg width={size} height={size} viewBox="0 0 10 10" fill="none">
    <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

export default function CityDetailPanel({ city, onClose, onDelete, onUpload, onNoteChange, onPhotoDelete, onVisitDelete, refreshKey }) {
  const [photos, setPhotos] = useState([]) // { id, url }[]
  const [lightbox, setLightbox] = useState(null)
  const [editingNote, setEditingNote] = useState(false)
  const [noteInput, setNoteInput] = useState('')
  const noteInputRef = useRef(null)

  useEffect(() => {
    if (!city) { setEditingNote(false); setPhotos([]); return }
    setNoteInput(city.note || '')
    setEditingNote(false)
  }, [city?.id])

  useEffect(() => {
    if (editingNote) noteInputRef.current?.focus()
  }, [editingNote])

  function saveNote() {
    const trimmed = noteInput.trim()
    onNoteChange?.(city.id, trimmed)
    setEditingNote(false)
  }

  function handleNoteKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); saveNote() }
    if (e.key === 'Escape') { setNoteInput(city.note || ''); setEditingNote(false) }
  }

  useEffect(() => {
    if (!city) { setPhotos([]); return }
    let blobUrls = []
    getPhotosByCityId(city.id, city).then(items => {
      const mapped = items.map(p => {
        if (p.thumbnailBlob) {
          const u = URL.createObjectURL(p.thumbnailBlob)
          blobUrls.push(u)
          return { id: p.id, url: u }
        }
        return { id: p.id, url: p.url }
      })
      setPhotos(mapped)
    })
    return () => blobUrls.forEach(u => URL.revokeObjectURL(u))
  }, [city?.id, refreshKey])

  function handleDelete() {
    if (window.confirm(`确认删除「${city.name}」的足迹记录？`)) {
      onDelete(city.id)
      onClose()
    }
  }

  const visitCount = city?.visits?.length ?? 0
  const regionLabel = city?.domestic ? city?.province : city?.country

  return (
    <>
      <div className={`city-panel ${city ? 'open' : ''}`}>
        {city && (
          <>
            <div className="panel-header">
              <div className="panel-header-info">
                <div className="panel-city-name">{city.name}</div>
                <div className="panel-city-meta">
                  {regionLabel}
                  {city.firstVisit && ` · ${city.firstVisit.slice(0, 7).replace('-', '年').replace('-', '月')}`}
                </div>
              </div>
              <button className="panel-close" onClick={onClose}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            <div className="panel-body">
              <div className="panel-stats-row">
                <div className="panel-stat">
                  <span className="panel-stat-value">{visitCount}</span>
                  <span className="panel-stat-label">次到访</span>
                </div>
                <div className="panel-stat-divider" />
                <div className="panel-stat">
                  <span className="panel-stat-value">{photos.length}</span>
                  <span className="panel-stat-label">张照片</span>
                </div>
                <div className="panel-stat-divider" />
                <div className="panel-stat">
                  <span className="panel-stat-value" style={{ fontFamily: 'var(--font-hand)', fontSize: 15 }}>
                    {city.firstVisit?.slice(0, 7)}
                  </span>
                  <span className="panel-stat-label">首次到访</span>
                </div>
              </div>

              {editingNote ? (
                <div className="panel-note-edit">
                  <input
                    ref={noteInputRef}
                    className="panel-note-input"
                    value={noteInput}
                    maxLength={80}
                    placeholder="写下对这座城市的印象…"
                    onChange={e => setNoteInput(e.target.value)}
                    onKeyDown={handleNoteKeyDown}
                    onBlur={saveNote}
                  />
                </div>
              ) : (
                <div className="panel-note-row" onClick={() => setEditingNote(true)}>
                  <span className="panel-note">
                    {city.note ? `"${city.note}"` : <span className="panel-note-placeholder">添加一句话印象…</span>}
                  </span>
                  <svg className="panel-note-edit-icon" width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M8.5 1.5l2 2L3 11H1V9L8.5 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}

              {city.visits?.length > 0 && (() => {
                const seen = new Set()
                const unique = city.visits.filter(v => {
                  const key = `${v.startDate}|${v.endDate || v.startDate}`
                  if (seen.has(key)) return false
                  seen.add(key)
                  return true
                })
                return (
                  <>
                    <div className="panel-section-label">到访记录</div>
                    <div className="panel-visits">
                      {unique.map((v, i) => {
                        const visitKey = `${v.startDate}|${v.endDate || v.startDate}`
                        return (
                          <div key={i} className="panel-visit-row">
                            <span className="panel-visit-date">
                              {v.startDate}
                              {v.endDate && v.endDate !== v.startDate && ` — ${v.endDate}`}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {v.photoCount > 0 && (
                                <span className="panel-visit-count">{v.photoCount} 张</span>
                              )}
                              <button
                                className="visit-del-btn"
                                title="删除该记录"
                                onClick={() => onVisitDelete(city.id, visitKey)}
                              >
                                <IconX />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )
              })()}

              <div className="panel-section-label">照片</div>
              {photos.length > 0 ? (
                <div className="photo-grid">
                  {photos.map((photo) => (
                    <div key={photo.id} className="photo-cell" onClick={() => setLightbox(photo.url)}>
                      <img src={photo.url} alt="" />
                      <button
                        className="photo-del-btn"
                        title="删除照片"
                        onClick={e => { e.stopPropagation(); onPhotoDelete(city.id, photo.id) }}
                      >
                        <IconX size={8} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="photo-empty">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <rect x="3" y="7" width="26" height="20" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                    <circle cx="16" cy="17" r="5" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M11 7V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                  <span>上传照片后将在此显示</span>
                </div>
              )}
            </div>

            <div className="panel-footer">
              <button className="panel-upload-btn" onClick={() => onUpload(city)}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{marginRight:5}}>
                  <path d="M7 9V3M4 6l3-3 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 11h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                上传照片
              </button>
              <button className="panel-delete-btn" onClick={handleDelete}>删除</button>
            </div>
          </>
        )}
      </div>

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="lightbox-img" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </>
  )
}
