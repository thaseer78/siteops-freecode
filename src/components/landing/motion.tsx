import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'

/* ── Motion primitives ──────────────────────────────────────────────────────
   A small, dependency-free toolkit for the marketing page. Everything here
   animates only `transform` and `opacity` (or writes CSS custom properties that
   feed transform/opacity), and every helper degrades to a static final state
   when the visitor prefers reduced motion.                                      */

/** True when the visitor asked for reduced motion (live — listens for changes). */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window === 'undefined'
      ? false
      : window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

interface InViewOptions {
  /** How much of the element must be visible before it counts as on screen. */
  threshold?: number
  /** Keep the "seen" state once triggered (default) or revert when it leaves. */
  once?: boolean
  /** Root margin, useful for triggering slightly before the fold. */
  rootMargin?: string
}

/**
 * Reports whether the referenced element has entered the viewport.
 * With reduced motion enabled it reports `true` immediately, so nothing waits
 * on an observer that will never animate.
 */
export function useInView<T extends HTMLElement = HTMLDivElement>({
  threshold = 0.18,
  once = true,
  rootMargin = '0px 0px -8% 0px',
}: InViewOptions = {}) {
  const ref = useRef<T | null>(null)
  const reduced = usePrefersReducedMotion()
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reduced || typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true)
            if (once) io.disconnect()
          } else if (!once) {
            setInView(false)
          }
        }
      },
      { threshold, rootMargin }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [threshold, once, rootMargin, reduced])

  return { ref, inView }
}

interface RevealProps {
  children: ReactNode
  /** Stagger slot: delay = index * 60ms. */
  delay?: number
  className?: string
  /** Horizontal / scale entrance variants. */
  variant?: 'up' | 'left' | 'scale'
  as?: 'div' | 'section' | 'li' | 'article' | 'header' | 'footer'
  style?: CSSProperties
  id?: string
}

/**
 * The single reveal utility used across the page. Mounted before the element
 * scrolls into view it is `opacity: 0` + a 24px offset; the class swap animates
 * it into place. Because it never changes layout box size it cannot cause CLS.
 */
export function Reveal({
  children,
  delay = 0,
  className = '',
  variant = 'up',
  as: Tag = 'div',
  style,
  id,
}: RevealProps) {
  const { ref, inView } = useInView<HTMLDivElement>()
  const variantClass = variant === 'left' ? 'reveal reveal-left' : variant === 'scale' ? 'reveal reveal-scale' : 'reveal'
  return (
    <Tag
      // @ts-expect-error — the union of intrinsic elements shares these props.
      ref={ref}
      id={id}
      data-revealed={inView ? 'true' : 'false'}
      className={`${variantClass} ${className}`}
      style={{ ...style, '--d': delay } as CSSProperties}
    >
      {children}
    </Tag>
  )
}

/**
 * Counts a number up from 0 when the element scrolls into view.
 * Reduced motion (or an immediate render) shows the final value straight away.
 * The rendered text never changes width mid-animation because the container is
 * `tabular-nums`, keeping the layout box stable.
 */
export function useCountUp(target: number, { duration = 1200, start = 0 } = {}) {
  const { ref, inView } = useInView<HTMLSpanElement>({ threshold: 0.4 })
  const reduced = usePrefersReducedMotion()
  const [value, setValue] = useState(start)

  useEffect(() => {
    if (!inView) return
    if (reduced) {
      setValue(target)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration)
      // easeOutCubic — matches the shared easing curve closely enough at this size.
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(start + (target - start) * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, reduced, target, duration, start])

  return { ref, value }
}

/** Count-up text node with tabular numerals and a stable width. */
export function CountUp({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  className = '',
}: {
  value: number
  decimals?: number
  prefix?: string
  suffix?: string
  className?: string
}) {
  const { ref, value: current } = useCountUp(value)
  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {prefix}
      {current.toFixed(decimals)}
      {suffix}
    </span>
  )
}

/** Thin top-of-page progress bar, driven by a transform: scaleX. */
export function ScrollProgress() {
  const reduced = usePrefersReducedMotion()
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (reduced) return
    const el = ref.current
    if (!el) return
    let raf = 0
    const update = () => {
      raf = 0
      const doc = document.documentElement
      const max = doc.scrollHeight - doc.clientHeight
      const p = max > 0 ? Math.min(1, Math.max(0, doc.scrollTop / max)) : 0
      el.style.setProperty('--progress', String(p))
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [reduced])

  if (reduced) return null
  return <div ref={ref} className="scroll-progress" aria-hidden="true" />
}

/** True once the page is scrolled past `offset` px (for the frosted navbar). */
export function useScrolledPast(offset = 40) {
  const [past, setPast] = useState(false)
  useEffect(() => {
    let raf = 0
    const update = () => {
      raf = 0
      setPast(window.scrollY > offset)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [offset])
  return past
}

/**
 * Desktop-only pointer tilt. Returns a ref and handlers that write `--rx`/`--ry`
 * (max ±6deg). No-ops on coarse pointers and under reduced motion, so touch
 * devices and motion-sensitive visitors get a perfectly still card.
 */
export function useTilt(maxDeg = 6) {
  const reduced = usePrefersReducedMotion()
  const ref = useRef<HTMLDivElement | null>(null)
  const enabled = !reduced && typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches

  const onMove = useCallback(
    (e: React.PointerEvent) => {
      const el = ref.current
      if (!el || !enabled) return
      const r = el.getBoundingClientRect()
      const px = (e.clientX - r.left) / r.width - 0.5
      const py = (e.clientY - r.top) / r.height - 0.5
      el.style.setProperty('--ry', `${(px * maxDeg).toFixed(2)}deg`)
      el.style.setProperty('--rx', `${(-py * maxDeg).toFixed(2)}deg`)
      el.classList.add('tilt-active')
    },
    [enabled, maxDeg]
  )

  const onLeave = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.setProperty('--rx', '0deg')
    el.style.setProperty('--ry', '0deg')
    el.classList.remove('tilt-active')
  }, [])

  return { ref, onPointerMove: onMove, onPointerLeave: onLeave }
}

/** Cursor-following spotlight for cards: writes --mx/--my as percentages. */
export function useSpotlight<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null)
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`)
    el.style.setProperty('--my', `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`)
  }, [])
  return { ref, onPointerMove }
}

/**
 * Subtle magnetic pull for the primary CTAs (max `strength` px). Disabled on
 * touch and under reduced motion.
 */
export function useMagnetic(strength = 4) {
  const reduced = usePrefersReducedMotion()
  const ref = useRef<HTMLAnchorElement | null>(null)
  const enabled =
    !reduced &&
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const el = ref.current
      if (!el || !enabled) return
      const r = el.getBoundingClientRect()
      const dx = ((e.clientX - (r.left + r.width / 2)) / (r.width / 2)) * strength
      const dy = ((e.clientY - (r.top + r.height / 2)) / (r.height / 2)) * strength
      el.style.setProperty('--mx', `${dx.toFixed(2)}px`)
      el.style.setProperty('--my', `${dy.toFixed(2)}px`)
    },
    [enabled, strength]
  )
  const onPointerLeave = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.setProperty('--mx', '0px')
    el.style.setProperty('--my', '0px')
  }, [])
  return { ref, onPointerMove, onPointerLeave }
}

/**
 * Scroll progress (0–1) for a section, used to draw the steps connector.
 * Measured against the element's own travel through the viewport.
 */
export function useSectionProgress<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null)
  const [progress, setProgress] = useState(0)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    if (reduced) {
      setProgress(1)
      return
    }
    const el = ref.current
    if (!el) return
    let raf = 0
    const update = () => {
      raf = 0
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight || 1
      // 0 when the section's top edge is at 85% of the viewport, 1 once its
      // centre passes the middle of the screen.
      const start = vh * 0.85
      const span = r.height * 0.6 + vh * 0.35
      const travelled = start - r.top
      setProgress(Math.min(1, Math.max(0, travelled / Math.max(1, span))))
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [reduced])

  return { ref, progress }
}
