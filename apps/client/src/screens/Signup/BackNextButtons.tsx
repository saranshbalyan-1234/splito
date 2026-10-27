// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Signup/BackNextButtons.tsx
import {View} from 'react-native'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {Trans} from '@lingui/react/macro'

import {atoms as a} from '#/alf'
import {Button, ButtonText} from '#/components/Button'

export function BackNextButtons({
  onBackPress,
  onNextPress,
}: {
  onBackPress: () => void
  onNextPress: () => void
}) {
  const {_} = useLingui()

  return (
    <View style={[a.flex_row, a.justify_between, a.pb_lg, a.pt_3xl]}>
      <Button
        testID="backBtn"
        label={_(msg`Go back to previous step`)}
        variant="solid"
        color="secondary"
        size="large"
        onPress={onBackPress}>
        <ButtonText>
          <Trans>Back</Trans>
        </ButtonText>
      </Button>
      <Button
        testID="nextBtn"
        label={_(msg`Continue to next step`)}
        variant="solid"
        color="primary"
        size="large"
        onPress={onNextPress}>
        <ButtonText>
          <Trans>Next</Trans>
        </ButtonText>
      </Button>
    </View>
  )
}
