/**
 * The client's original lockup, used as one whole asset.
 *
 * Deliberately NOT: the name retyped in a lookalike font, the mark separated from
 * the wordmark, a redrawn glyph, a white plate behind the mark, or a watermark
 * over interior photography. The file is the artwork the client supplied.
 */
export default function Brand() {
  return (
    <img
      className="brand-logo"
      src="/assets/skp-logo-full.webp"
      alt="REMONT 360° — дизайн и ремонт"
      width={531}
      height={386}
      decoding="async"
    />
  )
}
