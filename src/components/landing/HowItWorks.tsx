import { Reveal, useInView, usePrefersReducedMotion, useSectionProgress } from './motion'
import { stepHighlights, steps } from './data'

/**
 * How it works.
 *
 * Desktop: four steps in one row on a drawn connector. The line fills according
 * to how far the section has travelled through the viewport, and each dot
 * lights up as the fill passes it.
 * Mobile: the same four steps as a vertical timeline with the fill on the
 * left rail. Both variants use transform-only fills.
 */
export default function HowItWorks() {
  const { ref, progress } = useSectionProgress<HTMLDivElement>()
  const reduced = usePrefersReducedMotion()

  // Which steps have been reached at the current progress.
  const litCount = reduced ? steps.length : Math.min(steps.length, Math.ceil(progress * steps.length + 0.15))

  return (
    <section id="how" className="relative scroll-mt-24 overflow-hidden bg-[#0B0615]">
      <div aria-hidden="true" className="wave-accent pointer-events-none absolute inset-0 opacity-80" />
      <div aria-hidden="true" className="hairline-grid pointer-events-none absolute inset-0 opacity-[.18]" />

      <div className="shell relative py-16 lg:py-28">
        <div className="max-w-2xl">
          <span className="eyebrow-dark">How it works</span>
          <h2 className="mt-5 font-display text-[32px] font-bold leading-[1.08] tracking-[-.03em] text-white sm:text-[42px] lg:text-[46px]">
            Four steps, <span className="text-primary-300">no jargon.</span>
          </h2>
          <p className="mt-4 max-w-[54ch] text-[16px] leading-relaxed on-dark-body">
            You don't need to understand Core Web Vitals to get value out of SiteOps. We translate
            measurements into decisions you can hand to any developer.
          </p>
        </div>

        <div ref={ref} style={{ '--step-progress': progress } as React.CSSProperties} className="mt-12 lg:mt-16">
          {/* ── Desktop: horizontal flow ─────────────────────────────── */}
          <div className="relative hidden lg:block">
            {/* rail sits behind the dots, spanning dot-centre to dot-centre */}
            <div className="step-track left-[22px] right-[calc(25%_-_22px)] top-[22px] h-[2px]">
              <div className="step-track-fill" />
            </div>
            <ol className="relative grid grid-cols-4 gap-6">
              {steps.map((s, i) => (
                <li key={s.n}>
                  <Reveal delay={i}>
                    <span
                      data-lit={i < litCount ? 'true' : 'false'}
                      className={`step-dot grid h-11 w-11 place-items-center rounded-full text-[15px] font-bold ${
                        i < litCount ? 'bg-primary-600 text-white' : 'bg-[#241B3A] text-[#B9A6E6]'
                      }`}
                    >
                      {s.n}
                    </span>
                    <h3 className="mt-4 text-[16px] font-semibold text-white">{s.title}</h3>
                    <p className="mt-2 max-w-[30ch] text-[14px] leading-relaxed on-dark-muted">{s.body}</p>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>

          {/* ── Mobile/tablet: vertical timeline ─────────────────────── */}
          <div className="relative lg:hidden">
            <div className="step-track-v step-track left-[21px] top-2 bottom-2 w-[2px]">
              <div className="step-track-fill h-full w-full" />
            </div>
            <ol className="relative space-y-8">
              {steps.map((s, i) => (
                <li key={s.n} className="flex gap-4">
                  <span
                    data-lit={i < litCount ? 'true' : 'false'}
                    className={`step-dot z-10 grid h-11 w-11 shrink-0 place-items-center rounded-full text-[15px] font-bold ${
                      i < litCount ? 'bg-primary-600 text-white' : 'bg-[#241B3A] text-[#B9A6E6]'
                    }`}
                  >
                    {s.n}
                  </span>
                  <div className="min-w-0 pt-1">
                    <h3 className="text-[16px] font-semibold text-white">{s.title}</h3>
                    <p className="mt-1.5 text-[14px] leading-relaxed on-dark-muted">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Three bottom info cards — stacked on mobile, 3 across on desktop. */}
        <div className="mt-12 grid gap-4 rounded-2xl border border-white/[.09] bg-white/[.03] p-5 backdrop-blur lg:mt-14 lg:grid-cols-3 lg:gap-6 lg:p-7">
          {stepHighlights.map((f, i) => (
            <Reveal key={f.title} delay={i}>
              <div className="flex gap-3.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/12 bg-white/[.06] text-primary-300">
                  <f.icon size={18} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold leading-snug text-white">{f.title}</p>
                  <p className="mt-1 text-[14px] leading-relaxed on-dark-muted">{f.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/** Tiny confirmation tick used by the pricing cards. */
export function DrawnTick({ delay = 0 }: { delay?: number }) {
  const { ref, inView } = useInView<HTMLSpanElement>({ threshold: 0.6 })
  return (
    <span ref={ref} data-revealed={inView ? 'true' : 'false'} className="mt-0.5 shrink-0">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="tick">
        <circle cx="8" cy="8" r="7.25" stroke="#10B981" strokeOpacity=".35" />
        <path
          d="M4.6 8.3l2.2 2.2 4.6-4.6"
          stroke="#059669"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ '--d': delay } as React.CSSProperties}
        />
      </svg>
    </span>
  )
}
