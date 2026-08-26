# Hosting the whole app, free

The real app — admin, search, live data. Two free services, about 20 minutes.

| | Service | Free tier |
| --- | --- | --- |
| App | **Vercel** Hobby | Unlimited deploys, sleeps never |
| Database | **Neon** | 0.5 GB, does not expire |

Both deploy on every push once connected. Nothing to pay, no card for either.

---

## 1. Put the code on GitHub

The repo is not initialised yet.

```bash
cd c:/aividi
git init
git add -A
git commit -m "Initial commit"
git branch -M main
git remote add origin git@github.com:<you>/aividi.git
git push -u origin main
```

Check `.env` is **not** committed — it holds the admin password:

```bash
git check-ignore -v .env      # should print a .gitignore line
```

If it prints nothing, add `.env` to `.gitignore` and commit again before pushing.

## 2. Create the database

1. [neon.tech](https://neon.tech) → sign in with GitHub → **Create project**
2. Name it `aividi`, region **Frankfurt** (closest to Macedonia)
3. Copy the connection string — it looks like
   `postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`

Neon runs Postgres 17, which clears the Postgres 15+ floor this schema needs.

## 3. Fill the database

From your machine, pointed at Neon:

```bash
DATABASE_URL="postgresql://…neon.tech/neondb?sslmode=require" pnpm db:bootstrap
```

That runs migrations, seeds places and categories, imports every CSV in `data/`,
matches and promotes, publishes, and builds the lists. Re-runnable — the seed
upserts and re-importing a CSV matches existing rows rather than duplicating.

It refuses to run against `localhost`, so you cannot rebuild your dev database
by accident.

Then, optionally:

```bash
DATABASE_URL="…" pnpm ingest article skopje restorani
DATABASE_URL="…" pnpm logos:fetch
```

## 4. Deploy the app

1. [vercel.com](https://vercel.com) → **Add New → Project** → import the repo
2. **Root Directory: `apps/web`** ← the one setting that matters. Tick
   *Include files outside the root directory* so the workspace packages resolve.
3. Framework preset: **Next.js** (auto-detected). Leave the build command alone.
4. Add environment variables:

| Name | Value |
| --- | --- |
| `DATABASE_URL` | the Neon string from step 2 |
| `SITE_URL` | `https://<project>.vercel.app` (update after step 5) |
| `SITE_INDEXABLE` | `0` |
| `ADMIN_PASSWORD` | something real, not `promeni-me` |
| `ADMIN_SECRET` | `openssl rand -hex 32` |

5. **Deploy.**

`SITE_INDEXABLE=0` matters: without it a `vercel.app` copy competes with
`aividi.mk` for the exact queries the real site is built to win. Preview hosts
are refused automatically, but set it explicitly so nothing depends on that.

## 5. Point the domain at it

Vercel → Project → **Settings → Domains** → add `aividi.mk`, then set the two
records it shows you at your registrar. Once it resolves, change `SITE_URL` to
`https://aividi.mk` and `SITE_INDEXABLE` to `1`, and redeploy.

---

## After that

Every `git push` to `main` deploys. Pull requests get their own preview URL,
which is a good way to show your cofounder a change before it is live.

The admin lives at `/admin` with the password from step 4. Data edits there take
effect immediately — no rebuild, unlike the static export.

## Notes

- **Node 20+.** Vercel defaults to 22. Locally you are on 18.20.8, which is
  below the `engines` floor — it works, but the deployed runtime is newer.
- **No `.env` on Vercel.** `next.config.mjs` loads one if present and shrugs if
  not; the platform supplies the variables instead.
- **Redis is optional.** BullMQ is only used when `REDIS_URL` is set. Leave it
  unset and the CLI runs the same pipeline directly.
- **The worker does not need hosting.** Keep running `pnpm ingest …` from your
  machine against the Neon URL.

## What about GitHub Pages?

Still works — `pnpm export:static`, documented in [static-export.md](./static-export.md)
— but it drops `/admin`, drops search, and freezes the data at build time. For a
cofounder who wants to click things, host the app.
