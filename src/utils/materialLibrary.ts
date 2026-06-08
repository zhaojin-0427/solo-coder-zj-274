import type { PatternMaterial, MaterialFilterOptions } from '../types/materialLibrary'
import type { NailSize, NailShape, UploadedPattern, PatternIndependentConfig } from '../types'
import { generateId } from './image'

const STORAGE_KEY = 'nail_sticker_pattern_materials'

function normalizeMaterial(raw: any): PatternMaterial {
  return {
    id: String(raw.id || generateId()),
    name: String(raw.name || '未命名素材'),
    tags: Array.isArray(raw.tags) ? raw.tags.map((t: any) => String(t)) : [],
    dataUrl: String(raw.dataUrl || ''),
    width: Number(raw.width || 0),
    height: Number(raw.height || 0),
    defaultNailSize: (['XS', 'S', 'M', 'L'].includes(raw.defaultNailSize) ? raw.defaultNailSize : 'M') as NailSize,
    defaultNailShape: (['square', 'round', 'oval', 'almond', 'stiletto', 'coffin'].includes(raw.defaultNailShape)
      ? raw.defaultNailShape
      : 'square') as NailShape,
    defaultQuantity: Math.max(1, Math.min(50, Number(raw.defaultQuantity) || 5)),
    lastUsedAt: Number(raw.lastUsedAt || Date.now()),
    createdAt: Number(raw.createdAt || Date.now())
  }
}

export function getAllMaterials(): PatternMaterial[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    const raw = data ? JSON.parse(data) : []
    return Array.isArray(raw) ? raw.map(normalizeMaterial) : []
  } catch {
    return []
  }
}

export function saveAllMaterials(materials: PatternMaterial[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(materials))
}

export function getMaterialById(id: string): PatternMaterial | null {
  return getAllMaterials().find(m => m.id === id) || null
}

export function createMaterial(params: {
  name: string
  tags?: string[]
  dataUrl: string
  width: number
  height: number
  defaultNailSize?: NailSize
  defaultNailShape?: NailShape
  defaultQuantity?: number
}): PatternMaterial {
  const materials = getAllMaterials()
  const now = Date.now()
  const material: PatternMaterial = {
    id: generateId(),
    name: params.name.trim() || '未命名素材',
    tags: (params.tags || []).map(t => t.trim()).filter(Boolean),
    dataUrl: params.dataUrl,
    width: params.width,
    height: params.height,
    defaultNailSize: params.defaultNailSize || 'M',
    defaultNailShape: params.defaultNailShape || 'square',
    defaultQuantity: params.defaultQuantity || 5,
    lastUsedAt: now,
    createdAt: now
  }
  materials.push(material)
  saveAllMaterials(materials)
  return material
}

export function updateMaterial(id: string, patch: Partial<PatternMaterial>): PatternMaterial | null {
  const materials = getAllMaterials()
  const idx = materials.findIndex(m => m.id === id)
  if (idx === -1) return null
  materials[idx] = { ...materials[idx], ...patch }
  saveAllMaterials(materials)
  return materials[idx]
}

export function deleteMaterial(id: string): void {
  const materials = getAllMaterials().filter(m => m.id !== id)
  saveAllMaterials(materials)
}

export function markMaterialUsed(id: string): void {
  const materials = getAllMaterials()
  const idx = materials.findIndex(m => m.id === id)
  if (idx !== -1) {
    materials[idx].lastUsedAt = Date.now()
    saveAllMaterials(materials)
  }
}

export function getAllTags(): string[] {
  const tagSet = new Set<string>()
  for (const m of getAllMaterials()) {
    for (const t of m.tags) {
      tagSet.add(t)
    }
  }
  return Array.from(tagSet).sort()
}

export function filterMaterials(
  materials: PatternMaterial[],
  options: Partial<MaterialFilterOptions>
): PatternMaterial[] {
  let result = [...materials]

  if (options.keyword && options.keyword.trim()) {
    const kw = options.keyword.trim().toLowerCase()
    result = result.filter(m =>
      m.name.toLowerCase().includes(kw) ||
      m.tags.some(t => t.toLowerCase().includes(kw))
    )
  }

  if (options.tags && options.tags.length > 0) {
    result = result.filter(m =>
      options.tags!.every(t => m.tags.includes(t))
    )
  }

  const sortBy = options.sortBy || 'recent'
  if (sortBy === 'name') {
    result.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  } else if (sortBy === 'created') {
    result.sort((a, b) => b.createdAt - a.createdAt)
  } else {
    result.sort((a, b) => b.lastUsedAt - a.lastUsedAt)
  }

  return result
}

export function materialToUploadedPattern(material: PatternMaterial): UploadedPattern {
  return {
    id: generateId(),
    name: material.name,
    dataUrl: material.dataUrl,
    width: material.width,
    height: material.height
  }
}

export function materialToPatternConfig(material: PatternMaterial): PatternIndependentConfig {
  return {
    nailSize: material.defaultNailSize,
    nailShape: material.defaultNailShape,
    quantity: material.defaultQuantity,
    priority: 1,
    setGroupId: null
  }
}
