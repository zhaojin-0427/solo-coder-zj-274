export type NailSize = 'XS' | 'S' | 'M' | 'L'

export type NailShape = 'square' | 'round' | 'oval' | 'almond' | 'stiletto' | 'coffin'

export interface NailDimensions {
  width: number
  height: number
}

export interface NailSizeConfig {
  label: string
  dimensions: NailDimensions
}

export interface NailShapeConfig {
  label: string
  icon: string
}

export interface UploadedPattern {
  id: string
  name: string
  dataUrl: string
  width: number
  height: number
}

export interface PatternTransform {
  rotation: number
  mirrorX: boolean
  mirrorY: boolean
  invertColor: boolean
}

export interface PrintCalibration {
  enabled: boolean
  referenceLengthMm: number
  measuredHorizontalMm: number
  measuredVerticalMm: number
  scaleX: number
  scaleY: number
}

export interface PatternIndependentConfig {
  nailSize: NailSize
  nailShape: NailShape
  quantity: number
  priority: number
  setGroupId: string | null
}

export interface SetGroup {
  id: string
  name: string
  color: string
}

export interface LayoutSettings {
  nailSize: NailSize
  nailShape: NailShape
  gapX: number
  gapY: number
  margin: number
  copiesPerNail: number
}

export interface PlacedPattern {
  patternId: string
  x: number
  y: number
  width: number
  height: number
  transform: PatternTransform
  pageIndex: number
  nailSize: NailSize
  nailShape: NailShape
  setGroupId: string | null
  configIndex: number
}

export type LayoutConflictType =
  | 'pattern_too_wide'
  | 'pattern_too_tall'
  | 'margin_too_large'
  | 'gap_too_large'
  | 'no_patterns_fit'

export interface LayoutConflictSuggestion {
  description: string
  settingKey: keyof LayoutSettings | 'calibration'
  recommendedValue: number | boolean
}

export interface LayoutConflict {
  type: LayoutConflictType
  message: string
  affectedPatternIds: string[]
  suggestions: LayoutConflictSuggestion[]
}

export interface PageLayoutInfo {
  pageIndex: number
  totalCells: number
  usedCells: number
  wasteAreaMm2: number
  estimatedStickers: number
  setCompletion: Record<string, { total: number; placed: number; complete: boolean }>
  incompleteSets: string[]
}

export interface LayoutResult {
  placements: PlacedPattern[]
  conflicts: LayoutConflict[]
  pageInfo: PageLayoutInfo[]
}

export interface LayoutScheme {
  id: string
  name: string
  createdAt: number
  patterns: UploadedPattern[]
  patternConfigs: Record<string, PatternIndependentConfig>
  setGroups: SetGroup[]
  settings: LayoutSettings
  calibration: PrintCalibration
}

export interface MaterialEstimate {
  totalPatterns: number
  totalArea: number
  paperUsage: number
  estimatedWaste: number
  pagesNeeded: number
}
