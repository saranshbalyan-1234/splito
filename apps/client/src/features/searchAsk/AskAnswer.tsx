import {View} from 'react-native'
import {plural} from '@lingui/core/macro'
import {useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {formatAmount, getCurrency, magnitude, toDecimalString, ZERO} from '@splito/domain'

import {type Answer, type PeriodInfo, type Ref, type Suggestion} from '#/lib/ask/types'
import {type NavigationProp} from '#/lib/routes/types'
import {useNumberLocale} from '#/locale/numberLocale'
import {useFormatDay} from '#/locale/useDates'
import {usePref} from '#/data/hooks'
import {atoms as a, useTheme} from '#/alf'
import * as Dialog from '#/components/Dialog'
import {
  ActionCard,
  BalanceLine,
  Card,
  ExpenseList,
  PeopleRanking,
  PlanRows,
  QuestionChip,
  SpendCard,
  TrendCard,
} from '#/components/SearchAsk/AskCards'
import {Text} from '#/components/Typography'
import {useAskQuestions} from './askQuestions'

type Props = {
  answer: Answer
  /** The id of "me": a ref with this id is drawn as "You". */
  me: string
  /** The question that led here, so "Which Riya?" can ask it again with the full name. */
  question?: string
  onAsk: (question: string) => void
  onSearch: (query: string) => void
}

const utc = (d: string) => new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)))

/**
 * One answer as words and cards (ARCHITECTURE 26.19): a sentence that says
 * the answer, then the card that shows it. Every sentence names its measure
 * (your share, what you paid, everyone's total) and its period; money is one
 * line per currency. Cards that lead somewhere open the normal page or sheet;
 * the AI never writes anything itself.
 */
export function AskAnswer({answer, me, question, onAsk, onSearch}: Props) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const locale = useNumberLocale()
  const navigation = useNavigation<NavigationProp>()
  const {close} = Dialog.useDialogContext()
  const questions = useAskQuestions()
  const formatDay = useFormatDay()
  /* The Analytics view preference: charts, or the same numbers as tables. */
  const [view] = usePref('analyticsView')
  const isTable = view === 'table'

  const name = (r: Ref) => (r.id === me ? l`You` : r.name || l`Someone`)
  const money = (amount: bigint, currency: string) => formatAmount(amount, currency, locale)
  const date = (d: string, o: Intl.DateTimeFormatOptions) => i18n.date(utc(d), {...o, timeZone: 'UTC'})
  const go = (to: () => void) => close(to)

  const periodPhrase = (p: PeriodInfo): string => {
    switch (p.kind) {
      case 'all':
        return l`over all time`
      case 'today':
        return l`today`
      case 'yesterday':
        return l`yesterday`
      case 'week':
        return p.offset === 0 ? l`this week` : l`last week`
      case 'month':
        return p.offset === 0 ? l`this month` : p.offset === -1 ? l`last month` : l`in ${date(p.from, {month: 'long', year: 'numeric'})}`
      case 'monthOf':
        return l`in ${date(p.from, {month: 'long', year: 'numeric'})}`
      case 'year':
        return p.offset === 0 ? l`this year` : p.offset === -1 ? l`last year` : l`in ${date(p.from, {year: 'numeric'})}`
      case 'yearOf':
        return l`in ${date(p.from, {year: 'numeric'})}`
      case 'days':
        return l`in the last ${p.n} days`
      case 'months':
        return l`in the last ${p.n} months`
    }
  }
  const clean = (s: string) => s.replace(/\s+/g, ' ').replace(/ ([.,:])/g, '$1').trim()

  const suggest = (s: Suggestion) => {
    const q = questions.of(s)
    return <QuestionChip key={q} testID="ask-suggestion" text={q} onPress={() => onAsk(q)} />
  }

  /* The sentence is the bubble (Bluesky's other-side message); cards sit under it, full width. */
  const lead = (text: string) => (
    <View
      style={[
        a.py_sm,
        a.px_md,
        a.self_start,
        t.atoms.bg_contrast_50,
        {maxWidth: '100%', borderRadius: 20, borderBottomLeftRadius: 4},
      ]}>
      <Text testID="ask-lead" selectable style={[a.text_md, a.leading_snug]}>
        {text}
      </Text>
    </View>
  )

  switch (answer.kind) {
    case 'balance': {
      const who = answer.person.name
      if (answer.lines.length === 0) return lead(l`You and ${who} are settled up.`)
      const first = answer.lines[0]!
      const sentence =
        answer.lines.length > 1
          ? l`Here is where you stand with ${who}, one line per currency.`
          : first.owed !== ZERO && first.owe !== ZERO
            ? l`${who} owes you ${money(first.owed, first.currency)} and you owe ${who} ${money(first.owe, first.currency)}.`
            : first.owed !== ZERO
              ? l`${who} owes you ${money(first.owed, first.currency)}.`
              : l`You owe ${who} ${money(first.owe, first.currency)}.`
      const isOwed = answer.lines.some(line => line.owed !== ZERO)
      return (
        <View style={[a.gap_md]}>
          {lead(sentence)}
          <Card testID="ask-balance-card">
            {answer.lines.flatMap(line => {
              const detail = [
                ...(line.direct !== ZERO ? [l`Direct ${line.direct > ZERO ? '+' : '−'}${money(magnitude(line.direct), line.currency)}`] : []),
                ...line.groups.map(g => `${g.group.name || l`Group`} ${g.amount > ZERO ? '+' : '−'}${money(magnitude(g.amount), line.currency)}`),
              ]
              const isBoth = line.owed !== ZERO && line.owe !== ZERO
              return [
                ...(line.owed !== ZERO
                  ? [
                      <BalanceLine
                        key={`${line.currency}-owed`}
                        testID={isBoth ? `ask-balance-${line.currency}-owed` : `ask-balance-${line.currency}`}
                        amount={line.owed}
                        currency={line.currency}
                        locale={locale}
                        caption={l`${who} owes you (${line.currency})`}
                        detail={detail}
                      />,
                    ]
                  : []),
                ...(line.owe !== ZERO
                  ? [
                      <BalanceLine
                        key={`${line.currency}-owe`}
                        testID={isBoth ? `ask-balance-${line.currency}-owe` : `ask-balance-${line.currency}`}
                        amount={-line.owe}
                        currency={line.currency}
                        locale={locale}
                        caption={l`You owe ${who} (${line.currency})`}
                        detail={line.owed === ZERO ? detail : undefined}
                      />,
                    ]
                  : []),
              ]
            })}
          </Card>
          <ActionCard
            testID="ask-action-person"
            title={isOwed ? l`Remind ${who}` : l`Record a payment`}
            subtitle={l`Opens ${who}'s page`}
            onPress={() => go(() => navigation.navigate('Person', {personId: answer.person.id}))}
          />
        </View>
      )
    }

    case 'ranking': {
      const { direction, owedToMe, iOwe } = answer
      const wantsOwed = direction !== 'iOwe'
      const wantsOwe = direction !== 'owedToMe'
      const currenciesOf = (rows: typeof owedToMe) => [...new Set(rows.map(r => r.currency))]
      const manyCurrencies = new Set([...owedToMe, ...iOwe].map(r => r.currency)).size > 1
      const topOwed = owedToMe[0]
      const topOwe = iOwe[0]
      const isEmpty = (wantsOwed ? owedToMe.length : 0) + (wantsOwe ? iOwe.length : 0) === 0
      const sentence = isEmpty
        ? direction === 'owedToMe'
          ? l`Nobody owes you anything right now.`
          : direction === 'iOwe'
            ? l`You don't owe anyone anything right now.`
            : l`You're settled up with everyone.`
        : direction === 'owedToMe' && topOwed && !manyCurrencies
          ? l`${name(topOwed.person)} owes you the most: ${money(topOwed.amount, topOwed.currency)}.`
          : direction === 'iOwe' && topOwe && !manyCurrencies
            ? l`You owe ${name(topOwe.person)} the most: ${money(topOwe.amount, topOwe.currency)}.`
            : direction === 'both'
              ? l`Here is who owes you and whom you owe.`
              : direction === 'owedToMe'
                ? l`Here is who owes you, one list per currency.`
                : l`Here is whom you owe, one list per currency.`
      return (
        <View style={[a.gap_md]}>
          {lead(sentence)}
          {wantsOwed &&
            currenciesOf(owedToMe).map(c => (
              <PeopleRanking
                key={`owed-${c}`}
                testID={`ask-ranking-owed-${c}`}
                title={l`Owes you`}
                currency={c}
                locale={locale}
                rows={owedToMe.filter(r => r.currency === c).map(r => ({id: r.person.id, name: name(r.person), amount: r.amount}))}
              />
            ))}
          {wantsOwe &&
            currenciesOf(iOwe).map(c => (
              <PeopleRanking
                key={`owe-${c}`}
                testID={`ask-ranking-owe-${c}`}
                title={l`You owe`}
                currency={c}
                locale={locale}
                rows={iOwe.filter(r => r.currency === c).map(r => ({id: r.person.id, name: name(r.person), amount: r.amount}))}
              />
            ))}
        </View>
      )
    }

    case 'groupBalance': {
      const g = answer.group.name
      const only = answer.mine.length === 1 ? answer.mine[0]! : undefined
      const sentence =
        answer.owes.length === 0
          ? l`${g} is settled up.`
          : only && only.amount > ZERO
            ? l`In ${g}, you are owed ${money(only.amount, only.currency)}.`
            : only && only.amount < ZERO
              ? l`In ${g}, you owe ${money(magnitude(only.amount), only.currency)}.`
              : l`Here is who owes whom in ${g}.`
      return (
        <View style={[a.gap_md]}>
          {lead(sentence)}
          {answer.owes.length > 0 && (
            <Card title={l`Who owes whom`} testID="ask-plan-card">
              <PlanRows
                testID="ask-plan"
                locale={locale}
                rows={answer.owes.map(o => ({key: `${o.currency}-${o.from.id}-${o.to.id}`, from: name(o.from), to: name(o.to), currency: o.currency, amount: o.amount}))}
              />
            </Card>
          )}
          {answer.owes.length > 0 && (
            <ActionCard
              testID="ask-action-settle"
              title={l`Settle up`}
              subtitle={l`Opens the settle-up plan for ${g}`}
              onPress={() => go(() => navigation.navigate('Settle', {groupId: answer.group.id}))}
            />
          )}
        </View>
      )
    }

    case 'spend': {
      const scope = answer.category
        ? l`on ${answer.category.name || l`Other`}`
        : answer.group
          ? l`in ${answer.group.name}`
          : ''
      const period = periodPhrase(answer.period)
      const who = answer.person ? name(answer.person) : ''
      const caption = answer.person
        ? l`${who}'s share`
        : answer.measure === 'paid'
          ? l`You paid`
          : answer.measure === 'total'
            ? l`Everyone's total`
            : l`Your share`
      const headlineOf = (c: (typeof answer.currencies)[number]) => (answer.measure === 'paid' && !answer.person ? c.paid : answer.measure === 'total' ? c.total : c.share)
      if (answer.currencies.length === 0) return lead(clean(l`You have no expenses ${scope} ${period}.`))
      const single = answer.currencies.length === 1 ? answer.currencies[0]! : undefined
      const amount = single ? money(headlineOf(single), single.currency) : ''
      const sentence = single
        ? answer.person
          ? clean(l`${who}'s share ${scope} ${period} was ${amount}.`)
          : answer.measure === 'paid'
            ? clean(l`You paid ${amount} ${scope} ${period}.`)
            : answer.measure === 'total'
              ? clean(l`${amount} was spent in total ${scope} ${period}.`)
              : clean(l`You spent ${amount} ${scope} ${period}.`)
        : clean(l`Here is what that comes to ${scope} ${period}, one line per currency.`)
      const splitTitle =
        answer.breakdown === 'person' ? l`By person` : answer.breakdown === 'group' ? l`By group` : l`By category`
      return (
        <View style={[a.gap_md]}>
          {lead(sentence)}
          {answer.currencies.map(c => (
            <SpendCard
              key={c.currency}
              testID={`ask-spend-${c.currency}`}
              currency={c.currency}
              headline={headlineOf(c)}
              caption={caption}
              count={c.count}
              locale={locale}
              title={splitTitle}
              isTable={isTable}
              shareOf={answer.breakdown === 'person' ? undefined : headlineOf(c)}
              slices={c.slices.map(s => ({
                ...s,
                label: s.label || (answer.breakdown === 'group' ? l`Non-group` : answer.breakdown === 'person' ? name({id: s.key, name: ''}) : l`Other`),
              }))}
            />
          ))}
        </View>
      )
    }

    case 'trend': {
      const scope = answer.category ? l`on ${answer.category.name || l`Other`}` : answer.group ? l`in ${answer.group.name}` : ''
      const period = periodPhrase(answer.period)
      const bucketWord = answer.bucket === 'day' ? l`by day` : answer.bucket === 'week' ? l`by week` : l`by month`
      const what = answer.person ? l`${name(answer.person)}'s spending` : answer.measure === 'paid' ? l`What you paid` : answer.measure === 'total' ? l`Total spending` : l`Your spending`
      if (answer.currencies.length === 0) return lead(clean(l`There is no spending ${scope} ${period} to chart.`))
      const today = answer.period.to
      const labelOf = (key: string, from: string, to: string) => {
        if (answer.bucket === 'day') return date(key, {weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'})
        if (answer.bucket === 'week') return `${date(from, {day: 'numeric', month: 'short'})} – ${date(to, {day: 'numeric', month: 'short', year: 'numeric'})}`
        return date(key, {month: 'long', year: 'numeric'})
      }
      const isMultiYear = answer.period.from.slice(0, 4) !== answer.period.to.slice(0, 4)
      const axis = (key: string) => (answer.bucket === 'day' ? date(key, {day: 'numeric'}) : answer.bucket === 'week' ? date(key, {day: 'numeric', month: 'short'}) : date(key, isMultiYear ? {month: 'short', year: '2-digit'} : {month: 'short'}))
      return (
        <View style={[a.gap_md]}>
          {lead(clean(l`${what} ${bucketWord} ${scope} ${period}.`))}
          {answer.isCoarsened && (
            <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
              {l`That many days would not fit a chart, so it is shown by month.`}
            </Text>
          )}
          {answer.currencies.map(c => (
            <TrendCard
              key={c.currency}
              testID={`ask-trend-${c.currency}`}
              currency={c.currency}
              caption={what}
              total={c.total}
              locale={locale}
              isTable={isTable}
              points={c.points.map(p => ({
                key: p.key,
                value: p.value,
                axisLabel: axis(p.key),
                ...(answer.bucket === 'month' && !isMultiYear ? {axisLabelNarrow: date(p.key, {month: 'narrow'})} : {}),
                label: labelOf(p.key, p.from, p.to),
                isCurrent: p.from <= today && today <= p.to && p.to >= answer.period.to,
              }))}
            />
          ))}
        </View>
      )
    }

    case 'find': {
      const n = answer.count
      const sentence =
        n === 0
          ? l`Nothing matches “${answer.query}”.`
          : answer.isPartial
            ? l`Found at least ${plural(n, {one: '# expense', other: '# expenses'})} for “${answer.query}”.`
            : l`Found ${plural(n, {one: '# expense', other: '# expenses'})} for “${answer.query}”, ${answer.totals.map(m => money(m.amount, m.currency)).join(' · ')} in all.`
      return (
        <View style={[a.gap_md]}>
          {lead(sentence)}
          {answer.rows.length > 0 && (
            <ExpenseList
              testID="ask-found"
              locale={locale}
              rows={answer.rows.map(r => ({id: r.id, title: r.title, currency: r.currency, total: r.total, byline: [formatDay(r.date), r.group].filter(Boolean).join(' · ')}))}
              onOpen={id => go(() => navigation.navigate('Expense', {expenseId: id}))}
            />
          )}
          <ActionCard testID="ask-action-search" tone="secondary" title={l`Show all in Search`} subtitle={l`Searches “${answer.query}” with every match`} onPress={() => onSearch(answer.query)} />
        </View>
      )
    }

    case 'split': {
      const { ways, amount, each, title } = answer
      const sentence = amount && each
        ? each.high === each.low
          ? l`${money(amount.amount, amount.currency)} split ${ways} ways is ${money(each.high, amount.currency)} each.`
          : l`${money(amount.amount, amount.currency)} split ${ways} ways: ${plural(each.highCount, {one: '# person pays', other: '# people pay'})} ${money(each.high, amount.currency)} and the rest pay ${money(each.low, amount.currency)}.`
        : title
          ? l`Let's split ${title} ${ways} ways. Add the amount and who is in on it.`
          : l`Let's split it ${ways} ways. Add the amount and who is in on it.`
      return (
        <View style={[a.gap_md]}>
          {lead(sentence)}
          <ActionCard
            testID="ask-action-add"
            title={l`Add this expense`}
            subtitle={l`Opens the expense sheet. Nothing is saved until you do.`}
            onPress={() =>
              go(() =>
                navigation.navigate('AddExpense', {
                  title,
                  amount: amount ? toDecimalString(amount.amount, getCurrency(amount.currency).scale) : undefined,
                  currency: amount?.currency,
                }),
              )
            }
          />
        </View>
      )
    }

    case 'clarify':
      return (
        <View style={[a.gap_md]}>
          {lead(l`Which “${answer.term}” do you mean?`)}
          <View style={[a.flex_row, a.flex_wrap, a.gap_sm]}>
            {answer.options.map(o => (
              <QuestionChip
                key={o.id}
                testID={`ask-clarify-${o.id}`}
                text={o.name}
                onPress={() => onAsk(question ? question.replace(new RegExp(answer.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), o.name) : o.name)}
              />
            ))}
          </View>
        </View>
      )

    case 'help':
      return (
        <View style={[a.gap_md]}>
          {lead(l`I answer questions about your own balances and spending, on this device. Try one of these:`)}
          <View style={[a.flex_row, a.flex_wrap, a.gap_sm]}>
            {[
              questions.spendFood(),
              questions.owedMost(),
              questions.iOweMost(),
              questions.byCategory(),
              questions.split(),
            ].map(q => (
              <QuestionChip key={q} testID="ask-suggestion" text={q} onPress={() => onAsk(q)} />
            ))}
          </View>
        </View>
      )

    case 'unsupported':
      return (
        <View style={[a.gap_md]}>
          {lead(l`I can answer this once you sign in. For now I can answer questions about your balances and spending on this device, like:`)}
          <View style={[a.flex_row, a.flex_wrap]}>{suggest(answer.suggestion)}</View>
        </View>
      )
  }
}
