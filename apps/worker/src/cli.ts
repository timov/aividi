import { basename, resolve } from 'node:path'
import { and, db, entity, eq, isNull, ne, raw, source, sourceRecord } from '@aividi/db'
import { ingest, promote, rebuildAllLists, rebuildListsForPlace, score,
  scaffoldArticle,
} from '@aividi/pipeline'

/**
 * Run a pipeline step directly, without Redis in the way.
 *
 *   pnpm ingest sources
 *   pnpm ingest run osm 50
 *   pnpm ingest promote
 *   pnpm ingest score
 */

const [command, ...args] = process.argv.slice(2)

async function main() {
  switch (command) {
    case 'sources': {
      const rows = await db.select().from(source)
      for (const s of rows) {
        console.log(
          `${s.kind.padEnd(20)} trust=${String(s.trust).padStart(3)}  ` +
            `last=${s.lastRunAt?.toISOString().slice(0, 16) ?? 'never'}  ${s.name}`,
        )
      }
      break
    }

    case 'run': {
      const kind = args[0]
      const limit = args[1] ? Number(args[1]) : undefined
      if (!kind) throw new Error('usage: run <source-kind> [limit]')

      const [src] = await db.select().from(source).where(eq(source.kind, kind as never)).limit(1)
      if (!src) throw new Error(`no source of kind "${kind}" - run pnpm db:seed first`)

      console.log(`ingesting from ${src.name}...`)
      const result = await ingest(src.id, limit)
      console.log({
        fetched: result.fetched,
        inserted: result.inserted,
        unchanged: result.unchanged,
      })
      console.log('now run: pnpm ingest promote')
      break
    }

    case 'promote': {
      const pending = await db
        .select({ id: sourceRecord.id })
        .from(sourceRecord)
        .where(isNull(sourceRecord.processedAt))
        .limit(args[0] ? Number(args[0]) : 5000)

      console.log(`promoting ${pending.length} records...`)
      const tally: Record<string, number> = {}

      for (const [i, record] of pending.entries()) {
        const result = await promote(record.id)
        tally[result.action] = (tally[result.action] ?? 0) + 1
        if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${pending.length}`)
      }

      console.log(tally)
      break
    }

    case 'score': {
      const rows = await db
        .select({ id: entity.id })
        .from(entity)
        .where(ne(entity.status, 'merged'))
      console.log(`scoring ${rows.length} entities...`)
      for (const row of rows) await score(row.id)
      console.log('done')
      break
    }

    case 'manual': {
      // pnpm ingest manual data/strumica-picerii.csv
      const file = args[0]
      if (!file) throw new Error('usage: manual <file.csv> [collectedBy]')

      // pnpm runs scripts with cwd inside the package, so a path typed at the
      // repo root has to be resolved against where the user actually was.
      const path = resolve(process.env.INIT_CWD ?? process.cwd(), file)
      const name = `Рачно внесени: ${basename(path)}`
      const [src] = await db
        .insert(source)
        .values({
          kind: 'manual',
          name,
          trust: 95,
          config: { path, collectedBy: args[1] ?? 'manual' },
        })
        .onConflictDoUpdate({
          target: [source.kind, source.name],
          set: { config: { path, collectedBy: args[1] ?? 'manual' }, trust: 95 },
        })
        .returning({ id: source.id })

      if (!src) throw new Error('could not register the source')

      const result = await ingest(src.id, undefined)
      console.log({ rows: result.fetched, new_or_changed: result.inserted, unchanged: result.unchanged })

      const tally: Record<string, number> = {}
      for (const id of result.newRecordIds) {
        const r = await promote(id)
        tally[r.action] = (tally[r.action] ?? 0) + 1
        if (r.entityId) await score(r.entityId)
      }
      console.log(tally)
      console.log('now run: pnpm ingest publish && pnpm ingest lists')
      break
    }

    case 'publish': {
      // Bulk-publishes reviewed-enough drafts so a pilot city can go live
      // without clicking through hundreds of rows. It is deliberately explicit
      // and takes a minimum score, because publishing is the one step that
      // should never happen as a side effect of ingestion.
      const min = args[0] ? Number(args[0]) : 0
      const rows = await db
        .select({ id: entity.id })
        .from(entity)
        .where(and(eq(entity.status, 'draft'), raw`coalesce(${entity.score}, 0) >= ${min}`))
      for (const row of rows) {
        await db.update(entity).set({ status: 'published' }).where(eq(entity.id, row.id))
      }
      console.log(`published ${rows.length} drafts with score >= ${min}`)
      console.log('now run: pnpm ingest lists')
      break
    }

    case 'lists': {
      // No argument rebuilds every town that has published businesses.
      const placeSlug = args[0]
      console.log(placeSlug ? `rebuilding lists for ${placeSlug}...` : 'rebuilding all towns...')
      const results = placeSlug
        ? await rebuildListsForPlace(placeSlug)
        : await rebuildAllLists()
      for (const r of results.filter((x) => x.organic + x.sponsored > 0)) {
        console.log(
          `  ${r.indexable ? 'index  ' : 'noindex'} /${r.slug}  ` +
            `${r.organic}+${r.sponsored}  ${r.gateReason}`,
        )
      }
      break
    }

    case 'article': {
      // pnpm ingest article <place> <category> [--limit N] [--author "Име"]
      const [placeSlug, categorySlug] = args
      if (!placeSlug || !categorySlug) {
        console.error('usage: article <place> <category> [--limit N] [--author "Име"]')
        process.exitCode = 1
        break
      }
      const limitArg = args.indexOf('--limit')
      const authorArg = args.indexOf('--author')
      const r = await scaffoldArticle(placeSlug, categorySlug, {
        limit: limitArg > -1 ? Number(args[limitArg + 1]) : undefined,
        authorName: authorArg > -1 ? args[authorArg + 1] : undefined,
      })
      console.log(`article ${r.slug}: ${r.entries} entries` + (r.removed ? `, ${r.removed} dropped` : ''))
      console.log(
        r.created
          ? 'created as a DRAFT — write the roles and verdicts, then publish:'
          : 'refreshed; existing prose was left untouched:',
      )
      console.log(`  /admin/articles/${r.articleId}`)
      break
    }

    case 'stats': {
      const [counts] = await db
        .select({
          entities: raw<number>`count(*) filter (where status <> 'merged')::int`,
          published: raw<number>`count(*) filter (where status = 'published')::int`,
          drafts: raw<number>`count(*) filter (where status = 'draft')::int`,
          verified: raw<number>`count(*) filter (where verified_at is not null)::int`,
          withPhone: raw<number>`count(*) filter (where phone_e164 is not null)::int`,
        })
        .from(entity)
      console.log(counts)
      break
    }

    default:
      console.log(
        [
          'usage:',
          '  pnpm ingest sources            list configured sources',
          '  pnpm ingest run <kind> [limit] fetch records from a source',
          '  pnpm ingest promote [limit]    turn raw records into entities',
          '  pnpm ingest score              recompute every AIVIDI score',
          '  pnpm ingest manual <file.csv>  import a hand-collected CSV',
          '  pnpm ingest publish [minScore] publish drafts (default: all)',
          '  pnpm ingest lists [place]      rebuild lists (all towns if omitted)',
          '  pnpm ingest stats              entity counts',
        ].join('\n'),
      )
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
