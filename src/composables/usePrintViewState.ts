import { ref, watch } from 'vue'
import type {
  CustomerOrder,
  PlacedPatternWithOrder,
  QCInspectionSession,
  PrintViewMode,
  DeliveryLabelConfig,
  DeliveryLabelData,
  PackingListOrderData
} from '../types'
import {
  DEFAULT_DELIVERY_LABEL_CONFIG
} from '../types'
import {
  generateDeliveryLabels,
  generatePackingList,
  getSavedDeliveryLabelConfig,
  saveDeliveryLabelConfig
} from '../utils/delivery'
import type { PrintViewState, PrintViewActions } from '../types/unified'
import { exportPackingListPDF, exportDeliveryLabelsPDF } from '../utils/pdf'

export function usePrintViewState(
  getOrders: () => CustomerOrder[],
  getPlacements: () => PlacedPatternWithOrder[],
  getQCSession: () => QCInspectionSession | null
) {
  const printViewMode = ref<PrintViewMode>('stickers')
  const deliveryLabelConfig = ref<DeliveryLabelConfig>(getSavedDeliveryLabelConfig())
  const generatedDeliveryLabels = ref<DeliveryLabelData[]>([])
  const generatedPackingList = ref<PackingListOrderData[]>([])

  watch(
    () => deliveryLabelConfig.value,
    (newConfig) => {
      saveDeliveryLabelConfig(newConfig)
    },
    { deep: true }
  )

  function handleSetPrintViewMode(mode: PrintViewMode) {
    printViewMode.value = mode
    if (mode === 'delivery_labels' && generatedDeliveryLabels.value.length === 0) {
      handleGenerateDeliveryLabels([])
    }
    if (mode === 'packing_list' && generatedPackingList.value.length === 0) {
      handleGeneratePackingList([])
    }
  }

  function handleUpdateDeliveryLabelConfig(config: Partial<DeliveryLabelConfig>) {
    deliveryLabelConfig.value = {
      ...deliveryLabelConfig.value,
      ...config
    }
  }

  function handleGenerateDeliveryLabels(orderIds: string[]) {
    const allOrders = getOrders()
    const placements = getPlacements()
    const qcSession = getQCSession()

    let targetOrders = allOrders
    if (orderIds.length > 0) {
      targetOrders = allOrders.filter(o => orderIds.includes(o.id))
    }

    generatedDeliveryLabels.value = generateDeliveryLabels(
      targetOrders,
      placements,
      qcSession
    )
  }

  function handleGeneratePackingList(orderIds: string[]) {
    const allOrders = getOrders()
    const placements = getPlacements()
    const qcSession = getQCSession()

    let targetOrders = allOrders
    if (orderIds.length > 0) {
      targetOrders = allOrders.filter(o => orderIds.includes(o.id))
    }

    generatedPackingList.value = generatePackingList(
      targetOrders,
      placements,
      qcSession
    )
  }

  async function handleExportPackingListPDF(): Promise<void> {
    if (generatedPackingList.value.length === 0) {
      alert('请先生成包装清单')
      return
    }
    try {
      await exportPackingListPDF(generatedPackingList.value)
    } catch (e) {
      console.error('导出包装清单PDF失败:', e)
      alert('导出包装清单PDF失败，请重试')
    }
  }

  async function handleExportDeliveryLabelsPDF(): Promise<void> {
    if (generatedDeliveryLabels.value.length === 0) {
      alert('请先生成交付标签')
      return
    }
    try {
      await exportDeliveryLabelsPDF(
        generatedDeliveryLabels.value,
        deliveryLabelConfig.value
      )
    } catch (e) {
      console.error('导交付标签PDF失败:', e)
      alert('导交付标签PDF失败，请重试')
    }
  }

  const state: PrintViewState = {
    printViewMode,
    deliveryLabelConfig,
    generatedDeliveryLabels,
    generatedPackingList
  }

  const actions: PrintViewActions = {
    handleSetPrintViewMode,
    handleUpdateDeliveryLabelConfig,
    handleGenerateDeliveryLabels,
    handleGeneratePackingList,
    handleExportPackingListPDF
  }

  return {
    ...state,
    ...actions,
    handleExportDeliveryLabelsPDF
  }
}
