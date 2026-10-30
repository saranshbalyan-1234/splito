import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'
import {getCurrency} from '@splito/domain'
import {
  type Category,
  type Person,
  PREFS,
} from '@splito/sync'

import {useAllEntities, useMutationCtx, usePref} from '#/data/hooks'
import {atoms as a, useTheme, utils} from '#/alf'
import {CategoryGlyph, useCategoryName} from '#/components/settings/CategoryIcon'
import {Text} from '#/components/Typography'
import {findCategory} from './categoryLookup'

/** Display names by person id; the local user is "You". */
export function useDisplayName() {
  const {t: l} = useLingui()
  const {actor} = useMutationCtx()
  // Removed friends too: the records still name them (decision 103).
  const people = useAllEntities<Person>('person')
  const names = new Map((people ?? []).map(p => [p.id, p.data.name]))
  return (id: string) => (id === actor ? l`You` : (names.get(id) ?? l`Someone`))
}

/** The person's own name (yours too), for avatar initials. */
export function useAvatarName() {
  const people = useAllEntities<Person>('person')
  const names = new Map((people ?? []).map(p => [p.id, p.data.name]))
  return (id: string) => names.get(id) ?? '?'
}

/** Visible categories in the person's order (Categories preference). */
export function useCategories(): Category[] {
  const [categories = PREFS.categories.default] = usePref('categories')
  return categories.filter(c => !c.hidden).sort((x, y) => x.order - y.order)
}

/**
 * Every category by id, hidden ones included, for showing what an older expense used. The name is in the UI language
 * when it is a built-in one the person has not renamed (as Settings shows it); their own names show as typed.
 * A category that is gone is "Other".
 */
export function useCategoryLookup(): (id: string) => Category {
  const [categories = PREFS.categories.default] = usePref('categories')
  const nameOf = useCategoryName()
  return id => {
    const found = findCategory(categories, id)
    return {...found, id, name: nameOf(found)}
  }
}

/** One category by id; see `useCategoryLookup` for a screen that shows many. */
export function useCategory(id: string): Category {
  return useCategoryLookup()(id)
}

/**
 * The one category tile: the glyph on a tint of its colour, a rounded square sized like the avatar it replaces
 * (Bluesky's list avatar shape). History rows, the expense page, the composer, pickers and Analytics all use it.
 */
export function CategoryTile({
  category,
  size = 42,
}: {
  category: Pick<Category, 'icon' | 'color'>
  size?: number
}) {
  const t = useTheme()
  return (
    <View
      style={[
        a.align_center,
        a.justify_center,
        a.flex_shrink_0,
        {
          width: size,
          height: size,
          borderRadius: size > 32 ? 10 : 6,
          backgroundColor: utils.alpha(category.color, t.scheme === 'light' ? 0.14 : 0.22),
        },
      ]}>
      <CategoryGlyph icon={category.icon} color={category.color} size={Math.round(size * 0.5)} />
    </View>
  )
}

/** A cash unit as people say it: "₹10", "€5", "BD 1" (whole units, no decimals). */
export function cashUnitText(currency: string, whole: number) {
  const {symbol} = getCurrency(currency)
  return symbol.length === 1 ? `${symbol}${whole}` : `${symbol} ${whole}`
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
      case 'AMBIGUOUS_AMOUNT':
        return l`Is that a thousands separator or decimals? Write it without the separator, like 1234`
      case 'INVALID_ROUNDING':
        return l`Pick a whole cash unit to round to`
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
      case 'NEGATIVE_AMOUNT':
        return l`Amounts here can’t be below zero`
      case 'SIGN_MISMATCH':
        return l`No one’s share can go below zero – make the adjustments smaller`
      case 'ADJUSTMENT_TOO_LARGE':
        return l`The adjustments add up to more than the total`
      case 'NOT_A_MEMBER':
        return l`Everyone on a group expense needs to be in the group`
      case 'UNKNOWN_PERSON':
        return l`Someone on this was removed. Restore them first.`
      case 'GROUP_DELETED':
        return l`This is in a deleted group. Restore the group first.`
      case 'NOT_DELETED':
        return l`Only a deleted item can be hidden.`
      case 'GROUP_INACTIVE':
        return l`This group is inactive. Make it active first.`
      case 'NOT_ADMIN':
        return l`Only a group admin can do that.`
      case 'NOT_FOUND':
        return l`This expense no longer exists`
      case 'BILL_GAP':
        return l`The total doesn’t match the items and charges`
      case 'CHARGE_NO_ITEMS':
        return l`A fixed charge needs items to apply to`
      case 'INVALID_CHARGE':
        return l`A charge has a rate from 0 to 100% or an amount that isn’t below zero`
      case 'ROUND_OFF_TOO_LARGE':
        return l`Round-off can’t be more than one whole unit`
      case 'INVALID_NAME':
        return l`Add a name`
      case 'ALREADY_OPEN':
        return l`There is already an open dispute or hold from this person on this`
      case 'NOT_A_PARTICIPANT':
        return l`Only someone on this can do that`
      case 'ALREADY_PARTICIPANT':
        return l`They are on this already, so they weren’t left out`
      case 'NOTE_REQUIRED':
        return l`Add a reason`
      case 'NOTE_TOO_LONG':
        return l`That note is too long. Please shorten it.`
      case 'INVALID_FIX':
        return l`That change can’t be made to this record`
      case 'NO_FIX':
        return l`This dispute proposes no change. Edit the record, or reject it.`
      case 'OWN_DISPUTE':
        return l`You can’t answer your own dispute. Withdraw it instead.`
      case 'NOT_RESOLVER':
        return l`Only whoever added this, its payer or a group admin can answer`
      case 'NOT_RAISER':
        return l`Only the person who raised it can do that`
      case 'NOT_OPEN':
      case 'NOT_REJECTED':
        return l`This was already answered`
      case 'ADMIN_ONLY':
        return l`It was reopened once already. A group admin can take it from here.`
      case 'INVALID_ITEM':
        return l`That item isn’t on this bill`
      default:
        return l`Something isn’t right. Check the highlighted fields.`
    }
  }
}

/** Bluesky's small grey section label (as in Settings lists). */
export function SectionLabel({
  children,
  right,
}: {
  children: React.ReactNode
  right?: React.ReactNode
}) {
  const t = useTheme()
  return (
    <View
      style={[
        a.flex_row,
        a.align_center,
        a.justify_between,
        a.px_lg,
        a.pt_xl,
        a.pb_sm,
      ]}>
      <Text style={[a.text_sm, a.font_semi_bold, t.atoms.text_contrast_medium]}>
        {children}
      </Text>
      {right}
    </View>
  )
}
