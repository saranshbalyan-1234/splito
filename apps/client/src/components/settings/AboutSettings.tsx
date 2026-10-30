// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Settings/AboutSettings.tsx
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useTheme} from '#/alf'
import {LogoMark} from '#/components/brand/Logo'
import {CircleInfo_Stroke2_Corner0_Rounded as InfoIcon} from '#/components/icons/CircleInfo'
import {ChartPie_Stroke2_Corner0_Rounded as ChartPieIcon} from '#/components/icons/ChartPie'
import {CirclePlus_Stroke2_Corner0_Rounded as CirclePlusIcon} from '#/components/icons/CirclePlus'
import {Cloud_Stroke2_Corner0_Rounded as CloudIcon} from '#/components/icons/Cloud'
import {type Props as SVGIconProps} from '#/components/icons/common'
import {HandCoins_Stroke2_Corner0_Rounded as HandCoinsIcon} from '#/components/icons/Money'
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

/* One titled paragraph, as About's "Open source" group. */
function Topic({
  icon,
  title,
  children,
}: {
  icon: React.ComponentType<SVGIconProps>
  title: React.ReactNode
  children: React.ReactNode
}) {
  const t = useTheme()
  return (
    <SettingsList.Group iconInset={true}>
      <SettingsList.ItemIcon icon={icon} />
      <SettingsList.ItemText>{title}</SettingsList.ItemText>
      <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
        {children}
      </Text>
    </SettingsList.Group>
  )
}

/** The sidebar footer's and drawer's Help page. */
export function HelpSettings({isIntroLinked = true}: {isIntroLinked?: boolean}) {
  const {t: l} = useLingui()
  return (
    <>
      {/* The intro slides again (F-249); the address is /welcome/1. Signed out there is no navigator to link inside, and the intro is already the way in. */}
      {isIntroLinked && (
        <>
          <SettingsList.LinkItem testID="help-see-intro" to="/welcome/1" label={l`See the intro`}>
            <SettingsList.ItemIcon icon={InfoIcon} />
            <SettingsList.ItemText>
              <Trans>See the intro</Trans>
            </SettingsList.ItemText>
          </SettingsList.LinkItem>
          <SettingsList.Divider />
        </>
      )}
      <Topic icon={CirclePlusIcon} title={<Trans>Add an expense</Trans>}>
        <Trans>
          Use Add expense in the sidebar, or the + button on phones. Choose who
          paid and how to split it.
        </Trans>
      </Topic>
      <Topic icon={HandCoinsIcon} title={<Trans>Settle up</Trans>}>
        <Trans>
          Open a friend or a group and choose Settle up to record a payment.
        </Trans>
      </Topic>
      <Topic icon={ChartPieIcon} title={<Trans>Balances</Trans>}>
        <Trans>
          People and Groups show who owes whom in each currency. Different
          currencies are never added together.
        </Trans>
      </Topic>
    </>
  )
}

/** The sidebar footer's Privacy page. */
export function PrivacySettings() {
  return (
    <>
      <Topic icon={CloudIcon} title={<Trans>Saved on this device</Trans>}>
        <Trans>
          Everything you add stays on this device. Splito has no account or
          server yet, so nothing is sent anywhere.
        </Trans>
      </Topic>
      <Topic icon={InfoIcon} title={<Trans>No tracking</Trans>}>
        <Trans>Splito collects no analytics and shows no ads.</Trans>
      </Topic>
    </>
  )
}
