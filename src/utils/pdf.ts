import jsPDF from 'jspdf'
import type { PlacedPattern, UploadedPattern } from '../types'
import { A4_WIDTH_MM, A4_HEIGHT_MM } from '../data/nailConfig'

export async function exportToPDF(
  pages: Map<number, HTMLElement>,
  fileName: string = 'nail-stickers.pdf'
): Promise<void> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
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
      pdf.addPage()
    }

    pdf.addImage(imgData, 'PNG', 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM)
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
