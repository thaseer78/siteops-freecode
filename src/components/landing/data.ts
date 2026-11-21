import {
  FileText,
  Layers,
  Lock,
  Mail,
  ScanLine,
  Search,
  Server,
  ShieldCheck,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react'

/* ── Landing content ────────────────────────────────────────────────────────
   Copy lives here so the layout components stay readable. Anything we cannot
   verify is written as a visible `TODO` placeholder rather than an invented
   number, testimonial or company detail.                                      */

export const PLACEHOLDER = 'TODO'

export interface FeatureCard {
  icon: LucideIcon
  title: string
  body: string
  /** Bento emphasis: `wide` cards span two columns on desktop. */
  span?: 'wide'
}

/* Seven cards that fill a 3×3 desktop bento exactly: wide + 1, 1 + wide, 1 + 1 + 1. */
export const featureCards: FeatureCard[] = [
  {
    icon: ScanLine,
    title: 'Website audit',
    body: 'Mobile and desktop Lighthouse runs, with every score traceable to Google PageSpeed Insights.',
    span: 'wide',
  },
  {
    icon: Lock,
    title: 'Security checks',
    body: 'Header, transport and trust-signal checks — reported honestly, without claiming a certification we do not hold.',
  },
  {
    icon: Zap,
    title: 'Performance boost',
    body: 'Fixes ranked by impact, so the first hour of developer time recovers the most speed.',
  },
  {
    icon: Server,
    title: 'Website operations',
    body: 'Scheduled audits, regression alerts and a named technical contact who knows your site.',
    span: 'wide',
  },
  {
    icon: Search,
    title: 'SEO diagnostics',
    body: 'Missing meta descriptions, crawl blockers and indexability problems that quietly cost you enquiries.',
  },
  {
    icon: Wrench,
    title: 'Repairs & optimisation',
    body: 'Our operators fix what the audit finds: image weight, render-blocking assets, layout shift, broken metadata.',
  },
  {
    icon: FileText,
    title: 'Report history',
    body: 'Every audit is archived, so you can compare scores over time and prove the impact of each round of fixes.',
  },
]

export const steps = [
  { n: 1, title: 'Sign up', body: 'Create your account in under a minute. No card and no code access needed.' },
  { n: 2, title: 'Add your website', body: 'Drop in the URL you run your business on. No DNS changes required.' },
  { n: 3, title: 'Get your report', body: 'Mobile and desktop scores, measured metrics and prioritised fixes.' },
  { n: 4, title: 'Fix & improve', body: 'Work through the list, re-audit, and watch the trend line move.' },
]

export const stepHighlights = [
  {
    icon: Layers,
    title: 'One account, three surfaces',
    body: 'Portal, admin console and mobile app share the same accounts, websites and reports.',
  },
  {
    icon: Mail,
    title: 'Reports you can forward',
    body: 'Every audit produces a branded PDF you can send to a client or a developer.',
  },
  {
    icon: ShieldCheck,
    title: 'Your data is kept separate from other customers',
    body: 'Each account only ever sees its own websites and reports. Admin access is database-controlled.',
  },
]

/**
 * Stats strip. The four cells are numeric metrics only — no "Real-time" or
 * "Expert" claims. Every value is a TODO until real measurements exist, so the
 * UI shows a placeholder instead of a fabricated figure.
 */
export interface StatItem {
  label: string
  /** Numeric value once known. `null` renders the TODO placeholder. */
  value: number | null
  prefix?: string
  suffix?: string
  decimals?: number
}

export const stats: StatItem[] = [
  { label: 'Audits completed', value: null },
  { label: 'Average score lift after fixes', value: null, prefix: '+', suffix: ' pts' },
  { label: 'Median LCP improvement', value: null, suffix: 's' },
  { label: 'Businesses served', value: null },
]

export const faqs = [
  [
    'Is this a website builder?',
    'No. SiteOps assumes you already have a website — from an AI builder, a freelancer, WordPress, Shopify or a custom team. We keep it fast, searchable, accessible and maintained.',
  ],
  [
    'Where do the scores come from?',
    'Google PageSpeed Insights, which runs Lighthouse. Every number in a SiteOps report is a real measurement from that API for your URL and device strategy. We never estimate or invent scores.',
  ],
  [
    'Do you do penetration testing?',
    'No. We do not claim security certification or vulnerability scanning. Our reports cover performance, SEO, accessibility and Lighthouse best practices, and say so explicitly.',
  ],
  [
    'How is the report delivered?',
    'It appears in your SiteOps portal immediately. Our team reviews it, then sends a branded PDF by email when you request delivery — with delivery status visible in the console.',
  ],
  [
    'Can I use this for client websites?',
    'Yes. Agencies and freelancers manage multiple websites and can share reports with their clients.',
  ],
  [
    'What if my site is built on AI tools like Framer or Lovable?',
    'Those sites benefit most. AI-generated sites often ship heavy images and missing metadata. A SiteOps audit tells you exactly what to change first.',
  ],
] as const

export interface Plan {
  name: string
  blurb: string
  /** Monthly price in INR. `null` means "Free" or "Custom". */
  monthly: number | null
  priceLabel: string
  unit?: string
  cta: string
  ctaHref: string
  features: string[]
  featured?: boolean
  note?: string
}

export const plans: Plan[] = [
  {
    name: 'Free',
    blurb: 'For one site, to see whether the reports are useful.',
    monthly: null,
    priceLabel: 'Free',
    cta: 'Get started',
    ctaHref: '/register',
    features: [
      '1 website',
      'First audit included',
      'Mobile and desktop audits',
      'PDF report download',
      'Portal access',
    ],
    note: 'TODO: confirm how long the free tier lasts and what it includes after the first audit.',
  },
  {
    name: 'Growth',
    blurb: 'For a growing site or a small agency managing a few clients.',
    monthly: 4499,
    priceLabel: '₹4,499',
    unit: '/mo',
    cta: 'Choose plan',
    ctaHref: 'mailto:support@siteops.in?subject=SiteOps%20Growth%20plan',
    features: [
      'Up to 5 websites',
      '4 audits per site each month',
      'Score trend tracking',
      'Email report delivery',
      'Priority fix guidance',
      'Named support contact',
    ],
    featured: true,
    note: 'Price excludes GST. TODO: confirm the annual price and any discount.',
  },
  {
    name: 'Custom',
    blurb: 'For teams that want the fixing and monitoring handled end to end.',
    monthly: null,
    priceLabel: 'Custom',
    cta: 'Talk to us',
    ctaHref: 'mailto:support@siteops.in?subject=SiteOps%20managed%20operations',
    features: [
      'Everything in Growth',
      'We implement the fixes',
      'Ongoing maintenance window',
      'Regression monitoring',
      'Monthly operations review',
      'Agency white-label reporting',
    ],
  },
]

/** Illustrative only — labelled as sample data wherever it is displayed. */
export const sampleScores: Array<[string, number, string]> = [
  ['Performance', 94, '#10B981'],
  ['Accessibility', 88, '#10B981'],
  ['SEO', 97, '#10B981'],
  ['Best Practices', 92, '#10B981'],
]

export const footerColumns = [
  {
    heading: 'Product',
    links: [
      { label: 'Services', href: '/#services' },
      { label: 'How it works', href: '/#how' },
      { label: 'Pricing', href: '/#pricing' },
      { label: 'FAQ', href: '/#faq' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' },
      { label: 'Customer sign in', href: '/login' },
      { label: 'Create account', href: '/register' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
      { label: 'Refund policy', href: '/refund' },
    ],
  },
]
