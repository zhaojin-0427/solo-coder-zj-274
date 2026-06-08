import type {
  CustomerOrder,
  DeliveryLabelData,
  PackingListOrderData,
  PackingListItemDetail,
  DeliveryLabelConfig,
  QCInspectionSession,
  QCItemStatus,
  PlacedPatternWithOrder,
  NailSize,
  NailShape
} from '../types'
import {
  DEFAULT_DELIVERY_LABEL_CONFIG,
  DELIVERY_LABEL_CONFIG_STORAGE_KEY
} from '../types'
import { nailSizes, nailShapes } from '../data/nailConfig'
import { isOrderDeliverable } from './qualityControl'

function getNailSizeLabel(size: NailSize): string {
  return nailSizes[size]?.label || size
}

function getNailShapeLabel(shape: NailShape): string {
  return nailShapes[shape]?.label || shape
}

export function buildDeliveryLabelData(
  order: CustomerOrder,
  placements: PlacedPatternWithOrder[],
  qcSession: QCInspectionSession | null
): DeliveryLabelData {
  const orderPlacements = placements.filter(p => p.orderId === order.id)
  const totalStickers = orderPlacements.length

  const sizes = new Set(orderPlacements.map(p => p.nailSize))
  const shapes = new Set(orderPlacements.map(p => p.nailShape))

  const sizeLabels = Array.from(sizes).map(getNailSizeLabel)
  const shapeLabels = Array.from(shapes).map(getNailShapeLabel)

  const parts: string[] = []
  if (sizeLabels.length > 0) {
    parts.push(sizeLabels.join('/'))
  }
  if (shapeLabels.length > 0) {
    parts.push(shapeLabels.join('/'))
  }
  const nailSummary = parts.join(' · ')

  let qcStatus: QCItemStatus | 'not_checked' = 'not_checked'
  let isDeliverable = false

  if (qcSession) {
    const orderCheck = qcSession.orderChecks[order.id]
    if (orderCheck) {
      qcStatus = orderCheck.status
      const deliverableResult = isOrderDeliverable(qcSession, order.id)
      isDeliverable = deliverableResult.deliverable
    }
  }

  return {
    orderId: order.id,
    orderNo: order.orderNo,
    customerName: order.customerName,
    deliveryDate: order.deliveryDate,
    isUrgent: order.isUrgent,
    totalStickers,
    nailSizes: Array.from(sizes),
    nailShapes: Array.from(shapes),
    nailSummary,
    notes: order.notes,
    colorTag: order.colorTag,
    qcStatus,
    isDeliverable
  }
}

export function buildPackingListData(
  order: CustomerOrder,
  placements: PlacedPatternWithOrder[],
  qcSession: QCInspectionSession | null
): PackingListOrderData {
  const orderPlacements = placements.filter(p => p.orderId === order.id)

  const itemMap = new Map<string, {
    patternName: string
    nailSize: NailSize
    nailShape: NailShape
    quantity: number
    passedCount: number
    failedCount: number
    pendingCount: number
  }>()

  for (const item of order.items) {
    const key = `${item.patternId}-${item.nailSize}-${item.nailShape}`
    if (!itemMap.has(key)) {
      itemMap.set(key, {
        patternName: item.patternName,
        nailSize: item.nailSize,
        nailShape: item.nailShape,
        quantity: 0,
        passedCount: 0,
        failedCount: 0,
        pendingCount: 0
      })
    }
    const entry = itemMap.get(key)!
    entry.quantity += item.quantity
  }

  for (const pl of orderPlacements) {
    const key = `${pl.patternId}-${pl.nailSize}-${pl.nailShape}`
    if (!itemMap.has(key)) continue

    let status: QCItemStatus = 'pending'
    if (qcSession) {
      const pageCheck = qcSession.pageChecks[pl.pageIndex]
      if (pageCheck) {
        const globalIdx = placements.indexOf(pl)
        const pc = pageCheck.patternChecks[globalIdx]
        if (pc) {
          status = pc.status
        }
      }
    }

    const entry = itemMap.get(key)!
    if (status === 'passed') entry.passedCount++
    else if (status === 'failed') entry.failedCount++
    else entry.pendingCount++
  }

  const items: PackingListItemDetail[] = []
  for (const [, entry] of itemMap) {
    const isDeliverable = entry.passedCount >= entry.quantity && entry.failedCount === 0
    const itemStatus: QCItemStatus =
      entry.failedCount > 0 ? 'failed'
      : entry.passedCount >= entry.quantity ? 'passed'
      : 'pending'

    items.push({
      patternName: entry.patternName,
      nailSize: entry.nailSize,
      nailShape: entry.nailShape,
      quantity: entry.quantity,
      qcStatus: itemStatus,
      passedCount: entry.passedCount,
      failedCount: entry.failedCount,
      isDeliverable
    })
  }

  const totalStickers = items.reduce((s, i) => s + i.quantity, 0)
  const totalPassed = items.reduce((s, i) => s + i.passedCount, 0)
  const totalFailed = items.reduce((s, i) => s + i.failedCount, 0)
  const totalPending = items.reduce((s, i) => s + (i.quantity - i.passedCount - i.failedCount), 0)

  let qcStatus: QCItemStatus | 'not_checked' = 'not_checked'
  let isDeliverable = false

  if (qcSession) {
    const orderCheck = qcSession.orderChecks[order.id]
    if (orderCheck) {
      qcStatus = orderCheck.status
      const deliverableResult = isOrderDeliverable(qcSession, order.id)
      isDeliverable = deliverableResult.deliverable
    }
  } else {
    isDeliverable = totalFailed === 0 && orderPlacements.length >= totalStickers
    if (orderPlacements.length >= totalStickers && totalFailed === 0) {
      qcStatus = 'passed'
    } else if (orderPlacements.length === 0) {
      qcStatus = 'not_checked'
    } else {
      qcStatus = 'pending'
    }
  }

  return {
    orderId: order.id,
    orderNo: order.orderNo,
    customerName: order.customerName,
    deliveryDate: order.deliveryDate,
    isUrgent: order.isUrgent,
    colorTag: order.colorTag,
    notes: order.notes,
    totalStickers,
    totalPassed,
    totalFailed,
    totalPending,
    isDeliverable,
    qcStatus,
    items
  }
}

export function generateDeliveryLabels(
  orders: CustomerOrder[],
  placements: PlacedPatternWithOrder[],
  qcSession: QCInspectionSession | null
): DeliveryLabelData[] {
  return orders
    .filter(o => o.status === 'layout_done' || o.status === 'printed' || o.status === 'delivered')
    .map(order => buildDeliveryLabelData(order, placements, qcSession))
}

export function generatePackingList(
  orders: CustomerOrder[],
  placements: PlacedPatternWithOrder[],
  qcSession: QCInspectionSession | null
): PackingListOrderData[] {
  return orders
    .filter(o => o.status === 'layout_done' || o.status === 'printed' || o.status === 'delivered')
    .map(order => buildPackingListData(order, placements, qcSession))
}

export function getSavedDeliveryLabelConfig(): DeliveryLabelConfig {
  try {
    const data = localStorage.getItem(DELIVERY_LABEL_CONFIG_STORAGE_KEY)
    if (data) {
      const parsed = JSON.parse(data)
      return {
        ...DEFAULT_DELIVERY_LABEL_CONFIG,
        ...parsed
      }
    }
  } catch {}
  return { ...DEFAULT_DELIVERY_LABEL_CONFIG }
}

export function saveDeliveryLabelConfig(config: DeliveryLabelConfig): void {
  localStorage.setItem(DELIVERY_LABEL_CONFIG_STORAGE_KEY, JSON.stringify(config))
}

export function paginateDeliveryLabels(
  labels: DeliveryLabelData[],
  config: DeliveryLabelConfig
): DeliveryLabelData[][] {
  const pages: DeliveryLabelData[][] = []
  const perPage = config.labelsPerPage

  for (let i = 0; i < labels.length; i += perPage) {
    pages.push(labels.slice(i, i + perPage))
  }

  return pages
}

export function formatQCStatusLabel(status: QCItemStatus | 'not_checked'): string {
  const labels: Record<QCItemStatus | 'not_checked', string> = {
    pending: '质检中',
    passed: '合格',
    failed: '不合格',
    not_checked: '未质检'
  }
  return labels[status]
}

export function formatQCStatusColor(status: QCItemStatus | 'not_checked'): string {
  const colors: Record<QCItemStatus | 'not_checked', string> = {
    pending: '#F59E0B',
    passed: '#22C55E',
    failed: '#EF4444',
    not_checked: '#9CA3AF'
  }
  return colors[status]
}
