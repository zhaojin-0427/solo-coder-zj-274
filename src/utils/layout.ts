import type { LayoutSettings, PlacedPattern, UploadedPattern, MaterialEstimate } from '../types'
import { A4_WIDTH_MM, A4_HEIGHT_MM, getNailDimensions } from '../data/nailConfig'

export function calculateLayout(
  patterns: UploadedPattern[],
  settings: LayoutSettings
): PlacedPattern[] {
  const placements: PlacedPattern[] = []
  const { nailSize, gapX, gapY, margin, copiesPerNail } = settings
  const dims = getNailDimensions(nailSize)

  const patternWidth = dims.width
  const patternHeight = dims.height
  const cellWidth = patternWidth + gapX
  const cellHeight = patternHeight + gapY

  const usableWidth = A4_WIDTH_MM - 2 * margin
  const usableHeight = A4_HEIGHT_MM - 2 * margin

  const colsPerRow = Math.floor(usableWidth / cellWidth)
  const rowsPerPage = Math.floor(usableHeight / cellHeight)
  const patternsPerPage = colsPerRow * rowsPerPage

  let currentPage = 0
  let indexInPage = 0

  for (const pattern of patterns) {
    for (let copy = 0; copy < copiesPerNail; copy++) {
      const row = Math.floor(indexInPage / colsPerRow)
      const col = indexInPage % colsPerRow

      if (row >= rowsPerPage) {
        currentPage++
        indexInPage = 0
        const newRow = Math.floor(indexInPage / colsPerRow)
        const newCol = indexInPage % colsPerRow
        placements.push({
          patternId: pattern.id,
          x: margin + newCol * cellWidth,
          y: margin + newRow * cellHeight,
          width: patternWidth,
          height: patternHeight,
          transform: {
            rotation: 0,
            mirrorX: false,
            mirrorY: false,
            invertColor: false
          },
          pageIndex: currentPage
        })
      } else {
        placements.push({
          patternId: pattern.id,
          x: margin + col * cellWidth,
          y: margin + row * cellHeight,
          width: patternWidth,
          height: patternHeight,
          transform: {
            rotation: 0,
            mirrorX: false,
            mirrorY: false,
            invertColor: false
          },
          pageIndex: currentPage
        })
      }
      indexInPage++
    }
  }

  return placements
}

export function calculateMaterialEstimate(
  patterns: UploadedPattern[],
  placements: PlacedPattern[],
  settings: LayoutSettings
): MaterialEstimate {
  const { nailSize, copiesPerNail, margin, gapX, gapY } = settings
  const dims = getNailDimensions(nailSize)

  const totalPatterns = patterns.length * copiesPerNail
  const patternAreaMm2 = dims.width * dims.height
  const totalPatternArea = totalPatterns * patternAreaMm2

  const pagesNeeded = placements.length > 0
    ? Math.max(...placements.map(p => p.pageIndex)) + 1
    : 0

  const a4AreaMm2 = A4_WIDTH_MM * A4_HEIGHT_MM
  const totalPaperArea = pagesNeeded * a4AreaMm2

  const marginArea = 2 * margin * (A4_WIDTH_MM + A4_HEIGHT_MM) - 4 * margin * margin
  const usableArea = a4AreaMm2 - marginArea
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
