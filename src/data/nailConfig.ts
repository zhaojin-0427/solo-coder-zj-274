import type { NailSize, NailShape, NailSizeConfig, NailShapeConfig, NailDimensions } from '../types'

export const A4_WIDTH_MM = 210
export const A4_HEIGHT_MM = 297
export const MM_TO_PX = 3.7795275591

export const nailSizes: Record<NailSize, NailSizeConfig> = {
  XS: {
    label: 'XS (特小)',
    dimensions: { width: 9, height: 11 }
  },
  S: {
    label: 'S (小)',
    dimensions: { width: 11, height: 13 }
  },
  M: {
    label: 'M (中)',
    dimensions: { width: 13, height: 15 }
  },
  L: {
    label: 'L (大)',
    dimensions: { width: 15, height: 17 }
  }
}

export const nailShapes: Record<NailShape, NailShapeConfig> = {
  square: { label: '方形', icon: '■' },
  round: { label: '圆形', icon: '●' },
  oval: { label: '椭圆形', icon: '⬭' },
  almond: { label: '杏仁形', icon: '🔸' },
  stiletto: { label: '尖形', icon: '🔺' },
  coffin: { label: '棺材形/芭蕾形', icon: '⬢' }
}

export function getNailDimensions(size: NailSize): NailDimensions {
  return nailSizes[size].dimensions
}

export function mmToPx(mm: number): number {
  return mm * MM_TO_PX
}

export function pxToMm(px: number): number {
  return px / MM_TO_PX
}

export function getNailClipPath(shape: NailShape): string {
  switch (shape) {
    case 'square':
      return 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)'
    case 'round':
      return 'polygon(10% 0%, 90% 0%, 100% 10%, 100% 90%, 90% 100%, 10% 100%, 0% 90%, 0% 10%)'
    case 'oval':
      return 'ellipse(50% 50% at 50% 50%)'
    case 'almond':
      return 'polygon(50% 0%, 90% 25%, 100% 60%, 90% 100%, 10% 100%, 0% 60%, 10% 25%)'
    case 'stiletto':
      return 'polygon(50% 0%, 100% 70%, 85% 100%, 15% 100%, 0% 70%)'
    case 'coffin':
      return 'polygon(20% 0%, 80% 0%, 100% 20%, 95% 100%, 5% 100%, 0% 20%)'
    default:
      return 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)'
  }
}

export function getNailBorderRadius(shape: NailShape): string {
  switch (shape) {
    case 'square':
      return '2px'
    case 'round':
      return '30%'
    case 'oval':
      return '50%'
    case 'almond':
      return '50% 50% 20% 20% / 60% 60% 40% 40%'
    case 'stiletto':
      return '50% 50% 10% 10% / 80% 80% 20% 20%'
    case 'coffin':
      return '10% 10% 5% 5%'
    default:
      return '2px'
  }
}
