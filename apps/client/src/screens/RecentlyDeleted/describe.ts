import {useLingui} from '@lingui/react/macro'
import {plural} from '@lingui/core/macro'
import {formatAmount, magnitude, personNet, ZERO} from '@splito/domain'
import {type BinItem} from '@splito/sync'

export type BinRowModel = {
  title: string
  amount: string
  /** What the record means for me, e.g. "you lent INR 450"; null when not involved. */
  effect: string | null
  /** > 0 lent / owed to me, < 0 borrowed / I owe; 0 neutral. */
  effectSign: -1 | 0 | 1
  groupId: string | null
  date: string
}

/** One bin item in words: the same title the history row would show, plus its money. */
export function useDescribeBinItem() {
  const {t: l} = useLingui()
  return (
    item: BinItem,
    me: string,
    names: Map<string, string>,
    locale: string,
  ): BinRowModel => {
    const name = (id: string) =>
      id === me ? l`You` : (names.get(id) ?? l`Someone`)
    const money = (v: bigint, c: string) => formatAmount(v, c, locale)
    if (item.type === 'group') {
      // The group is one entry; what went with it is counted on its tombstone (F-615).
      const g = item.entity.data
      const r = g.removed ?? {expenses: 0, repayments: 0, writeoffs: 0}
      const records = r.expenses + r.repayments + r.writeoffs
      return {
        title: g.name,
        amount: plural(records, {one: '# record', other: '# records'}),
        effect: null,
        effectSign: 0,
        groupId: null,
        date: '',
      }
    }
    if (item.type === 'expense') {
      const e = item.entity.data
      const net = personNet(e, me)
      return {
        title: e.title,
        amount: money(e.total, e.currency),
        effect:
          net === ZERO
            ? null
            : net > ZERO
              ? l`you lent ${money(net, e.currency)}`
              : l`you borrowed ${money(magnitude(net), e.currency)}`,
        effectSign: net === ZERO ? 0 : net > ZERO ? 1 : -1,
        groupId: e.groupId,
        date: e.date,
      }
    }
    const r = item.entity.data
    const title =
      item.type === 'writeoff'
        ? r.to === me
          ? l`You forgave ${name(r.from)}`
          : r.from === me
            ? l`${name(r.to)} forgave you`
            : l`${name(r.to)} forgave ${name(r.from)}`
        : r.from === me
          ? l`You paid ${name(r.to)}`
          : r.to === me
            ? l`${name(r.from)} paid you`
            : l`${name(r.from)} paid ${name(r.to)}`
    return {
      title,
      amount: money(r.amount, r.currency),
      effect: null,
      effectSign: 0,
      groupId: r.groupId,
      date: r.date,
    }
  }
}
