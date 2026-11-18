import { Link } from 'react-router-dom'
import {
  ArrowRight, BarChart3, CheckCircle2, ChevronRight, Code2, FileText, Gauge, Globe2,
  Layers, Lock, Mail, MousePointerClick, Rocket, ScanLine, Search, Server, ShieldCheck, Sparkles, Wrench, Zap,
} from 'lucide-react'
import { Logo, FooterLinks, BrandMark } from '../components/Brand'
import { useAuth } from '../lib/auth'

const services = [
  { icon: Gauge, title: 'Performance audits', body: 'Real Lighthouse measurements for mobile and desktop, with the largest blocking issues ranked by impact.' },
  { icon: Search, title: 'SEO diagnostics', body: 'Find missing meta descriptions, crawl blockers, and indexability problems that quietly cost you enquiries.' },
  { icon: ScanLine, title: 'Accessibility review', body: 'Contrast, alt text, form labels and focus order — measured, listed, and explained in plain language.' },
  { icon: Wrench, title: 'Repairs & optimisation', body: 'Our operators fix what the audit finds: image weight, render-blocking assets, layout shift, broken metadata.' },
  { icon: Server, title: 'Maintenance retainers', body: 'Scheduled audits, regression alerts and a named technical contact so issues get handled before customers notice.' },
  { icon: FileText, title: 'Report history', body: 'Every audit is archived. Compare scores over time and prove the impact of each round of fixes.' },
]

const steps = [
  { n: '01', title: 'Register your website', body: 'Add the URL you run your business on. No code access or DNS changes needed to start.' },
  { n: '02', title: 'Request an audit', body: 'Mobile or desktop. We measure performance, SEO, accessibility and best practices with Google Lighthouse.' },
  { n: '03', title: 'Review the report', body: 'Category scores, measured field metrics, prioritised fixes — delivered in the portal and as a branded PDF.' },
  { n: '04', title: 'Keep it healthy', body: 'Re-audit after fixes, track the trend line, and hand the ongoing work to our ops team if you want it off your plate.' },
]

const faqs = [
  ['Is this a website builder?', 'No. SiteOps assumes you already have a website — from an AI builder, a freelancer, WordPress, Shopify or a custom team. We keep it fast, searchable, accessible and maintained.'],
  ['Where do the scores come from?', 'Google PageSpeed Insights, which runs Lighthouse. Every number in a SiteOps report is a real measurement from that API for your URL and device strategy. We never estimate or invent scores.'],
  ['Do you do penetration testing?', 'No. We do not claim security certification or vulnerability scanning. Our reports cover performance, SEO, accessibility and Lighthouse best practices, and say so explicitly.'],
  ['How is the report delivered?', 'It appears in your SiteOps portal immediately. Our team reviews it, then sends a branded PDF by email when you request delivery — with delivery status visible in the console.'],
  ['Can I use this for client websites?', 'Yes. Agencies and freelancers manage multiple websites and can share reports with their clients.'],
  ['What if my site is built on AI tools like Framer or Lovable?', 'Those sites benefit most. AI-generated sites often ship heavy images and missing metadata. A SiteOps audit tells you exactly what to change first.'],
]

export default function Landing() {
  const { user } = useAuth()
  return (
    <div className="bg-white">
      <header className="sticky top-0 z-40 border-b border-ink-900/[.07] bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5 lg:px-8">
          <Link to="/" aria-label="SiteOps"><Logo /></Link>
          <nav className="hidden items-center gap-6 text-[13.5px] font-medium text-ink-600 md:flex" aria-label="Sections">
            <a href="#services" className="hover:text-ink-900">Services</a>
            <a href="#how" className="hover:text-ink-900">How it works</a>
            <a href="#pricing" className="hover:text-ink-900">Plans</a>
            <a href="#faq" className="hover:text-ink-900">FAQ</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <Link to={user.role === 'customer' ? '/app' : '/admin'} className="btn-primary">
                Open dashboard <ArrowRight size={15} />
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn-quiet hidden sm:inline-flex">Sign in</Link>
                <Link to="/register" className="btn-primary">Start free <ArrowRight size={15} /></Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-ink-900">
        <div className="grid-noise absolute inset-0 opacity-[.85]" />
        <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-16 sm:pt-20 lg:px-8 lg:pb-24">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_.95fr]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[.06] px-3 py-1 text-[11.5px] font-medium text-white/75">
                <Sparkles size={12} className="text-mint-300" /> India-first website operations
              </span>
              <h1 className="mt-5 font-display text-[38px] font-semibold leading-[1.06] tracking-[-.03em] text-white sm:text-[52px]">
                Your website is live.<br />
                <span className="text-mint-300">Now keep it working.</span>
              </h1>
              <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-white/60 sm:text-[16px]">
                SiteOps is the technical operations partner for businesses already online. We audit with real
                Lighthouse data, tell you what to fix first, and keep the site fast, searchable and reliable
                long after launch day.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link to="/register" className="btn-accent px-5 py-3">
                  Audit my website <ArrowRight size={16} />
                </Link>
                <a href="#services" className="btn border border-white/15 px-5 py-3 text-white hover:bg-white/[.07]">
                  See what we cover
                </a>
              </div>
              <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-white/45">
                <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={13} className="text-mint-300" /> Free first audit</span>
                <span className="inline-flex items-center gap-1.5"><Lock size={13} className="text-mint-300" /> Your data stays yours</span>
                <span className="inline-flex items-center gap-1.5"><Zap size={13} className="text-mint-300" /> Real PageSpeed measurements</span>
              </div>
            </div>

            {/* Product preview */}
            <div className="relative">
              <div className="absolute -inset-6 rounded-[28px] bg-gradient-to-br from-mint-400/20 via-sky-400/10 to-transparent blur-2xl" />
              <div className="relative rounded-2xl border border-white/12 bg-ink-800/80 p-3 shadow-lift backdrop-blur">
                <div className="rounded-xl bg-[#F6F8FC] p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-500">Website health</p>
                      <p className="mt-0.5 text-[14px] font-semibold text-ink-900">kavericrafts.in</p>
                    </div>
                    <span className="chip bg-mint-50 text-mint-700">completed</span>
                  </div>
                  <div className="mt-4 flex items-end gap-4">
                    <div className="relative grid h-[86px] w-[86px] place-items-center rounded-full" style={{ background: 'conic-gradient(#0E9673 0 74%, #E7ECF4 74% 100%)' }}>
                      <div className="grid h-[66px] w-[66px] place-items-center rounded-full bg-white">
                        <span className="font-display text-[24px] font-semibold text-ink-900">74</span>
                      </div>
                    </div>
                    <div className="flex-1 space-y-2">
                      {[['Performance', 46, '#C2760A'], ['SEO', 83, '#2E55C8'], ['Accessibility', 71, '#2E55C8'], ['Best practices', 92, '#0E9673']].map(([l, v, c]) => (
                        <div key={l as string}>
                          <div className="flex justify-between text-[10.5px] text-ink-500"><span>{l}</span><span className="font-semibold text-ink-800">{v}</span></div>
                          <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-ink-900/10">
                            <div className="h-full rounded-full" style={{ width: `${v}%`, background: c as string }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4 rounded-lg border border-ink-900/[.07] bg-white p-2.5">
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-500"><Zap size={10} /> Priority fix</p>
                    <p className="mt-1 text-[11.5px] font-semibold leading-snug text-ink-900">Convert hero image to WebP — 1.4 MB saved</p>
                    <p className="mt-0.5 text-[10.5px] text-ink-500">Largest Contentful Paint 4.6s → est. 1.9s</p>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-5 -left-3 hidden rounded-xl border border-white/15 bg-ink-800/95 px-3.5 py-2.5 shadow-lift backdrop-blur sm:block">
                <p className="text-[10px] uppercase tracking-wider text-white/40">This month</p>
                <p className="text-[13px] font-semibold text-white">12 issues fixed <span className="text-mint-300">+18 pts</span></p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="border-b border-ink-900/[.07] bg-white">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-8 sm:grid-cols-4 lg:px-8">
          {[['Built for', 'Indian SMBs & agencies'], ['Measured with', 'Google Lighthouse'], ['Delivered as', 'Portal + branded PDF'], ['Backed by', 'Named ops engineers']].map(([k, v]) => (
            <div key={k}>
              <p className="text-[10.5px] font-semibold uppercase tracking-[.14em] text-ink-500">{k}</p>
              <p className="mt-1 text-[14px] font-semibold text-ink-900">{v}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Problem */}
      <section className="mx-auto max-w-6xl px-5 py-16 lg:px-8 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-mint-700">The gap after launch</p>
            <h2 className="mt-2.5 font-display text-[30px] font-semibold leading-tight tracking-[-.025em] text-ink-900 sm:text-[36px]">
              Building the website was the easy part.
            </h2>
            <p className="mt-4 text-[14.5px] leading-relaxed text-ink-600">
              AI builders and freelancers get you online in a weekend. Six months later the homepage takes
              five seconds to load, images are unoptimised, meta tags are missing, and nobody on the team
              knows what to fix — or in what order. Meanwhile every slow page quietly costs enquiries.
            </p>
            <p className="mt-3 text-[14.5px] leading-relaxed text-ink-600">
              SiteOps fills that gap with a repeatable technical operations process, not a one-time PDF.
            </p>
            <Link to="/register" className="btn-ghost mt-6">Start with a free audit <ArrowRight size={15} /></Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { icon: MousePointerClick, t: 'Visitors leave', d: 'Every extra second of load time measurably reduces conversions.' },
              { icon: Search, t: 'Search engines pass you by', d: 'Missing metadata and crawl issues cap how you rank.' },
              { icon: Lock, t: 'Accessibility excluded', d: 'Contrast and labels are legal exposure, not a nice-to-have.' },
              { icon: Code2, t: 'Nobody owns it', d: 'No retainer, no monitoring — issues wait until a customer complains.' },
            ].map((c) => (
              <div key={c.t} className="card card-pad">
                <c.icon size={18} className="text-ink-500" />
                <p className="mt-3 text-[14px] font-semibold text-ink-900">{c.t}</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-500">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="scroll-mt-20 border-y border-ink-900/[.07] bg-[#F6F8FC]">
        <div className="mx-auto max-w-6xl px-5 py-16 lg:px-8 lg:py-20">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-mint-700">What we do</p>
            <h2 className="mt-2.5 font-display text-[30px] font-semibold tracking-[-.025em] text-ink-900 sm:text-[36px]">
              A full operations layer for the website you already have
            </h2>
            <p className="mt-3 text-[14.5px] leading-relaxed text-ink-600">
              Six services that cover the technical work after launch — measured, documented and repeatable.
            </p>
          </div>
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <div key={s.title} className="card card-pad transition hover:-translate-y-0.5 hover:shadow-lift">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink-900 text-mint-300"><s.icon size={19} /></span>
                <h3 className="mt-4 text-[15px] font-semibold text-ink-900">{s.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-500">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-20 mx-auto max-w-6xl px-5 py-16 lg:px-8 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:gap-16">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-mint-700">Process</p>
            <h2 className="mt-2.5 font-display text-[30px] font-semibold tracking-[-.025em] text-ink-900 sm:text-[36px]">
              Four steps, no jargon
            </h2>
            <p className="mt-3 text-[14.5px] leading-relaxed text-ink-600">
              You don't need to understand Core Web Vitals to get value out of SiteOps. We translate
              measurements into decisions.
            </p>
            <div className="mt-6 rounded-xl border border-ink-900/[.07] bg-[#F6F8FC] p-4">
              <p className="text-[12.5px] font-semibold text-ink-900">Built for the AI-built era</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-500">
                Sites generated by AI tools tend to be beautiful and heavy. Our audits specifically rank the
                fixes that recover the most speed per hour of work.
              </p>
            </div>
          </div>
          <ol className="relative space-y-5 border-l border-ink-900/10 pl-7">
            {steps.map((s) => (
              <li key={s.n} className="relative">
                <span className="absolute -left-[38px] top-1 grid h-6 w-6 place-items-center rounded-full bg-ink-900 text-[10.5px] font-bold text-mint-300">{s.n}</span>
                <h3 className="text-[15px] font-semibold text-ink-900">{s.title}</h3>
                <p className="mt-1 text-[13.5px] leading-relaxed text-ink-500">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Product strip */}
      <section className="border-y border-ink-900/[.07] bg-ink-900">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 lg:grid-cols-3 lg:px-8">
          {[
            { icon: Layers, t: 'One account, three surfaces', d: 'The portal, the admin console and the Android/iOS app share the same accounts, websites and reports.' },
            { icon: Mail, t: 'Reports you can forward', d: 'Every audit produces a branded PDF. Send it to a client, a founder or a developer in one click.' },
            { icon: ShieldCheck, t: 'Isolation by default', d: 'Customers see only their own data. Admin access is database-controlled, never a frontend toggle.' },
          ].map((f) => (
            <div key={f.t} className="flex gap-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/12 bg-white/[.06] text-mint-300"><f.icon size={19} /></span>
              <div>
                <p className="text-[14.5px] font-semibold text-white">{f.t}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-white/50">{f.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-20 mx-auto max-w-6xl px-5 py-16 lg:px-8 lg:py-20">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-mint-700">Plans</p>
          <h2 className="mt-2.5 font-display text-[30px] font-semibold tracking-[-.025em] text-ink-900 sm:text-[36px]">Start free, scale to a retainer</h2>
          <p className="mt-3 text-[14.5px] leading-relaxed text-ink-600">
            Every account includes unlimited report history. Retainers are quoted after the first audit so
            the scope is based on real findings, not guesswork.
          </p>
        </div>
        <div className="mt-9 grid gap-4 lg:grid-cols-3">
          <div className="card card-pad flex flex-col">
            <p className="text-[13px] font-semibold text-ink-900">Starter</p>
            <p className="mt-1 text-[12px] text-ink-500">For a business with one site</p>
            <p className="mt-4 font-display text-[30px] font-semibold text-ink-900">Free</p>
            <ul className="mt-4 flex-1 space-y-2 text-[13px] text-ink-600">
              {['1 website', 'First audit free', 'Mobile & desktop audits', 'PDF report downloads', 'Portal and mobile app access'].map((i) => (
                <li key={i} className="flex gap-2"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-mint-600" />{i}</li>
              ))}
            </ul>
            <Link to="/register" className="btn-ghost mt-5 w-full">Create account</Link>
          </div>
          <div className="relative flex flex-col rounded-2xl border border-ink-900 bg-ink-900 p-5 text-white shadow-lift sm:p-6">
            <span className="absolute right-4 top-4 rounded-full bg-mint-400/15 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-mint-300">Popular</span>
            <p className="text-[13px] font-semibold">Growth</p>
            <p className="mt-1 text-[12px] text-white/50">For a growing site or small agency</p>
            <p className="mt-4 font-display text-[30px] font-semibold">₹2,499<span className="text-[13px] font-normal text-white/50"> /mo</span></p>
            <ul className="mt-4 flex-1 space-y-2 text-[13px] text-white/70">
              {['Up to 5 websites', '4 audits per site monthly', 'Score trend tracking', 'Email report delivery', 'Priority fix guidance', 'Named support contact'].map((i) => (
                <li key={i} className="flex gap-2"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-mint-300" />{i}</li>
              ))}
            </ul>
            <a href="mailto:support@siteops.in?subject=SiteOps%20Growth%20plan" className="btn-accent mt-5 w-full">Talk to us</a>
          </div>
          <div className="card card-pad flex flex-col">
            <p className="text-[13px] font-semibold text-ink-900">Managed ops</p>
            <p className="mt-1 text-[12px] text-ink-500">For teams who want it handled</p>
            <p className="mt-4 font-display text-[30px] font-semibold text-ink-900">Custom</p>
            <ul className="mt-4 flex-1 space-y-2 text-[13px] text-ink-600">
              {['Everything in Growth', 'We implement the fixes', 'Ongoing maintenance window', 'Regression monitoring', 'Monthly operations review', 'Agency white-label reporting'].map((i) => (
                <li key={i} className="flex gap-2"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-mint-600" />{i}</li>
              ))}
            </ul>
            <a href="mailto:support@siteops.in?subject=SiteOps%20managed%20operations" className="btn-primary mt-5 w-full">Request a quote</a>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 border-t border-ink-900/[.07] bg-[#F6F8FC]">
        <div className="mx-auto max-w-3xl px-5 py-16 lg:px-8 lg:py-20">
          <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-mint-700">Questions</p>
          <h2 className="mt-2.5 font-display text-[30px] font-semibold tracking-[-.025em] text-ink-900 sm:text-[34px]">Straight answers</h2>
          <div className="mt-7 divide-y divide-ink-900/[.08] border-y border-ink-900/[.08]">
            {faqs.map(([q, a]) => (
              <details key={q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[14.5px] font-semibold text-ink-900">
                  {q}
                  <ChevronRight size={16} className="shrink-0 text-ink-500 transition group-open:rotate-90" />
                </summary>
                <p className="mt-2.5 pr-6 text-[13.5px] leading-relaxed text-ink-600">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-ink-900">
        <div className="grid-noise absolute inset-0 opacity-70" />
        <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-6 px-5 py-14 sm:flex-row sm:items-center lg:px-8">
          <BrandMark />
          <div className="flex-1">
            <h2 className="font-display text-[24px] font-semibold tracking-[-.02em] text-white sm:text-[28px]">Find out what your website is costing you.</h2>
            <p className="mt-1.5 text-[13.5px] text-white/55">Register a site and request your first audit in under two minutes.</p>
          </div>
          <Link to="/register" className="btn-accent px-5 py-3">Create your account <ArrowRight size={16} /></Link>
        </div>
      </section>

      <FooterLinks />
      <div className="sr-only"><BarChart3 /> <Rocket /> <Globe2 /></div>
    </div>
  )
}
