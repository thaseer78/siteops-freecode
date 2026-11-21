import { ArrowRight, ArrowUpRight, CheckCircle2, TrendingUp } from 'lucide-react'
import { Reveal, useInView, useSpotlight } from './motion'
import { featureCards, type FeatureCard } from './data'

/** Small sparkline: two lines (before / after) so the mock shows progress, not a repeat. */
function TrendChart({ inView }: { inView: boolean }) {
  const before = [31, 44, 38, 52, 46, 58]
  const after = [42, 58, 63, 71, 80, 92]
  const w = 260
  const h = 84
  const toPoints = (values: number[]) =>
    values
      .map((v, i) => `${(i / (values.length - 1)) * w},${h - (v / 100) * h}`)
      .join(' ')

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-[84px] w-full"
      role="img"
      aria-label="Sample score trend rising from 31 to 92 across six audits"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="afterFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#A855F7" stopOpacity=".38" />
          <stop offset="100%" stopColor="#A855F7" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* baseline grid */}
      {[0, 0.5, 1].map((p) => (
        <line key={p} x1="0" x2={w} y1={h * p} y2={h * p} stroke="rgba(255,255,255,.07)" strokeWidth="1" />
      ))}
      {/* before */}
      <polyline
        points={toPoints(before)}
        fill="none"
        stroke="rgba(255,255,255,.28)"
        strokeWidth="2"
        strokeDasharray="4 4"
        strokeLinecap="round"
      />
      {/* after with area fill */}
      <polygon points={`0,${h} ${toPoints(after)} ${w},${h}`} fill="url(#afterFill)" opacity={inView ? 1 : 0} className="transition-opacity duration-700" />
      <polyline
        points={toPoints(after)}
        fill="none"
        stroke="#C084FC"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: 900,
          strokeDashoffset: inView ? 0 : 900,
          transition: 'stroke-dashoffset 1200ms cubic-bezier(.2,.7,.2,1)',
        }}
      />
      <circle cx={w} cy={h - (92 / 100) * h} r="3.5" fill="#C084FC" opacity={inView ? 1 : 0} className="transition-opacity delay-700 duration-500" />
    </svg>
  )
}

/** The dark dashboard mock inside the advantage section. */
function DashboardMock() {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.25 })
  return (
    <div ref={ref} data-revealed={inView ? 'true' : 'false'} className="relative">
      <div aria-hidden="true" className="pointer-events-none absolute -inset-5 -z-10 rounded-[32px] bg-[radial-gradient(60%_60%_at_70%_20%,rgba(139,92,246,.3),transparent_72%)] blur-2xl" />
      <div className="relative overflow-hidden rounded-[24px] border border-[#EAE8F2] bg-white p-2.5 shadow-[0_30px_70px_-40px_rgba(17,12,34,.55)]">
        <div className="relative overflow-hidden rounded-[18px] bg-[#0F0E13] p-5">
          <div className="scan-line" aria-hidden="true" />

          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#EF4444]/70" />
            <span className="h-2 w-2 rounded-full bg-[#F59E0B]/70" />
            <span className="h-2 w-2 rounded-full bg-[#10B981]/70" />
            <span className="ml-3 text-[12.5px] uppercase tracking-[.12em] text-[#A9A6B8]">kavericrafts.in</span>
            <span className="ml-auto rounded-full border border-white/15 px-2 py-0.5 text-[12.5px] font-semibold text-[#C4B5FD]">
              Sample
            </span>
          </div>

          {/* Before / after, rather than one more copy of the same score. */}
          <div className="mt-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-[12.5px] font-semibold uppercase tracking-[.12em] text-[#A9A6B8]">Health trend · 6 audits</p>
              <p className="mt-1.5 flex items-baseline gap-2">
                <span className="font-display text-[30px] font-bold leading-none text-white">92</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#34D399]/12 px-2 py-0.5 text-[12.5px] font-semibold text-[#6EE7B7]">
                  <TrendingUp size={12} /> +61 pts
                </span>
              </p>
            </div>
            <p className="text-right text-[12.5px] leading-snug text-[#A9A6B8]">
              Baseline <span className="font-semibold text-white">31</span>
              <br />
              now <span className="font-semibold text-white">92</span>
            </p>
          </div>

          <div className="mt-3">
            <TrendChart inView={inView} />
          </div>

          {/* Prioritised issue list, so the mock shows the actual job. */}
          <ul className="mt-4 space-y-2">
            {[
              ['Hero image 2.4 MB → 180 KB', true],
              ['Render-blocking font CSS deferred', true],
              ['Missing meta description on 3 pages', true],
              ['Tap targets under 44px', false],
            ].map(([label, done], i) => (
              <li
                key={label as string}
                className="flex items-start gap-2 rounded-lg border border-white/[.07] bg-white/[.03] px-2.5 py-2"
                style={{
                  opacity: inView ? 1 : 0,
                  transform: inView ? 'none' : 'translate3d(0,8px,0)',
                  transition: `opacity 500ms cubic-bezier(.2,.7,.2,1) ${300 + i * 90}ms, transform 500ms cubic-bezier(.2,.7,.2,1) ${300 + i * 90}ms`,
                }}
              >
                <CheckCircle2
                  size={14}
                  className={`mt-0.5 shrink-0 ${done ? 'text-[#34D399]' : 'text-white/25'}`}
                  aria-hidden="true"
                />
                <span className={`text-[14px] leading-snug ${done ? 'text-white/80' : 'text-white/45'}`}>
                  {label as string}
                </span>
                <span className="ml-auto shrink-0 text-[12.5px] font-semibold uppercase tracking-[.06em] text-[#B9B5C6]">
                  {done ? 'Fixed' : 'Queued'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function FeatureTile({ card, index }: { card: FeatureCard; index: number }) {
  const spot = useSpotlight<HTMLDivElement>()
  const wide = card.span === 'wide'
  return (
    <Reveal delay={index} className={wide ? 'sm:col-span-2 lg:col-span-2' : ''}>
      <div
        ref={spot.ref}
        onPointerMove={spot.onPointerMove}
        className="spot-card group flex h-full flex-col rounded-2xl border border-[#E4E0F0] bg-white p-6 shadow-[0_2px_10px_rgba(17,12,34,.04)]"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#F3E8FF] text-[#6D28D9] transition-transform duration-300 group-hover:scale-105">
          <card.icon size={20} aria-hidden="true" />
        </span>
        <h3 className="mt-4 text-[16px] font-semibold text-[#111827]">{card.title}</h3>
        <p className="mt-1.5 text-[14px] leading-relaxed text-[#4B4B57]">{card.body}</p>
      </div>
    </Reveal>
  )
}

/**
 * The SiteOps advantage: copy + dashboard mock, then a seven-card bento that
 * fills a 3×3 desktop grid exactly (`wide + 1`, `1 + wide`, `1 + 1 + 1`), so
 * there is never an orphan cell.
 */
export default function Advantage() {
  return (
    <section id="features" className="relative scroll-mt-24 overflow-hidden bg-alabaster">
      <div aria-hidden="true" className="lavender-glow pointer-events-none absolute inset-0" />
      <div className="shell relative py-16 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-14">
          <div className="min-w-0 lg:col-span-6">
            <span className="eyebrow-light">The SiteOps advantage</span>
            <h2 className="mt-5 font-display text-[32px] font-bold leading-[1.08] tracking-[-.03em] text-[#111827] sm:text-[42px] lg:text-[46px]">
              Building the website was the <span className="text-[#6D28D9]">easy</span> part.
            </h2>
            <p className="mt-5 max-w-[52ch] text-[16px] leading-relaxed text-[#3F3F4A]">
              AI builders and freelancers get you online in a weekend. Six months later the homepage takes
              five seconds to load, images are unoptimised, meta tags are missing, and nobody on the team
              knows what to fix — or in what order. Meanwhile every slow page quietly costs enquiries.
            </p>
            <p className="mt-4 max-w-[52ch] text-[16px] leading-relaxed text-[#3F3F4A]">
              SiteOps fills that gap with a repeatable technical operations process, not a one-time PDF.
            </p>
            <a
              href="#services"
              className="group/cta mt-7 inline-flex min-h-[28px] items-center gap-2 py-1 text-[15px] font-semibold text-[#6D28D9] transition-colors hover:text-[#5B21B6]"
            >
              Explore all services <ArrowRight size={16} className="cta-arrow" />
            </a>
          </div>
          <div className="min-w-0 lg:col-span-6">
            <Reveal variant="scale" delay={1}>
              <DashboardMock />
            </Reveal>
          </div>
        </div>

        <div id="services" className="mt-16 grid scroll-mt-24 grid-cols-1 gap-4 sm:grid-cols-2 lg:mt-20 lg:grid-cols-3">
          {featureCards.map((card, i) => (
            <FeatureTile key={card.title} card={card} index={i} />
          ))}
        </div>

        <Reveal delay={2} className="mt-8">
          <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-[#DED8F2] bg-white/70 px-6 py-5 sm:flex-row sm:items-center">
            <p className="text-[14.5px] leading-relaxed text-[#3F3F4A]">
              Prefer to read one before signing up? The sample report uses placeholder data and shows the
              exact layout you receive.
            </p>
            <a
              href="#sample-report"
              className="group/cta inline-flex shrink-0 items-center gap-2 rounded-full border border-[#C4B5FD] px-5 py-2.5 text-[14px] font-semibold text-[#5B21B6] transition-colors hover:border-[#8B5CF6] hover:bg-[#F5F3FF]"
            >
              View sample report <ArrowUpRight size={15} className="cta-arrow" />
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
