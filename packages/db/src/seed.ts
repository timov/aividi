import { slugify } from '@aividi/core'
import { db, sql } from './client.js'
import { attribute, category, place, service, source } from './schema.js'

/**
 * Seeds the pilot: Strumica, the ten pilot categories, a starter service and
 * attribute vocabulary, and the source registry with its trust levels.
 *
 * Safe to re-run - everything upserts on its natural key.
 */

const SOURCES = [
  {
    kind: 'owner' as const,
    name: 'Сопственик на бизнисот',
    trust: 100,
    licence: null,
    config: {},
  },
  {
    kind: 'manual' as const,
    name: 'Рачен внес (админ)',
    trust: 95,
    licence: null,
    config: {},
  },
  {
    kind: 'phone_verification' as const,
    name: 'Телефонска проверка',
    trust: 90,
    licence: null,
    config: {},
  },
  {
    kind: 'central_registry' as const,
    name: 'Централен регистар на РСМ',
    trust: 85,
    licence: 'Provjeri uslovi za koristenje pred objavuvanje',
    config: {},
  },
  {
    kind: 'facebook' as const,
    name: 'Facebook страница',
    trust: 50,
    licence: null,
    config: {},
  },
  {
    kind: 'osm' as const,
    name: 'OpenStreetMap (Overpass)',
    trust: 40,
    // ODbL share-alike: keep these values tagged so we can always answer
    // "which fields came from OSM" and attribute them on the page.
    licence: 'ODbL 1.0 - (c) OpenStreetMap contributors',
    config: { area: 'Струмица' },
  },
  {
    kind: 'google_places' as const,
    name: 'Google Places (discovery only)',
    trust: 30,
    licence: 'Google Places ToS - place_id only, no content persisted',
    config: {},
  },
]


/**
 * Every town in the country, as top-level `grad` records.
 *
 * Coordinates are town centres, accurate enough for the nearest-settlement
 * resolution the importer does (it works at kilometre scale) but not survey
 * grade — replace them from an authoritative source before anything draws a
 * map. Population figures are order-of-magnitude and only used for ordering.
 *
 * Note these are deliberately NOT parents of anything. placeFamily() returns a
 * place plus its descendants, so a town list stays a town list; villages hang
 * off an opstina record instead, the way Strumica's do below.
 */
const CITIES: Array<[slug: string, mk: string, lat: number, lng: number, pop: number]> = [
  ['skopje', 'Скопје', 41.9981, 21.4254, 526502],
  ['bitola', 'Битола', 41.0297, 21.3292, 69287],
  ['kumanovo', 'Куманово', 42.1322, 21.7144, 70842],
  ['prilep', 'Прилеп', 41.3464, 21.5542, 66246],
  ['tetovo', 'Тетово', 42.0106, 20.9714, 52915],
  ['veles', 'Велес', 41.7156, 21.7756, 43716],
  ['stip', 'Штип', 41.7458, 22.1958, 42000],
  ['ohrid', 'Охрид', 41.1231, 20.8016, 38818],
  ['gostivar', 'Гостивар', 41.7967, 20.9083, 35847],
  ['kavadarci', 'Кавадарци', 41.4331, 22.0119, 29188],
  ['kocani', 'Кочани', 41.9164, 22.4128, 25000],
  ['kicevo', 'Кичево', 41.5142, 20.9628, 22300],
  ['struga', 'Струга', 41.1778, 20.6783, 20000],
  ['strumica', 'Струмица', 41.4378, 22.6431, 35311],
  ['radovis', 'Радовиш', 41.6383, 22.4644, 16223],
  ['gevgelija', 'Гевгелија', 41.1408, 22.5019, 15685],
  ['debar', 'Дебар', 41.5247, 20.5281, 14561],
  ['kriva-palanka', 'Крива Паланка', 42.2011, 22.3319, 14558],
  ['sveti-nikole', 'Свети Николе', 41.8656, 21.9436, 13746],
  ['negotino', 'Неготино', 41.4839, 22.0889, 13284],
  ['delcevo', 'Делчево', 41.9678, 22.7736, 11500],
  ['vinica', 'Виница', 41.8825, 22.5089, 10863],
  ['resen', 'Ресен', 41.0894, 21.0119, 8748],
  ['probistip', 'Пробиштип', 41.9917, 22.1783, 8298],
  ['berovo', 'Берово', 41.7069, 22.8578, 7002],
  ['kratovo', 'Кратово', 42.0783, 22.1806, 6924],
  ['krusevo', 'Крушево', 41.3706, 21.2494, 5330],
  ['valandovo', 'Валандово', 41.3172, 22.5606, 4402],
  ['bogdanci', 'Богданци', 41.2019, 22.5744, 4200],
  ['demir-hisar', 'Демир Хисар', 41.2211, 21.2022, 2593],
  ['makedonski-brod', 'Македонски Брод', 41.5133, 21.2153, 3740],
  ['makedonska-kamenica', 'Македонска Каменица', 42.0206, 22.5883, 5147],
  ['pehcevo', 'Пехчево', 41.7622, 22.8894, 3237],
  ['demir-kapija', 'Демир Капија', 41.4092, 22.2472, 3275],
  ['star-dojran', 'Стар Дојран', 41.1875, 22.7189, 1000],
]

/**
 * Only towns. A village is not a browsing unit for this product — nobody
 * searches "пицерии во Три Води" — so settlements are folded into the nearest
 * town at import time rather than being modelled separately.
 */
const PLACES: Array<never> = []

/**
 * intent: does the category bring traffic or money? They are rarely the same
 * category, and both are needed from the start.
 */
const CATEGORIES = [
  {
    slug: 'restorani',
    nameMk: 'Ресторани и кафеани',
    nameSq: 'Restorante',
    schemaType: 'Restaurant',
    nkdCodes: ['56.10', '56.29'],
    intent: 'traffic' as const,
    services: [
      ['ruchek', 'Ручек', 'per_person'],
      ['skara', 'Скара', 'per_person'],
      ['tavce-gravce', 'Тавче гравче', 'per_person'],
      ['meze', 'Мезе', 'per_person'],
      ['proslavi', 'Прослави и групи', 'per_person'],
      ['dostava', 'Достава', 'per_visit'],
    ],
  },
  {
    slug: 'kafulinja',
    nameMk: 'Кафулиња и барови',
    nameSq: 'Kafene dhe bare',
    schemaType: 'CafeOrCoffeeShop',
    nkdCodes: ['56.30'],
    intent: 'traffic' as const,
    services: [
      ['kafe', 'Кафе', 'per_piece'],
      ['dorucek', 'Појадок', 'per_person'],
      ['po-lice', 'Просечна сметка по лице', 'per_person'],
    ],
  },
  {
    slug: 'brza-hrana',
    nameMk: 'Брза храна',
    nameSq: 'Ushqim i shpejtë',
    schemaType: 'FastFoodRestaurant',
    nkdCodes: ['56.10'],
    intent: 'traffic' as const,
    services: [
      ['burger', 'Бургер', 'per_piece'],
      ['gyros', 'Ѓирос', 'per_piece'],
      ['pomfrit', 'Помфрит', 'per_piece'],
      ['sendvic', 'Сендвич', 'per_piece'],
    ],
  },
  {
    slug: 'picerii',
    nameMk: 'Пицерии',
    nameSq: 'Piceri',
    schemaType: 'Restaurant',
    nkdCodes: ['56.10'],
    intent: 'traffic' as const,
    services: [
      ['pica-mala', 'Мала пица', 'per_piece'],
      ['pica-golema', 'Голема пица', 'per_piece'],
      ['pica-familijarna', 'Фамилијарна пица', 'per_piece'],
      ['dostava-pica', 'Достава', 'per_visit'],
    ],
  },
  {
    slug: 'stomatolozi',
    nameMk: 'Стоматолози',
    nameSq: 'Dentistë',
    schemaType: 'Dentist',
    nkdCodes: ['86.23'],
    intent: 'money' as const,
    services: [
      ['plomba', 'Пломба', 'per_visit'],
      ['vadenje-zab', 'Вадење заб', 'per_visit'],
      ['chistenje-kamenec', 'Чистење каменец', 'per_visit'],
      ['belenje', 'Белење заби', 'per_visit'],
      ['implant', 'Имплант', 'per_piece'],
      ['protetika', 'Протетика', 'per_piece'],
    ],
  },
  {
    slug: 'avtoservisi',
    nameMk: 'Автосервиси',
    nameSq: 'Autoservise',
    schemaType: 'AutoRepair',
    nkdCodes: ['45.20'],
    intent: 'money' as const,
    services: [
      ['mal-servis', 'Мал сервис', 'per_visit'],
      ['golem-servis', 'Голем сервис', 'per_visit'],
      ['gumi', 'Менување гуми', 'per_visit'],
      ['dijagnostika', 'Дијагностика', 'per_visit'],
      ['limarija', 'Лимарија и фарбање', 'per_visit'],
    ],
  },
  {
    slug: 'majstori',
    nameMk: 'Мајстори и градежни услуги',
    nameSq: 'Mjeshtër dhe ndërtim',
    schemaType: 'HomeAndConstructionBusiness',
    nkdCodes: ['43.22', '43.21', '43.31', '43.34'],
    intent: 'money' as const,
    services: [
      ['vodoinstalater', 'Водоинсталатер', 'per_hour'],
      ['elektrichar', 'Електричар', 'per_hour'],
      ['molerisanje', 'Молерисување', 'per_m2'],
      ['pvc-stolarija', 'ПВЦ столарија', 'per_m2'],
      ['pokrivi', 'Покриви', 'per_m2'],
    ],
  },
  {
    slug: 'saloni-za-ubavina',
    nameMk: 'Салони за убавина и фризери',
    nameSq: 'Sallone bukurie',
    schemaType: 'BeautySalon',
    nkdCodes: ['96.02'],
    intent: 'both' as const,
    services: [
      ['shishanje', 'Шишање', 'per_visit'],
      ['farbanje', 'Фарбање коса', 'per_visit'],
      ['manikir', 'Маникир', 'per_visit'],
      ['pedikir', 'Педикир', 'per_visit'],
    ],
  },
  {
    slug: 'nedvizhnini',
    nameMk: 'Недвижнини',
    nameSq: 'Patundshmëri',
    schemaType: 'RealEstateAgent',
    nkdCodes: ['68.31'],
    intent: 'money' as const,
    services: [],
  },
  {
    slug: 'smestuvanje',
    nameMk: 'Сместување и апартмани',
    nameSq: 'Akomodim',
    schemaType: 'LodgingBusiness',
    nkdCodes: ['55.10', '55.20'],
    intent: 'traffic' as const,
    services: [['nokjevanje', 'Ноќевање', 'per_night']],
  },
  {
    slug: 'svadbi-i-nastani',
    nameMk: 'Свадби и настани',
    nameSq: 'Dasma dhe evente',
    schemaType: 'EventVenue',
    nkdCodes: ['82.30', '93.29'],
    intent: 'money' as const,
    services: [
      ['svadben-menu', 'Свадбено мени', 'per_person'],
      ['fotograf', 'Фотограф', 'per_visit'],
      ['muzika', 'Музика', 'per_visit'],
    ],
  },
  {
    slug: 'advokati-i-smetkovodstvo',
    nameMk: 'Адвокати и сметководство',
    nameSq: 'Avokatë dhe kontabilitet',
    schemaType: 'LegalService',
    nkdCodes: ['69.10', '69.20'],
    intent: 'money' as const,
    services: [
      ['konsultacija', 'Консултација', 'per_hour'],
      ['osnovanje-firma', 'Основање фирма', 'per_visit'],
      ['mesechno-smetkovodstvo', 'Месечно сметководство', 'per_month'],
    ],
  },
  {
    slug: 'prodavnici',
    nameMk: 'Продавници и маркети',
    nameSq: 'Dyqane dhe markete',
    schemaType: 'Store',
    nkdCodes: ['47.11', '47.19'],
    intent: 'traffic' as const,
    services: [],
  },
  /*
   * The batch below has no nameSq (no reliable Albanian translation on hand -
   * left null rather than guessed) and no nkdCodes (same reasoning: wrong
   * registry codes would silently miscategorise a future Central Registry
   * import, and nothing reads these yet since ingestion is 100% manual right
   * now). Three requested categories are skipped as duplicates of ones
   * already above: "Салон за убавина" and "Фризер" are already covered by
   * saloni-za-ubavina ("Салони за убавина и фризери"), and "Автомеханичар"
   * by avtoservisi ("Автосервиси").
   */
  {
    slug: 'himisko-chistenje',
    nameMk: 'Хемиско чистење',
    nameSq: null,
    schemaType: 'DryCleaningOrLaundry',
    nkdCodes: [],
    intent: 'traffic' as const,
    services: [],
  },
  {
    slug: 'himisko-avtomobili',
    nameMk: 'Хемиско чистење на автомобили',
    nameSq: null,
    schemaType: 'AutoWash',
    nkdCodes: [],
    intent: 'traffic' as const,
    services: [],
  },
  {
    slug: 'detejling-avtomobili',
    nameMk: 'Детејлинг на автомобили',
    nameSq: null,
    schemaType: 'AutoWash',
    nkdCodes: [],
    intent: 'traffic' as const,
    services: [],
  },
  {
    slug: 'zhelezarija',
    nameMk: 'Железарија',
    nameSq: null,
    schemaType: 'HardwareStore',
    nkdCodes: [],
    intent: 'traffic' as const,
    services: [],
  },
  {
    slug: 'salon-za-mebel',
    nameMk: 'Салон за мебел',
    nameSq: null,
    schemaType: 'FurnitureStore',
    nkdCodes: [],
    intent: 'traffic' as const,
    services: [],
  },
  {
    slug: 'gradinski-mebel',
    nameMk: 'Градински мебел',
    nameSq: null,
    schemaType: 'FurnitureStore',
    nkdCodes: [],
    intent: 'traffic' as const,
    services: [],
  },
  {
    slug: 'sanitarija',
    nameMk: 'Санитарија',
    nameSq: null,
    schemaType: 'Store',
    nkdCodes: [],
    intent: 'traffic' as const,
    services: [],
  },
  {
    slug: 'mebel-po-narachka',
    nameMk: 'Мебел по нарачка',
    nameSq: null,
    schemaType: 'FurnitureStore',
    nkdCodes: [],
    intent: 'money' as const,
    services: [],
  },
  {
    slug: 'it-oprema',
    nameMk: 'ИТ опрема',
    nameSq: null,
    schemaType: 'ElectronicsStore',
    nkdCodes: [],
    intent: 'traffic' as const,
    services: [],
  },
  {
    slug: 'nadzor-i-bezbednost',
    nameMk: 'Надзор и безбедност',
    nameSq: null,
    schemaType: 'LocalBusiness',
    nkdCodes: [],
    intent: 'money' as const,
    services: [],
  },
  {
    slug: 'veterinari',
    nameMk: 'Ветеринари',
    nameSq: null,
    schemaType: 'VeterinaryCare',
    nkdCodes: [],
    intent: 'money' as const,
    services: [],
  },
  {
    slug: 'apteki',
    nameMk: 'Аптеки',
    nameSq: null,
    schemaType: 'Pharmacy',
    nkdCodes: [],
    intent: 'traffic' as const,
    services: [],
  },
  {
    slug: 'tutunski-prodavnici',
    nameMk: 'Тутунски продавници',
    nameSq: null,
    schemaType: 'Store',
    nkdCodes: [],
    intent: 'traffic' as const,
    services: [],
  },
  {
    slug: 'mesari',
    nameMk: 'Месари',
    nameSq: null,
    schemaType: 'Store',
    nkdCodes: [],
    intent: 'traffic' as const,
    services: [],
  },
  {
    slug: 'pekari',
    nameMk: 'Пекари',
    nameSq: null,
    schemaType: 'Bakery',
    nkdCodes: [],
    intent: 'traffic' as const,
    services: [],
  },
  {
    slug: 'zdrava-hrana',
    nameMk: 'Здрава храна',
    nameSq: null,
    schemaType: 'GroceryStore',
    nkdCodes: [],
    intent: 'traffic' as const,
    services: [],
  },
  {
    slug: 'teretani',
    nameMk: 'Теретани',
    nameSq: null,
    schemaType: 'ExerciseGym',
    nkdCodes: [],
    intent: 'both' as const,
    services: [],
  },
  {
    slug: 'borechki-vestini',
    nameMk: 'Боречки вештини',
    nameSq: null,
    schemaType: 'SportsActivityLocation',
    nkdCodes: [],
    intent: 'both' as const,
    services: [],
  },
  {
    slug: 'cvekjari',
    nameMk: 'Цвеќари',
    nameSq: null,
    schemaType: 'Florist',
    nkdCodes: [],
    intent: 'traffic' as const,
    services: [],
  },
  {
    slug: 'berbernici',
    nameMk: 'Берберници',
    nameSq: null,
    schemaType: 'HairSalon',
    nkdCodes: [],
    intent: 'both' as const,
    services: [],
  },
  {
    slug: 'servis-telefoni',
    nameMk: 'Сервис за телефони',
    nameSq: null,
    schemaType: 'ElectronicsStore',
    nkdCodes: [],
    intent: 'money' as const,
    services: [],
  },
  {
    slug: 'servis-kompjuteri',
    nameMk: 'Сервис за компјутери',
    nameSq: null,
    schemaType: 'ElectronicsStore',
    nkdCodes: [],
    intent: 'money' as const,
    services: [],
  },
  {
    slug: 'servis-televizori',
    nameMk: 'Сервис за телевизори',
    nameSq: null,
    schemaType: 'ElectronicsStore',
    nkdCodes: [],
    intent: 'money' as const,
    services: [],
  },
  {
    slug: 'avtoelektrichari',
    nameMk: 'Автоелектричари',
    nameSq: null,
    schemaType: 'AutoRepair',
    nkdCodes: [],
    intent: 'money' as const,
    services: [],
  },
  {
    slug: 'elektrichari',
    nameMk: 'Електричари',
    nameSq: null,
    schemaType: 'Electrician',
    nkdCodes: [],
    intent: 'money' as const,
    services: [],
  },
  {
    slug: 'vodoinstalateri',
    nameMk: 'Водоинсталатери',
    nameSq: null,
    schemaType: 'Plumber',
    nkdCodes: [],
    intent: 'money' as const,
    services: [],
  },
  {
    slug: 'gradezni-materijali',
    nameMk: 'Градежни материјали',
    nameSq: null,
    schemaType: 'HardwareStore',
    nkdCodes: [],
    intent: 'traffic' as const,
    services: [],
  },
  {
    slug: 'molerski-uslugi',
    nameMk: 'Молерски услуги',
    nameSq: null,
    schemaType: 'HousePainter',
    nkdCodes: [],
    intent: 'money' as const,
    services: [],
  },
  {
    slug: 'sportska-oprema',
    nameMk: 'Спортска опрема',
    nameSq: null,
    schemaType: 'SportingGoodsStore',
    nkdCodes: [],
    intent: 'traffic' as const,
    services: [],
  },
  {
    slug: 'kafe-za-ponesuvanje',
    nameMk: 'Кафе за понесување',
    nameSq: null,
    schemaType: 'CafeOrCoffeeShop',
    nkdCodes: [],
    intent: 'traffic' as const,
    services: [],
  },
  {
    slug: 'slatkarnici',
    nameMk: 'Слаткарници',
    nameSq: null,
    schemaType: 'Bakery',
    nkdCodes: [],
    intent: 'traffic' as const,
    services: [],
  },
]

/** The attributes nobody else structures - and therefore worth citing us for. */
const ATTRIBUTES = [
  { slug: 'parking', nameMk: 'Паркинг', nameSq: 'Parking' },
  { slug: 'terasa', nameMk: 'Тераса', nameSq: 'Terasë' },
  { slug: 'raboti-vikend', nameMk: 'Работи викенд', nameSq: 'Punon fundjavë' },
  { slug: 'raboti-nedela', nameMk: 'Работи недела', nameSq: 'Punon të dielën' },
  { slug: 'kartichki', nameMk: 'Прима картички', nameSq: 'Pranon karta' },
  { slug: 'pristap-invalidi', nameMk: 'Пристап за инвалиди', nameSq: 'Qasje për invalidë' },
  { slug: 'dostava', nameMk: 'Достава', nameSq: 'Dërgesa' },
  { slug: 'wifi', nameMk: 'Бесплатен Wi-Fi', nameSq: 'Wi-Fi falas' },
  { slug: 'za-deca', nameMk: 'Погодно за деца', nameSq: 'I përshtatshëm për fëmijë' },
  { slug: 'zboruva-albanski', nameMk: 'Зборува албански', nameSq: 'Flet shqip' },
  { slug: 'hitni-interventsii', nameMk: 'Итни интервенции 24/7', nameSq: 'Urgjenca 24/7' },
]

async function main() {
  console.log('seeding sources...')
  for (const s of SOURCES) {
    await db
      .insert(source)
      .values({ ...s, config: s.config as Record<string, unknown> })
      .onConflictDoUpdate({
        target: [source.kind, source.name],
        set: { trust: s.trust, licence: s.licence },
      })
  }

  console.log('seeding places...')
  const placeIds = new Map<string, string>()

  for (const [slug, nameMk, lat, lng, population] of CITIES) {
    const [row] = await db
      .insert(place)
      .values({
        kind: 'grad',
        slug,
        nameMk,
        nameLat: slugify(nameMk).replace(/-/g, ' '),
        lat,
        lng,
        population,
        isPilot: true,
      })
      .onConflictDoUpdate({
        target: place.slug,
        set: { nameMk, lat, lng, population, isPilot: true },
      })
      .returning({ id: place.id })
    if (row) placeIds.set(slug, row.id)
  }
  console.log('seeding categories and services...')
  for (const [i, c] of CATEGORIES.entries()) {
    const [row] = await db
      .insert(category)
      .values({
        slug: c.slug,
        nameMk: c.nameMk,
        nameSq: c.nameSq,
        schemaType: c.schemaType,
        nkdCodes: c.nkdCodes,
        intent: c.intent,
        isPilot: true,
        sort: i,
      })
      .onConflictDoUpdate({
        target: category.slug,
        set: {
          nameMk: c.nameMk,
          nameSq: c.nameSq,
          schemaType: c.schemaType,
          nkdCodes: c.nkdCodes,
          intent: c.intent,
          isPilot: true,
          sort: i,
        },
      })
      .returning({ id: category.id })

    if (!row) continue

    for (const [j, svc] of c.services.entries()) {
      const [slug, nameMk, unit] = svc as [string, string, string]
      await db
        .insert(service)
        .values({
          categoryId: row.id,
          slug: slug || slugify(nameMk),
          nameMk,
          unit,
          sort: j,
        })
        .onConflictDoUpdate({
          target: [service.categoryId, service.slug],
          set: { nameMk, unit, sort: j },
        })
    }
  }

  console.log('seeding attributes...')
  for (const [i, a] of ATTRIBUTES.entries()) {
    await db
      .insert(attribute)
      .values({ ...a, kind: 'bool', sort: i })
      .onConflictDoUpdate({
        target: attribute.slug,
        set: { nameMk: a.nameMk, nameSq: a.nameSq, sort: i },
      })
  }

  console.log(
    `done: ${SOURCES.length} sources, ${CITIES.length} towns, ` +
      `${CATEGORIES.length} categories, ${ATTRIBUTES.length} attributes.`,
  )
  await sql.end()
}

main().catch(async (err) => {
  console.error(err)
  await sql.end({ timeout: 1 }).catch(() => {})
  process.exit(1)
})
