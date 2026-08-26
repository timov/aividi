# Hosting the showcase on GitHub Pages

Yes — the **public** site exports to plain files and runs on GitHub Pages. It is
built and verified: 230 pages, 123 HTML files, ~23 MB.

```bash
pnpm export:static                          # → apps/web/out
EXPORT_BASE_PATH=/aividi pnpm export:static  # project site at user.github.io/aividi
pnpm deploy:pages                           # pushes apps/web/out → gh-pages branch
```

Then in GitHub: **Settings → Pages → Source: Deploy from a branch → `gh-pages` / (root)**.

For a user or organisation site (`user.github.io`) leave `EXPORT_BASE_PATH`
unset. For a project site (`user.github.io/aividi`) it **must** be set, or every
stylesheet and script 404s.

## What you lose

A static export has no server. Three things stop existing:

| Gone | Why |
| --- | --- |
| `/admin` and `/login` | Server actions and cookie auth need a running server |
| `/prebaraj` (search) | Reads the query string server-side |
| Freshness | Every page is frozen at build time — no ISR, no revalidation |

The export script moves those routes into `_`-prefixed folders, which Next
excludes from routing, and moves them back in a `finally` block — so a failed or
interrupted build still leaves your working tree exactly as it was.

Editing data therefore means: change it in the local admin → `pnpm export:static`
→ `pnpm deploy:pages`. The published site is a snapshot, not a live view.

## Why the build is local, not CI

The site is generated from your local Postgres. GitHub Actions has no copy of
it, so a workflow that builds on push would produce an empty site. Building
where the data lives is the only version that works today.

If you later want true build-on-push, CI needs to reproduce the database:
a Postgres service container, `pnpm db:migrate`, `pnpm db:seed`, then importing
`data/*.csv`. That is worth doing once the CSVs are the whole source of truth —
right now a chunk of the data came from OSM ingestion, which would make CI
builds slow and network-dependent.

## Before the first deploy

The repo is not initialised yet:

```bash
git init && git add -A && git commit -m "Initial commit"
git remote add origin git@github.com:<you>/aividi.git
git push -u origin main
```

`.nojekyll` is written into the output automatically. Without it GitHub runs the
site through Jekyll, which silently drops every directory starting with an
underscore — including Next's `_next/`, so the site would load with no CSS or
JS at all.

## Indexing

`SITE_INDEXABLE` defaults to off for preview hosts, and `github.io` is not in
that list — so **set `SITE_INDEXABLE=0` in `.env` while the showcase is up**, or
the demo will compete with `aividi.mk` for the queries the real site is meant to
win. Set `SITE_URL` to the Pages URL too, so canonicals and the sitemap match
where it actually lives.

## When to stop using this

The moment you want the admin, live search, or data that updates without a
rebuild. That is Vercel plus a managed Postgres (Neon's free tier), which runs
the app as it actually is. GitHub Pages is right for a presentation and wrong
for the product.
