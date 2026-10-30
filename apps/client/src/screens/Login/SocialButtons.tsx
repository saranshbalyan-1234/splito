import {useState} from 'react'
import {View} from 'react-native'
import Svg, {Path} from 'react-native-svg'
import {Trans, useLingui} from '@lingui/react/macro'

import {GOOGLE_G} from '#/alf/authBrand'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {IS_IOS} from '#/env'
import {NotLiveYet} from './NotLiveYet'

const APPLE_LOGO =
  'M12.15 6.9c-.95 0-2.42-1.08-3.96-1.04-2.04.03-3.91 1.18-4.96 3.01-2.12 3.68-.55 9.1 1.52 12.09 1.01 1.45 2.2 3.09 3.79 3.04 1.52-.07 2.09-.99 3.94-.99 1.83 0 2.35.99 3.96.95 1.64-.03 2.68-1.48 3.68-2.95 1.16-1.69 1.64-3.33 1.66-3.42-.04-.01-3.18-1.22-3.22-4.86-.03-3.04 2.48-4.49 2.6-4.56-1.43-2.09-3.62-2.32-4.39-2.38-2-.16-3.68 1.09-4.61 1.09zm3.38-3.07c.84-1.01 1.4-2.43 1.25-3.83-1.21.05-2.66.8-3.53 1.82-.78.9-1.45 2.34-1.27 3.71 1.34.1 2.72-.69 3.55-1.7z'

function AppleMark({color}: {color: string}) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" aria-hidden>
      <Path d={APPLE_LOGO} fill={color} />
    </Svg>
  )
}

function GoogleMark() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" aria-hidden>
      <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill={GOOGLE_G.blue} />
      <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill={GOOGLE_G.green} />
      <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill={GOOGLE_G.yellow} />
      <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill={GOOGLE_G.red} />
    </Svg>
  )
}

/**
 * "Continue with Apple" and "Continue with Google" in the platforms' own button styles (owner 138): Apple's black or
 * white, Google's outlined white. Apple first on iOS, Google first on Android and web. The real sign-in arrives with
 * the auth API (F-2102); until then a tap shows the "arrives with sync" note and does nothing else, never a fake success.
 */
export function SocialButtons() {
  const t = useTheme()
  const {t: l} = useLingui()
  const [isNoteShown, setNoteShown] = useState(false)

  const apple = (
    <Button key="apple" testID="continue-apple" label={l`Continue with Apple`} size="large" variant="solid" color="secondary_inverted" onPress={() => setNoteShown(true)}>
      <AppleMark color={t.atoms.text_inverted.color as string} />
      <ButtonText>
        <Trans>Continue with Apple</Trans>
      </ButtonText>
    </Button>
  )
  const google = (
    <Button key="google" testID="continue-google" label={l`Continue with Google`} size="large" variant="outline" color="secondary" onPress={() => setNoteShown(true)}>
      <GoogleMark />
      <ButtonText>
        <Trans>Continue with Google</Trans>
      </ButtonText>
    </Button>
  )

  return (
    <View style={[a.gap_sm]}>
      {IS_IOS ? [apple, google] : [google, apple]}
      {isNoteShown && <NotLiveYet testID="auth-social-not-live" isSocial />}
    </View>
  )
}
