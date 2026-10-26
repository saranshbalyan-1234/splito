import {useState} from 'react'
import {View} from 'react-native'
import {LayoutAnimationConfig} from 'react-native-reanimated'
import {Trans, useLingui} from '@lingui/react/macro'
import {type RouteProp, useNavigation, useRoute} from '@react-navigation/native'
import {
  fnv1a64,
  formatAmount,
  type Plan,
  planSettlement,
  sumMinor,
  type Transfer,
  ZERO,
} from '@splito/domain'
import {type Group, type Person} from '@splito/sync'

import {type AllNavigatorParams, type NavigationProp} from '#/lib/routes/types'
import {useEntities, useLedger, useMe} from '#/data/hooks'
import {useNumberLocale} from '#/locale/numberLocale'
import {EmptyState} from '#/view/com/util/EmptyState'
import {List} from '#/view/com/util/List'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import * as Admonition from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {useDialogControl} from '#/components/Dialog'
import {memberNets} from '#/components/groups/net'
import {NO_RULES} from '#/components/groups/RulesEditor'
import {ArrowRotateCounterClockwise_Stroke2_Corner0_Rounded as RefreshIcon} from '#/components/icons/ArrowRotate'
import {CircleCheck_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/CircleCheck'
import {CircleInfo_Stroke2_Corner0_Rounded as InfoIcon} from '#/components/icons/CircleInfo'
import * as Layout from '#/components/Layout'
import {
  type PaymentDraft,
  RecordPaymentDialog,
} from '#/components/people/RecordPaymentDialog'
import * as Skeleton from '#/components/Skeleton'
import {Text} from '#/components/Typography'
import {Shimmer} from '#/motion/Shimmer'
import {TransferRow} from './components/TransferRow'

type CurrencyPlan = {currency: string; plan: Plan | null}
type Snapshot = {hash: string; plans: CurrencyPlan[]}

type Item =
  | {
      type: 'currency'
      key: string
      currency: string
      count: number | null
      total: bigint | null
    }
  | {type: 'transfer'; key: string; currency: string; transfer: Transfer}
  | {type: 'infeasible'; key: string; currency: string; stuck: string[]}
  | {type: 'settled'; key: string; currency: string}

/**
 * Settle up a group: per currency, the direct plan from `planSettlement`
 * over the members' nets and the group's rules (spec v1: direct only;
 * routing through other members waits for their consent, v2). The plan
 * shown is a snapshot with a hash; when expenses, payments, rules or members
 * change it is marked stale until the user updates it. A plan is never a
 * payment: each transfer is recorded only when the user says it happened.
 */
export function SettleScreen() {
  const t = useTheme()
  const {t: l} = useLingui()
  const {gtMobile} = useBreakpoints()
  const locale = useNumberLocale()
  const navigation = useNavigation<NavigationProp>()
  const {groupId} = useRoute<RouteProp<AllNavigatorParams, 'Settle'>>().params
  const me = useMe()
  const people = useEntities<Person>('person')
  const groups = useEntities<Group>('group')
  const ledger = useLedger()
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [isAdopting, setIsAdopting] = useState(false)
  const [isExplained, setIsExplained] = useState(false)
  const paymentControl = useDialogControl()
  const [draft, setDraft] = useState<PaymentDraft | null>(null)

  const isLoading = !me || !people || !groups || !ledger
  const group = groups?.find(g => g.id === groupId)
  const names = new Map(
    (people ?? []).map(p => [p.id, p.id === me?.id ? l`You` : p.data.name]),
  )

  let current: Snapshot | null = null
  if (!isLoading && group) {
    const rules = group.data.rules ?? NO_RULES
    const plans = Object.entries(memberNets(ledger, groupId, group.data)).map(
      ([currency, net]) => ({
        currency,
        plan: Object.values(net).some(v => v !== ZERO)
          ? planSettlement(net, rules, 'direct')
          : null,
      }),
    )
    current = {
      plans,
      hash: fnv1a64(
        plans.map(p => `${p.currency}:${p.plan?.hash ?? '0'}`).join('|'),
      ),
    }
  }

  /*
   * Adopt the live plan on first load and after a payment recorded here.
   * Any other change only marks the shown plan stale.
   */
  if (
    current &&
    (snapshot === null || (isAdopting && snapshot.hash !== current.hash))
  ) {
    setSnapshot(current)
    if (isAdopting) setIsAdopting(false)
  }
  const isStale = !!current && !!snapshot && snapshot.hash !== current.hash

  if (!isLoading && !group) {
    return (
      <Layout.Screen testID="screen-settle">
        <Layout.Header.Outer>
          <Layout.Header.BackButton />
          <Layout.Header.Content>
            <Layout.Header.TitleText>
              <Trans>Settle up</Trans>
            </Layout.Header.TitleText>
          </Layout.Header.Content>
          <Layout.Header.Slot />
        </Layout.Header.Outer>
        <EmptyState
          testID="settle-not-found"
          message={l`This group isn’t on this device. It may have been removed.`}
          button={{
            label: l`Back to Groups`,
            text: l`Back to Groups`,
            onPress: () => navigation.navigate('Groups'),
            size: 'small',
            color: 'secondary',
          }}
        />
      </Layout.Screen>
    )
  }

  const shown = snapshot?.plans ?? []
  const items: Item[] = shown.flatMap(({currency, plan}): Item[] => {
    if (!plan)
      return [
        {
          type: 'currency',
          key: `cur-${currency}`,
          currency,
          count: null,
          total: null,
        },
        {type: 'settled', key: `settled-${currency}`, currency},
      ]
    if (plan.status === 'infeasible')
      return [
        {
          type: 'currency',
          key: `cur-${currency}`,
          currency,
          count: null,
          total: null,
        },
        {
          type: 'infeasible',
          key: `stuck-${currency}`,
          currency,
          stuck: plan.stuck,
        },
      ]
    return [
      {
        type: 'currency',
        key: `cur-${currency}`,
        currency,
        count: plan.transfers.length,
        /* With one currency the summary above already gives the total. */
        total:
          shown.length > 1 ? sumMinor(plan.transfers.map(x => x.amount)) : null,
      },
      // Biggest payments first, then by payer, so the order never depends on member ids.
      ...[...plan.transfers]
        .sort(
          (x, y) =>
            Number(y.amount > x.amount) - Number(x.amount > y.amount) ||
            (names.get(x.from) ?? '').localeCompare(names.get(y.from) ?? ''),
        )
        .map(transfer => ({
          type: 'transfer' as const,
          key: `t-${currency}-${transfer.from}-${transfer.to}`,
          currency,
          transfer,
        })),
    ]
  })
  const nameList = (ids: string[]) =>
    ids.map(id => names.get(id) ?? '').join(', ')

  const header = isLoading ? (
    <Shimmer testID="settle-loading">
      <View style={[a.px_lg, a.pt_lg, a.pb_lg, a.gap_md]}>
        <Skeleton.Text style={[a.text_md, {width: '90%', maxWidth: 560}]} />
        <Skeleton.Text style={[a.text_md, {width: '60%', maxWidth: 380}]} />
      </View>
    </Shimmer>
  ) : (
    <View style={[a.px_lg, a.pt_lg, a.pb_md, a.gap_xs]}>
      <SettleSummary plans={shown} me={me!.id} locale={locale} />
      <View style={[a.flex_row]}>
        <Button
          testID="settle-how"
          label={l`How this plan works`}
          size="small"
          variant="ghost"
          color="secondary"
          style={[{marginLeft: -12}]}
          onPress={() => setIsExplained(v => !v)}>
          <ButtonIcon icon={InfoIcon} />
          <ButtonText>
            <Trans>How this plan works</Trans>
          </ButtonText>
        </Button>
      </View>
      {isExplained && (
        <Text
          testID="settle-explanation"
          style={[
            a.text_sm,
            a.leading_snug,
            t.atoms.text_contrast_medium,
            {maxWidth: 640},
          ]}>
          <Trans>
            Everyone who owes pays the people who are owed, straight to them.
            Only pairs allowed in Who you settle with are used, preferred pairs
            first, so the plan isn’t always the fewest payments.
          </Trans>
        </Text>
      )}
      {isStale && (
        <Admonition.Outer type="warning">
          <Admonition.Row>
            <Admonition.Icon />
            <Admonition.Content>
              <Admonition.Text>
                <Trans>
                  Balances or rules changed since this plan was made.
                </Trans>
              </Admonition.Text>
            </Admonition.Content>
            <Admonition.Button
              testID="settle-refresh"
              label={l`Update plan`}
              color="secondary"
              onPress={() => setSnapshot(current)}>
              <ButtonIcon icon={RefreshIcon} />
              <ButtonText>
                <Trans>Update plan</Trans>
              </ButtonText>
            </Admonition.Button>
          </Admonition.Row>
        </Admonition.Outer>
      )}
    </View>
  )

  return (
    <Layout.Screen testID="screen-settle">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Settle up</Trans>
          </Layout.Header.TitleText>
          {group && (
            <Layout.Header.SubtitleText>
              {group.data.name}
            </Layout.Header.SubtitleText>
          )}
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <LayoutAnimationConfig skipEntering skipExiting>
        <List
          data={items}
          keyExtractor={(item: Item) => item.key}
          renderItem={({item}: {item: Item}) => {
            switch (item.type) {
              case 'currency':
                return (
                  <View
                    style={[
                      a.flex_row,
                      a.align_center,
                      a.justify_between,
                      a.gap_md,
                      a.px_lg,
                      a.pt_lg,
                      a.pb_sm,
                      a.border_t,
                      t.atoms.border_contrast_low,
                    ]}>
                    <View style={[a.flex_row, a.align_center, a.gap_xs]}>
                      <Text style={[a.text_lg, a.font_bold]}>
                        {item.currency}
                      </Text>
                      {item.count !== null && (
                        <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
                          {'· '}
                          <Text
                            testID={`settle-count-${item.currency}`}
                            style={[a.text_md, t.atoms.text_contrast_medium]}>
                            {item.count === 1 ? (
                              <Trans>1 payment</Trans>
                            ) : (
                              <Trans>{item.count} payments</Trans>
                            )}
                          </Text>
                        </Text>
                      )}
                    </View>
                    {item.total !== null && (
                      <Text
                        style={[
                          a.text_md,
                          a.font_semi_bold,
                          t.atoms.text_contrast_medium,
                          {fontVariant: ['tabular-nums']},
                        ]}>
                        {formatAmount(item.total, item.currency, locale)}
                      </Text>
                    )}
                  </View>
                )
              case 'transfer':
                return (
                  <TransferRow
                    transfer={item.transfer}
                    currency={item.currency}
                    me={me!.id}
                    meName={me!.data.name}
                    names={names}
                    locale={locale}
                    onRecordPress={() => {
                      setDraft({
                        from: item.transfer.from,
                        to: item.transfer.to,
                        currency: item.currency,
                        amount: item.transfer.amount,
                        groupId,
                      })
                      paymentControl.open()
                    }}
                  />
                )
              case 'settled':
                return (
                  <View
                    testID={`settle-settled-${item.currency}`}
                    style={[a.align_center, a.gap_sm, a.px_lg, a.py_2xl]}>
                    <View
                      style={[
                        a.rounded_full,
                        a.align_center,
                        a.justify_center,
                        {
                          width: 56,
                          height: 56,
                          backgroundColor: t.palette.positive_50,
                        },
                      ]}>
                      <CheckIcon size="xl" fill={t.palette.positive_600} />
                    </View>
                    <Text style={[a.text_lg, a.font_bold, a.text_center]}>
                      <Trans>All settled up</Trans>
                    </Text>
                    <Text
                      style={[
                        a.text_md,
                        a.text_center,
                        t.atoms.text_contrast_medium,
                      ]}>
                      <Trans>Everyone is settled up.</Trans>
                    </Text>
                  </View>
                )
              case 'infeasible':
                return (
                  <View style={[a.px_lg, a.pb_lg]}>
                    <Admonition.Outer type="error" style={[a.gap_sm]}>
                      <Admonition.Row>
                        <Admonition.Icon />
                        <Admonition.Content>
                          <Admonition.Text
                            style={[a.text_md, a.font_semi_bold]}>
                            <Trans>No direct plan works with these rules</Trans>
                          </Admonition.Text>
                          <Text
                            testID={`settle-stuck-${item.currency}`}
                            style={[a.text_sm, a.leading_snug, a.pr_md]}>
                            <Trans>
                              No allowed pair to pay anyone who is owed:{' '}
                              {nameList(item.stuck)}
                            </Trans>
                          </Text>
                        </Admonition.Content>
                      </Admonition.Row>
                      <View
                        style={[
                          a.flex_row,
                          a.flex_wrap,
                          a.gap_sm,
                          {paddingLeft: 28},
                        ]}>
                        <Admonition.Button
                          testID="settle-edit-rules"
                          label={l`Edit who you settle with`}
                          color="secondary"
                          onPress={() =>
                            navigation.navigate('Group', {
                              groupId,
                              tab: 'rules',
                            })
                          }>
                          <ButtonText>
                            <Trans>Edit rules</Trans>
                          </ButtonText>
                        </Admonition.Button>
                      </View>
                    </Admonition.Outer>
                  </View>
                )
            }
          }}
          ListHeaderComponent={header}
          ListEmptyComponent={
            isLoading ? undefined : (
              <EmptyState
                testID="settle-empty"
                icon={null}
                message={l`Nothing to settle. This group has no expenses yet.`}
              />
            )
          }
          ListFooterComponent={
            snapshot && items.length > 0 ? (
              <View
                testID="settle-footer"
                // Tests read the plan's version here; it is never shown.
                // @ts-expect-error web only: RN Web renders dataSet as data-* attributes
                dataSet={{planHash: snapshot.hash}}
                style={[
                  a.px_lg,
                  a.pt_lg,
                  a.gap_2xs,
                  {paddingBottom: gtMobile ? 40 : 100},
                ]}>
                <Admonition.Outer type="info">
                  <Admonition.Row>
                    <Admonition.Icon />
                    <Admonition.Content>
                      <Admonition.Text>
                        <Trans>
                          Splito never moves money. Record each payment once it
                          has happened – part payments are fine.
                        </Trans>
                      </Admonition.Text>
                    </Admonition.Content>
                  </Admonition.Row>
                </Admonition.Outer>
              </View>
            ) : undefined
          }
        />
      </LayoutAnimationConfig>
      {me && (
        <RecordPaymentDialog
          control={paymentControl}
          draft={
            draft ?? {
              from: me.id,
              to: me.id,
              currency: 'INR',
              amount: null,
              groupId,
            }
          }
          me={me.id}
          names={names}
          onPaymentRecorded={() => setIsAdopting(true)}
        />
      )}
    </Layout.Screen>
  )
}

/**
 * What the plan means for me, per currency (never added across): what I get
 * and from how many people, and what I pay and to how many.
 */
function SettleSummary({
  plans,
  me,
  locale,
}: {
  plans: CurrencyPlan[]
  me: string
  locale: string
}) {
  const t = useTheme()
  const lines = plans.flatMap(({currency, plan}) => {
    if (!plan || plan.status === 'infeasible') return []
    const sides = [
      {isIncoming: true, list: plan.transfers.filter(x => x.to === me)},
      {isIncoming: false, list: plan.transfers.filter(x => x.from === me)},
    ]
    return sides
      .filter(side => side.list.length > 0)
      .map(side => ({
        key: `${side.isIncoming ? 'in' : 'out'}-${currency}`,
        isIncoming: side.isIncoming,
        amount: formatAmount(
          sumMinor(side.list.map(x => x.amount)),
          currency,
          locale,
        ),
        people: side.list.length,
      }))
  })

  if (lines.length === 0) {
    return (
      <Text
        testID="settle-summary"
        style={[a.text_md, a.leading_snug, t.atoms.text_contrast_medium]}>
        <Trans>You’re not part of any of these payments.</Trans>
      </Text>
    )
  }
  return (
    <View testID="settle-summary" style={[a.flex_row, a.flex_wrap, a.gap_2xl]}>
      {lines.map(line => (
        <View key={line.key} style={[a.gap_2xs]}>
          <Text style={[a.text_md, a.font_semi_bold, a.leading_snug]}>
            {line.isIncoming ? (
              <Trans>You’ll get</Trans>
            ) : (
              <Trans>You’ll pay</Trans>
            )}
          </Text>
          <Text
            style={[
              a.text_3xl,
              a.font_bold,
              a.leading_tight,
              {
                color: line.isIncoming
                  ? t.palette.positive_600
                  : t.palette.negative_500,
                fontVariant: ['tabular-nums'],
              },
            ]}>
            {line.amount}
          </Text>
          <Text
            style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
            {line.isIncoming ? (
              line.people === 1 ? (
                <Trans>From 1 person</Trans>
              ) : (
                <Trans>From {line.people} people</Trans>
              )
            ) : line.people === 1 ? (
              <Trans>To 1 person</Trans>
            ) : (
              <Trans>To {line.people} people</Trans>
            )}
          </Text>
        </View>
      ))}
    </View>
  )
}
