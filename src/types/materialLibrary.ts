import type { NailSize, NailShape } from './index'

export interface PatternMaterial {
  id: string
  name: string
  tags: string[]
  dataUrl: string
  width: number
  height: number
  defaultNailSize: NailSize
  defaultNailShape: NailShape
  defaultQuantity: number
  lastUsedAt: number
  createdAt: number
}

export interface MaterialFilterOptions {
  keyword: string
  tags: string[]
  sortBy: 'name' | 'recent' | 'created'
}
