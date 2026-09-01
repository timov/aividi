import Link from 'next/link'
import type { Metadata } from 'next'
import { Golos_Text, Wix_Madefor_Display } from 'next/font/google'
import '../public.css'
import { Logo } from '@/components/Brand'
import { Icon } from '@/components/Icon'
import { MobileNav } from '@/components/MobileNav'
import { SITE_URL, IS_INDEXABLE, SOCIAL_LINKS } from '@/lib/seo'

/**
 * Two faces, both checked glyph by glyph against the Macedonian alphabet.
 *
 * That check is not paranoia: plenty of typefaces advertise "Cyrillic" while
 * covering only Russian, and Macedonian needs Ѓ ѓ Ќ ќ Ѕ ѕ Љ љ Њ њ Џ џ Ј ј on
 * top of it. A face missing those renders tofu boxes in half the business
 * names in Strumica and you would not notice until someone complained.
 *
 * Golos Text is Paratype's screen-text face, drawn for Cyrillic rather than
 * extended into it — which is why running text feels settled in a way a
 * Latin-first geometric never quite does. Wix Madefor Display carries the
 * headlines: enough character in the terminals to stop the page reading as a
 * default, without the quirk fighting the data.
 */
const display = Wix_Madefor_Display({
  subsets: ['latin', 'cyrillic-ext', 'cyrillic'],
  weight: ['600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
})

const text = Golos_Text({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-text',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'aividi.mk — водич низ бизнисите во Македонија',
    template: '%s | aividi.mk',
  },
  description:
    'Што работат, колку чинат, кога се отворени и што велат луѓето — за бизнисите низ Македонија. Две оценки за секој профил: AIVIDI Score за комплетноста и Карма од AI анализа на јавниот сентимент.',
  robots: IS_INDEXABLE ? { index: true, follow: true } : { index: false, follow: false },
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`public-root ${text.variable} ${display.variable}`}>
      <a className="skip" href="#main">
        Прескокни на содржината
      </a>

      <header className="site-header">
        <div className="container inner">
          <Logo size="md" />
          <MobileNav />
        </div>
      </header>

      <main id="main">{children}</main>

      <footer className="site-footer">
        <div className="container">
          <div className="footer-top">
            <div>
              <p style={{ marginBottom: 6 }}>
                <strong>aividi.mk</strong>
              </p>
              <p style={{ margin: 0 }}>
                Водич низ бизнисите во Македонија — што работат, колку чинат и што велат луѓето.
              </p>
              <div className="footer-social">
                <a
                  href={SOCIAL_LINKS.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="aividi.mk на Instagram"
                >
                  <Icon name="instagram" size={18} />
                </a>
                <a
                  href={SOCIAL_LINKS.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="aividi.mk на LinkedIn"
                >
                  <Icon name="linkedin" size={18} />
                </a>
              </div>
            </div>
            <div>
              <p style={{ marginBottom: 6 }}>
                <strong>За посетители</strong>
              </p>
              <p style={{ margin: 0 }}>
                <Link href="/">Сите градови</Link>
                <br />
                <Link href="/prebaraj">Пребарување</Link>
              </p>
            </div>
            <div>
              <p style={{ marginBottom: 6 }}>
                <strong>За бизниси</strong>
              </p>
              <p style={{ margin: 0 }}>
                <Link href="/za-biznisi">Како работи AIVIDI Score</Link>
                <br />
                <Link href="/prijavi">Пријави исправка или бришење</Link>
              </p>
            </div>
          </div>
          <p className="small" style={{ margin: 0 }}>
            Дел од податоците за локации потекнуваат од{' '}
            <a href="https://www.openstreetmap.org/copyright" rel="nofollow">
              OpenStreetMap
            </a>{' '}
            (ODbL).
          </p>
        </div>
      </footer>
    </div>
  )
}
