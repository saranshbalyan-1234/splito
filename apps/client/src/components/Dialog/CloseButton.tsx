import {View} from 'react-native'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'

import {atoms as a} from '#/alf'
import {Button, ButtonIcon} from '#/components/Button'
import {useDialogContext} from '#/components/Dialog/context'
import {TimesLarge_Stroke2_Corner0_Rounded as X} from '#/components/icons/Times'

/**
 * Splito: every sheet and dialog closes with the same round grey cross at
 * its top right, on phones as on web (owner: "all the drawers to have cross
 * button like this"). Bluesky draws a ghost cross on web and none on native.
 */
export function CloseButton() {
  const {_} = useLingui()
  const {close} = useDialogContext()
  return (
    <View
      style={[
        a.absolute,
        a.z_10,
        {top: a.pt_xl.paddingTop, right: a.pr_lg.paddingRight},
      ]}>
      <Button
        testID="dialog-close"
        size="small"
        color="secondary"
        shape="round"
        style={[{width: 32, height: 32}]}
        onPress={() => close()}
        label={_(msg`Close`)}>
        <ButtonIcon icon={X} size="sm" />
      </Button>
    </View>
  )
}
