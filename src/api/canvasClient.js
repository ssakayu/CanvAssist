// api/canvasClient.js
// Base Canvas API client — single source of truth for all API calls
// Every other API file imports and uses this instead of calling fetch directly

const BASE_URL = 'https://canvas.qut.edu.au/api/v1'

// Single fetch wrapper — handles errors consistently across all API calls
async function canvasFetch(endpoint) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })

  if (res.status === 401) throw new Error('NOT_LOGGED_IN')
  if (res.status === 403) return null   // no access, skip silently
  if (!res.ok) throw new Error(`Canvas API error: ${res.status} on ${endpoint}`)

  return res.json()
}

// Paginated fetch — Canvas returns max 100 items per page
// Keeps fetching until there are no more pages
async function canvasFetchAll(endpoint) {
  const separator = endpoint.includes('?') ? '&' : '?'
  let url = `${BASE_URL}${endpoint}${separator}per_page=100`
  let results = []

  while (url) {
    const res = await fetch(url, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })

    if (!res.ok) break

    const data = await res.json()
    results = results.concat(data)

    // Canvas puts the next page URL in the Link header
    const linkHeader = res.headers.get('Link')
    const nextMatch = linkHeader?.match(/<([^>]+)>;\s*rel="next"/)
    url = nextMatch ? nextMatch[1] : null
  }

  return results
}

export { canvasFetch, canvasFetchAll }