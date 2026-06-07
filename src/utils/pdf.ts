import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { A4_WIDTH_MM, A4_HEIGHT_MM } from '../data/nailConfig'
import type { PrintCalibration } from '../types'
import { applyCalibrationWidth, applyCalibrationHeight } from './calibration'

export async function exportToPDF(
  pages: Map<number, HTMLElement>,
  calibration: PrintCalibration,
  fileName: string = 'nail-stickers.pdf'
): Promise<void> {
  const pdfWidth = applyCalibrationWidth(A4_WIDTH_MM, calibration)
  const pdfHeight = applyCalibrationHeight(A4_HEIGHT_MM, calibration)

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [pdfWidth, pdfHeight]
  })

  const pageIndices = Array.from(pages.keys()).sort((a, b) => a - b)

  for (let i = 0; i < pageIndices.length; i++) {
    const pageElement = pages.get(pageIndices[i])
    if (!pageElement) continue

    const canvas = await html2canvas(pageElement, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff'
    })

    const imgData = canvas.toDataURL('image/png')

    if (i > 0) {
      pdf.addPage([pdfWidth, pdfHeight], 'portrait')
    }

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
  }

  pdf.save(fileName)
}

export async function pageToCanvas(element: HTMLElement): Promise<string> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff'
  })
  return canvas.toDataURL('image/png')
}

export async function exportCalibrationRulerPDF(
  fileName: string = 'calibration-ruler.pdf'
): Promise<void> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  pdf.setFontSize(12)
  pdf.text('打印校准尺', 105, 15, { align: 'center' })

  pdf.setFontSize(8)
  pdf.text('请在打印时关闭"适应页面"或"缩放"选项，选择 100% 实际尺寸', 105, 22, { align: 'center' })
  pdf.text('打印后测量横线和竖线的实际长度，然后输入到校准设置中', 105, 27, { align: 'center' })

  const rulerY = 35
  pdf.setDrawColor(0, 0, 0)
  pdf.setLineWidth(0.2)
  pdf.line(10, rulerY, 200, rulerY)

  pdf.setFontSize(6)
  for (let mm = 0; mm <= 190; mm += 1) {
    const x = 10 + mm
    const isMajor = mm % 10 === 0
    const tickHeight = isMajor ? 4 : 2
    pdf.line(x, rulerY, x, rulerY + tickHeight)
    if (isMajor) {
      pdf.text(String(mm), x, rulerY + tickHeight + 2, { align: 'center' })
    }
  }

  pdf.setFontSize(9)
  pdf.text('横向参考长度: 190mm (从 0 到 190 刻度)', 105, rulerY + 12, { align: 'center' })

  const rulerX = 15
  const verticalStartY = 60
  const verticalEndY = 270
  pdf.line(rulerX, verticalStartY, rulerX, verticalEndY)

  pdf.setFontSize(6)
  const verticalLengthMm = verticalEndY - verticalStartY
  for (let mm = 0; mm <= verticalLengthMm; mm += 1) {
    const y = verticalStartY + mm
    const isMajor = mm % 10 === 0
    const tickWidth = isMajor ? 4 : 2
    pdf.line(rulerX, y, rulerX + tickWidth, y)
    if (isMajor) {
      pdf.text(String(mm), rulerX + tickWidth + 1, y + 1.5, { align: 'left' })
    }
  }

  pdf.setFontSize(9)
  pdf.text(`纵向参考长度: ${verticalLengthMm}mm`, 45, (verticalStartY + verticalEndY) / 2, { align: 'left' })

  pdf.setFontSize(8)
  pdf.text('提示：测量后在"校准设置"面板输入实测值，系统会自动补偿打印缩放误差', 105, 285, { align: 'center' })

  pdf.save(fileName)
}
