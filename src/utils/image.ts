import type { UploadedPattern } from '../types'

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
}

export function loadImageFromFile(file: File): Promise<UploadedPattern> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      const img = new Image()
      img.onload = () => {
        resolve({
          id: generateId(),
          name: file.name,
          dataUrl,
          width: img.width,
          height: img.height
        })
      }
      img.onerror = reject
      img.src = dataUrl
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
