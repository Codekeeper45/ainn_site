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

export function Mail({ size = 18 }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={1.8}>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  )
}

export function Phone({ size = 18 }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={1.8}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

export function MessageCircle({ size = 18 }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={1.8}>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  )
}

export function MapPin({ size = 18 }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={1.8}>
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}
