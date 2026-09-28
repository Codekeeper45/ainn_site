import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import 'lenis/dist/lenis.css'
import './styles.css'

if ('scrollRestoration' in history) history.scrollRestoration = 'manual'

// Deep links (fresh loads, back/forward, in-page hash changes) must land on
// the target section. Two traps made this fail before:
// - Lenis drives a virtual scroll, so native scrollIntoView jumps get
//   overwritten by its synced position. Route through the live Lenis
//   instance when one exists.
// - The pinned hero adds ~140% pin spacer above the content, so scrolling
//   too early lands mid-hero. Retry until layout settles, then give up.
// Header clearance for the fixed pill header.
const HEADER_CLEARANCE = 96

const decodeHashId = (raw) => {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

const scrollToHash = () => {
  const raw = window.location.hash.slice(1)
  if (!raw) {
    window.scrollTo(0, 0)
    return
  }

  const target = document.getElementById(decodeHashId(raw))
  if (!target) return

  const lenis = window.__lenis
  if (lenis && typeof lenis.scrollTo === 'function') {
    try {
      lenis.scrollTo(target, { immediate: true })
      return
    } catch {
      // Fall through to the native path below.
    }
  }
  target.scrollIntoView({ block: 'start', behavior: 'auto' })
}

let hashScrollTimer = 0

const scrollToHashWhenReady = () => {
  if (hashScrollTimer) clearTimeout(hashScrollTimer)
  if (!window.location.hash) {
    window.scrollTo(0, 0)
    return
  }
  let attempts = 0
  const tick = () => {
    attempts += 1
    scrollToHash()
    const target = document.getElementById(decodeHashId(window.location.hash.slice(1)))
    const settled =
      !target ||
      Math.abs(target.getBoundingClientRect().top - HEADER_CLEARANCE) < 8 ||
      attempts >= 12
    if (!settled) hashScrollTimer = setTimeout(tick, 300)
  }
  requestAnimationFrame(tick)
}

if (!window.location.hash) {
  window.scrollTo(0, 0)
  window.addEventListener('load', () => {
    if (!window.location.hash) window.scrollTo(0, 0)
  })
} else {
  window.addEventListener('load', scrollToHashWhenReady, { once: true })
  scrollToHashWhenReady()
}

window.addEventListener('hashchange', scrollToHash)
window.addEventListener('popstate', scrollToHashWhenReady)
// Pin spacers and late images shift section offsets after load; re-aim once.
window.addEventListener('app:scroll-refresh', () => {
  if (window.location.hash) scrollToHash()
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
