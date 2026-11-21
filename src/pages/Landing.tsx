import { ScrollProgress } from '../components/landing/motion'
import LandingNav from '../components/landing/LandingNav'
import Hero from '../components/landing/Hero'
import StatsStrip from '../components/landing/StatsStrip'
import Advantage from '../components/landing/Advantage'
import HowItWorks from '../components/landing/HowItWorks'
import SocialProof from '../components/landing/SocialProof'
import Pricing from '../components/landing/Pricing'
import FaqSection from '../components/landing/FaqSection'
import { FooterLinks } from '../components/Brand'

/**
 * Landing page.
 *
 * Section order is unchanged from the original build:
 * nav → hero → stats → advantage/features → how it works → pricing → FAQ + CTA
 * → footer, with the sample-report block inserted between "how it works" and
 * pricing as the social-proof step.
 *
 * All motion is CSS + IntersectionObserver (see components/landing/motion.tsx)
 * and collapses to a static page under `prefers-reduced-motion`.
 */
export default function Landing() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-obsidian">
      <ScrollProgress />
      <a
        href="#main"
        className="sr-only rounded-b-lg bg-primary-600 px-4 py-2 text-[14px] font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-0 focus:z-[70]"
      >
        Skip to content
      </a>
      <LandingNav />
      <main id="main">
        <Hero />
        <StatsStrip />
        <Advantage />
        <HowItWorks />
        <SocialProof />
        <Pricing />
        <FaqSection />
      </main>
      <FooterLinks />
    </div>
  )
}
