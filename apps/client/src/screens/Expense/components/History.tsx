import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'
import {formatAmount} from '@splito/domain'
import {
  encode,
  type Expense,
  type HistoryRow,
  PREFS,
  type RowSync,
} from '@splito/sync'

import {useNumberLocale} from '#/locale/numberLocale'
import {useFormatDay, useTimeZone} from '#/locale/useDates'
import {usePref} from '#/data/hooks'
import {atoms as a, useTheme} from '#/alf'
import {ArrowRotateCounterClockwise_Stroke2_Corner0_Rounded as UndoIcon} from '#/components/icons/ArrowRotate'
import {CirclePlus_Stroke2_Corner0_Rounded as CreatedIcon} from '#/components/icons/CirclePlus'
import {Cloud_Stroke2_Corner0_Rounded as CloudIcon} from '#/components/icons/Cloud'
import {type Props as SVGIconProps} from '#/components/icons/common'
import {Pencil_Stroke2_Corner0_Rounded as PencilIcon} from '#/components/icons/Pencil'
import {Trash_Stroke2_Corner0_Rounded as TrashIcon} from '#/components/icons/Trash'
import {useDisplayName} from '#/components/split/shared'
import {useRowStatus} from '#/components/SyncStatus'
import {Text} from '#/components/Typography'

type Kind = 'created' | 'edited' | 'deleted' | 'restored'

/** One stored version of the expense as a timeline line (F-1204): who did what, when, and what changed. */
export interface HistoryLineData {
  key: string
  at: number
  kind: Kind
  actor: string
  changes: string[]
}

/**
 * Every stored version of the expense as a line for the discussion's one
 * timeline: who added, edited, deleted or restored it, when, and what changed
 * ("Amount: ₹600.00 → ₹750.00"). Oldest first.
 */
export function useHistoryLines(history: HistoryRow[]): HistoryLineData[] {
  const {t: l} = useLingui()
  const locale = useNumberLocale()
  const formatDay = useFormatDay()
  const [categories = PREFS.categories.default] = usePref('categories')
  const categoryName = (id: string) =>
    categories.find(c => c.id === id)?.name ?? id

  return history.map((row, i) => {
    const prev = history[i - 1]
    const kind: Kind = !prev
      ? 'created'
      : row.deleted && !prev.deleted
        ? 'deleted'
        : !row.deleted && prev.deleted
          ? 'restored'
          : 'edited'
    const now = row.data as Expense
    const was = prev?.data as Expense | undefined
    const changes: string[] = []
    if (kind === 'edited' && was) {
      if (was.title !== now.title)
        changes.push(l`Title: ${was.title} → ${now.title}`)
      if (was.total !== now.total || was.currency !== now.currency)
        changes.push(
          l`Amount: ${formatAmount(was.total, was.currency, locale)} → ${formatAmount(now.total, now.currency, locale)}`,
        )
      if (was.date !== now.date)
        changes.push(l`Date: ${formatDay(was.date)} → ${formatDay(now.date)}`)
      if (was.category !== now.category)
        changes.push(
          l`Category: ${categoryName(was.category)} → ${categoryName(now.category)}`,
        )
      if (was.groupId !== now.groupId) changes.push(l`Moved to another group`)
      // A new total moves single-payer amounts and equal shares with it; only report real changes.
      const payerIds = (e: Expense) => Object.keys(e.payers).sort().join()
      if (
        payerIds(was) !== payerIds(now) ||
        (was.total === now.total && encode(was.payers) !== encode(now.payers))
      )
        changes.push(l`Changed who paid`)
      if (encode(was.split) !== encode(now.split))
        changes.push(l`Changed the split`)
      if (was.notes !== now.notes) changes.push(l`Edited the notes`)
    }
    return {
      key: `history:${row.version}`,
      at: row.at,
      kind,
      actor: row.actor,
      changes,
    }
  })
}

/**
 * A history line inside the timeline, drawn like Bluesky's system messages in a
 * chat: centred, quiet, with a small glyph for what happened.
 */
export function HistoryLine({line}: {line: HistoryLineData}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const tz = useTimeZone()
  const name = useDisplayName()
  const who = name(line.actor)
  const title = {
    created: l`${who} added this expense`,
    edited: l`${who} edited this expense`,
    deleted: l`${who} deleted this expense`,
    restored: l`${who} restored this expense`,
  }[line.kind]
  const icons: Record<Kind, React.ComponentType<SVGIconProps>> = {
    created: CreatedIcon,
    edited: PencilIcon,
    deleted: TrashIcon,
    restored: UndoIcon,
  }
  const Icon = icons[line.kind]
  return (
    <View
      testID={`history-${line.kind}`}
      style={[a.align_center, a.gap_2xs, a.px_xl, a.pt_md]}>
      <View
        style={[
          a.flex_row,
          a.align_center,
          a.justify_center,
          a.gap_xs,
          a.flex_wrap,
        ]}>
        <Icon
          size="xs"
          fill={
            line.kind === 'deleted'
              ? t.palette.negative_500
              : t.atoms.text_contrast_medium.color
          }
        />
        <Text
          style={[
            a.text_sm,
            a.font_medium,
            a.leading_snug,
            a.text_center,
            t.atoms.text_contrast_high,
          ]}>
          {title}
          <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
            {' · '}
            {i18n.date(new Date(line.at), {timeStyle: 'short', timeZone: tz})}
          </Text>
        </Text>
      </View>
      {line.changes.map(c => (
        <Text
          key={c}
          style={[
            a.text_xs,
            a.leading_snug,
            a.text_center,
            t.atoms.text_contrast_medium,
          ]}>
          {c}
        </Text>
      ))}
    </View>
  )
}

/** What the expense's sync state means, in the same words as the marker; local until sync exists. */
export function SyncFooter({sync}: {sync: Pick<RowSync, 'syncStatus'>}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {kind: syncKind} = useRowStatus(sync)
  const footer = {
    local: l`Only on this device. It will sync to your other devices once sync arrives.`,
    device: l`Saved on this device. It will sync to your other devices once sync arrives.`,
    waiting: l`Saved on this device. It syncs to your other devices when you are online.`,
    syncing: l`Syncing to your other devices.`,
    synced: l`Synced to your other devices.`,
    attention: l`This expense needs attention: it hasn’t synced.`,
  }[syncKind]
  return (
    <View
      testID="expense-sync-status"
      style={[a.flex_row, a.align_start, a.gap_sm, a.px_lg, a.pt_xs]}>
      {/* Nudged onto the first line's centre (20px line, 16px glyph). */}
      <CloudIcon
        size="sm"
        fill={t.atoms.text_contrast_medium.color}
        style={{marginTop: 2}}
      />
      <Text
        style={[
          a.flex_1,
          a.text_sm,
          a.leading_snug,
          t.atoms.text_contrast_medium,
        ]}>
        {footer}
      </Text>
    </View>
  )
}
