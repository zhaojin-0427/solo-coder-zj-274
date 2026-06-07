import type { LayoutScheme, LayoutSettings, UploadedPattern } from '../types'

const STORAGE_KEY = 'nail_sticker_layouts'

export function saveLayoutScheme(
  name: string,
  patterns: UploadedPattern[],
  settings: LayoutSettings
): LayoutScheme {
  const schemes = getAllSchemes()
  const scheme: LayoutScheme = {
    id: Date.now().toString(),
    name,
    createdAt: Date.now(),
    patterns,
    settings
  }
  schemes.push(scheme)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(schemes))
  return scheme
}

export function getAllSchemes(): LayoutScheme[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function deleteScheme(id: string): void {
  const schemes = getAllSchemes().filter(s => s.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(schemes))
}

export function loadScheme(id: string): LayoutScheme | null {
  return getAllSchemes().find(s => s.id === id) || null
}
