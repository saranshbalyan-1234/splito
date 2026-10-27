import {useEffect, useState} from 'react'
import {View} from 'react-native'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'
import {
  type Entity,
  type Group,
  groupContents,
  type GroupRemoval,
} from '@splito/sync'

import {usePref, useStore} from '#/data/hooks'
import {atoms as a, useTheme} from '#/alf'
import {type DialogControlProps} from '#/components/Dialog'
import {Trash_Stroke2_Corner0_Rounded as TrashIcon} from '#/components/icons/Trash'
import * as Prompt from '#/components/Prompt'
import {Text} from '#/components/Typography'

/**
 * Delete group (F-615): says what goes - the live expenses, payments and write-offs in it - and that all of it
 * waits in Recently deleted and comes back together. Confirming runs `onConfirm` after the sheet closes.
 */
export function DeleteGroupPrompt({
  control,
  group,
  onConfirm,
}: {
  control: DialogControlProps
  group: Entity<Group>
  onConfirm: () => void
}) {
  return (
    <Prompt.Outer control={control} testID="delete-group-prompt">
      <Body group={group} onConfirm={onConfirm} />
    </Prompt.Outer>
  )
}

function Body({group, onConfirm}: {group: Entity<Group>; onConfirm: () => void}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const store = useStore()
  const [days = 30] = usePref('history.binDays')
  const [contents, setContents] = useState<GroupRemoval | null>(null)
  useEffect(() => {
    let isCancelled = false
    void groupContents(store, group.id).then(c => {
      if (!isCancelled) setContents(c)
    })
    return () => {
      isCancelled = true
    }
  }, [store, group.id])

  const lines = contents
    ? [
        contents.expenses > 0 &&
          plural(contents.expenses, {one: '# expense', other: '# expenses'}),
        contents.repayments > 0 &&
          plural(contents.repayments, {one: '# payment', other: '# payments'}),
        contents.writeoffs > 0 &&
          plural(contents.writeoffs, {one: '# write-off', other: '# write-offs'}),
      ].filter((x): x is string => !!x)
    : []

  return (
    <>
      <Prompt.Content>
        <Prompt.TitleText>
          <Trans>Delete {group.data.name}?</Trans>
        </Prompt.TitleText>
        <Prompt.DescriptionText>
          <Trans>
            The group and everything in it leave your balances, history and
            search.
          </Trans>
        </Prompt.DescriptionText>
        <View
          testID="delete-group-contents"
          style={[a.gap_xs, a.pb_md]}>
          <Text style={[a.text_sm, a.font_semi_bold, t.atoms.text_contrast_medium]}>
            <Trans>What goes</Trans>
          </Text>
          {contents === null ? (
            <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
              <Trans>Counting…</Trans>
            </Text>
          ) : lines.length === 0 ? (
            <Text style={[a.text_md]}>
              <Trans>The group has no expenses or payments yet.</Trans>
            </Text>
          ) : (
            lines.map(line => (
              <Text key={line} style={[a.text_md, a.font_semi_bold]}>
                {line}
              </Text>
            ))
          )}
        </View>
        <Text style={[a.text_md, a.leading_snug, t.atoms.text_contrast_high, a.pb_lg]}>
          <Trans>
            It all waits in Recently deleted for {days} days. Restore the group
            there and every expense and payment comes back with it.
          </Trans>
        </Text>
      </Prompt.Content>
      <Prompt.Actions>
        <Prompt.Action
          testID="delete-group-confirm"
          cta={l`Delete group`}
          color="negative"
          icon={TrashIcon}
          onPress={onConfirm}
        />
        <Prompt.Cancel />
      </Prompt.Actions>
    </>
  )
}
