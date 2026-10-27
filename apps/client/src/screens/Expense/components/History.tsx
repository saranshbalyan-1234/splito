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
import {usePref} from '#/data/hooks'
import {atoms as a, useTheme} from '#/alf'
import {ArrowRotateCounterClockwise_Stroke2_Corner0_Rounded as UndoIcon} from '#/components/icons/ArrowRotate'
import {CirclePlus_Stroke2_Corner0_Rounded as CreatedIcon} from '#/components/icons/CirclePlus'
import {Cloud_Stroke2_Corner0_Rounded as CloudIcon} from '#/components/icons/Cloud'
import {type Props as SVGIconProps} from '#/components/icons/common'
import {Pencil_Stroke2_Corner0_Rounded as PencilIcon} from '#/components/icons/Pencil'
import {Trash_Stroke2_Corner0_Rounded as TrashIcon} from '#/components/icons/Trash'
import {
  formatDay,
  SectionLabel,
  useDisplayName,
} from '#/components/split/shared'
import {useRowStatus} from '#/components/SyncStatus'
import {Text} from '#/components/Typography'

type Kind = 'created' | 'edited' | 'deleted' | 'restored'

/**
 * Every stored version of the expense, newest first: who added, edited,
 * deleted or restored it, when, and what changed. Versions are local until
 * sync exists, which the footer says plainly.
 */
export function History({
  history,
  sync,
}: {
  history: HistoryRow[]
  /** The expense's own sync state: the footer says what it means, in the same words as the marker. */
  sync: Pick<RowSync, 'syncStatus'>
}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const locale = useNumberLocale()
  const name = useDisplayName()
  const [categories = PREFS.categories.default] = usePref('categories')
  const categoryName = (id: string) =>
    categories.find(c => c.id === id)?.name ?? id

  const entries = history.map((row, i) => {
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
        changes.push(
          l`Date: ${formatDay(i18n, was.date)} → ${formatDay(i18n, now.date)}`,
        )
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
    return {row, kind, changes}
  })

  const {kind: syncKind} = useRowStatus(sync)
  const footer = {
    local: l`Only on this device. Sign in to sync it to your other devices.`,
    device: l`Saved on this device. Sign in to sync it to your other devices.`,
    waiting: l`Saved on this device. It syncs to your other devices when you are online.`,
    syncing: l`Syncing to your other devices.`,
    synced: l`Synced to your other devices.`,
    attention: l`This expense needs attention: it hasn’t synced.`,
  }[syncKind]

  const titles: Record<Kind, (who: string) => string> = {
    created: who => l`${who} added this expense`,
    edited: who => l`${who} edited this expense`,
    deleted: who => l`${who} deleted this expense`,
    restored: who => l`${who} restored this expense`,
  }
  const icons: Record<Kind, React.ComponentType<SVGIconProps>> = {
    created: CreatedIcon,
    edited: PencilIcon,
    deleted: TrashIcon,
    restored: UndoIcon,
  }

  return (
    <View testID="expense-history">
      <SectionLabel>{l`History`}</SectionLabel>
      {[...entries].reverse().map(({row, kind, changes}, i, all) => {
        const Icon = icons[kind]
        return (
          <View
            key={row.version}
            testID={`history-${kind}`}
            style={[a.flex_row, a.gap_md, a.px_lg]}>
            <View style={[a.align_center]}>
              <View
                style={[
                  a.align_center,
                  a.justify_center,
                  a.rounded_full,
                  t.atoms.bg_contrast_25,
                  {width: 32, height: 32},
                ]}>
                <Icon
                  size="sm"
                  fill={
                    kind === 'deleted'
                      ? t.palette.negative_500
                      : t.atoms.text_contrast_medium.color
                  }
                />
              </View>
              {i < all.length - 1 ? (
                <View
                  style={[
                    a.flex_1,
                    {width: 2, minHeight: 12},
                    t.atoms.bg_contrast_50,
                  ]}
                />
              ) : null}
            </View>
            <View style={[a.flex_1, a.gap_2xs, a.pb_lg, {paddingTop: 6}]}>
              <Text style={[a.text_md, a.font_medium, a.leading_snug]}>
                {titles[kind](name(row.actor))}
              </Text>
              {changes.map(c => (
                <Text
                  key={c}
                  style={[
                    a.text_sm,
                    a.leading_snug,
                    t.atoms.text_contrast_high,
                  ]}>
                  {c}
                </Text>
              ))}
              <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                {i18n.date(new Date(row.at), {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </Text>
            </View>
          </View>
        )
      })}
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
    </View>
  )
}
