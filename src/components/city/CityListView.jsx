import CityThumb from '../CityThumb.jsx'

export default function CityListView({ cities, tab, onCityClick, onClose }) {
  const sorted = [...cities].sort((a, b) =>
    (b.firstVisit || '').localeCompare(a.firstVisit || '')
  )

  return (
    <div className="list-overlay">
      <div className="list-header">
        <button className="list-back" onClick={onClose}>←</button>
        <span className="list-header-title">
          {tab === 'domestic' ? '国内城市' : '国际城市'}
          <span style={{ color: 'var(--faint)', fontWeight: 400, marginLeft: 6, fontSize: 13 }}>
            {cities.length} 个
          </span>
        </span>
      </div>

      <div className="list-body">
        {sorted.map(city => (
          <button key={city.id} className="list-item" onClick={() => onCityClick(city)}>
            <CityThumb city={city} size={40} />
            <span className="list-item-name">{city.name}</span>
            <span className="list-item-meta">
              {city.domestic ? city.province : city.country}
            </span>
            <span className="list-item-date">{city.firstVisit?.slice(0, 7)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
