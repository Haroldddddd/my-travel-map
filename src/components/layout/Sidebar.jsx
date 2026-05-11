// SVG icons — no emoji
const IconMap = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M2 3.5L6 2l4 2 4-1.5v9L10 13 6 11 2 12.5V3.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
    <circle cx="6" cy="6.5" r="1.2" fill="currentColor"/>
  </svg>
)

const IconList = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <line x1="5" y1="5" x2="13" y2="5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <line x1="5" y1="8" x2="13" y2="8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <line x1="5" y1="11" x2="13" y2="11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <circle cx="3" cy="5" r="0.8" fill="currentColor"/>
    <circle cx="3" cy="8" r="0.8" fill="currentColor"/>
    <circle cx="3" cy="11" r="0.8" fill="currentColor"/>
  </svg>
)

const IconSearch = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.3"/>
    <line x1="9.2" y1="9.2" x2="12.5" y2="12.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
)

import CityThumb from '../CityThumb.jsx'

export default function Sidebar({ tab, cities, onCityClick, onListClick, onUploadClick }) {
  function lastVisit(city) {
    if (city.visits?.length) {
      return city.visits.reduce((max, v) => (v.startDate > max ? v.startDate : max), '')
    }
    return city.firstVisit || ''
  }

  const recent = [...cities]
    .sort((a, b) => lastVisit(b).localeCompare(lastVisit(a)))
    .slice(0, 6)

  return (
    <aside className="sidebar">
      <div className="brand">
        <img src="/logo.jpg" alt="足迹" className="brand-logo" />
        <div className="brand-sub">MY PRIVATE MAP</div>
      </div>

      <div className="search-bar">
        <span className="search-bar-icon"><IconSearch /></span>
        <input type="text" placeholder="搜索城市…" />
      </div>

      <nav className="nav-section">
        <button className="nav-btn active">
          <span className="nav-icon"><IconMap /></span>
          <span className="nav-label">足迹地图</span>
          <span className="nav-en">Map</span>
        </button>
        <button className="nav-btn" onClick={onListClick}>
          <span className="nav-icon"><IconList /></span>
          <span className="nav-label">城市列表</span>
          <span className="nav-en">List</span>
        </button>
      </nav>

      <div className="sidebar-section">
        <div className="section-head">
          <span className="section-head-title">最近到访</span>
          <span className="section-count">{cities.length} 个城市</span>
        </div>
        <div className="recent-list">
          {recent.map(city => (
            <button key={city.id} className="recent-item" onClick={() => onCityClick(city)}>
              <CityThumb city={city} />
              <div className="recent-meta">
                <div className="recent-place">{city.name}</div>
                <div className="recent-note">{city.note || (city.domestic ? city.province : city.country)}</div>
              </div>
              <span className="recent-date">{city.firstVisit?.slice(0, 7)}</span>
            </button>
          ))}
        </div>
      </div>

      <button className="sidebar-cta" onClick={onUploadClick}>
        <span className="cta-plus">+</span>
        记录新地点
        <span className="cta-arrow">→</span>
      </button>

      <div className="sidebar-foot">
        <span className="sidebar-foot-hand">Footprints</span>
        <span>© 2025</span>
      </div>
    </aside>
  )
}
