import { Link } from 'react-router-dom'
import { Logo } from '../components/Brand'

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#F6F8FC] px-5">
      <div className="text-center">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <p className="font-display text-[64px] font-semibold leading-none tracking-tight text-ink-900">404</p>
        <h1 className="mt-3 text-[18px] font-semibold text-ink-900">This page doesn’t exist</h1>
        <p className="mt-2 max-w-sm text-[13.5px] leading-relaxed text-ink-500">
          The link may be outdated, or the page may have moved. Your websites and reports are safe.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link to="/" className="btn-ghost">Back to site</Link>
          <Link to="/app" className="btn-primary">Open dashboard</Link>
        </div>
      </div>
    </div>
  )
}
