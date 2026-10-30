/**
 * ARCHITECTURE § 0 rule 11 (owner 191): a branch that changes how performance is measured or what it measured
 * must also teach docs/ARCHITECTURE.md (§ 17.1 rule or § 23 lesson). Compares the branch with its merge base on
 * main; on main itself, or with no main to compare against, there is nothing to check.
 */
import {execSync} from 'node:child_process'

const sh = (cmd: string) => execSync(cmd, {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim()

function changedFiles(): string[] | null {
  try {
    const base = sh('git merge-base HEAD main')
    if (base === sh('git rev-parse HEAD')) return null
    return sh(`git diff --name-only ${base}`).split('\n').filter(Boolean)
  } catch {
    return null
  }
}

const PERF = [/^apps\/client\/perf\//, /^apps\/client\/e2e-renders\/baseline\.json$/, /^apps\/client\/playwright\.perf\.config\.ts$/]

const files = changedFiles()
if (files) {
  const perfFiles = files.filter(f => PERF.some(re => re.test(f)))
  const matrixNumbers = files.includes('docs/COMPLETION_MATRIX.md') && /\d+(\.\d+)?\s?ms\b/.test(safeDiff('docs/COMPLETION_MATRIX.md'))
  const taught = files.includes('docs/ARCHITECTURE.md') && lessonDiff() !== ''
  if ((perfFiles.length > 0 || matrixNumbers) && !taught) {
    console.error(
      'lessonsGate: this branch changes performance measurements but not ARCHITECTURE § 17.1 or § 23 (§ 0 rule 11).\n' +
        `  perf files: ${perfFiles.join(', ') || '-'}${matrixNumbers ? '\n  measured numbers in docs/COMPLETION_MATRIX.md' : ''}\n` +
        '  Add what you learned as a § 17.1 rule and a dated § 23 lesson.',
    )
    process.exit(1)
  }
}

function safeDiff(file: string) {
  try {
    return sh(`git diff ${sh('git merge-base HEAD main')} -- ${file}`)
      .split('\n')
      .filter(l => l.startsWith('+') && !l.startsWith('+++'))
      .join('\n')
  } catch {
    return ''
  }
}

/* Added or removed lines inside § 17 (including 17.1) or § 23 of ARCHITECTURE.md. */
function lessonDiff() {
  try {
    const base = sh('git merge-base HEAD main')
    const out = sh(`git diff -U0 ${base} -- docs/ARCHITECTURE.md`)
    const now = sh('cat docs/ARCHITECTURE.md').split('\n')
    const sections = (start: string, end: string) => {
      const a = now.findIndex(l => l.startsWith(start))
      const b = now.findIndex((l, i) => i > a && l.startsWith(end))
      return [a + 1, b < 0 ? now.length : b]
    }
    const ranges = [sections('## 17.', '## 18.'), sections('## 23.', '## 24.')]
    const hunks = [...out.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)]
    const touched = hunks.some(([, start, len]) => {
      const from = Number(start)
      const to = from + Math.max(Number(len ?? 1), 1) - 1
      return ranges.some(([a, b]) => from <= b && to >= a)
    })
    return touched ? '+' : ''
  } catch {
    return ''
  }
}
