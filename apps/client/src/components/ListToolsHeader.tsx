import {useEffect, useRef, useState} from 'react'
import {type TextInput, View} from 'react-native'
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  ZoomIn,
  ZoomOut,
} from 'react-native-reanimated'
import {useLingui} from '@lingui/react/macro'
import {type ListSort} from '@splito/sync'

import {HITSLOP_10} from '#/lib/constants'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon} from '#/components/Button'
import {ListSortMenu} from '#/components/ListSortMenu'
import {SearchInput} from '#/components/forms/SearchInput'
import {MagnifyingGlass_Stroke2_Corner0_Rounded as SearchIcon} from '#/components/icons/MagnifyingGlass'
import {SettingsSliderVertical_Stroke2_Corner0_Rounded as FilterIcon} from '#/components/icons/SettingsSlider'
import {Text} from '#/components/Typography'
import {useShouldReduceMotion} from '#/motion/useShouldReduceMotion'

const ICON = 36
const GAP = 4
const EASE = Easing.out(Easing.cubic)

/**
 * A list's section heading ("Friends 6") with search and filters on its
 * right (owner: "search icon only, expands once I click"). The search icon
 * grows into Bluesky's `SearchInput` across the row (width and opacity on
 * the UI thread; instant under reduced motion), focused, with a cross that
 * clears and collapses it. The filter button and the Sort button (owner 199) stay beside the field, so
 * search, filters and order combine, and a "2 of 6" line answers each query. The
 * filter button carries a dot while filters differ from the defaults.
 */
export function ListToolsHeader({
  title,
  count,
  total,
  titleTestID,
  query,
  onQueryChange,
  searchLabel,
  activeFilterCount,
  onFiltersPress,
  sort,
  action,
  endAction,
}: {
  title: string
  count: number | undefined
  /** Rows before search, for the "2 of 6" readout while searching. */
  total?: number
  titleTestID?: string
  /*
   * The list's own search; without it the row has no search icon (Home's
   * friends: the header's Search & Ask drawer searches everything, 26.3).
   */
  query?: string
  onQueryChange?: (query: string) => void
  /** What the field searches, e.g. "Search groups or members". */
  searchLabel?: string
  activeFilterCount: number
  onFiltersPress: () => void
  /** The Sort button beside Filters (owner 199): the current order and what a pick does. */
  sort?: {value: ListSort; onChange: (sort: ListSort) => void}
  /** A small link beside the title (Home's friends: "Manage"). */
  action?: React.ReactNode
  /** An icon button after Sort (the Friends list's "Manage friends and invites" gear, owner 177). */
  endAction?: React.ReactNode
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const shouldReduceMotion = useShouldReduceMotion()
  const [isSearching, setIsSearching] = useState(!!query)
  const [rowWidth, setRowWidth] = useState(0)
  /* The icon buttons after the search field: Filters, Sort and the end action. */
  const trailing = (sort ? ICON + GAP : 0) + (endAction ? ICON + GAP : 0)
  const progress = useSharedValue(isSearching ? 1 : 0)
  const input = useRef<React.ComponentRef<typeof TextInput>>(null)

  useEffect(() => {
    const to = isSearching ? 1 : 0
    progress.set(
      shouldReduceMotion ? to : withTiming(to, {duration: 220, easing: EASE}),
    )
    if (isSearching) input.current?.focus()
  }, [isSearching, shouldReduceMotion, progress])

  const fieldStyle = useAnimatedStyle(() => ({
    width: interpolate(progress.get(), [0, 1], [ICON, rowWidth]),
    opacity: progress.get(),
  }))
  const restStyle = useAnimatedStyle(() => ({opacity: 1 - progress.get()}))

  const collapse = () => {
    onQueryChange?.('')
    setIsSearching(false)
  }

  return (
    <View
      /* A hidden tab measures 0: keep the last real width (owner 166). */
      onLayout={e => e.nativeEvent.layout.width > 0 && setRowWidth(e.nativeEvent.layout.width - 32 - ICON - GAP - trailing)}
      style={[a.px_lg, a.pt_md, a.pb_sm, a.justify_center, {minHeight: 60}]}>
      <View style={[a.flex_row, a.align_center, {gap: GAP}]}>
        <Animated.View
          pointerEvents={isSearching ? 'none' : 'auto'}
          aria-hidden={isSearching}
          style={[
            a.flex_1,
            a.flex_row,
            a.align_center,
            a.justify_between,
            restStyle,
          ]}>
          <Text
            testID={titleTestID}
            style={[a.text_lg, a.font_bold, a.leading_snug]}>
            {title}
            {count !== undefined && (
              <Text
                style={[
                  a.text_lg,
                  a.font_normal,
                  t.atoms.text_contrast_medium,
                ]}>
                {'  '}
                {count}
              </Text>
            )}
          </Text>
          {action}
          {onQueryChange && searchLabel && (
            <Button
              testID="list-search"
              label={searchLabel}
              size="small"
              variant="ghost"
              color="secondary"
              shape="round"
              hitSlop={HITSLOP_10}
              onPress={() => setIsSearching(true)}>
              <ButtonIcon icon={SearchIcon} size="md" />
            </Button>
          )}
        </Animated.View>
        <Button
          testID="list-filters"
          label={
            activeFilterCount > 0
              ? l`Filters, ${activeFilterCount} on`
              : l`Filters`
          }
          size="small"
          variant="ghost"
          color="secondary"
          shape="round"
          hitSlop={HITSLOP_10}
          style={[a.overflow_visible]}
          onPress={onFiltersPress}>
          <ButtonIcon icon={FilterIcon} size="md" />
          {activeFilterCount > 0 && (
            <Animated.View
              testID="list-filters-dot"
              entering={shouldReduceMotion ? undefined : ZoomIn.springify()}
              exiting={shouldReduceMotion ? undefined : ZoomOut}
              style={[
                a.absolute,
                a.rounded_full,
                {
                  top: 5,
                  right: 5,
                  width: 9,
                  height: 9,
                  borderWidth: 1.5,
                  borderColor: t.atoms.bg.backgroundColor,
                  backgroundColor: t.palette.primary_500,
                },
              ]}
            />
          )}
        </Button>
        {sort && <ListSortMenu value={sort.value} onChange={sort.onChange} />}
        {endAction}
      </View>
      {isSearching && (
        /* Grows leftwards from the search icon's spot to the full row. */
        <Animated.View
          style={[
            a.absolute,
            a.justify_center,
            {right: 16 + ICON + GAP + trailing, top: 8, height: 44},
            fieldStyle,
          ]}>
          <SearchInput
            testID="list-search-input"
            ref={input}
            label={searchLabel}
            placeholder={searchLabel}
            value={query}
            onChangeText={onQueryChange}
            /* One cross: it clears the search and folds it back to the icon. */
            shouldShowClear
            onClearText={collapse}
            onKeyPress={e => {
              if (e.nativeEvent.key === 'Escape') collapse()
            }}
          />
        </Animated.View>
      )}
      {isSearching && !!query?.trim() && total !== undefined && (
        <Text
          testID="list-search-count"
          aria-live="polite"
          style={[
            a.pt_sm,
            a.text_sm,
            a.leading_snug,
            t.atoms.text_contrast_medium,
          ]}>
          {l`${count ?? 0} of ${total}`}
        </Text>
      )}
    </View>
  )
}
