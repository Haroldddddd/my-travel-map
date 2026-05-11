const API = 'https://api.github.com'
const RAW = 'https://raw.githubusercontent.com'
const DATA = 'user-data'
const CFG_KEY = 'travel-map:gh'
const SHA_KEY = 'travel-map:gh-sha'

export function getConfig() {
  try { return JSON.parse(localStorage.getItem(CFG_KEY)) } catch { return null }
}
export function setConfig(cfg) { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)) }
export function isConfigured() {
  const c = getConfig(); return !!(c?.token && c?.owner && c?.repo)
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token || getConfig()?.token}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  }
}

async function api(path, method = 'GET', body = null) {
  const { owner, repo } = getConfig()
  const res = await fetch(`${API}/repos/${owner}/${repo}${path}`, {
    method,
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : null,
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.message || `GitHub ${res.status}`)
  }
  if (method === 'DELETE') return null
  return res.json()
}

async function fileSha(path) {
  try {
    const d = await api(`/contents/${path}`)
    return d.sha
  } catch { return null }
}

function toBase64Text(text) {
  return btoa(unescape(encodeURIComponent(text)))
}

async function blobToBase64(blob) {
  const buf = await blob.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str)
}

// ── Cities ────────────────────────────────────────────────

export async function loadCities() {
  try {
    const d = await api(`/contents/${DATA}/cities.json`)
    localStorage.setItem(SHA_KEY, d.sha)
    return JSON.parse(decodeURIComponent(escape(atob(d.content.replace(/\s/g, '')))))
  } catch { return null }
}

export async function saveCities(cities) {
  let sha = localStorage.getItem(SHA_KEY)
  if (!sha) sha = await fileSha(`${DATA}/cities.json`)
  const body = {
    message: 'Update travel data',
    content: toBase64Text(JSON.stringify(cities, null, 2)),
    ...(sha ? { sha } : {}),
  }
  const res = await api(`/contents/${DATA}/cities.json`, 'PUT', body)
  localStorage.setItem(SHA_KEY, res.content.sha)
}

// ── Photos ────────────────────────────────────────────────

export async function uploadPhoto(cityId, photoId, blob) {
  const content = await blobToBase64(blob)
  await api(`/contents/${DATA}/photos/${cityId}/${photoId}.jpg`, 'PUT', {
    message: 'Add photo',
    content,
  })
}

export async function deletePhoto(cityId, photoId) {
  const sha = await fileSha(`${DATA}/photos/${cityId}/${photoId}.jpg`)
  if (!sha) return
  await api(`/contents/${DATA}/photos/${cityId}/${photoId}.jpg`, 'DELETE', {
    message: 'Delete photo', sha,
  })
}

export function getPhotoUrl(cityId, photoId) {
  const { owner, repo } = getConfig()
  return `${RAW}/${owner}/${repo}/main/${DATA}/photos/${cityId}/${photoId}.jpg`
}

// ── Migration ────────────────────────────────────────────

// For each city, checks if its photos exist in the city folder on GitHub.
// If a photo is missing there but exists in the legacy temp/ folder, it is moved.
export async function migrateTempPhotos(cities) {
  for (const city of cities) {
    for (const photoId of (city.photos || [])) {
      const destPath = `${DATA}/photos/${city.id}/${photoId}.jpg`
      const srcPath  = `${DATA}/photos/temp/${photoId}.jpg`

      // Skip if already in the correct location
      if (await fileSha(destPath)) continue

      // Try fetching from temp/
      let fileData
      try { fileData = await api(`/contents/${srcPath}`) } catch { continue }
      const content = fileData.content?.replace(/\s/g, '')
      if (!content) continue

      // Upload to city folder, then delete from temp
      try {
        await api(`/contents/${destPath}`, 'PUT', {
          message: 'Migrate photo to city folder',
          content,
        })
        await api(`/contents/${srcPath}`, 'DELETE', {
          message: 'Remove migrated photo from temp',
          sha: fileData.sha,
        })
      } catch { /* best-effort */ }
    }
  }
}

// ── First-time setup ──────────────────────────────────────

export async function setupAndInit(token, ownerRepo, existingCities) {
  const parts = ownerRepo.trim().split('/')
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error('格式应为 owner/repo')
  const [owner, repo] = parts

  // Test connection
  const test = await fetch(`${API}/repos/${owner}/${repo}`, {
    headers: authHeaders(token),
  })
  if (!test.ok) throw new Error('仓库不存在或 Token 无权限')

  setConfig({ token, owner, repo })

  // Try load existing GitHub data
  const existing = await fetch(`${API}/repos/${owner}/${repo}/contents/${DATA}/cities.json`, {
    headers: authHeaders(token),
  })
  if (existing.ok) {
    const d = await existing.json()
    localStorage.setItem(SHA_KEY, d.sha)
    const cities = JSON.parse(decodeURIComponent(escape(atob(d.content.replace(/\s/g, '')))))
    return Array.isArray(cities) ? cities : existingCities
  }

  // First time: push local data to GitHub
  await saveCities(existingCities)
  return existingCities
}
