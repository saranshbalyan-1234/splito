import {
  formatAmount,
  getCurrency,
  type Statement,
  type StatementRow,
  toCsv,
  toDecimalString,
  ZERO,
} from '@splito/domain'

/** The words and names a statement needs, resolved by the caller (translated, in the person's language). */
export interface StatementText {
  /** The row's description: the expense title, or "Asha paid you". */
  describe(row: StatementRow): string
  groupName(groupId: string | null): string
  /** The group's trip place (owner 182), empty when it has none. */
  groupLocation(groupId: string | null): string
  /** Who paid an expense, as a comma-separated list. */
  paidBy(row: StatementRow): string
  kind(kind: StatementRow['kind']): string
  columns: {
    date: string
    type: string
    description: string
    group: string
    currency: string
    amount: string
    paidBy: string
    youPaid: string
    yourShare: string
    effect: string
    balance: string
    location: string
  }
  opening: string
  closing: string
  adjustment: string
}

const exact = (minor: bigint, currency: string) => toDecimalString(minor, getCurrency(currency).scale)

/**
 * The statement as CSV, one row per record. Every amount is an exact decimal
 * in its own currency with the currency beside it, and the running balance is
 * per currency (currencies are never added). Cells are formula-safe (domain `toCsv`).
 */
export function statementCsv(st: Statement, text: StatementText): string {
  const c = text.columns
  const rows: string[][] = [[c.date, c.type, c.description, c.group, c.currency, c.amount, c.paidBy, c.youPaid, c.yourShare, c.effect, c.balance, c.location]]
  if (st.filter.from)
    for (const cur of st.currencies)
      rows.push([st.filter.from, text.opening, '', '', cur, '', '', '', '', '', exact(st.opening[cur] ?? ZERO, cur), ''])
  for (const r of st.rows)
    rows.push([
      r.date,
      text.kind(r.kind),
      text.describe(r),
      text.groupName(r.groupId),
      r.currency,
      exact(r.amount, r.currency),
      text.paidBy(r),
      exact(r.paid, r.currency),
      exact(r.share, r.currency),
      exact(r.effect, r.currency),
      exact(r.balance, r.currency),
      text.groupLocation(r.groupId),
    ])
  const last = st.filter.to ?? st.rows.at(-1)?.date ?? ''
  for (const cur of st.currencies) {
    const adjust = st.adjustments[cur]
    if (adjust !== undefined) rows.push([last, text.adjustment, '', '', cur, '', '', '', '', exact(adjust, cur), exact(st.closing[cur] ?? ZERO, cur), ''])
    rows.push([last, text.closing, '', '', cur, '', '', '', '', '', exact(st.closing[cur] ?? ZERO, cur), ''])
  }
  return toCsv(rows)
}

const ESC: Record<string, string> = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}
const esc = (s: string) => s.replace(/[&<>"']/g, ch => ESC[ch]!)

export interface StatementPage {
  title: string
  /** "With Asha", "Goa" or "All activity". */
  subject: string
  /** "1 Oct 2026 to 31 Oct 2026" or "All dates". */
  range: string
  generated: string
  owner: string
  footnote: string
  empty: string
  /** Heading above one currency's table. */
  currencyHeading(code: string): string
  /** A short signed label: "You are owed" / "You owe" / "Settled". */
  direction(balance: bigint): string
  columns: {date: string; description: string; group: string; amount: string; effect: string; balance: string}
}

const CSS = `
@page { size: A4; margin: 16mm 14mm; }
* { box-sizing: border-box; }
body { margin: 0; color: #0b0f19; font: 12px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", "Noto Sans Devanagari", sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #006aff; padding-bottom: 10px; margin-bottom: 18px; }
h1 { margin: 0; font-size: 22px; letter-spacing: -0.01em; }
.sub { color: #556070; margin-top: 2px; }
.meta { text-align: right; color: #556070; }
h2 { font-size: 14px; margin: 22px 0 6px; display: flex; justify-content: space-between; align-items: baseline; }
h2 span { font-weight: 600; font-size: 12px; }
table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #556070; border-bottom: 1px solid #c8d0dc; padding: 5px 6px; }
td { padding: 5px 6px; border-bottom: 1px solid #e6eaf0; vertical-align: top; }
tr { break-inside: avoid; }
.num { text-align: right; white-space: nowrap; }
.pos { color: #0a7a3d; } .neg { color: #b42318; }
.tag { color: #556070; font-size: 10px; }
tr.sum td { font-weight: 700; background: #f3f6fa; border-bottom: 1px solid #c8d0dc; }
tr.adj td { color: #556070; font-style: italic; }
footer { margin-top: 24px; color: #556070; font-size: 10px; }
.empty { padding: 24px 0; color: #556070; }
`

/** A self-contained, print-ready statement: per currency a table of records with its running balance. Native prints it to PDF; the web opens the browser's print dialog. */
export function statementHtml(st: Statement, text: StatementText, page: StatementPage, locale: string): string {
  const signed = (v: bigint, cur: string) => `<span class="${v > ZERO ? 'pos' : v < ZERO ? 'neg' : ''}">${esc((v > ZERO ? '+' : '') + formatAmount(v, cur, locale))}</span>`
  const section = (cur: string) => {
    const rows = st.rows.filter(r => r.currency === cur)
    const body = rows
      .map(
        r => `<tr><td>${esc(r.date)}</td><td>${esc(text.describe(r))}<div class="tag">${esc(text.kind(r.kind))}${r.groupId ? ' · ' + esc(text.groupName(r.groupId)) : ''}</div></td><td class="num">${esc(formatAmount(r.amount, cur, locale))}</td><td class="num">${signed(r.effect, cur)}</td><td class="num">${signed(r.balance, cur)}</td></tr>`,
      )
      .join('')
    const adjust = st.adjustments[cur]
    const closing = st.closing[cur] ?? ZERO
    return `<h2>${esc(page.currencyHeading(cur))}<span>${esc(page.direction(closing))} ${signed(closing, cur)}</span></h2>
<table><thead><tr><th>${esc(page.columns.date)}</th><th>${esc(page.columns.description)}</th><th class="num">${esc(page.columns.amount)}</th><th class="num">${esc(page.columns.effect)}</th><th class="num">${esc(page.columns.balance)}</th></tr></thead><tbody>
${st.filter.from ? `<tr class="sum"><td colspan="4">${esc(text.opening)}</td><td class="num">${signed(st.opening[cur] ?? ZERO, cur)}</td></tr>` : ''}${body}${adjust !== undefined ? `<tr class="adj"><td colspan="3">${esc(text.adjustment)}</td><td class="num">${signed(adjust, cur)}</td><td></td></tr>` : ''}<tr class="sum"><td colspan="4">${esc(text.closing)}</td><td class="num">${signed(closing, cur)}</td></tr>
</tbody></table>`
  }
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(page.title)}</title><style>${CSS}</style></head><body>
<header><div><h1>${esc(page.title)}</h1><div class="sub">${esc(page.subject)} · ${esc(page.range)}</div></div><div class="meta"><div>${esc(page.owner)}</div><div>${esc(page.generated)}</div></div></header>
${st.currencies.length ? st.currencies.map(section).join('') : `<div class="empty">${esc(page.empty)}</div>`}
<footer>${esc(page.footnote)}</footer></body></html>`
}
