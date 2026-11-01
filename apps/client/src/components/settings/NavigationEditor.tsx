// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/SavedFeeds.tsx (PinnedFeedItem, onMoveUp/onMoveDown)
import {useState} from 'react'
import {View} from 'react-native'
import {type NavItemId, type TabId} from '@splito/sync'
import {useLingui as useLinguiCore} from '@lingui/react'
import {useLingui} from '@lingui/react/macro'

import {useHaptics} from '#/lib/haptics'
import {splitNavigationItems} from '#/lib/routes/navigationItems'
import {useA11y} from '#/state/a11y'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {Button, ButtonIcon} from '#/components/Button'
import {SortableList} from '#/components/DraggableList'
import * as Toggle from '#/components/forms/Toggle'
import {
  ArrowBottom_Stroke2_Corner0_Rounded as ArrowDownIcon,
  ArrowTop_Stroke2_Corner0_Rounded as ArrowUpIcon,
} from '#/components/icons/Arrow'
import {PrefSection, usePrefControl} from '#/components/settings/PrefSection'
import {TabsIcon} from '#/components/settings/icons'
import {GLYPHS, NAV_LABELS} from '#/components/TabGlyph'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'

const ROW_HEIGHT = 56

/** Each item's label, as the sidebar, drawer and bottom bar show it. */
export function useNavLabels(): Record<NavItemId, string> {
  const {_} = useLinguiCore()
  return {
    people: _(NAV_LABELS.people),
    groups: _(NAV_LABELS.groups),
    analytics: _(NAV_LABELS.analytics),
    activity: _(NAV_LABELS.activity),
  }
}

/** The destinations among the labels, for "Open on" (a tab with a page of its own). */
export function useTabLabels(): Record<TabId, string> {
  return useNavLabels()
}

type Row = {tab: NavItemId; isVisible: boolean}

function visibleKey(rows: Row[]) {
  return rows
    .filter(r => r.isVisible)
    .map(r => r.tab)
    .join(',')
}

function rowsFor(stored: readonly NavItemId[]): Row[] {
  const {on, off} = splitNavigationItems(stored)
  return [
    ...on.map(tab => ({tab, isVisible: true})),
    ...off.map(tab => ({tab, isVisible: false})),
  ]
}

/**
 * Settings > Navigation (ARCHITECTURE 26.3, decision 70): every item of the
 * shared list can go in the bottom bar and the sidebar, each with a
 * switch and a drag handle (Bluesky's pinned-feeds list), or arrow buttons on
 * wide web and for screen readers. The bar takes any number of tabs, from
 * one to every item (decision 84); the start tab and Settings stay on (owner 217: a phone has no drawer). Items that are off are not on a phone; the sidebar and rail always list every item in this order (owner 155, no "More"). Reset (the section's) restores People, Groups, Analytics,
 * Activity, Settings.
 */
export function NavigationEditor() {
  const t = useTheme()
  const {t: l} = useLingui()
  const pref = usePrefControl('tabs')
  const startTab = usePrefControl('startTab').value ?? 'people'
  const haptics = useHaptics()
  const {screenReaderEnabled} = useA11y()
  const {gtMobile} = useBreakpoints()
  const labels = useNavLabels()
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
  // Keyboard users on wide web and screen readers get arrows; touch drags.
  const showArrows = (IS_WEB && gtMobile) || screenReaderEnabled

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
      title={l`Items`}
      description={l`On items make the phone bottom bar, the only navigation on a phone. The sidebar on wide screens always lists every item, in this order.`}>
      <View
        style={[
          a.w_full,
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
            /* The start tab stays on, so the bar always holds the place the app opens on. */
            const isStart = row.tab === startTab
            return (
              <TabRow
                row={row}
                label={labels[row.tab]}
                dragHandle={dragHandle}
                isLast={index === rows.length - 1}
                isLocked={isStart}
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
      {visibleCount > 5 && (
        <Text
          testID="tabs-count-note"
          aria-live="polite"
          style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          {l`${visibleCount} tabs share the phone bar equally.`}
        </Text>
      )}
    </PrefSection>
  )
}

function TabRow({
  row,
  label,
  dragHandle,
  isLast,
  isLocked,
  onToggle,
  arrows,
}: {
  row: Row
  label: string
  dragHandle: React.ReactNode
  isLast: boolean
  /** The start tab: its switch can't move. */
  isLocked: boolean
  onToggle: (isVisible: boolean) => void
  arrows?: {onUp?: () => void; onDown?: () => void}
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const Icon = GLYPHS[row.tab].icon
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
        type="switch"
        testID={`tabs-toggle-${row.tab}`}
        name={row.tab}
        label={row.isVisible ? l`Hide ${label}` : l`Show ${label}`}
        value={row.isVisible}
        disabled={isLocked}
        onChange={onToggle}>
        <Toggle.Switch />
      </Toggle.Item>
    </View>
  )
}
