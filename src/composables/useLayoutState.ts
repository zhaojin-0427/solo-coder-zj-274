import { ref, computed, watch } from 'vue'
import type {
  UploadedPattern,
  PatternIndependentConfig,
  SetGroup,
  LayoutSettings,
  PrintCalibration,
  PatternTransform,
  LayoutResult,
  OrderLayoutResult,
  LayoutConflictSuggestion,
  LayoutScheme,
  MaterialEstimate,
  PageLayoutInfo,
  LayoutConflict,
  PlacedPattern,
  PlacedPatternWithOrder,
  CustomerOrder,
  OrderLayoutProgress,
  PageBatchInfo,
  DeliveryWarning,
  NailSize,
  NailShape
} from '../types'
import type {
  UnifiedLayoutState,
  LayoutMode,
  LayoutEditorState,
  TransformActions,
  PatternConfigActions,
  CalibrationActions
} from '../types/unified'
import {
  calculateLayout,
  calculateOrderLayout,
  calculateMaterialEstimate,
  applyConflictSuggestion,
  detectLayoutConflicts
} from '../utils/layout'
import { DEFAULT_CALIBRATION, updateCalibrationFromMeasurements } from '../utils/calibration'
import {
  ensurePatternConfigs,
  updatePatternConfig,
  createSetGroup,
  assignPatternsToSetGroup,
  createDefaultPatternConfig,
  updateConfigShape,
  updateConfigSize
} from '../utils/patternConfig'
import { exportCalibrationRulerPDF } from '../utils/pdf'

const DEFAULT_LAYOUT_SETTINGS: LayoutSettings = {
  nailSize: 'M',
  nailShape: 'square',
  gapX: 2,
  gapY: 2,
  margin: 10,
  copiesPerNail: 5
}

export function useLayoutState(
  getOrders: () => CustomerOrder[],
  getSelectedOrderIds: () => string[]
) {
  const patterns = ref<UploadedPattern[]>([])
  const patternConfigs = ref<Record<string, PatternIndependentConfig>>({})
  const setGroups = ref<SetGroup[]>([])
  const selectedPlacementIndex = ref<number | null>(null)
  const previewMode = ref(false)

  const layoutSettings = ref<LayoutSettings>({ ...DEFAULT_LAYOUT_SETTINGS })
  const calibration = ref<PrintCalibration>({ ...DEFAULT_CALIBRATION })

  const pageRefs = ref<Map<number, HTMLElement>>(new Map())
  const currentPage = ref(0)

  const layoutMode = ref<LayoutMode>('normal')

  const layoutResult = ref<LayoutResult>({ placements: [], conflicts: [], pageInfo: [] })
  const orderLayoutResult = ref<OrderLayoutResult>({
    placements: [],
    conflicts: [],
    pageInfo: [],
    orderProgress: {},
    batchPageInfo: [],
    deliveryWarnings: []
  })

  watch(
    [patterns, layoutSettings, calibration],
    () => {
      patternConfigs.value = ensurePatternConfigs(
        patterns.value,
        patternConfigs.value,
        layoutSettings.value
      )
    },
    { immediate: true, deep: true }
  )

  watch(
    [patterns, patternConfigs, layoutSettings, calibration, () => layoutMode.value],
    () => {
      if (layoutMode.value === 'normal') {
        const preserved = new Map<string, PatternTransform>()
        for (const pl of layoutResult.value.placements) {
          const key = `${pl.patternId}-${pl.configIndex}`
          preserved.set(key, pl.transform)
        }
        const result = calculateLayout(
          patterns.value,
          patternConfigs.value,
          layoutSettings.value,
          calibration.value,
          preserved
        )
        layoutResult.value = result
        if (
          selectedPlacementIndex.value !== null &&
          selectedPlacementIndex.value >= result.placements.length
        ) {
          selectedPlacementIndex.value = null
        }
      }
    },
    { deep: true, immediate: true }
  )

  watch(
    [
      () => getOrders(),
      () => getSelectedOrderIds(),
      patterns,
      layoutSettings,
      calibration,
      () => layoutMode.value
    ],
    () => {
      if (layoutMode.value === 'order' || layoutMode.value === 'rework') {
        const orders = getOrders()
        const selectedOrderIds = getSelectedOrderIds()
        const selectedOrders = orders.filter(o => selectedOrderIds.includes(o.id))
        const preserved = new Map<string, PatternTransform>()
        for (const pl of orderLayoutResult.value.placements) {
          const key = `${pl.patternId}-${pl.configIndex}`
          preserved.set(key, pl.transform)
        }
        const result = calculateOrderLayout(
          selectedOrders,
          patterns.value,
          layoutSettings.value,
          calibration.value,
          preserved
        )
        orderLayoutResult.value = result
        if (
          selectedPlacementIndex.value !== null &&
          selectedPlacementIndex.value >= result.placements.length
        ) {
          selectedPlacementIndex.value = null
        }
        const maxPage = Math.max(0, ...result.placements.map(p => p.pageIndex))
        if (currentPage.value > maxPage) {
          currentPage.value = 0
        }
      }
    },
    { deep: true, immediate: true }
  )

  const layoutState = computed<UnifiedLayoutState>(() => {
    if (layoutMode.value === 'normal') {
      return { mode: 'normal', result: layoutResult.value }
    }
    return { mode: layoutMode.value, result: orderLayoutResult.value }
  })

  const placements = computed<PlacedPattern[]>(() => {
    if (layoutMode.value === 'normal') {
      return layoutResult.value.placements
    }
    return orderLayoutResult.value.placements as PlacedPattern[]
  })

  const orderPlacements = computed<PlacedPatternWithOrder[]>(() => {
    return orderLayoutResult.value.placements
  })

  const layoutConflicts = computed<LayoutConflict[]>(() => {
    if (layoutMode.value === 'normal') {
      return layoutResult.value.conflicts
    }
    return orderLayoutResult.value.conflicts
  })

  const pageInfo = computed<PageLayoutInfo[]>(() => {
    if (layoutMode.value === 'normal') {
      return layoutResult.value.pageInfo
    }
    return orderLayoutResult.value.pageInfo
  })

  const orderProgress = computed<Record<string, OrderLayoutProgress>>(() => {
    return orderLayoutResult.value.orderProgress
  })

  const batchPageInfo = computed<PageBatchInfo[]>(() => {
    return orderLayoutResult.value.batchPageInfo
  })

  const deliveryWarnings = computed<DeliveryWarning[]>(() => {
    return orderLayoutResult.value.deliveryWarnings
  })

  const estimate = computed<MaterialEstimate>(() => {
    return calculateMaterialEstimate(
      patterns.value,
      placements.value,
      patternConfigs.value,
      layoutSettings.value,
      calibration.value
    )
  })

  const selectedTransform = computed<PatternTransform>(() => {
    if (selectedPlacementIndex.value === null) {
      return { rotation: 0, mirrorX: false, mirrorY: false, invertColor: false }
    }
    return placements.value[selectedPlacementIndex.value].transform
  })

  function setMode(mode: LayoutMode) {
    layoutMode.value = mode
  }

  function handlePlacementSelect(index: number | null) {
    selectedPlacementIndex.value = index
    if (index !== null) {
      const pl = placements.value[index]
      if (pl) {
        currentPage.value = pl.pageIndex
      }
    }
  }

  function handlePageRefsReady(refs: Map<number, HTMLElement>) {
    pageRefs.value = refs
  }

  function rotateSelected(delta: number) {
    if (selectedPlacementIndex.value === null) return
    const placement = placements.value[selectedPlacementIndex.value]
    placement.transform.rotation = (placement.transform.rotation + delta + 360) % 360
  }

  function toggleMirrorX() {
    if (selectedPlacementIndex.value === null) return
    placements.value[selectedPlacementIndex.value].transform.mirrorX =
      !placements.value[selectedPlacementIndex.value].transform.mirrorX
  }

  function toggleMirrorY() {
    if (selectedPlacementIndex.value === null) return
    placements.value[selectedPlacementIndex.value].transform.mirrorY =
      !placements.value[selectedPlacementIndex.value].transform.mirrorY
  }

  function toggleInvertColor() {
    if (selectedPlacementIndex.value === null) return
    placements.value[selectedPlacementIndex.value].transform.invertColor =
      !placements.value[selectedPlacementIndex.value].transform.invertColor
  }

  function resetTransform() {
    if (selectedPlacementIndex.value === null) return
    placements.value[selectedPlacementIndex.value].transform = {
      rotation: 0,
      mirrorX: false,
      mirrorY: false,
      invertColor: false
    }
  }

  function handlePatternUpload(newPatterns: UploadedPattern[]) {
    patterns.value = [...patterns.value, ...newPatterns]
  }

  function handlePatternRemove(id: string) {
    patterns.value = patterns.value.filter(p => p.id !== id)
    const next: Record<string, PatternIndependentConfig> = {}
    for (const [pid, cfg] of Object.entries(patternConfigs.value)) {
      if (pid !== id) next[pid] = cfg
    }
    patternConfigs.value = next
    selectedPlacementIndex.value = null
  }

  function handleClearPatterns() {
    patterns.value = []
    patternConfigs.value = {}
    setGroups.value = []
    selectedPlacementIndex.value = null
  }

  function handlePatternConfigUpdate(
    patternId: string,
    patch: Partial<PatternIndependentConfig>
  ) {
    patternConfigs.value = updatePatternConfig(patternConfigs.value, patternId, patch)
  }

  function handleCreateSetGroup(name: string) {
    setGroups.value = [...setGroups.value, createSetGroup(name)]
  }

  function handleAssignSetGroup(patternIds: string[], groupId: string | null) {
    patternConfigs.value = assignPatternsToSetGroup(patternConfigs.value, patternIds, groupId)
  }

  function handleDeleteSetGroup(groupId: string) {
    setGroups.value = setGroups.value.filter(g => g.id !== groupId)
    const next: Record<string, PatternIndependentConfig> = {}
    for (const [pid, cfg] of Object.entries(patternConfigs.value)) {
      next[pid] = cfg.setGroupId === groupId ? { ...cfg, setGroupId: null } : cfg
    }
    patternConfigs.value = next
  }

  function handleUpdateNailSize(size: NailSize) {
    layoutSettings.value.nailSize = size
    patternConfigs.value = updateConfigSize(patternConfigs.value, size)
  }

  function handleUpdateNailShape(shape: NailShape) {
    layoutSettings.value.nailShape = shape
    patternConfigs.value = updateConfigShape(patternConfigs.value, shape)
  }

  function handleCalibrationUpdate(next: PrintCalibration) {
    calibration.value = next
  }

  async function handleExportCalibrationRuler() {
    try {
      await exportCalibrationRulerPDF()
    } catch (e) {
      console.error('导出校准尺失败:', e)
      alert('导出校准尺失败，请重试')
    }
  }

  function handleApplyConflictSuggestion(suggestion: LayoutConflictSuggestion) {
    const result = applyConflictSuggestion(
      layoutSettings.value,
      calibration.value,
      patternConfigs.value,
      suggestion
    )
    layoutSettings.value = result.settings
    calibration.value = result.calibration
    patternConfigs.value = result.patternConfigs
  }

  function handleLoadScheme(scheme: LayoutScheme) {
    patterns.value = scheme.patterns
    patternConfigs.value = scheme.patternConfigs || {}
    setGroups.value = scheme.setGroups || []
    layoutSettings.value = scheme.settings
    calibration.value = scheme.calibration || { ...DEFAULT_CALIBRATION }
  }

  function applyReworkPlacements(batchPlacements: PlacedPatternWithOrder[], batchPageInfoData: PageLayoutInfo[]) {
    orderLayoutResult.value = {
      placements: batchPlacements,
      conflicts: [],
      pageInfo: batchPageInfoData,
      orderProgress: {},
      batchPageInfo: [],
      deliveryWarnings: []
    }
  }

  function applyNormalPlacements(normalPlacements: PlacedPattern[], normalPageInfo: PageLayoutInfo[]) {
    layoutResult.value = {
      placements: normalPlacements,
      conflicts: [],
      pageInfo: normalPageInfo
    }
  }

  const editorState: LayoutEditorState = {
    patterns,
    patternConfigs,
    setGroups,
    layoutSettings,
    calibration,
    selectedPlacementIndex,
    previewMode,
    pageRefs,
    currentPage
  }

  const transformActions: TransformActions = {
    rotateSelected,
    toggleMirrorX,
    toggleMirrorY,
    toggleInvertColor,
    resetTransform
  }

  const patternActions: PatternConfigActions = {
    handlePatternUpload,
    handlePatternRemove,
    handleClearPatterns,
    handlePatternConfigUpdate,
    handleCreateSetGroup,
    handleAssignSetGroup,
    handleDeleteSetGroup,
    handleUpdateNailSize,
    handleUpdateNailShape
  }

  const calibrationActions: CalibrationActions = {
    handleCalibrationUpdate,
    handleExportCalibrationRuler
  }

  return {
    layoutMode,
    setMode,
    layoutState,
    placements,
    orderPlacements,
    layoutConflicts,
    pageInfo,
    orderProgress,
    batchPageInfo,
    deliveryWarnings,
    estimate,
    selectedTransform,
    editor: editorState,
    transform: transformActions,
    patterns: patternActions,
    calibration: calibrationActions,
    handlePlacementSelect,
    handlePageRefsReady,
    handleApplyConflictSuggestion,
    handleLoadScheme,
    applyReworkPlacements,
    applyNormalPlacements,
    createDefaultPatternConfig,
    detectLayoutConflicts,
    updateCalibrationFromMeasurements
  }
}
