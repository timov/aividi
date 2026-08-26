import type { MetadataRoute } from 'next'

// Depends only on env, never on the request — and a static export requires
// this to be declared explicitly.
export const dynamic = 'force-static'
import { IS_INDEXABLE, SITE_URL } from '@/lib/seo'

/**
 * Most sites are busy blocking AI crawlers. We do the opposite, on purpose.
 *
 * The entire GEO thesis is that being the cheapest correct source to quote is
 * worth more than the pageview we lose when a model answers instead of linking.
 * Blocking GPTBot to protect traffic we do not have yet would be trading the
 * business model for nothing. Every one of these is named explicitly rather
 * than left to a wildcard, so the intent survives the next person to edit this
 * file.
 */
const AI_CRAWLERS = [
  'GPTBot', // OpenAI training + ChatGPT browsing
  'OAI-SearchBot', // ChatGPT search index
  'ChatGPT-User', // a person asking ChatGPT to open a page
  'ClaudeBot',
  'Claude-User',
  'anthropic-ai',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended', // Gemini grounding
  'Applebot-Extended',
  'CCBot', // Common Crawl - feeds most open models
  'Bingbot',
  'DuckDuckBot',
  'YandexBot',
  'meta-externalagent',
]

export default function robots(): MetadataRoute.Robots {
  // A preview deployment refuses everyone, including the crawlers we court in
  // production. Splitting the same content across two crawlable hosts is the
  // one own goal this whole strategy cannot afford.
  if (!IS_INDEXABLE) {
    return { rules: [{ userAgent: '*', disallow: '/' }] }
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Nothing here is secret, but none of it belongs in an index either:
        // the admin, and per-query search pages.
        disallow: ['/admin', '/admin/', '/login', '/prebaraj'],
      },
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: '/',
        disallow: ['/admin', '/admin/', '/login', '/prebaraj'],
      })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
