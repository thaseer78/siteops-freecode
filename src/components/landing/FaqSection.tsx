import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Mail, Plus } from 'lucide-react'
import { BrandMark } from '../Brand'
import { Reveal } from './motion'
import { faqs } from './data'

/**
 * Accordion.
 *
 * A real button per row (not `<details>`) so the open state can be animated and
 * `aria-expanded` / `aria-controls` are explicit. The first row starts open.
 * Height animates through `grid-template-rows: 0fr → 1fr`, which needs no
 * measured pixel height and cannot jump.
 */
function FaqItem({
  question,
  answer,
  open,
  onToggle,
  index,
}: {
  question: string
  answer: string
  open: boolean
  onToggle: () => void
  index: number
}) {
  const baseId = useId()
  const buttonId = `${baseId}-button`
  const panelId = `${baseId}-panel`

  return (
    <div
      className="faq-item rounded-xl border border-[#E4E0F0] bg-white open:shadow-[0_10px_30px_-26px_rgba(17,12,34,.6)]"
      data-open={open ? 'true' : 'false'}
    >
      <h3>
        <button
          id={buttonId}
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left text-[15px] font-semibold leading-snug text-[#111827] transition-colors hover:text-[#5B21B6] sm:px-5"
        >
          <span className="min-w-0">{question}</span>
          <span className="faq-icon mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#F3E8FF] text-[#6D28D9]" aria-hidden="true">
            <Plus size={15} />
          </span>
        </button>
      </h3>
      <div id={panelId} role="region" aria-labelledby={buttonId} className="faq-body">
        <div>
          <p
            className="faq-answer px-4 pb-4 pr-10 text-[14.5px] leading-relaxed text-[#3F3F4A] sm:px-5"
            style={{ '--i': index } as React.CSSProperties}
          >
            {answer}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function FaqSection() {
  // First item open by default, per the brief.
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section id="faq" className="relative scroll-mt-24 overflow-hidden border-t border-[#EAE8F2] bg-alabaster">
      <div aria-hidden="true" className="lavender-glow pointer-events-none absolute inset-0" />
      <div className="shell relative grid gap-10 py-16 lg:grid-cols-12 lg:gap-14 lg:py-28">
        <div className="min-w-0 lg:col-span-7">
          <span className="eyebrow-light">FAQ</span>
          <h2 className="mt-5 font-display text-[30px] font-bold leading-[1.1] tracking-[-.03em] text-[#111827] sm:text-[38px]">
            Got questions? We've got answers.
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[#3F3F4A]">
            The honest version — including what we do not do.
          </p>

          <Reveal className="mt-7 space-y-2.5">
            {faqs.map(([q, a], i) => (
              <FaqItem
                key={q}
                question={q}
                answer={a}
                index={i}
                open={openIndex === i}
                onToggle={() => setOpenIndex(openIndex === i ? null : i)}
              />
            ))}
          </Reveal>

          <p className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-[#3F3F4A]">
            Still unsure?
            <a
              href="mailto:support@siteops.in"
              className="inline-flex min-h-[28px] items-center gap-1.5 py-1 font-semibold text-[#6D28D9] underline-offset-4 hover:text-[#5B21B6] hover:underline"
            >
              <Mail size={14} aria-hidden="true" /> Email us
            </a>
            <span className="text-[#4B4B57]">— a real person replies.</span>
          </p>
        </div>

        <div className="relative min-w-0 lg:col-span-5">
          <Reveal delay={1} variant="scale">
            <div className="overflow-hidden rounded-3xl bg-[#120E1D] p-7 text-white shadow-[0_40px_80px_-50px_rgba(0,0,0,.9)] lg:sticky lg:top-24">
              <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rotate-45 bg-gradient-to-br from-primary-500/40 to-transparent blur-2xl" />
              <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary-400/70 to-transparent" />
              <div className="relative">
                <BrandMark className="h-11 w-11 rounded-xl" />
                <h3 className="mt-5 font-display text-[25px] font-bold leading-tight tracking-[-.02em]">
                  Ready to optimise your website?
                </h3>
                <p className="mt-3 text-[14.5px] leading-relaxed on-dark-body">
                  Register a site and request your first audit in under two minutes. Real measurements, no
                  invented scores.
                </p>
                <Link
                  to="/register"
                  className="group/cta cta-pulse mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary-600 px-5 py-3.5 text-[15px] font-semibold text-white shadow-glow transition-colors hover:bg-primary-700"
                >
                  Get started <ArrowRight size={16} className="cta-arrow" />
                </Link>
                <p className="mt-3.5 flex items-center justify-center gap-1.5 text-[14px] text-[#B9B5C6]">
                  <CheckCircle2 size={13} className="text-[#6EE7B7]" aria-hidden="true" /> No card required · Free first audit
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
