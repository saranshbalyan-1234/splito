import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {createPerson} from '@splito/sync'

import {useMutationCtx, useStore} from '#/data/hooks'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {Button} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {SearchInput} from '#/components/forms/SearchInput'
import * as Toggle from '#/components/forms/Toggle'
import {PersonPlus_Filled_Stroke2_Corner0_Rounded as PersonPlusIcon} from '#/components/icons/Person'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {DialogHeading, DoneButton} from './pickers'
import {useAvatarName, useDisplayName, useErrorText} from './shared'

/**
 * Pick people from a list (friends, or a group's members) with Bluesky's
 * checkbox rows. With `allowNew`, a name that matches nobody can be added
 * on the spot as a new friend - no account or invite needed.
 */
export function PeopleDialog({
  control,
  title,
  description,
  candidates,
  selected,
  lockedIds = [],
  allowNew = false,
  onChange,
}: {
  control: Dialog.DialogControlProps
  title: string
  description?: string
  candidates: string[]
  selected: string[]
  /** Always selected; shown but not toggleable (you, in your own group). */
  lockedIds?: string[]
  allowNew?: boolean
  onChange: (ids: string[]) => void
}) {
  return (
    <Dialog.Outer
      control={control}
      nativeOptions={{fullHeight: true}}
      testID="people-dialog">
      <Dialog.Handle />
      <PeopleInner
        title={title}
        description={description}
        candidates={candidates}
        selected={selected}
        lockedIds={lockedIds}
        allowNew={allowNew}
        onChange={onChange}
      />
    </Dialog.Outer>
  )
}

function PeopleInner({
  title,
  description,
  candidates,
  selected,
  lockedIds,
  allowNew,
  onChange,
}: {
  title: string
  description?: string
  candidates: string[]
  selected: string[]
  lockedIds: string[]
  allowNew: boolean
  onChange: (ids: string[]) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const control = Dialog.useDialogContext()
  const store = useStore()
  const ctx = useMutationCtx()
  const name = useDisplayName()
  const avatarName = useAvatarName()
  const errorText = useErrorText()
  const [query, setQuery] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const q = query.trim()
  const rows = candidates.filter(
    id => !q || name(id).toLowerCase().includes(q.toLowerCase()),
  )
  const hasExactMatch = candidates.some(
    id => name(id).toLowerCase() === q.toLowerCase(),
  )

  const addPerson = async () => {
    setIsAdding(true)
    try {
      const person = await createPerson(store, ctx, {name: q})
      onChange([...selected, person.id])
      setQuery('')
    } catch (e) {
      Toast.show(errorText((e as {code?: string}).code ?? ''), {type: 'error'})
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <Dialog.ScrollableInner label={title}>
      <DialogHeading title={title} description={description} />
      <SearchInput
        testID="people-search"
        value={query}
        onChangeText={setQuery}
        onClearText={() => setQuery('')}
        label={allowNew ? l`Search or add a name` : l`Search people`}
        placeholder={allowNew ? l`Search or add a name` : l`Search people`}
        onSubmitEditing={() => {
          if (allowNew && q && !hasExactMatch) void addPerson()
        }}
      />
      {allowNew && q && !hasExactMatch ? (
        <Button
          testID="people-add-new"
          label={l`Add ${q}`}
          onPress={() => void addPerson()}
          disabled={isAdding}
          hoverStyle={t.atoms.bg_contrast_25}
          style={[
            a.flex_row,
            a.align_center,
            a.gap_md,
            a.py_md,
            a.mt_sm,
            a.border_b,
            t.atoms.border_contrast_low,
            a.rounded_0,
            a.justify_start,
          ]}>
          <View
            style={[
              a.align_center,
              a.justify_center,
              a.rounded_full,
              {width: 36, height: 36, backgroundColor: t.palette.primary_50},
            ]}>
            <PersonPlusIcon size="md" fill={t.palette.primary_500} />
          </View>
          <View style={[a.flex_1]}>
            <Text style={[a.text_md, a.font_semi_bold]} numberOfLines={1}>
              <Trans>Add “{q}”</Trans>
            </Text>
            <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
              <Trans>New friend – no account needed</Trans>
            </Text>
          </View>
        </Button>
      ) : null}
      <Toggle.Group
        type="checkbox"
        label={title}
        values={[...new Set([...selected, ...lockedIds])]}
        onChange={ids => onChange([...new Set([...lockedIds, ...ids])])}
        style={[a.pt_xs]}>
        {rows.map((id, i) => (
          <Toggle.Item
            key={id}
            name={id}
            label={name(id)}
            testID={`person-option-${name(id)}`}
            disabled={lockedIds.includes(id)}
            style={[
              t.atoms.border_contrast_low,
              i < rows.length - 1 && a.border_b,
              a.rounded_0,
              a.px_0,
              a.py_sm,
              a.gap_md,
            ]}>
            <UserAvatar size={36} name={avatarName(id)} type="user" />
            <Text
              style={[a.flex_1, a.text_md, a.font_medium]}
              numberOfLines={1}>
              {name(id)}
            </Text>
            <Toggle.Checkbox />
          </Toggle.Item>
        ))}
      </Toggle.Group>
      {rows.length === 0 && !allowNew ? (
        <Text
          style={[
            a.text_md,
            a.py_xl,
            a.text_center,
            t.atoms.text_contrast_medium,
          ]}>
          <Trans>Nobody matches “{query}”</Trans>
        </Text>
      ) : null}
      <DoneButton testID="people-done" onPress={() => control.close()} />
      <Dialog.Close />
    </Dialog.ScrollableInner>
  )
}
