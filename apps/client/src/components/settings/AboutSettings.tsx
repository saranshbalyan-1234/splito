// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Settings/AboutSettings.tsx
import {View} from 'react-native'
import {Trans} from '@lingui/react/macro'

import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useTheme} from '#/alf'
import {LogoMark} from '#/components/brand/Logo'
import {CircleInfo_Stroke2_Corner0_Rounded as InfoIcon} from '#/components/icons/CircleInfo'
import {Cloud_Stroke2_Corner0_Rounded as CloudIcon} from '#/components/icons/Cloud'
import {Shapes_Stroke2_Corner0_Rounded as ShapesIcon} from '#/components/icons/Shapes'
import {Text} from '#/components/Typography'
import {APP_VERSION} from '#/env'

/** Version, where data lives, and the open-source work Splito is built on. */
export function AboutSettings() {
  const t = useTheme()
  return (
    <>
      <View style={[a.align_center, a.gap_sm, a.px_xl, a.pt_lg, a.pb_xl]}>
        <LogoMark size={56} />
        <Text style={[a.text_2xl, a.font_bold]}>Splito</Text>
        <Text style={[a.text_md, a.text_center, t.atoms.text_contrast_medium]}>
          <Trans>Split expenses with anyone, even offline.</Trans>
        </Text>
      </View>
      <SettingsList.Divider />
      <SettingsList.Item>
        <SettingsList.ItemIcon icon={InfoIcon} />
        <SettingsList.ItemText>
          <Trans>Version</Trans>
        </SettingsList.ItemText>
        <SettingsList.BadgeText>{APP_VERSION}</SettingsList.BadgeText>
      </SettingsList.Item>
      <SettingsList.Item>
        <SettingsList.ItemIcon icon={CloudIcon} />
        <SettingsList.ItemText>
          <Trans>Your data</Trans>
        </SettingsList.ItemText>
        <SettingsList.BadgeText>
          <Trans>Saved on this device</Trans>
        </SettingsList.BadgeText>
      </SettingsList.Item>
      <SettingsList.Divider />
      <SettingsList.Group iconInset={true}>
        <SettingsList.ItemIcon icon={ShapesIcon} />
        <SettingsList.ItemText>
          <Trans>Open source</Trans>
        </SettingsList.ItemText>
        <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>
            Splito's interface is built on Bluesky's social-app (MIT licence).
            Icons are Lucide (ISC licence). The Inter typeface is under the SIL
            Open Font License.
          </Trans>
        </Text>
      </SettingsList.Group>
    </>
  )
}
