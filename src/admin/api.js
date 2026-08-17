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
