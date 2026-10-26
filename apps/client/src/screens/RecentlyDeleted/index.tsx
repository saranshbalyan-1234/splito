// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Settings/AppPasswords.tsx (tip admonition, animated item list, delete prompt, empty state)
import {useState} from 'react'
import {View} from 'react-native'
import Animated, {LayoutAnimationConfig} from 'react-native-reanimated'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'
import {
  type BinItem,
  type BinType,
  deleteExpense,
  deleteRepayment,
  deleteWriteOff,
  type Group,
  type MutationCtx,
  type Person,
  purgeDeleted,
  restoreExpense,
  restoreRepayment,
  restoreWriteOff,
  type Store,
} from '@splito/sync'

import {useHaptics} from '#/lib/haptics'
import {dateDiff, formatDateDiff} from '#/lib/hooks/useTimeAgo'
import {logger} from '#/logger'
import {useEntities, useMe, useMutationCtx, useStore} from '#/data/hooks'
import {useNumberLocale} from '#/locale/numberLocale'
import {EmptyState} from '#/view/com/util/EmptyState'
import {List} from '#/view/com/util/List'
import {PressableWithHover} from '#/view/com/util/PressableWithHover'
import {atoms as a, useTheme} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {useDialogControl} from '#/components/Dialog'
import {Trash_Stroke2_Corner0_Rounded as TrashIcon} from '#/components/icons/Trash'
import * as Layout from '#/components/Layout'
import {EntryIcon} from '#/components/people/EntryIcon'
import {HistoryRowPlaceholder} from '#/components/people/HistoryRow'
import * as Prompt from '#/components/Prompt'
import {PREF_CONTROLS} from '#/components/settings/prefControls'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {useListAnimations} from '#/motion/listAnimations'
import {usePressScale} from '#/motion/PressableScale'
import {Shimmer} from '#/motion/Shimmer'
import {RestoreDialog} from './components/RestoreDialog'
import {daysLeft} from './days'
import {type BinRowModel, useDescribeBinItem} from './describe'
import {useBin} from '#/data/useBin'

const BinDaysPref = PREF_CONTROLS['history.binDays']

const RESTORE: Record<
  BinType,
  (s: Store, c: MutationCtx, id: string) => Promise<void>
> = {
  expense: restoreExpense,
  repayment: restoreRepayment,
  writeoff: restoreWriteOff,
}
const DELETE: Record<
  BinType,
  (s: Store, c: MutationCtx, id: string) => Promise<void>
> = {
  expense: deleteExpense,
  repayment: deleteRepayment,
  writeoff: deleteWriteOff,
}

/**
 * Recently deleted (F-1203): expenses, payments and write-offs deleted in the
 * last `history.binDays`, newest first, with who deleted them and when.
 * Tapping one opens its restore sheet; restoring writes a new version
 * (versioned history), so it re-enters balances, and the toast offers Undo.
 * "Delete forever" only takes it out of this list: the tombstone and its
 * history stay in the audit trail.
 */
export function RecentlyDeletedScreen() {
  const {t: l, i18n} = useLingui()
  const t = useTheme()
  const store = useStore()
  const ctx = useMutationCtx()
  const haptics = useHaptics()
  const locale = useNumberLocale()
  const me = useMe()
  const people = useEntities<Person>('person')
  const groups = useEntities<Group>('group')
  const bin = useBin()
  const describe = useDescribeBinItem()
  const restoreControl = useDialogControl()
  const purgePrompt = Prompt.usePromptControl()
  const [open, setOpen] = useState<BinItem | null>(null)
  const [toPurge, setToPurge] = useState<BinItem | null>(null)

  const names = new Map((people ?? []).map(p => [p.id, p.data.name]))
  const groupNames = new Map((groups ?? []).map(g => [g.id, g.data.name]))
  const isLoading = !bin || !me || !people || !groups
  const meId = me?.id ?? ''
  const deletedBy = (id: string) =>
    id === meId ? l`You` : (names.get(id) ?? l`Someone`)
  const kindToast = (type: BinType, restored: boolean) =>
    restored
      ? {
          expense: l`Expense restored`,
          repayment: l`Payment restored`,
          writeoff: l`Write-off restored`,
        }[type]
      : {
          expense: l`Expense deleted`,
          repayment: l`Payment deleted`,
          writeoff: l`Write-off undone`,
        }[type]

  const restore = async (item: BinItem) => {
    try {
      await RESTORE[item.type](store, ctx, item.entity.id)
      haptics.success()
      restoreControl.close(() =>
        Toast.show(
          <Toast.Outer>
            <Toast.Icon />
            <Toast.Text>{kindToast(item.type, true)}</Toast.Text>
            <Toast.Action
              label={l`Undo`}
              onPress={() =>
                void DELETE[item.type](store, ctx, item.entity.id).catch(e => {
                  logger.error(e, {where: 'RecentlyDeleted.undo'})
                  Toast.show(l`Couldn’t undo. Please try again.`, {
                    type: 'error',
                  })
                })
              }>
              <Trans context="action">Undo</Trans>
            </Toast.Action>
          </Toast.Outer>,
          {type: 'success'},
        ),
      )
    } catch (e) {
      logger.error(e, {where: 'RecentlyDeleted.restore'})
      Toast.show(l`Couldn’t restore this. Please try again.`, {type: 'error'})
    }
  }

  const purge = async (item: BinItem) => {
    try {
      await purgeDeleted(store, ctx, item.type, item.entity.id)
      haptics.confirm()
      Toast.show(l`Deleted forever`)
    } catch (e) {
      logger.error(e, {where: 'RecentlyDeleted.purge'})
      Toast.show(l`Couldn’t delete this. Please try again.`, {type: 'error'})
    }
  }

  const openModel = open && me ? describe(open, me.id, names, locale) : null
  const count = bin?.items.length ?? 0
  /* Read with fallbacks: the compiler may evaluate list props before the loading check. */
  const days = bin?.days ?? 30
  const readAt = bin?.readAt ?? 0

  const header = (
    <View>
      <View style={[a.px_lg, a.pt_lg, a.pb_sm]}>
        <Admonition type="tip">
          <Trans>
            Deleted expenses, payments and write-offs wait here before they
            leave for good. Restore one and its balances come back.
          </Trans>
        </Admonition>
      </View>
      <BinDaysPref />
      <View
        style={[
          a.flex_row,
          a.align_center,
          a.justify_between,
          a.px_lg,
          a.pt_lg,
          a.pb_sm,
          a.border_t,
          t.atoms.border_contrast_low,
        ]}>
        <Text
          testID="bin-count"
          style={[a.text_md, a.font_semi_bold, t.atoms.text_contrast_medium]}>
          {bin ? plural(count, {one: '# item', other: '# items'}) : l`Loading…`}
        </Text>
      </View>
    </View>
  )

  return (
    <Layout.Screen testID="screen-recently-deleted">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Recently deleted</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <LayoutAnimationConfig skipEntering skipExiting>
        <List
          data={isLoading ? [] : (bin?.items ?? [])}
          keyExtractor={(item: BinItem) => `${item.type}-${item.entity.id}`}
          renderItem={({item, index}: {item: BinItem; index: number}) => {
            const model = describe(item, meId, names, locale)
            const ago = formatDateDiff({
              diff: dateDiff(item.deletedAt, readAt),
              i18n,
            })
            const groupName = model.groupId
              ? groupNames.get(model.groupId)
              : null
            return (
              <BinRow
                item={item}
                model={model}
                isFirst={index === 0}
                byline={[
                  l`Deleted by ${deletedBy(item.deletedBy)} · ${ago}`,
                  groupName,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                left={daysLeft(item.deletedAt, days, readAt)}
                onPress={() => {
                  setOpen(item)
                  restoreControl.open()
                }}
              />
            )
          }}
          ListHeaderComponent={header}
          ListEmptyComponent={
            isLoading ? (
              <Shimmer>
                {Array.from({length: 4}, (_, i) => (
                  <HistoryRowPlaceholder key={i} />
                ))}
              </Shimmer>
            ) : (
              <EmptyState
                testID="bin-empty"
                icon={TrashIcon}
                message={plural(days, {
                  one: 'Nothing deleted in the last day.',
                  other: 'Nothing deleted in the last # days.',
                })}
              />
            )
          }
        />
      </LayoutAnimationConfig>

      <RestoreDialog
        control={restoreControl}
        item={open}
        model={openModel}
        deletedByName={open ? deletedBy(open.deletedBy) : ''}
        groupName={
          openModel?.groupId
            ? (groupNames.get(openModel.groupId) ?? null)
            : null
        }
        days={days}
        readAt={readAt}
        onRestorePressed={restore}
        onDeleteForeverPressed={item => {
          setToPurge(item)
          purgePrompt.open()
        }}
      />
      <Prompt.Basic
        control={purgePrompt}
        title={l`Delete forever?`}
        description={l`It leaves Recently deleted and can’t be restored. Its history stays in the record’s audit trail.`}
        confirmButtonCta={l`Delete forever`}
        confirmButtonColor="negative"
        onConfirm={() => {
          if (toPurge) void purge(toPurge)
        }}
      />
    </Layout.Screen>
  )
}

/** One deleted item, laid out like a history row, with the days it has left. */
function BinRow({
  item,
  model,
  byline,
  left,
  isFirst,
  onPress,
}: {
  item: BinItem
  model: BinRowModel
  byline: string
  left: number
  isFirst: boolean
  onPress: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const listAnimations = useListAnimations()
  const press = usePressScale()
  return (
    <Animated.View {...listAnimations}>
      <PressableWithHover
        testID={`bin-row-${item.entity.id}`}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={model.title}
        accessibilityHint={l`Opens it to restore or delete forever`}
        hoverStyle={t.atoms.bg_contrast_25}
        style={[
          a.px_lg,
          a.py_md,
          !isFirst && [a.border_t, t.atoms.border_contrast_low],
          a.transition_color,
        ]}>
        <Animated.View
          style={[a.flex_row, a.align_center, a.gap_md, press.style]}>
          <View style={{opacity: 0.85}}>
            <EntryIcon
              category={
                item.type === 'expense' ? item.entity.data.category : undefined
              }
              isPayment={item.type === 'repayment'}
              isWriteOff={item.type === 'writeoff'}
            />
          </View>
          <View style={[a.flex_1, a.gap_2xs]}>
            <Text
              emoji
              numberOfLines={1}
              style={[a.text_md, a.font_semi_bold, a.leading_snug]}>
              {model.title}
            </Text>
            <Text
              emoji
              numberOfLines={1}
              style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
              {byline}
            </Text>
          </View>
          <View style={[a.align_end, a.flex_shrink_0, a.gap_2xs]}>
            <Text
              style={[
                a.text_md,
                a.font_semi_bold,
                a.leading_snug,
                t.atoms.text_contrast_medium,
                {
                  textDecorationLine: 'line-through',
                  fontVariant: ['tabular-nums'],
                },
              ]}>
              {model.amount}
            </Text>
            <Text
              style={[
                a.text_xs,
                a.leading_snug,
                left <= 3
                  ? {color: t.palette.negative_500}
                  : t.atoms.text_contrast_low,
              ]}>
              {plural(left, {one: '# day left', other: '# days left'})}
            </Text>
          </View>
        </Animated.View>
      </PressableWithHover>
    </Animated.View>
  )
}
