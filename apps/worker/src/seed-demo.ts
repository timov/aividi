import {
  account,
  attribute,
  category,
  db,
  entity,
  entityAttribute,
  entityCategory,
  entityService,
  eq,
  inArray,
  openingHours,
  place,
  service,
  source,
  sql,
  subscription,
} from '@aividi/db'
import { matchKey, toLatin } from '@aividi/core'
import { applyFields, materializeEntity, rebuildListsForPlace, score } from '@aividi/pipeline'

/**
 * ============================================================================
 *  DESIGN FIXTURE DATA - NOT REAL BUSINESS RECORDS
 * ============================================================================
 *
 * These entries exist so the public pages have something to lay out while the
 * design is being worked on. The names are the ones we want the first three
 * category pages built around; everything else - phone numbers, addresses,
 * hours, prices - is INVENTED. The phone numbers are deliberately in an
 * unusable +389 70 000 0xx block so nobody can dial one by accident.
 *
 * Nothing here is verified, so every card renders the "Непроверено" state,
 * which is the honest one. Replace all of it with real ingested and
 * phone-verified data before this site is public:
 *
 *   pnpm db:seed:demo --clear
 *
 * The three sponsored entries are driven through the real mechanism: an
 * account, an active `featured` subscription, and buildList() pinning them
 * into a labelled slot above the organic ranking. Nobody's organic score is
 * touched by paying.
 */

type Hours = 'standard' | 'late' | 'kafana' | 'pizza'

interface DemoBiz {
  name: string
  place: string
  category: string
  address: string
  phoneSuffix: number
  description: string
  attributes: string[]
  hours: Hours
  /** [service slug, price from, price to] in MKD */
  services: Array<[string, number, number]>
  facebook?: string
  sponsored?: boolean
}

const BUSINESSES: DemoBiz[] = [
  // --- Брза храна ----------------------------------------------------------
  {
    name: 'Бургер 13',
    place: 'strumica',
    category: 'brza-hrana',
    address: 'Маршал Тито 13',
    phoneSuffix: 1,
    description:
      'Бургери од свежо мелено месо, помфрит и домашни сосови, во центарот на Струмица.',
    attributes: ['dostava', 'kartichki', 'za-deca', 'wifi', 'raboti-nedela'],
    hours: 'late',
    services: [
      ['burger', 180, 260],
      ['pomfrit', 70, 90],
      ['sendvic', 150, 200],
    ],
    facebook: 'burger13strumica',
    sponsored: true,
  },
  {
    name: 'Ѓирос Кај Ацо',
    place: 'strumica',
    category: 'brza-hrana',
    address: 'Ленинова 44',
    phoneSuffix: 2,
    description: 'Ѓирос и плескавици на скара, за јадење на лице место или за понесување.',
    attributes: ['dostava', 'raboti-nedela'],
    hours: 'late',
    services: [
      ['gyros', 130, 170],
      ['pomfrit', 60, 80],
    ],
  },
  {
    name: 'Фаст фуд Мерак',
    place: 'strumica',
    category: 'brza-hrana',
    address: 'Гоце Делчев 8',
    phoneSuffix: 3,
    description: 'Брза храна близу автобуската станица, отворено до доцна.',
    attributes: ['kartichki', 'parking'],
    hours: 'late',
    services: [
      ['burger', 150, 220],
      ['gyros', 120, 160],
    ],
  },
  {
    name: 'Сендвич бар Тања',
    place: 'strumica',
    category: 'brza-hrana',
    address: 'Браќа Миладинови 21',
    phoneSuffix: 4,
    description: 'Сендвичи и тост, погодно за брз ручек во работно време.',
    attributes: ['za-deca'],
    hours: 'standard',
    services: [['sendvic', 120, 180]],
  },
  {
    name: 'Бургер Хаус',
    place: 'strumica',
    category: 'brza-hrana',
    address: 'Кузман Јосифовски 4',
    phoneSuffix: 5,
    description: 'Бургери и помфрит, со тераса и паркинг.',
    attributes: ['parking', 'terasa', 'raboti-vikend', 'raboti-nedela'],
    hours: 'late',
    services: [
      ['burger', 160, 240],
      ['pomfrit', 60, 80],
    ],
  },
  {
    name: 'Скара Кај Пецо',
    place: 'strumica',
    category: 'brza-hrana',
    address: 'Атанас Наков 11',
    phoneSuffix: 6,
    description: 'Скара и плескавици, со паркинг пред објектот.',
    attributes: ['parking', 'raboti-vikend'],
    hours: 'standard',
    services: [['gyros', 130, 170]],
  },

  // --- Пицерии -------------------------------------------------------------
  {
    name: 'Pizza Slice',
    place: 'strumica',
    category: 'picerii',
    address: 'Партизанска 5',
    phoneSuffix: 11,
    description:
      'Пица на парче и цели пици, со достава низ Струмица.',
    attributes: ['dostava', 'kartichki', 'raboti-nedela', 'wifi', 'za-deca'],
    hours: 'pizza',
    services: [
      ['pica-mala', 160, 200],
      ['pica-golema', 260, 340],
      ['pica-familijarna', 420, 520],
      ['dostava-pica', 50, 80],
    ],
    facebook: 'pizzaslicestrumica',
    sponsored: true,
  },
  {
    name: 'Пицерија Наполи',
    place: 'strumica',
    category: 'picerii',
    address: 'Климент Охридски 17',
    phoneSuffix: 12,
    description: 'Пици од фурна на дрва, со тераса во центарот.',
    attributes: ['dostava', 'terasa', 'kartichki'],
    hours: 'pizza',
    services: [
      ['pica-mala', 150, 190],
      ['pica-golema', 250, 320],
    ],
  },
  {
    name: 'Пицерија Верона',
    place: 'strumica',
    category: 'picerii',
    address: 'Сандо Масев 30',
    phoneSuffix: 13,
    description: 'Пица и тестенини, достава во градот.',
    attributes: ['dostava', 'za-deca'],
    hours: 'pizza',
    services: [
      ['pica-golema', 260, 330],
      ['dostava-pica', 50, 60],
    ],
  },
  {
    name: 'Пица Плус',
    place: 'strumica',
    category: 'picerii',
    address: 'Крсте Мисирков 7',
    phoneSuffix: 14,
    description: 'Пица за понесување и достава во градот.',
    attributes: ['dostava', 'parking'],
    hours: 'pizza',
    services: [
      ['pica-mala', 140, 180],
      ['pica-familijarna', 400, 480],
    ],
  },
  {
    name: 'Pizzeria Roma',
    place: 'strumica',
    category: 'picerii',
    address: 'Благој Мучето 2',
    phoneSuffix: 15,
    description: 'Пица, паста и салати, со достава до 23:00.',
    attributes: ['dostava', 'kartichki', 'raboti-nedela'],
    hours: 'pizza',
    services: [
      ['pica-golema', 270, 350],
      ['dostava-pica', 60, 90],
    ],
  },
  {
    // No delivery on purpose: it must fall out of the /dostava/ facet.
    name: 'Пицерија Бела Лоза',
    place: 'strumica',
    category: 'picerii',
    address: 'Видое Смилевски 3',
    phoneSuffix: 16,
    description: 'Пица во фурна на дрва, само за јадење на лице место.',
    attributes: ['parking', 'terasa', 'raboti-vikend'],
    hours: 'standard',
    services: [['pica-golema', 240, 300]],
  },

  // --- Гостилници и кафеани (сега во Ресторани) -------------------------------------------------
  {
    name: 'Гостилница Центар',
    place: 'strumica',
    category: 'restorani',
    address: 'Плоштад Гоце Делчев 1',
    phoneSuffix: 21,
    description:
      'Домашна кујна и скара во центарот на Струмица, со сала за прослави до 80 гости.',
    attributes: ['parking', 'terasa', 'kartichki', 'raboti-nedela', 'za-deca', 'pristap-invalidi'],
    hours: 'kafana',
    services: [
      ['tavce-gravce', 200, 260],
      ['skara', 380, 520],
      ['meze', 220, 300],
      ['proslavi-gostilnica', 700, 1200],
    ],
    facebook: 'gostilnicacentar',
    sponsored: true,
  },
  {
    name: 'Гостилница Стара Куќа',
    place: 'strumica',
    category: 'restorani',
    address: 'Цветан Димов 12',
    phoneSuffix: 22,
    description: 'Традиционална кујна во стара градска куќа, со внатрешен двор.',
    attributes: ['terasa', 'kartichki', 'raboti-vikend'],
    hours: 'kafana',
    services: [
      ['tavce-gravce', 190, 240],
      ['meze', 200, 280],
    ],
  },
  {
    name: 'Кај Дедо Ристо',
    place: 'strumica',
    category: 'restorani',
    address: 'Гоце Делчев 52',
    phoneSuffix: 23,
    description: 'Гостилница со скара и домашна ракија, отворено викенд.',
    attributes: ['parking', 'terasa', 'raboti-vikend', 'raboti-nedela'],
    hours: 'kafana',
    services: [
      ['skara', 350, 450],
      ['meze', 180, 250],
    ],
  },
  {
    name: 'Механа Белазора',
    place: 'strumica',
    category: 'restorani',
    address: 'Никола Карев 9',
    phoneSuffix: 24,
    description: 'Механа со жива музика во петок и сабота.',
    attributes: ['kartichki', 'raboti-vikend'],
    hours: 'kafana',
    services: [
      ['skara', 400, 550],
      ['proslavi-gostilnica', 800, 1400],
    ],
  },
  {
    name: 'Гостилница Езерце',
    place: 'strumica',
    category: 'restorani',
    address: 'Младинска 18',
    phoneSuffix: 25,
    description: 'Гостилница со голема тераса и паркинг.',
    attributes: ['parking', 'terasa', 'za-deca', 'raboti-nedela', 'raboti-vikend'],
    hours: 'kafana',
    services: [
      ['skara', 360, 480],
      ['tavce-gravce', 200, 250],
    ],
  },
  {
    name: 'Кафана Стариот Даб',
    place: 'strumica',
    category: 'restorani',
    address: 'Јосиф Јосифовски 9',
    phoneSuffix: 26,
    description: 'Мала кафана со мезе и домашно вино.',
    attributes: ['terasa', 'raboti-vikend'],
    hours: 'kafana',
    services: [['meze', 160, 220]],
  },
]

const HOURS: Record<Hours, Array<{ weekday: number; opens: string; closes: string }>> = {
  standard: day(1, 7, '08:00', '22:00'),
  late: day(1, 7, '09:00', '23:30'),
  kafana: day(1, 7, '10:00', '23:00'),
  pizza: day(1, 7, '10:00', '23:00'),
}

function day(from: number, to: number, opens: string, closes: string) {
  const out = []
  for (let d = from; d <= to; d++) out.push({ weekday: d, opens, closes })
  return out
}

/** Unusable by design: +389 70 000 0xx is not a dialable Macedonian number. */
function demoPhone(suffix: number): string {
  return `+3897000${String(suffix).padStart(4, '0')}`
}

async function clear(sourceId: string) {
  const rows = await db
    .select({ id: entity.id })
    .from(entity)
    .where(eq(entity.verifiedBy, 'demo-seed'))

  if (rows.length === 0) {
    console.log('nothing to clear.')
    return
  }

  const ids = rows.map((r) => r.id)
  await db.delete(subscription).where(inArray(subscription.entityId, ids))
  await db.delete(entity).where(inArray(entity.id, ids))
  await db.delete(account).where(eq(account.email, 'demo@aividi.mk'))
  await db.delete(source).where(eq(source.id, sourceId))
  console.log(`removed ${ids.length} demo entities.`)
}

async function main() {
  const wantsClear = process.argv.includes('--clear')

  const [demoSource] = await db
    .insert(source)
    .values({
      kind: 'manual',
      name: 'Демо податоци (само за дизајн)',
      trust: 10,
      licence: 'ИЗМИСЛЕНИ ПОДАТОЦИ - замени пред објавување',
      config: {},
    })
    .onConflictDoUpdate({
      target: [source.kind, source.name],
      set: { trust: 10 },
    })
    .returning({ id: source.id })

  if (!demoSource) throw new Error('could not create the demo source')

  if (wantsClear) {
    await clear(demoSource.id)
    await sql.end()
    return
  }

  console.log('\n  ⚠  Внесувам ИЗМИСЛЕНИ податоци за дизајн, не вистински бизниси.')
  console.log('     Избриши ги со: pnpm db:seed:demo --clear\n')

  const places = new Map(
    (await db.select({ id: place.id, slug: place.slug, lat: place.lat, lng: place.lng }).from(place)).map(
      (p) => [p.slug, p],
    ),
  )
  const categories = new Map(
    (await db.select({ id: category.id, slug: category.slug }).from(category)).map((c) => [
      c.slug,
      c.id,
    ]),
  )
  const attributes = new Map(
    (await db.select({ id: attribute.id, slug: attribute.slug }).from(attribute)).map((a) => [
      a.slug,
      a.id,
    ]),
  )
  const services = new Map(
    (await db.select({ id: service.id, slug: service.slug }).from(service)).map((s) => [
      s.slug,
      s.id,
    ]),
  )

  const sponsoredEntityIds: string[] = []

  for (const biz of BUSINESSES) {
    const pl = places.get(biz.place)
    const categoryId = categories.get(biz.category)
    if (!pl || !categoryId) {
      console.warn(`  skipped ${biz.name}: unknown place or category`)
      continue
    }

    const [created] = await db
      .insert(entity)
      .values({
        status: 'published',
        nameMk: biz.name,
        nameLat: toLatin(biz.name),
        nameNorm: matchKey(biz.name),
        placeId: pl.id,
        // Marks the row as a fixture so --clear can find it again.
        verifiedBy: 'demo-seed',
      })
      .returning({ id: entity.id })

    if (!created) continue

    await applyFields({
      entityId: created.id,
      sourceId: demoSource.id,
      fields: {
        name_mk: biz.name,
        phone_e164: demoPhone(biz.phoneSuffix),
        address: biz.address,
        // Deliberately no coordinates. These are invented businesses, and a
        // jittered point near the town centre produced map links that opened
        // on a random field outside Strumica. A fixture with no location is
        // honest; a fixture with a plausible wrong one is not.
        description_mk: biz.description,
        facebook: biz.facebook ? `https://facebook.com/${biz.facebook}` : null,
      },
      confidence: 0.4,
    })

    await db.insert(entityCategory).values({
      entityId: created.id,
      categoryId,
      isPrimary: true,
    })

    for (const slug of biz.attributes) {
      const attributeId = attributes.get(slug)
      if (attributeId) {
        await db
          .insert(entityAttribute)
          .values({ entityId: created.id, attributeId, sourceId: demoSource.id })
          .onConflictDoNothing()
      }
    }

    await db.insert(openingHours).values(
      HOURS[biz.hours].map((h) => ({
        entityId: created.id,
        weekday: h.weekday,
        opens: h.opens,
        closes: h.closes,
        sourceId: demoSource.id,
      })),
    )

    for (const [slug, from, to] of biz.services) {
      const serviceId = services.get(slug)
      if (!serviceId) continue
      await db
        .insert(entityService)
        .values({
          entityId: created.id,
          serviceId,
          priceFrom: String(from),
          priceTo: String(to),
          currency: 'MKD',
          sourceId: demoSource.id,
        })
        .onConflictDoNothing()
    }

    await materializeEntity(created.id)
    await score(created.id)

    if (biz.sponsored) sponsoredEntityIds.push(created.id)
    console.log(`  + ${biz.name} (${biz.place})`)
  }

  // --- sponsorship through the real mechanism -------------------------------
  if (sponsoredEntityIds.length > 0) {
    const [demoAccount] = await db
      .insert(account)
      .values({ email: 'demo@aividi.mk', name: 'Демо клиент' })
      .onConflictDoUpdate({ target: account.email, set: { name: 'Демо клиент' } })
      .returning({ id: account.id })

    if (demoAccount) {
      const renews = new Date()
      renews.setFullYear(renews.getFullYear() + 1)

      for (const entityId of sponsoredEntityIds) {
        await db.insert(subscription).values({
          accountId: demoAccount.id,
          entityId,
          tier: 'featured',
          period: 'yearly',
          status: 'active',
          priceEur: '390.00',
          invoiceRef: 'ДЕМО',
          renewsAt: renews,
        })
      }
      console.log(`\n  ${sponsoredEntityIds.length} истакнати претплати (tier=featured)`)
    }
  }

  console.log('\nrebuilding lists...')
  const lists = await rebuildListsForPlace('strumica')
  const indexed = lists.filter((l) => l.indexable)

  console.log(`  ${lists.length} листи, ${indexed.length} поминаа низ index gate:`)
  for (const l of indexed) {
    console.log(
      `    /${l.slug}  ${l.organic} организски + ${l.sponsored} спонзорирани`,
    )
  }

  const blocked = lists.filter((l) => !l.indexable && l.organic + l.sponsored > 0)
  if (blocked.length > 0) {
    console.log(`\n  ${blocked.length} листи се noindex (премалку субјекти) - тоа е точно.`)
  }

  await sql.end()
}

main().catch(async (err) => {
  console.error(err)
  await sql.end({ timeout: 1 }).catch(() => {})
  process.exit(1)
})
