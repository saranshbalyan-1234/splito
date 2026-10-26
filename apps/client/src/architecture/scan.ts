import {readdirSync, readFileSync} from 'node:fs'
import {join, relative} from 'node:path'

import {reuseContext, type RuleName, RULES} from './rules'

/** The repo root, from this file (`apps/client/src/architecture/`). */
export const REPO_ROOT = join(import.meta.dir, '../../../..')

const ROOTS = ['apps/client/src', 'packages/domain/src', 'packages/sync/src']
const SOURCE = /\.(?:tsx?|jsx?)$/
const SKIP = /\.test\.|\.d\.ts$|\/architecture\//

function walk(dir: string, out: string[]) {
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'locales' && entry.name !== 'node_modules') walk(path, out)
    } else if (SOURCE.test(entry.name)) out.push(path)
  }
}

/** Every checked source file, repo-relative. Tests, `.d.ts` and this directory are skipped. */
export function sourceFiles(root = REPO_ROOT): string[] {
  const files: string[] = []
  for (const r of ROOTS) walk(join(root, r), files)
  return files.map(f => relative(root, f).split('\\').join('/')).filter(f => !SKIP.test(f)).sort()
}

/** Non-zero counts per rule, then per file. */
export function countAll(root = REPO_ROOT): Record<RuleName, Record<string, number>> {
  const reuseDir = join(root, 'docs/reuse')
  const docs = readdirSync(reuseDir)
    .filter(f => f.endsWith('.md'))
    .map(f => readFileSync(join(reuseDir, f), 'utf8'))
  const ctx = reuseContext(docs)
  const counts = Object.fromEntries(Object.keys(RULES).map(k => [k, {}])) as Record<RuleName, Record<string, number>>
  for (const path of sourceFiles(root)) {
    const source = readFileSync(join(root, path), 'utf8')
    for (const [name, rule] of Object.entries(RULES) as [RuleName, (typeof RULES)[RuleName]][]) {
      if (!rule.appliesTo(path)) continue
      const n = rule.count(path, source, ctx)
      if (n > 0) counts[name][path] = n
    }
  }
  return counts
}
