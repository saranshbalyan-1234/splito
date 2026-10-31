import {useState} from 'react'
import {View} from 'react-native'
import {useNavigation, useRoute} from '@react-navigation/native'

import {type NavigationProp} from '#/lib/routes/types'
import {backFallback, goBack} from '#/navigation/goBack'
import {atoms as a, web, useBreakpoints, useTheme} from '#/alf'
import {Portal} from '#/components/Portal'
import {IS_WEB} from '#/env'
import {slideFrom, Welcome} from '.'

/**
 * "See the intro" (Settings > Help, F-249): the same slides, signed in. `/welcome/N` names the slide; Skip and Get
 * started go back where the person was. Native pushes it full screen; web mounts it in the portal outlet so it sits above
 * the sidebar and header, a centred card over a dimmed app on wide screens.
 */
export function WelcomeScreen() {
  const t = useTheme()
  const {gtMobile} = useBreakpoints()
  const navigation = useNavigation<NavigationProp>()
  const slide = slideFrom((useRoute().params as {step?: string} | undefined)?.step)
  const [previous, setPrevious] = useState(slide)

  const flow = (
    <View testID="screen-welcome" role="dialog" aria-modal style={[a.flex_1, t.atoms.bg, web({position: 'fixed', inset: 0})]}>
      {gtMobile && <View style={[a.absolute, a.inset_0, {backgroundColor: t.palette.black, opacity: 0.55}]} />}
      <Welcome
        slide={slide}
        previous={previous}
        onSlide={next => {
          setPrevious(slide)
          navigation.setParams({step: String(next + 1)})
        }}
        onDone={() => goBack(navigation, backFallback({name: 'Welcome'}), IS_WEB)}
        isLanguageFromDevice={false}
      />
    </View>
  )
  return IS_WEB ? <Portal>{flow}</Portal> : flow
}
