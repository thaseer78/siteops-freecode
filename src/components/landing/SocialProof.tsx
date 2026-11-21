import { ArrowUpRight, FileText, Quote } from 'lucide-react'
import { Reveal } from './motion'

/**
 * Social proof + sample report.
 *
 * No invented customers, quotes or statistics: the testimonial slots carry
 * visible TODO markers so the layout is real but the claims are pending.
 */
export default function SocialProof() {
  return (
    <section id="sample-report" className="relative scroll-mt-24 overflow-hidden bg-[#0B0615]">
      <div aria-hidden="true" className="plum-glow pointer-events-none absolute inset-0 opacity-70" />
      <div className="shell relative py-16 lg:py-28">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
          {/* Case study slot */}
          <Reveal className="min-w-0 lg:col-span-7">
            <span className="eyebrow-dark">Sample report &amp; results</span>
            <h2 className="mt-5 font-display text-[32px] font-bold leading-[1.08] tracking-[-.03em] text-white sm:text-[42px]">
              See the report before you sign up.
            </h2>
            <p className="mt-4 max-w-[56ch] text-[16px] leading-relaxed on-dark-body">
              Every SiteOps report follows the same structure: overall score, four category scores, a
              prioritised issue list and a plain-language next step. This sample uses placeholder data so
              you can judge the format, not our marketing.
            </p>

            <figure className="mt-8 rounded-2xl border border-white/[.1] bg-white/[.04] p-6">
              <Quote size={22} className="text-primary-300" aria-hidden="true" />
              <blockquote className="mt-3 text-[16px] leading-relaxed text-white">
                <span className="rounded border border-dashed border-white/30 px-1.5 py-0.5 text-[14px] font-semibold uppercase tracking-[.06em] text-[#C4B5FD]">
                  TODO
                </span>{' '}
                <span className="on-dark-body">
                  customer testimonial — quote to be supplied, with permission to publish.
                </span>
              </blockquote>
              <figcaption className="mt-4 flex items-center gap-3 border-t border-white/[.08] pt-4">
                <span className="grid h-10 w-10 place-items-center rounded-full border border-dashed border-white/25 text-[12.5px] font-semibold text-[#C4B5FD]">
                  TODO
                </span>
                <span className="text-[14px] leading-snug on-dark-muted">
                  Name, role and business — <span className="text-[#C4B5FD]">TODO</span>
                  <br />
                  <span className="text-[14px] text-[#948FA6]">Photo and logo also pending</span>
                </span>
              </figcaption>
            </figure>

            <p className="mt-4 text-[14px] leading-relaxed text-[#948FA6]">
              We publish testimonials only with written permission, and never with invented results.
            </p>
          </Reveal>

          {/* Sample report card */}
          <Reveal delay={1} variant="scale" className="min-w-0 lg:col-span-5">
            <div className="rounded-2xl border border-white/[.1] bg-white p-2 shadow-[0_40px_90px_-50px_rgba(0,0,0,.9)]">
              <div className="rounded-xl bg-[#FAFAFC] p-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-2">
                    <FileText size={16} className="text-[#6D28D9]" aria-hidden="true" />
                    <span className="text-[14px] font-semibold text-[#111827]">SiteOps report · sample</span>
                  </div>
                  <span className="rounded-full border border-[#E4E0F0] bg-white px-2.5 py-1 text-[12.5px] font-semibold text-[#4B4B57]">
                    3 pages
                  </span>
                </div>

                <div className="mt-5 space-y-3">
                  {[
                    ['Overall score card', 'Mobile and desktop, side by side'],
                    ['Four category scores', 'Performance, accessibility, SEO, best practices'],
                    ['Prioritised findings', 'Severity, affected URL, plain-language fix'],
                  ].map(([t, d], i) => (
                    <div key={t} className="flex gap-3 rounded-xl border border-[#E4E0F0] bg-white px-3.5 py-3">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#F3E8FF] text-[12.5px] font-bold text-[#6D28D9]">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-[#111827]">{t}</p>
                        <p className="mt-0.5 text-[14px] leading-snug text-[#4B4B57]">{d}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Placeholder CTA: wire to the real sample PDF once it exists. */}
                <a
                  href="#sample-report"
                  className="group/cta mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#6D28D9] px-4 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-[#5B21B6]"
                  aria-describedby="sample-report-note"
                >
                  View sample report <ArrowUpRight size={16} className="cta-arrow" />
                </a>
                <p id="sample-report-note" className="mt-2.5 text-center text-[12.5px] leading-relaxed text-[#4B4B57]">
                  Link pending — <span className="font-semibold">TODO</span>: upload the sample PDF.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
