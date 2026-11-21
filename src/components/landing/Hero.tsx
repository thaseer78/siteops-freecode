import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Lock, Sparkles, TrendingUp, Zap } from 'lucide-react'
import { CountUp, Reveal, useInView, useMagnetic, usePrefersReducedMotion, useTilt } from './motion'
import { sampleScores } from './data'

/* Headline words are pre-split so each can animate in with its own delay.
   Splitting at build time (not measuring text) keeps layout identical to the
   un-animated version, so there is no cumulative layout shift. */
function WordRise({ text, startIndex = 0, className = '' }: { text: string; startIndex?: number; className?: string }) {
  return (
    <>
      {text.split(' ').map((word, i, all) => (
        <span key={`${word}-${i}`}>
          <span className={`word-rise ${className}`} style={{ '--i': startIndex + i } as React.CSSProperties}>
            {word}
          </span>
          {/* A real space between the inline-block words, so the heading is
              ordinary selectable prose (and copies cleanly). */}
          {i < all.length - 1 ? ' ' : ''}
        </span>
      ))}
    </>
  )
}

/** Score ring that sweeps to its value once revealed. */
function ScoreRing({ score }: { score: number }) {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.4 })
  const reduced = usePrefersReducedMotion()
  const [sweep, setSweep] = useState(0)

  useEffect(() => {
    if (!inView) return
    if (reduced) {
      setSweep(score)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / 1200)
      const eased = 1 - Math.pow(1 - p, 3)
      setSweep(score * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, reduced, score])

  return (
    <div
      ref={ref}
      data-revealed={inView ? 'true' : 'false'}
      className="score-ring relative grid h-[112px] w-[112px] shrink-0 place-items-center rounded-full sm:h-[124px] sm:w-[124px]"
      style={{ '--sweep': sweep } as React.CSSProperties}
      role="img"
      aria-label={`Sample overall score ${score} out of 100`}
    >
      <div className="grid h-[88px] w-[88px] place-items-center rounded-full bg-white sm:h-[98px] sm:w-[98px]">
        <div className="text-center">
          <CountUp value={score} className="block font-display text-[30px] font-bold leading-none text-[#111827] sm:text-[34px]" />
          <span className="mt-1 block text-[12.5px] font-semibold uppercase tracking-[.08em] text-[#52525B]">Score</span>
        </div>
      </div>
    </div>
  )
}

/**
 * The hero's `Website Health` preview.
 *
 * Sample data throughout: the card is labelled "Sample report" so nobody reads
 * it as their own score. The `+18 pts` badge sits *below* the card in normal
 * flow, with a deliberate gap, instead of overlapping the card edge.
 */
function HealthPreview() {
  const tilt = useTilt(5)
  const { ref: viewRef, inView } = useInView<HTMLDivElement>({ threshold: 0.25 })
  const [badge, setBadge] = useState(false)

  useEffect(() => {
    if (!inView) return
    const t = window.setTimeout(() => setBadge(true), 900)
    return () => window.clearTimeout(t)
  }, [inView])

  return (
    <div className="relative w-full min-w-0">
      {/* Ambient glow behind the card — well inside the column so it cannot
          extend the scrollable area. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-4 -z-10 rounded-[32px] bg-[radial-gradient(60%_60%_at_60%_35%,rgba(139,92,246,.35),transparent_70%)] blur-2xl"
      />

      <div
        ref={(node) => {
          viewRef.current = node
          tilt.ref.current = node
        }}
        data-revealed={inView ? 'true' : 'false'}
        onPointerMove={tilt.onPointerMove}
        onPointerLeave={tilt.onPointerLeave}
        className="tilt relative w-full rounded-3xl border border-white/[.09] bg-white/[.03] p-1.5 shadow-[0_40px_90px_-50px_rgba(0,0,0,.95)]"
      >
        <div className="rounded-[20px] bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[12.5px] font-semibold uppercase tracking-[.1em] text-[#52525B]">Website health</p>
              <p className="mt-1 text-[17px] font-bold tracking-[-.01em] text-[#111827]">kavericrafts.in</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-[#E4E0F0] bg-[#F6F4FC] px-2.5 py-1 text-[12.5px] font-semibold text-[#52525B]">
                Sample report
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF5] px-2.5 py-1 text-[12.5px] font-semibold text-[#047857]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" /> Excellent
              </span>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-5 sm:gap-6">
            <ScoreRing score={94} />
            <div className="min-w-0 flex-1 space-y-3">
              {sampleScores.map(([label, value, colour], i) => (
                <div key={label}>
                  <div className="flex items-baseline justify-between gap-2 text-[14px] text-[#52525B]">
                    <span className="truncate">{label}</span>
                    <span className="font-semibold tabular-nums text-[#111827]">{value}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#EFEEF6]">
                    <div
                      className="bar-fill h-full rounded-full"
                      style={{ '--v': value / 100, '--d': i, background: colour } as React.CSSProperties}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#EAE8F2] bg-[#FAFAFC] px-3.5 py-3">
            <span className="inline-flex items-center gap-2 text-[14px] font-medium text-[#52525B]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" /> Sample audit · mobile &amp; desktop
            </span>
            <a href="#sample-report" className="inline-flex min-h-[24px] items-center gap-1 text-[14px] font-semibold text-[#6D28D9] hover:text-[#5B21B6]">
              View sample report <ArrowRight size={12} />
            </a>
          </div>
        </div>
      </div>

      {/* Badge in normal flow, below the card, with a clear gap. */}
      <div
        data-revealed={badge ? 'true' : 'false'}
        className="spring-in mt-4 flex items-center justify-between gap-4 rounded-2xl border border-white/[.12] bg-[#191325]/95 px-4 py-3 shadow-[0_18px_40px_-26px_rgba(0,0,0,.9)]"
      >
        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold uppercase tracking-[.12em] text-[#A9A6B8]">This month</p>
          <p className="mt-0.5 text-[14px] font-semibold text-white">
            12 issues fixed <span className="text-[#6EE7B7]">+18 pts</span>
          </p>
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#34D399]/12 text-[#6EE7B7]">
          <TrendingUp size={17} />
        </span>
      </div>
    </div>
  )
}

export default function Hero() {
  const primary = useMagnetic(4)
  return (
    <section className="relative isolate overflow-hidden bg-obsidian">
      {/* Drifting orbs — transform-only, 20–30s alternating loops. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="orb left-[-10%] top-[-12%] h-[380px] w-[380px] bg-[#7C3AED]/30" style={{ '--orb-duration': '26s' } as React.CSSProperties} />
        <div className="orb right-[-6%] top-[6%] h-[320px] w-[320px] bg-[#C084FC]/20" style={{ '--orb-duration': '30s' } as React.CSSProperties} />
        <div className="orb bottom-[-18%] left-[38%] h-[300px] w-[300px] bg-[#4C1D95]/40" style={{ '--orb-duration': '20s' } as React.CSSProperties} />
      </div>
      <div aria-hidden="true" className="hairline-grid pointer-events-none absolute inset-0 -z-10 opacity-30" />

      <div className="shell pb-14 pt-12 sm:pt-16 lg:pb-20 lg:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-10">
          {/* Copy: 7 columns on desktop. */}
          <div className="min-w-0 lg:col-span-7">
            <span className="eyebrow-dark">
              <Sparkles size={12} /> India-first website operations
            </span>

            <h1 className="mt-5 font-display text-[40px] font-bold leading-[1.02] tracking-[-.035em] text-white sm:text-[56px] lg:text-[64px]">
              <WordRise text="Your website is live." />
              <br />
              <span className="text-shimmer">
                <WordRise text="Now keep it working." startIndex={4} />
              </span>
            </h1>

            <p className="mt-6 max-w-[46ch] text-[16px] leading-relaxed on-dark-body sm:text-[17px]">
              SiteOps is the technical operations partner for businesses already online. We audit with real
              Lighthouse data, tell you what to fix first, and keep the site fast, searchable and reliable
              long after launch day.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                ref={primary.ref}
                to="/register"
                onPointerMove={primary.onPointerMove}
                onPointerLeave={primary.onPointerLeave}
                className="group/cta magnetic cta-pulse pill-cta bg-[#D8B4FE] px-6 py-3.5 text-[15px] text-[#2E1065] shadow-glow transition-colors hover:bg-[#A855F7] hover:text-white"
              >
                Audit my website
                <ArrowRight size={16} className="cta-arrow" />
              </Link>
              <a
                href="#how"
                className="group/cta pill-cta border border-white/25 px-6 py-3.5 text-[15px] text-white transition-colors hover:border-white/45 hover:bg-white/[.07]"
              >
                See how it works
                <ArrowRight size={16} className="cta-arrow" />
              </a>
            </div>

            <ul className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2.5 text-[14px] on-dark-muted">
              {[
                ['Free first audit', CheckCircle2],
                ['Your data stays yours', Lock],
                ['Real PageSpeed measurements', Zap],
              ].map(([text, Icon]) => {
                const I = Icon as typeof CheckCircle2
                return (
                  <li key={text as string} className="inline-flex items-center gap-1.5">
                    <I size={14} className="text-primary-300" aria-hidden="true" /> {text as string}
                  </li>
                )
              })}
            </ul>
          </div>

          {/* Preview: 5 columns on desktop. */}
          <div className="min-w-0 lg:col-span-5">
            <Reveal variant="scale" delay={2}>
              <HealthPreview />
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  )
}
