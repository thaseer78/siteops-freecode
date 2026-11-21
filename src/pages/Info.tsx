import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Logo } from '../components/Brand'
import { FooterLinks } from '../components/Brand'

/* Simple legal / company pages. The structure is real; the content is a TODO
   placeholder so nothing here reads as a binding policy or invented fact. */

interface InfoPageProps {
  eyebrow: string
  title: string
  intro: string
  sections: Array<{ heading: string; body: string }>
}

function InfoPage({ eyebrow, title, intro, sections }: InfoPageProps) {
  return (
    <div className="min-h-screen bg-obsidian">
      <header className="border-b border-white/[.08]">
        <div className="shell flex h-16 items-center justify-between">
          <Link to="/" aria-label="SiteOps home"><Logo light /></Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[14px] font-medium text-[#C4C2CE] transition-colors hover:text-white"
          >
            <ArrowLeft size={15} /> Back to site
          </Link>
        </div>
      </header>

      <main className="shell max-w-3xl py-14 lg:py-20">
        <span className="eyebrow-dark">{eyebrow}</span>
        <h1 className="mt-5 font-display text-[34px] font-bold leading-[1.1] tracking-[-.03em] text-white sm:text-[44px]">
          {title}
        </h1>
        <p className="mt-4 text-[16px] leading-relaxed on-dark-body">{intro}</p>

        <div className="mt-8 rounded-2xl border border-dashed border-white/25 bg-white/[.04] p-5">
          <p className="text-[14px] leading-relaxed on-dark-body">
            <span className="font-semibold text-[#C4B5FD]">TODO</span> — this page needs the final approved
            wording, and a legal review before it goes live. The structure below is the intended section
            outline.
          </p>
        </div>

        <div className="mt-10 space-y-8">
          {sections.map((s) => (
            <section key={s.heading}>
              <h2 className="text-[18px] font-semibold text-white">{s.heading}</h2>
              <p className="mt-2 text-[15px] leading-relaxed on-dark-body">{s.body}</p>
            </section>
          ))}
        </div>

        <p className="mt-10 text-[14px] leading-relaxed on-dark-muted">
          Questions about this page?{' '}
          <a href="mailto:support@siteops.in" className="font-semibold text-[#C4B5FD] underline-offset-4 hover:underline">
            support@siteops.in
          </a>
        </p>
      </main>

      <FooterLinks />
    </div>
  )
}

export function PrivacyPage() {
  return (
    <InfoPage
      eyebrow="Legal"
      title="Privacy policy"
      intro="What SiteOps collects, why we collect it, and how you can get it removed."
      sections={[
        { heading: 'What we collect', body: 'TODO: account details, website URLs you submit, audit results generated from those URLs, and delivery logs for reports you ask us to email.' },
        { heading: 'Why we hold it', body: 'TODO: to run audits, keep your report history, and email reports you explicitly request.' },
        { heading: 'Who can see it', body: 'TODO: your account only sees its own websites and reports. Staff access is restricted and recorded.' },
        { heading: 'Your choices', body: 'TODO: request a copy or deletion of your data, and how long we retain it.' },
      ]}
    />
  )
}

export function TermsPage() {
  return (
    <InfoPage
      eyebrow="Legal"
      title="Terms of service"
      intro="The agreement between you and SiteOps when you use the product."
      sections={[
        { heading: 'The service', body: 'TODO: audits run through Google PageSpeed Insights; results are measurements, not guarantees of ranking or performance outcomes.' },
        { heading: 'Your responsibilities', body: 'TODO: you must own or be authorised to audit the websites you submit.' },
        { heading: 'What we do not do', body: 'TODO: we do not claim security certification, penetration testing, or guaranteed score improvements.' },
        { heading: 'Billing', body: 'TODO: plan terms, GST treatment, renewal and cancellation.' },
      ]}
    />
  )
}

export function RefundPage() {
  return (
    <InfoPage
      eyebrow="Legal"
      title="Refund policy"
      intro="When a SiteOps subscription can be refunded, and how to ask."
      sections={[
        { heading: 'Free tier', body: 'TODO: state the free-tier limits and whether any part of it is refundable (it is not paid, so likely not applicable).' },
        { heading: 'Paid plans', body: 'TODO: refund window, pro-rata rules, and what happens if an audit cannot be completed.' },
        { heading: 'How to request', body: 'TODO: the email address and expected response time for refund requests.' },
      ]}
    />
  )
}

export function AboutPage() {
  return (
    <InfoPage
      eyebrow="Company"
      title="About SiteOps"
      intro="SiteOps keeps business websites fast, searchable and maintained after launch day."
      sections={[
        { heading: 'Why we exist', body: 'AI builders and freelancers get businesses online quickly. Keeping the site fast and healthy months later is the gap SiteOps fills.' },
        { heading: 'How we work', body: 'Real Lighthouse measurements, prioritised fixes in plain language, and a repeatable operations process rather than a one-off PDF.' },
        { heading: 'The company', body: 'TODO: legal entity name, founding year, team details, registered address and GSTIN.' },
      ]}
    />
  )
}

export function ContactPage() {
  return (
    <InfoPage
      eyebrow="Support"
      title="Contact us"
      intro="Questions about a report, a plan, or a site you want audited."
      sections={[
        { heading: 'Email', body: 'support@siteops.in — TODO: confirm this is the monitored inbox and the expected reply time.' },
        { heading: 'Phone', body: 'TODO: support phone number and hours, if one is offered.' },
        { heading: 'Registered address', body: 'TODO: company name, street address, city, PIN code and GSTIN.' },
      ]}
    />
  )
}
