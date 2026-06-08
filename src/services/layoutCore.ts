import type {
  PlacedPattern,
  PlacedPatternWithOrder,
  PatternTransform,
  UploadedPattern,
  PatternIndependentConfig,
  LayoutSettings,
  PrintCalibration,
  NailSize,
  NailShape,
  CustomerOrder
} from '../types'
import { A4_WIDTH_MM, A4_HEIGHT_MM, getNailDimensions } from '../data/nailConfig'
import { applyCalibrationWidth, applyCalibrationHeight, applyCalibrationX, applyCalibrationY } from '../utils/calibration'
import { getEffectiveConfig } from '../utils/patternConfig'

export const DEFAULT_TRANSFORM: PatternTransform = {
  rotation: 0,
  mirrorX: false,
  mirrorY: false,
  invertColor: false
}

export interface LayoutItem {
  patternId: string
  setGroupId: string | null
  priority: number
  nailSize: NailSize
  nailShape: NailShape
  widthMm: number
  heightMm: number
  quantityRemaining: number
  originalIndex: number
  orderId: string | null
  orderNo: string | null
  orderColorTag: string | null
  orderPriority: number
  isUrgent: boolean
  orderItemId: string | null
}

export function getCalibratedA4Dimensions(
  calibration: PrintCalibration
): { widthMm: number; heightMm: number } {
  return {
    widthMm: applyCalibrationWidth(A4_WIDTH_MM, calibration),
    heightMm: applyCalibrationHeight(A4_HEIGHT_MM, calibration)
  }
}

export function getPatternDims(
  nailSize: NailSize,
  calibration: PrintCalibration
): { width: number; height: number } {
  const raw = getNailDimensions(nailSize)
  return {
    width: applyCalibrationWidth(raw.width, calibration),
    height: applyCalibrationHeight(raw.height, calibration)
  }
}

export function buildLayoutItems(
  patterns: UploadedPattern[],
  patternConfigs: Record<string, PatternIndependentConfig>,
  settings: LayoutSettings,
  calibration: PrintCalibration
): LayoutItem[] {
  const items: LayoutItem[] = []
  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i]
    const cfg = getEffectiveConfig(pattern.id, patternConfigs, settings)
    const dims = getPatternDims(cfg.nailSize, calibration)
    items.push({
      patternId: pattern.id,
      setGroupId: cfg.setGroupId,
      priority: cfg.priority,
      nailSize: cfg.nailSize,
      nailShape: cfg.nailShape,
      widthMm: dims.width,
      heightMm: dims.height,
      quantityRemaining: cfg.quantity,
      originalIndex: i,
      orderId: null,
      orderNo: null,
      orderColorTag: null,
      orderPriority: 0,
      isUrgent: false,
      orderItemId: null
    })
  }
  return items
}

export function buildOrderLayoutItems(
  orders: CustomerOrder[],
  patterns: UploadedPattern[],
  calibration: PrintCalibration
): LayoutItem[] {
  const items: LayoutItem[] = []
  let globalIndex = 0
  for (const order of orders) {
    for (const item of order.items) {
      const pattern = patterns.find(p => p.id === item.patternId)
      if (!pattern) continue
      const dims = getPatternDims(item.nailSize, calibration)
      const orderPriorityBoost = order.isUrgent ? 10 : 0
      items.push({
        patternId: item.patternId,
        setGroupId: item.setGroupId,
        priority: item.priority,
        nailSize: item.nailSize,
        nailShape: item.nailShape,
        widthMm: dims.width,
        heightMm: dims.height,
        quantityRemaining: item.quantity,
        originalIndex: globalIndex,
        orderId: order.id,
        orderNo: order.orderNo,
        orderColorTag: order.colorTag,
        orderPriority: item.priority + orderPriorityBoost,
        isUrgent: order.isUrgent,
        orderItemId: item.id
      })
      globalIndex++
    }
  }
  return items
}

export interface PageState {
  pageIndex: number
  placements: Array<PlacedPattern & Partial<PlacedPatternWithOrder>>
  colsPerRow: number
  rowsPerPage: number
  cellWidth: number
  cellHeight: number
  margin: number
  gapX: number
  gapY: number
  usedCells: Set<string>
  nextRowCol: { row: number; col: number }
}

export function createPageState(
  pageIndex: number,
  cellWidth: number,
  cellHeight: number,
  colsPerRow: number,
  rowsPerPage: number,
  margin: number,
  gapX: number,
  gapY: number
): PageState {
  return {
    pageIndex,
    placements: [],
    colsPerRow,
    rowsPerPage,
    cellWidth,
    cellHeight,
    margin,
    gapX,
    gapY,
    usedCells: new Set(),
    nextRowCol: { row: 0, col: 0 }
  }
}

export function cellAvailable(
  state: PageState,
  row: number,
  col: number,
  widthCells: number = 1,
  heightCells: number = 1
): boolean {
  if (row + heightCells > state.rowsPerPage) return false
  if (col + widthCells > state.colsPerRow) return false
  for (let r = row; r < row + heightCells; r++) {
    for (let c = col; c < col + widthCells; c++) {
      if (state.usedCells.has(`${r},${c}`)) return false
    }
  }
  return true
}

export function findNextAdjacentSlot(
  state: PageState,
  preferGroupId: string | null,
  itemWidth: number,
  itemHeight: number,
  preferOrderId: string | null = null
): { row: number; col: number } | null {
  const cellW = state.cellWidth
  const cellH = state.cellHeight
  const widthCells = Math.max(1, Math.ceil(itemWidth / cellW))
  const heightCells = Math.max(1, Math.ceil(itemHeight / cellH))

  if (preferOrderId) {
    const orderPlacements = state.placements.filter(p => p.orderId === preferOrderId)
    for (const gp of orderPlacements) {
      const anchorCol = Math.round((gp.x - state.margin) / state.cellWidth)
      const anchorRow = Math.round((gp.y - state.margin) / state.cellHeight)
      const candidates = [
        { row: anchorRow, col: anchorCol + widthCells },
        { row: anchorRow + heightCells, col: anchorCol },
        { row: anchorRow, col: anchorCol - widthCells },
        { row: anchorRow - heightCells, col: anchorCol },
        { row: anchorRow + heightCells, col: anchorCol + widthCells }
      ]
      for (const cand of candidates) {
        if (cand.row >= 0 && cand.col >= 0 && cellAvailable(state, cand.row, cand.col, widthCells, heightCells)) {
          return cand
        }
      }
    }
  }

  if (preferGroupId) {
    const groupPlacements = state.placements.filter(p => p.setGroupId === preferGroupId)
    for (const gp of groupPlacements) {
      const anchorCol = Math.round((gp.x - state.margin) / state.cellWidth)
      const anchorRow = Math.round((gp.y - state.margin) / state.cellHeight)
      const candidates = [
        { row: anchorRow, col: anchorCol + widthCells },
        { row: anchorRow + heightCells, col: anchorCol },
        { row: anchorRow, col: anchorCol - widthCells },
        { row: anchorRow - heightCells, col: anchorCol },
        { row: anchorRow + heightCells, col: anchorCol + widthCells }
      ]
      for (const cand of candidates) {
        if (cand.row >= 0 && cand.col >= 0 && cellAvailable(state, cand.row, cand.col, widthCells, heightCells)) {
          return cand
        }
      }
    }
  }

  let { row, col } = state.nextRowCol
  while (row < state.rowsPerPage) {
    if (cellAvailable(state, row, col, widthCells, heightCells)) {
      return { row, col }
    }
    col++
    if (col >= state.colsPerRow) {
      col = 0
      row++
    }
  }
  return null
}

export function markCellsUsed(
  state: PageState,
  row: number,
  col: number,
  widthCells: number,
  heightCells: number
): void {
  for (let r = row; r < row + heightCells; r++) {
    for (let c = col; c < col + widthCells; c++) {
      state.usedCells.add(`${r},${c}`)
      if (r === state.nextRowCol.row && c === state.nextRowCol.col) {
        let nc = state.nextRowCol.col + 1
        let nr = state.nextRowCol.row
        while (nr < state.rowsPerPage && state.usedCells.has(`${nr},${nc}`)) {
          nc++
          if (nc >= state.colsPerRow) {
            nc = 0
            nr++
          }
        }
        state.nextRowCol = { row: nr, col: nc }
      }
    }
  }
}

export function groupItemsBySet(items: LayoutItem[]): Map<string | null, LayoutItem[]> {
  const groups = new Map<string | null, LayoutItem[]>()
  for (const item of items) {
    const key = item.setGroupId
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(item)
  }
  return groups
}

export function groupItemsByOrder(items: LayoutItem[]): Map<string | null, LayoutItem[]> {
  const groups = new Map<string | null, LayoutItem[]>()
  for (const item of items) {
    const key = item.orderId || item.setGroupId
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(item)
  }
  return groups
}

export function sortGroupsForPlacement(
  groups: Map<string | null, LayoutItem[]>,
  useOrderPriority: boolean = false
): Array<{ groupId: string | null; items: LayoutItem[] }> {
  const result: Array<{ groupId: string | null; items: LayoutItem[] }> = []
  for (const [groupId, items] of groups.entries()) {
    const sortedItems = [...items].sort((a, b) => {
      if (useOrderPriority) {
        if (b.isUrgent !== a.isUrgent) return b.isUrgent ? -1 : 1
        if (b.orderPriority !== a.orderPriority) return b.orderPriority - a.orderPriority
      }
      if (b.priority !== a.priority) return b.priority - a.priority
      return a.originalIndex - b.originalIndex
    })
    result.push({ groupId, items: sortedItems })
  }
  result.sort((a, b) => {
    if (useOrderPriority) {
      const aHasUrgent = a.items.some(i => i.isUrgent)
      const bHasUrgent = b.items.some(i => i.isUrgent)
      if (aHasUrgent !== bHasUrgent) return aHasUrgent ? -1 : 1
      const aMaxOrderPrio = Math.max(...a.items.map(i => i.orderPriority))
      const bMaxOrderPrio = Math.max(...b.items.map(i => i.orderPriority))
      if (bMaxOrderPrio !== aMaxOrderPrio) return bMaxOrderPrio - aMaxOrderPrio
    }
    const aMaxPriority = Math.max(...a.items.map(i => i.priority))
    const bMaxPriority = Math.max(...b.items.map(i => i.priority))
    if (bMaxPriority !== aMaxPriority) return bMaxPriority - aMaxPriority
    const aTotal = a.items.reduce((s, i) => s + i.quantityRemaining, 0)
    const bTotal = b.items.reduce((s, i) => s + i.quantityRemaining, 0)
    return bTotal - aTotal
  })
  return result
}
