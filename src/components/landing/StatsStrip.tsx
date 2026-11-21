import { useInView } from './motion'
import { stats } from './data'

/** A single metric. Until a real value exists it renders an explicit TODO. */
function StatCell({ item, index }: { item: (typeof stats)[number]; index: number }) {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.3 })
  const hasValue = item.value !== null

  // Numeric items count up; placeholders simply appear. The cell's height is
  // fixed by the label, so a value change cannot shift the layout.
  return (
    <div
      ref={ref}
      data-revealed={inView ? 'true' : 'false'}
      style={{ '--d': index } as React.CSSProperties}
      className={[
        'reveal flex min-h-[86px] flex-col justify-center px-5 py-6 sm:px-6',
        // Mobile: 2×2 grid with inner dividers.
        index % 2 === 0 ? 'border-r border-white/[.08]' : '',
        index < 2 ? 'border-b border-white/[.08] lg:border-b-0' : '',
        // Desktop: 4 across with dividers between, not after, the last cell.
        'lg:border-b-0',
        index < 3 ? 'lg:border-r lg:border-white/[.08]' : 'lg:border-r-0',
      ].join(' ')}
    >
      <p className="font-display text-[26px] font-bold leading-none text-white sm:text-[30px]">
        {hasValue ? (
          <span className="tabular-nums">
            {item.prefix}
            {item.value}
            {item.suffix}
          </span>
        ) : (
          <span
            className="inline-flex items-baseline gap-1.5 text-[#8B7FA8]"
            title="Placeholder: replace with a verified figure"
          >
            <span className="rounded-md border border-dashed border-white/25 px-2 py-0.5 text-[15px] font-semibold tracking-[.06em] text-[#C4B5FD]">
              TODO
            </span>
          </span>
        )}
      </p>
      <p className="mt-2 text-[14px] leading-snug on-dark-muted">
        {item.label}
        {!hasValue && <span className="sr-only"> (value pending)</span>}
      </p>
    </div>
  )
}

/**
 * Metrics strip under the hero fold: `grid-cols-2` on mobile, 4 across on
 * desktop. Only numeric metrics appear here — no "Real-time" or "Expert"
 * claims — and every value is a TODO until real measurements are available.
 */
export default function StatsStrip() {
  return (
    <section aria-labelledby="stats-heading" className="relative border-t border-white/[.08] bg-[#0A0712]">
      <h2 id="stats-heading" className="sr-only text-white">
        SiteOps results
      </h2>
      <div className="shell">
        <div className="grid grid-cols-2 lg:grid-cols-4">
          {stats.map((item, i) => (
            <StatCell key={item.label} item={item} index={i} />
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[.08] py-4">
          <p className="inline-flex items-center gap-2 text-[14px] on-dark-muted">
            <span className="relative h-2 w-2 rounded-full bg-[#34D399]">
              <span className="live-dot absolute inset-0 rounded-full bg-[#34D399]" aria-hidden="true" />
            </span>
            Scores are measured live with Google PageSpeed Insights
          </p>
          <p className="text-[14px] text-[#948FA6]">
            Figures marked TODO are placeholders pending verified data.
          </p>
        </div>
      </div>
    </section>
  )
}
