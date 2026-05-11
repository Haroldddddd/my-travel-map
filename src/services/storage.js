const KEY = 'travel-cities'

export function getCities() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveCities(cities) {
  localStorage.setItem(KEY, JSON.stringify(cities))
}

export function addCity(city) {
  const cities = getCities()
  const existing = cities.find(c => c.id === city.id)
  if (existing) return cities
  const updated = [...cities, city]
  saveCities(updated)
  return updated
}

export function updateCity(city) {
  const cities = getCities()
  const updated = cities.map(c => c.id === city.id ? city : c)
  saveCities(updated)
  return updated
}

export function deleteCity(id) {
  const cities = getCities().filter(c => c.id !== id)
  saveCities(cities)
  return cities
}
