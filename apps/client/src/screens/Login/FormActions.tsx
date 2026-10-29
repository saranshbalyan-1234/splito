import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useBreakpoints} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {IS_WEB} from '#/env'

/**
 * Bluesky's Back and Next row. Web has no auth header, so its Back sits here at every width (Bluesky hides it on
 * narrow web, leaving no way back); native phones go back from the header.
 */
export function FormActions({
  testID,
  nextLabel,
  isBusy = false,
  isDisabled = false,
  onBack,
  onNext,
}: {
  testID: string
  nextLabel?: string
  isBusy?: boolean
  isDisabled?: boolean
  onBack?: () => void
  onNext: () => void
}) {
  const {t: l} = useLingui()
  const {gtMobile} = useBreakpoints()
  const showBack = !!onBack && (gtMobile || IS_WEB)
  return (
    <View style={[a.pt_md, showBack && [a.justify_between, a.flex_row, a.gap_sm]]}>
      {showBack && (
        <Button testID={`${testID}-back`} label={l`Back`} color="secondary" size="large" onPress={onBack}>
          <ButtonText>
            <Trans>Back</Trans>
          </ButtonText>
        </Button>
      )}
      <Button
        testID={`${testID}-next`}
        label={nextLabel ?? l`Continue`}
        color="primary"
        size="large"
        disabled={isBusy || isDisabled}
        onPress={onNext}>
        <ButtonText>{nextLabel ?? <Trans>Continue</Trans>}</ButtonText>
      </Button>
    </View>
  )
}
