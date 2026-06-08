import { ref, computed } from 'vue'
import type {
  QCInspectionSession,
  QCBatchStats,
  ReworkBatch,
  PlacedPattern,
  PlacedPatternWithOrder,
  UploadedPattern,
  CustomerOrder,
  LayoutSettings,
  PrintCalibration
} from '../types'
import type { QCState, QCActions } from '../types/unified'

export function useQualityControlState(
  getPlacements: () => (PlacedPattern | PlacedPatternWithOrder)[],
  getPatterns: () => UploadedPattern[],
  getOrders: () => CustomerOrder[],
  getSelectedOrderIds: () => string[],
  getCurrentBatchName: () => string,
  getLayoutMode: () => 'normal' | 'order' | 'rework',
  getLayoutSettings: () => LayoutSettings,
  getCalibration: () => PrintCalibration,
  onApplyReworkBatch: (batch: ReworkBatch) => void
) {
  const qcMode = ref(false)
  const qcSession = ref<QCInspectionSession | null>(null)
  const qcStats = ref<QCBatchStats | null>(null)

  const selectedOrders = computed(() => {
    return getOrders().filter(o => getSelectedOrderIds().includes(o.id))
  })

  const batchNameForQC = computed(() => {
    if (getCurrentBatchName()) return getCurrentBatchName()
    const mode = getLayoutMode()
    if (mode === 'order' && selectedOrders.value.length > 0) {
      return `订单批次 - ${selectedOrders.value.map(o => o.customerName).slice(0, 3).join(', ')}`
    }
    return `排版质检 - ${new Date().toLocaleDateString()}`
  })

  function handleToggleQCMode() {
    if (!qcMode.value) {
      if (getPlacements().length === 0) {
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
    onApplyReworkBatch(batch)
    qcMode.value = false
    qcSession.value = null
    qcStats.value = null
  }

  function handleJumpToPage(pageIndex: number) {
    // 这个交给外层处理
  }

  const state: QCState = {
    qcMode,
    qcSession,
    qcStats
  }

  const actions: QCActions = {
    handleToggleQCMode,
    handleQCStart,
    handleQCExit,
    handleQCSessionChange,
    handleQCStatsChange,
    handleApplyReworkBatch,
    handleJumpToPage
  }

  return {
    ...state,
    ...actions,
    batchNameForQC
  }
}
