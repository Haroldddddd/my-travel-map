import { useState, useRef, useEffect } from 'react'
import * as github from '../../services/github.js'

const CUR_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: CUR_YEAR - 1989 }, (_, i) => CUR_YEAR - i)
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

function daysInMonth(y, m) {
  if (!y || !m) return 31
  return new Date(Number(y), Number(m), 0).getDate()
}

function DateSelectInput({ value, onChange }) {
  const nativeRef = useRef(null)
  const [y, setY] = useState(value?.slice(0, 4) || '')
  const [m, setM] = useState(value?.slice(5, 7) || '')
  const [d, setD] = useState(value?.slice(8, 10) || '')

  // Sync inward when parent sets value (EXIF auto-fill, native picker)
  useEffect(() => {
    setY(value?.slice(0, 4) || '')
    setM(value?.slice(5, 7) || '')
    setD(value?.slice(8, 10) || '')
  }, [value])

  function notify(ny, nm, nd) {
    if (!ny || !nm || !nd) return
    const safe = Math.min(Number(nd), daysInMonth(ny, nm))
    onChange(`${ny}-${nm}-${String(safe).padStart(2, '0')}`)
  }

  function changeY(v) { setY(v); notify(v, m, d) }
  function changeM(v) { setM(v); notify(y, v, d) }
  function changeD(v) { setD(v); notify(y, m, v) }

  const days = Array.from({ length: daysInMonth(y, m) }, (_, i) => i + 1)

  return (
    <div className="date-select-wrap">
      <select className="date-select" value={y} onChange={e => changeY(e.target.value)}>
        <option value="">年</option>
        {YEARS.map(yr => <option key={yr} value={String(yr)}>{yr}</option>)}
      </select>
      <select className="date-select" value={m} onChange={e => changeM(e.target.value)}>
        <option value="">月</option>
        {MONTHS.map(mo => <option key={mo} value={String(mo).padStart(2, '0')}>{mo}月</option>)}
      </select>
      <select className="date-select" value={d} onChange={e => changeD(e.target.value)}>
        <option value="">日</option>
        {days.map(dy => <option key={dy} value={String(dy).padStart(2, '0')}>{dy}日</option>)}
      </select>
      <button
        type="button"
        className="date-cal-btn"
        title="日历选择"
        onClick={() => nativeRef.current?.showPicker?.() || nativeRef.current?.click()}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="2.5" width="12" height="10.5" rx="2" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M4 1v3M10 1v3M1 6h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        <input
          ref={nativeRef}
          type="date"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
          tabIndex={-1}
        />
      </button>
    </div>
  )
}
import { v4 as uuidv4 } from 'uuid'
import { useExifExtract } from '../../hooks/useExifExtract.js'
import { geocodeCoords } from '../../services/geocoder.js'
import * as photoDB from '../../services/photoDB.js'
import * as storage from '../../services/storage.js'
import CitySearchInput from './CitySearchInput.jsx'

const COLORS = ['#f9c0c0', '#f9e0b0', '#c9e6c6', '#b8d8f0', '#d8c8f0', '#f0c8d8', '#e8e4db', '#c8e0e0']

function formatDate(d) {
  if (!d) return ''
  const dt = d instanceof Date ? d : new Date(d)
  if (isNaN(dt)) return ''
  return dt.toISOString().slice(0, 10)
}

const IconClose = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

const IconUpload = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M12 16V8M8 12l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.2"/>
  </svg>
)

export default function RecordModal({ cities, onSave, onClose, editCity = null }) {
  const { processFiles } = useExifExtract()

  const [photos, setPhotos] = useState([])
  const [city, setCity] = useState(editCity ? {
    name: editCity.name, country: editCity.country,
    province: editCity.province, lat: editCity.lat,
    lng: editCity.lng, domestic: editCity.domestic,
  } : null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [note, setNote] = useState('')
  const [color, setColor] = useState(COLORS[Math.floor(Math.random() * COLORS.length)])
  const [dragging, setDragging] = useState(false)
  const [gpsHint, setGpsHint] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  async function handleFiles(files) {
    if (!files?.length) return
    setGpsHint('正在读取照片…')
    const extracted = await processFiles(files)
    if (!extracted.length) {
      setGpsHint('无法读取照片，请确认文件格式为 JPG / HEIC')
      return
    }

    const newPhotos = extracted.map(e => ({
      id: uuidv4(),
      file: e.file,
      thumbnail: e.thumbnail,
      lat: e.lat,
      lng: e.lng,
      date: e.date,
      previewUrl: e.thumbnail ? URL.createObjectURL(e.thumbnail) : null,
    }))
    setPhotos(prev => [...prev, ...newPhotos])

    // Date range from EXIF timestamps
    const allPhotos = [...photos, ...newPhotos]
    const dates = allPhotos.map(p => p.date).filter(Boolean).sort((a, b) => new Date(a) - new Date(b))
    if (dates.length) {
      setStartDate(prev => prev || formatDate(dates[0]))
      setEndDate(prev => prev || formatDate(dates[dates.length - 1]))
    }

    // Reverse geocode first photo with GPS (skip if city is locked via editCity)
    const withGps = newPhotos.find(p => p.lat && p.lng)
    if (withGps && !city && !editCity) {
      setGpsHint('正在识别位置…')
      try {
        const geo = await geocodeCoords(withGps.lat, withGps.lng)
        const domestic = geo.countryCode === 'CN'
        setCity({
          name: geo.city,
          country: geo.country,
          province: domestic ? (geo.province || null) : null,
          lat: withGps.lat,
          lng: withGps.lng,
          domestic,
        })
        setGpsHint(`GPS 已识别：${geo.city}，${formatDate(withGps.date)}`)
      } catch {
        setGpsHint('位置识别失败，请手动搜索城市')
      }
    } else if (!withGps) {
      setGpsHint(`已添加 ${newPhotos.length} 张照片，未发现 GPS 信息，请手动搜索城市`)
    } else {
      setGpsHint(`已添加 ${newPhotos.length} 张照片`)
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  function removePhoto(id) {
    setPhotos(prev => {
      const target = prev.find(p => p.id === id)
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
      return prev.filter(p => p.id !== id)
    })
  }

  async function handleSave() {
    if (!city) { setError('请选择城市'); return }
    if (!editCity && !startDate) { setError('请填写到访日期'); return }
    setError('')
    setSaving(true)

    try {
      // Find or create city
      const existing = editCity
        ? cities.find(c => c.id === editCity.id)
        : cities.find(c => c.name === city.name && c.country === city.country)

      // Generate city ID upfront so photos are stored under the correct key
      const cityId = existing?.id || uuidv4()

      // Only append a visit record when a date is provided
      const visit = startDate
        ? { startDate, endDate: endDate || startDate, photoCount: photos.length }
        : null

      // Upload photos first to get IDs
      const newPhotoIds = []
      await Promise.all(photos.map(async p => {
        if (!p.thumbnail) return
        await photoDB.savePhoto({
          id: p.id,
          cityId,
          date: p.date || new Date(),
          thumbnailBlob: p.thumbnail,
          originalFilename: p.file?.name || '',
        })
        newPhotoIds.push(p.id)
      }))

      let savedCity
      if (existing) {
        savedCity = {
          ...existing,
          visits: visit ? [...(existing.visits || []), visit] : (existing.visits || []),
          firstVisit: visit
            ? [existing.firstVisit, startDate].filter(Boolean).sort()[0]
            : existing.firstVisit,
          note: note || existing.note,
          photos: [...(existing.photos || []), ...newPhotoIds],
        }
        const updated = storage.updateCity(savedCity)
        if (github.isConfigured()) await github.saveCities(updated)
      } else {
        savedCity = {
          id: cityId,
          name: city.name,
          country: city.country,
          province: city.province || null,
          lat: city.lat,
          lng: city.lng,
          domestic: city.domestic,
          firstVisit: startDate,
          note,
          color,
          visits: [visit],
          photos: newPhotoIds,
        }
        const updated = storage.addCity(savedCity)
        if (github.isConfigured()) await github.saveCities(updated)
      }

      // Cleanup object URLs
      photos.forEach(p => { if (p.previewUrl) URL.revokeObjectURL(p.previewUrl) })

      onSave(savedCity)
    } catch (e) {
      setError('保存失败：' + e.message)
    } finally {
      setSaving(false)
    }
  }

  function handleClose() {
    photos.forEach(p => { if (p.previewUrl) URL.revokeObjectURL(p.previewUrl) })
    onClose()
  }

  return (
    <div className="record-overlay" onClick={handleClose}>
      <div className="record-modal" onClick={e => e.stopPropagation()}>

        <div className="record-header">
          <span className="record-title">{editCity ? `继续记录 · ${editCity.name}` : '记录新地点'}</span>
          <button className="record-close" onClick={handleClose}><IconClose /></button>
        </div>

        <div className="record-body">
          {/* Photo upload */}
          <div className="form-section">
            <label className="form-label">照片（可选）</label>
            <div
              className={`upload-zone ${dragging ? 'dragging' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <IconUpload />
              <span>拖拽或点击上传 · JPG / HEIC</span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple accept="image/jpeg,image/heic,.heic,.jpg,.jpeg"
              style={{ display: 'none' }}
              onChange={e => handleFiles(e.target.files)}
            />
          </div>

          {photos.length > 0 && (
            <div className="upload-thumbs">
              {photos.map(p => (
                <div key={p.id} className="upload-thumb">
                  {p.previewUrl
                    ? <img src={p.previewUrl} alt="" />
                    : <div className="upload-thumb-placeholder" />}
                  <button className="upload-thumb-del" onClick={() => removePhoto(p.id)}>
                    <IconClose />
                  </button>
                </div>
              ))}
            </div>
          )}

          {gpsHint && <p className="gps-hint">{gpsHint}</p>}

          {/* City: locked when editCity, searchable when new */}
          <div className="form-section">
            <label className="form-label">城市 <span className="form-required">*</span></label>
            {editCity ? (
              <div className="form-input" style={{ color: 'var(--muted)', cursor: 'default' }}>
                {editCity.name}　{editCity.domestic ? editCity.province : editCity.country}
              </div>
            ) : (
              <CitySearchInput value={city} onChange={setCity} existingCities={cities} />
            )}
          </div>

          {/* Date range */}
          <div className="form-section">
            <label className="form-label">到访日期 <span className="form-required">*</span></label>
            <div className="date-range">
              <DateSelectInput value={startDate} onChange={setStartDate} />
              <span className="date-range-sep">—</span>
              <DateSelectInput value={endDate} onChange={setEndDate} />
            </div>
          </div>

          {/* Color picker */}
          <div className="form-section">
            <label className="form-label">标记颜色</label>
            <div className="color-picker">
              {COLORS.map(c => (
                <button
                  key={c}
                  className={`color-swatch ${color === c ? 'selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          {/* Note */}
          <div className="form-section">
            <label className="form-label">一句话印象（选填）</label>
            <input
              className="form-input"
              type="text"
              placeholder="写下对这座城市的印象…"
              value={note}
              maxLength={80}
              onChange={e => setNote(e.target.value)}
            />
          </div>

          {error && <p className="form-error">{error}</p>}
        </div>

        <div className="record-footer">
          <button className="record-btn ghost" onClick={handleClose}>取消</button>
          <button className="record-btn primary" onClick={handleSave} disabled={saving}>
            {saving ? '保存中…' : '保存到足迹'}
          </button>
        </div>
      </div>
    </div>
  )
}
