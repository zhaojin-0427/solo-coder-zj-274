import { ref, computed } from 'vue'
import type {
  CustomerOrder,
  ProductionBatch,
  PlacedPatternWithOrder,
  PageLayoutInfo,
  PageBatchInfo,
  LayoutSettings,
  PrintCalibration
} from '../types'
import {
  getAllOrders,
  getAllBatches,
  saveBatch,
  boostOrderPriority
} from '../services/orderBatch'
import type { OrderBatchState, OrderBatchActions } from '../types/unified'

export function useOrderBatchState(
  getPlacements: () => PlacedPatternWithOrder[],
  getPageInfo: () => PageLayoutInfo[],
  getBatchPageInfo: () => PageBatchInfo[],
  getLayoutSettings: () => LayoutSettings,
  getCalibration: () => PrintCalibration
) {
  const orders = ref<CustomerOrder[]>(getAllOrders())
  const selectedOrderIds = ref<string[]>([])
  const currentBatchName = ref('')
  const showOrderTags = ref(true)

  const selectedOrders = computed(() => {
    return orders.value.filter(o => selectedOrderIds.value.includes(o.id))
  })

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
    const settings = getLayoutSettings()
    settings.nailSize = batch.settings.nailSize
    settings.nailShape = batch.settings.nailShape
    settings.gapX = batch.settings.gapX
    settings.gapY = batch.settings.gapY
    settings.margin = batch.settings.margin
    settings.copiesPerNail = batch.settings.copiesPerNail

    const cal = getCalibration()
    cal.enabled = batch.calibration.enabled
    cal.referenceLengthMm = batch.calibration.referenceLengthMm
    cal.measuredHorizontalMm = batch.calibration.measuredHorizontalMm
    cal.measuredVerticalMm = batch.calibration.measuredVerticalMm
    cal.scaleX = batch.calibration.scaleX
    cal.scaleY = batch.calibration.scaleY

    currentBatchName.value = batch.name
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
      placements: [...getPlacements()],
      pageInfo: [...getPageInfo()],
      batchPageInfo: [...getBatchPageInfo()],
      settings: { ...getLayoutSettings() },
      calibration: { ...getCalibration() }
    }
    saveBatch(batch)
    alert('批次已保存到本地')
  }

  const state: OrderBatchState = {
    orders,
    selectedOrderIds,
    currentBatchName,
    showOrderTags
  }

  const actions: OrderBatchActions = {
    handleOrdersChange,
    handleToggleSelectOrder,
    handleBoostPriority,
    handleCreateBatch,
    handleLoadBatch,
    handleSaveCurrentBatch
  }

  return {
    ...state,
    ...actions,
    selectedOrders
  }
}
