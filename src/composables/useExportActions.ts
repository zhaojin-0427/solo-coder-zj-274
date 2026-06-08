import { ref } from 'vue'
import { nextTick } from 'vue'
import type {
  PrintCalibration,
  CustomerOrder,
  PlacedPatternWithOrder,
  OrderLayoutProgress
} from '../types'
import {
  exportToPDF,
  exportToPDFWithOrderList,
  exportCalibrationRulerPDF
} from '../utils/pdf'

export function useExportActions(
  getPageRefs: () => Map<number, HTMLElement>,
  getCalibration: () => PrintCalibration,
  getAppMode: () => 'normal' | 'order' | 'rework',
  getSelectedOrders: () => CustomerOrder[],
  getOrderPlacements: () => PlacedPatternWithOrder[],
  getOrderProgress: () => Record<string, OrderLayoutProgress>,
  getCurrentBatchName: () => string,
  getPlacementsLength: () => number
) {
  const isExporting = ref(false)

  async function handleExportPDF() {
    if (getPlacementsLength() === 0) {
      alert('请先上传图案进行排版')
      return
    }
    isExporting.value = true
    try {
      await nextTick()
      if (getAppMode() === 'order' && getSelectedOrders().length > 0) {
        await exportToPDFWithOrderList(
          getPageRefs(),
          getCalibration(),
          getSelectedOrders(),
          getOrderPlacements(),
          getOrderProgress(),
          getCurrentBatchName()
        )
      } else {
        await exportToPDF(getPageRefs(), getCalibration())
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

  return {
    isExporting,
    handleExportPDF,
    handleExportCalibrationRuler,
    handlePrint
  }
}
