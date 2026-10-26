// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Search/Shell.tsx
import {useEffect, useRef, useState} from 'react'
import {type TextInput, type TextInputKeyPressEvent, View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation, useRoute} from '@react-navigation/native'
import {decimalMark} from '@splito/domain'
import {search} from '@splito/sync'

import {type NavigationProp} from '#/lib/routes/types'
import {todayIn} from '#/locale/dates'
import {useNumberLocale} from '#/locale/numberLocale'
import {useFormatLocalDate, useTimeZone} from '#/locale/useDates'
import {useMutationCtx, usePref} from '#/data/hooks'
import {device, useStorage} from '#/storage'
import {List} from '#/view/com/util/List'
import {atoms as a} from '#/alf'
import {SearchInput} from '#/components/forms/SearchInput'
import * as Layout from '#/components/Layout'
import {IS_NATIVE, IS_WEB} from '#/env'
import {
  ExpenseResult,
  GroupResult,
  NoResults,
  PersonResult,
  SectionHeader,
} from './components/ResultRows'
import {SearchHistory} from './components/SearchHistory'
import {type SearchResultRow, type SearchRow, searchRows} from './model'
import {scrollRowIntoView} from './scrollRowIntoView'
import {useSearchIndex} from './useSearchIndex'

const HISTORY_KEY: ['searchHistory'] = ['searchHistory']
/* Bluesky keeps six and shows five. */
const HISTORY_LIMIT = 6

/**
 * Search everything on this device (BACKLOG F-1401), in Bluesky's search
 * shell: the header, then the search box; recent searches while it is
 * empty; results update on every keystroke from a prebuilt local index,
 * grouped into People, Groups and Expenses with the matches highlighted.
 * Web: arrow keys move through the results, Enter opens one, Escape clears.
 */
export function SearchScreen() {
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute()
  const initialQuery = (route.params as {q?: string} | undefined)?.q ?? ''
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
    if (row.type === 'person')
      navigation.navigate('Person', {personId: row.person.id})
    else if (row.type === 'group')
      navigation.navigate('Group', {groupId: row.group.id})
    else navigation.navigate('Expense', {expenseId: row.expense.id})
  }

  const submit = () => {
    const active = navRows[activeNav]
    if (active) {
      open(active)
      return
    }
    rememberQuery(query)
    // The query goes in the URL (/search?q=...) only when submitted, as Bluesky does.
    navigation.setParams({q: query.trim() || undefined})
    if (IS_NATIVE) textInput.current?.blur()
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
    } else if (key === 'Escape' && query) {
      changeQuery('')
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

  const isEmptyQuery = query.trim() === ''

  return (
    <Layout.Screen testID="screen-search">
      <Layout.Header.Sticky>
        <Layout.Header.Outer noBottomBorder sticky={false}>
          <Layout.Header.BackButton />
          <Layout.Header.Content>
            <Layout.Header.TitleText>
              <Trans>Search</Trans>
            </Layout.Header.TitleText>
          </Layout.Header.Content>
          <Layout.Header.Slot />
        </Layout.Header.Outer>
        <View style={[a.px_lg, a.pt_xs, a.pb_sm]}>
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
            label={l`Search expenses, people and groups`}
            placeholder={l`Search expenses, people, groups`}
            autoFocus={!initialQuery}
            selectTextOnFocus={false}
            aria-activedescendant={
              activeNav >= 0 ? `search-row-${activeNav}` : undefined
            }
          />
        </View>
      </Layout.Header.Sticky>

      {isEmptyQuery ? (
        <SearchHistory
          searchHistory={shownHistory}
          onItemClick={pickHistory}
          onRemoveItemClick={item =>
            setHistory(history.filter(h => h !== item))
          }
          onClearAll={() => setHistory([])}
        />
      ) : !results ? null : rows.length === 0 ? (
        <NoResults query={query.trim()} />
      ) : (
        <List
          testID="search-results"
          data={rows}
          keyExtractor={(row: SearchRow) => row.key}
          renderItem={renderItem}
          sideBorders={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />
      )}
    </Layout.Screen>
  )
}
