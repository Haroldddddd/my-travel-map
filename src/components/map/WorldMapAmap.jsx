import { useEffect, useRef, useCallback } from 'react'
import { ensureAmap } from '../../services/amapLoader.js'
import { fetchCountryBoundary } from '../../services/geocoder.js'

function markerHTML(city, focused) {
  const ring = focused
    ? `<circle cx="11" cy="10" r="12" fill="none" stroke="rgba(26,26,26,0.18)" stroke-width="1.5"/>`
    : ''
  return `
    <div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;user-select:none;">
      <div style="
        font-family:'Noto Sans SC',sans-serif;font-size:11px;font-weight:600;
        color:#1a1a1a;white-space:nowrap;margin-bottom:2px;
        text-shadow:-2px 0 #eef0f5,2px 0 #eef0f5,0 -2px #eef0f5,0 2px #eef0f5;
      ">${city.name}</div>
      <svg width="22" height="30" viewBox="0 0 22 30" fill="none" xmlns="http://www.w3.org/2000/svg">
        ${ring}
        <path d="M11 1C5.477 1 1 5.477 1 11c0 4.527 2.748 8.43 6.714 10.857L11 29l3.286-7.143C18.252 19.43 21 15.527 21 11c0-5.523-4.477-10-10-10z"
          fill="${focused ? '#1a1a1a' : '#2a2a2a'}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
        <circle cx="11" cy="10.5" r="3.5" fill="white" opacity="0.88"/>
      </svg>
    </div>`
}

let drawVersion = 0

function drawGeoJSON(AMap, map, geojson, polygonsRef) {
  const { type, coordinates } = geojson
  const rings = type === 'MultiPolygon'
    ? coordinates.map(p => p[0])
    : type === 'Polygon' ? [coordinates[0]] : []
  rings.forEach(ring => {
    const poly = new AMap.Polygon({
      path: ring,
      strokeColor: '#c8a060', strokeWeight: 1, strokeOpacity: 0.6,
      fillColor: '#f5c896', fillOpacity: 0.6, zIndex: 20,
    })
    map.add(poly)
    polygonsRef.current.push(poly)
  })
}

async function drawVisitedCountries(cities, map, polygonsRef) {
  const AMap = window.AMap
  if (!AMap) return

  const version = ++drawVersion
  polygonsRef.current.forEach(p => map.remove(p))
  polygonsRef.current = []

  const seenCountries = new Set()

  for (const city of cities) {
    if (version !== drawVersion) return
    if (!city.country || seenCountries.has(city.country)) continue
    seenCountries.add(city.country)

    const geojson = await fetchCountryBoundary(city.country)
    if (version !== drawVersion) return
    if (geojson) drawGeoJSON(AMap, map, geojson, polygonsRef)
  }
}

export default function WorldMapAmap({ cities, activeCity, onCityClick, zoomRef }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const polygonsRef = useRef([])

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

  useEffect(() => {
    let cancelled = false

    ensureAmap().then(() => {
      if (cancelled || !containerRef.current || mapRef.current) return

      const AMap = window.AMap
      const map = new AMap.Map(containerRef.current, {
        zoom: 2,
        center: [15, 20],
        mapStyle: 'amap://styles/whitesmoke',
        features: [],
        resizeEnable: true,
      })
      mapRef.current = map

      // Country-level fill + borders
      const worldLayer = new AMap.DistrictLayer.World({
        zIndex: 9,
        styles: {
          'stroke-width': 0.6,
          stroke: '#b0aca6',
          'coastline-stroke': '#9db5c8',
          'coastline-stroke-width': 1,
          fill: '#f0eeea',
          'text-size': 0,
          'text-color': '#00000000',
        },
      })
      map.add(worldLayer)

      if (zoomRef) {
        zoomRef.current = {
          zoomIn:  () => map.zoomIn(),
          zoomOut: () => map.zoomOut(),
          reset:   () => map.setZoomAndCenter(2, [15, 20]),
        }
      }

      syncMarkers()
      drawVisitedCountries(citiesRef.current, map, polygonsRef)
    })

    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.destroy()
        mapRef.current = null
      }
    }
  }, [syncMarkers, zoomRef])

  useEffect(() => {
    syncMarkers()
  }, [cities, activeCity, syncMarkers])

  // Redraw city boundaries when visited cities change
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    drawVisitedCountries(cities, map, polygonsRef)
  }, [cities])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', background: '#c2d8e8' }}
    />
  )
}
