import {useRef} from 'react'
import {ScrollView, View} from 'react-native'
import {useAnimatedRef} from 'react-native-reanimated'
import type Animated from 'react-native-reanimated'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation, useRoute, type RouteProp} from '@react-navigation/native'
import {formatAmount} from '@splito/domain'
import {
  type Entity,
  type Group,
  type HistoryRow,
  type Repayment,
  restoreRepayment,
} from '@splito/sync'

import {type AllNavigatorParams, type NavigationProp} from '#/lib/routes/types'
import {useNumberLocale} from '#/locale/numberLocale'
import {useFormatDay, useTimeZone} from '#/locale/useDates'
import {
  useEntities,
  useEntity,
  useHistory,
  useMutationCtx,
  useStore,
} from '#/data/hooks'
import {EmptyState} from '#/view/com/util/EmptyState'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {
  DiscussionComposer,
  DiscussionProvider,
  DiscussionTimeline,
} from '#/components/comments/Discussion'
import {ArrowRotateCounterClockwise_Stroke2_Corner0_Rounded as UndoIcon} from '#/components/icons/ArrowRotate'
import {CirclePlus_Stroke2_Corner0_Rounded as CreatedIcon} from '#/components/icons/CirclePlus'
import {Trash_Stroke2_Corner0_Rounded as TrashIcon} from '#/components/icons/Trash'
import * as Layout from '#/components/Layout'
import {
  SectionLabel,
  useAvatarName,
  useDisplayName,
  useErrorText,
} from '#/components/split/shared'
import {ReceiptIcon} from '#/components/split/icons'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {SyncStatusLine} from '#/components/SyncStatus'
import {SyncToned} from '#/components/SyncTone'
import {DisputeLine, isDisputeLine} from '#/components/disputes/DisputeLine'
import {DisputePanel} from '#/components/disputes/DisputePanel'
import {RecordMenuItems} from '#/components/disputes/RecordMenuItems'
import {markOf, useDisputeEvents, useOpenDisputes} from '#/state/disputes'
import {DisputeBadge} from '#/components/disputes/DisputeBadge'
import {DotGrid3x1_Stroke2_Corner0_Rounded as DotsIcon} from '#/components/icons/DotGrid'
import * as Menu from '#/components/Menu'

/**
 * One recorded payment: who paid whom, how much, when and where, and the
 * discussion under it (F-1204). Payments are never edited, so the timeline
 * holds the comments and when the payment was recorded, deleted or restored.
 * Deleting stays in the payment's details sheet on the friend and group pages.
 */
export function RepaymentScreen() {
  const {t: l} = useLingui()
  const {params} = useRoute<RouteProp<AllNavigatorParams, 'Repayment'>>()
  const navigation = useNavigation<NavigationProp>()
  const payment = useEntity<Repayment>('repayment', params.repaymentId)
  const history = useHistory('repayment', params.repaymentId)

  return (
    <Layout.Screen testID="screen-repayment">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText testID="repayment-detail-title">
            <Trans>Payment</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        {payment && !payment.deleted ? (
          <Menu.Root>
            <Menu.Trigger label={l`Payment options`}>
              {({props}) => (
                <Layout.Header.Slot>
                  <Button
                    {...props}
                    testID="repayment-menu"
                    label={props.accessibilityLabel}
                    size="small"
                    color="secondary"
                    variant="ghost"
                    shape="round">
                    <ButtonIcon icon={DotsIcon} size="lg" />
                  </Button>
                </Layout.Header.Slot>
              )}
            </Menu.Trigger>
            <Menu.Outer>
              <Menu.Group>
                <RecordMenuItems targetType="repayment" targetId={payment.id} />
              </Menu.Group>
            </Menu.Outer>
          </Menu.Root>
        ) : (
          <Layout.Header.Slot />
        )}
      </Layout.Header.Outer>
      {payment === undefined || !history ? null : payment === null ? (
        <EmptyState
          testID="repayment-not-found"
          icon={ReceiptIcon}
          message={l`This payment doesn’t exist. The link may be wrong.`}
          button={{
            label: l`Go to People`,
            text: l`Go to People`,
            onPress: () => navigation.navigate('People'),
            size: 'small',
            color: 'secondary',
          }}
        />
      ) : (
        <Detail payment={payment} history={history} />
      )}
    </Layout.Screen>
  )
}

function Detail({
  payment,
  history,
}: {
  payment: Entity<Repayment>
  history: HistoryRow[]
}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const {gtTablet} = useBreakpoints()
  const store = useStore()
  const ctx = useMutationCtx()
  const locale = useNumberLocale()
  const formatDay = useFormatDay()
  const tz = useTimeZone()
  const name = useDisplayName()
  const avatarName = useAvatarName()
  const errorText = useErrorText()
  const groups = useEntities<Group>('group')
  const panel = useRef<React.ComponentRef<typeof ScrollView>>(null)
  const page = useAnimatedRef<Animated.ScrollView>()
  const {from, to, amount, currency, date, note, groupId} = payment.data
  const group = groupId ? groups?.find(g => g.id === groupId) : undefined
  const title =
    from === ctx.actor
      ? l`You paid ${name(to)}`
      : to === ctx.actor
        ? l`${name(from)} paid you`
        : l`${name(from)} paid ${name(to)}`

  /* A payment is never edited: a version is its recording, a delete or a restore. */
  const historyLines = history.map((row, i) => ({
    key: `history:${row.version}`,
    at: row.at,
    kind:
      i === 0
        ? ('created' as const)
        : row.deleted
          ? ('deleted' as const)
          : ('restored' as const),
    actor: row.actor,
  }))
  const lines = [...historyLines, ...useDisputeEvents('repayment', payment.id)]
  const open = useOpenDisputes()
  const mark = markOf(open, 'repayment', payment.id)
  const lineText = (kind: 'created' | 'deleted' | 'restored', who: string) =>
    ({
      created: l`${who} recorded this payment`,
      deleted: l`${who} deleted this payment`,
      restored: l`${who} restored this payment`,
    })[kind]

  const people = [from, to]
    .filter((id, i, all) => id !== ctx.actor && all.indexOf(id) === i)
    .map(id => ({id, name: avatarName(id), avatarName: avatarName(id)}))
  const scrollToEnd = () =>
    setTimeout(() => {
      ;(
        page.current as unknown as {
          scrollToEnd?: (o: {animated: boolean}) => void
        } | null
      )?.scrollToEnd?.({animated: true})
      panel.current?.scrollToEnd({animated: true})
    }, 60)

  const hero = (
    <View style={[a.px_lg, a.pt_xl, a.pb_lg, a.gap_md]}>
      <Text emoji style={[a.text_xl, a.font_semi_bold, a.leading_tight]}>
        {title}
      </Text>
      <Text
        testID="repayment-detail-amount"
        style={[
          a.text_5xl,
          a.font_bold,
          a.leading_tight,
          {fontVariant: ['tabular-nums']},
        ]}>
        {formatAmount(amount, currency, locale)}
      </Text>
      <View style={[a.rounded_md, a.border, t.atoms.border_contrast_low]}>
        <Row
          label={l`Date`}
          value={formatDay(date, {intl: {dateStyle: 'long'}})}
          first
        />
        <Row
          label={l`Where`}
          value={
            group?.data.name ?? (groupId ? l`A group` : l`Direct, no group`)
          }
        />
        {note ? <Row label={l`Note`} value={note} /> : null}
      </View>
      {mark && !payment.deleted ? <DisputeBadge kind={mark === 'hold' ? 'hold' : 'dispute'} testID="repayment-disputed" /> : null}
      <DisputePanel targetType="repayment" targetId={payment.id} currency={currency} inset={false} />
      <SyncStatusLine row={payment} testID="repayment-sync-status" />
      <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
        <Trans>A record of money that changed hands outside Splito.</Trans>
      </Text>
    </View>
  )

  const deletedBanner = payment.deleted ? (
    <View
      testID="repayment-deleted"
      style={[
        a.mx_lg,
        a.mt_lg,
        a.p_md,
        a.rounded_md,
        a.flex_row,
        a.align_center,
        a.gap_md,
        {backgroundColor: t.palette.negative_25},
      ]}>
      <TrashIcon size="md" fill={t.palette.negative_500} />
      <Text style={[a.flex_1, a.text_md, a.leading_snug]}>
        <Trans>
          This payment was deleted. It no longer counts towards any balance.
        </Trans>
      </Text>
      <Button
        testID="repayment-restore"
        label={l`Restore payment`}
        size="small"
        color="secondary"
        onPress={() =>
          void restoreRepayment(store, ctx, payment.id).catch(e =>
            Toast.show(errorText((e as {code?: string}).code ?? ''), {
              type: 'error',
            }),
          )
        }>
        <ButtonIcon icon={UndoIcon} />
        <ButtonText>
          <Trans>Restore</Trans>
        </ButtonText>
      </Button>
    </View>
  ) : null

  const discussion = (
    <>
      <SectionLabel>
        <Trans>Discussion</Trans>
      </SectionLabel>
      <DiscussionTimeline
        lines={lines}
        renderLine={line =>
          isDisputeLine(line) ? (
            <DisputeLine event={line} />
          ) : (
          <View
            testID={`history-${line.kind}`}
            style={[
              a.flex_row,
              a.align_center,
              a.justify_center,
              a.gap_xs,
              a.px_xl,
              a.pt_md,
            ]}>
            {line.kind === 'created' ? (
              <CreatedIcon
                size="xs"
                fill={t.atoms.text_contrast_medium.color}
              />
            ) : line.kind === 'deleted' ? (
              <TrashIcon size="xs" fill={t.palette.negative_500} />
            ) : (
              <UndoIcon size="xs" fill={t.atoms.text_contrast_medium.color} />
            )}
            <Text
              style={[
                a.text_sm,
                a.font_medium,
                a.leading_snug,
                a.text_center,
                t.atoms.text_contrast_high,
              ]}>
              {lineText(line.kind, name(line.actor))}
              <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                {' · '}
                {i18n.date(new Date(line.at), {
                  timeStyle: 'short',
                  timeZone: tz,
                })}
              </Text>
            </Text>
          </View>
          )
        }
      />
    </>
  )

  return (
    <DiscussionProvider
      targetType="repayment"
      targetId={payment.id}
      canComment={!payment.deleted}
      people={people}
      onSent={scrollToEnd}>
      {gtTablet ? (
        <View style={[a.flex_1, a.flex_row, a.align_stretch, {minHeight: 0}]}>
          <View style={[a.flex_1, {flexGrow: 3, flexBasis: 0, minWidth: 0}]}>
            <Layout.Content contentContainerStyle={[a.pb_5xl]}>
              {deletedBanner}
              <SyncToned status={payment.syncStatus}>{hero}</SyncToned>
            </Layout.Content>
          </View>
          <View
            style={[
              a.flex_1,
              {flexGrow: 2, flexBasis: 0, minWidth: 0},
              a.border_l,
              t.atoms.border_contrast_low,
            ]}>
            <ScrollView
              ref={panel}
              testID="repayment-discussion-panel"
              style={[a.flex_1]}
              contentContainerStyle={[a.pb_lg]}>
              {discussion}
            </ScrollView>
            <DiscussionComposer />
          </View>
        </View>
      ) : (
        <>
          <Layout.Content ref={page} contentContainerStyle={[a.pb_5xl]}>
            {deletedBanner}
            <SyncToned status={payment.syncStatus}>{hero}</SyncToned>
            {discussion}
          </Layout.Content>
          <DiscussionComposer />
        </>
      )}
    </DiscussionProvider>
  )
}

function Row({
  label,
  value,
  first = false,
}: {
  label: string
  value: string
  first?: boolean
}) {
  const t = useTheme()
  return (
    <View
      style={[
        a.flex_row,
        a.justify_between,
        a.gap_md,
        a.px_md,
        a.py_sm,
        !first && [a.border_t, t.atoms.border_contrast_low],
      ]}>
      <Text style={[a.text_md, t.atoms.text_contrast_medium]}>{label}</Text>
      <Text emoji style={[a.flex_1, a.text_md, a.text_right]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  )
}
