import { useEffect } from 'react'
import { useContent } from '../content/ContentContext.jsx'

export { emptyContent } from '../content/model.js'

const TEXT_SELECTOR = 'h1,h2,h3,p,summary,legend,label,a,button,li,span,strong,small'
const BACKGROUND_SELECTOR = '.hero-fallback, .walk-media'
const originalImages = new WeakMap()

function contentScope(element) {
  const scope = element.closest('.site-header, #main-content, .site-footer, .mobile-nav')
  if (!scope) return null
  if (scope.matches('.site-header')) return { element: scope, name: 'header' }
  if (scope.matches('#main-content')) return { element: scope, name: 'main' }
  if (scope.matches('.site-footer')) return { element: scope, name: 'footer' }
  return { element: scope, name: 'mobile-navigation' }
}

const isPinSpacer = (element) => Boolean(element?.classList?.contains('pin-spacer'))

// GSAP ScrollTrigger wraps each pinned section in a `div.pin-spacer` on the
// public page, but pinning is disabled in admin mode. Unwrap those wrappers so
// the same element resolves to the same positional key in both contexts;
// otherwise every override saved in admin would miss its target publicly.
function effectiveParent(element) {
  const parent = element.parentElement
  return isPinSpacer(parent) ? parent.parentElement : parent
}

function effectiveChildren(parent) {
  return Array.from(parent.children).flatMap((child) =>
    isPinSpacer(child) ? Array.from(child.children) : [child],
  )
}

function elementPath(element) {
  const scope = contentScope(element)
  if (!scope) return ''
  const parts = []
  let current = element

  while (current && current !== scope.element) {
    const parent = effectiveParent(current)
    if (!parent) break
    const siblings = effectiveChildren(parent).filter(
      (sibling) => sibling.tagName === current.tagName,
    )
    parts.unshift(`${current.tagName.toLowerCase()}:${siblings.indexOf(current) + 1}`)
    current = parent
  }

  return `${scope.name}/${parts.join('/')}`
}

export function textKey(element) {
  const collectionItem = element.closest('[data-collection-item]')
  if (collectionItem?.dataset?.collectionId && collectionItem?.dataset?.itemId) {
    const collectionId = collectionItem.dataset.collectionId
    const itemId = collectionItem.dataset.itemId
    const subParts = []
    let current = element
    while (current && current !== collectionItem) {
      const parent = current.parentElement
      if (!parent) break
      const siblings = Array.from(parent.children).filter((s) => s.tagName === current.tagName)
      subParts.unshift(`${current.tagName.toLowerCase()}:${siblings.indexOf(current) + 1}`)
      current = parent
    }
    return `text:col:${collectionId}:${itemId}/${subParts.join('/')}`
  }
  return `text:${elementPath(element)}`
}

export function imageKey(element) {
  return `image:${elementPath(element)}`
}

function hasEditableText(element) {
  if (element.closest('[data-admin-ui]')) return false
  if (element.closest('.admin-block-controls')) return false
  if (element.closest('.brief-summary, .form-status, .field-error, output')) return false
  if (element.matches('[data-split]')) return true
  // Leaf text elements only — containers with child elements (e.g. SVG icons or nested spans)
  // should not be edited directly so SVG icons are never wiped out.
  if (element.children.length > 0) return false
  if (element.dataset.adminOriginalText !== undefined) return true
  return Boolean(element.textContent?.trim())
}

export function collectTextTargets() {
  return Array.from(document.querySelectorAll(TEXT_SELECTOR)).filter(hasEditableText)
}

export function collectImageTargets() {
  const images = Array.from(document.querySelectorAll('img')).filter(
    (element) =>
      !element.closest('[data-admin-ui]') &&
      !element.closest('[data-collection-item]') &&
      contentScope(element),
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
    if (element.classList.contains('hero-fallback')) {
      element.setAttribute('data-admin-custom-image', 'true')
      const stage = element.closest('.hero-stage')
      if (stage) {
        stage.classList.remove('is-live')
        stage.querySelectorAll('canvas').forEach((c) => {
          c.style.display = 'none'
        })
      }
    }
  }
}

export function applyContent(content, options = {}) {
  const safeContent = content || {}
  collectTextTargets().forEach((element) => {
    const primaryKey = textKey(element)
    const legacyKey = `text:${elementPath(element)}`
    const value = safeContent.texts?.[primaryKey] ?? safeContent.texts?.[legacyKey]
    if (typeof value === 'string') {
      if (element.matches('[data-split]')) {
        const currentText = element.getAttribute('aria-label') || element.textContent || ''
        if (currentText.trim() !== value.trim()) {
          element.setAttribute('aria-label', value.trim())
          if (element.children.length > 0 && element.querySelector('.split-word')) {
            element.textContent = ''
            value.split(/(\s+)/).forEach((part) => {
              if (!part.trim()) {
                element.appendChild(document.createTextNode(part))
                return
              }
              const mask = document.createElement('span')
              const word = document.createElement('span')
              mask.className = 'split-word-mask'
              mask.setAttribute('aria-hidden', 'true')
              word.className = 'split-word'
              word.textContent = part
              mask.appendChild(word)
              element.appendChild(mask)
            })
            element.dataset.splitReady = 'true'
          } else {
            element.textContent = value
          }
        }
      } else if (element.textContent !== value) {
        element.textContent = value
      }
    }
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

/** Applies saved text/image overrides on the public site. Collections are
 * rendered by React directly from the same content, so only the legacy
 * positional overrides need DOM patching here. */
export function PublicContentRuntime() {
  const { content } = useContent()

  useEffect(() => {
    let disposed = false
    let scheduled = 0

    const apply = () => {
      scheduled = 0
      if (!disposed) applyContent(content)
    }
    const schedule = () => {
      if (!scheduled) scheduled = requestAnimationFrame(apply)
    }

    apply()
    const observer = new MutationObserver(schedule)
    observer.observe(document.getElementById('root'), { childList: true, subtree: true })

    return () => {
      disposed = true
      observer.disconnect()
      if (scheduled) cancelAnimationFrame(scheduled)
    }
  }, [content])

  return null
}
