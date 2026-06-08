<script setup lang="ts">
import { ref, computed, watch, nextTick, reactive } from 'vue'
import type {
  UploadedPattern,
  NailSize,
  NailShape,
  LayoutSettings,
  PlacedPattern,
  MaterialEstimate,
  PatternTransform,
  PrintCalibration,
  PatternIndependentConfig,
  SetGroup,
  LayoutResult,
  LayoutConflict,
  PageLayoutInfo,
  LayoutConflictSuggestion,
  LayoutScheme,
  CustomerOrder,
  OrderLayoutResult,
  OrderLayoutProgress,
  PageBatchInfo,
  DeliveryWarning,
  PlacedPatternWithOrder,
  ProductionBatch
} from './types'
import {
  calculateLayout,
  calculateOrderLayout,
  calculateMaterialEstimate,
  applyConflictSuggestion
} from './utils/layout'
import { exportToPDF, exportToPDFWithOrderList, exportCalibrationRulerPDF } from './utils/pdf'
import { DEFAULT_CALIBRATION, updateCalibrationFromMeasurements } from './utils/calibration'
import {
  ensurePatternConfigs,
  updatePatternConfig,
  createSetGroup,
  assignPatternsToSetGroup,
  createDefaultPatternConfig,
  updateConfigShape,
  updateConfigSize
} from './utils/patternConfig'
import {
  getAllOrders,
  getAllBatches,
  saveBatch,
  boostOrderPriority,
  getOrderStatusLabel
} from './utils/order'
import type {
  QCInspectionSession,
  QCBatchStats,
  ReworkBatch
} from './types'
import QualityControlPanel from './components/QualityControlPanel.vue'
import PatternUploader from './components/PatternUploader.vue'
import PatternList from './components/PatternList.vue'
import NailSelector from './components/NailSelector.vue'
import LayoutSettingsPanel from './components/LayoutSettings.vue'
import PatternEditor from './components/PatternEditor.vue'
import MaterialEstimatePanel from './components/MaterialEstimate.vue'
import SchemeManager from './components/SchemeManager.vue'
import PrintCanvas from './components/PrintCanvas.vue'
import CalibrationPanel from './components/CalibrationPanel.vue'
import LayoutConflictPanel from './components/LayoutConflictPanel.vue'
import OrderManager from './components/OrderManager.vue'
import BatchManager from './components/BatchManager.vue'
import OrderSidebar from './components/OrderSidebar.vue'

type AppMode = 'normal' | 'order'
const appMode = ref<AppMode>('normal')
const showOrderTags = ref(true)
const currentBatchName = ref('')

const qcMode = ref(false)
const qcSession = ref<QCInspectionSession | null>(null)
const qcStats = ref<QCBatchStats | null>(null)

const patterns = ref<UploadedPattern[]>([])
const patternConfigs = ref<Record<string, PatternIndependentConfig>>({})
const setGroups = ref<SetGroup[]>([])
const selectedPlacementIndex = ref<number | null>(null)
const previewMode = ref(false)
const isExporting = ref(false)

const layoutSettings = ref<LayoutSettings>({
  nailSize: 'M',
  nailShape: 'square',
  gapX: 2,
  gapY: 2,
  margin: 10,
  copiesPerNail: 5
})

const calibration = ref<PrintCalibration>({ ...DEFAULT_CALIBRATION })

const orders = ref<CustomerOrder[]>(getAllOrders())
const selectedOrderIds = ref<string[]>([])
const currentPage = ref(0)

const pageRefs = ref<Map<number, HTMLElement>>(new Map())
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
  [patterns, patternConfigs, layoutSettings, calibration, () => appMode.value],
  () => {
    if (appMode.value === 'normal') {
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
  [orders, selectedOrderIds, patterns, layoutSettings, calibration, () => appMode.value],
  () => {
    if (appMode.value === 'order') {
      const selectedOrders = orders.value.filter(o => selectedOrderIds.value.includes(o.id))
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

const placements = computed<PlacedPattern[]>(() => {
  return appMode.value === 'order'
    ? orderLayoutResult.value.placements as PlacedPattern[]
    : layoutResult.value.placements
})

const orderPlacements = computed<PlacedPatternWithOrder[]>(() => {
  return orderLayoutResult.value.placements
})

const layoutConflicts = computed<LayoutConflict[]>(() => {
  return appMode.value === 'order'
    ? orderLayoutResult.value.conflicts
    : layoutResult.value.conflicts
})

const pageInfo = computed<PageLayoutInfo[]>(() => {
  return appMode.value === 'order'
    ? orderLayoutResult.value.pageInfo
    : layoutResult.value.pageInfo
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

const selectedOrders = computed(() => {
  return orders.value.filter(o => selectedOrderIds.value.includes(o.id))
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

function handleCalibrationUpdate(next: PrintCalibration) {
  calibration.value = next
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

function handleUpdateNailSize(size: NailSize) {
  layoutSettings.value.nailSize = size
  patternConfigs.value = updateConfigSize(patternConfigs.value, size)
}

function handleUpdateNailShape(shape: NailShape) {
  layoutSettings.value.nailShape = shape
  patternConfigs.value = updateConfigShape(patternConfigs.value, shape)
}

function handleLoadScheme(scheme: LayoutScheme) {
  patterns.value = scheme.patterns
  patternConfigs.value = scheme.patternConfigs || {}
  setGroups.value = scheme.setGroups || []
  layoutSettings.value = scheme.settings
  calibration.value = scheme.calibration || { ...DEFAULT_CALIBRATION }
}

function handleOrdersChange(newOrders: CustomerOrder[]) {
  orders.value = newOrders
}

function handleToggleSelectOrder(orderId: string) {
  if (selectedOrderIds.value.includes(orderId)) {
    selectedOrderIds.value = selectedOrderIds.value.filter(id => id !== orderId)
  } else {
    selectedOrderIds.value = [...selectedOrderIds.value, orderId]
  }
}

function handleBoostPriority(orderId: string) {
  orders.value = boostOrderPriority(orderId)
}

function handleCreateBatch(orderIds: string[]) {
  selectedOrderIds.value = orderIds
  currentBatchName.value = `生产批次 - ${new Date().toLocaleDateString()}`
}

function handleLoadBatch(batch: ProductionBatch) {
  selectedOrderIds.value = batch.orderIds
  layoutSettings.value = batch.settings
  calibration.value = batch.calibration
  currentBatchName.value = batch.name
  orderLayoutResult.value = {
    placements: batch.placements as PlacedPatternWithOrder[],
    conflicts: [],
    pageInfo: batch.pageInfo,
    orderProgress: {},
    batchPageInfo: batch.batchPageInfo,
    deliveryWarnings: []
  }
}

function handleSaveCurrentBatch() {
  if (selectedOrderIds.value.length === 0) {
    alert('请先选择要合并的订单')
    return
  }
  if (!currentBatchName.value.trim()) {
    currentBatchName.value = `生产批次 - ${new Date().toLocaleDateString()}`
  }
  const existingBatches = getAllBatches()
  const batch: ProductionBatch = {
    id: existingBatches.length > 0 ? `${Date.now()}` : Date.now().toString(),
    name: currentBatchName.value,
    orderIds: [...selectedOrderIds.value],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    placements: [...orderPlacements.value],
    pageInfo: [...pageInfo.value],
    batchPageInfo: [...batchPageInfo.value],
    settings: { ...layoutSettings.value },
    calibration: { ...calibration.value }
  }
  saveBatch(batch)
  alert('批次已保存到本地')
}

async function handleExportPDF() {
  if (placements.value.length === 0) {
    alert('请先上传图案进行排版')
    return
  }
  isExporting.value = true
  try {
    await nextTick()
    if (appMode.value === 'order' && selectedOrders.value.length > 0) {
      await exportToPDFWithOrderList(
        pageRefs.value,
        calibration.value,
        selectedOrders.value,
        orderPlacements.value,
        orderProgress.value,
        currentBatchName.value
      )
    } else {
      await exportToPDF(pageRefs.value, calibration.value)
    }
  } catch (e) {
    console.error('导出PDF失败:', e)
    alert('导出PDF失败，请重试')
  } finally {
    isExporting.value = false
  }
}

async function handleExportCalibrationRuler() {
  try {
    await exportCalibrationRulerPDF()
  } catch (e) {
    console.error('导出校准尺失败:', e)
    alert('导出校准尺失败，请重试')
  }
}

function handlePrint() {
  window.print()
}

function handleToggleQCMode() {
  if (!qcMode.value) {
    if (placements.value.length === 0) {
      alert('请先进行排版后再开始质检')
      return
    }
  }
  qcMode.value = !qcMode.value
  if (!qcMode.value) {
    qcSession.value = null
    qcStats.value = null
  }
}

function handleQCStart(session: QCInspectionSession) {
  qcSession.value = session
  qcMode.value = true
}

function handleQCExit() {
  qcSession.value = null
  qcStats.value = null
  qcMode.value = false
}

function handleQCSessionChange(session: QCInspectionSession) {
  qcSession.value = session
}

function handleQCStatsChange(stats: QCBatchStats) {
  qcStats.value = stats
}

function handleApplyReworkBatch(batch: ReworkBatch) {
  if (batch.placements.length > 0) {
    if (appMode.value === 'order') {
      orderLayoutResult.value = {
        placements: batch.placements,
        conflicts: [],
        pageInfo: batch.pageInfo,
        orderProgress: {},
        batchPageInfo: [],
        deliveryWarnings: []
      }
    } else {
      layoutResult.value = {
        placements: batch.placements as any,
        conflicts: [],
        pageInfo: batch.pageInfo
      }
    }
    layoutSettings.value = batch.settings
    calibration.value = batch.calibration
    currentBatchName.value = batch.name
    qcMode.value = false
    qcSession.value = null
    qcStats.value = null
  }
}

function handleJumpToPage(pageIndex: number) {
  currentPage.value = pageIndex
}
</script>

<template>
  <div class="h-full flex flex-col bg-gray-100">
    <header class="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 bg-gradient-to-br from-primary-400 to-primary-600 rounded-lg flex items-center justify-center">
          <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
        </div>
        <div>
          <h1 class="text-lg font-bold text-gray-800">美甲贴纸排版预览器</h1>
          <p class="text-xs text-gray-500">智能排版 · 校准打印 · 批量套图 · 节约耗材</p>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <div class="flex bg-gray-100 rounded-lg p-0.5">
          <button
            :class="[
              'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
              appMode === 'normal'
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            ]"
            @click="appMode = 'normal'"
          >
            普通排版
          </button>
          <button
            :class="[
              'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
              appMode === 'order'
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            ]"
            @click="appMode = 'order'"
          >
            订单生产
          </button>
        </div>

        <template v-if="appMode === 'order'">
          <label class="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              v-model="showOrderTags"
              class="w-4 h-4 accent-primary-500"
            />
            显示订单标签
          </label>
        </template>

        <button
          :class="[
            'px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
            qcMode
              ? 'bg-purple-600 hover:bg-purple-700 text-white'
              : 'bg-purple-50 hover:bg-purple-100 text-purple-700'
          ]"
          title="打印质检与返工追踪"
          @click="handleToggleQCMode"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {{ qcMode ? '质检模式' : '质检与返工' }}
        </button>

        <button
          class="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          title="打印校准尺"
          @click="handleExportCalibrationRuler"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          打印校准尺
        </button>
        <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            v-model="previewMode"
            class="w-4 h-4 accent-primary-500"
          />
          预览模式
        </label>
        <button
          class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          @click="handlePrint"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          打印
        </button>
        <button
          class="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="isExporting || placements.length === 0"
          @click="handleExportPDF"
        >
          <svg v-if="!isExporting" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <svg v-else class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {{ isExporting ? '导出中...' : appMode === 'order' && selectedOrders.length > 0 ? '导出 PDF(含分拣单)' : '导出 PDF' }}
        </button>
      </div>
    </header>

    <div class="flex-1 flex overflow-hidden">
      <aside class="w-80 bg-white border-r border-gray-200 overflow-y-auto scrollbar-thin flex-shrink-0">
        <template v-if="qcMode">
          <QualityControlPanel
            :placements="placements"
            :patterns="patterns"
            :orders="orders"
            :selected-order-ids="selectedOrderIds"
            :current-batch-name="currentBatchName"
            :app-mode="appMode"
            :selected-placement-index="selectedPlacementIndex"
            :layout-settings="layoutSettings"
            :calibration="calibration"
            @update:selected-placement-index="selectedPlacementIndex = $event"
            @start-qc="handleQCStart"
            @exit-qc="handleQCExit"
            @apply-rework-batch="handleApplyReworkBatch"
            @session-change="handleQCSessionChange"
            @stats-change="handleQCStatsChange"
            @jump-to-page="handleJumpToPage"
          />
        </template>
        <template v-else-if="appMode === 'normal'">
          <PatternUploader @upload="handlePatternUpload" />
          <PatternList
            :patterns="patterns"
            :pattern-configs="patternConfigs"
            :set-groups="setGroups"
            :default-config="createDefaultPatternConfig(layoutSettings)"
            @remove="handlePatternRemove"
            @clear="handleClearPatterns"
            @update-config="handlePatternConfigUpdate"
            @create-set-group="handleCreateSetGroup"
            @assign-set-group="handleAssignSetGroup"
            @delete-set-group="handleDeleteSetGroup"
          />
          <NailSelector
            :selected-size="layoutSettings.nailSize"
            :selected-shape="layoutSettings.nailShape"
            @update:selected-size="handleUpdateNailSize"
            @update:selected-shape="handleUpdateNailShape"
          />
          <LayoutSettingsPanel
            :settings="layoutSettings"
            @update:settings="(s: LayoutSettings) => layoutSettings = s"
          />
          <CalibrationPanel
            :calibration="calibration"
            @update="handleCalibrationUpdate"
            @export-ruler="handleExportCalibrationRuler"
          />
          <PatternEditor
            :transform="selectedTransform"
            :has-selection="selectedPlacementIndex !== null"
            @rotate="rotateSelected"
            @mirror-x="toggleMirrorX"
            @mirror-y="toggleMirrorY"
            @invert-color="toggleInvertColor"
            @reset="resetTransform"
          />
          <MaterialEstimatePanel :estimate="estimate" />
          <LayoutConflictPanel
            :conflicts="layoutConflicts"
            @apply-suggestion="handleApplyConflictSuggestion"
          />
          <SchemeManager
            :current-patterns="patterns"
            :current-pattern-configs="patternConfigs"
            :current-set-groups="setGroups"
            :current-settings="layoutSettings"
            :current-calibration="calibration"
            @load="handleLoadScheme"
          />
        </template>

        <template v-else>
          <PatternUploader @upload="handlePatternUpload" />
          <OrderManager
            :patterns="patterns"
            :selected-order-ids="selectedOrderIds"
            @orders-change="handleOrdersChange"
            @toggle-select-order="handleToggleSelectOrder"
            @boost-priority="handleBoostPriority"
          />
          <BatchManager
            :orders="orders"
            :selected-order-ids="selectedOrderIds"
            :settings="layoutSettings"
            :calibration="calibration"
            :placements="orderPlacements"
            :page-info="pageInfo"
            :batch-page-info="batchPageInfo"
            @create-batch="handleCreateBatch"
            @load-batch="handleLoadBatch"
            @save-current-batch="handleSaveCurrentBatch"
          />
          <NailSelector
            :selected-size="layoutSettings.nailSize"
            :selected-shape="layoutSettings.nailShape"
            @update:selected-size="handleUpdateNailSize"
            @update:selected-shape="handleUpdateNailShape"
          />
          <LayoutSettingsPanel
            :settings="layoutSettings"
            @update:settings="(s: LayoutSettings) => layoutSettings = s"
          />
          <CalibrationPanel
            :calibration="calibration"
            @update="handleCalibrationUpdate"
            @export-ruler="handleExportCalibrationRuler"
          />
          <PatternEditor
            :transform="selectedTransform"
            :has-selection="selectedPlacementIndex !== null"
            @rotate="rotateSelected"
            @mirror-x="toggleMirrorX"
            @mirror-y="toggleMirrorY"
            @invert-color="toggleInvertColor"
            @reset="resetTransform"
          />
          <MaterialEstimatePanel :estimate="estimate" />
          <LayoutConflictPanel
            :conflicts="layoutConflicts"
            @apply-suggestion="handleApplyConflictSuggestion"
          />
        </template>
      </aside>

      <main class="flex-1 overflow-auto bg-gray-100 scrollbar-thin">
        <div class="h-full flex">
          <div class="flex-1 overflow-auto">
            <PrintCanvas
              :placements="placements"
              :patterns="patterns"
              :pattern-configs="patternConfigs"
              :set-groups="setGroups"
              :selected-placement-index="selectedPlacementIndex"
              :page-info="pageInfo"
              :preview-mode="previewMode"
              :calibration="calibration"
              :orders="appMode === 'order' ? selectedOrders : undefined"
              :batch-page-info="appMode === 'order' ? batchPageInfo : undefined"
              :show-order-tags="appMode === 'order' && showOrderTags"
              :qc-session="qcSession"
              :qc-mode="qcMode"
              @select="handlePlacementSelect"
              @page-refs-ready="handlePageRefsReady"
            />
          </div>

          <template v-if="appMode === 'order' || qcMode">
            <div class="w-72 bg-white border-l border-gray-200 overflow-y-auto scrollbar-thin flex-shrink-0">
              <OrderSidebar
                :orders="selectedOrders"
                :placements="orderPlacements"
                :order-progress="orderProgress"
                :batch-page-info="batchPageInfo"
                :delivery-warnings="deliveryWarnings"
                :current-page="currentPage"
                :qc-session="qcSession"
                :qc-mode="qcMode"
                @boost-priority="handleBoostPriority"
                @select-order="(id) => handleToggleSelectOrder(id)"
              />
            </div>
          </template>
        </div>
      </main>
    </div>
  </div>
</template>
