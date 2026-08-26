import { KARMA_LABELS, KARMA_WEIGHTS, karmaBand, SCORE_LABELS, SCORE_WEIGHTS } from '@aividi/core'
import { AiTag } from './Ai'
import { Seal } from './Seal'

/**
 * Score presentation.
 *
 * The number itself is drawn by the Seal — one mark for the whole brand, so
 * every business row carries the logo. What lives here is the panel that shows
 * the working behind the number, and the plaque a business prints.
 *
 * There used to be a five-segment meter alongside the seal. It was retired:
 * two devices for one value meant the mark competed with itself, and the
 * component bars below already show magnitude better than a bar chart of one.
 */

const BANDS: Array<[min: number, label: string]> = [
  [85, 'Одличен'],
  [70, 'Многу добар'],
  [50, 'Добар'],
  [30, 'Основен'],
  [0, 'Непотполн'],
]

export function scoreBand(score: number | null): string {
  if (score === null) return 'Нема оценка'
  return BANDS.find(([min]) => score >= min)?.[1] ?? 'Непотполн'
}

/**
 * The band's colour. Printing every band in green made a 19 look like a pass,
 * which is precisely the misreading the two-score split exists to prevent.
 */
export function bandTone(score: number | null): string {
  if (score === null) return 'band-ok'
  if (score >= 70) return ''
  return score >= 50 ? 'band-ok' : 'band-weak'
}

/**
 * The profile sidebar. Trustpilot puts a star distribution here; the honest
 * equivalent for a computed score is the components it was computed from —
 * which doubles as the to-do list for the business that wants it higher.
 */
export function ScorePanel({
  score,
  components,
}: {
  score: number | null
  components: Record<string, number> | null
}) {
  const keys = Object.keys(SCORE_WEIGHTS) as Array<keyof typeof SCORE_WEIGHTS>

  return (
    <div className="panel score-panel">
      <div className="score-head">
        <div>
          <span className="score-big">{score === null ? '—' : Math.round(score)}</span>
          <span className="score-outof">/100</span>
          <span className={`score-band ${bandTone(score)}`}>{scoreBand(score)}</span>
        </div>
        <Seal variant="score" score={score === null ? null : Math.round(score)} size={56} />
      </div>

      {components ? (
        <ul className="score-bars">
          {keys.map((k) => {
            const got = components[k] ?? 0
            const max = SCORE_WEIGHTS[k]
            return (
              <li key={k}>
                <span className="score-bar-label">{SCORE_LABELS[k]}</span>
                <span className="score-bar">
                  <span style={{ width: `${(got / max) * 100}%` }} />
                </span>
                <span className="score-bar-val">
                  {Math.round(got)}/{max}
                </span>
              </li>
            )
          })}
        </ul>
      ) : null}

      <p className="score-note">
        AIVIDI Score се пресметува од комплетноста на профилот, кога последно е проверен,
        услугите со цени и оценките. Не се купува.
      </p>
    </div>
  )
}

/** The printable version — the thing that goes in a shop window. */
export function ScorePlaque({ score, name }: { score: number | null; name: string }) {
  return (
    <div className="plaque">
      <Seal variant="score" score={score === null ? null : Math.round(score)} size={64} />
      <div className="plaque-text">
        <span className="plaque-brand">
          aividi<span>.</span>mk
        </span>
        <span className="plaque-name">{name}</span>
        <span className="plaque-band">{scoreBand(score)}</span>
      </div>
    </div>
  )
}

/** "#2 од 8 најдобри пицерии во Струмица" — their rank-badge device. */
export function RankBadge({
  rank,
  total,
  category,
  place,
  href,
}: {
  rank: number
  total: number
  category: string
  place: string
  href: string
}) {
  return (
    <a className="rank-badge" href={href}>
      <b>#{rank}</b> од {total} најдобри <span>{category.toLowerCase()}</span> во {place}
    </a>
  )
}


/**
 * The magnitude bar.
 *
 * Brought back alongside the seal rather than instead of it: the seal carries
 * the brand and the exact number, the bar answers "is that good?" without the
 * reader having to know the scale. Two jobs, one value, no competition — the
 * bar is never used on its own.
 */
export function ScoreBar({
  value,
  tone = 'score',
  segments = 5,
}: {
  value: number | null
  tone?: 'score' | 'karma'
  segments?: number
}) {
  if (value === null) return null
  const filled = value / (100 / segments)
  return (
    <span className={`bar-meter bar-${tone}`} aria-hidden="true">
      {Array.from({ length: segments }, (_, i) => (
        <span key={i} className="bar-seg">
          <span
            className="bar-fill"
            style={{ width: `${Math.max(0, Math.min(1, filled - i)) * 100}%` }}
          />
        </span>
      ))}
    </span>
  )
}

/**
 * The Karma panel — the reputation half of the profile.
 *
 * It always states where the numbers came from and how much evidence sits
 * behind them. A 4.8 from six opinions is not the same claim as a 4.8 from six
 * hundred, and a panel that hides the difference is selling certainty it does
 * not have.
 */
export function KarmaPanel({
  karma,
  components,
  reviews,
  confidence,
}: {
  karma: number | null
  components: Record<string, number> | null
  reviews: number | null
  confidence: string | null
}) {
  const keys = Object.keys(KARMA_WEIGHTS) as Array<keyof typeof KARMA_WEIGHTS>
  const certainty =
    confidence === 'high'
      ? 'Голем број оценки'
      : confidence === 'medium'
        ? 'Умерен број оценки'
        : 'Малку оценки — оценката е нестабилна'

  return (
    <div className="panel karma-panel">
      <div className="karma-tagline">
        <AiTag size="md" />
      </div>
      <div className="score-head">
        <div>
          <span className="score-big">{karma === null ? '—' : Math.round(karma)}</span>
          <span className="score-outof">/100</span>
          <span className="score-band karma-band">{karmaBand(karma)}</span>
        </div>
        <div className="karma-art">
          <Seal variant="karma" score={karma === null ? null : Math.round(karma)} size={56} />
          <ScoreBar value={karma} tone="karma" />
          <span className="karma-count">
            {reviews ? `${reviews} оценки` : 'нема оценки'}
          </span>
        </div>
      </div>

      {components && karma !== null ? (
        <ul className="score-bars">
          {keys.map((k) => {
            const got = components[k] ?? 0
            const max = KARMA_WEIGHTS[k]
            return (
              <li key={k}>
                <span className="score-bar-label">{KARMA_LABELS[k]}</span>
                <span className="score-bar">
                  <span className="karma-fill" style={{ width: `${(got / max) * 100}%` }} />
                </span>
                <span className="score-bar-val">
                  {Math.round(got)}/{max}
                </span>
              </li>
            )
          })}
        </ul>
      ) : null}

      <p className="score-note">
        Кармата е излез од модел за анализа на сентимент. Тој ги чита сите јавно достапни
        сигнали за бизнисот — оценки, повторливи теми во тоа што луѓето пишуваат, тонот на
        спомнувањата и оценките оставени кај нас — ги мери според обем и свежина, и ги
        дестилира во еден број.
        {karma !== null ? ` ${certainty}.` : ' Сè уште нема доволно за да кажеме нешто.'}
      </p>
      <p className="score-note">
        Не препишуваме туѓи рецензии. Го објавуваме заклучокот, не текстот.
      </p>
    </div>
  )
}
