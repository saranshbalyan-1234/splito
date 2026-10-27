/**
 * Architecture rules (ARCHITECTURE.md § 1, § 4, § 6, § 11, § 16.2, § 19; A-001,
 * A-002 import boundaries). Each rule is a pure counter over one file's source;
 * `rules.test.ts` compares the counts with `baseline.ts`, which only goes down.
 *
 * Paths are repo-relative with forward slashes (`apps/client/src/...`,
 * `packages/domain/src/...`). Comments never count; string contents count
 * only for rules that look inside strings (colours, import specifiers).
 */

export const CLIENT = 'apps/client/src/'
const DOMAIN = 'packages/domain/src/'
const SYNC = 'packages/sync/src/'

/** What a counter may know besides the file: the reuse record in `docs/`. */
export type RuleContext = {
  /** Every client path (`src/...`) named anywhere in `docs/reuse/*.md`. */
  reusePaths: ReadonlySet<string>
  /** Client paths listed under a "Copied ..." heading of `docs/reuse/*.md`. */
  copiedPaths: ReadonlySet<string>
}

export type Rule = {
  /** One line on what counts, printed when the rule fails. */
  why: string
  appliesTo: (path: string) => boolean
  count: (path: string, source: string, ctx: RuleContext) => number
}

/* -------------------------------------------------------------------------- */
/* Source scanning                                                            */
/* -------------------------------------------------------------------------- */

const REGEX_BEFORE = new Set(['', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '~', '^'])
const REGEX_KEYWORDS = new Set(['return', 'typeof', 'case', 'in', 'of', 'yield', 'await'])

/**
 * The source with comments blanked (newlines kept) and, when `strings` is
 * false, string and template contents blanked too (template `${...}` code is
 * kept). Regex literals are kept as code; a heuristic decides `/` vs regex.
 */
export function blank(source: string, {strings}: {strings: boolean}): string {
  const out: string[] = []
  let i = 0
  const n = source.length
  // Brace depth at which each open template's `${` started.
  const templates: number[] = []
  let depth = 0
  // The last significant code character ('x' after an operand) and the last word, to tell `/` from a regex.
  let last = ''
  let word = ''
  const keep = (s: string) => out.push(s)
  const hide = (s: string) => out.push(s.replace(/[^\n]/g, ' '))
  const operand = () => {
    last = 'x'
    word = ''
  }
  const readString = (quote: string) => {
    let j = i + 1
    while (j < n && source[j] !== quote && source[j] !== '\n') j += source[j] === '\\' ? 2 : 1
    keep(quote)
    ;(strings ? keep : hide)(source.slice(i + 1, j))
    if (j < n && source[j] === quote) keep(quote)
    i = j + 1
    operand()
  }
  // Reads template text from i (just after ` or }) up to its end or the next `${`.
  const readTemplateText = () => {
    let j = i
    while (j < n && source[j] !== '`' && !(source[j] === '$' && source[j + 1] === '{')) j += source[j] === '\\' ? 2 : 1
    ;(strings ? keep : hide)(source.slice(i, j))
    if (source[j] === '`') {
      keep('`')
      i = j + 1
      operand()
    } else {
      keep('${')
      i = j + 2
      templates.push(depth)
      depth++
      last = '{'
      word = ''
    }
  }
  const special = /[/"'`{}]/g
  while (i < n) {
    special.lastIndex = i
    const at = special.exec(source)?.index ?? n
    if (at > i) {
      // A run of plain code: keep it and remember how it ends.
      const run = source.slice(i, at)
      keep(run)
      const tail = run.trimEnd()
      if (tail) {
        const c = tail[tail.length - 1]!
        last = /[\w$)\]]/.test(c) ? 'x' : c
        word = /[\w$]+$/.exec(tail)?.[0] ?? ''
      }
      i = at
      continue
    }
    const c = source[i]!
    const next = source[i + 1]
    if (c === '/' && next === '/') {
      const end = source.indexOf('\n', i)
      const j = end === -1 ? n : end
      hide(source.slice(i, j))
      i = j
    } else if (c === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2)
      const j = end === -1 ? n : end + 2
      hide(source.slice(i, j))
      i = j
    } else if (c === '"' || c === "'") {
      readString(c)
    } else if (c === '`') {
      keep('`')
      i++
      readTemplateText()
    } else if (c === '/' && (REGEX_BEFORE.has(last) || REGEX_KEYWORDS.has(word))) {
      let j = i + 1
      let inClass = false
      while (j < n && source[j] !== '\n' && (inClass || source[j] !== '/')) {
        if (source[j] === '\\') j++
        else if (source[j] === '[') inClass = true
        else if (source[j] === ']') inClass = false
        j++
      }
      keep(source.slice(i, j + 1))
      i = j + 1
      operand()
    } else if (c === '}' && templates.length && templates[templates.length - 1] === depth - 1) {
      // The end of a template's `${...}`: back to template text.
      depth--
      templates.pop()
      keep('}')
      i++
      readTemplateText()
    } else {
      if (c === '{') depth++
      if (c === '}') depth--
      keep(c)
      last = c
      word = ''
      i++
    }
  }
  return out.join('')
}

const countMatches = (text: string, re: RegExp) => text.match(re)?.length ?? 0

/** Module specifiers of static imports, re-exports, `require()` and `import()`. */
export function importsOf(source: string): string[] {
  const code = blank(source, {strings: true})
  const out: string[] = []
  const re = /(?:\bfrom\s*|\bimport\s*|\brequire\(\s*|\bimport\(\s*)(['"])([^'"\n]+)\1/g
  for (const m of code.matchAll(re)) out.push(m[2]!)
  return out
}

/* -------------------------------------------------------------------------- */
/* Money                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Names that hold money in this codebase. An arithmetic operator next to one
 * (or a unary minus before one) is money arithmetic.
 * ponytail: name-based, not type-based; a bigint named `x` slips through. The
 * full type-aware scan lives in git history (A-004 notes) if this proves leaky.
 */
const MONEY_NAME =
  /^(?:\w*(?:[aA]mount|[tT]otal|[mM]inor|[nN]et|[bB]alance|[oO]wed|[pP]aid|[rR]emaining|[dD]iscount|[sS]ubtotal)s?|tax|tip|service|share|shares|payers?)$/

const TOKEN = /[A-Za-z_$][\w$]*|\d[\d_]*(?:\.\d+)?n?|\*\*=?|[-+*/%]=?|\?\?=?|\?\.|=>|[=!]==?|[<>]=?|&&|\|\||\S/g
const ARITH = new Set(['+', '-', '*', '/', '%', '**', '+=', '-=', '*=', '/=', '%=', '**='])
/** Tokens after which `-` is unary (no left operand). */
const UNARY_AFTER = new Set(['(', '[', ',', '=', ':', '?', '{', ';', '=>', '&&', '||', '??', 'return', '===', '!==', '==', '!=', '<', '>', '<=', '>=', '!', ...ARITH])

/** The last identifier of the member chain ending at token `i` (`a.b?.c!` -> `c`). */
function chainEnd(tokens: string[], i: number): string | undefined {
  let j = i
  while (tokens[j] === '!' || tokens[j] === ')') {
    if (tokens[j] === ')') return undefined
    j--
  }
  return tokens[j]
}

/** The last identifier of the member chain starting at token `i` (`a.b?.c` -> `c`). */
function chainStart(tokens: string[], i: number): string | undefined {
  let j = i
  if (!/^[A-Za-z_$]/.test(tokens[j] ?? '')) return undefined
  while (tokens[j + 1] === '.' || tokens[j + 1] === '?.') j += 2
  // A call (`formatAmount(...)`) is not a money value by its name.
  return tokens[j + 1] === '(' ? undefined : tokens[j]
}

/** `+ - * / % **` (and their assignments) with a money-named operand, and unary minus on one. */
export function moneyOperators(code: string): number {
  const tokens = code.match(TOKEN) ?? []
  let hits = 0
  for (let i = 0; i < tokens.length; i++) {
    const op = tokens[i]!
    if (!ARITH.has(op)) continue
    const prev = tokens[i - 1] ?? ''
    const isUnary = op === '-' && (i === 0 || UNARY_AFTER.has(prev))
    if (op === '+' && isUnary) continue
    const left = isUnary ? undefined : chainEnd(tokens, i - 1)
    const right = chainStart(tokens, i + 1)
    if ((left && MONEY_NAME.test(left)) || (right && MONEY_NAME.test(right))) hits++
  }
  return hits
}

/* -------------------------------------------------------------------------- */
/* Cursor loops over money stores                                             */
/* -------------------------------------------------------------------------- */

const MONEY_STORE_ARG = /^\s*(?:['"`](?:expense|repayment|writeoff)['"`]|[A-Za-z_$][\w$.]*)\s*[,)]/

/** The index of the `}` that closes the `{` at `open`. */
function closingBrace(code: string, open: number): number {
  let depth = 0
  for (let i = open; i < code.length; i++) {
    if (code[i] === '{') depth++
    else if (code[i] === '}' && --depth === 0) return i
  }
  return code.length
}

/**
 * Loops that read a money store by cursor with nothing to stop them short of
 * its end: `do { store.page(...) } while (after)`, `while (!isDone)`,
 * `for (;;)`, `while (true)`. A loop condition that compares (`rows.length <
 * want`) is a bounded read, and a page call with `eq:`, `min:` or `max:` is a
 * range read, not the whole store. `.page(` takes the store from its first
 * argument (a literal money type, or a variable, which may hold one);
 * `.parties(` is always a money store. ponytail: textual; a cursor loop that
 * hides behind a helper slips through, and the helper is what to read.
 */
export function moneyCursorLoops(source: string): number {
  const structure = blank(source, {strings: false})
  const text = blank(source, {strings: true})
  let hits = 0
  const header = /\bdo\s*\{|\bwhile\s*\(((?:[^()]|\([^()]*\))*)\)\s*\{|\bfor\s*\(\s*;\s*;\s*\)\s*\{/g
  for (const m of structure.matchAll(header)) {
    const open = m.index + m[0].length - 1
    const close = closingBrace(structure, open)
    let cond = m[1]
    if (m[0].startsWith('do')) cond = /^\s*while\s*\(((?:[^()]|\([^()]*\))*)\)/.exec(structure.slice(close + 1))?.[1] ?? '<'
    else if (m[0].startsWith('for')) cond = 'true'
    if (/[<>]/.test(cond ?? '')) continue
    const body = text.slice(open, close)
    for (const call of body.matchAll(/\.(page|parties)\s*(?:<[^>()]*>)?\s*\(/g)) {
      const from = call.index + call[0].length
      let depth = 1
      let end = from
      for (; end < body.length && depth > 0; end++) depth += body[end] === '(' ? 1 : body[end] === ')' ? -1 : 0
      const args = body.slice(from, end)
      if (call[1] === 'page' && !MONEY_STORE_ARG.test(args)) continue
      if (/\b(?:eq|min|max)\s*:/.test(args)) continue
      hits++
    }
  }
  return hits
}

/** Code that reads whole money stores by design: maintenance, migration, export and the dev/e2e seeding tools. */
const FULL_READ_ALLOWED: ReadonlySet<string> = new Set([
  `${SYNC}selectors.ts`,
  `${SYNC}migrate.ts`,
  `${SYNC}core.ts`,
  `${SYNC}ledgerProjection.ts`,
  `${CLIENT}data/devTools.ts`,
  `${CLIENT}data/demoLarge.ts`,
])

/* -------------------------------------------------------------------------- */
/* Rules                                                                      */
/* -------------------------------------------------------------------------- */

const isClient = (p: string) => p.startsWith(CLIENT)
const under = (p: string, dir: string) => p.startsWith(CLIENT + dir)
const code = (s: string) => blank(s, {strings: false})
const noComments = (s: string) => blank(s, {strings: true})

/** Files under `src/view/` when this rule was written (Bluesky utilities). No new ones. */
export const VIEW_FILES: ReadonlySet<string> = new Set(
  [
    'com/util/EmptyState.tsx',
    'com/util/Link.tsx',
    'com/util/List.tsx',
    'com/util/List.web.tsx',
    'com/util/PressableWithHover.tsx',
    'com/util/TimeElapsed.tsx',
    'com/util/UserAvatar.tsx',
    'com/util/Views.tsx',
    'com/util/WebAuxClickWrapper.tsx',
    'com/util/fab/FAB.tsx',
    'com/util/fab/FAB.web.tsx',
    'com/util/fab/FABInner.tsx',
    'shell/bottom-bar/BottomBar.tsx',
    'shell/bottom-bar/BottomBarStyles.tsx',
    'shell/bottom-bar/BottomBarWeb.tsx',
    'shell/createNativeStackNavigatorWithAuth.tsx',
    'shell/desktop/LeftNav.tsx',
    'shell/desktop/RecentTransactions.tsx',
    'shell/desktop/RightNav.tsx',
    'shell/desktop/composeButtonLayout.ts',
    'shell/index.tsx',
    'shell/index.web.tsx',
  ].map(p => `${CLIENT}view/${p}`),
)

const HEADER = /^\/\/ Adapted from [\w.-]+\/[\w.-]+@[0-9a-f]{7,40} \(MIT\) [-\u2014] \S/

export const RULES = {
  rawColour: {
    why: 'Hex or rgb()/rgba() colour literal outside src/alf/ (use theme tokens, § 6).',
    appliesTo: p => isClient(p) && !under(p, 'alf/'),
    count: (_p, s) => {
      const c = noComments(s)
      return countMatches(c, /(['"`])#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\1/g) + countMatches(c, /\brgba?\(/g)
    },
  },
  rnModal: {
    why: "`Modal` imported from 'react-native' (use #/components/Dialog or FormSheet, § 4).",
    appliesTo: isClient,
    count: (_p, s) => {
      let hits = 0
      for (const m of noComments(s).matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]react-native['"]/g))
        if (/(?:^|,)\s*Modal\b/.test(m[1]!)) hits++
      return hits
    },
  },
  expoHaptics: {
    why: "'expo-haptics' imported outside src/lib/haptics/ (use useHaptics()).",
    appliesTo: p => isClient(p) && !under(p, 'lib/haptics/'),
    count: (_p, s) => importsOf(s).filter(m => m === 'expo-haptics').length,
  },
  viewFiles: {
    why: 'New file under src/view/ (only the frozen Bluesky utilities live there, § 1).',
    appliesTo: p => under(p, 'view/'),
    count: p => (VIEW_FILES.has(p) ? 0 : 1),
  },
  credentialAccess: {
    why: 'expo-secure-store, document.cookie, Authorization headers or web storage outside src/storage/ (§ 11).',
    appliesTo: p => isClient(p) && !under(p, 'storage/'),
    count: (_p, s) =>
      importsOf(s).filter(m => m === 'expo-secure-store').length +
      countMatches(code(s), /\bdocument\.cookie\b|\b(?:localStorage|sessionStorage)\b/g) +
      countMatches(noComments(s), /['"`]?\bAuthorization\b['"`]?\s*:/g),
  },
  consoleOutsideLogger: {
    why: 'console.* outside src/logger/ (use #/logger, § 16).',
    appliesTo: p => isClient(p) && !under(p, 'logger/'),
    count: (_p, s) => countMatches(code(s), /\bconsole\.\w+\s*\(/g),
  },
  moneyArithmetic: {
    why: 'Money maths outside packages/domain: bigint literals, BigInt(), or + - * / % on a money-named value (§ 1).',
    appliesTo: isClient,
    count: (_p, s) => {
      const c = code(s)
      // Operators are only money maths in files that handle money at all.
      const handlesMoney = /\bbigint\b|\bZERO\b|@splito\/(?:domain|sync)/.test(s)
      return countMatches(c, /\b\d[\d_]*n\b/g) + countMatches(c, /\bBigInt\s*\(/g) + (handlesMoney ? moneyOperators(c) : 0)
    },
  },
  rawNumberOnMoney: {
    why: 'Number()/parseFloat()/parseInt() over a money value, or .toFixed() (money is bigint; use @splito/domain).',
    appliesTo: isClient,
    count: (_p, s) => {
      const c = code(s)
      let hits = countMatches(c, /\.toFixed\s*\(/g)
      for (const m of c.matchAll(/\b(?:Number|parseFloat|parseInt)\s*\(/g)) {
        // The call's argument, up to its matching parenthesis.
        let j = m.index! + m[0].length
        let open = 1
        const start = j
        while (j < c.length && open) {
          if (c[j] === '(') open++
          else if (c[j] === ')') open--
          j++
        }
        const arg = c.slice(start, j - 1)
        if (/\bBigInt\b|\d+n\b/.test(arg) || (arg.match(/[A-Za-z_$][\w$]*/g) ?? []).some(w => MONEY_NAME.test(w))) hits++
      }
      return hits
    },
  },
  unlikeCurrencySum: {
    why: 'A bigint sum not keyed by currency (.reduce seeded with 0n/ZERO, or += on money); use sumMinor per currency.',
    appliesTo: isClient,
    count: (_p, s) => {
      const c = code(s)
      const tokens = c.match(TOKEN) ?? []
      // A sum: the callback adds, and the seed is a bigint zero (max/min reductions are fine).
      let hits = countMatches(c, /\.reduce\s*\(\s*\([^)]*\)\s*=>[^,]*\+[^,]*,\s*(?:0n|ZERO)\s*\)/g)
      for (let i = 0; i < tokens.length; i++)
        if ((tokens[i] === '+=' || tokens[i] === '-=') && MONEY_NAME.test(chainEnd(tokens, i - 1) ?? '')) hits++
      return hits
    },
  },
  layerDirection: {
    why: 'alf/, components/ or lib/ importing screens/, features/ or data/ (§ 1 dependency direction).',
    appliesTo: p => under(p, 'alf/') || under(p, 'components/') || under(p, 'lib/'),
    count: (_p, s) => importsOf(s).filter(m => /^#\/(?:screens|features|data)(?:\/|$)/.test(m)).length,
  },
  siblingFeatures: {
    why: 'features/x importing features/y (a cross-feature hop is a route or shared data/, § 1).',
    appliesTo: p => under(p, 'features/'),
    count: (p, s) => {
      const own = p.slice(CLIENT.length).split('/')[1]
      return importsOf(s).filter(m => m.startsWith('#/features/') && m.split('/')[2] !== own).length
    },
  },
  packageBoundaries: {
    why: 'packages/domain imports only itself; packages/sync never imports the client, React or Expo (§ 1).',
    appliesTo: p => p.startsWith(DOMAIN) || p.startsWith(SYNC),
    count: (p, s) =>
      importsOf(s).filter(m =>
        p.startsWith(DOMAIN) ? !m.startsWith('.') : /^(?:#\/|react(?:-native)?(?:\/|$)|expo|@splito\/client)/.test(m),
      ).length,
  },
  persistenceOutsideSync: {
    why: 'expo-sqlite, idb or indexedDB outside packages/sync and data/store(.web).ts (§ 1).',
    appliesTo: p => isClient(p) && !/^apps\/client\/src\/data\/store(?:\.web)?\.ts$/.test(p),
    count: (_p, s) =>
      importsOf(s).filter(m => m === 'expo-sqlite' || m === 'idb').length + countMatches(code(s), /\bindexedDB\b/g),
  },
  storeAccess: {
    why: 'Raw store access outside src/data/: store.getAll/get/page/parties/balances/transaction/history/outbox/subscribe/count..., useData() or #/data/store (read through data/ hooks).',
    appliesTo: p => isClient(p) && !under(p, 'data/'),
    count: (_p, s) =>
      countMatches(
        code(s),
        /\bstore\.(?:getAll|get|getMany|page|parties|members|balances|pairBalances|lastActivity|historyPage|historyMany|count|groupActivity|syncCounts|setOpStatus|rebuildProjections|dump|erase|transaction|history|outbox|outboxByStatus|subscribe)\s*\(|\buseData\s*\(/g,
      ) +
      importsOf(s).filter(m => m === '#/data/store' || m === '#/data/StoreProvider').length,
  },
  moneyFullRead: {
    why: 'A whole money store read on a hot path: getAll / useEntities / useAllEntities / entitiesQuery of expense, repayment or writeoff, useLedger or loadLedger, or a store.page / store.parties cursor loop that runs to the end of a money store. Read through indexes, projections and cursors; a loop that pages a money store end to end is a full read (ARCHITECTURE 9.8). Maintenance, migration, export and the dev tools are allowlisted in FULL_READ_ALLOWED.',
    // loadLedger (export, maintenance, tests) is defined in selectors.ts; the dev/e2e tools use it for the perf spec's baseline. Nothing else reads a money store whole.
    appliesTo: p => (isClient(p) || p.startsWith(SYNC)) && !FULL_READ_ALLOWED.has(p),
    count: (_p, s) =>
      countMatches(noComments(s), /\b(?:getAll|useEntities|useAllEntities|entitiesQuery)\s*(?:<[^>()]*>)?\s*\(\s*['"`](?:expense|repayment|writeoff)['"`]/g) +
      countMatches(code(s), /\b(?:useLedger|loadLedger)\s*\(/g) +
      moneyCursorLoops(s),
  },
  demoStaticImport: {
    why: 'A static import of the large demo set (#/data/demoLarge, #/screens/Settings/DemoData, @splito/sync/demoLarge) outside the demo files: it must load with import() under __DEV__ / EXPO_PUBLIC_ENV so production bundles hold none of it (ARCHITECTURE 26.1).',
    appliesTo: p => isClient(p) && !/\/(?:data\/demoLarge|screens\/Settings\/DemoData)\.tsx?$/.test(p),
    count: (_p, s) =>
      countMatches(noComments(s), /(?:^|\n)\s*(?:import|export)\b[^'"`;]*?\bfrom\s*['"](?:#\/data\/demoLarge|#\/screens\/Settings\/DemoData|@splito\/sync\/demoLarge)['"]/g),
  },
  attribution: {
    why: 'Bluesky/Expensify code without the `// Adapted from <repo>@<sha> (MIT) - <path>` first line, or without a docs/reuse row.',
    appliesTo: isClient,
    count: (p, s, ctx) => {
      const rel = 'src/' + p.slice(CLIENT.length)
      const mentions = /Adapted from [\w.-]+\/[\w.-]+@/.test(s)
      const hasHeader = HEADER.test(s)
      let hits = 0
      if (mentions && !hasHeader) hits++ // attribution present but not as the first line
      if (hasHeader && !ctx.reusePaths.has(rel)) hits++ // no reuse row
      if (!hasHeader && ctx.copiedPaths.has(rel)) hits++ // listed as copied, header missing
      return hits
    },
  },
} satisfies Record<string, Rule>

export type RuleName = keyof typeof RULES

/** Reads the reuse record: every `src/...` path, and those under a "Copied ..." heading. */
export function reuseContext(docs: ReadonlyArray<string>): RuleContext {
  const reusePaths = new Set<string>()
  const copiedPaths = new Set<string>()
  for (const doc of docs) {
    let isCopied = false
    for (const line of doc.split('\n')) {
      if (line.startsWith('#')) isCopied = /^#+\s+Copied\b/.test(line)
      for (const m of line.matchAll(/`(src\/[^`\s]+\.(?:tsx?|js))`/g)) {
        reusePaths.add(m[1]!)
        // Only the first table cell is the Splito file; later cells name upstream files.
        if (isCopied && line.startsWith(`| \`${m[1]}\``)) copiedPaths.add(m[1]!)
      }
    }
  }
  return {reusePaths, copiedPaths}
}
