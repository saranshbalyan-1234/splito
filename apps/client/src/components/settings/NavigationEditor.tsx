// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/SavedFeeds.tsx (PinnedFeedItem, onMoveUp/onMoveDown)
import {useState} from 'react'
import {View} from 'react-native'
import {MAX_TABS, MIN_TABS, type NavItemId, type TabId} from '@splito/sync'
import {useLingui as useLinguiCore} from '@lingui/react'
import {useLingui} from '@lingui/react/macro'

import {useHaptics} from '#/lib/haptics'
import {bottomBarItems, navigationItems} from '#/lib/routes/navigationItems'
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
    ask: _(NAV_LABELS.ask),
    activity: _(NAV_LABELS.activity),
    settings: _(NAV_LABELS.settings),
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
  const visible = bottomBarItems(stored)
  const hidden = navigationItems().filter(tab => !visible.includes(tab))
  return [
    ...visible.map(tab => ({tab, isVisible: true})),
    ...hidden.map(tab => ({tab, isVisible: false})),
  ]
}

/* Home is fixed first (26.3): any order a drag makes keeps it there. */
function homeFirst(rows: Row[]) {
  return [
    ...rows.filter(r => r.tab === 'people'),
    ...rows.filter(r => r.tab !== 'people'),
  ]
}

/**
 * Settings > Navigation (ARCHITECTURE 26.3, decision 70): every item of the
 * shared sidebar / drawer list can go in the phone bottom bar, each with a
 * switch and a drag handle (Bluesky's pinned-feeds list), or arrow buttons on
 * wide web and for screen readers. The bar holds 2 to 5 tabs; Home stays on
 * and first. Items not in the bar stay in the drawer; desktop and rail always
 * show the full list. Reset (the section's) restores Home, Groups, Analytics,
 * Activity.
 */
export function NavigationEditor() {
  const t = useTheme()
  const {t: l} = useLingui()
  const pref = usePrefControl('tabs')
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
    const ordered = homeFirst(next)
    setLocal({rows: ordered, over: storedKey})
    void pref.set(ordered.filter(r => r.isVisible).map(r => r.tab))
  }
  const visibleCount = rows.filter(r => r.isVisible).length
  const isFull = visibleCount >= MAX_TABS
  const isAtMinimum = visibleCount <= MIN_TABS
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
      title={l`Bottom bar`}
      description={l`Choose the tabs on the phone bottom bar and their order: 2 to 5, with Home first. Everything else stays in the menu behind your avatar.`}>
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
            const isHome = row.tab === 'people'
            return (
              <TabRow
                row={row}
                label={labels[row.tab]}
                dragHandle={isHome ? <HandleSpacer /> : dragHandle}
                isLast={index === rows.length - 1}
                isLocked={
                  isHome ||
                  (row.isVisible && isAtMinimum) ||
                  (!row.isVisible && isFull)
                }
                onToggle={isVisible =>
                  save(
                    rows.map(r => (r.tab === row.tab ? {...r, isVisible} : r)),
                  )
                }
                arrows={
                  showArrows && !isHome
                    ? {
                        onUp: index > 1 ? () => move(index, -1) : undefined,
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
      {(isFull || isAtMinimum) && (
        <Text
          testID="tabs-limit-note"
          aria-live="polite"
          style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          {isFull
            ? l`The bar holds up to 5 tabs. Turn one off to add another.`
            : l`The bar needs at least 2 tabs.`}
        </Text>
      )}
    </PrefSection>
  )
}

/* Home has no handle; the gap keeps its glyph in line with the rows below. */
function HandleSpacer() {
  return <View style={{width: 44}} />
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
  /** Home, the last tabs above the minimum, or a sixth tab: the switch can't move. */
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
        type="checkbox"
        testID={`tabs-toggle-${row.tab}`}
        name={row.tab}
        label={row.isVisible ? l`Hide ${label}` : l`Show ${label}`}
        value={row.isVisible}
        disabled={isLocked}
        onChange={onToggle}>
        <Toggle.Platform />
      </Toggle.Item>
    </View>
  )
}
