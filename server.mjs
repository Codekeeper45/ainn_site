import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { createReadStream, existsSync } from 'node:fs'
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import http from 'node:http'

const rootDir = fileURLToPath(new URL('.', import.meta.url))
const distDir = join(rootDir, 'dist')
const dataDir = join(rootDir, '.site-data')
const uploadsDir = join(dataDir, 'uploads')
const contentFile = join(dataDir, 'content.json')
const host = process.env.HOST || '127.0.0.1'
const port = Number(process.env.PORT || 4175)
// Keep the editor available for review, while requiring an explicit opt-in to
// persist changes. Set ADMIN_SAVE_ENABLED=true when the owner is ready to save.
const adminEnabled = process.env.ADMIN_ENABLED !== 'false'
const adminSaveEnabled = process.env.ADMIN_SAVE_ENABLED === 'true'
const adminUser = process.env.ADMIN_USER || 'admin'
const adminPassword = process.env.ADMIN_PASSWORD || 'stalkom-demo-2026'
const demoCredentials = process.env.ADMIN_USER || process.env.ADMIN_PASSWORD
  ? null
  : { username: adminUser, password: adminPassword }
const sessionHours = 8
const sessions = new Map()
const loginAttempts = new Map()

const emptyContent = () => ({ version: 1, updatedAt: null, texts: {}, images: {} })

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
}

await mkdir(uploadsDir, { recursive: true })

async function loadContent() {
  try {
    return validateContent(JSON.parse(await readFile(contentFile, 'utf8')))
  } catch (error) {
    if (error?.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error
    return emptyContent()
  }
}

async function saveContent(content) {
  const next = { ...validateContent(content), version: 1, updatedAt: new Date().toISOString() }
  const tempFile = `${contentFile}.${process.pid}.tmp`
  await writeFile(tempFile, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 })
  await rename(tempFile, contentFile)
  return next
}

function validateContent(value) {
  const source = value && typeof value === 'object' ? value : {}
  const texts = {}
  const images = {}

  for (const [key, text] of Object.entries(source.texts || {}).slice(0, 1200)) {
    if (typeof key !== 'string' || key.length > 260 || typeof text !== 'string') continue
    texts[key] = text.slice(0, 6000)
  }

  for (const [key, image] of Object.entries(source.images || {}).slice(0, 300)) {
    if (typeof key !== 'string' || key.length > 260 || !image || typeof image !== 'object') continue
    const url = typeof image.url === 'string' ? image.url : ''
    if (url && !url.startsWith('/uploads/') && !url.startsWith('/assets/')) continue
    images[key] = {
      url,
      removed: Boolean(image.removed),
      kind: image.kind === 'background' ? 'background' : 'image',
    }
  }

  return {
    version: 1,
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : null,
    texts,
    images,
  }
}

function json(response, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload)
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
    'Content-Type': 'application/json; charset=utf-8',
    ...extraHeaders,
  })
  response.end(body)
}

async function readJson(request, limit = 128 * 1024) {
  const chunks = []
  let length = 0
  for await (const chunk of request) {
    length += chunk.length
    if (length > limit) {
      const error = new Error('Payload too large')
      error.statusCode = 413
      throw error
    }
    chunks.push(chunk)
  }
  if (!chunks.length) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function cookieValue(request, name) {
  const cookies = request.headers.cookie?.split(';') || []
  for (const cookie of cookies) {
    const [key, ...parts] = cookie.trim().split('=')
    if (key === name) return decodeURIComponent(parts.join('='))
  }
  return ''
}

function sessionFor(request) {
  const token = cookieValue(request, 'skp_admin')
  const session = sessions.get(token)
  if (!session || session.expiresAt <= Date.now()) {
    if (token) sessions.delete(token)
    return null
  }
  session.expiresAt = Date.now() + sessionHours * 60 * 60 * 1000
  return session
}

function sessionCookie(request, token, maxAge = sessionHours * 60 * 60) {
  const forwardedProto = String(request.headers['x-forwarded-proto'] || '')
  const secure = forwardedProto.includes('https') ? '; Secure' : ''
  return `skp_admin=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${maxAge}${secure}`
}

function requireAdmin(request, response) {
  if (!sessionFor(request)) {
    json(response, 401, { error: 'Требуется вход в админ-панель.' })
    return false
  }
  if (request.method !== 'GET' && request.headers['x-admin-request'] !== '1') {
    json(response, 403, { error: 'Запрос отклонён.' })
    return false
  }
  return true
}

function equalSecret(left, right) {
  const leftHash = createHash('sha256').update(String(left)).digest()
  const rightHash = createHash('sha256').update(String(right)).digest()
  return timingSafeEqual(leftHash, rightHash)
}

function clientKey(request) {
  return String(request.headers['cf-connecting-ip'] || request.socket.remoteAddress || 'unknown')
}

function mayAttemptLogin(request) {
  const key = clientKey(request)
  const now = Date.now()
  const current = loginAttempts.get(key)
  if (!current || current.resetAt <= now) {
    loginAttempts.set(key, { count: 0, resetAt: now + 10 * 60 * 1000 })
    return true
  }
  return current.count < 10
}

function recordFailedLogin(request) {
  const key = clientKey(request)
  const current = loginAttempts.get(key) || { count: 0, resetAt: Date.now() + 10 * 60 * 1000 }
  current.count += 1
  loginAttempts.set(key, current)
}

async function serveFile(response, filePath, requestPath) {
  let info
  try {
    info = await stat(filePath)
  } catch {
    return false
  }
  if (!info.isFile()) return false

  const type = mimeTypes[extname(filePath).toLowerCase()] || 'application/octet-stream'
  const cacheControl = requestPath.startsWith('/assets/')
    ? 'public, max-age=31536000, immutable'
    : requestPath.startsWith('/uploads/')
      ? 'public, max-age=3600'
      : 'no-cache'
  response.writeHead(200, {
    'Cache-Control': cacheControl,
    'Content-Length': info.size,
    'Content-Type': type,
    'X-Content-Type-Options': 'nosniff',
  })
  createReadStream(filePath).pipe(response)
  return true
}

function safeStaticPath(base, requestPath) {
  const decoded = decodeURIComponent(requestPath)
  const candidate = resolve(base, `.${normalize(decoded)}`)
  return candidate.startsWith(`${resolve(base)}/`) ? candidate : null
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', 'http://localhost')
    const pathname = url.pathname

    if (!adminEnabled && (pathname === '/admin' || pathname === '/admin/' || pathname.startsWith('/api/admin/'))) {
      return json(response, 503, { error: 'Админ-панель временно отключена.' })
    }

    if (pathname === '/api/content' && request.method === 'GET') {
      return json(response, 200, await loadContent())
    }

    if (pathname === '/api/admin/session' && request.method === 'GET') {
      return json(response, 200, {
        authenticated: Boolean(sessionFor(request)),
        user: adminUser,
        demoCredentials,
        saveEnabled: adminSaveEnabled,
      })
    }

    if (pathname === '/api/admin/login' && request.method === 'POST') {
      if (!mayAttemptLogin(request)) {
        return json(response, 429, { error: 'Слишком много попыток. Повторите позже.' })
      }
      const body = await readJson(request)
      const valid = equalSecret(body.username, adminUser) && equalSecret(body.password, adminPassword)
      if (!valid) {
        recordFailedLogin(request)
        return json(response, 401, { error: 'Неверный логин или пароль.' })
      }
      loginAttempts.delete(clientKey(request))
      const token = randomBytes(32).toString('base64url')
      sessions.set(token, { user: adminUser, expiresAt: Date.now() + sessionHours * 60 * 60 * 1000 })
      return json(response, 200, { authenticated: true, user: adminUser }, {
        'Set-Cookie': sessionCookie(request, token),
      })
    }

    if (pathname === '/api/admin/logout' && request.method === 'POST') {
      const token = cookieValue(request, 'skp_admin')
      if (token) sessions.delete(token)
      return json(response, 200, { authenticated: false }, {
        'Set-Cookie': sessionCookie(request, '', 0),
      })
    }

    if (pathname === '/api/admin/content' && request.method === 'PUT') {
      if (!requireAdmin(request, response)) return
      if (!adminSaveEnabled) {
        return json(response, 423, { error: 'Сохранение временно отключено. Изменения видны только до обновления страницы.' })
      }
      const body = await readJson(request, 2 * 1024 * 1024)
      return json(response, 200, await saveContent(body))
    }

    if (pathname === '/api/admin/upload' && request.method === 'POST') {
      if (!requireAdmin(request, response)) return
      const body = await readJson(request, 12 * 1024 * 1024)
      const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,([a-zA-Z0-9+/=]+)$/.exec(String(body.data || ''))
      if (!match) return json(response, 400, { error: 'Поддерживаются JPG, PNG, WebP и GIF.' })
      const bytes = Buffer.from(match[2], 'base64')
      if (!bytes.length || bytes.length > 8 * 1024 * 1024) {
        return json(response, 413, { error: 'Размер изображения должен быть не больше 8 МБ.' })
      }
      const extension = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' }[match[1]]
      const filename = `${Date.now()}-${randomUUID()}${extension}`
      await writeFile(join(uploadsDir, filename), bytes, { mode: 0o600 })
      return json(response, 201, { url: `/uploads/${filename}` })
    }

    if (pathname.startsWith('/api/')) return json(response, 404, { error: 'API route not found.' })

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' })
      return response.end()
    }

    if (pathname.startsWith('/uploads/')) {
      const uploadPath = safeStaticPath(uploadsDir, pathname.replace('/uploads', ''))
      if (uploadPath && (await serveFile(response, uploadPath, pathname))) return
      response.writeHead(404)
      return response.end('Not found')
    }

    const requestedPath = pathname === '/' ? '/index.html' : pathname
    const staticPath = safeStaticPath(distDir, requestedPath)
    if (staticPath && (await serveFile(response, staticPath, pathname))) return

    const indexPath = join(distDir, 'index.html')
    if (existsSync(indexPath) && (await serveFile(response, indexPath, '/index.html'))) return
    response.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Сначала выполните npm run build.')
  } catch (error) {
    const statusCode = error?.statusCode || (error instanceof SyntaxError ? 400 : 500)
    json(response, statusCode, { error: statusCode === 500 ? 'Внутренняя ошибка сервера.' : error.message })
  }
})

server.listen(port, host, () => {
  console.log(`Стальком Продукт: http://${host}:${port}`)
  console.log(`Админ-панель: ${adminEnabled ? `http://${host}:${port}/admin` : 'временно отключена (ADMIN_ENABLED=true для включения)'}`)
  console.log(`Сохранение изменений: ${adminSaveEnabled ? 'включено' : 'временно отключено (ADMIN_SAVE_ENABLED=true для включения)'}`)
})
