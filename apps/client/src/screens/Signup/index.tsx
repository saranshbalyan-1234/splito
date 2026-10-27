// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Signup/index.tsx
import {useReducer} from 'react'
import {View} from 'react-native'
import {KeyboardAvoidingView} from 'react-native-keyboard-controller'
import Animated, {FadeIn, LayoutAnimationConfig} from 'react-native-reanimated'
import {Trans, useLingui} from '@lingui/react/macro'

import {
  initialState,
  reducer,
  SIGNUP_STEPS,
  SignupContext,
  SignupStep,
} from '#/screens/Signup/state'
import {StepInfo} from '#/screens/Signup/StepInfo'
import {atoms as a, native, useTheme} from '#/alf'
import {LoggedOutLayout} from '#/components/LoggedOutLayout'
import {ScreenTransition} from '#/components/ScreenTransition'
import {Text} from '#/components/Typography'

export function Signup({onPressBack}: {onPressBack: () => void}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const [state, dispatch] = useReducer(reducer, initialState)

  return (
    <Animated.View exiting={native(FadeIn.duration(90))} style={a.flex_1}>
      <SignupContext.Provider value={{state, dispatch}}>
        <KeyboardAvoidingView
          behavior="padding"
          style={a.flex_1}
          automaticOffset>
          <LoggedOutLayout
            leadin=""
            title={l`Create account`}
            description={l`We’re so excited to have you join us!`}
            scrollable>
            <View testID="createAccount" style={a.flex_1}>
              <LayoutAnimationConfig skipEntering>
                <ScreenTransition
                  key={state.activeStep}
                  direction={state.screenTransitionDirection}
                  style={a.flex_1}>
                  <View style={[a.flex_1, a.px_xl, a.pt_2xl]}>
                    <View style={[a.gap_sm, a.pb_3xl]}>
                      {/* Bluesky's step indicator; shown once there is more than one step. */}
                      {SIGNUP_STEPS.length > 1 && (
                        <Text
                          style={[
                            a.font_semi_bold,
                            t.atoms.text_contrast_medium,
                          ]}>
                          <Trans>
                            Step {state.activeStep + 1} of {SIGNUP_STEPS.length}
                          </Trans>
                        </Text>
                      )}
                      <Text style={[a.text_3xl, a.font_semi_bold]}>
                        <Trans>Your account</Trans>
                      </Text>
                    </View>

                    {state.activeStep === SignupStep.INFO && (
                      <StepInfo onPressBack={onPressBack} />
                    )}
                  </View>
                </ScreenTransition>
              </LayoutAnimationConfig>
            </View>
          </LoggedOutLayout>
        </KeyboardAvoidingView>
      </SignupContext.Provider>
    </Animated.View>
  )
}
