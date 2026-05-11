import { useState, useRef, useEffect } from 'react'
import { MOCK_CITIES } from './mockData.js'
import * as storage from './services/storage.js'
import * as github from './services/github.js'
import * as photoDB from './services/photoDB.js'
import Sidebar from './components/layout/Sidebar.jsx'
import Toolbar from './components/layout/Toolbar.jsx'
import MapSVG from './components/map/MapSVG.jsx'
import MarkerCard from './components/MarkerCard.jsx'
import CityDetailPanel from './components/city/CityDetailPanel.jsx'
import CityListView from './components/city/CityListView.jsx'
import RecordModal from './components/upload/RecordModal.jsx'
import GithubSetupModal from './components/setup/GithubSetupModal.jsx'

export default function App() {
  const [tab, setTab] = useState('domestic')
  const [activeCity, setActiveCity] = useState(null)
  const [showList, setShowList] = useState(false)
  const [showRecord, setShowRecord] = useState(false)
  const [detailCity, setDetailCity] = useState(null)
  const [uploadCity, setUploadCity] = useState(null)
  const [panelRefreshKey, setPanelRefreshKey] = useState(0)
  const [showSetup, setShowSetup] = useState(!github.isConfigured())
  const [cities, setCities] = useState(() => {
    const stored = storage.getCities()
    return stored.length > 0 ? stored : MOCK_CITIES
  })
  const zoomRef = useRef(null)

  // On mount, sync cities from GitHub then migrate any photos still in temp/
  useEffect(() => {
    if (!github.isConfigured()) return
    github.loadCities().then(remote => {
      if (!remote?.length) return
      // Merge: local cities not yet on GitHub win on conflicts by id
      const local = storage.getCities()
      const remoteById = new Map(remote.map(c => [c.id, c]))
      const localOnly = local.filter(c => !remoteById.has(c.id))
      const merged = [...remote, ...localOnly]
      setCities(merged)
      storage.saveCities(merged)
      // Push merged list back to GitHub so local-only cities are persisted
      if (localOnly.length > 0) {
        github.saveCities(merged).catch(() => {})
      }
      github.migrateTempPhotos(merged).catch(() => {})
    }).catch(() => {})
  }, [])

const visibleCities = cities.filter(c =>
    tab === 'domestic' ? c.domestic : !c.domestic
  )

  function switchTab(newTab) {
    setTab(newTab)
    setActiveCity(null)
    setShowList(false)
  }

  function handleDeleteCity(id) {
    const city = cities.find(c => c.id === id)
    photoDB.deletePhotosByCityId(id, city?.photos)
    setCities(prev => {
      const updated = prev.filter(c => c.id !== id)
      storage.saveCities(updated)
      if (github.isConfigured()) github.saveCities(updated).catch(() => {})
      return updated
    })
    setActiveCity(null)
    setDetailCity(null)
  }

  function handleAddCity(savedCity) {
    setCities(prev => {
      const exists = prev.some(c => c.id === savedCity.id)
      return exists ? prev.map(c => c.id === savedCity.id ? savedCity : c) : [...prev, savedCity]
    })
    setShowRecord(false)
    setTab(savedCity.domestic ? 'domestic' : 'international')
    setActiveCity(savedCity)
  }

  function handleNoteChange(cityId, note) {
    setCities(prev => {
      const updated = prev.map(c => c.id === cityId ? { ...c, note } : c)
      storage.saveCities(updated)
      if (github.isConfigured()) github.saveCities(updated).catch(() => {})
      return updated
    })
    setDetailCity(prev => prev?.id === cityId ? { ...prev, note } : prev)
  }

  function handleDeletePhoto(cityId, photoId) {
    photoDB.deleteSinglePhoto(cityId, photoId).catch(() => {})
    setCities(prev => {
      const updated = prev.map(c =>
        c.id !== cityId ? c : { ...c, photos: (c.photos || []).filter(id => id !== photoId) }
      )
      storage.saveCities(updated)
      if (github.isConfigured()) github.saveCities(updated).catch(() => {})
      return updated
    })
    setDetailCity(prev =>
      prev?.id !== cityId ? prev : { ...prev, photos: (prev.photos || []).filter(id => id !== photoId) }
    )
    setPanelRefreshKey(k => k + 1)
  }

  function handleDeleteVisit(cityId, visitKey) {
    setCities(prev => {
      const updated = prev.map(c => {
        if (c.id !== cityId) return c
        const visits = (c.visits || []).filter(v =>
          `${v.startDate}|${v.endDate || v.startDate}` !== visitKey
        )
        const firstVisit = visits.length > 0 ? visits.map(v => v.startDate).sort()[0] : c.firstVisit
        return { ...c, visits, firstVisit }
      })
      storage.saveCities(updated)
      if (github.isConfigured()) github.saveCities(updated).catch(() => {})
      return updated
    })
    setDetailCity(prev => {
      if (!prev || prev.id !== cityId) return prev
      const visits = (prev.visits || []).filter(v =>
        `${v.startDate}|${v.endDate || v.startDate}` !== visitKey
      )
      const firstVisit = visits.length > 0 ? visits.map(v => v.startDate).sort()[0] : prev.firstVisit
      return { ...prev, visits, firstVisit }
    })
  }

  function handleUploadSave(savedCity) {
    setCities(prev => prev.map(c => c.id === savedCity.id ? savedCity : c))
    setUploadCity(null)
    setDetailCity(savedCity)
    setPanelRefreshKey(k => k + 1)
  }

  function handleSetupComplete(remoteCities) {
    setShowSetup(false)
    if (remoteCities?.length) {
      setCities(remoteCities)
      storage.saveCities(remoteCities)
    }
  }

  function handleCityClick(city) {
    switchTab(city.domestic ? 'domestic' : 'international')
    setActiveCity(city)
  }

  return (
    <div className="app-root">
      <Sidebar
        tab={tab}
        cities={cities}
        onCityClick={handleCityClick}
        onListClick={() => setShowList(true)}
        onUploadClick={() => setShowRecord(true)}
      />

      <div className="main">
        <Toolbar
          tab={tab}
          cities={cities}
          onTabSwitch={switchTab}
          onUploadClick={() => setShowRecord(true)}
        />

        <div className="map-stage">
          <MapSVG
            tab={tab}
            cities={visibleCities}
            activeCity={activeCity}
            onCityClick={setActiveCity}
            zoomRef={zoomRef}
          />

          <div className="map-controls">
            <button className="mc-btn" title="放大" onClick={() => zoomRef.current?.zoomIn()}>+</button>
            <button className="mc-btn" title="缩小" onClick={() => zoomRef.current?.zoomOut()}>−</button>
            <div className="mc-divider" />
            <button className="mc-btn" title="复位" onClick={() => zoomRef.current?.reset()}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3"/>
                <circle cx="7" cy="7" r="1.5" fill="currentColor"/>
              </svg>
            </button>
          </div>


        </div>
      </div>

      {activeCity && (
        <MarkerCard
          city={activeCity}
          onClose={() => setActiveCity(null)}
          onDelete={handleDeleteCity}
          onViewDetail={(city) => { setActiveCity(null); setDetailCity(city) }}
        />
      )}

      <CityDetailPanel
        city={detailCity}
        onClose={() => setDetailCity(null)}
        onDelete={handleDeleteCity}
        onUpload={(city) => setUploadCity(city)}
        onNoteChange={handleNoteChange}
        onPhotoDelete={handleDeletePhoto}
        onVisitDelete={handleDeleteVisit}
        refreshKey={panelRefreshKey}
      />

      {showList && (
        <CityListView
          cities={visibleCities}
          tab={tab}
          onCityClick={(city) => { setActiveCity(city); setShowList(false) }}
          onClose={() => setShowList(false)}
        />
      )}

      {showRecord && (
        <RecordModal
          cities={cities}
          onSave={handleAddCity}
          onClose={() => setShowRecord(false)}
        />
      )}

      {uploadCity && (
        <RecordModal
          cities={cities}
          editCity={uploadCity}
          onSave={handleUploadSave}
          onClose={() => setUploadCity(null)}
        />
      )}

      {showSetup && (
        <GithubSetupModal onComplete={handleSetupComplete} />
      )}
    </div>
  )
}
