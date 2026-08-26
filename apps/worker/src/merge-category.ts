/**
 * Folds one category into another and deletes the source.
 *
 *   pnpm --filter @aividi/worker exec tsx src/merge-category.ts gostilnici restorani
 *
 * "Гостилница" and "кафеана" name the same room, so keeping both split every
 * ranking in two and made the categories people actually search for look
 * thinner than they are. This is the one-off that repairs data already in the
 * database; the seed no longer creates the source category at all.
 *
 * Lists are dropped rather than moved: a list is a rendered ranking over a
 * (place, category) pair, and merging changes who is in that ranking, so the
 * only honest thing to do is rebuild them from the merged membership.
 */
import { and, category, db, entityCategory, eq, inArray, list, query, service, sql } from '../../../packages/db/src/index.js'

const [fromSlug, intoSlug] = process.argv.slice(2)
if (!fromSlug || !intoSlug) {
  console.error('usage: merge-category.ts <from-slug> <into-slug>')
  process.exit(1)
}

const cats = await db.select().from(category).where(inArray(category.slug, [fromSlug, intoSlug]))
const from = cats.find((c) => c.slug === fromSlug)
const into = cats.find((c) => c.slug === intoSlug)

if (!from) {
  console.log(`nothing to do — "${fromSlug}" is not in the database`)
  process.exit(0)
}
if (!into) {
  console.error(`target category "${intoSlug}" does not exist`)
  process.exit(1)
}

// Memberships: an entity already in both would violate the composite key, so
// move the ones that can move and drop the duplicates.
const moved = await sql`
  UPDATE entity_category ec SET category_id = ${into.id}
  WHERE ec.category_id = ${from.id}
    AND NOT EXISTS (
      SELECT 1 FROM entity_category o
      WHERE o.entity_id = ec.entity_id AND o.category_id = ${into.id}
    )
`
const dropped = await db
  .delete(entityCategory)
  .where(eq(entityCategory.categoryId, from.id))
  .returning({ id: entityCategory.entityId })

// Services keyed by the same slug already exist on the target; the rest come over.
const kept = await sql`
  UPDATE service s SET category_id = ${into.id}
  WHERE s.category_id = ${from.id}
    AND NOT EXISTS (
      SELECT 1 FROM service o WHERE o.category_id = ${into.id} AND o.slug = s.slug
    )
`

await db.delete(service).where(eq(service.categoryId, from.id))
await db.delete(list).where(eq(list.categoryId, from.id))
await db.delete(query).where(eq(query.categoryId, from.id))
await db.delete(category).where(eq(category.id, from.id))

console.log(
  `merged ${fromSlug} → ${intoSlug}: ${moved.count} moved, ${dropped.length} already there, ${kept.count} services carried over`,
)
console.log('now rebuild the lists:  pnpm lists:build')
process.exit(0)
