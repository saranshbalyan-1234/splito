import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {formatAmount} from '@splito/domain'

import {useNumberLocale} from '#/locale/numberLocale'
import {atoms as a} from '#/alf'
import * as Admonition from '#/components/Admonition'
import {ButtonText} from '#/components/Button'
import {Text} from '#/components/Typography'

/**
 * What Settle up does about disputed and held records (F-1210, 26.20): by default they are left out of the plan, and
 * this says how much per currency ("₹600 disputed, not in this plan") with "Include disputed", remembered per group.
 * Switched on, it says they are in and offers to leave them out again.
 */
export function DisputedNotice({leftOut, isIncluded, onToggle}: {leftOut: Record<string, bigint>; isIncluded: boolean; onToggle: (include: boolean) => void}) {
  const {t: l} = useLingui()
  const locale = useNumberLocale()
  const amounts = Object.entries(leftOut)
    .sort(([x], [y]) => (x < y ? -1 : 1))
    .map(([currency, amount]) => formatAmount(amount, currency, locale))
  if (amounts.length === 0) return null
  const list = amounts.join(' · ')
  return (
    <Admonition.Outer type="warning" style={[a.mt_sm]}>
      <Admonition.Row>
        <Admonition.Icon />
        <Admonition.Content>
          <Text testID="settle-disputed-notice" style={[a.text_md, a.leading_snug]}>
            {isIncluded ? <Trans>{list} disputed or on hold is in this plan.</Trans> : <Trans>{list} disputed or on hold, not in this plan.</Trans>}
          </Text>
          <View>
            <Text style={[a.text_sm, a.leading_snug]}>
              {isIncluded ? <Trans>It is still being questioned. Leave it out to settle only what nobody disputes.</Trans> : <Trans>Nobody pays or chases it until it is answered.</Trans>}
            </Text>
          </View>
        </Admonition.Content>
        <Admonition.Button
          testID={isIncluded ? 'settle-exclude-disputed' : 'settle-include-disputed'}
          label={isIncluded ? l`Leave disputed out` : l`Include disputed`}
          color="secondary"
          onPress={() => onToggle(!isIncluded)}>
          <ButtonText>{isIncluded ? <Trans>Leave out</Trans> : <Trans>Include disputed</Trans>}</ButtonText>
        </Admonition.Button>
      </Admonition.Row>
    </Admonition.Outer>
  )
}
