export async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.method && options.method !== 'GET' ? { 'X-Admin-Request': '1' } : {}),
      ...options.headers,
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || `Ошибка ${response.status}`)
  return payload
}

export async function uploadImageFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('Выберите изображение JPG, PNG, WebP или GIF.')
  }
  // Preserve animated GIFs; optimize still images before sending to shared hosting.
  if (file.size > 30 * 1024 * 1024) throw new Error('Исходное фото должно быть меньше 30 МБ.')
  if (file.type !== 'image/gif') {
    let bitmap
    try {
      bitmap = await createImageBitmap(file)
      const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas unavailable')
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.85))
      if (!blob) throw new Error('WebP unavailable')
      file = blob
    } catch {
      throw new Error('Не удалось обработать фото. Попробуйте JPG, PNG или WebP меньшего размера.')
    } finally {
      bitmap?.close()
    }
  }
  if (file.size > 8 * 1024 * 1024) throw new Error('Изображение после обработки превышает 8 МБ.')
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Не удалось прочитать файл.'))
    reader.readAsDataURL(file)
  })
  const result = await api('/api/admin/upload', {
    method: 'POST',
    body: JSON.stringify({ data }),
  })
  return result.url
}
