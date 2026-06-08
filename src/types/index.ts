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

export type OrderStatus = 'pending_layout' | 'layout_done' | 'printed' | 'delivered'

export interface OrderPatternItem {
  id: string
  patternId: string
  patternName: string
  nailSize: NailSize
  nailShape: NailShape
  quantity: number
  priority: number
  setGroupId: string | null
}

export interface CustomerOrder {
  id: string
  orderNo: string
  customerName: string
  deliveryDate: string
  isUrgent: boolean
  notes: string
  requiresFullSet: boolean
  status: OrderStatus
  items: OrderPatternItem[]
  colorTag: string
  createdAt: number
  updatedAt: number
  batchId: string | null
}

export interface OrderLayoutProgress {
  orderId: string
  totalItems: number
  placedItems: number
  completionPercent: number
  isComplete: boolean
  missingItems: OrderPatternItem[]
  atRiskItems: OrderPatternItem[]
}

export interface BatchOrderInfo {
  orderId: string
  pages: number[]
  placedCount: number
  totalCount: number
}

export interface PageBatchInfo {
  pageIndex: number
  orders: BatchOrderInfo[]
  estimatedSortTimeSeconds: number
  riskLevel: 'low' | 'medium' | 'high'
}

export interface ProductionBatch {
  id: string
  name: string
  orderIds: string[]
  createdAt: number
  updatedAt: number
  placements: PlacedPattern[]
  pageInfo: PageLayoutInfo[]
  batchPageInfo: PageBatchInfo[]
  settings: LayoutSettings
  calibration: PrintCalibration
}

export interface DeliveryWarning {
  orderId: string
  orderNo: string
  customerName: string
  deliveryDate: string
  daysRemaining: number
  completionPercent: number
  isUrgent: boolean
  suggestion: string
}

export interface PlacedPatternWithOrder extends PlacedPattern {
  orderId: string | null
  orderNo: string | null
  orderColorTag: string | null
  orderItemId: string | null
}

export interface OrderLayoutResult extends LayoutResult {
  placements: PlacedPatternWithOrder[]
  orderProgress: Record<string, OrderLayoutProgress>
  batchPageInfo: PageBatchInfo[]
  deliveryWarnings: DeliveryWarning[]
}

export type QCDefectType =
  | 'color_deviation'
  | 'size_deviation'
  | 'missing_print'
  | 'cutting_risk'
  | 'sticker_damaged'
  | 'label_unclear'
  | 'other'

export interface QCDefectTypeInfo {
  type: QCDefectType
  label: string
  color: string
  icon: string
}

export type QCItemStatus = 'pending' | 'passed' | 'failed'

export interface QCPatternCheck {
  placementGlobalIndex: number
  patternId: string
  pageIndex: number
  orderId: string | null
  orderItemId: string | null
  status: QCItemStatus
  defects: QCDefectType[]
  notes: string
  checkedAt: number | null
}

export interface QCPageCheck {
  pageIndex: number
  status: QCItemStatus
  defects: QCDefectType[]
  notes: string
  checkedAt: number | null
  patternChecks: Record<number, QCPatternCheck>
}

export interface QCOrderCheck {
  orderId: string
  status: QCItemStatus
  defectCounts: Record<QCDefectType, number>
  totalItems: number
  checkedItems: number
  passedItems: number
  failedItems: number
  notes: string
}

export interface QCBatchStats {
  totalPages: number
  checkedPages: number
  passedPages: number
  failedPages: number
  totalPatterns: number
  checkedPatterns: number
  passedPatterns: number
  failedPatterns: number
  passRate: number
  affectedOrderIds: string[]
  estimatedReprintPages: number
  extraMaterialCost: number
  defectBreakdown: Record<QCDefectType, number>
}

export interface QCInspectionSession {
  id: string
  batchId: string | null
  batchName: string
  sourceType: 'normal' | 'order'
  createdAt: number
  updatedAt: number
  pageChecks: Record<number, QCPageCheck>
  orderChecks: Record<string, QCOrderCheck>
  isCompleted: boolean
  completedAt: number | null
}

export interface ReworkBatch {
  id: string
  name: string
  sourceSessionId: string
  sourceBatchId: string | null
  createdAt: number
  reworkItems: Array<{
    patternId: string
    orderId: string | null
    orderItemId: string | null
    quantity: number
    nailSize: NailSize
    nailShape: NailShape
    defects: QCDefectType[]
  }>
  placements: PlacedPatternWithOrder[]
  pageInfo: PageLayoutInfo[]
  settings: LayoutSettings
  calibration: PrintCalibration
  isGenerated: boolean
}

export interface ReworkItemInput {
  patternId: string
  patternName: string
  nailSize: NailSize
  nailShape: NailShape
  orderId: string | null
  orderItemId: string | null
  quantity: number
}

export interface QCMaterialCostConfig {
  a4SheetCost: number
  inkCostPerPage: number
  laborCostPerSheet: number
}
