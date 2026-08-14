import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import 'lenis/dist/lenis.css'
import './styles.css'

if ('scrollRestoration' in history) history.scrollRestoration = 'manual'

const scrollToHash = () => {
  const id = window.location.hash.slice(1)
  if (!id) {
    window.scrollTo(0, 0)
    return
  }

  requestAnimationFrame(() => {
    const target = document.getElementById(decodeURIComponent(id))
    target?.scrollIntoView({ block: 'start', behavior: 'auto' })
    target?.focus({ preventScroll: true })
  })
}

if (!window.location.hash) {
  window.scrollTo(0, 0)
  window.addEventListener('load', () => {
    if (!window.location.hash) window.scrollTo(0, 0)
  })
}

window.addEventListener('hashchange', scrollToHash)
window.addEventListener('popstate', scrollToHash)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
