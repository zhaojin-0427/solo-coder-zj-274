import type { Ref } from 'vue'
import type {
  PlacedPattern,
  PlacedPatternWithOrder,
  LayoutResult,
  OrderLayoutResult,
  UploadedPattern,
  PatternIndependentConfig,
  SetGroup,
  LayoutSettings,
  PrintCalibration,
  PatternTransform,
  CustomerOrder,
  ProductionBatch,
  QCInspectionSession,
  QCBatchStats,
  ReworkBatch
} from './index'

export type LayoutMode = 'normal' | 'order' | 'rework'

export interface NormalLayoutState {
  mode: 'normal'
  result: LayoutResult
}

export interface OrderLayoutState {
  mode: 'order'
  result: OrderLayoutResult
}

export interface ReworkLayoutState {
  mode: 'rework'
  result: OrderLayoutResult
  sourceSessionId?: string
}

export type UnifiedLayoutState = NormalLayoutState | OrderLayoutState | ReworkLayoutState

export function isOrderLayout(
  state: UnifiedLayoutState
): state is OrderLayoutState | ReworkLayoutState {
  return state.mode === 'order' || state.mode === 'rework'
}

export function getPlacements(
  state: UnifiedLayoutState
): PlacedPattern[] {
  if (state.mode === 'normal') {
    return state.result.placements
  }
  return state.result.placements as PlacedPattern[]
}

export function getOrderPlacements(
  state: UnifiedLayoutState
): PlacedPatternWithOrder[] {
  if (state.mode === 'normal') {
    return state.result.placements.map((p): PlacedPatternWithOrder => ({
      ...p,
      orderId: null,
      orderNo: null,
      orderColorTag: null,
      orderItemId: null
    }))
  }
  return state.result.placements
}

export interface LayoutEditorState {
  patterns: Ref<UploadedPattern[]>
  patternConfigs: Ref<Record<string, PatternIndependentConfig>>
  setGroups: Ref<SetGroup[]>
  layoutSettings: Ref<LayoutSettings>
  calibration: Ref<PrintCalibration>
  selectedPlacementIndex: Ref<number | null>
  previewMode: Ref<boolean>
  pageRefs: Ref<Map<number, HTMLElement>>
  currentPage: Ref<number>
}

export interface TransformActions {
  rotateSelected: (delta: number) => void
  toggleMirrorX: () => void
  toggleMirrorY: () => void
  toggleInvertColor: () => void
  resetTransform: () => void
}

export interface PatternConfigActions {
  handlePatternUpload: (newPatterns: UploadedPattern[]) => void
  handlePatternRemove: (id: string) => void
  handleClearPatterns: () => void
  handlePatternConfigUpdate: (
    patternId: string,
    patch: Partial<PatternIndependentConfig>
  ) => void
  handleCreateSetGroup: (name: string) => void
  handleAssignSetGroup: (patternIds: string[], groupId: string | null) => void
  handleDeleteSetGroup: (groupId: string) => void
  handleUpdateNailSize: (size: PatternIndependentConfig['nailSize']) => void
  handleUpdateNailShape: (shape: PatternIndependentConfig['nailShape']) => void
}

export interface CalibrationActions {
  handleCalibrationUpdate: (next: PrintCalibration) => void
  handleExportCalibrationRuler: () => Promise<void>
}

export interface ExportActions {
  isExporting: Ref<boolean>
  handleExportPDF: () => Promise<void>
  handleExportCalibrationRuler: () => Promise<void>
  handlePrint: () => void
}

export interface OrderBatchState {
  orders: Ref<CustomerOrder[]>
  selectedOrderIds: Ref<string[]>
  currentBatchName: Ref<string>
  showOrderTags: Ref<boolean>
}

export interface OrderBatchActions {
  handleOrdersChange: (newOrders: CustomerOrder[]) => void
  handleToggleSelectOrder: (orderId: string) => void
  handleBoostPriority: (orderId: string) => void
  handleCreateBatch: (orderIds: string[]) => void
  handleLoadBatch: (batch: ProductionBatch) => void
  handleSaveCurrentBatch: () => void
}

export interface QCState {
  qcMode: Ref<boolean>
  qcSession: Ref<QCInspectionSession | null>
  qcStats: Ref<QCBatchStats | null>
}

export interface QCActions {
  handleToggleQCMode: () => void
  handleQCStart: (session: QCInspectionSession) => void
  handleQCExit: () => void
  handleQCSessionChange: (session: QCInspectionSession) => void
  handleQCStatsChange: (stats: QCBatchStats) => void
  handleApplyReworkBatch: (batch: ReworkBatch) => void
  handleJumpToPage: (pageIndex: number) => void
}
