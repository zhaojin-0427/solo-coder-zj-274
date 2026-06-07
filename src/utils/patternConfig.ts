import type {
  UploadedPattern,
  PatternIndependentConfig,
  SetGroup,
  LayoutSettings,
  PrintCalibration,
  NailSize,
  NailShape
} from '../types'
import { generateId } from './image'

export function createDefaultPatternConfig(
  settings: LayoutSettings
): PatternIndependentConfig {
  return {
    nailSize: settings.nailSize,
    nailShape: settings.nailShape,
    quantity: settings.copiesPerNail,
    priority: 1,
    setGroupId: null
  }
}

export function ensurePatternConfigs(
  patterns: UploadedPattern[],
  existingConfigs: Record<string, PatternIndependentConfig>,
  settings: LayoutSettings
): Record<string, PatternIndependentConfig> {
  const result: Record<string, PatternIndependentConfig> = { ...existingConfigs }
  for (const pattern of patterns) {
    if (!result[pattern.id]) {
      result[pattern.id] = createDefaultPatternConfig(settings)
    }
  }
  for (const id of Object.keys(result)) {
    if (!patterns.find(p => p.id === id)) {
      delete result[id]
    }
  }
  return result
}

export function updatePatternConfig(
  configs: Record<string, PatternIndependentConfig>,
  patternId: string,
  patch: Partial<PatternIndependentConfig>
): Record<string, PatternIndependentConfig> {
  const existing = configs[patternId]
  if (!existing) return configs
  return {
    ...configs,
    [patternId]: { ...existing, ...patch }
  }
}

export function bulkUpdatePatternConfig(
  configs: Record<string, PatternIndependentConfig>,
  patternIds: string[],
  patch: Partial<PatternIndependentConfig>
): Record<string, PatternIndependentConfig> {
  let result = configs
  for (const id of patternIds) {
    result = updatePatternConfig(result, id, patch)
  }
  return result
}

export function createSetGroup(name: string, color?: string): SetGroup {
  const palette = [
    '#EF4444', '#F97316', '#F59E0B', '#EAB308',
    '#84CC16', '#22C55E', '#10B981', '#14B8A6',
    '#06B6D4', '#0EA5E9', '#3B82F6', '#6366F1',
    '#8B5CF6', '#A855F7', '#D946EF', '#EC4899',
    '#F43F5E'
  ]
  return {
    id: generateId(),
    name,
    color: color || palette[Math.floor(Math.random() * palette.length)]
  }
}

export function getSetGroupsForPatterns(
  patternIds: string[],
  configs: Record<string, PatternIndependentConfig>,
  groups: SetGroup[]
): SetGroup[] {
  const groupIds = new Set<string>()
  for (const id of patternIds) {
    const gid = configs[id]?.setGroupId
    if (gid) groupIds.add(gid)
  }
  return groups.filter(g => groupIds.has(g.id))
}

export function assignPatternsToSetGroup(
  configs: Record<string, PatternIndependentConfig>,
  patternIds: string[],
  groupId: string | null
): Record<string, PatternIndependentConfig> {
  return bulkUpdatePatternConfig(configs, patternIds, { setGroupId: groupId })
}

export function getAllPatternsInSetGroup(
  configs: Record<string, PatternIndependentConfig>,
  groupId: string
): string[] {
  return Object.entries(configs)
    .filter(([, cfg]) => cfg.setGroupId === groupId)
    .map(([id]) => id)
}

export function getTotalQuantityInSetGroup(
  configs: Record<string, PatternIndependentConfig>,
  groupId: string
): number {
  return Object.values(configs)
    .filter(cfg => cfg.setGroupId === groupId)
    .reduce((sum, cfg) => sum + cfg.quantity, 0)
}

export function calibrationAwareNailSize(
  nailSize: NailSize,
  dims: { width: number; height: number },
  calibration: PrintCalibration
): { width: number; height: number } {
  if (!calibration.enabled) return dims
  return {
    width: dims.width / calibration.scaleX,
    height: dims.height / calibration.scaleY
  }
}

export function getEffectiveConfig(
  patternId: string,
  configs: Record<string, PatternIndependentConfig>,
  fallback: LayoutSettings
): PatternIndependentConfig {
  if (configs[patternId]) {
    return configs[patternId]
  }
  return {
    nailSize: fallback.nailSize,
    nailShape: fallback.nailShape,
    quantity: fallback.copiesPerNail,
    priority: 1,
    setGroupId: null
  }
}

export function updateConfigShape(
  configs: Record<string, PatternIndependentConfig>,
  shape: NailShape
): Record<string, PatternIndependentConfig> {
  const result: Record<string, PatternIndependentConfig> = {}
  for (const [id, cfg] of Object.entries(configs)) {
    result[id] = { ...cfg, nailShape: shape }
  }
  return result
}

export function updateConfigSize(
  configs: Record<string, PatternIndependentConfig>,
  size: NailSize
): Record<string, PatternIndependentConfig> {
  const result: Record<string, PatternIndependentConfig> = {}
  for (const [id, cfg] of Object.entries(configs)) {
    result[id] = { ...cfg, nailSize: size }
  }
  return result
}
