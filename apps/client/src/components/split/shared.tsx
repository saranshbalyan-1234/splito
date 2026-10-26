import {View} from 'react-native'
import {type I18n} from '@lingui/core'
import {useLingui} from '@lingui/react/macro'
import {type Category, DEFAULT_CATEGORIES, type Person, PREFS} from '@splito/sync'

import {useEntities, useMutationCtx, usePref} from '#/data/hooks'
import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'
import {categoryIcon} from './icons'

/** The device's IANA timezone. */
export function deviceTz() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

/** The timezone new expenses are stamped with: the Timezone preference, else the device's. */
export function useExpenseTz() {
  const [pref = 'device'] = usePref('timezone')
  return pref === 'device' ? deviceTz() : pref
}

/** Today's `YYYY-MM-DD` in `tz` (en-CA formats dates as ISO). */
export function localToday(tz: string, offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86_400_000)
  return new Intl.DateTimeFormat('en-CA', {timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit'}).format(d)
}

/** A local `YYYY-MM-DD` as a Date at UTC midnight, so formatting never shifts the day. */
export function utcDate(d: string) {
  return new Date(`${d}T00:00:00Z`)
}

/** "Today", "Yesterday", "Tomorrow", else "26 Oct 2026" in the UI language. */
export function useFormatDay() {
  const {t: l, i18n} = useLingui()
  const tz = useExpenseTz()
  return (date: string, {relative = true}: {relative?: boolean} = {}) => {
    if (relative) {
      if (date === localToday(tz)) return l`Today`
      if (date === localToday(tz, -1)) return l`Yesterday`
      if (date === localToday(tz, 1)) return l`Tomorrow`
    }
    return formatDay(i18n, date)
  }
}

export function formatDay(i18n: I18n, date: string, opts: Intl.DateTimeFormatOptions = {}) {
  return i18n.date(utcDate(date), {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC', ...opts})
}

/** Display names by person id; the local user is "You". */
export function useDisplayName() {
  const {t: l} = useLingui()
  const {actor} = useMutationCtx()
  const people = useEntities<Person>('person')
  const names = new Map((people ?? []).map(p => [p.id, p.data.name]))
  return (id: string) => (id === actor ? l`You` : (names.get(id) ?? l`Someone`))
}

/** The person's own name (yours too), for avatar initials. */
export function useAvatarName() {
  const people = useEntities<Person>('person')
  const names = new Map((people ?? []).map(p => [p.id, p.data.name]))
  return (id: string) => names.get(id) ?? '?'
}

/** Visible categories in the person's order (Categories preference). */
export function useCategories(): Category[] {
  const [categories = PREFS.categories.default] = usePref('categories')
  return categories.filter(c => !c.hidden).sort((x, y) => x.order - y.order)
}

/** Every category, hidden ones included, for showing what an older expense used. */
export function useCategory(id: string): Category {
  const [categories = PREFS.categories.default] = usePref('categories')
  return (
    categories.find(c => c.id === id) ??
    categories.find(c => c.id === 'other') ?? {...DEFAULT_CATEGORIES.at(-1)!, id}
  )
}

/**
 * The category's glyph on a tint of its colour, in Bluesky's rounded-square
 * avatar shape (feeds and lists use it). Sized like the avatar it replaces.
 */
export function CategoryTile({category, size = 42}: {category: Category; size?: number}) {
  const Icon = categoryIcon(category.icon)
  return (
    <View
      style={[
        a.align_center,
        a.justify_center,
        {width: size, height: size, borderRadius: size > 32 ? 10 : 6, backgroundColor: category.color + '24'},
      ]}>
      <Icon width={Math.round(size * 0.5)} fill={category.color} />
    </View>
  )
}

/** Plain-words text for a domain or form error code. */
export function useErrorText() {
  const {t: l} = useLingui()
  return (code: string): string => {
    switch (code) {
      case 'TITLE_REQUIRED':
        return l`Add a title`
      case 'AMOUNT_REQUIRED':
        return l`Enter an amount`
      case 'AMOUNT_NOT_POSITIVE':
        return l`The amount needs to be more than zero`
      case 'INVALID_AMOUNT':
        return l`That isn’t a number. Use digits, one decimal point and + − × ÷`
      case 'TOO_MANY_DECIMALS':
        return l`Too many digits after the decimal point for this currency`
      case 'INCOMPLETE':
        return l`Finish the sum – it ends with an operator`
      case 'DIVIDE_BY_ZERO':
        return l`You can’t divide by zero`
      case 'OUT_OF_RANGE':
        return l`That amount is too large`
      case 'INVALID_DATE':
        return l`Pick a date between 1900 and 2200`
      case 'INVALID_ROW_AMOUNT':
        return l`One of the amounts isn’t a valid number`
      case 'PAYERS_MISMATCH':
        return l`What people paid needs to add up to the total`
      case 'TOTAL_MISMATCH':
        return l`The split needs to add up to the total`
      case 'PERCENT_NOT_100':
        return l`Percentages need to add up to 100%`
      case 'INVALID_PERCENT':
        return l`Use a percentage from 0 to 100, with up to two decimals`
      case 'NO_PARTICIPANTS':
        return l`Choose at least one person to split with`
      case 'NO_ITEMS':
        return l`Add at least one item`
      case 'UNASSIGNED_ITEM':
        return l`Choose who shares each item`
      case 'ADJUSTMENT_TOO_LARGE':
        return l`The adjustments add up to more than the total`
      case 'NOT_A_MEMBER':
        return l`Everyone on a group expense needs to be in the group`
      case 'UNKNOWN_PERSON':
        return l`Someone on this expense was removed`
      case 'NOT_FOUND':
        return l`This expense no longer exists`
      case 'INVALID_NAME':
        return l`Add a name`
      default:
        return l`Something isn’t right. Check the highlighted fields.`
    }
  }
}

/** Bluesky's small grey section label (as in Settings lists). */
export function SectionLabel({children, right}: {children: React.ReactNode; right?: React.ReactNode}) {
  const t = useTheme()
  return (
    <View style={[a.flex_row, a.align_center, a.justify_between, a.px_lg, a.pt_xl, a.pb_sm]}>
      <Text style={[a.text_sm, a.font_semi_bold, t.atoms.text_contrast_medium]}>{children}</Text>
      {right}
    </View>
  )
}
