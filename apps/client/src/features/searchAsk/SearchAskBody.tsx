// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Search/Shell.tsx
import {useEffect, useRef, useState} from 'react'
import {type TextInput, type TextInputKeyPressEvent, View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {decimalMark} from '@splito/domain'
import {search} from '@splito/sync'

import {type NavigationProp} from '#/lib/routes/types'
import {todayIn} from '#/locale/dates'
import {useNumberLocale} from '#/locale/numberLocale'
import {useFormatLocalDate, useTimeZone} from '#/locale/useDates'
import {useMutationCtx, usePref} from '#/data/hooks'
import {device, useStorage} from '#/storage'
import {atoms as a, useBreakpoints, useTheme, web} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {SearchInput} from '#/components/forms/SearchInput'
import {
  type SearchResultRow,
  type SearchRow,
  searchRows,
} from '#/components/SearchAsk/model'
import {
  ExpenseResult,
  GroupResult,
  NoResults,
  PersonResult,
  SectionHeader,
} from '#/components/SearchAsk/ResultRows'
import {scrollRowIntoView} from '#/components/SearchAsk/scrollRowIntoView'
import {SearchHistory} from '#/components/SearchAsk/SearchHistory'
import {SHORTCUT_HINT} from '#/components/SearchAsk/useSearchAskHotkey'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'
import {useSearchIndex} from './useSearchIndex'

const HISTORY_KEY: ['searchHistory'] = ['searchHistory']
/* Bluesky keeps six and shows five. */
const HISTORY_LIMIT = 6
/* The command-palette popup on rail and desktop (ARCHITECTURE 26.3). */
const POPUP_WIDTH = 720

/**
 * The Search & Ask drawer's content (ARCHITECTURE 26.3): one search box,
 * autofocused; recent searches while it is empty; results on every
 * keystroke from a prebuilt local index (BACKLOG F-1401), grouped into
 * People, Groups and Expenses with the matches highlighted. A result opens
 * its page and closes the drawer. Web: arrow keys move through the results,
 * Enter opens one; Escape closes the drawer.
 * TODO(F-2301): the "Ask Splito: '<query>'" row heads the results and the
 * suggested questions join the empty state once the chat ships.
 */
export function SearchAskBody({initialQuery}: {initialQuery: string}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {gtMobile} = useBreakpoints()
  const navigation = useNavigation<NavigationProp>()
  const {close} = Dialog.useDialogContext()
  const textInput = useRef<React.ComponentRef<typeof TextInput>>(null)
  const [query, setQuery] = useState(initialQuery)
  const [activeNav, setActiveNav] = useState(-1)

  const {index, names, groupNames} = useSearchIndex()
  const {actor: me} = useMutationCtx()
  const locale = useNumberLocale()
  const formatDate = useFormatLocalDate()
  const today = todayIn(useTimeZone())

  const [history = [], setHistory] = useStorage(device, HISTORY_KEY)
  const [rememberSearches] = usePref('rememberSearches')
  const shownHistory = rememberSearches === false ? [] : history

  // Turning the preference off forgets what was kept.
  useEffect(() => {
    if (rememberSearches === false && history.length > 0) setHistory([])
  }, [rememberSearches, history, setHistory])

  const results = index
    ? search(index, query, {today, mark: decimalMark(locale)})
    : undefined
  const rows = results ? searchRows(results) : []
  const navRows = rows.filter((r): r is SearchResultRow => r.type !== 'header')
  const isEmptyQuery = query.trim() === ''

  const rememberQuery = (q: string) => {
    const item = q.trim()
    if (!item || rememberSearches === false) return
    setHistory(
      [item, ...history.filter(h => h !== item)].slice(0, HISTORY_LIMIT),
    )
  }

  const changeQuery = (text: string) => {
    setQuery(text)
    setActiveNav(-1)
  }

  const open = (row: SearchResultRow) => {
    rememberQuery(query)
    close(() => {
      if (row.type === 'person')
        navigation.navigate('Person', {personId: row.person.id})
      else if (row.type === 'group')
        navigation.navigate('Group', {groupId: row.group.id})
      else navigation.navigate('Expense', {expenseId: row.expense.id})
    })
  }

  const submit = () => {
    const active = navRows[activeNav]
    if (active) {
      open(active)
      return
    }
    rememberQuery(query)
    if (!IS_WEB) textInput.current?.blur()
  }

  const moveActive = (step: 1 | -1) => {
    if (navRows.length === 0) return
    const next = Math.min(Math.max(activeNav + step, -1), navRows.length - 1)
    setActiveNav(next)
    if (next >= 0) scrollRowIntoView(next)
  }

  const onKeyPress = (e: TextInputKeyPressEvent) => {
    if (!IS_WEB) return
    const {key} = e.nativeEvent
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      ;(e as unknown as {preventDefault: () => void}).preventDefault()
      moveActive(key === 'ArrowDown' ? 1 : -1)
    }
  }

  const pickHistory = (item: string) => {
    changeQuery(item)
    rememberQuery(item)
  }

  const renderItem = ({item: row}: {item: SearchRow}) => {
    switch (row.type) {
      case 'header':
        return (
          <SectionHeader
            section={row.section}
            count={row.count}
            totals={row.section === 'expenses' ? results?.totals : undefined}
            locale={locale}
          />
        )
      case 'person':
        return (
          <PersonResult
            nav={row.nav}
            person={row.person}
            terms={results?.terms ?? []}
            isActive={row.nav === activeNav}
            onPress={() => open(row)}
          />
        )
      case 'group':
        return (
          <GroupResult
            nav={row.nav}
            group={row.group}
            terms={results?.terms ?? []}
            isActive={row.nav === activeNav}
            onPress={() => open(row)}
          />
        )
      case 'expense':
        return (
          <ExpenseResult
            nav={row.nav}
            expense={row.expense}
            terms={results?.terms ?? []}
            me={me}
            names={names}
            groupNames={groupNames}
            locale={locale}
            date={formatDate(row.expense.data.date)}
            isActive={row.nav === activeNav}
            onPress={() => open(row)}
          />
        )
    }
  }

  const header = (
    <View
      style={[
        a.flex_row,
        a.align_center,
        a.gap_sm,
        a.px_lg,
        a.pt_md,
        a.pb_md,
        a.border_b,
        t.atoms.bg,
        t.atoms.border_contrast_low,
      ]}>
      <View style={[a.flex_1, a.relative]}>
        <SearchInput
          testID="search-input"
          ref={textInput}
          value={query}
          onChangeText={changeQuery}
          onClearText={() => {
            changeQuery('')
            textInput.current?.focus()
          }}
          onSubmitEditing={submit}
          onKeyPress={onKeyPress}
          label={l`Search or ask anything`}
          placeholder={l`Search or ask anything`}
          autoFocus
          selectTextOnFocus={false}
          aria-activedescendant={
            activeNav >= 0 ? `search-row-${activeNav}` : undefined
          }
        />
        {/* Desktop: the shortcut at the input's right edge, until something is typed. */}
        {gtMobile && SHORTCUT_HINT && query === '' && (
          <View
            pointerEvents="none"
            style={[
              a.absolute,
              a.inset_0,
              a.justify_center,
              a.align_end,
              a.pr_md,
            ]}>
            <Text
              testID="search-ask-shortcut"
              aria-hidden
              style={[
                a.text_xs,
                a.font_semi_bold,
                a.rounded_xs,
                a.border,
                t.atoms.border_contrast_medium,
                t.atoms.text_contrast_medium,
                {paddingHorizontal: 6, paddingVertical: 2},
              ]}>
              {SHORTCUT_HINT}
            </Text>
          </View>
        )}
      </View>
      {/* Phones: Bluesky's search shell has Cancel beside the box; the drawer also closes on a drag down. */}
      {!gtMobile && (
        <Button
          testID="search-ask-cancel"
          label={l`Close search`}
          size="small"
          variant="ghost"
          color="secondary"
          onPress={() => close()}>
          <ButtonText>
            <Trans>Cancel</Trans>
          </ButtonText>
        </Button>
      )}
    </View>
  )

  return (
    <Dialog.InnerFlatList
      testID="search-ask"
      /* Web names the dialog; the native sheet takes no label. */
      {...({label: l`Search or ask Splito`} as object)}
      data={isEmptyQuery ? [] : rows}
      keyExtractor={(row: SearchRow) => row.key}
      renderItem={renderItem}
      ListHeaderComponent={header}
      stickyHeaderIndices={[0]}
      ListEmptyComponent={
        isEmptyQuery ? (
          <SearchHistory
            searchHistory={shownHistory}
            onItemClick={pickHistory}
            onRemoveItemClick={item =>
              setHistory(history.filter(h => h !== item))
            }
            onClearAll={() => setHistory([])}
          />
        ) : results ? (
          <NoResults query={query.trim()} />
        ) : undefined
      }
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      style={[a.px_0]}
      contentContainerStyle={[a.pb_lg]}
      webInnerStyle={[
        a.p_0,
        gtMobile
          ? {maxWidth: POPUP_WIDTH, height: 'min(640px, 80vh)'}
          : web({height: '100dvh', maxHeight: '100dvh'}),
      ]}
      webInnerContentContainerStyle={[a.p_0]}
    />
  )
}
