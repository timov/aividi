/**
 * Pushes apps/web/out to the gh-pages branch.
 *
 *   pnpm export:static && pnpm deploy:pages
 *
 * The build runs HERE rather than in CI on purpose: the site is generated from
 * the local Postgres, and GitHub Actions has no copy of it. Building where the
 * data lives is the only version of this that works today.
 *
 * Uses a detached worktree rather than checking out gh-pages in place, so the
 * working tree is never touched and an interrupted deploy cannot leave the
 * repo on the wrong branch with build output staged.
 */
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'apps', 'web', 'out')
const BRANCH = 'gh-pages'

const git = (args, cwd = root) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()

if (!existsSync(out)) {
  console.error('apps/web/out does not exist. Run `pnpm export:static` first.')
  process.exit(1)
}

try {
  git(['rev-parse', '--is-inside-work-tree'])
} catch {
  console.error('Not a git repository yet. Run `git init`, add a GitHub remote, then retry.')
  process.exit(1)
}

let remote = ''
try {
  remote = git(['remote', 'get-url', 'origin'])
} catch {
  console.error('No `origin` remote. Add one with `git remote add origin <url>`.')
  process.exit(1)
}

const work = mkdtempSync(join(tmpdir(), 'aividi-pages-'))
let failed = false

try {
  // An orphan branch on first run; afterwards just check the existing one out.
  let exists = true
  try {
    git(['rev-parse', '--verify', `refs/remotes/origin/${BRANCH}`])
  } catch {
    exists = false
  }

  if (exists) {
    git(['worktree', 'add', work, BRANCH])
    git(['reset', '--hard', `origin/${BRANCH}`], work)
  } else {
    git(['worktree', 'add', '--detach', work])
    git(['checkout', '--orphan', BRANCH], work)
  }

  // Clear everything except .git, then copy the fresh build in. A plain copy
  // would leave pages behind that no longer exist in the source.
  for (const entry of execFileSync('git', ['ls-files'], { cwd: work, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)) {
    rmSync(join(work, entry), { force: true })
  }

  cpSync(out, work, { recursive: true })

  git(['add', '-A'], work)
  const status = execFileSync('git', ['status', '--porcelain'], { cwd: work, encoding: 'utf8' })
  if (!status.trim()) {
    console.log('Nothing changed since the last deploy.')
  } else {
    git(['commit', '-m', `Deploy ${new Date().toISOString()}`], work)
    git(['push', '-u', 'origin', BRANCH], work)
    console.log(`Pushed to ${BRANCH}.`)
    console.log('In GitHub: Settings → Pages → Source: Deploy from a branch → gh-pages / (root)')
  }
} catch (err) {
  failed = true
  console.error('Deploy failed:', err instanceof Error ? err.message : err)
} finally {
  try {
    git(['worktree', 'remove', work, '--force'])
  } catch {
    rmSync(work, { recursive: true, force: true })
  }
}

process.exit(failed ? 1 : 0)
