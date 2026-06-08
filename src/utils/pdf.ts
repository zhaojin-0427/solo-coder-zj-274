import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { A4_WIDTH_MM, A4_HEIGHT_MM } from '../data/nailConfig'
import type { PrintCalibration, CustomerOrder, PlacedPatternWithOrder, OrderLayoutProgress } from '../types'
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

export async function exportToPDFWithOrderList(
  pages: Map<number, HTMLElement>,
  calibration: PrintCalibration,
  orders: CustomerOrder[],
  placements: PlacedPatternWithOrder[],
  orderProgress: Record<string, OrderLayoutProgress>,
  batchName: string = '',
  fileName: string = 'nail-stickers-with-orders.pdf'
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

  if (orders.length > 0) {
    pdf.addPage([pdfWidth, pdfHeight], 'portrait')

    let y = 15
    pdf.setFontSize(16)
    pdf.setFont('helvetica', 'bold')
    pdf.text(batchName || '生产批次 - 订单分拣清单', pdfWidth / 2, y, { align: 'center' })
    y += 8

    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(100, 100, 100)
    const now = new Date()
    pdf.text(
      `生成时间: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`,
      pdfWidth / 2,
      y,
      { align: 'center' }
    )
    y += 8

    pdf.setDrawColor(200, 200, 200)
    pdf.setLineWidth(0.2)
    pdf.line(15, y, pdfWidth - 15, y)
    y += 6

    const activeOrders = orders.filter(o => orderProgress[o.id] && orderProgress[o.id].totalItems > 0)

    for (let oi = 0; oi < activeOrders.length; oi++) {
      const order = activeOrders[oi]
      const progress = orderProgress[order.id]

      if (y > pdfHeight - 50) {
        pdf.addPage([pdfWidth, pdfHeight], 'portrait')
        y = 20
      }

      pdf.setFillColor(
        parseInt(order.colorTag.slice(1, 3), 16),
        parseInt(order.colorTag.slice(3, 5), 16),
        parseInt(order.colorTag.slice(5, 7), 16)
      )
      pdf.rect(15, y - 3, 4, 4, 'F')

      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(0, 0, 0)
      pdf.text(order.customerName, 22, y)

      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(120, 120, 120)
      pdf.text(order.orderNo, pdfWidth - 50, y, { align: 'right' })
      y += 5

      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(80, 80, 80)

      const statusText: Record<string, string> = {
        pending_layout: '待排版',
        layout_done: '已排版',
        printed: '已打印',
        delivered: '已交付'
      }
      const infoParts = [
        `交付日期: ${order.deliveryDate}`,
        `状态: ${statusText[order.status] || order.status}`,
        order.isUrgent ? '急单' : '',
        order.requiresFullSet ? '成套要求' : ''
      ].filter(Boolean)
      pdf.text(infoParts.join('  |  '), 22, y)
      y += 4

      const totalItems = progress?.totalItems || 0
      const placedItems = progress?.placedItems || 0
      const completionPct = totalItems > 0 ? Math.round((placedItems / totalItems) * 100) : 0

      pdf.text(`完成度: ${placedItems}/${totalItems} (${completionPct}%)`, 22, y)

      const barX = 80
      const barWidth = pdfWidth - 95
      const barHeight = 3
      pdf.setDrawColor(220, 220, 220)
      pdf.rect(barX, y - 2, barWidth, barHeight, 'D')
      if (completionPct > 0) {
        if (completionPct >= 100) {
          pdf.setFillColor(34, 197, 94)
        } else if (completionPct >= 50) {
          pdf.setFillColor(59, 130, 246)
        } else {
          pdf.setFillColor(239, 68, 68)
        }
        pdf.rect(barX, y - 2, (barWidth * completionPct) / 100, barHeight, 'F')
      }
      y += 6

      if (order.items.length > 0) {
        pdf.setFontSize(8)
        pdf.setTextColor(100, 100, 100)
        pdf.text('图案明细:', 22, y)
        y += 4

        const placedByPattern = new Map<string, number>()
        for (const pl of placements) {
          if (pl.orderId === order.id) {
            const key = pl.orderItemId || pl.patternId
            placedByPattern.set(key, (placedByPattern.get(key) || 0) + 1)
          }
        }

        for (const item of order.items) {
          if (y > pdfHeight - 20) {
            pdf.addPage([pdfWidth, pdfHeight], 'portrait')
            y = 20
          }
          const placed = placedByPattern.get(item.id) || 0
          const complete = placed >= item.quantity
          pdf.setTextColor(complete ? 34 : 239, complete ? 197 : 68, complete ? 94 : 68)
          pdf.setFont('helvetica', 'normal')
          pdf.text(
            `  · ${item.patternName}  [${item.nailSize}/${item.nailShape}]  ${placed}/${item.quantity}${item.priority > 1 ? `  P${item.priority}` : ''}`,
            24,
            y
          )
          y += 4
        }
      }

      if (order.notes) {
        if (y > pdfHeight - 20) {
          pdf.addPage([pdfWidth, pdfHeight], 'portrait')
          y = 20
        }
        pdf.setFontSize(8)
        pdf.setTextColor(120, 120, 120)
        const noteLines = pdf.splitTextToSize(`备注: ${order.notes}`, pdfWidth - 40)
        pdf.text(noteLines, 22, y)
        y += noteLines.length * 4 + 2
      }

      if (progress?.missingItems.length) {
        if (y > pdfHeight - 20) {
          pdf.addPage([pdfWidth, pdfHeight], 'portrait')
          y = 20
        }
        pdf.setFontSize(8)
        pdf.setTextColor(239, 68, 68)
        pdf.text(`缺件警告: ${progress.missingItems.length} 项未排入`, 22, y)
        y += 5
      }

      y += 3
      pdf.setDrawColor(230, 230, 230)
      pdf.line(15, y, pdfWidth - 15, y)
      y += 5
    }

    if (pageIndices.length > 0) {
      if (y > pdfHeight - 40) {
        pdf.addPage([pdfWidth, pdfHeight], 'portrait')
        y = 20
      }
      pdf.setFontSize(10)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(0, 0, 0)
      pdf.text('分页订单分布', 15, y)
      y += 6

      pdf.setFontSize(8)
      const pageOrderMap = new Map<number, string[]>()
      for (const pl of placements) {
        if (!pl.orderId) continue
        if (!pageOrderMap.has(pl.pageIndex)) {
          pageOrderMap.set(pl.pageIndex, [])
        }
        const order = orders.find(o => o.id === pl.orderId)
        if (order && !pageOrderMap.get(pl.pageIndex)!.includes(order.customerName)) {
          pageOrderMap.get(pl.pageIndex)!.push(order.customerName)
        }
      }

      for (let p = 0; p < pageIndices.length; p++) {
        if (y > pdfHeight - 15) {
          pdf.addPage([pdfWidth, pdfHeight], 'portrait')
          y = 20
        }
        const customers = pageOrderMap.get(p) || []
        pdf.setTextColor(80, 80, 80)
        pdf.text(`第 ${p + 1} 页: ${customers.length > 0 ? customers.join(', ') : '无'}`, 18, y)
        y += 4
      }
    }
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
