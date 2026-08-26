import type { Metadata } from 'next'
import { buildMeta } from '@/lib/seo'

export const metadata: Metadata = buildMeta({
  title: 'Пријави исправка или бришење на профил',
  description:
    'Побарај исправка на податоци или целосно бришење на профил од aividi.mk. Одговараме и постапуваме во рок од 5 работни дена, без враќање при следно ажурирање.',
  path: '/prijavi',
})

/**
 * The removal / correction route.
 *
 * Macedonia's data protection law is GDPR-aligned, and a directory without a
 * working removal path is a reputational problem waiting to happen. This costs
 * nothing to offer and it has to exist from day one, not after the first
 * complaint.
 *
 * TODO: replace the mailto with a real form once there is somewhere to put the
 * submissions and someone watching the queue.
 */
export default function ReportPage() {
  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <h1 style={{ marginTop: 34 }}>Пријави исправка или бришење</h1>
      <p className="lede">
        Податоците ги собираме од јавни извори и од самите бизниси, па некои работи може да
        бидат застарени или погрешни. Пиши ни и ќе исправиме.
      </p>

      <section className="section" style={{ marginTop: 26 }}>
        <h2>Што да напишеш</h2>
        <ul style={{ paddingLeft: '1.2em', margin: 0 }}>
          <li>Име на бизнисот и линк до страницата на aividi.mk</li>
          <li>Што е погрешно и што е точно</li>
          <li>Твое име и телефон, за да можеме да потврдиме</li>
        </ul>
      </section>

      <section className="section">
        <h2>Сакаш профилот да биде отстранет?</h2>
        <p style={{ marginBottom: 0 }}>
          Напиши „бришење“ во насловот. Профилот го отстрануваме во рок од{' '}
          <strong>5 работни дена</strong> и не го враќаме назад при следно ажурирање.
        </p>
      </section>

      <p style={{ marginTop: 22 }}>
        <a
          className="call"
          href="mailto:kontakt@aividi.mk?subject=Исправка%20на%20податоци"
          style={{ display: 'inline-flex' }}
        >
          Пиши на kontakt@aividi.mk
        </a>
      </p>
    </div>
  )
}
