# aividi.mk

A verified entity graph of Macedonian businesses, plus the tools to keep it clean.

This repo is the data layer described in the [Strumica pilot plan](https://claude.ai/code/artifact/75e36142-fb32-4db4-aca9-cf788e9883a3):
ingestion from open sources, entity matching with human review, per-field
provenance, the AIVIDI Score, and the public site those produce. The GEO query
bank is not built yet.

The rule the whole design turns on: **a scraped record is never the business.**
Raw payloads land in `source_record` and stay immutable. Canonical businesses
live in `entity`. The join between them is explicit, reviewable, and reversible.

---

## Prerequisites

- **Node 20+** (Node 18 will mostly run but is end-of-life; `engines` asks for 20)
- **pnpm 10+** — `npm i -g pnpm`
- **Postgres 15+** — 15 is the floor because the `list` table relies on
  `UNIQUE NULLS NOT DISTINCT`
  - **no Docker? `pnpm db:local`** downloads and runs an embedded Postgres in
    `data/pgdata`, no install needed. Leave it running in its own terminal.
  - with Docker: `docker compose up -d` (also gives you Redis)
  - `pg_trgm` is required; **PostGIS is optional** — distances are computed in
    JS, and the spatial index is created only where the extension exists
- **Redis** is only needed for the background worker. The CLI runs the same
  pipeline without it, so you can skip it entirely at first.

## Quick start

```bash
cp .env.example .env          # then edit ADMIN_PASSWORD and ADMIN_SECRET
pnpm install
pnpm db:local                 # embedded Postgres - leave running in its own terminal
                              # (or: docker compose up -d)
pnpm db:migrate               # extensions, then the generated migrations
pnpm db:seed                  # Strumica, 10 pilot categories, source registry

pnpm ingest run osm 300       # pull ~300 POIs from OpenStreetMap
pnpm ingest promote           # match them into entities
pnpm ingest score             # compute the AIVIDI Score

pnpm ingest lists             # build the published lists + apply the index gate

pnpm dev:web                  # site at http://localhost:3000, admin at /admin
pnpm dev:worker               # optional: background queue
```

Want something on the page before real data exists? `pnpm db:seed:demo` loads
**invented** fixture businesses for the three starter categories so the design
can be worked on. Remove them with `pnpm db:seed:demo --clear` — see
[Demo data](#demo-data).

`pnpm ingest` with no arguments lists every command.

---

## Layout

```
packages/core       pure logic, no I/O - transliteration, matching, scoring,
                    provenance resolution, opening hours, the index gate. 52 unit tests.
packages/db         drizzle schema, migrations, seed, the pg client
packages/pipeline   ingestion adapters, promote/merge/score, the BullMQ queue
apps/web            public site + Next.js admin (dashboard, merge queue, editor)
apps/worker         the queue worker process and the ingestion CLI
```

`core` is deliberately dependency-free and DB-free, so the rules that decide
what a business *is* can be argued about in a test rather than in production.

## The pipeline

```
fetch → source_record → promote → entity + entity_field → materialize → score
                            ↓
                     match_candidate → /admin/matches → merge
```

1. **`ingest`** pulls from a source and writes immutable `source_record` rows,
   skipping unchanged payloads by content hash.
2. **`promote`** normalises one record, looks for an existing entity, and
   either merges onto it, creates a draft, or queues a pair for review.
3. **`applyFields`** records *what a source told us*, never the entity itself.
4. **`materializeEntity`** recomputes entity columns from all candidates using
   source trust, confidence, and verification freshness.
5. **`score`** recomputes the AIVIDI Score and stores the components.

### The two matching rules

Both live in `packages/core/src/match.ts` and both are load-bearing:

- **A name-only match never auto-merges.** Every Macedonian town has four
  "Кафе Бар Сонце" and they are four different businesses.
- **A strong identifier turns a guess into a merge.** Matching EMBS is
  decisive; a shared phone or website host plus a similar name auto-merges;
  everything else goes to a human in `/admin/matches`.

Names fold through `matchKey()`, which collapses Cyrillic and Latin into one
comparable form — so "Кај Мире", "Kaj Mire" and "Kaj Mirè" land in the same
bucket. This is the single largest source of duplicate entities in MK data.

## Sources, and the lines not to cross

| Source | Trust | Notes |
| --- | --- | --- |
| Owner / manual / phone verification | 90–100 | beats every automated source by design |
| Central Registry (CSV) | 85 | the EMBS spine; configure columns per extract |
| Facebook / Instagram | 50 | where most MK SMBs actually live |
| OpenStreetMap | 40 | **ODbL** — share-alike can attach to a derived DB |
| Google Places | 30 | **discovery only** — see below |

**OSM is ODbL.** Every OSM value keeps its own `source_id` so you can always
answer "which fields came from OSM" and attribute them on the pages that use
them, without being forced to open the whole graph.

**Google Places is not a data source you can build on.** Its terms restrict
caching and prohibit using the content to build a competing directory.
`sources/places.ts` enforces a hard field allowlist: `place_id`, name,
address, coordinates — no ratings, no reviews, no photos, ever. Use it to
learn that a business exists, then go verify it by phone.

## The admin

- **/admin** — graph state, queue depth, recent job runs
- **/admin/matches** — the merge queue, with differing fields highlighted and
  a "keep left / keep right / they're different" decision per pair
- **/admin/entities/[id]** — every value we have for every field, which source
  said it, its computed weight, and which one currently wins. Hand corrections
  land as a `manual` candidate at full confidence rather than overwriting
  anything, so the displaced value is still there and still explainable.
- **/admin/sources** — trust levels, record counts, and a fetch trigger

Auth is one shared password (`ADMIN_PASSWORD`), checked in the admin layout
*and* in every server action — a server action is its own endpoint.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm db:local` | embedded Postgres in `data/pgdata`, no install needed |
| `pnpm db:generate` | regenerate migrations after a schema change |
| `pnpm db:migrate` | apply extensions + migrations |
| `pnpm db:seed` | pilot places, categories, services, attributes, sources |
| `pnpm db:studio` | drizzle studio |
| `pnpm ingest <cmd>` | run pipeline steps directly, no Redis needed |
| `pnpm ingest manual <csv>` | import a hand-collected CSV |
| `pnpm ingest publish [min]` | publish drafts above a score |
| `pnpm ingest lists` | rebuild published lists and re-apply the index gate |
| `pnpm ingest article <place> <category>` | scaffold a guide article from a ranking |
| `pnpm db:seed:demo` | design fixture data (`--clear` to remove) |
| `pnpm covers:fetch` / `pnpm logos:fetch` | category cover art / business logos |
| `pnpm dev:web` / `pnpm dev:worker` | admin / queue worker |
| `pnpm test` | core unit tests |
| `pnpm typecheck` | every package |

### Deployment

| Command | What it does |
| --- | --- |
| `pnpm build` | production build |
| `pnpm db:bootstrap` | fill a remote database from scratch (refuses localhost) |
| `pnpm export:static` | public site as plain files, for GitHub Pages |
| `pnpm deploy:pages` | push `apps/web/out` to the `gh-pages` branch |

**[docs/deploy.md](docs/deploy.md)** — host the whole app free on Vercel + Neon.
This is the one to use: the admin, search and live data all work.

**[docs/static-export.md](docs/static-export.md)** — GitHub Pages. Works, but
drops `/admin` and search and freezes the data at build time, so it suits a
presentation rather than a cofounder who wants to click things.

## The public site

```
/                             search + categories in the pilot city
/strumica                     city hub
/strumica/brza-hrana          category list
/strumica/picerii/dostava     facet - only pizzerias that deliver
/strumica/picerii/pizza-slice business profile
/robots.txt  /sitemap.xml
```

Every list page is materialised by `buildList()`, which does two separate
things and never mixes them:

- the **organic order is the AIVIDI Score**, and nothing else — money is not an
  input to that function
- **sponsored slots** come from active `featured` / `ai_visibility`
  subscriptions, are capped at two, sit above the list under a
  «Спонзорирано» label, and are excluded from the `ItemList` structured data.
  The list published to machines is the ranking, and the ranking is not for
  sale.

Pages that fail the index gate still render for people but ship `noindex`, and
they never enter the sitemap.

### Design

The audience is a whole town — a teenager on a cheap Android and a 75-year-old
who wants a phone number they can read. That produced:

- **18px base text** with a three-step size control (up to 22.5px) in the
  header, persisted per visitor
- **the phone number as both readable text and a 52px call target** — calling
  is the primary action for most of this audience, not a booking form
- **"Отворено сега"** computed server-side in `Europe/Skopje` and shown before
  anything else, because it is what people are actually checking
- no hover-only affordances, no icon-only controls, WCAG AA contrast minimum
- light and dark themes, because the two ends of that age range have opposite
  defaults and both are right
- Onest for type — it carries Cyrillic properly at every weight, which most
  geometric sans faces do not

### Crawlers

`robots.ts` names and allows `GPTBot`, `OAI-SearchBot`, `ClaudeBot`,
`PerplexityBot`, `Google-Extended`, `CCBot` and the rest explicitly. That is
deliberate: the whole GEO thesis is that being the cheapest correct source to
quote beats the pageview lost when a model answers instead of linking.

## Hand-collected data

The highest-value input into the graph, and the one that builds the moat. One
CSV per category per town:

```bash
pnpm ingest manual data/strumica-picerii.csv "Тимо"
pnpm ingest publish && pnpm ingest lists
```

`data/ПРИМЕР-strumica-picerii.csv` is a filled template. Only `name` and
`category` are required; every other column is optional and skipped when empty.

| Column | Example | Notes |
| --- | --- | --- |
| `name` | `Виа Пица` | required |
| `category` | `picerii` | required, a category slug |
| `address` | `Партизанска 5` | |
| `lat`, `lng` | `41.437612`, `22.643188` | from the map pin — **only real coordinates** |
| `phone` | `070/123-456` | several allowed, comma-separated |
| `website` `facebook` `instagram` `email` | `viapica.mk` | bare domains and handles are fine |
| `description` | one or two factual sentences | |
| `summary` | `Гостите редовно ја фалат…` | **our words** — see below |
| `hours` | `Mo-Su 10:00-23:00` | OSM opening_hours syntax |
| `attributes` | `dostava\|terasa\|parking` | attribute slugs, pipe-separated |
| `services` | `pica-golema:260-340\|dostava-pica:50` | `slug:from-to` in MKD |
| `rating` `rating_count` `rating_source` | `4.6`, `213`, `google` | internal signal, never rendered |

Unknown service slugs are skipped with a warning rather than attached to the
wrong category. Re-importing the same file updates rather than duplicates, and
unchanged rows are skipped by content hash.

### On reviews and photos

`summary` holds **our** summary of what customers consistently say
("Гостите редовно ја фалат тенката кора; забелешка е дека нема паркинг"), not
pasted review text. Individual reviews are written by identifiable people and
are not ours to republish — and a summary is the more citable artefact anyway,
since every model already has the raw reviews from where they were posted.
The same goes for photos: shoot them, or get them from the owner.

`rating` / `rating_count` are kept as an **internal prioritisation signal**.
They decide who gets called first and never appear on a public page — a number
we did not compute should not look like ours.

## Demo data

`pnpm db:seed:demo` inserts ~18 **invented** businesses across the three
starter categories, spread over Strumica and its villages. The names of the
three sponsored entries are real requests; everything else — phone numbers,
addresses, hours, prices — is made up, and the phone numbers sit in an
unusable `+389 70 000 0xx` block so nobody can dial one by accident.

Nothing in it is verified, so every card renders the "Непроверено" state. It
exists so the layout has something to hold while the design is worked on.
Replace it with real ingested and phone-verified data before the site is
public:

```bash
pnpm db:seed:demo --clear
```

## Not built yet

Photos (the card avatars are generated initials until there are real ones),
the claim flow, self-serve subscriptions and billing, Albanian translations
(the `name_sq` columns and `/sq/` routing are in place, the strings are not),
a real submission form behind `/prijavi` instead of a mailto, and the GEO
query bank. The `query` / `answer_snapshot` / `mention` tables are already
there for the last one.

One thing worth doing before any of it: **run the query bank baseline.** What
the models say about Strumica businesses today cannot be reconstructed later,
and in six months that delta is the entire sales pitch.
