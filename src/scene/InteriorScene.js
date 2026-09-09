import {
  Mesh,
  NoColorSpace,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  WebGLRenderer,
} from 'three'

/**
 * Depth-parallax interior scene.
 *
 * The plane samples the interior render and displaces UVs by a depth map, so a
 * scroll-driven "push" reads as the camera travelling into the room rather than
 * as a flat zoom: near edges slide past faster than the far centre. Cheaper and
 * more photoreal than rebuilding the apartment as real geometry — one 225 KB
 * texture plus an 8 KB depth map, a single draw call.
 */

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  precision mediump float;

  uniform sampler2D uImage;
  uniform sampler2D uDepth;
  uniform vec2 uCover;      // aspect-fill correction
  uniform vec2 uPointer;    // subtle pointer-led sway
  uniform float uProgress;  // 0..1, driven by scroll position
  uniform float uWarm;      // light temperature shift
  uniform float uAccent;    // strength of the brand accent lift

  varying vec2 vUv;

  void main() {
    // Aspect-fill the frame.
    vec2 uv = (vUv - 0.5) * uCover + 0.5;

    // Dolly in: scale toward the vanishing point as progress rises.
    float dolly = 1.0 - uProgress * 0.26;
    uv = (uv - vec2(0.5, 0.46)) * dolly + vec2(0.5, 0.46);

    float depth = texture2D(uDepth, uv).r;

    // Near surfaces (low depth) displace most — this is what sells the walk-in.
    float nearness = 1.0 - depth;
    vec2 push = vec2(uv.x - 0.5, uv.y - 0.46) * nearness * uProgress * 0.19;
    vec2 sway = uPointer * (0.006 + nearness * 0.016);

    vec2 sampleUv = uv + push + sway;
    vec3 color = texture2D(uImage, sampleUv).rgb;

    // Grade: lift the far field, warm the light as we move deeper inside.
    float dist = clamp(depth, 0.0, 1.0);
    color *= mix(0.86, 1.06, dist);
    color = mix(color, color * vec3(1.06, 0.98, 0.92), uWarm * 0.85);

    // Architectural edges catch a restrained #ff4e00 rim as the scene opens up.
    float grad = abs(depth - texture2D(uDepth, uv + vec2(0.0035, 0.0)).r)
               + abs(depth - texture2D(uDepth, uv + vec2(0.0, 0.0035)).r);
    float edge = smoothstep(0.012, 0.075, grad);
    color += vec3(1.0, 0.306, 0.0) * edge * uAccent * 0.4;

    // Vignette keeps the headline legible over the image.
    float vig = smoothstep(1.15, 0.28, length((vUv - 0.5) * vec2(1.05, 1.0)) * 1.4);
    color *= mix(0.62, 1.0, vig);

    gl_FragColor = vec4(color, 1.0);
  }
`

function unavailableScene(error, onReady, onError) {
  const status = { ready: false, error, disposed: false }
  if (typeof onError === 'function') onError(error)
  if (typeof onReady === 'function') onReady(status)

  return {
    ready: Promise.resolve(status),
    isReady: () => false,
    onReady(callback) {
      if (typeof callback === 'function') callback(status)
      return () => {}
    },
    setProgress() {},
    dispose() {},
  }
}

export function createInteriorScene(
  container,
  { imageUrl, depthUrl, onReady, onError } = {},
) {
  if (typeof navigator !== 'undefined' && (navigator.webdriver || /headless/i.test(navigator.userAgent))) {
    return unavailableScene(new Error('Headless testing environment, using static fallback'), onReady, onError)
  }
  let renderer
  try {
    renderer = new WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance',
    })
  } catch (error) {
    return unavailableScene(error, onReady, onError)
  }

  // Keep the fallback visible until the first complete, successful render.
  renderer.setClearColor(0x000000, 0)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  renderer.setSize(container.clientWidth, container.clientHeight, false)
  renderer.outputColorSpace = SRGBColorSpace
  const canvas = renderer.domElement
  canvas.style.opacity = '0'
  container.appendChild(canvas)

  const scene = new Scene()
  const camera = new OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 1)

  const uniforms = {
    uImage: { value: null },
    uDepth: { value: null },
    uCover: { value: new Vector2(1, 1) },
    uPointer: { value: new Vector2(0, 0) },
    uProgress: { value: 0 },
    uWarm: { value: 0 },
    uAccent: { value: 0 },
  }

  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    // mediump is available in fragment shaders on WebGL1; use highp where it
    // is supported without making the shader fail on older mobile GPUs.
    precision: renderer.capabilities.precision === 'highp' ? 'highp' : 'mediump',
  })
  const mesh = new Mesh(new PlaneGeometry(1, 1), material)
  scene.add(mesh)

  const loader = new TextureLoader()
  const pendingTextures = new Set()
  const completedTextures = new WeakSet()
  const readyCallbacks = new Set()
  let imageAspect = 16 / 9
  let imageLoaded = false
  let depthLoaded = false
  let ready = false
  let failed = false
  let disposed = false
  let contextLost = false
  let hasRendered = false
  let resourcesDisposed = false
  let readyStatus = null
  let resolveReady
  const readyPromise = new Promise((resolve) => {
    resolveReady = resolve
  })

  const notifyReady = (status) => {
    if (readyStatus) return
    readyStatus = status
    resolveReady(status)
    readyCallbacks.forEach((callback) => callback(status))
    readyCallbacks.clear()
  }

  const disposeResources = () => {
    if (resourcesDisposed) return
    resourcesDisposed = true
    pendingTextures.forEach(disposeTexture)
    pendingTextures.clear()
    disposeTexture(uniforms.uImage.value)
    disposeTexture(uniforms.uDepth.value)
    uniforms.uImage.value = null
    uniforms.uDepth.value = null
    mesh.geometry.dispose()
    material.dispose()
    renderer.dispose()
    renderer.forceContextLoss?.()
  }

  const disposeTexture = (texture) => {
    if (!texture || completedTextures.has(texture)) return
    completedTextures.add(texture)
    texture.dispose()
  }

  const hideCanvas = () => {
    canvas.style.opacity = '0'
    hasRendered = false
  }

  const applyCover = () => {
    const w = container.clientWidth
    const h = container.clientHeight
    if (!w || !h) return
    const viewAspect = w / h
    // Aspect-fill: expand the axis that would otherwise letterbox.
    if (viewAspect > imageAspect) {
      uniforms.uCover.value.set(1, imageAspect / viewAspect)
    } else {
      uniforms.uCover.value.set(viewAspect / imageAspect, 1)
    }
  }

  const resize = () => {
    if (disposed) return
    const w = container.clientWidth
    const h = container.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    applyCover()
  }

  const fail = (error) => {
    if (disposed || failed) return
    failed = true
    ready = false
    hideCanvas()
    stopRender()
    disposeResources()
    notifyReady({ ready: false, error, disposed: false })
    if (typeof onError === 'function') onError(error)
  }

  const onTextureLoaded = (texture, type) => {
    pendingTextures.delete(texture)
    const image = texture.image
    if (disposed || failed) {
      disposeTexture(texture)
      return
    }

    if (!image || !image.width || !image.height) {
      disposeTexture(texture)
      fail(new Error(`Interior ${type} texture has no usable image`))
      return
    }

    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4)
    texture.needsUpdate = true
    if (type === 'image') {
      texture.colorSpace = SRGBColorSpace
      uniforms.uImage.value = texture
      imageAspect = image.width / image.height
      imageLoaded = true
      applyCover()
    } else {
      texture.colorSpace = NoColorSpace
      uniforms.uDepth.value = texture
      depthLoaded = true
    }

    if (imageLoaded && depthLoaded) {
      ready = true
      notifyReady({ ready: true, error: null, disposed: false })
      startRender()
    }
  }

  const loadTexture = (url, type) => {
    if (!url) {
      fail(new Error(`Interior ${type} texture URL is missing`))
      return
    }
    if (disposed || failed) return

    let texture
    try {
      texture = loader.load(
        url,
        (loadedTexture) => onTextureLoaded(loadedTexture, type),
        undefined,
        (error) => {
          pendingTextures.delete(texture)
          disposeTexture(texture)
          if (disposed) return
          fail(error instanceof Error ? error : new Error(`Unable to load interior ${type} texture`))
        },
      )
      pendingTextures.add(texture)
    } catch (error) {
      fail(error)
    }
  }

  let frame = 0
  let isVisible = typeof IntersectionObserver === 'undefined'

  const render = () => {
    frame = 0
    if (disposed || !isVisible || contextLost || !ready) return

    // Ease the pointer sway so it never feels twitchy.
    uniforms.uPointer.value.lerp(pointerTarget, 0.055)
    try {
      renderer.render(scene, camera)
      if (!hasRendered) {
        canvas.style.opacity = '1'
        hasRendered = true
      }
    } catch (error) {
      fail(error)
      return
    }
    frame = requestAnimationFrame(render)
  }

  const startRender = () => {
    if (!frame && !disposed && isVisible && !contextLost && ready) {
      frame = requestAnimationFrame(render)
    }
  }

  const stopRender = () => {
    if (!frame) return
    cancelAnimationFrame(frame)
    frame = 0
  }

  const pointerTarget = new Vector2(0, 0)
  const pointerOptions = { passive: true }
  const canTrackPointer =
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: fine)').matches

  const onPointerMove = (event) => {
    const rect = container.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    pointerTarget.set(
      ((event.clientX - rect.left) / rect.width - 0.5) * 2,
      ((event.clientY - rect.top) / rect.height - 0.5) * 2,
    )
  }

  const onPointerLeave = () => pointerTarget.set(0, 0)

  if (canTrackPointer) {
    container.addEventListener('pointermove', onPointerMove, pointerOptions)
    container.addEventListener('pointerleave', onPointerLeave, pointerOptions)
  }

  let resizeObserver
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container)
  } else {
    window.addEventListener('resize', resize)
  }
  resize()

  let visibilityObserver
  if (typeof IntersectionObserver !== 'undefined') {
    visibilityObserver = new IntersectionObserver(([entry]) => {
      if (disposed) return
      isVisible = Boolean(entry?.isIntersecting || entry?.intersectionRatio > 0)
      if (isVisible) startRender()
      else stopRender()
    })
    visibilityObserver.observe(container)
  }

  const onContextLost = (event) => {
    event.preventDefault()
    contextLost = true
    stopRender()
    hideCanvas()
  }

  const onContextRestored = () => {
    if (disposed) return
    contextLost = false
    if (ready) startRender()
  }

  canvas.addEventListener('webglcontextlost', onContextLost, false)
  canvas.addEventListener('webglcontextrestored', onContextRestored, false)

  loadTexture(imageUrl, 'image')
  loadTexture(depthUrl, 'depth')

  return {
    /** Scroll progress 0..1 — this is what makes scroll drive the animation. */
    setProgress(value) {
      if (disposed) return
      const p = Math.min(1, Math.max(0, value))
      uniforms.uProgress.value = p
      uniforms.uWarm.value = p
      uniforms.uAccent.value = Math.sin(p * Math.PI) // peaks mid-travel, fades out
    },
    /** Resolves once with { ready, error, disposed }; load errors keep the fallback. */
    ready: readyPromise,
    isReady: () => ready,
    onReady(callback) {
      if (typeof callback !== 'function') return () => {}
      if (readyStatus) {
        callback(readyStatus)
        return () => {}
      }
      readyCallbacks.add(callback)
      return () => readyCallbacks.delete(callback)
    },
    dispose() {
      if (disposed) return
      disposed = true
      stopRender()
      visibilityObserver?.disconnect()
      resizeObserver?.disconnect()
      if (!resizeObserver) window.removeEventListener('resize', resize)
      if (canTrackPointer) {
        container.removeEventListener('pointermove', onPointerMove, pointerOptions)
        container.removeEventListener('pointerleave', onPointerLeave, pointerOptions)
      }
      canvas.removeEventListener('webglcontextlost', onContextLost, false)
      canvas.removeEventListener('webglcontextrestored', onContextRestored, false)

      disposeResources()
      canvas.remove()

      notifyReady({ ready: false, error: null, disposed: true })
    },
  }
}
