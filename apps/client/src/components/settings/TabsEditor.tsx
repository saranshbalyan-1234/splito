// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/SavedFeeds.tsx (PinnedFeedItem, onMoveUp/onMoveDown)
import {useState} from 'react'
import {View} from 'react-native'
import {PREFS, type TabId} from '@splito/sync'
import {useLingui} from '@lingui/react/macro'

import {useHaptics} from '#/lib/haptics'
import {useA11y} from '#/state/a11y'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon} from '#/components/Button'
import {SortableList} from '#/components/DraggableList'
import * as Toggle from '#/components/forms/Toggle'
import {
  ArrowBottom_Stroke2_Corner0_Rounded as ArrowDownIcon,
  ArrowTop_Stroke2_Corner0_Rounded as ArrowUpIcon,
} from '#/components/icons/Arrow'
import {Bell_Stroke2_Corner0_Rounded as BellIcon} from '#/components/icons/Bell'
import {ChartPie_Stroke2_Corner0_Rounded as ChartPieIcon} from '#/components/icons/ChartPie'
import {Group3_Stroke2_Corner0_Rounded as GroupIcon} from '#/components/icons/Group'
import {HomeOpen_Stoke2_Corner0_Rounded as HomeIcon} from '#/components/icons/HomeOpen'
import {TabsIcon} from '#/components/settings/icons'
import {PrefSection, usePrefControl} from '#/components/settings/PrefSection'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'

const ROW_HEIGHT = 56

/** Each tab's label and icon, as the sidebar and bottom bar show them. */
export function useTabLabels(): Record<TabId, string> {
  const {t: l} = useLingui()
  return {
    people: l`People`,
    groups: l`Groups`,
    analytics: l`Analytics`,
    activity: l`Activity`,
  }
}

const TAB_ICONS = {
  people: HomeIcon,
  groups: GroupIcon,
  analytics: ChartPieIcon,
  activity: BellIcon,
} satisfies Record<TabId, unknown>

type Row = {tab: TabId; isVisible: boolean}

function visibleKey(rows: Row[]) {
  return rows
    .filter(r => r.isVisible)
    .map(r => r.tab)
    .join(',')
}

function rowsFor(visible: TabId[]): Row[] {
  const hidden = PREFS.tabs.default.filter(tab => !visible.includes(tab))
  return [
    ...visible.map(tab => ({tab, isVisible: true})),
    ...hidden.map(tab => ({tab, isVisible: false})),
  ]
}

/**
 * Tabs and order: show, hide and reorder the bottom bar / sidebar tabs by
 * dragging (Bluesky's pinned-feeds list) or with the arrow buttons (shown on
 * web and to screen readers, as Bluesky's accessible feed list). At least one
 * tab stays on, and Settings is always one tap away on the header avatar.
 */
export function TabsEditor() {
  const t = useTheme()
  const {t: l} = useLingui()
  const pref = usePrefControl('tabs')
  const haptics = useHaptics()
  const {screenReaderEnabled} = useA11y()
  const labels = useTabLabels()
  /*
   * Only visible tabs are stored, so where a hidden tab sits is kept here for
   * the visit. The local order wins while it agrees with the store (or the
   * store has not caught up with our last save yet); a change from elsewhere,
   * such as Reset, rebuilds it.
   */
  const [local, setLocal] = useState<{rows: Row[]; over: string} | null>(null)
  const stored = pref.value
  if (!stored) return null
  const storedKey = stored.join(',')
  const rows =
    local && (visibleKey(local.rows) === storedKey || local.over === storedKey)
      ? local.rows
      : rowsFor(stored)

  const save = (next: Row[]) => {
    setLocal({rows: next, over: storedKey})
    void pref.set(next.filter(r => r.isVisible).map(r => r.tab))
  }
  const visibleCount = rows.filter(r => r.isVisible).length
  const showArrows = IS_WEB || screenReaderEnabled

  const move = (index: number, by: -1 | 1) => {
    const next = [...rows]
    const [row] = next.splice(index, 1)
    next.splice(index + by, 0, row!)
    haptics.selection()
    save(next)
  }

  return (
    <PrefSection
      pref={pref}
      icon={TabsIcon}
      title={l`Tabs`}
      description={l`Choose the tabs you see and their order. Settings and your profile stay on your avatar, top right.`}>
      <View
        style={[
          a.rounded_md,
          a.overflow_hidden,
          a.border,
          t.atoms.border_contrast_low,
        ]}>
        <SortableList
          data={rows}
          keyExtractor={r => r.tab}
          itemHeight={ROW_HEIGHT}
          onReorder={next => save(next)}
          renderItem={(row, dragHandle) => {
            const index = rows.indexOf(row)
            return (
              <TabRow
                row={row}
                label={labels[row.tab]}
                dragHandle={dragHandle}
                isLast={index === rows.length - 1}
                isOnlyVisible={row.isVisible && visibleCount === 1}
                onToggle={isVisible =>
                  save(
                    rows.map(r => (r.tab === row.tab ? {...r, isVisible} : r)),
                  )
                }
                arrows={
                  showArrows
                    ? {
                        onUp: index > 0 ? () => move(index, -1) : undefined,
                        onDown:
                          index < rows.length - 1
                            ? () => move(index, 1)
                            : undefined,
                      }
                    : undefined
                }
              />
            )
          }}
        />
      </View>
    </PrefSection>
  )
}

function TabRow({
  row,
  label,
  dragHandle,
  isLast,
  isOnlyVisible,
  onToggle,
  arrows,
}: {
  row: Row
  label: string
  dragHandle: React.ReactNode
  isLast: boolean
  isOnlyVisible: boolean
  onToggle: (isVisible: boolean) => void
  arrows?: {onUp?: () => void; onDown?: () => void}
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const Icon = TAB_ICONS[row.tab]
  return (
    <View
      style={[
        a.flex_row,
        a.align_center,
        a.gap_sm,
        a.pr_md,
        t.atoms.bg,
        !isLast && [a.border_b, t.atoms.border_contrast_low],
        {height: ROW_HEIGHT},
      ]}>
      {dragHandle}
      <Icon
        size="md"
        fill={
          row.isVisible ? t.atoms.text.color : t.atoms.text_contrast_low.color
        }
      />
      <Text
        numberOfLines={1}
        style={[
          a.flex_1,
          a.text_md,
          a.font_medium,
          row.isVisible ? t.atoms.text : t.atoms.text_contrast_low,
        ]}>
        {label}
      </Text>
      {arrows && (
        <>
          <Button
            testID={`tabs-up-${row.tab}`}
            label={l`Move ${label} up`}
            onPress={arrows.onUp ?? (() => {})}
            disabled={!arrows.onUp}
            size="small"
            color="secondary"
            variant="ghost"
            shape="round">
            <ButtonIcon icon={ArrowUpIcon} />
          </Button>
          <Button
            testID={`tabs-down-${row.tab}`}
            label={l`Move ${label} down`}
            onPress={arrows.onDown ?? (() => {})}
            disabled={!arrows.onDown}
            size="small"
            color="secondary"
            variant="ghost"
            shape="round">
            <ButtonIcon icon={ArrowDownIcon} />
          </Button>
        </>
      )}
      <Toggle.Item
        type="checkbox"
        testID={`tabs-toggle-${row.tab}`}
        name={row.tab}
        label={row.isVisible ? l`Hide ${label}` : l`Show ${label}`}
        value={row.isVisible}
        disabled={isOnlyVisible}
        onChange={onToggle}>
        <Toggle.Platform />
      </Toggle.Item>
    </View>
  )
}
