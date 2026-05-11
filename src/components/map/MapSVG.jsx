import { useEffect, useState, useMemo, useRef } from 'react'
import * as d3 from 'd3'
import * as topojson from 'topojson-client'
import ChinaMapAmap from './ChinaMapAmap.jsx'
import WorldMapAmap from './WorldMapAmap.jsx'

const CW = 960, CH = 720

// Module-level cache: GeoJSON is static; no need to re-fetch on tab switch
const geoCache = {}
async function fetchGeo(url, transform) {
  if (geoCache[url]) return geoCache[url]
  const raw = await fetch(url).then(r => r.json())
  geoCache[url] = transform ? transform(raw) : raw
  return geoCache[url]
}
const WW = 960, WH = 520

// ── Zoom hook shared by both maps ────────────────────────────────────
function useMapZoom(svgRef, zoomRef) {
  const [xform, setXform] = useState(null)

  useEffect(() => {
    const el = svgRef.current
    if (!el) return

    const zoom = d3.zoom()
      .scaleExtent([0.5, 10])
      .on('zoom', e => setXform(e.transform))

    d3.select(el).call(zoom)

    if (zoomRef) {
      zoomRef.current = {
        zoomIn:  () => d3.select(el).transition().duration(250).call(zoom.scaleBy, 1.5),
        zoomOut: () => d3.select(el).transition().duration(250).call(zoom.scaleBy, 1 / 1.5),
        reset:   () => d3.select(el).transition().duration(300).call(zoom.transform, d3.zoomIdentity),
      }
    }

    return () => d3.select(el).on('.zoom', null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally once; zoomRef is stable

  return xform
}

// ── Markers ──────────────────────────────────────────────────────────
function WorldMarker({ x, y, city, focused, onClick }) {
  return (
    <g transform={`translate(${x},${y})`} style={{ cursor: 'pointer' }} onClick={onClick}>
      {focused && (
        <circle r="14" fill="none" stroke="#1a1a1a" strokeWidth="1.5">
          <animate attributeName="r" from="8" to="20" dur="1.4s" repeatCount="indefinite" />
          <animate attributeName="opacity" from="0.5" to="0" dur="1.4s" repeatCount="indefinite" />
        </circle>
      )}
      <circle r="6" fill="#1a1a1a" stroke="#fff" strokeWidth="2" />
      <circle r="11" fill="none" stroke="#1a1a1a" strokeWidth="0.8" opacity="0.3" />
      <text x="0" y="-13" fontSize="12" textAnchor="middle" fill="#1a1a1a"
        fontFamily="'Noto Sans SC', sans-serif" fontWeight="600"
        style={{ paintOrder: 'stroke', stroke: '#f5f5f4', strokeWidth: 3 }}>
        {city.name}
      </text>
    </g>
  )
}

function ChinaMarker({ x, y, city, focused, onClick }) {
  return (
    <g transform={`translate(${x},${y})`} style={{ cursor: 'pointer' }} onClick={onClick}>
      <ellipse cx="0" cy="44" rx="11" ry="3" fill="rgba(0,0,0,0.10)" />
      <line x1="0" y1="0" x2="0" y2="38" stroke="#1a1a1a" strokeWidth="1.3" strokeLinecap="round" />
      <g transform="translate(-20,-44)">
        <rect x="-1" y="-1" width="42" height="42" rx="3" fill="#fff" stroke="#1a1a1a" strokeWidth="1.3" />
        <rect x="0" y="0" width="40" height="40" rx="2" fill={city.color || '#e8e8e8'} />
        <text x="20" y="26" fontSize="14" textAnchor="middle" fontWeight="700"
          fontFamily="'Noto Sans SC', sans-serif" fill="rgba(26,26,26,0.5)">
          {city.name.slice(0, 2)}
        </text>
        {focused && <rect x="-1" y="-1" width="42" height="42" rx="3" fill="none" stroke="#1a1a1a" strokeWidth="2.5" />}
      </g>
      <text x="0" y="57" fontSize="12" textAnchor="middle" fill="#1a1a1a"
        fontFamily="'Noto Sans SC', sans-serif" fontWeight="600"
        style={{ paintOrder: 'stroke', stroke: '#f5f5f4', strokeWidth: 3 }}>
        {city.name}
      </text>
    </g>
  )
}

// ── World Map ────────────────────────────────────────────────────────
function WorldMap({ cities, activeCity, onCityClick, zoomRef }) {
  const svgRef = useRef(null)
  const [features, setFeatures] = useState(null)
  const xform = useMapZoom(svgRef, zoomRef)

  useEffect(() => {
    fetchGeo('/data/world.json', raw => topojson.feature(raw, raw.objects.countries))
      .then(setFeatures)
  }, [])

  const projection = useMemo(() => {
    if (!features) return null
    return d3.geoNaturalEarth1().fitExtent([[10, 20], [WW - 10, WH - 20]], features)
  }, [features])

  const pathGen = useMemo(() => projection ? d3.geoPath(projection) : null, [projection])

  return (
    <svg ref={svgRef} viewBox={`0 0 ${WW} ${WH}`} width="100%" height="100%"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block', cursor: 'grab' }}>
      <rect width={WW} height={WH} fill="#e8f0f5" />
      {projection && (
        <g opacity="0.08" stroke="#1a1a1a" strokeWidth="0.4" fill="none">
          <path d={d3.geoPath(projection)(d3.geoGraticule10())} />
        </g>
      )}
      <g transform={xform?.toString()}>
        {!features && (
          <text x={WW / 2} y={WH / 2} textAnchor="middle" fill="#aaa" fontSize="14"
            fontFamily="Noto Sans SC, sans-serif">正在加载地图…</text>
        )}
        {features && pathGen && features.features.map((f, i) => {
          const d = pathGen(f)
          return d ? <path key={i} d={d} fill="#d8d8d5" stroke="#ffffff" strokeWidth="0.6" /> : null
        })}
        {projection && cities.map(city => {
          const pt = projection([city.lng, city.lat])
          if (!pt || isNaN(pt[0])) return null
          return <WorldMarker key={city.id} x={pt[0]} y={pt[1]} city={city}
            focused={activeCity?.id === city.id} onClick={() => onCityClick(city)} />
        })}
      </g>
    </svg>
  )
}

// ── China Map ────────────────────────────────────────────────────────
function ChinaMap({ cities, activeCity, onCityClick, zoomRef }) {
  const svgRef = useRef(null)
  const [features, setFeatures] = useState(null)
  const xform = useMapZoom(svgRef, zoomRef)

  useEffect(() => {
    fetchGeo('/data/china.json').then(setFeatures)
  }, [])

  const mapData = useMemo(() => {
    if (!features) return null
    const lonW = 73, lonE = 136, latS = 18, latN = 54
    const xRange = (lonE - lonW) * Math.PI / 180
    const yRange = Math.log(Math.tan(Math.PI / 4 + latN * Math.PI / 360))
                 - Math.log(Math.tan(Math.PI / 4 + latS * Math.PI / 360))
    const pad = 30
    const scale = Math.min((CW - pad * 2) / xRange, (CH - pad * 2) / yRange)
    const proj = d3.geoMercator()
      .center([(lonW + lonE) / 2, (latS + latN) / 2])
      .scale(scale)
      .translate([CW / 2, CH / 2])
    const gen = d3.geoPath(proj)
    const paths = features.features
      .map((f, i) => ({ key: i, d: gen(f) }))
      .filter(p => p.d && p.d.length > 1)
    const labels = features.features
      .map((f, i) => {
        const c = gen.centroid(f)
        return { key: i, name: f.properties?.name || '', x: c?.[0], y: c?.[1] }
      })
      .filter(l => l.name && l.x != null && !isNaN(l.x) && !isNaN(l.y))
    return { proj, paths, labels }
  }, [features])

  return (
    <svg ref={svgRef} viewBox={`0 0 ${CW} ${CH}`} width="100%" height="100%"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block', cursor: 'grab' }}>
      <rect width={CW} height={CH} fill="#dce8f0" />
      <g transform={xform?.toString()}>
        {!features && (
          <text x={CW / 2} y={CH / 2} textAnchor="middle" fill="#aaa" fontSize="14"
            fontFamily="Noto Sans SC, sans-serif">正在加载地图…</text>
        )}
        {mapData?.paths.map(({ key, d }) => (
          <path key={key} d={d} fill="#e8e4db"
            stroke="#8a8078" strokeWidth="0.6" strokeLinejoin="round" />
        ))}
        {mapData?.labels.map(({ key, name, x, y }) => (
          <text key={`l${key}`} x={x} y={y} fontSize="9"
            fontFamily="'Noto Sans SC', sans-serif" fill="#6b6060"
            textAnchor="middle" opacity="0.85">{name}</text>
        ))}
        {mapData && cities.map(city => {
          const pt = mapData.proj([city.lng, city.lat])
          if (!pt || isNaN(pt[0])) return null
          return <ChinaMarker key={city.id} x={pt[0]} y={pt[1]} city={city}
            focused={activeCity?.id === city.id} onClick={() => onCityClick(city)} />
        })}
      </g>
    </svg>
  )
}

// ── Export ───────────────────────────────────────────────────────────
export default function MapSVG({ tab, cities, activeCity, onCityClick, zoomRef }) {
  return (
    <div className="map-canvas">
      {tab === 'domestic'
        ? <ChinaMapAmap cities={cities} activeCity={activeCity} onCityClick={onCityClick} zoomRef={zoomRef} />
        : <WorldMapAmap cities={cities} activeCity={activeCity} onCityClick={onCityClick} zoomRef={zoomRef} />
      }
    </div>
  )
}
