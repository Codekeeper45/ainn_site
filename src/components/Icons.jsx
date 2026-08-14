const base = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

export function ArrowRight({ size = 20 }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={1.8}>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  )
}

export function Check({ size = 18 }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={2}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

export function Menu({ size = 22 }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={2}>
      <path d="M4 5h16" />
      <path d="M4 12h16" />
      <path d="M4 19h16" />
    </svg>
  )
}

export function X({ size = 22 }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={2}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}
