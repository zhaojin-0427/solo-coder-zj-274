import type {
  QCDefectType,
  QCDefectTypeInfo,
  QCItemStatus,
  QCPatternCheck,
  QCPageCheck,
  QCOrderCheck,
  QCBatchStats,
  QCInspectionSession,
  ReworkBatch,
  QCMaterialCostConfig,
  PlacedPatternWithOrder,
  UploadedPattern,
  LayoutSettings,
  PrintCalibration,
  CustomerOrder,
  OrderPatternItem,
  NailSize,
  NailShape,
  PlacedPattern,
  PatternIndependentConfig
} from '../types'
import { generateId } from './image'
import { calculateOrderLayout, calculateLayout } from './layout'

const QC_SESSION_STORAGE_KEY = 'nail_sticker_qc_sessions'
const REWORK_BATCH_STORAGE_KEY = 'nail_sticker_rework_batches'
const QC_COST_CONFIG_KEY = 'nail_sticker_qc_cost_config'

export const QC_DEFECT_TYPES: QCDefectTypeInfo[] = [
  { type: 'color_deviation', label: '颜色偏差', color: '#EF4444', icon: '🎨' },
  { type: 'size_deviation', label: '尺寸偏差', color: '#F97316', icon: '📏' },
  { type: 'missing_print', label: '漏印', color: '#F59E0B', icon: '❌' },
  { type: 'cutting_risk', label: '裁切风险', color: '#84CC16', icon: '✂️' },
  { type: 'sticker_damaged', label: '贴纸破损', color: '#EC4899', icon: '💔' },
  { type: 'label_unclear', label: '订单标签不清晰', color: '#8B5CF6', icon: '🏷️' },
  { type: 'other', label: '其他问题', color: '#6B7280', icon: '⚠️' }
]

export const DEFAULT_COST_CONFIG: QCMaterialCostConfig = {
  a4SheetCost: 0.5,
  inkCostPerPage: 0.3,
  laborCostPerSheet: 0.2
}

export function getDefectInfo(type: QCDefectType): QCDefectTypeInfo {
  return QC_DEFECT_TYPES.find(d => d.type === type) || QC_DEFECT_TYPES[QC_DEFECT_TYPES.length - 1]
}

export function getQCStatusLabel(status: QCItemStatus): string {
  const labels: Record<QCItemStatus, string> = {
    pending: '待质检',
    passed: '合格',
    failed: '不合格'
  }
  return labels[status]
}

export function getQCStatusColor(status: QCItemStatus): string {
  const colors: Record<QCItemStatus, string> = {
    pending: 'bg-gray-100 text-gray-600',
    passed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700'
  }
  return colors[status]
}

function emptyDefectCounts(): Record<QCDefectType, number> {
  const counts: Record<string, number> = {}
  for (const d of QC_DEFECT_TYPES) {
    counts[d.type] = 0
  }
  return counts as Record<QCDefectType, number>
}

function createPatternCheck(
  placementGlobalIndex: number,
  patternId: string,
  pageIndex: number,
  orderId: string | null,
  orderItemId: string | null
): QCPatternCheck {
  return {
    placementGlobalIndex,
    patternId,
    pageIndex,
    orderId,
    orderItemId,
    status: 'pending',
    defects: [],
    notes: '',
    checkedAt: null
  }
}

function createPageCheck(pageIndex: number): QCPageCheck {
  return {
    pageIndex,
    status: 'pending',
    defects: [],
    notes: '',
    checkedAt: null,
    patternChecks: {}
  }
}

export function createQCInspectionSession(params: {
  batchId: string | null
  batchName: string
  sourceType: 'normal' | 'order'
  placements: (PlacedPattern | PlacedPatternWithOrder)[]
}): QCInspectionSession {
  const session: QCInspectionSession = {
    id: generateId(),
    batchId: params.batchId,
    batchName: params.batchName,
    sourceType: params.sourceType,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    pageChecks: {},
    orderChecks: {},
    isCompleted: false,
    completedAt: null
  }

  const pageIndices = new Set<number>()
  for (let i = 0; i < params.placements.length; i++) {
    const pl = params.placements[i] as PlacedPattern & { orderId?: string | null; orderItemId?: string | null }
    const pageIdx = pl.pageIndex
    pageIndices.add(pageIdx)

    if (!session.pageChecks[pageIdx]) {
      session.pageChecks[pageIdx] = createPageCheck(pageIdx)
    }

    session.pageChecks[pageIdx].patternChecks[i] = createPatternCheck(
      i,
      pl.patternId,
      pageIdx,
      pl.orderId || null,
      pl.orderItemId || null
    )
  }

  return session
}

export function getAllQCSessions(): QCInspectionSession[] {
  try {
    const data = localStorage.getItem(QC_SESSION_STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function saveQCSession(session: QCInspectionSession): QCInspectionSession[] {
  const sessions = getAllQCSessions()
  const idx = sessions.findIndex(s => s.id === session.id)
  session.updatedAt = Date.now()
  if (idx >= 0) {
    sessions[idx] = session
  } else {
    sessions.push(session)
  }
  localStorage.setItem(QC_SESSION_STORAGE_KEY, JSON.stringify(sessions))
  return sessions
}

export function deleteQCSession(sessionId: string): QCInspectionSession[] {
  const sessions = getAllQCSessions().filter(s => s.id !== sessionId)
  localStorage.setItem(QC_SESSION_STORAGE_KEY, JSON.stringify(sessions))
  return sessions
}

export function loadQCSession(sessionId: string): QCInspectionSession | null {
  return getAllQCSessions().find(s => s.id === sessionId) || null
}

export function updatePatternCheck(
  session: QCInspectionSession,
  placementGlobalIndex: number,
  pageIndex: number,
  patch: Partial<QCPatternCheck>
): QCInspectionSession {
  if (!session.pageChecks[pageIndex]) {
    session.pageChecks[pageIndex] = createPageCheck(pageIndex)
  }

  const pageCheck = session.pageChecks[pageIndex]
  const existing = pageCheck.patternChecks[placementGlobalIndex] || createPatternCheck(
    placementGlobalIndex, '', pageIndex, null, null
  )

  const updated: QCPatternCheck = {
    ...existing,
    ...patch,
    checkedAt: Date.now()
  }
  if (patch.status) {
    updated.checkedAt = Date.now()
  }

  pageCheck.patternChecks[placementGlobalIndex] = updated
  session.updatedAt = Date.now()

  const allPatterns = Object.values(pageCheck.patternChecks)
  const checkedPatterns = allPatterns.filter(p => p.status !== 'pending')
  const failedPatterns = allPatterns.filter(p => p.status === 'failed')

  if (checkedPatterns.length === allPatterns.length && allPatterns.length > 0) {
    pageCheck.status = failedPatterns.length > 0 ? 'failed' : 'passed'
    pageCheck.checkedAt = Date.now()
  } else if (failedPatterns.length > 0) {
    pageCheck.status = 'failed'
  } else {
    pageCheck.status = checkedPatterns.length > 0 ? 'pending' : 'pending'
  }

  const allDefects = new Set<QCDefectType>()
  for (const pc of Object.values(pageCheck.patternChecks)) {
    for (const d of pc.defects) {
      allDefects.add(d)
    }
  }
  pageCheck.defects = Array.from(allDefects)

  return session
}

export function updatePageCheck(
  session: QCInspectionSession,
  pageIndex: number,
  patch: Partial<QCPageCheck>
): QCInspectionSession {
  if (!session.pageChecks[pageIndex]) {
    session.pageChecks[pageIndex] = createPageCheck(pageIndex)
  }
  session.pageChecks[pageIndex] = {
    ...session.pageChecks[pageIndex],
    ...patch,
    checkedAt: patch.status && patch.status !== 'pending' ? Date.now() : session.pageChecks[pageIndex].checkedAt
  }
  session.updatedAt = Date.now()
  return session
}

export function markPageAllPatterns(
  session: QCInspectionSession,
  pageIndex: number,
  status: QCItemStatus
): QCInspectionSession {
  const pageCheck = session.pageChecks[pageIndex]
  if (!pageCheck) return session

  for (const idx of Object.keys(pageCheck.patternChecks)) {
    const i = Number(idx)
    pageCheck.patternChecks[i] = {
      ...pageCheck.patternChecks[i],
      status,
      checkedAt: Date.now()
    }
  }

  pageCheck.status = status
  pageCheck.checkedAt = Date.now()
  session.updatedAt = Date.now()

  return session
}

export function togglePatternDefect(
  session: QCInspectionSession,
  placementGlobalIndex: number,
  pageIndex: number,
  defectType: QCDefectType
): QCInspectionSession {
  if (!session.pageChecks[pageIndex]) {
    session.pageChecks[pageIndex] = createPageCheck(pageIndex)
  }
  const pageCheck = session.pageChecks[pageIndex]
  const pc = pageCheck.patternChecks[placementGlobalIndex] || createPatternCheck(
    placementGlobalIndex, '', pageIndex, null, null
  )

  const hasDefect = pc.defects.includes(defectType)
  const newDefects = hasDefect
    ? pc.defects.filter(d => d !== defectType)
    : [...pc.defects, defectType]

  return updatePatternCheck(session, placementGlobalIndex, pageIndex, {
    defects: newDefects,
    status: newDefects.length > 0 ? 'failed' : (pc.checkedAt ? 'passed' : 'pending')
  })
}

export function recomputeOrderChecks(
  session: QCInspectionSession,
  orders: CustomerOrder[]
): QCInspectionSession {
  const result: Record<string, QCOrderCheck> = {}

  for (const order of orders) {
    const totalItems = order.items.reduce((s, i) => s + i.quantity, 0)
    let checkedItems = 0
    let passedItems = 0
    let failedItems = 0
    const defectCounts = emptyDefectCounts()

    for (const pageCheck of Object.values(session.pageChecks)) {
      for (const pc of Object.values(pageCheck.patternChecks)) {
        if (pc.orderId !== order.id) continue
        if (pc.status !== 'pending') {
          checkedItems++
          if (pc.status === 'passed') passedItems++
          if (pc.status === 'failed') failedItems++
        }
        for (const d of pc.defects) {
          defectCounts[d]++
        }
      }
    }

    let status: QCItemStatus = 'pending'
    if (checkedItems === totalItems && totalItems > 0) {
      status = failedItems > 0 ? 'failed' : 'passed'
    } else if (failedItems > 0) {
      status = 'failed'
    }

    result[order.id] = {
      orderId: order.id,
      status,
      defectCounts,
      totalItems,
      checkedItems,
      passedItems,
      failedItems,
      notes: ''
    }
  }

  session.orderChecks = result
  session.updatedAt = Date.now()
  return session
}

export function computeQCBatchStats(
  session: QCInspectionSession,
  placements: (PlacedPattern | PlacedPatternWithOrder)[],
  costConfig: QCMaterialCostConfig = DEFAULT_COST_CONFIG
): QCBatchStats {
  const allPatternChecks: QCPatternCheck[] = []
  for (const pageCheck of Object.values(session.pageChecks)) {
    for (const pc of Object.values(pageCheck.patternChecks)) {
      allPatternChecks.push(pc)
    }
  }

  const totalPages = Math.max(0, ...placements.map(p => p.pageIndex)) + 1
  const checkedPages = Object.values(session.pageChecks).filter(p => p.status !== 'pending').length
  const passedPages = Object.values(session.pageChecks).filter(p => p.status === 'passed').length
  const failedPages = Object.values(session.pageChecks).filter(p => p.status === 'failed').length

  const totalPatterns = placements.length
  const checkedPatterns = allPatternChecks.filter(p => p.status !== 'pending').length
  const passedPatterns = allPatternChecks.filter(p => p.status === 'passed').length
  const failedPatterns = allPatternChecks.filter(p => p.status === 'failed').length

  const passRate = totalPatterns > 0 ? (passedPatterns / totalPatterns) * 100 : 0

  const affectedOrderIdsSet = new Set<string>()
  for (const pc of allPatternChecks) {
    if (pc.status === 'failed' && pc.orderId) {
      affectedOrderIdsSet.add(pc.orderId)
    }
  }
  const affectedOrderIds = Array.from(affectedOrderIdsSet)

  const patternsPerPage = placements.length > 0 ? placements.length / Math.max(1, totalPages) : 1
  const estimatedReprintPages = Math.ceil(failedPatterns / patternsPerPage)

  const extraMaterialCost = estimatedReprintPages * (costConfig.a4SheetCost +
    costConfig.inkCostPerPage + costConfig.laborCostPerSheet)

  const defectBreakdown = emptyDefectCounts()
  for (const pc of allPatternChecks) {
    for (const d of pc.defects) {
      defectBreakdown[d]++
    }
  }

  return {
    totalPages,
    checkedPages,
    passedPages,
    failedPages,
    totalPatterns,
    checkedPatterns,
    passedPatterns,
    failedPatterns,
    passRate,
    affectedOrderIds,
    estimatedReprintPages,
    extraMaterialCost,
    defectBreakdown
  }
}

export function isOrderDeliverable(
  session: QCInspectionSession,
  orderId: string
): { deliverable: boolean; reason: string } {
  const orderCheck = session.orderChecks[orderId]
  if (!orderCheck) {
    return { deliverable: false, reason: '未开始质检' }
  }
  if (orderCheck.status === 'passed') {
    return { deliverable: true, reason: '全部合格' }
  }
  if (orderCheck.status === 'failed' || orderCheck.failedItems > 0) {
    return { deliverable: false, reason: `存在 ${orderCheck.failedItems} 项不合格` }
  }
  if (orderCheck.checkedItems < orderCheck.totalItems) {
    return { deliverable: false, reason: `质检中 (${orderCheck.checkedItems}/${orderCheck.totalItems})` }
  }
  return { deliverable: false, reason: '待质检' }
}

export function completeQCSession(session: QCInspectionSession): QCInspectionSession {
  session.isCompleted = true
  session.completedAt = Date.now()
  session.updatedAt = Date.now()
  return session
}

export function generateReworkBatch(params: {
  session: QCInspectionSession
  placements: (PlacedPattern | PlacedPatternWithOrder)[]
  patterns: UploadedPattern[]
  settings: LayoutSettings
  calibration: PrintCalibration
  orders?: CustomerOrder[]
  batchName?: string
}): ReworkBatch {
  const { session, placements, patterns, settings, calibration, orders } = params

  const reworkMap = new Map<string, {
    patternId: string
    orderId: string | null
    orderItemId: string | null
    quantity: number
    nailSize: NailSize
    nailShape: NailShape
    defects: QCDefectType[]
  }>()

  for (const pageCheck of Object.values(session.pageChecks)) {
    for (const pc of Object.values(pageCheck.patternChecks)) {
      if (pc.status !== 'failed') continue
      const pl = placements[pc.placementGlobalIndex] as (PlacedPattern | (PlacedPatternWithOrder & { orderId?: string | null; orderItemId?: string | null }))
      if (!pl) continue

      const key = `${pl.patternId}-${(pl as any).orderId || 'none'}-${(pl as any).orderItemId || 'none'}-${pl.nailSize}-${pl.nailShape}`
      if (!reworkMap.has(key)) {
        reworkMap.set(key, {
          patternId: pl.patternId,
          orderId: (pl as any).orderId || null,
          orderItemId: (pl as any).orderItemId || null,
          quantity: 0,
          nailSize: pl.nailSize,
          nailShape: pl.nailShape,
          defects: []
        })
      }
      const entry = reworkMap.get(key)!
      entry.quantity++
      for (const d of pc.defects) {
        if (!entry.defects.includes(d)) entry.defects.push(d)
      }
    }
  }

  const reworkItems = Array.from(reworkMap.values())

  let reworkPlacements: PlacedPatternWithOrder[] = []
  let reworkPageInfo: any[] = []

  if (reworkItems.length > 0) {
    if (session.sourceType === 'order' && orders && orders.length > 0) {
      const orderReworkMap = new Map<string, CustomerOrder>()
      for (const item of reworkItems) {
        if (!item.orderId) continue
        if (!orderReworkMap.has(item.orderId)) {
          const originalOrder = orders.find(o => o.id === item.orderId)
          if (originalOrder) {
            orderReworkMap.set(item.orderId, {
              ...originalOrder,
              items: []
            })
          }
        }
        const reworkOrder = orderReworkMap.get(item.orderId)
        if (reworkOrder) {
          const pat = patterns.find(p => p.id === item.patternId)
          reworkOrder.items.push({
            id: item.orderItemId || `rework-${item.patternId}`,
            patternId: item.patternId,
            patternName: pat?.name || '未知图案',
            nailSize: item.nailSize,
            nailShape: item.nailShape,
            quantity: item.quantity,
            priority: 0,
            setGroupId: null
          })
        }
      }

      const reworkOrders = Array.from(orderReworkMap.values())
      const standaloneItems = reworkItems.filter(i => !i.orderId)
      if (standaloneItems.length > 0) {
        const standaloneOrder: CustomerOrder = {
          id: 'rework-standalone',
          orderNo: 'RW-STANDALONE',
          customerName: '独立返工',
          deliveryDate: new Date().toISOString().split('T')[0],
          isUrgent: true,
          notes: '无订单关联的返工贴纸',
          requiresFullSet: false,
          status: 'printed',
          items: standaloneItems.map(item => {
            const pat = patterns.find(p => p.id === item.patternId)
            return {
              id: `rework-${item.patternId}`,
              patternId: item.patternId,
              patternName: pat?.name || '未知图案',
              nailSize: item.nailSize,
              nailShape: item.nailShape,
              quantity: item.quantity,
              priority: 0,
              setGroupId: null
            }
          }),
          colorTag: '#8B5CF6',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          batchId: null
        }
        reworkOrders.push(standaloneOrder)
      }

      if (reworkOrders.length > 0) {
        const result = calculateOrderLayout(
          reworkOrders,
          patterns,
          settings,
          calibration
        )
        reworkPlacements = result.placements
        reworkPageInfo = result.pageInfo
      }
    } else {
      const reworkConfigs: Record<string, PatternIndependentConfig> = {}
      const reworkPatterns: UploadedPattern[] = []
      const seenPatternIds = new Set<string>()

      for (const item of reworkItems) {
        if (!seenPatternIds.has(item.patternId)) {
          const pat = patterns.find(p => p.id === item.patternId)
          if (pat) {
            reworkPatterns.push(pat)
            seenPatternIds.add(item.patternId)
          }
        }
        reworkConfigs[item.patternId] = {
          nailSize: item.nailSize,
          nailShape: item.nailShape,
          quantity: (reworkConfigs[item.patternId]?.quantity || 0) + item.quantity,
          priority: 0,
          setGroupId: null
        }
      }

      if (reworkPatterns.length > 0) {
        const result = calculateLayout(
          reworkPatterns,
          reworkConfigs,
          settings,
          calibration
        )
        reworkPlacements = result.placements.map(p => ({
          ...p,
          orderId: null,
          orderNo: null,
          orderColorTag: null,
          orderPriority: 0,
          isUrgent: false,
          orderItemId: null
        })) as PlacedPatternWithOrder[]
        reworkPageInfo = result.pageInfo
      }
    }
  }

  return {
    id: generateId(),
    name: params.batchName || `返工批次 - ${session.batchName}`,
    sourceSessionId: session.id,
    sourceBatchId: session.batchId,
    createdAt: Date.now(),
    reworkItems,
    placements: reworkPlacements,
    pageInfo: reworkPageInfo,
    settings: { ...settings },
    calibration: { ...calibration },
    isGenerated: reworkItems.length > 0
  }
}

export function getAllReworkBatches(): ReworkBatch[] {
  try {
    const data = localStorage.getItem(REWORK_BATCH_STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function saveReworkBatch(batch: ReworkBatch): ReworkBatch[] {
  const batches = getAllReworkBatches()
  const idx = batches.findIndex(b => b.id === batch.id)
  if (idx >= 0) {
    batches[idx] = batch
  } else {
    batches.push(batch)
  }
  localStorage.setItem(REWORK_BATCH_STORAGE_KEY, JSON.stringify(batches))
  return batches
}

export function deleteReworkBatch(batchId: string): ReworkBatch[] {
  const batches = getAllReworkBatches().filter(b => b.id !== batchId)
  localStorage.setItem(REWORK_BATCH_STORAGE_KEY, JSON.stringify(batches))
  return batches
}

export function loadReworkBatch(batchId: string): ReworkBatch | null {
  return getAllReworkBatches().find(b => b.id === batchId) || null
}

export function getQCCostConfig(): QCMaterialCostConfig {
  try {
    const data = localStorage.getItem(QC_COST_CONFIG_KEY)
    return data ? { ...DEFAULT_COST_CONFIG, ...JSON.parse(data) } : { ...DEFAULT_COST_CONFIG }
  } catch {
    return { ...DEFAULT_COST_CONFIG }
  }
}

export function saveQCCostConfig(config: QCMaterialCostConfig): void {
  localStorage.setItem(QC_COST_CONFIG_KEY, JSON.stringify(config))
}
