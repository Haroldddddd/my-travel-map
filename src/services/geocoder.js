let lastRequestTime = 0
const memCache = new Map()

async function nominatimFetch(url) {
  const wait = Math.max(0, lastRequestTime + 1100 - Date.now())
  if (wait > 0) await new Promise(r => setTimeout(r, wait))
  lastRequestTime = Date.now()
  const res = await fetch(url, { headers: { 'Accept-Language': 'zh-CN,zh,en' } })
  if (!res.ok) throw new Error(`Nominatim error: ${res.status}`)
  return res.json()
}

const countryGeoCache = new Map()

export async function fetchCountryBoundary(countryName) {
  if (countryGeoCache.has(countryName)) return countryGeoCache.get(countryName)
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(countryName)}&polygon_geojson=1&polygon_threshold=0.01&format=json&limit=1&featuretype=country`
  try {
    const data = await nominatimFetch(url)
    const geojson = data[0]?.geojson || null
    countryGeoCache.set(countryName, geojson)
    return geojson
  } catch {
    countryGeoCache.set(countryName, null)
    return null
  }
}

export async function searchInternationalCities(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=8&addressdetails=1&featuretype=city`
  const data = await nominatimFetch(url)
  const seen = new Set()
  return data
    .filter(r => {
      const cc = (r.address?.country_code || '').toLowerCase()
      return cc && cc !== 'cn'
    })
    .map(r => {
      const name = r.address?.city || r.address?.town || r.address?.municipality || r.name.split(',')[0].trim()
      const country = r.address?.country
      const lat = parseFloat(r.lat)
      const lng = parseFloat(r.lon)
      return { name, country, lat, lng, domestic: false }
    })
    .filter(c => c.name && c.country && !isNaN(c.lat) && !seen.has(c.name) && seen.add(c.name))
}

function roundCoord(n) {
  return Math.round(n * 100) / 100
}

export async function geocodeCoords(lat, lng) {
  const cacheKey = `geo_${roundCoord(lat)}_${roundCoord(lng)}`

  if (memCache.has(cacheKey)) return memCache.get(cacheKey)

  const persisted = localStorage.getItem(cacheKey)
  if (persisted) {
    const result = JSON.parse(persisted)
    memCache.set(cacheKey, result)
    return result
  }

  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10`
  const data = await nominatimFetch(url)

  const addr = data.address || {}
  const result = {
    city: addr.city || addr.town || addr.village || addr.county || addr.state || '未知城市',
    country: addr.country || '未知',
    countryCode: (addr.country_code || '').toUpperCase(),
    province: addr.province || addr.state || null,
  }

  memCache.set(cacheKey, result)
  localStorage.setItem(cacheKey, JSON.stringify(result))
  return result
}
