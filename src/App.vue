<script setup lang="ts">
import { computed, ref } from 'vue'
import type { LayoutMode } from './types/unified'
import { useLayoutState } from './composables/useLayoutState'
import { useOrderBatchState } from './composables/useOrderBatchState'
import { useQualityControlState } from './composables/useQualityControlState'
import { useExportActions } from './composables/useExportActions'
import { usePrintViewState } from './composables/usePrintViewState'
import type { ReworkBatch, PageLayoutInfo, PlacedPattern, UploadedPattern, PatternIndependentConfig, OrderPatternItem, PrintViewMode } from './types'
import QualityControlPanel from './components/QualityControlPanel.vue'
import PatternUploader from './components/PatternUploader.vue'
import PatternList from './components/PatternList.vue'
import NailSelector from './components/NailSelector.vue'
import LayoutSettingsPanel from './components/LayoutSettings.vue'
import PatternEditor from './components/PatternEditor.vue'
import MaterialEstimatePanel from './components/MaterialEstimate.vue'
import SchemeManager from './components/SchemeManager.vue'
import PrintCanvas from './components/PrintCanvas.vue'
import DeliveryLabelsCanvas from './components/DeliveryLabelsCanvas.vue'
import PackingListCanvas from './components/PackingListCanvas.vue'
import CalibrationPanel from './components/CalibrationPanel.vue'
import LayoutConflictPanel from './components/LayoutConflictPanel.vue'
import OrderManager from './components/OrderManager.vue'
import BatchManager from './components/BatchManager.vue'
import OrderSidebar from './components/OrderSidebar.vue'
import MaterialLibraryPanel from './components/MaterialLibraryPanel.vue'
import SaveMaterialDialog from './components/SaveMaterialDialog.vue'
import { addItemsToOrder } from './utils/order'
import { createMaterial } from './utils/materialLibrary'

const layout = useLayoutState(
  () => orderBatch.orders.value,
  () => orderBatch.selectedOrderIds.value
)

const orderBatch = useOrderBatchState(
  () => layout.orderPlacements.value,
  () => layout.pageInfo.value,
  () => layout.batchPageInfo.value,
  () => layout.editor.layoutSettings.value,
  () => layout.editor.calibration.value
)

function onApplyReworkBatch(batch: ReworkBatch) {
  if (batch.placements.length > 0) {
    if (layout.layoutMode.value === 'order' || layout.layoutMode.value === 'rework') {
      layout.applyReworkPlacements(batch.placements, batch.pageInfo)
    } else {
      const normalPlacements: PlacedPattern[] = batch.placements.map(p => ({
        patternId: p.patternId,
        x: p.x,
        y: p.y,
        width: p.width,
        height: p.height,
        transform: p.transform,
        pageIndex: p.pageIndex,
        nailSize: p.nailSize,
        nailShape: p.nailShape,
        setGroupId: p.setGroupId,
        configIndex: p.configIndex
      }))
      const normalPageInfo: PageLayoutInfo[] = batch.pageInfo
      layout.applyNormalPlacements(normalPlacements, normalPageInfo)
    }
    layout.editor.layoutSettings.value.nailSize = batch.settings.nailSize
    layout.editor.layoutSettings.value.nailShape = batch.settings.nailShape
    layout.editor.layoutSettings.value.gapX = batch.settings.gapX
    layout.editor.layoutSettings.value.gapY = batch.settings.gapY
    layout.editor.layoutSettings.value.margin = batch.settings.margin
    layout.editor.layoutSettings.value.copiesPerNail = batch.settings.copiesPerNail

    layout.editor.calibration.value.enabled = batch.calibration.enabled
    layout.editor.calibration.value.referenceLengthMm = batch.calibration.referenceLengthMm
    layout.editor.calibration.value.measuredHorizontalMm = batch.calibration.measuredHorizontalMm
    layout.editor.calibration.value.measuredVerticalMm = batch.calibration.measuredVerticalMm
    layout.editor.calibration.value.scaleX = batch.calibration.scaleX
    layout.editor.calibration.value.scaleY = batch.calibration.scaleY

    orderBatch.currentBatchName.value = batch.name
    qc.qcMode.value = false
    qc.qcSession.value = null
    qc.qcStats.value = null
  }
}

const qc = useQualityControlState(
  () => layout.placements.value,
  () => layout.editor.patterns.value,
  () => orderBatch.orders.value,
  () => orderBatch.selectedOrderIds.value,
  () => orderBatch.currentBatchName.value,
  () => layout.layoutMode.value,
  () => layout.editor.layoutSettings.value,
  () => layout.editor.calibration.value,
  onApplyReworkBatch
)

const exportActions = useExportActions(
  () => layout.editor.pageRefs.value,
  () => layout.editor.calibration.value,
  () => layout.layoutMode.value,
  () => orderBatch.selectedOrders.value,
  () => layout.orderPlacements.value,
  () => layout.orderProgress.value,
  () => orderBatch.currentBatchName.value,
  () => layout.placements.value.length
)

const printView = usePrintViewState(
  () => orderBatch.orders.value,
  () => layout.orderPlacements.value,
  () => qc.qcSession.value
)

const appMode = computed<'normal' | 'order'>(() => {
  return layout.layoutMode.value === 'normal' ? 'normal' : 'order'
})

function handleSetPrintViewMode(mode: PrintViewMode) {
  printView.handleSetPrintViewMode(mode)
}

function handleGenerateDeliveryLabels(orderIds: string[]) {
  printView.handleGenerateDeliveryLabels(orderIds)
}

function handleGeneratePackingList(orderIds: string[]) {
  printView.handleGeneratePackingList(orderIds)
}

const pvPrintViewMode = computed(() => printView.printViewMode.value)
const pvDeliveryLabelConfig = computed(() => printView.deliveryLabelConfig.value)
const pvGeneratedDeliveryLabels = computed(() => printView.generatedDeliveryLabels.value)
const pvGeneratedPackingList = computed(() => printView.generatedPackingList.value)

function setAppMode(mode: 'normal' | 'order') {
  layout.setMode(mode as LayoutMode)
}

function handleJumpToPage(pageIndex: number) {
  layout.editor.currentPage.value = pageIndex
}

function handleUpdateSelectedPlacementIndex(index: number | null) {
  layout.editor.selectedPlacementIndex.value = index
}

const editorLayoutSettings = computed(() => layout.editor.layoutSettings.value)
const editorCalibration = computed(() => layout.editor.calibration.value)
const editorPatterns = computed(() => layout.editor.patterns.value)
const editorPatternConfigs = computed(() => layout.editor.patternConfigs.value)
const editorSetGroups = computed(() => layout.editor.setGroups.value)
const editorSelectedPlacementIndex = computed(() => layout.editor.selectedPlacementIndex.value)
const editorPreviewMode = computed({
  get: () => layout.editor.previewMode.value,
  set: (v: boolean) => { layout.editor.previewMode.value = v }
})
const editorCurrentPage = computed(() => layout.editor.currentPage.value)

const layoutPlacements = computed(() => layout.placements.value)
const layoutPageInfo = computed(() => layout.pageInfo.value)
const layoutBatchPageInfo = computed(() => layout.batchPageInfo.value)
const layoutOrderPlacements = computed(() => layout.orderPlacements.value)
const layoutOrderProgress = computed(() => layout.orderProgress.value)
const layoutEstimate = computed(() => layout.estimate.value)
const layoutConflicts = computed(() => layout.layoutConflicts.value)
const layoutDeliveryWarnings = computed(() => layout.deliveryWarnings.value)
const layoutSelectedTransform = computed(() => layout.selectedTransform.value)
const layoutLayoutMode = computed(() => layout.layoutMode.value)

const obOrders = computed(() => orderBatch.orders.value)
const obSelectedOrderIds = computed(() => orderBatch.selectedOrderIds.value)
const obCurrentBatchName = computed(() => orderBatch.currentBatchName.value)
const obShowOrderTags = computed({
  get: () => orderBatch.showOrderTags.value,
  set: (v: boolean) => { orderBatch.showOrderTags.value = v }
})
const obSelectedOrders = computed(() => orderBatch.selectedOrders.value)

const qcMode = computed(() => qc.qcMode.value)
const qcSession = computed(() => qc.qcSession.value)
const qcStats = computed(() => qc.qcStats.value)

const expIsExporting = computed(() => exportActions.isExporting.value)

const saveDialogVisible = ref(false)
const saveDialogPattern = ref<UploadedPattern | null>(null)
const saveDialogDefaultConfig = ref<PatternIndependentConfig | null>(null)
const materialLibraryVersion = ref(0)

function handleSaveToLibrary(patternId: string) {
  const pat = layout.editor.patterns.value.find(p => p.id === patternId)
  if (!pat) return
  saveDialogPattern.value = pat
  saveDialogDefaultConfig.value = layout.editor.patternConfigs.value[patternId] || null
  saveDialogVisible.value = true
}

function handleBatchSaveToLibrary(patternIds: string[]) {
  let count = 0
  for (const pid of patternIds) {
    const pat = layout.editor.patterns.value.find(p => p.id === pid)
    if (!pat) continue
    const cfg = layout.editor.patternConfigs.value[pid]
    createMaterial({
      name: pat.name.replace(/\.[^/.]+$/, ''),
      tags: [],
      dataUrl: pat.dataUrl,
      width: pat.width,
      height: pat.height,
      defaultNailSize: cfg?.nailSize || 'M',
      defaultNailShape: cfg?.nailShape || 'square',
      defaultQuantity: cfg?.quantity || 5
    })
    count++
  }
  materialLibraryVersion.value++
  if (count > 0) {
    alert(`已将 ${count} 个图案保存到素材库`)
  }
}

function handleMaterialSaved() {
  materialLibraryVersion.value++
}

function handleAddPatternsFromLibrary(
  newPatterns: UploadedPattern[],
  configs: Record<string, PatternIndependentConfig>
) {
  const existing = layout.editor.patterns.value
  layout.editor.patterns.value = [...existing, ...newPatterns]
  const mergedConfigs = { ...layout.editor.patternConfigs.value }
  for (const [pid, cfg] of Object.entries(configs)) {
    mergedConfigs[pid] = cfg
  }
  layout.editor.patternConfigs.value = mergedConfigs
}

function handleAddOrderItemsFromLibrary(
  orderId: string,
  patterns: UploadedPattern[],
  items: OrderPatternItem[]
) {
  const existing = layout.editor.patterns.value
  const existingIds = new Set(existing.map(p => p.id))
  const toAdd = patterns.filter(p => !existingIds.has(p.id))
  if (toAdd.length > 0) {
    layout.editor.patterns.value = [...existing, ...toAdd]
  }
  const updated = addItemsToOrder(orderId, items)
  orderBatch.handleOrdersChange(updated)
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
            @click="setAppMode('normal')"
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
            @click="setAppMode('order')"
          >
            订单生产
          </button>
        </div>

        <template v-if="appMode === 'order'">
          <label class="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              v-model="obShowOrderTags"
              class="w-4 h-4 accent-primary-500"
            />
            显示订单标签
          </label>

          <div class="flex bg-gray-100 rounded-lg p-0.5">
            <button
              :class="[
                'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                pvPrintViewMode === 'stickers'
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              ]"
              @click="handleSetPrintViewMode('stickers')"
            >
              贴纸排版
            </button>
            <button
              :class="[
                'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                pvPrintViewMode === 'delivery_labels'
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              ]"
              @click="handleSetPrintViewMode('delivery_labels')"
            >
              交付标签
            </button>
            <button
              :class="[
                'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                pvPrintViewMode === 'packing_list'
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              ]"
              @click="handleSetPrintViewMode('packing_list')"
            >
              包装清单
            </button>
          </div>
        </template>

        <button
          :class="[
            'px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
            qcMode
              ? 'bg-purple-600 hover:bg-purple-700 text-white'
              : 'bg-purple-50 hover:bg-purple-100 text-purple-700'
          ]"
          title="打印质检与返工追踪"
          @click="qc.handleToggleQCMode"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {{ qcMode ? '质检模式' : '质检与返工' }}
        </button>

        <button
          class="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          title="打印校准尺"
          @click="exportActions.handleExportCalibrationRuler"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          打印校准尺
        </button>
        <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            v-model="editorPreviewMode"
            class="w-4 h-4 accent-primary-500"
          />
          预览模式
        </label>
        <button
          class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          @click="exportActions.handlePrint"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          打印
        </button>
        <template v-if="appMode === 'order' && pvPrintViewMode === 'delivery_labels'">
          <button
            class="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="pvGeneratedDeliveryLabels.length === 0"
            @click="printView.handleExportDeliveryLabelsPDF"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            导出标签 PDF
          </button>
        </template>
        <template v-else-if="appMode === 'order' && pvPrintViewMode === 'packing_list'">
          <button
            class="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="pvGeneratedPackingList.length === 0"
            @click="printView.handleExportPackingListPDF"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            导出清单 PDF
          </button>
        </template>
        <template v-else>
          <button
            class="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="expIsExporting || layoutPlacements.length === 0"
            @click="exportActions.handleExportPDF"
          >
            <svg v-if="!expIsExporting" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <svg v-else class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {{ expIsExporting ? '导出中...' : appMode === 'order' && obSelectedOrders.length > 0 ? '导出 PDF(含分拣单)' : '导出 PDF' }}
          </button>
        </template>
      </div>
    </header>

    <div class="flex-1 flex overflow-hidden">
      <aside class="w-80 bg-white border-r border-gray-200 overflow-y-auto scrollbar-thin flex-shrink-0">
        <template v-if="qcMode">
          <QualityControlPanel
            :placements="layoutPlacements"
            :patterns="editorPatterns"
            :orders="obOrders"
            :selected-order-ids="obSelectedOrderIds"
            :current-batch-name="obCurrentBatchName"
            :app-mode="appMode"
            :selected-placement-index="editorSelectedPlacementIndex"
            :layout-settings="editorLayoutSettings"
            :calibration="editorCalibration"
            @update:selected-placement-index="handleUpdateSelectedPlacementIndex"
            @start-qc="qc.handleQCStart"
            @exit-qc="qc.handleQCExit"
            @apply-rework-batch="qc.handleApplyReworkBatch"
            @session-change="qc.handleQCSessionChange"
            @stats-change="qc.handleQCStatsChange"
            @jump-to-page="handleJumpToPage"
          />
        </template>
        <template v-else-if="appMode === 'normal'">
          <PatternUploader @upload="layout.patterns.handlePatternUpload" />
          <PatternList
            :patterns="editorPatterns"
            :pattern-configs="editorPatternConfigs"
            :set-groups="editorSetGroups"
            :default-config="layout.createDefaultPatternConfig(editorLayoutSettings)"
            @remove="layout.patterns.handlePatternRemove"
            @clear="layout.patterns.handleClearPatterns"
            @update-config="layout.patterns.handlePatternConfigUpdate"
            @create-set-group="layout.patterns.handleCreateSetGroup"
            @assign-set-group="layout.patterns.handleAssignSetGroup"
            @delete-set-group="layout.patterns.handleDeleteSetGroup"
            @save-to-library="handleSaveToLibrary"
            @batch-save-to-library="handleBatchSaveToLibrary"
          />
          <MaterialLibraryPanel
            :key="materialLibraryVersion"
            :app-mode="appMode"
            :patterns="editorPatterns"
            @add-patterns="handleAddPatternsFromLibrary"
            @add-order-items="handleAddOrderItemsFromLibrary"
          />
          <NailSelector
            :selected-size="editorLayoutSettings.nailSize"
            :selected-shape="editorLayoutSettings.nailShape"
            @update:selected-size="layout.patterns.handleUpdateNailSize"
            @update:selected-shape="layout.patterns.handleUpdateNailShape"
          />
          <LayoutSettingsPanel
            :settings="editorLayoutSettings"
            @update:settings="(s) => { layout.editor.layoutSettings.value = s }"
          />
          <CalibrationPanel
            :calibration="editorCalibration"
            @update="layout.calibration.handleCalibrationUpdate"
            @export-ruler="exportActions.handleExportCalibrationRuler"
          />
          <PatternEditor
            :transform="layoutSelectedTransform"
            :has-selection="editorSelectedPlacementIndex !== null"
            @rotate="layout.transform.rotateSelected"
            @mirror-x="layout.transform.toggleMirrorX"
            @mirror-y="layout.transform.toggleMirrorY"
            @invert-color="layout.transform.toggleInvertColor"
            @reset="layout.transform.resetTransform"
          />
          <MaterialEstimatePanel :estimate="layoutEstimate" />
          <LayoutConflictPanel
            :conflicts="layoutConflicts"
            @apply-suggestion="layout.handleApplyConflictSuggestion"
          />
          <SchemeManager
            :current-patterns="editorPatterns"
            :current-pattern-configs="editorPatternConfigs"
            :current-set-groups="editorSetGroups"
            :current-settings="editorLayoutSettings"
            :current-calibration="editorCalibration"
            @load="layout.handleLoadScheme"
          />
        </template>

        <template v-else>
          <PatternUploader @upload="layout.patterns.handlePatternUpload" />
          <OrderManager
            :patterns="editorPatterns"
            :selected-order-ids="obSelectedOrderIds"
            @orders-change="orderBatch.handleOrdersChange"
            @toggle-select-order="orderBatch.handleToggleSelectOrder"
            @boost-priority="orderBatch.handleBoostPriority"
          />
          <BatchManager
            :orders="obOrders"
            :selected-order-ids="obSelectedOrderIds"
            :settings="editorLayoutSettings"
            :calibration="editorCalibration"
            :placements="layoutOrderPlacements"
            :page-info="layoutPageInfo"
            :batch-page-info="layoutBatchPageInfo"
            @create-batch="orderBatch.handleCreateBatch"
            @load-batch="orderBatch.handleLoadBatch"
            @save-current-batch="orderBatch.handleSaveCurrentBatch"
          />
          <NailSelector
            :selected-size="editorLayoutSettings.nailSize"
            :selected-shape="editorLayoutSettings.nailShape"
            @update:selected-size="layout.patterns.handleUpdateNailSize"
            @update:selected-shape="layout.patterns.handleUpdateNailShape"
          />
          <LayoutSettingsPanel
            :settings="editorLayoutSettings"
            @update:settings="(s) => { layout.editor.layoutSettings.value = s }"
          />
          <CalibrationPanel
            :calibration="editorCalibration"
            @update="layout.calibration.handleCalibrationUpdate"
            @export-ruler="exportActions.handleExportCalibrationRuler"
          />
          <PatternEditor
            :transform="layoutSelectedTransform"
            :has-selection="editorSelectedPlacementIndex !== null"
            @rotate="layout.transform.rotateSelected"
            @mirror-x="layout.transform.toggleMirrorX"
            @mirror-y="layout.transform.toggleMirrorY"
            @invert-color="layout.transform.toggleInvertColor"
            @reset="layout.transform.resetTransform"
          />
          <MaterialEstimatePanel :estimate="layoutEstimate" />
          <LayoutConflictPanel
            :conflicts="layoutConflicts"
            @apply-suggestion="layout.handleApplyConflictSuggestion"
          />
          <MaterialLibraryPanel
            :key="materialLibraryVersion"
            :app-mode="appMode"
            :patterns="editorPatterns"
            :orders="obOrders"
            :selected-order-ids="obSelectedOrderIds"
            @add-patterns="handleAddPatternsFromLibrary"
            @add-order-items="handleAddOrderItemsFromLibrary"
          />
        </template>
      </aside>

      <main class="flex-1 overflow-auto bg-gray-100 scrollbar-thin">
        <div class="h-full flex">
          <div class="flex-1 overflow-auto print-area">
            <template v-if="appMode !== 'order' || pvPrintViewMode === 'stickers'">
              <PrintCanvas
                :placements="layoutPlacements"
                :patterns="editorPatterns"
                :pattern-configs="editorPatternConfigs"
                :set-groups="editorSetGroups"
                :selected-placement-index="editorSelectedPlacementIndex"
                :page-info="layoutPageInfo"
                :preview-mode="editorPreviewMode"
                :calibration="editorCalibration"
                :orders="appMode === 'order' ? obSelectedOrders : undefined"
                :batch-page-info="appMode === 'order' ? layoutBatchPageInfo : undefined"
                :show-order-tags="appMode === 'order' && obShowOrderTags"
                :qc-session="qcSession"
                :qc-mode="qcMode"
                @select="layout.handlePlacementSelect"
                @page-refs-ready="layout.handlePageRefsReady"
              />
            </template>
            <template v-else-if="pvPrintViewMode === 'delivery_labels'">
              <DeliveryLabelsCanvas
                :labels="pvGeneratedDeliveryLabels"
                :config="pvDeliveryLabelConfig"
                @page-refs-ready="layout.handlePageRefsReady"
              />
            </template>
            <template v-else-if="pvPrintViewMode === 'packing_list'">
              <PackingListCanvas
                :packing-list="pvGeneratedPackingList"
                @page-refs-ready="layout.handlePageRefsReady"
              />
            </template>
          </div>

          <template v-if="appMode === 'order' || qcMode">
            <div class="w-72 bg-white border-l border-gray-200 overflow-y-auto scrollbar-thin flex-shrink-0">
              <OrderSidebar
                :orders="obSelectedOrders"
                :placements="layoutOrderPlacements"
                :order-progress="layoutOrderProgress"
                :batch-page-info="layoutBatchPageInfo"
                :delivery-warnings="layoutDeliveryWarnings"
                :current-page="editorCurrentPage"
                :qc-session="qcSession"
                :qc-mode="qcMode"
                :selected-order-ids="obSelectedOrderIds"
                :print-view-mode="pvPrintViewMode"
                @boost-priority="orderBatch.handleBoostPriority"
                @select-order="(id) => orderBatch.handleToggleSelectOrder(id)"
                @generate-delivery-labels="handleGenerateDeliveryLabels"
                @generate-packing-list="handleGeneratePackingList"
                @set-print-view-mode="handleSetPrintViewMode"
              />
            </div>
          </template>
        </div>
      </main>
    </div>

    <SaveMaterialDialog
      :visible="saveDialogVisible"
      :pattern="saveDialogPattern"
      :default-config="saveDialogDefaultConfig"
      @close="saveDialogVisible = false"
      @saved="handleMaterialSaved"
    />
  </div>
</template>
