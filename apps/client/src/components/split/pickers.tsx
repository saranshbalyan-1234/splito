import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'
import {type Category, type Entity, type Group, isGroupInactive} from '@splito/sync'

import {UserAvatar} from '#/view/com/util/UserAvatar'
import {GroupAvatar} from '#/components/groups/GroupAvatar'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {Button} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as FormSheet from '#/components/FormSheet'
import * as Toggle from '#/components/forms/Toggle'
import {Text} from '#/components/Typography'
import {CategoryTile} from './shared'

/** Separator rule between Toggle rows, as in upstream's LanguageSelectDialog. */
function rowStyle(t: ReturnType<typeof useTheme>, isLast: boolean) {
  return [
    t.atoms.border_contrast_low,
    !isLast && a.border_b,
    a.rounded_0,
    a.px_0,
    a.py_md,
    a.gap_md,
  ]
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
    <FormSheet.Outer control={control} testID="category-dialog">
      <CategoryInner
        categories={categories}
        value={value}
        onSelect={onSelect}
      />
    </FormSheet.Outer>
  )
}

function CategoryInner({
  categories,
  value,
  onSelect,
}: {
  categories: Category[]
  value: string
  onSelect: (id: string) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {gtMobile} = useBreakpoints()
  const control = Dialog.useDialogContext()
  const columns = gtMobile ? 4 : 3

  return (
    <FormSheet.Inner deferBody title={l`Category`}>
      <FormSheet.Description>{l`Change categories in Settings.`}</FormSheet.Description>
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
                  isSelected
                    ? {
                        borderColor: t.palette.primary_500,
                        backgroundColor: t.palette.primary_25,
                      }
                    : t.atoms.border_contrast_low,
                ]}>
                <CategoryTile category={c} size={40} />
                <Text
                  style={[a.text_sm, a.font_medium, a.text_center, a.px_xs]}
                  numberOfLines={1}>
                  {c.name}
                </Text>
              </Button>
            </View>
          )
        })}
      </View>
    </FormSheet.Inner>
  )
}

/* ---------- Group ---------- */

export function GroupDialog({
  control,
  groups,
  hidden,
  value,
  onSelect,
}: {
  control: Dialog.DialogControlProps
  groups: Entity<Group>[]
  /** Groups I have hidden from my own lists (decision 89): not offered. */
  hidden: ReadonlySet<string>
  value: string | null
  onSelect: (groupId: string | null) => void
}) {
  return (
    <FormSheet.Outer control={control} testID="group-dialog">
      <GroupInner
        groups={groups}
        hidden={hidden}
        value={value}
        onSelect={onSelect}
      />
    </FormSheet.Outer>
  )
}

const NO_GROUP = '__none__'

function GroupInner({
  groups,
  hidden,
  value,
  onSelect,
}: {
  groups: Entity<Group>[]
  hidden: ReadonlySet<string>
  value: string | null
  onSelect: (groupId: string | null) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const control = Dialog.useDialogContext()
  /* Inactive groups take no new expenses and hidden ones are out of my lists (decision 89). */
  const memberText = (n: number) => (n === 1 ? l`1 member` : l`${n} members`)
  const live = groups.filter(g => !isGroupInactive(g.data) && !hidden.has(g.id))
  const rows = [
    {id: NO_GROUP, kind: null, name: l`No group`, detail: l`Just between you and friends`},
    ...live.map(g => ({
      id: g.id,
      kind: g.data.kind,
      name: g.data.name,
      detail: `${g.data.currency} · ${memberText(g.data.members.filter(m => m.leftAt === null).length)}`,
    })),
  ]

  return (
    <FormSheet.Inner title={l`Group`}>
      <FormSheet.Description>{l`A group expense splits between the group’s members and uses its currency.`}</FormSheet.Description>
      <Toggle.Group
        type="radio"
        label={l`Group`}
        values={[value ?? NO_GROUP]}
        onChange={([id]) =>
          id && control.close(() => onSelect(id === NO_GROUP ? null : id))
        }>
        {rows.map((g, i) => (
          <Toggle.Item
            key={g.id}
            name={g.id}
            label={g.name}
            testID={`group-option-${g.name}`}
            style={rowStyle(t, i === rows.length - 1)}>
            {g.kind ? (
              <GroupAvatar size={36} kind={g.kind} name={g.name} />
            ) : (
              <UserAvatar size={36} name="–" type="list" />
            )}
            <View style={[a.flex_1]}>
              <Text style={[a.text_md, a.font_semi_bold]} numberOfLines={1}>
                {g.name}
              </Text>
              <Text
                style={[a.text_sm, t.atoms.text_contrast_medium]}
                numberOfLines={1}>
                {g.detail}
              </Text>
            </View>
            <Toggle.Radio />
          </Toggle.Item>
        ))}
      </Toggle.Group>
    </FormSheet.Inner>
  )
}
