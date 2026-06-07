import type {
  LayoutSettings,
  PlacedPattern,
  UploadedPattern,
  MaterialEstimate,
  PatternIndependentConfig,
  SetGroup,
  PrintCalibration,
  LayoutResult,
  LayoutConflict,
  LayoutConflictSuggestion,
  PageLayoutInfo,
  PatternTransform,
  NailSize,
  LayoutConflictType
} from '../types'
import { A4_WIDTH_MM, A4_HEIGHT_MM, getNailDimensions } from '../data/nailConfig'
import { applyCalibrationWidth, applyCalibrationHeight, applyCalibrationX, applyCalibrationY } from './calibration'
import { getEffectiveConfig } from './patternConfig'

const DEFAULT_TRANSFORM: PatternTransform = {
  rotation: 0,
  mirrorX: false,
  mirrorY: false,
  invertColor: false
}

interface LayoutItem {
  patternId: string
  setGroupId: string | null
  priority: number
  nailSize: NailSize
  nailShape: string
  widthMm: number
  heightMm: number
  quantityRemaining: number
  originalIndex: number
}

export function getCalibratedA4Dimensions(
  calibration: PrintCalibration
): { widthMm: number; heightMm: number } {
  return {
    widthMm: applyCalibrationWidth(A4_WIDTH_MM, calibration),
    heightMm: applyCalibrationHeight(A4_HEIGHT_MM, calibration)
  }
}

function getPatternDims(
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
      originalIndex: i
    })
  }
  return items
}

export function detectLayoutConflicts(
  patterns: UploadedPattern[],
  patternConfigs: Record<string, PatternIndependentConfig>,
  settings: LayoutSettings,
  calibration: PrintCalibration
): LayoutConflict[] {
  const conflicts: LayoutConflict[] = []
  const a4 = getCalibratedA4Dimensions(calibration)
  const calibratedMargin = applyCalibrationWidth(settings.margin, calibration)
  const calibratedGapX = applyCalibrationWidth(settings.gapX, calibration)
  const calibratedGapY = applyCalibrationHeight(settings.gapY, calibration)

  const usableWidth = a4.widthMm - 2 * calibratedMargin
  const usableHeight = a4.heightMm - 2 * calibratedMargin

  if (usableWidth <= 0 || usableHeight <= 0) {
    conflicts.push({
      type: 'margin_too_large',
      message: `页边距 (${settings.margin}mm) 过大，A4 可用区域为零。请减小边距。`,
      affectedPatternIds: patterns.map(p => p.id),
      suggestions: [
        { description: '将页边距减小到 5mm', settingKey: 'margin', recommendedValue: 5 },
        { description: '关闭校准以使用原始尺寸', settingKey: 'calibration', recommendedValue: false }
      ]
    })
    return conflicts
  }

  const tooWideIds: string[] = []
  const tooTallIds: string[] = []

  for (const pattern of patterns) {
    const cfg = getEffectiveConfig(pattern.id, patternConfigs, settings)
    const dims = getPatternDims(cfg.nailSize, calibration)
    const totalWidth = dims.width + calibratedGapX
    const totalHeight = dims.height + calibratedGapY
    if (totalWidth > usableWidth) tooWideIds.push(pattern.id)
    if (totalHeight > usableHeight) tooTallIds.push(pattern.id)
  }

  if (tooWideIds.length > 0) {
    const maxPatternW = Math.max(
      ...tooWideIds.map(id => {
        const cfg = getEffectiveConfig(id, patternConfigs, settings)
        return getPatternDims(cfg.nailSize, calibration).width
      })
    )
    const minMarginForFit = Math.max(0, (a4.widthMm - (maxPatternW + calibratedGapX)) / 2)
    conflicts.push({
      type: 'pattern_too_wide',
      message: `${tooWideIds.length} 个图案（含间距）宽度超过 A4 可用宽度 ${usableWidth.toFixed(1)}mm`,
      affectedPatternIds: tooWideIds,
      suggestions: [
        { description: `减小页边距到 ${Math.floor(minMarginForFit)}mm`, settingKey: 'margin', recommendedValue: Math.max(0, Math.floor(minMarginForFit)) },
        { description: '减小水平间距到 0mm', settingKey: 'gapX', recommendedValue: 0 },
        { description: '使用更小的指甲型号', settingKey: 'nailSize', recommendedValue: 0 }
      ] as LayoutConflictSuggestion[]
    })
  }

  if (tooTallIds.length > 0) {
    const maxPatternH = Math.max(
      ...tooTallIds.map(id => {
        const cfg = getEffectiveConfig(id, patternConfigs, settings)
        return getPatternDims(cfg.nailSize, calibration).height
      })
    )
    const minMarginForFit = Math.max(0, (a4.heightMm - (maxPatternH + calibratedGapY)) / 2)
    conflicts.push({
      type: 'pattern_too_tall',
      message: `${tooTallIds.length} 个图案（含间距）高度超过 A4 可用高度 ${usableHeight.toFixed(1)}mm`,
      affectedPatternIds: tooTallIds,
      suggestions: [
        { description: `减小页边距到 ${Math.floor(minMarginForFit)}mm`, settingKey: 'margin', recommendedValue: Math.max(0, Math.floor(minMarginForFit)) },
        { description: '减小垂直间距到 0mm', settingKey: 'gapY', recommendedValue: 0 }
      ]
    })
  }

  const noFitIds = tooWideIds.concat(tooTallIds.filter(id => !tooWideIds.includes(id)))
  if (patterns.length > 0 && noFitIds.length === patterns.length && conflicts.length > 0) {
    conflicts.push({
      type: 'no_patterns_fit',
      message: '所有图案均无法放入当前 A4 画布，请调整参数或校准设置。',
      affectedPatternIds: patterns.map(p => p.id),
      suggestions: [
        { description: '重置为默认排版参数', settingKey: 'margin', recommendedValue: 10 },
        { description: '关闭打印校准', settingKey: 'calibration', recommendedValue: false }
      ]
    })
  }

  return conflicts
}

function groupItemsBySet(items: LayoutItem[]): Map<string | null, LayoutItem[]> {
  const groups = new Map<string | null, LayoutItem[]>()
  for (const item of items) {
    const key = item.setGroupId
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(item)
  }
  return groups
}

function sortGroupsForPlacement(
  groups: Map<string | null, LayoutItem[]>
): Array<{ groupId: string | null; items: LayoutItem[] }> {
  const result: Array<{ groupId: string | null; items: LayoutItem[] }> = []
  for (const [groupId, items] of groups.entries()) {
    const sortedItems = [...items].sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority
      return a.originalIndex - b.originalIndex
    })
    result.push({ groupId, items: sortedItems })
  }
  result.sort((a, b) => {
    const aMaxPriority = Math.max(...a.items.map(i => i.priority))
    const bMaxPriority = Math.max(...b.items.map(i => i.priority))
    if (bMaxPriority !== aMaxPriority) return bMaxPriority - aMaxPriority
    const aTotal = a.items.reduce((s, i) => s + i.quantityRemaining, 0)
    const bTotal = b.items.reduce((s, i) => s + i.quantityRemaining, 0)
    return bTotal - aTotal
  })
  return result
}

interface PageState {
  pageIndex: number
  placements: PlacedPattern[]
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

function createPageState(
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

function cellAvailable(
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

function findNextAdjacentSlot(
  state: PageState,
  preferGroupId: string | null,
  itemWidth: number,
  itemHeight: number
): { row: number; col: number } | null {
  const cellW = state.cellWidth
  const cellH = state.cellHeight
  const widthCells = Math.max(1, Math.ceil(itemWidth / cellW))
  const heightCells = Math.max(1, Math.ceil(itemHeight / cellH))

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

function markCellsUsed(
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

export function calculateLayout(
  patterns: UploadedPattern[],
  patternConfigs: Record<string, PatternIndependentConfig>,
  settings: LayoutSettings,
  calibration: PrintCalibration,
  preservedTransforms: Map<string, PatternTransform> = new Map()
): LayoutResult {
  const placements: PlacedPattern[] = []
  const a4 = getCalibratedA4Dimensions(calibration)
  const calibratedMargin = applyCalibrationWidth(settings.margin, calibration)
  const calibratedGapX = applyCalibrationWidth(settings.gapX, calibration)
  const calibratedGapY = applyCalibrationHeight(settings.gapY, calibration)

  const usableWidth = a4.widthMm - 2 * calibratedMargin
  const usableHeight = a4.heightMm - 2 * calibratedMargin

  const baseDims = getPatternDims(settings.nailSize, calibration)
  const cellWidth = baseDims.width + calibratedGapX
  const cellHeight = baseDims.height + calibratedGapY

  const colsPerRow = Math.max(0, Math.floor(usableWidth / cellWidth))
  const rowsPerPage = Math.max(0, Math.floor(usableHeight / cellHeight))

  const conflicts = detectLayoutConflicts(patterns, patternConfigs, settings, calibration)
  const hasBlockingConflicts = conflicts.some(
    c => c.type === 'margin_too_large' || c.type === 'no_patterns_fit'
  )

  if (patterns.length === 0 || colsPerRow === 0 || rowsPerPage === 0 || hasBlockingConflicts) {
    return {
      placements: [],
      conflicts,
      pageInfo: []
    }
  }

  const allItems = buildLayoutItems(patterns, patternConfigs, settings, calibration)
  const sortedGroups = sortGroupsForPlacement(groupItemsBySet(allItems))

  const pages: PageState[] = []

  function getOrCreatePage(idx: number): PageState {
    if (!pages[idx]) {
      pages[idx] = createPageState(
        idx, cellWidth, cellHeight, colsPerRow, rowsPerPage,
        calibratedMargin, calibratedGapX, calibratedGapY
      )
    }
    return pages[idx]
  }

  let configIndex = 0
  for (const { groupId, items } of sortedGroups) {
    for (const item of items) {
      while (item.quantityRemaining > 0) {
        let placed = false
        for (let p = 0; p < pages.length + 1; p++) {
          const page = getOrCreatePage(p)
          const slot = findNextAdjacentSlot(page, groupId, item.widthMm, item.heightMm)
          if (slot) {
            const widthCells = Math.max(1, Math.ceil(item.widthMm / cellWidth))
            const heightCells = Math.max(1, Math.ceil(item.heightMm / cellHeight))
            markCellsUsed(page, slot.row, slot.col, widthCells, heightCells)
            const x = calibratedMargin + slot.col * cellWidth
            const y = calibratedMargin + slot.row * cellHeight
            const transformKey = `${item.patternId}-${configIndex}`
            const transform = preservedTransforms.get(transformKey) || { ...DEFAULT_TRANSFORM }
            page.placements.push({
              patternId: item.patternId,
              x: applyCalibrationX(x, calibration),
              y: applyCalibrationY(y, calibration),
              width: item.widthMm,
              height: item.heightMm,
              transform,
              pageIndex: p,
              nailSize: item.nailSize,
              nailShape: item.nailShape as any,
              setGroupId: item.setGroupId,
              configIndex
            })
            configIndex++
            item.quantityRemaining--
            placed = true
            break
          }
        }
        if (!placed) {
          const p = pages.length
          const page = getOrCreatePage(p)
          const slot = findNextAdjacentSlot(page, groupId, item.widthMm, item.heightMm)
          if (slot) {
            const widthCells = Math.max(1, Math.ceil(item.widthMm / cellWidth))
            const heightCells = Math.max(1, Math.ceil(item.heightMm / cellHeight))
            markCellsUsed(page, slot.row, slot.col, widthCells, heightCells)
            const x = calibratedMargin + slot.col * cellWidth
            const y = calibratedMargin + slot.row * cellHeight
            const transformKey = `${item.patternId}-${configIndex}`
            const transform = preservedTransforms.get(transformKey) || { ...DEFAULT_TRANSFORM }
            page.placements.push({
              patternId: item.patternId,
              x: applyCalibrationX(x, calibration),
              y: applyCalibrationY(y, calibration),
              width: item.widthMm,
              height: item.heightMm,
              transform,
              pageIndex: p,
              nailSize: item.nailSize,
              nailShape: item.nailShape as any,
              setGroupId: item.setGroupId,
              configIndex
            })
            configIndex++
            item.quantityRemaining--
          } else {
            item.quantityRemaining = 0
          }
        }
      }
    }
  }

  for (const page of pages) {
    for (const pl of page.placements) {
      placements.push(pl)
    }
  }

  const pageInfo = computePageLayoutInfo(
    placements, pages, patternConfigs, settings, calibration,
    colsPerRow, rowsPerPage, cellWidth, cellHeight
  )

  return { placements, conflicts, pageInfo }
}

function computePageLayoutInfo(
  placements: PlacedPattern[],
  pages: PageState[],
  patternConfigs: Record<string, PatternIndependentConfig>,
  settings: LayoutSettings,
  calibration: PrintCalibration,
  colsPerRow: number,
  rowsPerPage: number,
  cellWidth: number,
  cellHeight: number
): PageLayoutInfo[] {
  const a4 = getCalibratedA4Dimensions(calibration)
  const totalCells = colsPerRow * rowsPerPage
  const result: PageLayoutInfo[] = []
  const a4Area = a4.widthMm * a4.heightMm

  const setGroupTotals = new Map<string | null, number>()
  for (const [, cfg] of Object.entries(patternConfigs)) {
    const gid = cfg.setGroupId
    setGroupTotals.set(gid, (setGroupTotals.get(gid) || 0) + cfg.quantity)
  }

  for (let p = 0; p < pages.length; p++) {
    const pagePlacements = placements.filter(pl => pl.pageIndex === p)
    const usedCells = pagePlacements.length
    const usedArea = pagePlacements.reduce((s, pl) => s + pl.width * pl.height, 0)
    const wasteArea = Math.max(0, a4Area - usedArea)

    const setCounts = new Map<string | null, number>()
    for (const pl of pagePlacements) {
      const gid = pl.setGroupId
      setCounts.set(gid, (setCounts.get(gid) || 0) + 1)
    }

    const setCompletion: PageLayoutInfo['setCompletion'] = {}
    const incompleteSets: string[] = []
    for (const [gid, placedCount] of setCounts.entries()) {
      if (!gid) continue
      const total = setGroupTotals.get(gid) || 0
      const complete = total > 0 && placedCount >= total
      setCompletion[gid] = { total, placed: placedCount, complete }
      if (!complete) incompleteSets.push(gid)
    }

    result.push({
      pageIndex: p,
      totalCells,
      usedCells,
      wasteAreaMm2: wasteArea,
      estimatedStickers: usedCells,
      setCompletion,
      incompleteSets
    })
  }
  return result
}

export function calculateMaterialEstimate(
  patterns: UploadedPattern[],
  placements: PlacedPattern[],
  patternConfigs: Record<string, PatternIndependentConfig>,
  settings: LayoutSettings,
  calibration: PrintCalibration
): MaterialEstimate {
  let totalPatterns = 0
  let totalPatternArea = 0

  for (const pattern of patterns) {
    const cfg = getEffectiveConfig(pattern.id, patternConfigs, settings)
    const dims = getPatternDims(cfg.nailSize, calibration)
    totalPatterns += cfg.quantity
    totalPatternArea += cfg.quantity * dims.width * dims.height
  }

  const pagesNeeded = placements.length > 0
    ? Math.max(...placements.map(p => p.pageIndex)) + 1
    : 0

  const a4 = getCalibratedA4Dimensions(calibration)
  const a4Area = a4.widthMm * a4.heightMm
  const totalPaperArea = pagesNeeded * a4Area

  const calibratedMargin = applyCalibrationWidth(settings.margin, calibration)
  const marginArea = 2 * calibratedMargin * (a4.widthMm + a4.heightMm) - 4 * calibratedMargin * calibratedMargin
  const usableArea = a4Area - marginArea
  const estimatedWaste = Math.max(0, usableArea * pagesNeeded - totalPatternArea)

  const paperUsage = totalPaperArea > 0
    ? (totalPatternArea / totalPaperArea) * 100
    : 0

  return {
    totalPatterns,
    totalArea: totalPatternArea,
    paperUsage,
    estimatedWaste,
    pagesNeeded
  }
}

export function applyConflictSuggestion(
  settings: LayoutSettings,
  calibration: PrintCalibration,
  suggestion: LayoutConflictSuggestion
): { settings: LayoutSettings; calibration: PrintCalibration } {
  if (suggestion.settingKey === 'calibration') {
    return {
      settings,
      calibration: { ...calibration, enabled: Boolean(suggestion.recommendedValue) }
    }
  }
  const key = suggestion.settingKey as keyof LayoutSettings
  if (key === 'nailSize') {
    const sizes: NailSize[] = ['XS', 'S', 'M', 'L']
    const idx = Math.max(0, Math.min(3, Number(suggestion.recommendedValue) || 0))
    return {
      settings: { ...settings, nailSize: sizes[idx] },
      calibration
    }
  }
  return {
    settings: { ...settings, [key]: suggestion.recommendedValue },
    calibration
  }
}
