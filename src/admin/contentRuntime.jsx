import { useEffect } from 'react'

const TEXT_SELECTOR = 'h1,h2,h3,p,summary,legend,label,a,button,li,span,strong,small'
const BACKGROUND_SELECTOR = '.hero-fallback, .walk-media'
const originalImages = new WeakMap()

export const emptyContent = () => ({ version: 1, updatedAt: null, texts: {}, images: {} })

function contentScope(element) {
  const scope = element.closest('.site-header, #main-content, .site-footer, .mobile-nav')
  if (!scope) return null
  if (scope.matches('.site-header')) return { element: scope, name: 'header' }
  if (scope.matches('#main-content')) return { element: scope, name: 'main' }
  if (scope.matches('.site-footer')) return { element: scope, name: 'footer' }
  return { element: scope, name: 'mobile-navigation' }
}

function elementPath(element) {
  const scope = contentScope(element)
  if (!scope) return ''
  const parts = []
  let current = element

  while (current && current !== scope.element) {
    const siblings = Array.from(current.parentElement?.children || []).filter(
      (sibling) => sibling.tagName === current.tagName,
    )
    parts.unshift(`${current.tagName.toLowerCase()}:${siblings.indexOf(current) + 1}`)
    current = current.parentElement
  }

  return `${scope.name}/${parts.join('/')}`
}

export function textKey(element) {
  return `text:${elementPath(element)}`
}

export function imageKey(element) {
  return `image:${elementPath(element)}`
}

function hasEditableText(element) {
  if (element.closest('[data-admin-ui]')) return false
  if (element.matches('[data-split]')) return Boolean(element.textContent?.trim())
  if (element.closest('.brief-summary, .form-status, .field-error, output')) return false
  if (element.children.length) return false
  return Boolean(element.textContent?.trim())
}

export function collectTextTargets() {
  return Array.from(document.querySelectorAll(TEXT_SELECTOR)).filter(hasEditableText)
}

export function collectImageTargets() {
  const images = Array.from(document.querySelectorAll('img')).filter(
    (element) => !element.closest('[data-admin-ui]') && contentScope(element),
  )
  const backgrounds = Array.from(document.querySelectorAll(BACKGROUND_SELECTOR)).filter(
    (element) => contentScope(element),
  )
  return [...images, ...backgrounds]
}

export function imageKind(element) {
  return element.tagName === 'IMG' ? 'image' : 'background'
}

function rememberImage(element) {
  if (originalImages.has(element)) return originalImages.get(element)
  const sources = element.tagName === 'IMG'
    ? Array.from(element.closest('picture')?.querySelectorAll('source') || []).map((source) => ({
        element: source,
        srcset: source.getAttribute('srcset'),
      }))
    : []
  const original = {
    src: element.getAttribute?.('src'),
    display: element.style.display,
    visibility: element.style.visibility,
    backgroundImage: element.style.backgroundImage,
    sources,
  }
  originalImages.set(element, original)
  return original
}

export function restoreImage(element) {
  const original = rememberImage(element)
  element.classList.remove('admin-image-removed')
  element.style.display = original.display
  element.style.visibility = original.visibility
  if (element.tagName === 'IMG') {
    if (original.src) element.setAttribute('src', original.src)
    original.sources.forEach(({ element: source, srcset }) => {
      if (srcset === null) source.removeAttribute('srcset')
      else source.setAttribute('srcset', srcset)
    })
  } else {
    element.style.backgroundImage = original.backgroundImage
  }
}

export function applyImage(element, entry, { admin = false } = {}) {
  rememberImage(element)
  element.classList.toggle('admin-image-removed', Boolean(admin && entry?.removed))

  if (entry?.removed) {
    if (admin) {
      element.style.display = ''
      element.style.visibility = ''
    } else if (element.tagName === 'IMG') {
      element.style.display = 'none'
    } else {
      element.style.visibility = 'hidden'
    }
    return
  }

  element.style.display = ''
  element.style.visibility = ''
  if (!entry?.url) return

  if (element.tagName === 'IMG') {
    element.setAttribute('src', entry.url)
    element.closest('picture')?.querySelectorAll('source').forEach((source) => {
      source.setAttribute('srcset', entry.url)
    })
  } else {
    element.style.backgroundImage = `url("${entry.url.replaceAll('"', '')}")`
  }
}

export function applyContent(content, options = {}) {
  const safeContent = content || emptyContent()
  collectTextTargets().forEach((element) => {
    const value = safeContent.texts?.[textKey(element)]
    if (typeof value === 'string' && element.textContent !== value) element.textContent = value
  })
  collectImageTargets().forEach((element) => {
    const entry = safeContent.images?.[imageKey(element)]
    if (entry) applyImage(element, entry, options)
  })
}

export async function fetchContent() {
  const response = await fetch('/api/content', { cache: 'no-store' })
  if (!response.ok) throw new Error('Не удалось загрузить сохранённое содержимое.')
  return response.json()
}

export function PublicContentRuntime() {
  useEffect(() => {
    let disposed = false
    let content = null
    let scheduled = 0

    const apply = () => {
      scheduled = 0
      if (!disposed && content) applyContent(content)
    }
    const schedule = () => {
      if (!scheduled) scheduled = requestAnimationFrame(apply)
    }

    fetchContent()
      .then((loaded) => {
        if (disposed) return
        content = loaded
        apply()
      })
      .catch(() => {})

    const observer = new MutationObserver(schedule)
    observer.observe(document.getElementById('root'), { childList: true, subtree: true })

    return () => {
      disposed = true
      observer.disconnect()
      if (scheduled) cancelAnimationFrame(scheduled)
    }
  }, [])

  return null
}
