'use client'

import { useEffect, useRef, useState } from 'react'
import { shuffledAvoiding } from './shuffle'

/**
 * The hero headline, cycling through what a person might actually be after.
 *
 * Three things make this harder than swapping a word, and all are load-bearing:
 *
 * GRAMMAR. Macedonian marks the definite article on the adjective and agrees
 * the accusative clitic with the noun's gender, so three parts of the sentence
 * move together. «Пронајди ГО најдобриОТ мајстор» but «Пронајди ЈА
 * најдобрАТА пица». Storing whole strings would invite someone to add a noun
 * and get the article wrong, so only the noun and its gender are declared and
 * the rest is derived. Getting this wrong in 48pt type on the homepage is the
 * kind of mistake a Macedonian speaker notices before they read anything else.
 *
 * LAYOUT. Nothing on the page may move. Each of the three parts is its own
 * block, so the number of lines cannot change with the length of the phrase,
 * and the phrase sits in a grid cell pinned by a hidden ::after sizer carrying
 * the longest variant — which reserves both width and height. The sizer is
 * generated content rather than a real element on purpose: it holds no DOM
 * text, so the widest phrase is not sitting in the h1 next to the visible one
 * where a crawler would read both.
 *
 * TRANSITION. A paprika bar wipes across the outgoing phrase, the text is
 * swapped underneath while it is covered, and the bar retracts to reveal the
 * new one. The swap is never visible, which is what makes it read as one
 * deliberate motion rather than a flicker.
 *
 * ORDER. The sequence is reshuffled on every load so the page does not always
 * open on the same three trades — but the FIRST phrase rendered is always the
 * canonical one, because the server renders it too and a random pick would
 * disagree with the client and trip a hydration mismatch.
 */

type Gender = 'm' | 'f' | 'n'

interface Subject {
  noun: string
  gender: Gender
}

/** Definite forms of «најдобар», and the accusative clitic, per gender. */
const AGREEMENT: Record<Gender, { adjective: string; clitic: string }> = {
  m: { adjective: 'најдобриот', clitic: 'го' },
  f: { adjective: 'најдобрата', clitic: 'ја' },
  n: { adjective: 'најдоброто', clitic: 'го' },
}

/**
 * Deliberately spans both halves of the promise: somewhere to go tonight, and
 * a tradesman you need on a Tuesday. The first entry is what renders without
 * JavaScript and on the server, so it is the one that has to read well cold.
 */
const SUBJECTS: Subject[] = [
  { noun: 'пица', gender: 'f' },
  { noun: 'бургер', gender: 'm' },
  { noun: 'мајстор', gender: 'm' },
  { noun: 'стоматолог', gender: 'm' },
  { noun: 'автомеханичар', gender: 'm' },
  { noun: 'фризер', gender: 'm' },
  { noun: 'пекара', gender: 'f' },
  { noun: 'кафе', gender: 'n' },
  { noun: 'електричар', gender: 'm' },
  { noun: 'козметичар', gender: 'm' },
  { noun: 'адвокат', gender: 'm' },
  { noun: 'масажа', gender: 'f' },
  { noun: 'спа центар', gender: 'm' },
  { noun: 'мебел', gender: 'm' },
  { noun: 'бербер', gender: 'm' },
  { noun: 'теретана', gender: 'f' },
]

function phrase({ noun, gender }: Subject): string {
  const { adjective, clitic } = AGREEMENT[gender]
  return `${clitic} ${adjective} ${noun}`
}

const PHRASES = SUBJECTS.map(phrase)

/** Whichever phrase is widest pins the box, so none of them can resize it. */
const WIDEST = PHRASES.reduce((a, b) => (b.length > a.length ? b : a))

const HOLD_MS = 2800
const COVER_MS = 260
const REVEAL_MS = 340

type Phase = 'idle' | 'covering' | 'revealing'

export function RotatingHeadline() {
  // Server and first client render agree on PHRASES[0]; the order is only
  // randomised afterwards, so hydration never sees a different string.
  const [order, setOrder] = useState<string[]>(PHRASES)
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')

    // Reshuffled once mounted, and again each time the list is exhausted, so a
    // long visit does not settle into one repeating loop.
    const reshuffle = (current: string) => {
      const next = shuffledAvoiding(PHRASES, current)
      setOrder(next)
      setIndex(0)
      return next
    }

    let live = order
    let cursor = 0
    setTimeout(() => {
      live = reshuffle(live[cursor] as string)
      cursor = 0
    }, 0)

    const advance = () => {
      cursor += 1
      if (cursor >= live.length) {
        live = reshuffle(live[live.length - 1] as string)
        cursor = 0
      }
      setIndex(cursor)
    }

    const tick = () => {
      // Under reduced motion the phrase still changes, it just does not travel:
      // the content stays equal for everyone, the movement does not.
      if (reduced.matches) {
        advance()
        return
      }

      setPhase('covering')
      timers.current.push(
        setTimeout(() => {
          // Swapped while the bar covers it, so the change itself is unseen.
          advance()
          setPhase('revealing')
          timers.current.push(setTimeout(() => setPhase('idle'), REVEAL_MS))
        }, COVER_MS),
      )
    }

    const interval = setInterval(() => {
      // A headline animating to nobody is wasted battery on a phone.
      if (document.visibilityState === 'visible') tick()
    }, HOLD_MS)

    return () => {
      clearInterval(interval)
      timers.current.forEach(clearTimeout)
      timers.current = []
    }
    // Intentionally mount-only: `order` is driven from inside this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const phrase = order[index] ?? PHRASES[0]

  return (
    <h1 className="hero-title">
      <span className="hero-line">Пронајди</span>
      <span className="rotator" data-sizer={WIDEST}>
        <span
          key={`${index}-${phrase}`}
          className={`rot-phrase${phase === 'idle' ? '' : ` is-${phase}`}`}
        >
          {phrase}
        </span>
      </span>
      <span className="hero-line">од прва!</span>
    </h1>
  )
}
