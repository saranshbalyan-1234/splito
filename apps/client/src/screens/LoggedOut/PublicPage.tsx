import {ScrollView, View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {type PublicPage as Page} from '#/lib/links/public'
import {AboutSettings, HelpSettings, PrivacySettings} from '#/components/settings/AboutSettings'
import {atoms as a, useTheme} from '#/alf'
import {AppLanguageDropdown} from '#/components/AppLanguageDropdown'
import {Button, ButtonText} from '#/components/Button'
import {Text} from '#/components/Typography'
import * as SettingsList from '#/screens/Settings/components/SettingsList'

/**
 * The pages a signed-out device may open (`lib/links/public.ts`): Help, Privacy and About, and the public invite page.
 * No account, store or navigator is needed: the same content the signed-in Settings pages show, in a plain frame with a
 * way back. `/join/<token>` leads to sign-in; the invite itself arrives with the backend (§ 14), so this page promises nothing else.
 */
export function PublicPage({page, onBack, onContinue}: {page: Page; onBack: () => void; onContinue: () => void}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const title = {help: l`Help`, privacy: l`Privacy`, about: l`About`, join: l`You’re invited to Splito`}[page]

  return (
    <ScrollView testID={`public-${page}`} style={a.flex_1} contentContainerStyle={[a.flex_grow, a.self_center, a.w_full, a.py_2xl, {maxWidth: 600}]} keyboardShouldPersistTaps="handled">
      <View style={[a.px_xl, a.gap_lg, a.pb_lg]}>
        <Text role="heading" aria-level={1} style={[a.text_3xl, a.font_bold]}>
          {title}
        </Text>
        {page === 'join' && (
          <Text style={[a.text_lg, a.leading_snug, t.atoms.text_contrast_medium]}>
            <Trans>Sign in or create an account to see this invite.</Trans>
          </Text>
        )}
      </View>
      <SettingsList.Container>
        {page === 'help' && <HelpSettings isIntroLinked={false} />}
        {page === 'privacy' && <PrivacySettings />}
        {page === 'about' && <AboutSettings />}
      </SettingsList.Container>
      <View style={[a.px_xl, a.pt_lg, a.gap_md, a.flex_row, a.align_center, a.justify_between]}>
        {page === 'join' ? (
          <Button testID="public-continue" label={l`Continue`} size="large" color="primary" style={a.flex_1} onPress={onContinue}>
            <ButtonText>
              <Trans>Continue</Trans>
            </ButtonText>
          </Button>
        ) : (
          <Button testID="public-back" label={l`Back`} size="large" color="secondary" onPress={onBack}>
            <ButtonText>
              <Trans>Back</Trans>
            </ButtonText>
          </Button>
        )}
        <AppLanguageDropdown isDevice />
      </View>
    </ScrollView>
  )
}
