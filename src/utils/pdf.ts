import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { A4_WIDTH_MM, A4_HEIGHT_MM } from '../data/nailConfig'
import type {
  PrintCalibration,
  CustomerOrder,
  PlacedPatternWithOrder,
  OrderLayoutProgress,
  QCInspectionSession,
  QCBatchStats,
  QCDefectType,
  QCPageCheck,
  QCPatternCheck,
  QCOrderCheck,
  ReworkBatch,
  UploadedPattern
} from '../types'
import { applyCalibrationWidth, applyCalibrationHeight } from './calibration'
import { getDefectInfo, getQCStatusLabel } from './qualityControl'

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

export async function exportQCReport(
  session: QCInspectionSession,
  stats: QCBatchStats,
  orders: CustomerOrder[],
  patterns: UploadedPattern[],
  placements: PlacedPatternWithOrder[],
  reworkBatch: ReworkBatch | null,
  fileName: string = 'qc-report.pdf'
): Promise<void> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  const pdfWidth = 210
  const pdfHeight = 297
  let y = 15

  pdf.setFontSize(18)
  pdf.setFont('helvetica', 'bold')
  pdf.text('质检报告', pdfWidth / 2, y, { align: 'center' })
  y += 6

  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(100, 100, 100)
  const now = new Date()
  pdf.text(
    `生成时间: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`,
    pdfWidth / 2,
    y,
    { align: 'center' }
  )
  y += 4
  pdf.text(`质检批次: ${session.batchName}`, pdfWidth / 2, y, { align: 'center' })
  y += 8

  pdf.setDrawColor(200, 200, 200)
  pdf.setLineWidth(0.2)
  pdf.line(15, y, pdfWidth - 15, y)
  y += 6

  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(0, 0, 0)
  pdf.text('质检统计概览', 15, y)
  y += 6

  const statsData = [
    ['总页数', stats.totalPages.toString()],
    ['已检页数', `${stats.checkedPages} (${stats.totalPages > 0 ? Math.round(stats.checkedPages / stats.totalPages * 100) : 0}%)`],
    ['合格页数', stats.passedPages.toString()],
    ['不合格页数', stats.failedPages.toString()],
    ['总贴纸数', stats.totalPatterns.toString()],
    ['合格率', `${stats.passRate.toFixed(1)}%`],
    ['受影响订单数', stats.affectedOrderIds.length.toString()],
    ['预计补打页数', stats.estimatedReprintPages.toString()],
    ['额外耗材成本', `¥${stats.extraMaterialCost.toFixed(2)}`]
  ]

  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')
  for (let i = 0; i < statsData.length; i += 2) {
    if (y > pdfHeight - 30) {
      pdf.addPage()
      y = 20
    }
    const left = statsData[i]
    const right = statsData[i + 1]
    pdf.setTextColor(100, 100, 100)
    pdf.text(left[0], 20, y)
    pdf.setTextColor(0, 0, 0)
    pdf.setFont('helvetica', 'bold')
    pdf.text(left[1], 70, y)
    pdf.setFont('helvetica', 'normal')
    if (right) {
      pdf.setTextColor(100, 100, 100)
      pdf.text(right[0], 115, y)
      pdf.setTextColor(0, 0, 0)
      pdf.setFont('helvetica', 'bold')
      pdf.text(right[1], 165, y)
      pdf.setFont('helvetica', 'normal')
    }
    y += 5
  }
  y += 3

  pdf.setDrawColor(230, 230, 230)
  pdf.line(15, y, pdfWidth - 15, y)
  y += 5

  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(0, 0, 0)
  pdf.text('问题分布', 15, y)
  y += 6

  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')
  let maxDefectCount = 0
  for (const count of Object.values(stats.defectBreakdown)) {
    if (count > maxDefectCount) maxDefectCount = count
  }
  for (const [defectType, count] of Object.entries(stats.defectBreakdown)) {
    if (y > pdfHeight - 20) {
      pdf.addPage()
      y = 20
    }
    const info = getDefectInfo(defectType as QCDefectType)
    const pct = maxDefectCount > 0 ? (count / maxDefectCount) * 60 : 0
    pdf.setTextColor(0, 0, 0)
    pdf.text(`${info.label} (${count})`, 20, y)
    const barX = 70
    const barHeight = 3
    pdf.setDrawColor(220, 220, 220)
    pdf.rect(barX, y - 2, 60, barHeight, 'D')
    if (count > 0) {
      const hexColor = info.color.replace('#', '')
      pdf.setFillColor(
        parseInt(hexColor.slice(0, 2), 16),
        parseInt(hexColor.slice(2, 4), 16),
        parseInt(hexColor.slice(4, 6), 16)
      )
      pdf.rect(barX, y - 2, pct, barHeight, 'F')
    }
    y += 5
  }
  y += 3

  pdf.addPage()
  y = 15

  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(0, 0, 0)
  pdf.text('质检清单 - 分页详情', pdfWidth / 2, y, { align: 'center' })
  y += 10

  const pageChecks = Object.values(session.pageChecks).sort((a, b) => a.pageIndex - b.pageIndex)
  for (const pageCheck of pageChecks) {
    if (y > pdfHeight - 40) {
      pdf.addPage()
      y = 20
    }

    pdf.setFontSize(11)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(0, 0, 0)
    pdf.text(`第 ${pageCheck.pageIndex + 1} 页`, 15, y)

    const statusColor = pageCheck.status === 'passed' ? [34, 197, 94]
      : pageCheck.status === 'failed' ? [239, 68, 68]
      : [156, 163, 175]
    pdf.setFillColor(statusColor[0], statusColor[1], statusColor[2])
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(8)
    pdf.text(` ${getQCStatusLabel(pageCheck.status)} `, 50, y + 0.5)
    y += 6

    if (pageCheck.defects.length > 0) {
      pdf.setFontSize(8)
      pdf.setTextColor(239, 68, 68)
      pdf.setFont('helvetica', 'normal')
      const defectLabels = pageCheck.defects.map(d => getDefectInfo(d).label).join('、')
      pdf.text(`问题类型: ${defectLabels}`, 20, y)
      y += 4
    }

    const patternChecks = Object.values(pageCheck.patternChecks)
    if (patternChecks.length > 0) {
      pdf.setFontSize(8)
      pdf.setTextColor(80, 80, 80)
      pdf.text(`贴纸明细 (${patternChecks.length} 张):`, 20, y)
      y += 4

      for (const pc of patternChecks) {
        if (y > pdfHeight - 15) {
          pdf.addPage()
          y = 20
        }
        const pattern = patterns.find(p => p.id === pc.patternId)
        const patternName = pattern?.name || '未知图案'
        const pStatus = pc.status === 'passed' ? '✓'
          : pc.status === 'failed' ? '✗'
          : '○'
        const pColor = pc.status === 'passed' ? [34, 197, 94]
          : pc.status === 'failed' ? [239, 68, 68]
          : [156, 163, 175]
        pdf.setTextColor(pColor[0], pColor[1], pColor[2])
        pdf.setFontSize(8)
        const pDefects = pc.defects.length > 0
          ? ` [${pc.defects.map(d => getDefectInfo(d).label).join(',')}]`
          : ''
        pdf.text(`  ${pStatus} ${patternName}${pDefects}`, 24, y)
        y += 4
      }
    }

    if (pageCheck.notes) {
      if (y > pdfHeight - 15) {
        pdf.addPage()
        y = 20
      }
      pdf.setFontSize(8)
      pdf.setTextColor(120, 120, 120)
      const noteLines = pdf.splitTextToSize(`备注: ${pageCheck.notes}`, pdfWidth - 40)
      pdf.text(noteLines, 20, y)
      y += noteLines.length * 4 + 2
    }

    y += 2
    pdf.setDrawColor(235, 235, 235)
    pdf.line(15, y, pdfWidth - 15, y)
    y += 4
  }

  pdf.addPage()
  y = 15

  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(0, 0, 0)
  pdf.text('受影响订单摘要', pdfWidth / 2, y, { align: 'center' })
  y += 10

  if (stats.affectedOrderIds.length === 0) {
    pdf.setFontSize(10)
    pdf.setTextColor(34, 197, 94)
    pdf.setFont('helvetica', 'normal')
    pdf.text('🎉 所有订单质检合格，无受影响订单', pdfWidth / 2, y, { align: 'center' })
  } else {
    for (const oid of stats.affectedOrderIds) {
      if (y > pdfHeight - 40) {
        pdf.addPage()
        y = 20
      }
      const order = orders.find(o => o.id === oid)
      const orderCheck = session.orderChecks[oid]
      if (!order) continue

      pdf.setFillColor(
        parseInt(order.colorTag.slice(1, 3), 16),
        parseInt(order.colorTag.slice(3, 5), 16),
        parseInt(order.colorTag.slice(5, 7), 16)
      )
      pdf.rect(15, y - 3, 4, 4, 'F')

      pdf.setFontSize(11)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(0, 0, 0)
      pdf.text(order.customerName, 22, y)

      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(120, 120, 120)
      pdf.text(order.orderNo, pdfWidth - 30, y, { align: 'right' })
      y += 5

      pdf.setFontSize(9)
      pdf.setTextColor(80, 80, 80)
      const infoParts = [
        `交付日期: ${order.deliveryDate}`,
        order.isUrgent ? '急单' : ''
      ].filter(Boolean)
      pdf.text(infoParts.join('  |  '), 22, y)
      y += 4

      if (orderCheck) {
        pdf.setTextColor(0, 0, 0)
        pdf.text(`质检进度: ${orderCheck.checkedItems}/${orderCheck.totalItems}  合格:${orderCheck.passedItems}  不合格:${orderCheck.failedItems}`, 22, y)
        y += 4

        const defectEntries = Object.entries(orderCheck.defectCounts).filter(([, c]) => c > 0)
        if (defectEntries.length > 0) {
          pdf.setTextColor(239, 68, 68)
          pdf.setFontSize(8)
          const dText = defectEntries.map(([t, c]) => `${getDefectInfo(t as QCDefectType).label}×${c}`).join('，')
          pdf.text(`问题: ${dText}`, 24, y)
          y += 4
        }
      }

      y += 2
      pdf.setDrawColor(230, 230, 230)
      pdf.line(15, y, pdfWidth - 15, y)
      y += 5
    }
  }

  if (reworkBatch && reworkBatch.reworkItems.length > 0) {
    pdf.addPage()
    y = 15

    pdf.setFontSize(14)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(0, 0, 0)
    pdf.text('返工清单', pdfWidth / 2, y, { align: 'center' })
    y += 6

    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(100, 100, 100)
    pdf.text(`返工批次: ${reworkBatch.name}`, pdfWidth / 2, y, { align: 'center' })
    y += 8

    pdf.setDrawColor(200, 200, 200)
    pdf.line(15, y, pdfWidth - 15, y)
    y += 6

    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(0, 0, 0)
    pdf.text('共需返工 ' + reworkBatch.reworkItems.length + ' 项图案', 15, y)
    y += 7

    for (let ri = 0; ri < reworkBatch.reworkItems.length; ri++) {
      if (y > pdfHeight - 20) {
        pdf.addPage()
        y = 20
      }
      const item = reworkBatch.reworkItems[ri]
      const pattern = patterns.find(p => p.id === item.patternId)
      const patternName = pattern?.name || '未知图案'
      const order = orders.find(o => o.id === item.orderId)

      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(0, 0, 0)
      pdf.text(`${ri + 1}. ${patternName}`, 20, y)
      y += 4

      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(80, 80, 80)
      const metaParts = [
        `规格: ${item.nailSize}/${item.nailShape}`,
        `数量: ${item.quantity}张`,
        order ? `订单: ${order.customerName}` : ''
      ].filter(Boolean)
      pdf.text(metaParts.join('  |  '), 24, y)
      y += 4

      if (item.defects.length > 0) {
        pdf.setTextColor(239, 68, 68)
        const dText = item.defects.map(d => getDefectInfo(d).label).join('、')
        pdf.text(`问题类型: ${dText}`, 24, y)
        y += 4
      }

      y += 2
    }
  }

  pdf.save(fileName)
}
