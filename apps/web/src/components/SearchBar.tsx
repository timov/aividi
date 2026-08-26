'use client'

import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { shuffled } from './shuffle'

/**
 * The hero search box.
 *
 * The placeholder is the clearest statement of what this site is for, so it
 * shows the kind of question a person actually has rather than "search…". One
 * example is picked per page load — deliberately NOT on a timer. A hint that
 * rewrites itself while you are reading it is something you have to chase, and
 * the box is a control, not a carousel.
 *
 * Same hydration rule as the headline: the server renders SUGGESTIONS[0] and
 * the pick happens after mount, because a random placeholder chosen during
 * render would not match the server's HTML.
 */

/**
 * Written as whole questions, not keywords. These are the phrasings the site
 * is being built to answer, and they double as a promise about what a search
 * is allowed to look like.
 */
const SUGGESTIONS = [
  'Пица маргарита со достава · најдобар за клима фолии · мајстор во недела',
  'Најдобра скара во Струмица · автомеханичар отворен сега · фризер без термин',
  'Кој прави фолија на стакла · пекара што работи наутро · стоматолог за деца',
  'Ручек до 300 денари · кафуле со тераса · масажа за врат и рамо',
  'Бербер во близина · теретана со отворено доцна · електричар за итен случај',
  'Каде да јадам вечерва · козметичар за нокти · мебел по мерка',
]

export function SearchBar() {
  const [hint, setHint] = useState<string>(SUGGESTIONS[0] as string)

  useEffect(() => {
    setHint(shuffled(SUGGESTIONS)[0] as string)
  }, [])

  return (
    <form className="searchbar" action="/prebaraj" role="search">
      <label className="sr-only" htmlFor="q">
        Пребарај бизнис или категорија
      </label>
      <input
        id="q"
        type="search"
        name="q"
        autoComplete="off"
        placeholder={hint}
      />
      <button type="submit" aria-label="Пребарај">
        <Icon name="search" size={22} />
      </button>
    </form>
  )
}
