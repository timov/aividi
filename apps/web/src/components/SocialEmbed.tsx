import Script from 'next/script'

/**
 * An embedded Instagram post, the way lyonsecret.com illustrates each
 * restaurant.
 *
 * Embedding rather than re-hosting is the whole point. The image stays on
 * Instagram's servers, keeps its attribution, and links back to the business —
 * so this stays on the right side of the rule that we never republish somebody
 * else's photographs. A copy saved into /uploads would not.
 *
 * The cost is a third-party script, so it is paid only when an article
 * actually has an embed: the loader is rendered once per page, by the page,
 * and never on articles without one.
 */
export function InstagramEmbed({ url }: { url: string }) {
  const permalink = normalise(url)
  if (!permalink) return null

  return (
    <blockquote
      className="instagram-media embed-ig"
      data-instgrm-permalink={`${permalink}?utm_source=ig_embed`}
      data-instgrm-version="14"
    >
      {/* Visible until the script swaps it, so a blocked or deleted embed
          still leaves a working link rather than an empty rectangle. */}
      <a href={permalink} target="_blank" rel="noopener noreferrer nofollow">
        Види ја објавата на Instagram
      </a>
    </blockquote>
  )
}

/** Rendered once per article, only when at least one entry carries an embed. */
export function EmbedLoader() {
  return <Script src="https://www.instagram.com/embed.js" strategy="lazyOnload" />
}

/**
 * Only real Instagram post URLs are allowed through. The value is editor-typed
 * and lands in an attribute the embed script acts on, so anything that is not
 * a post permalink is dropped rather than rendered.
 */
export function normalise(url: string): string | null {
  try {
    const u = new URL(url.trim())
    if (!/(^|\.)instagram\.com$/.test(u.hostname)) return null
    const m = u.pathname.match(/^\/(p|reel|tv)\/([A-Za-z0-9_-]+)\/?$/)
    return m ? `https://www.instagram.com/${m[1]}/${m[2]}/` : null
  } catch {
    return null
  }
}
