/** Ширина картинки до загрузки (для предупреждения «фото маленькое — будет нечётким»). */
export function imageWidth(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      resolve(img.naturalWidth)
      URL.revokeObjectURL(url)
    }
    img.onerror = () => {
      resolve(0)
      URL.revokeObjectURL(url)
    }
    img.src = url
  })
}

export const MIN_GOOD_WIDTH = 1200

/**
 * ТЗ §3.8.3: авто-сжатие до 1600 px по длинной стороне перед загрузкой.
 * Маленькие картинки не трогаем; PNG с прозрачностью остаётся PNG, остальное — JPEG 0.86.
 */
export async function compressImage(file: File, max = 1600): Promise<File> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = reject
      i.src = url
    })
    const k = max / Math.max(img.naturalWidth, img.naturalHeight)
    if (k >= 1 && file.size < 2 * 1024 * 1024) return file
    const w = Math.round(img.naturalWidth * Math.min(1, k))
    const h = Math.round(img.naturalHeight * Math.min(1, k))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, w, h)
    const type = file.type === 'image/png' ? 'image/png' : file.type === 'image/webp' ? 'image/webp' : 'image/jpeg'
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, 0.86))
    if (!blob || blob.size >= file.size) return file
    const ext = { 'image/png': '.png', 'image/webp': '.webp', 'image/jpeg': '.jpg' }[type]
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + ext, { type })
  } catch {
    return file
  } finally {
    URL.revokeObjectURL(url)
  }
}
