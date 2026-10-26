import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {CURRENCIES, type CurrencyInfo} from '@splito/domain'
import {type Category, type Entity, type Group} from '@splito/sync'

import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useBreakpoints, useTheme, web} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {SearchInput} from '#/components/forms/SearchInput'
import * as Toggle from '#/components/forms/Toggle'
import {Text} from '#/components/Typography'
import {CategoryTile} from './shared'

/** Title (and optional line of help) at the top of every expense-flow dialog, as Bluesky's dialogs. */
export function DialogHeading({title, description}: {title: string; description?: string}) {
  const t = useTheme()
  return (
    <View style={[a.gap_xs, a.pb_lg, web(a.pr_4xl)]}>
      <Text style={[a.text_2xl, a.font_semi_bold, a.leading_snug]}>{title}</Text>
      {description ? (
        <Text style={[a.text_md, a.leading_snug, t.atoms.text_contrast_medium]}>{description}</Text>
      ) : null}
    </View>
  )
}

/** Bluesky's full-width primary button that ends a dialog. */
export function DoneButton({label, onPress, testID}: {label?: string; onPress: () => void; testID?: string}) {
  const {t: l} = useLingui()
  return (
    <Button testID={testID} label={label ?? l`Done`} color="primary" size="large" onPress={onPress} style={[a.mt_lg]}>
      <ButtonText>{label ?? <Trans>Done</Trans>}</ButtonText>
    </Button>
  )
}

/** Separator rule between Toggle rows, as in upstream's LanguageSelectDialog. */
function rowStyle(t: ReturnType<typeof useTheme>, isLast: boolean) {
  return [t.atoms.border_contrast_low, !isLast && a.border_b, a.rounded_0, a.px_0, a.py_md, a.gap_md]
}

/* ---------- Currency ---------- */

const ALL_CURRENCIES = Object.values(CURRENCIES)

export function CurrencyDialog({
  control,
  value,
  onSelect,
}: {
  control: Dialog.DialogControlProps
  value: string
  onSelect: (code: string) => void
}) {
  return (
    <Dialog.Outer control={control} nativeOptions={{fullHeight: true}} testID="currency-dialog">
      <Dialog.Handle />
      <CurrencyInner value={value} onSelect={onSelect} />
    </Dialog.Outer>
  )
}

function CurrencyInner({value, onSelect}: {value: string; onSelect: (code: string) => void}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const control = Dialog.useDialogContext()
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const matches = (c: CurrencyInfo) => !q || c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
  const list = [CURRENCIES[value], ...ALL_CURRENCIES.filter(c => c.code !== value)].filter((c): c is CurrencyInfo => !!c && matches(c))

  return (
    <Dialog.ScrollableInner label={l`Choose a currency`}>
      <DialogHeading title={l`Currency`} />
      <SearchInput
        testID="currency-search"
        value={query}
        onChangeText={setQuery}
        onClearText={() => setQuery('')}
        label={l`Search currencies`}
        placeholder={l`Search currencies`}
      />
      <Toggle.Group
        type="radio"
        label={l`Currency`}
        values={[value]}
        onChange={([code]) => code && control.close(() => onSelect(code))}
        style={[a.pt_sm]}>
        {list.map((c, i) => (
          <Toggle.Item key={c.code} name={c.code} label={`${c.code} ${c.name}`} testID={`currency-${c.code}`} style={rowStyle(t, i === list.length - 1)}>
            <View style={[a.align_center, a.justify_center, a.rounded_full, t.atoms.bg_contrast_50, {width: 36, height: 36}]}>
              <Text style={[a.text_sm, a.font_semi_bold]} numberOfLines={1}>
                {c.symbol}
              </Text>
            </View>
            <View style={[a.flex_1]}>
              <Text style={[a.text_md, a.font_semi_bold]}>{c.code}</Text>
              <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>{c.name}</Text>
            </View>
            <Toggle.Radio />
          </Toggle.Item>
        ))}
        {list.length === 0 && (
          <Text style={[a.text_md, a.py_xl, a.text_center, t.atoms.text_contrast_medium]}>
            <Trans>No currency matches “{query}”</Trans>
          </Text>
        )}
      </Toggle.Group>
      <Dialog.Close />
    </Dialog.ScrollableInner>
  )
}

/* ---------- Category ---------- */

export function CategoryDialog({
  control,
  categories,
  value,
  onSelect,
}: {
  control: Dialog.DialogControlProps
  categories: Category[]
  value: string
  onSelect: (id: string) => void
}) {
  return (
    <Dialog.Outer control={control} testID="category-dialog">
      <Dialog.Handle />
      <CategoryInner categories={categories} value={value} onSelect={onSelect} />
    </Dialog.Outer>
  )
}

function CategoryInner({categories, value, onSelect}: {categories: Category[]; value: string; onSelect: (id: string) => void}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {gtMobile} = useBreakpoints()
  const control = Dialog.useDialogContext()
  const columns = gtMobile ? 4 : 3

  return (
    <Dialog.ScrollableInner label={l`Choose a category`}>
      <DialogHeading title={l`Category`} description={l`Change categories in Settings.`} />
      <View style={[a.flex_row, a.flex_wrap, {marginHorizontal: -4}]}>
        {categories.map(c => {
          const isSelected = c.id === value
          return (
            <View key={c.id} style={[a.p_xs, {width: `${100 / columns}%`}]}>
              <Button
                testID={`category-${c.id}`}
                label={c.name}
                accessibilityState={{selected: isSelected}}
                onPress={() => control.close(() => onSelect(c.id))}
                hoverStyle={isSelected ? undefined : t.atoms.bg_contrast_25}
                style={[
                  a.w_full,
                  a.flex_col,
                  a.align_center,
                  a.gap_sm,
                  a.py_lg,
                  a.rounded_md,
                  a.border,
                  isSelected ? {borderColor: t.palette.primary_500, backgroundColor: t.palette.primary_25} : t.atoms.border_contrast_low,
                ]}>
                <CategoryTile category={c} size={40} />
                <Text style={[a.text_sm, a.font_medium, a.text_center, a.px_xs]} numberOfLines={1}>
                  {c.name}
                </Text>
              </Button>
            </View>
          )
        })}
      </View>
      <Dialog.Close />
    </Dialog.ScrollableInner>
  )
}

/* ---------- Group ---------- */

export function GroupDialog({
  control,
  groups,
  value,
  onSelect,
}: {
  control: Dialog.DialogControlProps
  groups: Entity<Group>[]
  value: string | null
  onSelect: (groupId: string | null) => void
}) {
  return (
    <Dialog.Outer control={control} testID="group-dialog">
      <Dialog.Handle />
      <GroupInner groups={groups} value={value} onSelect={onSelect} />
    </Dialog.Outer>
  )
}

const NO_GROUP = '__none__'

function GroupInner({groups, value, onSelect}: {groups: Entity<Group>[]; value: string | null; onSelect: (groupId: string | null) => void}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const control = Dialog.useDialogContext()
  const live = groups.filter(g => !g.data.archived)
  const rows = [{id: NO_GROUP, name: l`No group`, detail: l`Just between you and friends`}, ...live.map(g => ({id: g.id, name: g.data.name, detail: `${g.data.currency} · ${l`${g.data.members.filter(m => m.leftAt === null).length} members`}`}))]

  return (
    <Dialog.ScrollableInner label={l`Choose a group`}>
      <DialogHeading title={l`Group`} description={l`A group expense splits between the group’s members and uses its currency.`} />
      <Toggle.Group
        type="radio"
        label={l`Group`}
        values={[value ?? NO_GROUP]}
        onChange={([id]) => id && control.close(() => onSelect(id === NO_GROUP ? null : id))}>
        {rows.map((g, i) => (
          <Toggle.Item key={g.id} name={g.id} label={g.name} testID={`group-option-${g.name}`} style={rowStyle(t, i === rows.length - 1)}>
            <UserAvatar size={36} name={g.id === NO_GROUP ? '–' : g.name} type="list" />
            <View style={[a.flex_1]}>
              <Text style={[a.text_md, a.font_semi_bold]} numberOfLines={1}>
                {g.name}
              </Text>
              <Text style={[a.text_sm, t.atoms.text_contrast_medium]} numberOfLines={1}>
                {g.detail}
              </Text>
            </View>
            <Toggle.Radio />
          </Toggle.Item>
        ))}
      </Toggle.Group>
      <Dialog.Close />
    </Dialog.ScrollableInner>
  )
}
