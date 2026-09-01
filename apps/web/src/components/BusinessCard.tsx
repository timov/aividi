import Link from 'next/link'
import { karmaBand, openStatus } from '@aividi/core'
import { AiTag } from './Ai'
import { VerifiedBadge } from './Brand'
import { LiveOpenStatus } from './LiveOpenStatus'
import { Photo } from './Photo'
import { ScoreBar } from './Score'
import { Seal } from './Seal'
import type { CardData } from '@/lib/public-queries'

/**
 * One business in a list.
 *
 * The score meter sits directly under the name, the way Trustpilot puts the
 * star row under the company name — it is the first thing the eye lands on
 * after the name itself, and it carries the whole trust proposition.
 */
export function BusinessCard({
  card,
  showSponsorTag,
}: {
  card: CardData
  showSponsorTag?: boolean
}) {
  const href = entityHref(card)
  const facts = buildFacts(card)

  return (
    <li className={`record${card.isSponsored ? ' is-sponsored' : ''}`}>
      {card.logo ? (
        <div className="record-photo logo-tile">
          <img src={card.logo.src} alt={`${card.name} — лого`} loading="lazy" decoding="async" />
        </div>
      ) : (
        <Photo
          photo={card.photos[0]}
          name={card.name}
          category={card.categorySlug}
          ratio="1 / 1"
          className="record-photo"
          sizes="116px"
        />
      )}

      <div className="record-main">
        {showSponsorTag && card.isSponsored ? (
          <p className="record-sponsor">Спонзорирано</p>
        ) : null}

        <h3 className="record-name">
          {href ? <Link href={href}>{card.name}</Link> : card.name}
        </h3>

        <div className="record-meterline">
          <span className="score-lockup">
            <Seal
              variant="score"
              score={card.score === null ? null : Math.round(card.score)}
              size={38}
            />
            <ScoreBar value={card.score} />
          </span>
          {card.karma !== null ? (
            <span className="karma-inline" title={`${card.karmaReviews ?? 0} оценки`}>
              <Seal variant="karma" score={Math.round(card.karma)} size={34} />
              <ScoreBar value={card.karma} tone="karma" />
              <span className="karma-word">карма</span>
              <AiTag size="sm" />
            </span>
          ) : null}
          <VerifiedBadge verifiedAt={card.verifiedAt} />
          <LiveOpenStatus hours={card.hours} initialStatus={openStatus(card.hours)} variant="badge" />
        </div>

        <p className="record-where">
          {[card.address, card.placeName].filter(Boolean).join(', ')}
        </p>

        {facts.length > 0 ? (
          <p className="record-facts">
            {facts.map((f, i) => (
              <span key={f.text}>
                {i > 0 ? <span className="sep">·</span> : null}
                <span className={f.emphasis ? 'price' : undefined}>{f.text}</span>
              </span>
            ))}
          </p>
        ) : null}
      </div>

      {card.phone ? (
        <div className="record-action">
          <a className="call" href={`tel:${card.phone}`}>
            <span className="word">Јави се</span>
            <span>{formatPhone(card.phone)}</span>
          </a>
        </div>
      ) : null}

      <div className="record-note">
        <p className="record-overview">{cardOverview(card)}</p>
        {card.summary ? (
          <p className="record-voice">
            <AiTag size="sm" />
            <span>{truncate(card.summary, 240)}</span>
          </p>
        ) : (
          <p className="record-verdict">{cardVerdict(card)}</p>
        )}
      </div>
    </li>
  )
}

/** One row of a ranked list, on the dark ground. */
export function RankRow({ card, rank }: { card: CardData; rank: number | null }) {
  const href = entityHref(card)
  const facts = buildFacts(card)

  return (
    <li className={`rank${rank === null ? ' is-sponsored' : ''}`}>
      <div className="rank-num">{rank === null ? 'Спонз.' : pad(rank)}</div>

      <div>
        <h3 className="rank-name">{href ? <Link href={href}>{card.name}</Link> : card.name}</h3>
        <div className="record-meterline" style={{ marginBottom: 6 }}>
          <Seal variant="score" score={card.score === null ? null : Math.round(card.score)} size={38} />
        </div>
        <p className="rank-meta">
          {[card.address, card.placeName].filter(Boolean).join(', ')}
          <LiveOpenStatus hours={card.hours} initialStatus={openStatus(card.hours)} variant="inline" />
          {facts.map((f) => (
            <span key={f.text}>
              <span className="sep">·</span>
              {f.text}
            </span>
          ))}
        </p>
      </div>

      <div className="rank-actions">
        {card.phone ? (
          <a className="call" href={`tel:${card.phone}`}>
            <span className="word">Јави се</span>
            <span>{formatPhone(card.phone)}</span>
          </a>
        ) : null}
        {href ? (
          <Link className="secondary" href={href}>
            Профил
          </Link>
        ) : null}
      </div>
    </li>
  )
}

/* ------------------------------------------------------------------------- */

/**
 * What this business does, in one line.
 *
 * The tile used to close on "Податоците не се потврдени од бизнисот" — a
 * disclaimer where the useful sentence should be. Nobody scanning a list of
 * twelve restaurants needs each one to tell them what it is not.
 */
function cardOverview(card: CardData): string {
  const first = card.description?.trim().split(/(?<=\.)\s+/)[0]
  if (first && first.length > 12) return truncate(first, 150)

  const what = card.categoryName ?? 'Бизнис'
  return card.placeName ? `${what} во ${card.placeName}.` : `${what}.`
}

/**
 * The fallback for a business nobody has said anything about yet.
 *
 * Only reached when there is no summary. Restating the two numbers in a
 * sentence is worse than useless when a summary exists — the seals above
 * already carry them — so the good case gets the human line instead, and this
 * one says plainly that we do not know yet rather than dressing a formula up
 * as a verdict.
 */
function cardVerdict(card: CardData): string {
  if (card.karma === null) {
    return 'Сè уште нема доволно јавни мислења за да кажеме што велат гостите.'
  }

  const n = card.karmaReviews ?? 0
  const from = n > 0 ? ` од ${n} ${n === 1 ? 'оценка' : 'оценки'}` : ''
  return `Оценките се ${karmaBand(card.karma).toLowerCase()}${from}, но сè уште немаме резиме на што точно велат гостите.`
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[,.;:]$/, '')}…`
}

interface Fact {
  text: string
  emphasis?: boolean
}

/** Price first: it is the thing nobody else in the country publishes. */
function buildFacts(card: CardData): Fact[] {
  const out: Fact[] = []
  if (card.priceFrom !== null) {
    const to = card.priceTo && card.priceTo !== card.priceFrom ? `–${card.priceTo}` : ''
    out.push({ text: `${card.priceFrom}${to} ден.`, emphasis: true })
  }
  for (const attribute of card.attributes.slice(0, 3)) {
    out.push({ text: attribute.toLowerCase() })
  }
  return out
}

function entityHref(card: CardData): string | null {
  return card.slug && card.placeSlug && card.categorySlug
    ? `/${card.placeSlug}/${card.categorySlug}/${card.slug}`
    : null
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** +38970123456 -> 070 123 456, which is how everyone here reads a number. */
export function formatPhone(e164: string): string {
  const national = e164.replace('+389', '')
  if (national.length !== 8) return e164
  return `0${national.slice(0, 2)} ${national.slice(2, 5)} ${national.slice(5)}`
}
