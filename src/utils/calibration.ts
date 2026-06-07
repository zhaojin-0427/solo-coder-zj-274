import type { PrintCalibration } from '../types'

export const DEFAULT_CALIBRATION: PrintCalibration = {
  enabled: false,
  referenceLengthMm: 100,
  measuredHorizontalMm: 100,
  measuredVerticalMm: 100,
  scaleX: 1,
  scaleY: 1
}

export function computeCalibrationScale(
  referenceMm: number,
  measuredHorizontalMm: number,
  measuredVerticalMm: number
): { scaleX: number; scaleY: number } {
  const scaleX = referenceMm > 0 ? measuredHorizontalMm / referenceMm : 1
  const scaleY = referenceMm > 0 ? measuredVerticalMm / referenceMm : 1
  return { scaleX, scaleY }
}

export function updateCalibrationFromMeasurements(
  calibration: PrintCalibration,
  referenceMm: number,
  measuredHorizontalMm: number,
  measuredVerticalMm: number
): PrintCalibration {
  const { scaleX, scaleY } = computeCalibrationScale(
    referenceMm,
    measuredHorizontalMm,
    measuredVerticalMm
  )
  return {
    ...calibration,
    referenceLengthMm: referenceMm,
    measuredHorizontalMm,
    measuredVerticalMm,
    scaleX,
    scaleY
  }
}

export function applyCalibrationX(mm: number, calibration: PrintCalibration): number {
  if (!calibration.enabled) return mm
  return mm / calibration.scaleX
}

export function applyCalibrationY(mm: number, calibration: PrintCalibration): number {
  if (!calibration.enabled) return mm
  return mm / calibration.scaleY
}

export function applyCalibrationWidth(widthMm: number, calibration: PrintCalibration): number {
  if (!calibration.enabled) return widthMm
  return widthMm / calibration.scaleX
}

export function applyCalibrationHeight(heightMm: number, calibration: PrintCalibration): number {
  if (!calibration.enabled) return heightMm
  return heightMm / calibration.scaleY
}

export function reverseCalibrationX(mm: number, calibration: PrintCalibration): number {
  if (!calibration.enabled) return mm
  return mm * calibration.scaleX
}

export function reverseCalibrationY(mm: number, calibration: PrintCalibration): number {
  if (!calibration.enabled) return mm
  return mm * calibration.scaleY
}

export function generateCalibrationRulerSvg(
  widthMm: number = 200,
  heightMm: number = 30
): string {
  const majorTickEvery = 10
  const minorTickEvery = 1
  const svgWidth = widthMm
  const svgHeight = heightMm
  let ticks = ''
  for (let mm = 0; mm <= widthMm; mm += minorTickEvery) {
    const isMajor = mm % majorTickEvery === 0
    const tickHeight = isMajor ? heightMm * 0.6 : heightMm * 0.35
    const x = mm
    ticks += `<line x1="${x}" y1="0" x2="${x}" y2="${tickHeight}" stroke="#000" stroke-width="${isMajor ? 0.3 : 0.15}" />`
    if (isMajor) {
      ticks += `<text x="${x}" y="${heightMm * 0.85}" font-size="3" text-anchor="middle" fill="#000" font-family="sans-serif">${mm}</text>`
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}mm" height="${svgHeight}mm" viewBox="0 0 ${svgWidth} ${svgHeight}">
  <rect x="0" y="0" width="${svgWidth}" height="${svgHeight}" fill="#fff" stroke="#ccc" stroke-width="0.2"/>
  <line x1="0" y1="0" x2="${svgWidth}" y2="0" stroke="#000" stroke-width="0.3"/>
  ${ticks}
  <text x="${svgWidth / 2}" y="${svgHeight - 2}" font-size="3.5" text-anchor="middle" fill="#333" font-family="sans-serif" font-weight="bold">打印校准尺（横向 ${widthMm}mm）- 测量后请输入实际值</text>
</svg>`
}

export function generateCalibrationRulerVerticalSvg(
  widthMm: number = 30,
  heightMm: number = 280
): string {
  const majorTickEvery = 10
  const minorTickEvery = 1
  const svgWidth = widthMm
  const svgHeight = heightMm
  let ticks = ''
  for (let mm = 0; mm <= heightMm; mm += minorTickEvery) {
    const isMajor = mm % majorTickEvery === 0
    const tickWidth = isMajor ? widthMm * 0.6 : widthMm * 0.35
    const y = mm
    ticks += `<line x1="0" y1="${y}" x2="${tickWidth}" y2="${y}" stroke="#000" stroke-width="${isMajor ? 0.3 : 0.15}" />`
    if (isMajor) {
      ticks += `<text x="${widthMm * 0.75}" y="${y + 1}" font-size="3" text-anchor="start" dominant-baseline="middle" fill="#000" font-family="sans-serif">${mm}</text>`
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}mm" height="${svgHeight}mm" viewBox="0 0 ${svgWidth} ${svgHeight}">
  <rect x="0" y="0" width="${svgWidth}" height="${svgHeight}" fill="#fff" stroke="#ccc" stroke-width="0.2"/>
  <line x1="0" y1="0" x2="0" y2="${svgHeight}" stroke="#000" stroke-width="0.3"/>
  ${ticks}
</svg>`
}

export function calibrationRulerDataUrl(): string {
  const svg = generateCalibrationRulerSvg()
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}
