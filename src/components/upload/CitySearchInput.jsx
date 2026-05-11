import { useState, useEffect, useRef } from 'react'
import { ensureAmap } from '../../services/amapLoader.js'
import { provinceFromAdcode } from '../../services/adcodeProvince.js'
import { searchInternationalCities } from '../../services/geocoder.js'

// Direct-controlled municipalities — their adcode looks like a province (last 4 = "0000")
// but they should be treated as searchable cities.
const MUNICIPALITIES = new Set(['110000', '120000', '310000', '500000'])

function shouldInclude(d) {
  if (d.level === 'country') return false
  // Exclude pure provinces (last 4 digits "0000") that are not municipalities
  if (d.level === 'province' && !MUNICIPALITIES.has(String(d.adcode))) return false
  return true
}

async function searchAmapDistricts(query) {
  const AMap = await ensureAmap()
  return new Promise(resolve => {
    const ds = new AMap.DistrictSearch({ subdistrict: 0, showbiz: false, extensions: 'base' })
    ds.search(query, (status, result) => {
      if (status !== 'complete' || !result.districtList?.length) {
        resolve([])
        return
      }
      const seen = new Set()
      const cities = result.districtList
        .filter(shouldInclude)
        .map(d => {
          const name = (d.name || '').replace(/市$|县$|区$/, '')
          const adcode = String(d.adcode || '')
          const province = provinceFromAdcode(adcode)
          const center = d.center
          const lat = center?.getLat?.() ?? center?.lat
          const lng = center?.getLng?.() ?? center?.lng
          return { name, country: '中国', province, lat, lng, domestic: true, adcode }
        })
        .filter(c => c.name && c.lat && c.lng && !seen.has(c.name) && seen.add(c.name))
      resolve(cities)
    })
  })
}

let searchTimer = null

export default function CitySearchInput({ value, onChange, existingCities = [] }) {
  const [query, setQuery] = useState(value?.name || '')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (value?.name && value.name !== query) setQuery(value.name)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.name])

  useEffect(() => {
    const onDown = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  function handleInput(e) {
    const q = e.target.value
    setQuery(q)
    onChange(null)
    clearTimeout(searchTimer)

    if (!q.trim()) {
      setResults([])
      setOpen(false)
      return
    }

    const local = existingCities
      .filter(c => c.name.includes(q) || (c.province || '').includes(q) || (c.country || '').includes(q))
      .map(c => ({ ...c, isExisting: true }))

    if (local.length > 0) {
      setResults(local)
      setOpen(true)
    }

    searchTimer = setTimeout(async () => {
      setLoading(true)
      try {
        const [domestic, international] = await Promise.allSettled([
          searchAmapDistricts(q),
          searchInternationalCities(q),
        ])
        const domesticCities = domestic.status === 'fulfilled' ? domestic.value : []
        const intlCities = international.status === 'fulfilled' ? international.value : []
        const all = [...domesticCities, ...intlCities]
        const deduped = all.filter(r => !local.some(l => l.name === r.name))
        setResults([...local, ...deduped])
        setOpen(true)
      } catch {
        // keep local results
      } finally {
        setLoading(false)
      }
    }, 300)
  }

  function select(city) {
    setQuery(city.name)
    onChange(city)
    setOpen(false)
    setResults([])
  }

  return (
    <div className="city-search-wrap" ref={wrapRef}>
      <input
        className="form-input"
        type="text"
        placeholder="搜索城市名称…"
        value={query}
        onChange={handleInput}
        onFocus={() => results.length > 0 && setOpen(true)}
        autoComplete="off"
      />
      {loading && <span className="city-search-loading">搜索中…</span>}
      {open && results.length > 0 && (
        <ul className="city-search-results">
          {results.map((c, i) => (
            <li key={i} className="city-search-item" onMouseDown={() => select(c)}>
              <span className="city-search-name">{c.name}</span>
              <span className="city-search-sub">
                {c.domestic ? (c.province || c.country) : c.country}
                {c.isExisting && <span className="city-search-badge">已记录</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
