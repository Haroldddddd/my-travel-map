import { useMemo } from 'react'

const IconCamera = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="1" y="3.5" width="12" height="8.5" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
    <circle cx="7" cy="7.8" r="2.2" stroke="currentColor" strokeWidth="1.2"/>
    <path d="M4.5 3.5L5.5 2h3l1 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
  </svg>
)

function Stat({ value, label, en }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
      <span className="stat-en">{en}</span>
    </div>
  )
}

export default function Toolbar({ tab, cities, onTabSwitch, onUploadClick }) {
  const stats = useMemo(() => {
    const domestic = cities.filter(c => c.domestic)
    const international = cities.filter(c => !c.domestic)
    return {
      domesticCount: domestic.length,
      countries: new Set(international.map(c => c.country)).size,
      internationalCount: international.length,
      totalPhotos: cities.reduce((s, c) => s + c.visits.reduce((a, v) => a + (v.photoCount || 0), 0), 0),
    }
  }, [cities])

  return (
    <div className="toolbar">
      <div className="toolbar-title">
        <span className="toolbar-title-main">足迹地图</span>
        <span className="toolbar-title-sub">every step counts</span>
      </div>

      <div className="toolbar-tabs">
        <button
          className={`tab-btn ${tab === 'domestic' ? 'active' : ''}`}
          onClick={() => onTabSwitch('domestic')}
        >国内</button>
        <button
          className={`tab-btn ${tab === 'international' ? 'active' : ''}`}
          onClick={() => onTabSwitch('international')}
        >国际</button>
      </div>

      <div className="toolbar-stats">
        {tab === 'domestic' ? (
          <>
            <Stat value={11} label="国家" en="Country" />
            <Stat value={stats.domesticCount} label="城市" en="City" />
          </>
        ) : (
          <>
            <Stat value={stats.countries} label="国家" en="Country" />
            <Stat value={stats.internationalCount} label="城市" en="City" />
          </>
        )}
        <Stat value={stats.totalPhotos} label="照片" en="Photo" />
      </div>

      <div className="toolbar-actions">
        <button className="tb-btn" onClick={onUploadClick}>
          <IconCamera /> 上传照片
        </button>
      </div>
    </div>
  )
}
