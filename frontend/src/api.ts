const BASE = '/api'

export async function fetchBoards() {
  const res = await fetch(`${BASE}/boards`)
  return res.json()
}

export async function createBoard(name: string) {
  const res = await fetch(`${BASE}/boards?name=${encodeURIComponent(name)}`, { method: 'POST' })
  return res.json()
}

export async function fetchBoard(id: number) {
  const res = await fetch(`${BASE}/boards/${id}`)
  if (!res.ok) return null
  return res.json()
}

export async function fetchEvents(id: number) {
  const res = await fetch(`${BASE}/boards/${id}/events`)
  return res.json()
}

export async function saveStrokes(id: number, strokes: unknown[]) {
  await fetch(`${BASE}/boards/${id}/strokes`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ strokes }),
  })
}

export async function exportBoard(id: number, format: string, width: number, height: number) {
  const res = await fetch(
    `${BASE}/boards/${id}/export?format=${format}&width=${width}&height=${height}`
  )
  if (!res.ok) return null
  if (format === 'svg') return res.text()
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

export async function uploadImage(id: number, file: File) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${BASE}/boards/${id}/image`, {
    method: 'POST',
    body: formData,
  })
  return res.json()
}
