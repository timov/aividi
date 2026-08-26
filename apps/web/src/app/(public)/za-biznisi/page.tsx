import Link from 'next/link'
import type { Metadata } from 'next'
import {
  KARMA_LABELS,
  KARMA_WEIGHTS,
  MODIFIERS,
  SCORE_LABELS,
  SCORE_WEIGHTS,
} from '@aividi/core'
import { AiTag } from '@/components/Ai'
import { Icon } from '@/components/Icon'
import { Seal } from '@/components/Seal'
import { buildMeta } from '@/lib/seo'

export const metadata: Metadata = buildMeta({
  title: 'За бизниси — AIVIDI Score и Карма',
  description:
    'Две оценки, две различни прашања: колку е комплетен профилот и што вели јавноста. Целата формула е јавна, заедно со рангирањата на кои се појавуваш и што значи спонзорирано место.',
  path: '/za-biznisi',
})

/**
 * The page that makes the whole model legible to the people it is about.
 *
 * It exists for one reason: a business that understands the scores will send
 * us better data to raise the one it controls, and that data is the moat. So
 * both formulas are published in full, the line between the ranking and paid
 * placement is stated plainly rather than buried, and the ranking surfaces are
 * enumerated from MODIFIERS so this page cannot drift out of date when a new
 * facet ships.
 */
export default function ForBusinessesPage() {
  const scoreKeys = Object.keys(SCORE_WEIGHTS) as Array<keyof typeof SCORE_WEIGHTS>
  const karmaKeys = Object.keys(KARMA_WEIGHTS) as Array<keyof typeof KARMA_WEIGHTS>
  const modifiers = Object.values(MODIFIERS)

  return (
    <>
      <section className="hero" style={{ textAlign: 'left' }}>
        <span className="hero-shape s2" aria-hidden="true" />
        <span className="hero-shape s3" aria-hidden="true" />
        <div className="container">
          <h1 style={{ maxWidth: '20ch', marginInline: 0 }}>Две оценки, две различни прашања</h1>
          <p className="lede" style={{ marginInline: 0 }}>
            <strong>AIVIDI Score</strong> мери колку е комплетен и свеж твојот профил — целосно
            во твои раце, и бесплатен за подигање. <strong>Карма</strong> мери што мисли
            јавноста за тебе. Ниту едната не се купува, и намерно не ги мешаме.
          </p>
          <div className="record-meterline" style={{ marginTop: 22 }}>
            <Seal variant="score" score={84} size={56} />
            <Seal variant="karma" score={91} size={56} />
            <span className="muted">комплетен профил, силна јавна репутација</span>
          </div>
        </div>
      </section>

      {/* ---- the score you control ---------------------------------------- */}
      <section className="section">
        <div className="container" style={{ maxWidth: 820 }}>
          <h2>AIVIDI Score: колку е комплетен профилот</h2>
          <p className="lede">
            Чиста аритметика врз полиња на кои можеме да покажеме. Никаков модел, никакво
            мислење — затоа целата формула стои тука, и секој дел можеш да го подигнеш сам.
          </p>

          <ul className="score-bars" style={{ marginTop: 24 }}>
            {scoreKeys.map((k) => (
              <li key={k}>
                <span className="score-bar-label">{SCORE_LABELS[k]}</span>
                <span className="score-bar">
                  <span style={{ width: '100%' }} />
                </span>
                <span className="score-bar-val">{SCORE_WEIGHTS[k]} поени</span>
              </li>
            ))}
          </ul>

          <div className="factcards" style={{ marginTop: 30 }}>
            <div className="factcard">
              <span className="ic">
                <Icon name="phone" size={20} />
              </span>
              <div>
                <b>Најбрзиот начин: јави се и потврди ги податоците</b>
                <span>
                  Проверка по телефон носи најмногу поени и трае неколку минути. Свежината на
                  проверката опаѓа со време, па затоа профилите што се одржуваат стојат погоре.
                </span>
              </div>
            </div>
            <div className="factcard">
              <span className="ic">
                <Icon name="check" size={20} />
              </span>
              <div>
                <b>Додај услуги со цени</b>
                <span>
                  Речиси никој во Македонија не објавува цени. Тоа е делот што најмногу им
                  помага на луѓето да се одлучат — и делот што најмногу го подига резултатот.
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- the score you earn ------------------------------------------- */}
      <section className="section karma-section">
        <div className="container" style={{ maxWidth: 820 }}>
          <AiTag size="lg" />
          <h2 style={{ marginTop: 14 }}>Карма: што вели јавноста за тебе</h2>
          <p className="lede">
            Кармата не е препишан просек од ѕвездички. Тоа е излез од анализа на сентимент над
            целиот јавно достапен разговор околу твојот бизнис — оценките се само едниот влез.
          </p>

          <ol className="pipeline">
            <li>
              <span className="pipeline-step">01</span>
              <b>Собирање сигнали</b>
              <span>
                Јавни оценки и нивниот обем, повторливи теми во тоа што луѓето пишуваат, тонот
                на спомнувањата, и оценките оставени директно кај нас.
              </span>
            </li>
            <li>
              <span className="pipeline-step">02</span>
              <b>Анализа на сентимент</b>
              <span>
                Сигналите се класифицираат по поларитет и по тема, за да се раздвои „храната е
                одлична, чекањето е долго“ на две одделни работи наместо на еден просек.
              </span>
            </li>
            <li>
              <span className="pipeline-step">03</span>
              <b>Тежинско мерење</b>
              <span>
                Обемот влегува по логаритамска крива — триесет мислења кажуваат многу повеќе од
                три, а триста само малку повеќе од триесет. Посвежите сигнали тежат повеќе.
              </span>
            </li>
            <li>
              <span className="pipeline-step">04</span>
              <b>Дестилација</b>
              <span>
                Излегува еден број од 100 и резиме напишано со наши зборови. Не препишуваме
                туѓи рецензии — го објавуваме заклучокот, не текстот.
              </span>
            </li>
          </ol>

          <ul className="score-bars" style={{ marginTop: 30 }}>
            {karmaKeys.map((k) => (
              <li key={k}>
                <span className="score-bar-label">{KARMA_LABELS[k]}</span>
                <span className="score-bar">
                  <span className="karma-fill" style={{ width: '100%' }} />
                </span>
                <span className="score-bar-val">{KARMA_WEIGHTS[k]} поени</span>
              </li>
            ))}
          </ul>

          <p className="score-note" style={{ marginTop: 18 }}>
            Кармата не можеш да ја подигнеш кај нас — само кај своите клиенти. Тоа е причината
            зошто ја водиме одвоено од AIVIDI Score: беспрекорен профил на слаб бизнис не смее
            да позајмува доверба, ниту сакана кафеана со тенок профил да изгледа полошо
            отколку што е.
          </p>
        </div>
      </section>

      {/* ---- where you show up -------------------------------------------- */}
      <section className="section" style={{ background: 'var(--sunk)' }}>
        <div className="container" style={{ maxWidth: 900 }}>
          <h2>Рангирања на кои се појавуваш</h2>
          <p className="lede">
            Секој град и секоја категорија носат повеќе рангирања, а секое одговара на различно
            прашање. Влегуваш во нив автоматски — но само ако податокот што го бараат постои во
            твојот профил. Примерите подолу се за пицерии во Струмица.
          </p>

          <div className="rank-types">
            {modifiers.map((m) => (
              <div key={m.slug} className="rank-type">
                <code>/{m.slug}</code>
                <b>{m.title('Пицерии', 'Струмица')}</b>
                <span>{m.dimension}</span>
                <span className="rank-type-need">
                  {m.requiresPricedServices
                    ? 'Бара: барем една услуга со цена'
                    : m.requiresWeekend
                      ? 'Бара: внесено работно време за сабота или недела'
                      : m.requiresAttribute
                        ? `Бара: означено „${m.requiresAttribute}“ во профилот`
                        : 'Бара: објавен профил'}
                </span>
              </div>
            ))}
          </div>

          <p className="score-note" style={{ marginTop: 22 }}>
            Рангирањето внатре во листата го одредува само AIVIDI Score. Празно поле те вади од
            цела листа — затоа најевтиното подигање е да ги пополниш работното време, цените и
            ознаките.
          </p>
        </div>
      </section>

      {/* ---- the paid line ------------------------------------------------- */}
      <section className="section">
        <div className="container" style={{ maxWidth: 820 }}>
          <h2>Што е спонзорирано место</h2>
          <p>
            Спонзорираното место е обележано место <strong>над</strong> листата. Го плаќаш и го
            добиваш — точно, предвидливо, без ветувања за позиција.
          </p>
          <p>
            Она што <strong>не</strong> го купуваш е редоследот под него. Организското
            рангирање го одредува само AIVIDI Score, спонзорираните места не влегуваат во
            податоците што ги читаат пребарувачите, и на Кармата не може да се влијае со пари
            во ниту еден случај. Ако некој ти вети позиција во листата за пари — не сме ние.
          </p>
          <p style={{ marginBottom: 0 }}>
            <Link className="call" href="/prijavi" style={{ display: 'inline-flex' }}>
              Преземи го профилот
            </Link>
          </p>
        </div>
      </section>
    </>
  )
}
