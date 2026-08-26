/**
 * Facet modifiers.
 *
 * A modifier is the third URL segment: /strumica/picerii/dostava/. Each one
 * must declare the dimension it adds over the parent category page - that
 * declaration is what the index gate checks. A facet that shows the same
 * businesses with the same fields as its parent is a duplicate with a
 * different title, and it does not get indexed.
 */

export interface ModifierDef {
  slug: string
  /** Rendered as the H1 and the <title>. */
  title: (category: string, place: string) => string
  /** Short answer-block lead-in, filled with real counts by the page. */
  lead: (category: string, place: string) => string
  /** What this page shows that the category page does not. Feeds the gate. */
  dimension: string
  /** Only entities carrying this attribute slug qualify. */
  requiresAttribute?: string
  /** Only entities with at least one priced service qualify. */
  requiresPricedServices?: boolean
  /** Only entities open on Saturday or Sunday qualify. */
  requiresWeekend?: boolean
}

export const MODIFIERS: Record<string, ModifierDef> = {
  najdobri: {
    slug: 'najdobri',
    title: (c, p) => `Најдобри ${c.toLowerCase()} во ${p}`,
    lead: (c, p) => `Рангирана листа на ${c.toLowerCase()} во ${p}`,
    dimension: 'рангирање по AIVIDI Score',
  },
  dostava: {
    slug: 'dostava',
    title: (c, p) => `${c} со достава во ${p}`,
    lead: (c, p) => `${c} што доставуваат во ${p}`,
    dimension: 'достава',
    requiresAttribute: 'dostava',
  },
  ceni: {
    slug: 'ceni',
    title: (c, p) => `Цени: ${c.toLowerCase()} во ${p}`,
    lead: (c, p) => `Ориентациони цени кај ${c.toLowerCase()} во ${p}`,
    dimension: 'цени по услуга',
    requiresPricedServices: true,
  },
  'otvoreno-vikend': {
    slug: 'otvoreno-vikend',
    title: (c, p) => `${c} отворени викенд во ${p}`,
    lead: (c, p) => `${c} што работат сабота и недела во ${p}`,
    dimension: 'работно време за викенд',
    requiresWeekend: true,
  },
  parking: {
    slug: 'parking',
    title: (c, p) => `${c} со паркинг во ${p}`,
    lead: (c, p) => `${c} со сопствен паркинг во ${p}`,
    dimension: 'паркинг',
    requiresAttribute: 'parking',
  },
}

export function getModifier(slug: string): ModifierDef | null {
  return MODIFIERS[slug] ?? null
}

export function isModifier(slug: string): boolean {
  return slug in MODIFIERS
}
