import {useState} from 'react'
import {View} from 'react-native'
import {LayoutAnimationConfig} from 'react-native-reanimated'
import {Trans, useLingui} from '@lingui/react/macro'
import {type RouteProp, useNavigation, useRoute} from '@react-navigation/native'
import {
  fnv1a64,
  type Plan,
  type PlanMode,
  planSettlement,
  type Transfer,
} from '@splito/domain'
import {type Group, type Person} from '@splito/sync'

import {type AllNavigatorParams, type NavigationProp} from '#/lib/routes/types'
import {useEntities, useLedger, useMe, usePref} from '#/data/hooks'
import {useNumberLocale} from '#/locale/numberLocale'
import {EmptyState} from '#/view/com/util/EmptyState'
import {List} from '#/view/com/util/List'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import * as Admonition from '#/components/Admonition'
import {ButtonIcon, ButtonText} from '#/components/Button'
import {useDialogControl} from '#/components/Dialog'
import * as SegmentedControl from '#/components/forms/SegmentedControl'
import {memberNets} from '#/components/groups/net'
import {NO_RULES} from '#/components/groups/RulesEditor'
import {ArrowRotateCounterClockwise_Stroke2_Corner0_Rounded as RefreshIcon} from '#/components/icons/ArrowRotate'
import {CircleCheck_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/CircleCheck'
import * as Layout from '#/components/Layout'
import {currencyName} from '#/components/people/ledger'
import {
  type PaymentDraft,
  RecordPaymentDialog,
} from '#/components/people/RecordPaymentDialog'
import * as Skeleton from '#/components/Skeleton'
import {Text} from '#/components/Typography'
import {Shimmer} from '#/motion/Shimmer'
import {TransferRow} from './components/TransferRow'

type CurrencyPlan = {currency: string; plan: Plan | null}
type Snapshot = {hash: string; mode: PlanMode; plans: CurrencyPlan[]}

type Item =
  | {type: 'currency'; key: string; currency: string; count: number | null}
  | {type: 'transfer'; key: string; currency: string; transfer: Transfer}
  | {type: 'infeasible'; key: string; currency: string; stuck: string[]}
  | {type: 'settled'; key: string; currency: string}

/**
 * Settle up a group: per currency, the plan from `planSettlement` over the
 * members' nets and the group's rules, in direct or via-others mode. The
 * plan shown is a snapshot with a hash; when expenses, payments, rules or
 * members change it is marked stale until the user updates it. A plan is
 * never a payment: each transfer is recorded only when the user says it
 * happened.
 */
export function SettleScreen() {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const {gtMobile} = useBreakpoints()
  const locale = useNumberLocale()
  const navigation = useNavigation<NavigationProp>()
  const {groupId} = useRoute<RouteProp<AllNavigatorParams, 'Settle'>>().params
  const me = useMe()
  const people = useEntities<Person>('person')
  const groups = useEntities<Group>('group')
  const ledger = useLedger()
  const [modePref] = usePref('settleMode')
  const [chosenMode, setChosenMode] = useState<PlanMode | null>(null)
  const mode = chosenMode ?? modePref ?? 'direct'
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [isAdopting, setIsAdopting] = useState(false)
  const paymentControl = useDialogControl()
  const [draft, setDraft] = useState<PaymentDraft | null>(null)

  const isLoading = !me || !people || !groups || !ledger || !modePref
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
        plan: Object.values(net).some(v => v !== 0n)
          ? planSettlement(net, rules, mode)
          : null,
      }),
    )
    current = {
      mode,
      plans,
      hash: fnv1a64(
        plans.map(p => `${p.currency}:${p.plan?.hash ?? '0'}`).join('|'),
      ),
    }
  }

  /*
   * Adopt the live plan on first load, on a mode switch, and after a payment
   * recorded here. Any other change only marks the shown plan stale.
   */
  if (
    current &&
    (snapshot === null ||
      snapshot.mode !== current.mode ||
      (isAdopting && snapshot.hash !== current.hash))
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
        {type: 'currency', key: `cur-${currency}`, currency, count: null},
        {type: 'settled', key: `settled-${currency}`, currency},
      ]
    if (plan.status === 'infeasible')
      return [
        {type: 'currency', key: `cur-${currency}`, currency, count: null},
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
      },
      ...plan.transfers.map(transfer => ({
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
        <Skeleton.Pill size={40} style={{width: '100%', maxWidth: 420}} />
        <Skeleton.Text style={[a.text_sm, {width: 280}]} />
      </View>
    </Shimmer>
  ) : (
    <View style={[a.px_lg, a.pt_lg, a.pb_md, a.gap_md]}>
      <View style={[{maxWidth: 420}]}>
        <SegmentedControl.Root
          label={l`Plan type`}
          type="radio"
          value={mode}
          onChange={setChosenMode}>
          <SegmentedControl.Item
            value="direct"
            label={l`Direct`}
            testID="settle-mode-direct">
            <SegmentedControl.ItemText>
              <Trans>Direct</Trans>
            </SegmentedControl.ItemText>
          </SegmentedControl.Item>
          <SegmentedControl.Item
            value="transit"
            label={l`Via others`}
            testID="settle-mode-transit">
            <SegmentedControl.ItemText>
              <Trans>Via others</Trans>
            </SegmentedControl.ItemText>
          </SegmentedControl.Item>
        </SegmentedControl.Root>
      </View>
      <Text
        testID="settle-explanation"
        style={[
          a.text_md,
          a.leading_snug,
          t.atoms.text_contrast_medium,
          {maxWidth: 720},
        ]}>
        {mode === 'direct' ? (
          <Trans>
            Everyone who owes pays the people who are owed, straight to them.
          </Trans>
        ) : (
          <Trans>
            Payments may pass through other members when a direct pair isn’t
            allowed. Everyone still ends up even.
          </Trans>
        )}{' '}
        <Trans>
          Only pairs allowed in Who you settle with are used, preferred pairs
          first, so the plan isn’t always the fewest payments.
        </Trans>
      </Text>
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
                    <Text style={[a.text_lg, a.font_bold]}>
                      {currencyName(item.currency, i18n.locale)}
                    </Text>
                    {item.count !== null && (
                      <Text
                        testID={`settle-count-${item.currency}`}
                        style={[a.text_sm, t.atoms.text_contrast_medium]}>
                        {item.count === 1 ? (
                          <Trans>1 payment</Trans>
                        ) : (
                          <Trans>{item.count} payments</Trans>
                        )}
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
                    style={[
                      a.flex_row,
                      a.align_center,
                      a.gap_sm,
                      a.px_lg,
                      a.pb_lg,
                    ]}>
                    <CheckIcon size="md" fill={t.palette.positive_600} />
                    <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
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
                            {mode === 'direct' ? (
                              <Trans>
                                No direct plan works with these rules
                              </Trans>
                            ) : (
                              <Trans>No plan works with these rules</Trans>
                            )}
                          </Admonition.Text>
                          <Text
                            testID={`settle-stuck-${item.currency}`}
                            style={[a.text_sm, a.leading_snug, a.pr_md]}>
                            {mode === 'direct' ? (
                              <Trans>
                                No allowed pair to pay anyone who is owed:{' '}
                                {nameList(item.stuck)}
                              </Trans>
                            ) : (
                              <Trans>
                                No allowed route to anyone who is owed, even
                                through other members: {nameList(item.stuck)}
                              </Trans>
                            )}
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
                        {mode === 'direct' && (
                          <Admonition.Button
                            testID="settle-try-transit"
                            label={l`Try via others`}
                            color="primary_subtle"
                            onPress={() => setChosenMode('transit')}>
                            <ButtonText>
                              <Trans>Try via others</Trans>
                            </ButtonText>
                          </Admonition.Button>
                        )}
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
                style={[
                  a.px_lg,
                  a.pt_lg,
                  a.gap_2xs,
                  a.border_t,
                  t.atoms.border_contrast_low,
                  {paddingBottom: gtMobile ? 40 : 100},
                ]}>
                <Text
                  style={[
                    a.text_sm,
                    a.leading_snug,
                    t.atoms.text_contrast_medium,
                  ]}>
                  <Trans>
                    Splito never moves money. Record each payment once it has
                    happened – part payments are fine.
                  </Trans>
                </Text>
                <Text
                  testID="settle-plan-id"
                  style={[
                    a.text_xs,
                    t.atoms.text_contrast_low,
                    {fontVariant: ['tabular-nums']},
                  ]}>
                  <Trans>Plan {snapshot.hash.slice(0, 8)}</Trans>
                </Text>
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
