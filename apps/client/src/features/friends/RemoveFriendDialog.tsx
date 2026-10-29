import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {isSettledBalance, personSummary} from '@splito/domain'
import {type Entity, type Person, removeFriend, restoreFriend} from '@splito/sync'

import {useHaptics} from '#/lib/haptics'
import {logger} from '#/logger'
import {useBalanceRows, useMutationCtx, useStore} from '#/data/hooks'
import {useNumberLocale} from '#/locale/numberLocale'
import {atoms as a, useTheme} from '#/alf'
import {BalanceText} from '#/components/BalanceText'
import {type DialogControlProps} from '#/components/Dialog'
import {PersonMinus_Stroke2_Corner0_Rounded as RemovedIcon} from '#/components/icons/Export'
import * as Prompt from '#/components/Prompt'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'

/**
 * Remove friend (ARCHITECTURE 26.18, F-621). With nothing open it asks, then
 * takes the friend out of lists and pickers, keeping every expense and
 * payment, and offers Undo. While any currency is open it lists the amounts
 * and offers Settle up and Call it even instead: a friend is removed only
 * once nothing is owed either way. Used by the friend's page and the
 * Friends and invites hub.
 */
export function RemoveFriendDialog({
  control,
  person,
  onSettleUp,
  onCallItEven,
  onRemoved,
}: {
  control: DialogControlProps
  /** Null while no row has asked yet (the hub keeps one dialog for all its rows). */
  person: Entity<Person> | null
  /** Opens the settle-up flow for this friend. */
  onSettleUp: () => void
  /** Opens the call-it-even flow for this friend. */
  onCallItEven: () => void
  /** Runs after a successful removal (the friend's page leaves itself). */
  onRemoved?: () => void
}) {
  const {t: l} = useLingui()
  const store = useStore()
  const ctx = useMutationCtx()
  const haptics = useHaptics()
  const locale = useNumberLocale()
  const rows = useBalanceRows()
  const name = person?.data.name ?? ''
  const open = Object.entries(
    personSummary(rows ?? [], {includeGroups: true}).find(s => s.person === person?.id)?.byCurrency ?? {},
  )
    .filter(([, b]) => !isSettledBalance(b))
    .sort(([x], [y]) => (x < y ? -1 : 1))

  const remove = async () => {
    if (!person) return
    try {
      await removeFriend(store, ctx, person.id)
      haptics.confirm()
      onRemoved?.()
      Toast.show(
        <Toast.Outer>
          <Toast.Icon icon={RemovedIcon} />
          <Toast.Text>
            <Trans>{name} removed</Trans>
          </Toast.Text>
          <Toast.Action
            label={l`Undo`}
            onPress={() =>
              void restoreFriend(store, ctx, person.id).catch(e => {
                logger.error(e, {where: 'RemoveFriendDialog.undo'})
                Toast.show(l`Couldn’t undo. Add ${name} back from Friends and invites.`, {type: 'error'})
              })
            }>
            <Trans>Undo</Trans>
          </Toast.Action>
        </Toast.Outer>,
      )
    } catch (e) {
      haptics.error()
      logger.error(e, {where: 'RemoveFriendDialog.remove'})
      Toast.show(l`Couldn’t remove ${name}. Settle up first, or try again.`, {type: 'error'})
    }
  }

  /* One dialog whether or not something is open, so the control keeps its state when the row's balance loads. */
  const isBlocked = open.length > 0
  return (
    <Prompt.Outer control={control} testID="remove-friend-dialog">
      <Prompt.Content>
        <Prompt.TitleText>{isBlocked ? <Trans>Settle up with {name} first</Trans> : <Trans>Remove {name}?</Trans>}</Prompt.TitleText>
        <Prompt.DescriptionText>
          {isBlocked ? (
            <Trans>A friend can be removed once nothing is owed in any currency. Right now:</Trans>
          ) : (
            <Trans>{name} leaves your friends list and the pickers. Every expense and payment you shared stays, and you can add them back any time.</Trans>
          )}
        </Prompt.DescriptionText>
        {isBlocked && <OpenAmounts open={open.map(([currency, b]) => ({currency, amount: b.total}))} locale={locale} />}
      </Prompt.Content>
      <Prompt.Actions>
        {isBlocked ? (
          <>
            <Prompt.Action testID="remove-friend-settle" cta={l`Settle up`} onPress={onSettleUp} />
            <Prompt.Action testID="remove-friend-even" cta={l`Call it even`} color="secondary" onPress={onCallItEven} />
          </>
        ) : (
          <Prompt.Action testID="confirmBtn" cta={l`Remove`} color="negative" onPress={() => void remove()} />
        )}
        <Prompt.Cancel />
      </Prompt.Actions>
    </Prompt.Outer>
  )
}

function OpenAmounts({open, locale}: {open: Array<{currency: string; amount: bigint}>; locale: string}) {
  const t = useTheme()
  return (
    <View testID="remove-friend-open" style={[a.gap_xs, a.pb_lg]}>
      {open.map(o => (
        <View key={o.currency} style={[a.flex_row, a.align_center, a.gap_sm, a.py_xs, a.px_md, a.rounded_sm, t.atoms.bg_contrast_25]}>
          <Text style={[a.text_sm, a.font_semi_bold, t.atoms.text_contrast_medium, {minWidth: 36}]}>{o.currency}</Text>
          <BalanceText amount={o.amount} currency={o.currency} locale={locale} testID={`remove-friend-open-${o.currency}`} />
        </View>
      ))}
    </View>
  )
}
