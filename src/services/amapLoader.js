// Shared singleton — ensures AMap script (with all plugins) loads exactly once
const AMAP_KEY = '8ad968e6453ff99c9ab74653e48965ed'
const AMAP_SEC = 'a595be07343ab4925d4d804ef041c59c'

let promise = null

export function ensureAmap() {
  if (promise) return promise
  if (window.AMap) return (promise = Promise.resolve(window.AMap))
  promise = new Promise((resolve, reject) => {
    window._AMapSecurityConfig = { securityJsCode: AMAP_SEC }
    const s = document.createElement('script')
    s.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}&plugin=AMap.DistrictLayer,AMap.DistrictSearch,AMap.AutoComplete,AMap.Geocoder`
    s.onload = () => resolve(window.AMap)
    s.onerror = (e) => { promise = null; reject(e) }
    document.head.appendChild(s)
  })
  return promise
}
