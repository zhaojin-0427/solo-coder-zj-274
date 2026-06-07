import type {
  LayoutScheme,
  LayoutSettings,
  UploadedPattern,
  PatternIndependentConfig,
  SetGroup,
  PrintCalibration
} from '../types'
import { DEFAULT_CALIBRATION } from './calibration'

const STORAGE_KEY = 'nail_sticker_layouts'

export function saveLayoutScheme(
  name: string,
  patterns: UploadedPattern[],
  patternConfigs: Record<string, PatternIndependentConfig>,
  setGroups: SetGroup[],
  settings: LayoutSettings,
  calibration: PrintCalibration
): LayoutScheme {
  const schemes = getAllSchemes()
  const scheme: LayoutScheme = {
    id: Date.now().toString(),
    name,
    createdAt: Date.now(),
    patterns,
    patternConfigs,
    setGroups,
    settings,
    calibration
  }
  schemes.push(scheme)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(schemes))
  return scheme
}

export function getAllSchemes(): LayoutScheme[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    const raw = data ? JSON.parse(data) : []
    return raw.map((s: any) => normalizeScheme(s))
  } catch {
    return []
  }
}

export function deleteScheme(id: string): void {
  const schemes = getAllSchemes().filter(s => s.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(schemes))
}

export function loadScheme(id: string): LayoutScheme | null {
  const scheme = getAllSchemes().find(s => s.id === id)
  return scheme ? normalizeScheme(scheme) : null
}

function normalizeScheme(raw: any): LayoutScheme {
  return {
    id: String(raw.id || Date.now().toString()),
    name: String(raw.name || '未命名方案'),
    createdAt: Number(raw.createdAt || Date.now()),
    patterns: Array.isArray(raw.patterns) ? raw.patterns : [],
    patternConfigs: raw.patternConfigs && typeof raw.patternConfigs === 'object'
      ? raw.patternConfigs
      : {},
    setGroups: Array.isArray(raw.setGroups) ? raw.setGroups : [],
    settings: raw.settings && typeof raw.settings === 'object'
      ? raw.settings
      : {
          nailSize: 'M',
          nailShape: 'square',
          gapX: 2,
          gapY: 2,
          margin: 10,
          copiesPerNail: 5
        },
    calibration: raw.calibration && typeof raw.calibration === 'object'
      ? {
          enabled: Boolean(raw.calibration.enabled),
          referenceLengthMm: Number(raw.calibration.referenceLengthMm || 100),
          measuredHorizontalMm: Number(raw.calibration.measuredHorizontalMm || 100),
          measuredVerticalMm: Number(raw.calibration.measuredVerticalMm || 100),
          scaleX: Number(raw.calibration.scaleX || 1),
          scaleY: Number(raw.calibration.scaleY || 1)
        }
      : { ...DEFAULT_CALIBRATION }
  }
}
