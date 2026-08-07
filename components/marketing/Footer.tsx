import Image from 'next/image'
import Link from 'next/link'

const footerLinks = {
  product: [
    { label: 'Home', href: '/' },
    { label: 'Pricing', href: '/pricing' },
  ],
  resources: [
    { label: 'Help Center', href: '/help' },
  ],
  legal: [
    { label: 'Privacy', href: '/privacy-policy' },
    { label: 'Terms', href: '/terms-of-service' },
    { label: 'Cookies', href: '/cookie-policy' },
    { label: 'GDPR', href: '/gdpr' },
  ],
}

export function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-3 lg:grid-cols-6">
          <div className="col-span-2">
            <Link href="/" className="mb-4 flex items-center">
              <Image
                src="/brand/logo/logo-horizontal-dark.svg"
                alt="FleetFlow"
                width={160}
                height={32}
                className="h-8 w-auto"
              />
            </Link>
            <p className="max-w-xs text-sm text-slate-400">
              Modern fleet management software for delivery services, logistics, and transportation companies.
            </p>
          </div>

          {Object.entries(footerLinks).map(([section, links]) => (
            <div key={section}>
              <h4 className="mb-4 font-semibold capitalize text-white">{section}</h4>
              <ul className="space-y-3 text-sm">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="transition-colors hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-800">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} FleetFlow. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
