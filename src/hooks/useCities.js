import { useState, useCallback } from 'react'
import * as storage from '../services/storage.js'

export function useCities() {
  const [cities, setCities] = useState(() => storage.getCities())

  const addCity = useCallback((city) => {
    const updated = storage.addCity(city)
    setCities(updated)
  }, [])

  const updateCity = useCallback((city) => {
    const updated = storage.updateCity(city)
    setCities(updated)
  }, [])

  const deleteCity = useCallback((id) => {
    const updated = storage.deleteCity(id)
    setCities(updated)
  }, [])

  return { cities, addCity, updateCity, deleteCity }
}
