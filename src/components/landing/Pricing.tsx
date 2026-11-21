import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Info, Star } from 'lucide-react'
import { Reveal, useInView, useSpotlight } from './motion'
import { plans, type Plan } from './data'
import { DrawnTick } from './HowItWorks'

/** Monthly / annual switch. The annual price is a TODO, so annual shows a note. */
function BillingToggle({
  period,
  onChange,
}: {
  period: 'monthly' | 'annual'
  onChange: (p: 'monthly' | 'annual') => void
}) {
  return (
    <div
      role="group"
      aria-label="Billing period"
      className="mt-7 inline-flex items-center gap-1 rounded-full border border-[#E4E0F0] bg-white p-1 shadow-[0_2px_10px_rgba(17,12,34,.05)]"
    >
      {(['monthly', 'annual'] as const).map((p) => {
        const active = period === p
        return (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-pressed={active}
            className={`rounded-full px-4 py-2 text-[14px] font-semibold transition-colors ${
              active ? 'bg-[#111827] text-white' : 'text-[#4B4B57] hover:bg-[#F4F2FA]'
            }`}
          >
            {p === 'monthly' ? 'Monthly' : 'Annual'}
            {p === 'annual' && (
              <span className="ml-1.5 text-[12.5px] font-medium text-[#6D28D9]">TODO</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function PriceLine({ plan, period }: { plan: Plan; period: 'monthly' | 'annual' }) {
  if (plan.monthly === null) {
    return (
      <p className="mt-5 font-display text-[34px] font-bold leading-none text-[#111827]">{plan.priceLabel}</p>
    )
  }
  if (period === 'annual') {
    // No annual figure exists yet: be explicit rather than guessing a discount.
    return (
      <p className="mt-5 flex items-baseline gap-2">
        <span className="rounded-md border border-dashed border-[#C4B5FD] bg-[#F5F3FF] px-2 py-1 font-display text-[20px] font-bold text-[#5B21B6]">
          TODO
        </span>
        <span className="text-[14px] font-medium text-[#4B4B57]">annual price</span>
      </p>
    )
  }
  return (
    <p className="mt-5 flex flex-wrap items-baseline gap-x-1.5">
      <span className="font-display text-[34px] font-bold leading-none tracking-[-.02em] text-[#111827]">
        {plan.priceLabel}
      </span>
      <span className="text-[14px] font-medium text-[#4B4B57]">{plan.unit}</span>
      <span className="text-[14px] font-medium text-[#4B4B57]">+ GST</span>
    </p>
  )
}

function PlanCard({ plan, period, index }: { plan: Plan; period: 'monthly' | 'annual'; index: number }) {
  const spot = useSpotlight<HTMLDivElement>()
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.2 })

  const featured = !!plan.featured
  return (
    <div ref={ref} data-revealed={inView ? 'true' : 'false'} className="flex h-full">
      <div
        ref={spot.ref}
        onPointerMove={spot.onPointerMove}
        className={[
          'relative flex h-full w-full flex-col rounded-2xl p-6 lg:p-7',
          featured
            ? 'conic-border border-2 border-transparent bg-[#FAF5FF] shadow-[0_28px_70px_-38px_rgba(124,58,237,.65)]'
            : 'border border-[#E4E0F0] bg-white shadow-[0_2px_12px_rgba(17,12,34,.04)]',
        ].join(' ')}
      >
        {featured && (
          <span className="badge-shimmer absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#6D28D9] px-3.5 py-1 text-[12.5px] font-bold uppercase tracking-[.06em] text-white shadow-glow">
            Most popular
          </span>
        )}

        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[17px] font-bold tracking-[-.01em] text-[#111827]">{plan.name}</h3>
          {featured && <Star size={15} className="fill-[#7C3AED] text-[#7C3AED]" aria-hidden="true" />}
        </div>
        <p className="mt-1.5 min-h-[42px] text-[14px] leading-relaxed text-[#4B4B57]">{plan.blurb}</p>

        <PriceLine plan={plan} period={period} />

        <ul className="mt-6 flex-1 space-y-2.5">
          {plan.features.map((f, i) => (
            <li key={f} className="flex gap-2.5 text-[14px] leading-relaxed text-[#3F3F4A]">
              <DrawnTick delay={index * 2 + i} />
              <span>{f}</span>
            </li>
          ))}
        </ul>

        {plan.note && (
          <p className="mt-5 flex gap-2 rounded-lg border border-dashed border-[#D6CCF5] bg-white/70 px-3 py-2 text-[14px] leading-relaxed text-[#4B4B57]">
            <Info size={13} className="mt-0.5 shrink-0 text-[#6D28D9]" aria-hidden="true" />
            <span>{plan.note}</span>
          </p>
        )}

        {plan.ctaHref.startsWith('/') ? (
          <Link
            to={plan.ctaHref}
            className={[
              'group/cta mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-[15px] font-semibold transition-colors',
              featured
                ? 'bg-[#6D28D9] text-white shadow-glow hover:bg-[#5B21B6]'
                : // Ghost buttons use a solid border + full-strength text for 4.5:1.
                  'border-2 border-[#4B4B57] text-[#111827] hover:border-[#6D28D9] hover:bg-[#F5F3FF]',
            ].join(' ')}
          >
            {plan.cta} <ArrowRight size={16} className="cta-arrow" />
          </Link>
        ) : (
          <a
            href={plan.ctaHref}
            className={[
              'group/cta mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-[15px] font-semibold transition-colors',
              featured
                ? 'bg-[#6D28D9] text-white shadow-glow hover:bg-[#5B21B6]'
                : 'border-2 border-[#4B4B57] text-[#111827] hover:border-[#6D28D9] hover:bg-[#F5F3FF]',
            ].join(' ')}
          >
            {plan.cta} <ArrowRight size={16} className="cta-arrow" />
          </a>
        )}
      </div>
    </div>
  )
}

export default function Pricing() {
  const [period, setPeriod] = useState<'monthly' | 'annual'>('monthly')

  return (
    <section id="pricing" className="relative scroll-mt-24 overflow-hidden bg-alabaster">
      <div aria-hidden="true" className="lavender-glow pointer-events-none absolute inset-0" />
      <div className="shell relative py-16 lg:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <span className="eyebrow-light">Pricing</span>
          <h2 className="mt-5 font-display text-[32px] font-bold leading-[1.08] tracking-[-.03em] text-[#111827] sm:text-[42px]">
            Simple, transparent pricing.
          </h2>
          <p className="mt-3 text-[16px] leading-relaxed text-[#3F3F4A]">
            Start on Free, upgrade when the reports start paying for themselves.
          </p>
          <BillingToggle period={period} onChange={setPeriod} />
        </div>

        <div className="mt-10 grid items-stretch gap-5 lg:mt-12 lg:grid-cols-3">
          {plans.map((plan, i) => (
            <Reveal key={plan.name} delay={i} className="h-full">
              <PlanCard plan={plan} period={period} index={i} />
            </Reveal>
          ))}
        </div>

        <p className="mt-7 text-center text-[14px] leading-relaxed text-[#3F3F4A]">
          All prices in INR, exclusive of GST. Every account keeps unlimited report history. Retainers are
          quoted after the first audit, so scope follows real findings rather than a guess.
        </p>
      </div>
    </section>
  )
}
