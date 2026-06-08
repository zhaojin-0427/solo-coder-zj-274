<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import type {
  QCInspectionSession,
  QCBatchStats,
  QCDefectType,
  QCItemStatus,
  QCMaterialCostConfig,
  ReworkBatch,
  PlacedPatternWithOrder,
  UploadedPattern,
  CustomerOrder,
  LayoutSettings,
  PrintCalibration,
  PlacedPattern
} from '../types'
import {
  QC_DEFECT_TYPES,
  DEFAULT_COST_CONFIG,
  createQCInspectionSession,
  saveQCSession,
  getAllQCSessions,
  loadQCSession,
  deleteQCSession,
  updatePatternCheck,
  updatePageCheck,
  markPageAllPatterns,
  togglePatternDefect,
  recomputeOrderChecks,
  computeQCBatchStats,
  isOrderDeliverable,
  completeQCSession,
  generateReworkBatch,
  saveReworkBatch,
  getAllReworkBatches,
  getQCCostConfig,
  saveQCCostConfig,
  getDefectInfo,
  getQCStatusLabel,
  getQCStatusColor
} from '../utils/qualityControl'

const props = defineProps<{
  placements: (PlacedPattern | PlacedPatternWithOrder)[]
  patterns: UploadedPattern[]
  orders: CustomerOrder[]
  selectedOrderIds: string[]
  currentBatchName: string
  appMode: 'normal' | 'order'
  selectedPlacementIndex: number | null
  layoutSettings: LayoutSettings
  calibration: PrintCalibration
}>()

const emit = defineEmits<{
  (e: 'update:selectedPlacementIndex', index: number | null): void
  (e: 'startQC', session: QCInspectionSession): void
  (e: 'exitQC'): void
  (e: 'applyReworkBatch', batch: ReworkBatch): void
  (e: 'sessionChange', session: QCInspectionSession): void
  (e: 'statsChange', stats: QCBatchStats): void
  (e: 'jumpToPage', pageIndex: number): void
}>()

const activeTab = ref<'overview' | 'page' | 'pattern' | 'order' | 'history'>('overview')
const currentPageIndex = ref(0)
const qcSession = ref<QCInspectionSession | null>(null)
const qcStats = ref<QCBatchStats | null>(null)
const qcSessions = ref<QCInspectionSession[]>([])
const reworkBatches = ref<ReworkBatch[]>([])
const costConfig = ref<QCMaterialCostConfig>({ ...DEFAULT_COST_CONFIG })
const isGeneratingRework = ref(false)
const isExportingReport = ref(false)

const selectedOrders = computed(() => {
  return props.orders.filter(o => props.selectedOrderIds.includes(o.id))
})

const batchNameForQC = computed(() => {
  if (props.currentBatchName) return props.currentBatchName
  if (props.appMode === 'order' && selectedOrders.value.length > 0) {
    return `订单批次 - ${selectedOrders.value.map(o => o.customerName).slice(0, 3).join(', ')}`
  }
  return `排版质检 - ${new Date().toLocaleDateString()}`
})

const placementsByPage = computed(() => {
  const map = new Map<number, (PlacedPattern | PlacedPatternWithOrder)[]>()
  props.placements.forEach((p, idx) => {
    const extended = p as PlacedPattern & { _globalIndex?: number }
    extended._globalIndex = idx
    const list = map.get(p.pageIndex) || []
    list.push(p)
    map.set(p.pageIndex, list)
  })
  return map
})

const pageIndices = computed(() => {
  return Array.from(placementsByPage.value.keys()).sort((a, b) => a - b)
})

const currentPageCheck = computed(() => {
  if (!qcSession.value) return null
  return qcSession.value.pageChecks[currentPageIndex.value] || null
})

const currentPatternCheck = computed(() => {
  if (!qcSession.value || props.selectedPlacementIndex === null) return null
  const pageCheck = qcSession.value.pageChecks[currentPageIndex.value]
  if (!pageCheck) return null
  return pageCheck.patternChecks[props.selectedPlacementIndex] || null
})

const hasQCStarted = computed(() => qcSession.value !== null)

watch(
  () => [props.selectedPlacementIndex, qcSession.value],
  () => {
    if (props.selectedPlacementIndex !== null && qcSession.value) {
      const pl = props.placements[props.selectedPlacementIndex]
      if (pl) {
        currentPageIndex.value = pl.pageIndex
      }
    }
  },
  { immediate: true }
)

watch(
  [qcSession, () => props.placements, costConfig],
  () => {
    if (qcSession.value) {
      qcStats.value = computeQCBatchStats(qcSession.value, props.placements, costConfig.value)
      if (props.appMode === 'order' && selectedOrders.value.length > 0) {
        qcSession.value = recomputeOrderChecks(qcSession.value, selectedOrders.value)
      }
      emit('sessionChange', qcSession.value)
      emit('statsChange', qcStats.value)
    }
  },
  { deep: true }
)

function startNewSession() {
  const batchId = null
  const session = createQCInspectionSession({
    batchId,
    batchName: batchNameForQC.value,
    sourceType: props.appMode,
    placements: props.placements
  })
  qcSession.value = session
  saveQCSession(session)
  qcSessions.value = getAllQCSessions()
  emit('startQC', session)
  activeTab.value = 'page'
}

function saveCurrentSession() {
  if (!qcSession.value) return
  saveQCSession(qcSession.value)
  qcSessions.value = getAllQCSessions()
}

function loadExistingSession(sessionId: string) {
  const session = loadQCSession(sessionId)
  if (session) {
    qcSession.value = JSON.parse(JSON.stringify(session))
    activeTab.value = 'overview'
  }
}

function deleteExistingSession(sessionId: string) {
  if (!confirm('确定删除此质检记录？')) return
  deleteQCSession(sessionId)
  qcSessions.value = getAllQCSessions()
  if (qcSession.value?.id === sessionId) {
    qcSession.value = null
    qcStats.value = null
    emit('exitQC')
  }
}

function exitQCMode() {
  qcSession.value = null
  qcStats.value = null
  emit('exitQC')
}

function setPatternStatus(status: QCItemStatus) {
  if (!qcSession.value || props.selectedPlacementIndex === null) return
  qcSession.value = updatePatternCheck(
    qcSession.value,
    props.selectedPlacementIndex,
    currentPageIndex.value,
    { status }
  )
  saveCurrentSession()
}

function setPageStatus(status: QCItemStatus) {
  if (!qcSession.value) return
  qcSession.value = markPageAllPatterns(qcSession.value, currentPageIndex.value, status)
  saveCurrentSession()
}

function handleToggleDefect(defectType: QCDefectType) {
  if (!qcSession.value || props.selectedPlacementIndex === null) return
  qcSession.value = togglePatternDefect(
    qcSession.value,
    props.selectedPlacementIndex,
    currentPageIndex.value,
    defectType
  )
  saveCurrentSession()
}

function updatePageNotes(notes: string) {
  if (!qcSession.value) return
  qcSession.value = updatePageCheck(qcSession.value, currentPageIndex.value, { notes })
  saveCurrentSession()
}

function updatePatternNotes(notes: string) {
  if (!qcSession.value || props.selectedPlacementIndex === null) return
  qcSession.value = updatePatternCheck(
    qcSession.value,
    props.selectedPlacementIndex,
    currentPageIndex.value,
    { notes }
  )
  saveCurrentSession()
}

function selectPattern(idx: number) {
  emit('update:selectedPlacementIndex', idx)
  emit('jumpToPage', currentPageIndex.value)
}

async function handleGenerateReworkBatch() {
  if (!qcSession.value) return
  isGeneratingRework.value = true
  try {
    const reworkBatch = generateReworkBatch({
      session: qcSession.value,
      placements: props.placements as PlacedPatternWithOrder[],
      patterns: props.patterns,
      settings: props.layoutSettings,
      calibration: props.calibration,
      orders: selectedOrders.value.length > 0 ? selectedOrders.value : undefined,
      batchName: `返工批次 - ${qcSession.value.batchName}`
    })
    saveReworkBatch(reworkBatch)
    reworkBatches.value = getAllReworkBatches()
    if (reworkBatch.isGenerated) {
      if (confirm(`已生成返工批次，包含 ${reworkBatch.reworkItems.length} 项需重打的贴纸。是否应用此返工批次？`)) {
        emit('applyReworkBatch', reworkBatch)
      }
    } else {
      alert('没有需要返工的贴纸')
    }
  } catch (e) {
    console.error(e)
    alert('生成返工批次失败')
  } finally {
    isGeneratingRework.value = false
  }
}

async function handleExportReport() {
  if (!qcSession.value || !qcStats.value) return
  isExportingReport.value = true
  try {
    const { exportQCReport } = await import('../utils/pdf')
    const reworkBatch = qcStats.value.failedPatterns > 0
      ? generateReworkBatch({
          session: qcSession.value,
          placements: props.placements as PlacedPatternWithOrder[],
          patterns: props.patterns,
          settings: props.layoutSettings,
          calibration: props.calibration,
          orders: selectedOrders.value.length > 0 ? selectedOrders.value : undefined
        })
      : null
    await exportQCReport(
      qcSession.value,
      qcStats.value,
      selectedOrders.value,
      props.patterns,
      props.placements as PlacedPatternWithOrder[],
      reworkBatch
    )
  } catch (e) {
    console.error(e)
    alert('导出报告失败')
  } finally {
    isExportingReport.value = false
  }
}

function handleCompleteSession() {
  if (!qcSession.value) return
  if (!confirm('确定标记质检完成？完成后可继续修改，但将标记为已完成状态。')) return
  qcSession.value = completeQCSession(qcSession.value)
  saveCurrentSession()
}

function updateCostConfig() {
  saveQCCostConfig(costConfig.value)
}

function getPatternByGlobalIndex(idx: number): (PlacedPattern | PlacedPatternWithOrder) | undefined {
  return props.placements[idx]
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

onMounted(() => {
  qcSessions.value = getAllQCSessions()
  reworkBatches.value = getAllReworkBatches()
  costConfig.value = getQCCostConfig()
})
</script>

<template>
  <div class="border-b border-gray-200">
    <div class="p-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold text-gray-800">打印质检与返工追踪</h3>
        <template v-if="hasQCStarted">
          <button
            class="text-[11px] text-gray-500 hover:text-gray-700"
            @click="exitQCMode"
          >
            退出质检
          </button>
        </template>
      </div>

      <template v-if="!hasQCStarted">
        <div class="bg-amber-50 border border-amber-200 rounded-md p-3 mb-3">
          <div class="text-[11px] text-amber-800 mb-2">
            质检模式：按页、按订单、按图案记录打印质量问题，自动生成返工批次
          </div>
          <button
            :disabled="placements.length === 0"
            :class="[
              'w-full px-3 py-2 text-xs font-medium rounded-md transition-colors',
              placements.length > 0
                ? 'bg-primary-500 hover:bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            ]"
            @click="startNewSession"
          >
            {{ qcSessions.length > 0 ? '开始新质检' : '开始质检流程' }}
          </button>
        </div>

        <div v-if="qcSessions.length > 0">
          <div class="text-[11px] font-medium text-gray-600 mb-2">历史质检记录 ({{ qcSessions.length }})</div>
          <div class="space-y-1.5 max-h-40 overflow-y-auto">
            <div
              v-for="session in qcSessions.slice().sort((a, b) => b.updatedAt - a.updatedAt)"
              :key="session.id"
              class="bg-gray-50 rounded-md p-2"
            >
              <div class="flex items-center justify-between mb-1">
                <span class="text-[11px] font-medium text-gray-800 truncate flex-1">{{ session.batchName }}</span>
                <span v-if="session.isCompleted" class="text-[9px] px-1 bg-green-100 text-green-700 rounded">已完成</span>
              </div>
              <div class="text-[10px] text-gray-500 mb-2">
                {{ formatDate(session.updatedAt) }} · {{ Object.keys(session.pageChecks).length }} 页
              </div>
              <div class="flex gap-1">
                <button
                  class="flex-1 px-2 py-1 text-[10px] bg-primary-100 text-primary-600 rounded hover:bg-primary-200 transition-colors"
                  @click="loadExistingSession(session.id)"
                >
                  恢复
                </button>
                <button
                  class="px-2 py-1 text-[10px] bg-red-100 text-red-600 rounded hover:bg-red-200 transition-colors"
                  @click="deleteExistingSession(session.id)"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>

      <template v-else>
        <div class="flex bg-gray-100 rounded-lg p-0.5 mb-3">
          <button
            v-for="tab in [
              { key: 'overview', label: '总览' },
              { key: 'page', label: '分页质检' },
              { key: 'pattern', label: '图案质检' },
              { key: 'order', label: '订单质检' }
            ]"
            :key="tab.key"
            :class="[
              'flex-1 px-2 py-1 text-[11px] font-medium rounded-md transition-all',
              activeTab === tab.key
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            ]"
            @click="activeTab = tab.key as any"
          >
            {{ tab.label }}
          </button>
        </div>

        <template v-if="activeTab === 'overview' && qcStats">
          <div class="grid grid-cols-2 gap-2 mb-3">
            <div class="bg-blue-50 rounded-md p-2 text-center">
              <div class="text-lg font-bold text-blue-600">{{ qcStats.passRate.toFixed(1) }}%</div>
              <div class="text-[10px] text-gray-500">合格率</div>
            </div>
            <div class="bg-red-50 rounded-md p-2 text-center">
              <div class="text-lg font-bold text-red-600">{{ qcStats.failedPatterns }}</div>
              <div class="text-[10px] text-gray-500">需返工</div>
            </div>
            <div class="bg-amber-50 rounded-md p-2 text-center">
              <div class="text-lg font-bold text-amber-600">{{ qcStats.estimatedReprintPages }}</div>
              <div class="text-[10px] text-gray-500">预计补打页</div>
            </div>
            <div class="bg-gray-50 rounded-md p-2 text-center">
              <div class="text-lg font-bold text-gray-700">¥{{ qcStats.extraMaterialCost.toFixed(2) }}</div>
              <div class="text-[10px] text-gray-500">额外耗材</div>
            </div>
          </div>

          <div class="bg-gray-50 rounded-md p-2 mb-3">
            <div class="text-[11px] font-medium text-gray-700 mb-2">质检进度</div>
            <div class="flex items-center gap-2 mb-1">
              <div class="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  class="h-full bg-green-500 rounded-full transition-all"
                  :style="{ width: `${qcStats.totalPatterns > 0 ? (qcStats.checkedPatterns / qcStats.totalPatterns) * 100 : 0}%` }"
                ></div>
              </div>
              <span class="text-[10px] text-gray-600 w-12 text-right">
                {{ qcStats.checkedPatterns }}/{{ qcStats.totalPatterns }}
              </span>
            </div>
          </div>

          <div class="bg-gray-50 rounded-md p-2 mb-3">
            <div class="text-[11px] font-medium text-gray-700 mb-2">问题类型分布</div>
            <div class="space-y-1">
              <div
                v-for="defect in QC_DEFECT_TYPES"
                :key="defect.type"
                class="flex items-center gap-2"
              >
                <span class="text-[10px] w-20 truncate" :style="{ color: defect.color }">
                  {{ defect.icon }} {{ defect.label }}
                </span>
                <div class="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all"
                    :style="{
                      width: `${Math.max(...Object.values(qcStats.defectBreakdown)) > 0 ? (qcStats.defectBreakdown[defect.type] / Math.max(...Object.values(qcStats.defectBreakdown))) * 100 : 0}%`,
                      backgroundColor: defect.color
                    }"
                  ></div>
                </div>
                <span class="text-[10px] text-gray-600 w-5 text-right">
                  {{ qcStats.defectBreakdown[defect.type] }}
                </span>
              </div>
            </div>
          </div>

          <div class="bg-gray-50 rounded-md p-2 mb-3">
            <div class="text-[11px] font-medium text-gray-700 mb-2">耗材成本配置</div>
            <div class="grid grid-cols-3 gap-1.5">
              <div>
                <label class="text-[9px] text-gray-500 block mb-0.5">A4纸(元)</label>
                <input
                  type="number"
                  step="0.1"
                  v-model.number="costConfig.a4SheetCost"
                  class="w-full px-1.5 py-1 text-[10px] border border-gray-200 rounded focus:outline-none focus:border-primary-400"
                  @change="updateCostConfig"
                />
              </div>
              <div>
                <label class="text-[9px] text-gray-500 block mb-0.5">墨水(元)</label>
                <input
                  type="number"
                  step="0.1"
                  v-model.number="costConfig.inkCostPerPage"
                  class="w-full px-1.5 py-1 text-[10px] border border-gray-200 rounded focus:outline-none focus:border-primary-400"
                  @change="updateCostConfig"
                />
              </div>
              <div>
                <label class="text-[9px] text-gray-500 block mb-0.5">人工(元)</label>
                <input
                  type="number"
                  step="0.1"
                  v-model.number="costConfig.laborCostPerSheet"
                  class="w-full px-1.5 py-1 text-[10px] border border-gray-200 rounded focus:outline-none focus:border-primary-400"
                  @change="updateCostConfig"
                />
              </div>
            </div>
          </div>

          <div class="space-y-2">
            <button
              :disabled="isGeneratingRework || qcStats.failedPatterns === 0"
              :class="[
                'w-full px-3 py-2 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1.5',
                qcStats.failedPatterns > 0 && !isGeneratingRework
                  ? 'bg-orange-500 hover:bg-orange-600 text-white'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              ]"
              @click="handleGenerateReworkBatch"
            >
              <svg v-if="!isGeneratingRework" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <svg v-else class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              一键生成返工批次 ({{ qcStats.failedPatterns }} 张)
            </button>

            <button
              :disabled="isExportingReport"
              :class="[
                'w-full px-3 py-2 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1.5',
                !isExportingReport
                  ? 'bg-primary-500 hover:bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              ]"
              @click="handleExportReport"
            >
              <svg v-if="!isExportingReport" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <svg v-else class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              导出质检报告 PDF
            </button>

            <button
              v-if="!qcSession.isCompleted"
              class="w-full px-3 py-2 text-xs font-medium rounded-md bg-green-500 hover:bg-green-600 text-white transition-colors"
              @click="handleCompleteSession"
            >
              标记质检完成
            </button>
            <div v-else class="w-full px-3 py-2 text-xs font-medium rounded-md bg-green-100 text-green-700 text-center">
              ✓ 质检已完成
            </div>
          </div>
        </template>

        <template v-else-if="activeTab === 'page'">
          <div class="mb-3">
            <div class="text-[11px] font-medium text-gray-600 mb-1.5">选择页面</div>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="pIdx in pageIndices"
                :key="pIdx"
                :class="[
                  'px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors',
                  currentPageIndex === pIdx
                    ? 'bg-primary-500 text-white'
                    : qcSession.pageChecks[pIdx]?.status === 'passed'
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : qcSession.pageChecks[pIdx]?.status === 'failed'
                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                ]"
                @click="currentPageIndex = pIdx; emit('jumpToPage', pIdx)"
              >
                第 {{ pIdx + 1 }} 页
                <span v-if="qcSession.pageChecks[pIdx]?.status === 'passed'" class="ml-0.5">✓</span>
                <span v-else-if="qcSession.pageChecks[pIdx]?.status === 'failed'" class="ml-0.5">✗</span>
              </button>
            </div>
          </div>

          <div v-if="currentPageCheck" class="space-y-3">
            <div class="bg-gray-50 rounded-md p-2">
              <div class="flex items-center justify-between mb-2">
                <span class="text-[11px] font-medium text-gray-700">本页状态</span>
                <span :class="['text-[10px] px-1.5 py-0.5 rounded', getQCStatusColor(currentPageCheck.status)]">
                  {{ getQCStatusLabel(currentPageCheck.status) }}
                </span>
              </div>
              <div class="flex gap-1.5">
                <button
                  class="flex-1 px-2 py-1.5 text-[10px] bg-green-100 hover:bg-green-200 text-green-700 rounded transition-colors"
                  @click="setPageStatus('passed')"
                >
                  整页合格
                </button>
                <button
                  class="flex-1 px-2 py-1.5 text-[10px] bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors"
                  @click="setPageStatus('failed')"
                >
                  整页不合格
                </button>
              </div>
            </div>

            <div v-if="currentPageCheck.defects.length > 0" class="bg-red-50 rounded-md p-2">
              <div class="text-[10px] text-red-700 mb-1">本页问题</div>
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="d in currentPageCheck.defects"
                  :key="d"
                  class="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] rounded"
                  :style="{ backgroundColor: getDefectInfo(d).color + '20', color: getDefectInfo(d).color }"
                >
                  {{ getDefectInfo(d).icon }} {{ getDefectInfo(d).label }}
                </span>
              </div>
            </div>

            <div>
              <label class="text-[10px] text-gray-500 block mb-0.5">本页备注</label>
              <textarea
                :value="currentPageCheck.notes"
                rows="2"
                class="w-full px-2 py-1.5 text-[10px] border border-gray-200 rounded-md focus:outline-none focus:border-primary-400 resize-none"
                placeholder="记录本页的整体备注..."
                @input="updatePageNotes(($event.target as HTMLTextAreaElement).value)"
              ></textarea>
            </div>

            <div>
              <div class="text-[11px] font-medium text-gray-600 mb-1.5">
                本页贴纸 ({{ placementsByPage.get(currentPageIndex)?.length || 0 }} 张)
              </div>
              <div class="grid grid-cols-4 gap-1 max-h-40 overflow-y-auto">
                <button
                  v-for="pl in (placementsByPage.get(currentPageIndex) || [])"
                  :key="(pl as any)._globalIndex"
                  :class="[
                    'aspect-square rounded border-2 transition-all p-0.5 relative overflow-hidden',
                    selectedPlacementIndex === (pl as any)._globalIndex
                      ? 'border-primary-500 ring-2 ring-primary-200'
                      : 'border-gray-200 hover:border-gray-300',
                    qcSession.pageChecks[currentPageIndex]?.patternChecks[(pl as any)._globalIndex]?.status === 'passed'
                      ? 'bg-green-50'
                      : qcSession.pageChecks[currentPageIndex]?.patternChecks[(pl as any)._globalIndex]?.status === 'failed'
                      ? 'bg-red-50'
                      : 'bg-white'
                  ]"
                  @click="selectPattern((pl as any)._globalIndex)"
                >
                  <img
                    v-if="patterns.find(p => p.id === pl.patternId)"
                    :src="patterns.find(p => p.id === pl.patternId)!.dataUrl"
                    class="w-full h-full object-contain"
                  />
                  <div
                    v-if="qcSession.pageChecks[currentPageIndex]?.patternChecks[(pl as any)._globalIndex]?.status === 'passed'"
                    class="absolute top-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-bl flex items-center justify-center"
                  >
                    <span class="text-white text-[8px] font-bold">✓</span>
                  </div>
                  <div
                    v-else-if="qcSession.pageChecks[currentPageIndex]?.patternChecks[(pl as any)._globalIndex]?.status === 'failed'"
                    class="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 rounded-bl flex items-center justify-center"
                  >
                    <span class="text-white text-[8px] font-bold">✗</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </template>

        <template v-else-if="activeTab === 'pattern'">
          <template v-if="selectedPlacementIndex === null">
            <div class="text-[11px] text-gray-400 text-center py-6">
              请在画布上点击选择一个贴纸
            </div>
          </template>
          <template v-else-if="currentPatternCheck">
            <div class="space-y-3">
              <div class="bg-gray-50 rounded-md p-2 flex items-center gap-2">
                <div class="w-12 h-12 bg-white rounded border border-gray-200 overflow-hidden flex-shrink-0">
                  <img
                    v-if="patterns.find(p => p.id === getPatternByGlobalIndex(selectedPlacementIndex)?.patternId)"
                    :src="patterns.find(p => p.id === getPatternByGlobalIndex(selectedPlacementIndex)!.patternId)!.dataUrl"
                    class="w-full h-full object-contain"
                  />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-[11px] font-medium text-gray-800 truncate">
                    {{ patterns.find(p => p.id === getPatternByGlobalIndex(selectedPlacementIndex)?.patternId)?.name || '未知' }}
                  </div>
                  <div class="text-[9px] text-gray-500">
                    第 {{ currentPageIndex + 1 }} 页 · {{ getPatternByGlobalIndex(selectedPlacementIndex)?.nailSize }}/{{ getPatternByGlobalIndex(selectedPlacementIndex)?.nailShape }}
                  </div>
                </div>
                <span :class="['text-[9px] px-1.5 py-0.5 rounded', getQCStatusColor(currentPatternCheck.status)]">
                  {{ getQCStatusLabel(currentPatternCheck.status) }}
                </span>
              </div>

              <div>
                <div class="text-[11px] font-medium text-gray-600 mb-1.5">质检结果</div>
                <div class="flex gap-1.5">
                  <button
                    :class="[
                      'flex-1 px-2 py-2 text-[11px] font-medium rounded-md transition-colors',
                      currentPatternCheck.status === 'passed'
                        ? 'bg-green-500 text-white'
                        : 'bg-green-100 hover:bg-green-200 text-green-700'
                    ]"
                    @click="setPatternStatus('passed')"
                  >
                    ✓ 合格
                  </button>
                  <button
                    :class="[
                      'flex-1 px-2 py-2 text-[11px] font-medium rounded-md transition-colors',
                      currentPatternCheck.status === 'failed'
                        ? 'bg-red-500 text-white'
                        : 'bg-red-100 hover:bg-red-200 text-red-700'
                    ]"
                    @click="setPatternStatus('failed')"
                  >
                    ✗ 不合格
                  </button>
                </div>
              </div>

              <div>
                <div class="text-[11px] font-medium text-gray-600 mb-1.5">问题类型 (可多选)</div>
                <div class="grid grid-cols-2 gap-1.5">
                  <button
                    v-for="defect in QC_DEFECT_TYPES"
                    :key="defect.type"
                    :class="[
                      'px-2 py-1.5 text-[10px] rounded-md border transition-all text-left',
                      currentPatternCheck.defects.includes(defect.type)
                        ? 'border-transparent text-white'
                        : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                    ]"
                    :style="currentPatternCheck.defects.includes(defect.type) ? { backgroundColor: defect.color } : {}"
                    @click="handleToggleDefect(defect.type)"
                  >
                    <span class="mr-0.5">{{ defect.icon }}</span>
                    {{ defect.label }}
                  </button>
                </div>
              </div>

              <div>
                <label class="text-[10px] text-gray-500 block mb-0.5">备注</label>
                <textarea
                  :value="currentPatternCheck.notes"
                  rows="2"
                  class="w-full px-2 py-1.5 text-[10px] border border-gray-200 rounded-md focus:outline-none focus:border-primary-400 resize-none"
                  placeholder="详细描述问题..."
                  @input="updatePatternNotes(($event.target as HTMLTextAreaElement).value)"
                ></textarea>
              </div>
            </div>
          </template>
        </template>

        <template v-else-if="activeTab === 'order'">
          <template v-if="appMode !== 'order' || selectedOrders.length === 0">
            <div class="text-[11px] text-gray-400 text-center py-6">
              请在"订单生产"模式下选择订单
            </div>
          </template>
          <template v-else>
            <div class="space-y-2 max-h-60 overflow-y-auto">
              <div
                v-for="order in selectedOrders"
                :key="order.id"
                class="bg-gray-50 rounded-md p-2"
              >
                <div class="flex items-center gap-1.5 mb-1.5">
                  <span
                    class="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                    :style="{ backgroundColor: order.colorTag }"
                  ></span>
                  <span class="text-[11px] font-medium text-gray-800 flex-1 truncate">{{ order.customerName }}</span>
                  <span
                    v-if="isOrderDeliverable(qcSession, order.id).deliverable"
                    class="text-[9px] px-1 bg-green-100 text-green-700 rounded"
                  >可交付</span>
                  <span
                    v-else
                    class="text-[9px] px-1 bg-red-100 text-red-700 rounded"
                  >不可交付</span>
                </div>

                <div v-if="qcSession.orderChecks[order.id]" class="space-y-1">
                  <div class="flex items-center gap-1.5">
                    <div class="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        class="h-full rounded-full transition-all"
                        :class="qcSession.orderChecks[order.id].status === 'passed' ? 'bg-green-500' : qcSession.orderChecks[order.id].failedItems > 0 ? 'bg-red-500' : 'bg-amber-500'"
                        :style="{ width: `${qcSession.orderChecks[order.id].totalItems > 0 ? (qcSession.orderChecks[order.id].checkedItems / qcSession.orderChecks[order.id].totalItems) * 100 : 0}%` }"
                      ></div>
                    </div>
                    <span class="text-[10px] text-gray-600 w-12 text-right">
                      {{ qcSession.orderChecks[order.id].checkedItems }}/{{ qcSession.orderChecks[order.id].totalItems }}
                    </span>
                  </div>

                  <div class="text-[9px] text-gray-500">
                    合格: {{ qcSession.orderChecks[order.id].passedItems }} ·
                    不合格: {{ qcSession.orderChecks[order.id].failedItems }}
                  </div>

                  <div v-if="Object.entries(qcSession.orderChecks[order.id].defectCounts).filter(([,c]) => c > 0).length > 0">
                    <div class="text-[9px] text-red-600 mb-0.5">异常原因:</div>
                    <div class="flex flex-wrap gap-0.5">
                      <span
                        v-for="[type, count] in Object.entries(qcSession.orderChecks[order.id].defectCounts).filter(([,c]) => c > 0)"
                        :key="type"
                        class="text-[8px] px-1 rounded"
                        :style="{ backgroundColor: getDefectInfo(type as QCDefectType).color + '20', color: getDefectInfo(type as QCDefectType).color }"
                      >
                        {{ getDefectInfo(type as QCDefectType).label }}×{{ count }}
                      </span>
                    </div>
                  </div>

                  <div class="text-[9px]" :class="isOrderDeliverable(qcSession, order.id).deliverable ? 'text-green-600' : 'text-red-600'">
                    {{ isOrderDeliverable(qcSession, order.id).reason }}
                  </div>
                </div>
                <div v-else class="text-[9px] text-gray-400">尚未开始质检</div>
              </div>
            </div>
          </template>
        </template>
      </template>
    </div>
  </div>
</template>
