import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import AdminGate from './admin/AdminGate.jsx'
import { PublicContentRuntime, fetchContent } from './admin/contentRuntime.jsx'
import { ContentProvider } from './content/ContentContext.jsx'
import { emptyContent } from './content/model.js'
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

const isAdminRoute = window.location.pathname.replace(/\/+$/, '') === '/admin'

// Load saved content before the first render so collections and GSAP triggers
// see the final block list immediately (no default-content flash).
const bootstrap = async () => {
  const initialContent = await fetchContent().catch(() => emptyContent())

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <ContentProvider initialContent={initialContent}>
        {isAdminRoute ? (
          <AdminGate>
            <App adminMode />
          </AdminGate>
        ) : (
          <>
            <App />
            <PublicContentRuntime />
          </>
        )}
      </ContentProvider>
    </StrictMode>,
  )
}

void bootstrap()
