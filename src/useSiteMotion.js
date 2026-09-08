import { useEffect } from 'react'
import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/** Cheap capability probe, kept here so Three.js stays out of the main bundle. */
function hasWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

/** Wrap each word in a mask so reveals can slide from under a hard edge. */
function splitWords(element) {
  if (element.dataset.splitReady === 'true') return
  const text = element.textContent || ''
  element.setAttribute('aria-label', text.trim())
  element.textContent = ''

  text.split(/(\s+)/).forEach((part) => {
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
}

function setStaticMotionState() {
  gsap.set(
    '[data-reveal], [data-split], [data-stagger], [data-stagger] > *, [data-walk-step]',
    { autoAlpha: 1, clearProps: 'all' },
  )
  const splitWords = document.querySelectorAll('[data-split] .split-word')
  if (splitWords.length) {
    gsap.set(splitWords, { yPercent: 0, autoAlpha: 1, clearProps: 'all' })
  }
}

/**
 * The walk scene has an intentional one-slot caption treatment on desktop.
 * On touch and reduced-motion layouts it becomes regular document content so
 * every step remains readable without relying on a scrubbed timeline.
 */
function setFlowWalkLayout() {
  const walk = document.querySelector('[data-walk]')
  if (!walk) return

  const copy = walk.querySelector('.walk-copy')
  const steps = gsap.utils.toArray('[data-walk-step]', walk)

  gsap.set(walk, {
    height: 'auto',
    minHeight: '100svh',
    overflow: 'visible',
    paddingBlock: 'clamp(56px, 12vh, 132px)',
  })
  gsap.set('[data-walk-media]', { clearProps: 'transform', willChange: 'auto' })

  if (copy) {
    gsap.set(copy, {
      position: 'relative',
      inset: 'auto',
      paddingBottom: 0,
    })
  }

  if (steps.length) {
    gsap.set(steps, {
      autoAlpha: 1,
      y: 0,
      marginBottom: 'clamp(28px, 6vw, 56px)',
      clearProps: 'transform',
    })
    gsap.set(steps[steps.length - 1], { marginBottom: 0 })
  }
}

function safelyDispose(scene) {
  if (!scene || typeof scene.dispose !== 'function') return
  try {
    const result = scene.dispose()
    // A concurrently edited scene may make dispose async. Do not let a rejected
    // cleanup promise become an unhandled rejection during route/media changes.
    result?.catch?.(() => {})
  } catch {
    // Disposal is best effort; the static fallback remains in the DOM.
  }
}

export function useSiteMotion(disabled = false) {
  useEffect(() => {
    if (disabled) {
      setStaticMotionState()
      setFlowWalkLayout()
      return undefined
    }

    let disposed = false
    const media = gsap.matchMedia()

    const refresh = () => {
      if (!disposed) ScrollTrigger.refresh()
    }

    window.addEventListener('load', refresh)

    // `document.fonts` and its `ready` promise are optional in older browsers
    // and test DOMs. Refresh only when the API is actually available.
    const fontsReady = document.fonts?.ready
    if (fontsReady && typeof fontsReady.then === 'function') {
      Promise.resolve(fontsReady).then(refresh, () => {})
    }

    media.add(
      {
        // `all` keeps this callback active for pointer/media combinations that
        // are neither coarse nor narrow; only the desktop condition can opt in
        // to WebGL and the long pinned scenes.
        all: true,
        desktop: '(min-width: 901px) and (pointer: fine)',
        reduced: '(prefers-reduced-motion: reduce)',
      },
      (context) => {
        const isDesktop = Boolean(context.conditions.desktop)
        const reduced = Boolean(context.conditions.reduced)
        const stage = document.querySelector('[data-hero-stage]')
        const top = document.querySelector('#top')
        const header = document.querySelector('.site-header')
        const walk = document.querySelector('[data-walk]')

        if (walk && isDesktop && !reduced) {
          gsap.set(walk, { clearProps: 'height,minHeight,overflow,paddingBlock' })
          gsap.set(walk.querySelector('.walk-copy'), { clearProps: 'position,inset,paddingBottom' })
          gsap.set(gsap.utils.toArray('[data-walk-step]', walk), {
            clearProps: 'marginBottom,transform,opacity,visibility',
          })
          gsap.set('[data-walk-media]', { clearProps: 'transform,willChange' })
        }

        let cancelled = false
        let localScene = null
        let localLenis = null
        let tickerCallback = null

        const cleanup = () => {
          cancelled = true
          header?.classList.remove('is-condensed')
          stage?.classList.remove('is-live')

          const scene = localScene
          localScene = null
          safelyDispose(scene)

          // A factory can fail after creating its renderer, or return an API
          // without dispose(). Remove only scene canvases; the image fallback is
          // a separate non-canvas element and is intentionally retained.
          stage?.querySelectorAll('canvas').forEach((canvas) => canvas.remove())

          if (localLenis) {
            localLenis.off?.('scroll', ScrollTrigger.update)
            if (tickerCallback) gsap.ticker.remove(tickerCallback)
            localLenis.destroy?.()
            localLenis = null
          }
        }

        if (reduced) {
          // Static mode intentionally does not create Lenis, pins, scrubbers,
          // or a dynamic Three import. The CSS/image fallback stays readable.
          setStaticMotionState()
          setFlowWalkLayout()
          return cleanup
        }

        // Keep the existing Lenis/ScrollTrigger bridge for regular motion. It
        // is deliberately not created in reduced-motion mode.
        localLenis = new Lenis({
          duration: 1.05,
          smoothWheel: true,
          anchors: { offset: -80 },
        })
        localLenis.on('scroll', ScrollTrigger.update)
        tickerCallback = (time) => localLenis?.raf(time * 1000)
        gsap.ticker.add(tickerCallback)
        gsap.ticker.lagSmoothing(0)

        const useWebGL = Boolean(isDesktop && stage && hasWebGL())
        stage?.classList.remove('is-live')

        let heroProgress = 0
        const applyHeroProgress = (progress) => {
          heroProgress = Math.min(1, Math.max(0, Number(progress) || 0))
          try {
            localScene?.setProgress?.(heroProgress)
          } catch {
            // A late/failed scene update must never break scroll handling.
          }
        }

        /* ---- Hero: pinned, scroll-scrubbed walk into the interior ---------- */
        if (isDesktop && top) {
          const heroTl = gsap.timeline({
            scrollTrigger: {
              trigger: top,
              start: 'top top',
              end: '+=140%',
              scrub: 1,
              pin: true,
              anticipatePin: 1,
              // Scroll position IS the animation playhead: scrolling back runs it backwards.
              onUpdate: (self) => applyHeroProgress(self.progress),
            },
          })

          heroTl
            .fromTo(
              '[data-hero-copy]',
              { y: 0, autoAlpha: 1 },
              { y: -70, autoAlpha: 0.15, ease: 'none' },
              0.35,
            )
            // Keep the veil within the valid opacity range so the fallback and
            // WebGL scene never gain an invalid over-opaque layer.
            .to('.hero-veil', { opacity: 1, ease: 'none' }, 0)

          if (!useWebGL) {
            // Fallback still gets depth, just via transform rather than a shader.
            heroTl.fromTo('.hero-fallback', { scale: 1.06 }, { scale: 1.16, ease: 'none' }, 0)
          }

          heroProgress = heroTl.scrollTrigger?.progress || 0

          if (useWebGL && stage) {
            // Import and factory failures are intentionally contained. The
            // static `.hero-fallback` remains present and visible on every path.
            void (async () => {
              let candidate = null
              try {
                // If custom cover photo was set on .hero-fallback, do not overlay the hardcoded 3D render
                const fallbackEl = stage.querySelector('.hero-fallback')
                const customBg = fallbackEl?.style?.backgroundImage || ''
                if (customBg && !customBg.includes('interior-1920.webp')) {
                  stage.classList.remove('is-live')
                  return
                }
                const module = await import('./scene/InteriorScene.js')
                if (cancelled || disposed || stage.isConnected === false) return

                const createInteriorScene =
                  module.createInteriorScene || module.default?.createInteriorScene || module.default
                if (typeof createInteriorScene !== 'function') throw new Error('Interior scene factory unavailable')

                // `createInteriorScene` may return either an object or a Promise
                // in parallel scene implementations; await both forms uniformly.
                candidate = await createInteriorScene(stage, {
                  imageUrl: '/assets/interior-1920.webp',
                  depthUrl: '/assets/interior-depth.webp',
                })

                if (cancelled || disposed || stage.isConnected === false) {
                  safelyDispose(candidate)
                  return
                }

                if (!candidate || (typeof candidate !== 'object' && typeof candidate !== 'function')) {
                  throw new Error('Interior scene did not return an API')
                }

                const readyStatus = candidate.ready ? await candidate.ready : { ready: true }
                if (!readyStatus?.ready || cancelled || disposed) {
                  throw readyStatus?.error || new Error('Interior scene did not become ready')
                }

                localScene = candidate
                stage.classList.add('is-live')
                // The scene can finish loading after the user has already
                // scrolled. Read the trigger again at this exact moment so a
                // late scene never jumps back to its initial frame.
                applyHeroProgress(heroTl.scrollTrigger?.progress ?? heroProgress)
              } catch {
                safelyDispose(candidate)
                // A stale async import must not tear down a newer media-query
                // context's scene. Its own cleanup already handled its API.
                if (cancelled || disposed) return
                localScene = null
                stage.classList.remove('is-live')
                stage.querySelectorAll('canvas').forEach((canvas) => canvas.remove())
              }
            })()
          }
        }

        /* ---- Headline and kinetic typography ------------------------------- */
        gsap.utils.toArray('[data-split]').forEach((element) => {
          splitWords(element)
          gsap.fromTo(
            element.querySelectorAll('.split-word'),
            { yPercent: 116, autoAlpha: 0 },
            {
              yPercent: 0,
              autoAlpha: 1,
              duration: 1,
              ease: 'power4.out',
              stagger: 0.045,
              scrollTrigger: { trigger: element, start: 'top 88%', once: true },
            },
          )
        })

        /* ---- Section reveals, varied by role so the page isn't uniform ------ */
        if (isDesktop) {
          gsap.utils.toArray('[data-reveal]').forEach((element) => {
            const variant = element.dataset.reveal
            const from =
              variant === 'card'
                ? { y: 40, scale: 0.985, autoAlpha: 0 }
                : variant === 'row'
                  ? { x: -26, autoAlpha: 0 }
                  : { y: 54, autoAlpha: 0 }

            gsap.from(element, {
              ...from,
              duration: variant === 'row' ? 0.85 : 1.05,
              ease: 'expo.out',
              scrollTrigger: { trigger: element, start: 'top 88%', once: true },
            })
          })
        } else {
          gsap.set('[data-reveal]', { autoAlpha: 1, clearProps: 'transform' })
        }

        /* ---- Staggered groups ---------------------------------------------- */
        gsap.utils.toArray('[data-stagger]').forEach((group) => {
          gsap.from(group.children, {
            y: 34,
            autoAlpha: 0,
            duration: 0.95,
            ease: 'power3.out',
            stagger: 0.08,
            scrollTrigger: { trigger: group, start: 'top 85%', once: true },
          })
        })

        /* ---- Image parallax ------------------------------------------------ */
        gsap.utils.toArray('[data-image-reveal]').forEach((wrapper) => {
          const img = wrapper.querySelector('img')
          if (!img) return
          gsap.fromTo(
            img,
            { scale: 1.12, yPercent: 3 },
            {
              scale: 1.02,
              yPercent: -3,
              ease: 'none',
              scrollTrigger: {
                trigger: wrapper,
                start: 'top bottom',
                end: 'bottom top',
                scrub: 0.65,
                invalidateOnRefresh: true,
              },
            },
          )
        })

        /* ---- Second scrubbed scene: desktop only --------------------------- */
        if (walk && isDesktop) {
          const steps = gsap.utils.toArray('[data-walk-step]', walk)
          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: walk,
              start: 'top top',
              end: '+=200%',
              scrub: 1.1,
              pin: true,
              anticipatePin: 1,
            },
          })

          tl.fromTo(
            '[data-walk-media]',
            { scale: 1.02, yPercent: 0 },
            { scale: 1.12, yPercent: -3, ease: 'none' },
            0,
          ).fromTo('[data-walk-progress] i', { scaleX: 0 }, { scaleX: 1, ease: 'none' }, 0)

          if (steps.length) {
            steps.forEach((step, index) => {
              const slot = 1 / steps.length
              const start = index * slot
              gsap.set(step, { autoAlpha: index === 0 ? 1 : 0 })
              if (index > 0) {
                tl.fromTo(
                  step,
                  { autoAlpha: 0, y: 34 },
                  { autoAlpha: 1, y: 0, ease: 'none', duration: slot * 0.4 },
                  start,
                )
              }
              if (index < steps.length - 1) {
                tl.to(
                  step,
                  { autoAlpha: 0, y: -28, ease: 'none', duration: slot * 0.35 },
                  start + slot * 0.62,
                )
              }
            })
          }
        } else if (walk) {
          setFlowWalkLayout()
        }

        /* ---- Header condenses once the hero is behind us ------------------- */
        if (top) {
          ScrollTrigger.create({
            trigger: top,
            start: 'bottom 90%',
            onEnter: () => header?.classList.add('is-condensed'),
            onLeaveBack: () => header?.classList.remove('is-condensed'),
          })
        }

        return cleanup
      },
    )

    return () => {
      disposed = true
      window.removeEventListener('load', refresh)
      media.revert()
    }
  }, [disabled])
}
