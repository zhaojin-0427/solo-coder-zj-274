import type {
  CustomerOrder,
  OrderStatus,
  OrderPatternItem,
  ProductionBatch,
  DeliveryWarning,
  OrderLayoutProgress,
  PageBatchInfo,
  PlacedPatternWithOrder,
  BatchOrderInfo
} from '../types'
import { generateId } from './image'

const ORDER_STORAGE_KEY = 'nail_sticker_orders'
const BATCH_STORAGE_KEY = 'nail_sticker_batches'

const ORDER_COLOR_PALETTE = [
  '#EF4444', '#F97316', '#F59E0B', '#84CC16',
  '#22C55E', '#10B981', '#14B8A6', '#06B6D4',
  '#0EA5E9', '#3B82F6', '#6366F1', '#8B5CF6',
  '#A855F7', '#D946EF', '#EC4899', '#F43F5E'
]

export function generateOrderNo(): string {
  const now = new Date()
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `SO${dateStr}${rand}`
}

export function getOrderStatusLabel(status: OrderStatus): string {
  const labels: Record<OrderStatus, string> = {
    pending_layout: '待排版',
    layout_done: '已排版',
    printed: '已打印',
    delivered: '已交付'
  }
  return labels[status]
}

export function getOrderStatusColor(status: OrderStatus): string {
  const colors: Record<OrderStatus, string> = {
    pending_layout: 'bg-gray-100 text-gray-700',
    layout_done: 'bg-blue-100 text-blue-700',
    printed: 'bg-purple-100 text-purple-700',
    delivered: 'bg-green-100 text-green-700'
  }
  return colors[status]
}

export function createOrder(params: {
  customerName: string
  deliveryDate: string
  isUrgent?: boolean
  notes?: string
  requiresFullSet?: boolean
  items?: OrderPatternItem[]
}): CustomerOrder {
  const usedColors = getAllOrders().map(o => o.colorTag)
  const availableColors = ORDER_COLOR_PALETTE.filter(c => !usedColors.includes(c))
  const colorTag = availableColors.length > 0
    ? availableColors[Math.floor(Math.random() * availableColors.length)]
    : ORDER_COLOR_PALETTE[Math.floor(Math.random() * ORDER_COLOR_PALETTE.length)]

  const now = Date.now()
  return {
    id: generateId(),
    orderNo: generateOrderNo(),
    customerName: params.customerName,
    deliveryDate: params.deliveryDate,
    isUrgent: params.isUrgent || false,
    notes: params.notes || '',
    requiresFullSet: params.requiresFullSet || false,
    status: 'pending_layout',
    items: params.items || [],
    colorTag,
    createdAt: now,
    updatedAt: now,
    batchId: null
  }
}

export function createOrderItem(params: {
  patternId: string
  patternName: string
  nailSize: OrderPatternItem['nailSize']
  nailShape: OrderPatternItem['nailShape']
  quantity: number
  priority?: number
  setGroupId?: string | null
}): OrderPatternItem {
  return {
    id: generateId(),
    patternId: params.patternId,
    patternName: params.patternName,
    nailSize: params.nailSize,
    nailShape: params.nailShape,
    quantity: params.quantity,
    priority: params.priority || 1,
    setGroupId: params.setGroupId || null
  }
}

export function getAllOrders(): CustomerOrder[] {
  try {
    const data = localStorage.getItem(ORDER_STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function saveOrders(orders: CustomerOrder[]): void {
  localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(orders))
}

export function saveOrder(order: CustomerOrder): CustomerOrder[] {
  const orders = getAllOrders()
  const idx = orders.findIndex(o => o.id === order.id)
  const now = Date.now()
  order.updatedAt = now
  if (idx >= 0) {
    orders[idx] = order
  } else {
    orders.push(order)
  }
  saveOrders(orders)
  return orders
}

export function deleteOrder(orderId: string): CustomerOrder[] {
  const orders = getAllOrders().filter(o => o.id !== orderId)
  saveOrders(orders)
  return orders
}

export function updateOrderStatus(orderId: string, status: OrderStatus): CustomerOrder[] {
  const orders = getAllOrders()
  const idx = orders.findIndex(o => o.id === orderId)
  if (idx >= 0) {
    orders[idx] = {
      ...orders[idx],
      status,
      updatedAt: Date.now()
    }
    saveOrders(orders)
  }
  return orders
}

export function boostOrderPriority(orderId: string): CustomerOrder[] {
  const orders = getAllOrders()
  const idx = orders.findIndex(o => o.id === orderId)
  if (idx >= 0) {
    orders[idx] = {
      ...orders[idx],
      isUrgent: true,
      items: orders[idx].items.map(item => ({
        ...item,
        priority: Math.min(10, item.priority + 3)
      })),
      updatedAt: Date.now()
    }
    saveOrders(orders)
  }
  return orders
}

export function getDaysRemaining(deliveryDate: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const delivery = new Date(deliveryDate)
  delivery.setHours(0, 0, 0, 0)
  const diffMs = delivery.getTime() - today.getTime()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

export function generateDeliveryWarnings(
  orders: CustomerOrder[],
  orderProgress: Record<string, OrderLayoutProgress>
): DeliveryWarning[] {
  const warnings: DeliveryWarning[] = []
  for (const order of orders) {
    if (order.status === 'delivered') continue
    const daysRemaining = getDaysRemaining(order.deliveryDate)
    const progress = orderProgress[order.id]
    const completionPercent = progress ? progress.completionPercent : 0
    const isComplete = progress ? progress.isComplete : false

    let shouldWarn = false
    let suggestion = ''

    if (order.isUrgent && !isComplete) {
      shouldWarn = true
      suggestion = '急单未完成排版，建议优先处理'
    } else if (daysRemaining <= 1 && completionPercent < 100) {
      shouldWarn = true
      suggestion = '明日交付但未完成排版，建议一键提升优先级'
    } else if (daysRemaining <= 3 && completionPercent < 80) {
      shouldWarn = true
      suggestion = '3天内交付但完成度不足80%，建议加快进度'
    } else if (daysRemaining <= 7 && completionPercent < 50) {
      shouldWarn = true
      suggestion = '一周内交付但完成度不足50%，建议关注'
    }

    if (shouldWarn) {
      warnings.push({
        orderId: order.id,
        orderNo: order.orderNo,
        customerName: order.customerName,
        deliveryDate: order.deliveryDate,
        daysRemaining,
        completionPercent,
        isUrgent: order.isUrgent,
        suggestion
      })
    }
  }
  return warnings.sort((a, b) => {
    if (a.isUrgent !== b.isUrgent) return a.isUrgent ? -1 : 1
    if (a.daysRemaining !== b.daysRemaining) return a.daysRemaining - b.daysRemaining
    return a.completionPercent - b.completionPercent
  })
}

export function computeOrderLayoutProgress(
  orders: CustomerOrder[],
  placements: PlacedPatternWithOrder[]
): Record<string, OrderLayoutProgress> {
  const result: Record<string, OrderLayoutProgress> = {}
  for (const order of orders) {
    const totalItems = order.items.reduce((s, i) => s + i.quantity, 0)
    const orderPlacements = placements.filter(p => p.orderId === order.id)
    const placedItems = orderPlacements.length
    const completionPercent = totalItems > 0 ? Math.round((placedItems / totalItems) * 100) : 0
    const isComplete = placedItems >= totalItems

    const placedByItem = new Map<string, number>()
    for (const pl of orderPlacements) {
      const key = pl.patternId
      placedByItem.set(key, (placedByItem.get(key) || 0) + 1)
    }

    const missingItems: OrderPatternItem[] = []
    const atRiskItems: OrderPatternItem[] = []
    for (const item of order.items) {
      const placed = placedByItem.get(item.patternId) || 0
      if (placed < item.quantity) {
        if (placed === 0 || (item.quantity - placed) >= 3) {
          missingItems.push(item)
        } else {
          atRiskItems.push(item)
        }
      }
    }

    result[order.id] = {
      orderId: order.id,
      totalItems,
      placedItems,
      completionPercent,
      isComplete,
      missingItems,
      atRiskItems
    }
  }
  return result
}

export function computeBatchPageInfo(
  orders: CustomerOrder[],
  placements: PlacedPatternWithOrder[],
  totalPages: number
): PageBatchInfo[] {
  const result: PageBatchInfo[] = []
  for (let p = 0; p < totalPages; p++) {
    const pagePlacements = placements.filter(pl => pl.pageIndex === p)
    const orderMap = new Map<string, BatchOrderInfo>()
    for (const pl of pagePlacements) {
      if (!pl.orderId) continue
      if (!orderMap.has(pl.orderId)) {
        const order = orders.find(o => o.id === pl.orderId)
        const totalCount = order ? order.items.reduce((s, i) => s + i.quantity, 0) : 0
        orderMap.set(pl.orderId, {
          orderId: pl.orderId,
          pages: [p],
          placedCount: 0,
          totalCount
        })
      }
      const info = orderMap.get(pl.orderId)!
      info.placedCount++
    }

    const ordersOnPage = Array.from(orderMap.values())
    const uniqueOrders = ordersOnPage.length
    const estimatedSortTimeSeconds = uniqueOrders * 30 + pagePlacements.length * 2

    let riskLevel: 'low' | 'medium' | 'high' = 'low'
    if (uniqueOrders >= 5) riskLevel = 'high'
    else if (uniqueOrders >= 3) riskLevel = 'medium'

    result.push({
      pageIndex: p,
      orders: ordersOnPage,
      estimatedSortTimeSeconds,
      riskLevel
    })
  }
  return result
}

export function filterOrders(
  orders: CustomerOrder[],
  params: {
    status?: OrderStatus | 'all'
    keyword?: string
    isUrgent?: boolean | null
    dateFrom?: string
    dateTo?: string
  }
): CustomerOrder[] {
  return orders.filter(order => {
    if (params.status && params.status !== 'all' && order.status !== params.status) return false
    if (params.keyword) {
      const kw = params.keyword.toLowerCase()
      if (
        !order.orderNo.toLowerCase().includes(kw) &&
        !order.customerName.toLowerCase().includes(kw) &&
        !order.notes.toLowerCase().includes(kw)
      ) return false
    }
    if (params.isUrgent !== null && params.isUrgent !== undefined && order.isUrgent !== params.isUrgent) return false
    if (params.dateFrom && order.deliveryDate < params.dateFrom) return false
    if (params.dateTo && order.deliveryDate > params.dateTo) return false
    return true
  }).sort((a, b) => {
    if (a.isUrgent !== b.isUrgent) return a.isUrgent ? -1 : 1
    return a.deliveryDate.localeCompare(b.deliveryDate)
  })
}

export function getAllBatches(): ProductionBatch[] {
  try {
    const data = localStorage.getItem(BATCH_STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function saveBatch(batch: ProductionBatch): ProductionBatch[] {
  const batches = getAllBatches()
  const idx = batches.findIndex(b => b.id === batch.id)
  batch.updatedAt = Date.now()
  if (idx >= 0) {
    batches[idx] = batch
  } else {
    batches.push(batch)
  }
  localStorage.setItem(BATCH_STORAGE_KEY, JSON.stringify(batches))
  return batches
}

export function deleteBatch(batchId: string): ProductionBatch[] {
  const batches = getAllBatches().filter(b => b.id !== batchId)
  localStorage.setItem(BATCH_STORAGE_KEY, JSON.stringify(batches))
  return batches
}

export function loadBatch(batchId: string): ProductionBatch | null {
  return getAllBatches().find(b => b.id === batchId) || null
}

export function createBatch(params: {
  name: string
  orderIds: string[]
}): ProductionBatch {
  return {
    id: generateId(),
    name: params.name,
    orderIds: params.orderIds,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    placements: [],
    pageInfo: [],
    batchPageInfo: [],
    settings: {
      nailSize: 'M',
      nailShape: 'square',
      gapX: 2,
      gapY: 2,
      margin: 10,
      copiesPerNail: 5
    },
    calibration: {
      enabled: false,
      referenceLengthMm: 100,
      measuredHorizontalMm: 100,
      measuredVerticalMm: 100,
      scaleX: 1,
      scaleY: 1
    }
  }
}

export function estimateSortingTime(placements: PlacedPatternWithOrder[]): number {
  const orderIds = new Set(placements.map(p => p.orderId).filter(Boolean) as string[])
  return orderIds.size * 60 + placements.length * 2
}
