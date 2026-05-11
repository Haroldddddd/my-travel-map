import { useEffect, useRef, useCallback } from 'react'

import { ensureAmap } from '../../services/amapLoader.js'

function markerHTML(city, focused) {
  const ring = focused
    ? `<circle cx="11" cy="10" r="12" fill="none" stroke="rgba(26,26,26,0.18)" stroke-width="1.5"/>`
    : ''
  return `
    <div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;user-select:none;">
      <div style="
        font-family:'Noto Sans SC',sans-serif;font-size:11px;font-weight:600;
        color:#1a1a1a;white-space:nowrap;margin-bottom:2px;
        text-shadow:-2px 0 #f5f3ee,2px 0 #f5f3ee,0 -2px #f5f3ee,0 2px #f5f3ee;
      ">${city.name}</div>
      <svg width="22" height="30" viewBox="0 0 22 30" fill="none" xmlns="http://www.w3.org/2000/svg">
        ${ring}
        <path d="M11 1C5.477 1 1 5.477 1 11c0 4.527 2.748 8.43 6.714 10.857L11 29l3.286-7.143C18.252 19.43 21 15.527 21 11c0-5.523-4.477-10-10-10z"
          fill="${focused ? '#1a1a1a' : '#2a2a2a'}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
        <circle cx="11" cy="10.5" r="3.5" fill="white" opacity="0.88"/>
      </svg>
    </div>`
}

// Municipalities: full boundary lives at province-level adcode
const MUNI_PREFIXES = new Set(['11', '12', '31', '50'])
function toCityAdcode(raw) {
  const s = String(raw)
  return MUNI_PREFIXES.has(s.slice(0, 2)) ? s.slice(0, 2) + '0000' : s.slice(0, 4) + '00'
}

// Reverse-geocode lat/lng → prefecture-level adcode via AMap.Geocoder
function geocodeAdcode(AMap, lng, lat) {
  return new Promise(resolve => {
    const gc = new AMap.Geocoder()
    gc.getAddress([lng, lat], (status, result) => {
      if (status !== 'complete') return resolve(null)
      const raw = result.regeocode?.addressComponent?.adcode
      resolve(raw ? toCityAdcode(raw) : null)
    })
  })
}

// Fetch boundary GeoJSON from Datav static CDN — no auth, no rate limit
async function fetchDatavBoundary(adcode) {
  try {
    const res = await fetch(`https://geo.datav.aliyun.com/areas_v3/bound/${adcode}.json`)
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

function drawPolygons(AMap, map, geojson, highlightRef) {
  const features = geojson?.features ?? []
  const feature = features[0]
  if (!feature) return
  const { type, coordinates } = feature.geometry
  const rings = type === 'MultiPolygon'
    ? coordinates.map(p => p[0])
    : type === 'Polygon' ? [coordinates[0]] : []
  rings.forEach(ring => {
    const poly = new AMap.Polygon({
      path: ring,   // Datav coordinates are already [lng, lat] pairs
      strokeColor: '#c8a060', strokeWeight: 1, strokeOpacity: 0.6,
      fillColor: '#f5c896', fillOpacity: 0.6, zIndex: 20,
    })
    map.add(poly)
    highlightRef.current.push(poly)
  })
}

let drawVersion = 0

async function drawVisitedCities(cities, map, highlightRef) {
  const AMap = window.AMap
  if (!AMap?.Geocoder) return

  const version = ++drawVersion
  highlightRef.current.forEach(p => map.remove(p))
  highlightRef.current = []

  const seenAdcodes = new Set()

  // Stagger geocoding calls to avoid AMap rate-limits (200ms each)
  for (const city of cities) {
    if (version !== drawVersion) return
    await new Promise(r => setTimeout(r, 200))
    if (version !== drawVersion) return

    const adcode = city.adcode
      ? toCityAdcode(city.adcode)
      : await geocodeAdcode(AMap, city.lng, city.lat)
    if (!adcode || seenAdcodes.has(adcode)) continue
    seenAdcodes.add(adcode)

    // Boundary fetch from Datav CDN — parallel, no cancellation
    fetchDatavBoundary(adcode).then(geojson => {
      if (version !== drawVersion || !geojson) return
      drawPolygons(AMap, map, geojson, highlightRef)
    })
  }
}

export default function ChinaMapAmap({ cities, activeCity, onCityClick, zoomRef }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const highlightRef = useRef([])

  const citiesRef = useRef(cities)
  const activeCityRef = useRef(activeCity)
  const onClickRef = useRef(onCityClick)
  citiesRef.current = cities
  activeCityRef.current = activeCity
  onClickRef.current = onCityClick

  const syncMarkers = useCallback(() => {
    const map = mapRef.current
    if (!map || !window.AMap) return

    markersRef.current.forEach(m => map.remove(m))
    markersRef.current = []

    citiesRef.current.forEach(city => {
      const focused = activeCityRef.current?.id === city.id
      const marker = new window.AMap.Marker({
        position: new window.AMap.LngLat(city.lng, city.lat),
        content: markerHTML(city, focused),
        offset: new window.AMap.Pixel(-11, -48),
        zIndex: focused ? 200 : 100,
      })
      marker.on('click', () => onClickRef.current(city))
      map.add(marker)
      markersRef.current.push(marker)
    })
  }, [])

  // Init map once on mount
  useEffect(() => {
    let cancelled = false

    ensureAmap().then(() => {
      if (cancelled || !containerRef.current || mapRef.current) return

      const AMap = window.AMap
      const map = new AMap.Map(containerRef.current, {
        zoom: 4,
        center: [104.0, 35.5],
        mapStyle: 'amap://styles/whitesmoke',
        features: ['bg'],
        resizeEnable: true,
      })
      mapRef.current = map

      // Province borders only — transparent fill so highlight polygons show through
      const provinceLayer = new AMap.DistrictLayer.Province({
        zIndex: 9,
        SOC: 'CHN',
        depth: 0,
        styles: {
          'stroke-width': 1.2,
          stroke: '#a8a49e',
          fill: 'transparent',
          'text-size': 0,
          'text-color': '#00000000',
        },
      })

      // City-level borders — faint, on top of province fill
      const cityLayer = new AMap.DistrictLayer.Province({
        zIndex: 11,
        SOC: 'CHN',
        depth: 1,
        styles: {
          'stroke-width': 0.35,
          stroke: '#ccc9c3',
          fill: 'transparent',
          'text-size': 0,
          'text-color': '#00000000',
        },
      })

      map.add([provinceLayer, cityLayer])

      if (zoomRef) {
        zoomRef.current = {
          zoomIn:  () => map.zoomIn(),
          zoomOut: () => map.zoomOut(),
          reset:   () => map.setZoomAndCenter(4, [104.0, 35.5]),
        }
      }

      syncMarkers()
      drawVisitedCities(citiesRef.current, map, highlightRef)
    })

    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.destroy()
        mapRef.current = null
      }
    }
  }, [syncMarkers, zoomRef])

  // Re-sync markers when cities or selection changes
  useEffect(() => {
    syncMarkers()
  }, [cities, activeCity, syncMarkers])

  // Redraw highlights when visited cities change
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    drawVisitedCities(cities, map, highlightRef)
  }, [cities])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', background: '#c2d8e8' }}
    />
  )
}
