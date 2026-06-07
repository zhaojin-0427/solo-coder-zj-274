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
}

export interface LayoutScheme {
  id: string
  name: string
  createdAt: number
  patterns: UploadedPattern[]
  settings: LayoutSettings
}

export interface MaterialEstimate {
  totalPatterns: number
  totalArea: number
  paperUsage: number
  estimatedWaste: number
  pagesNeeded: number
}
