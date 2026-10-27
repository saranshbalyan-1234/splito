import {View} from 'react-native'
import {Share, SquarePlus} from 'lucide-react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {type DialogControlProps} from '#/components/Dialog'
import * as FormSheet from '#/components/FormSheet'
import {Check_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/Check'
import {type Props as SVGIconProps} from '#/components/icons/common'
import {createIcon} from '#/components/icons/lucide'
import {Text} from '#/components/Typography'

const ShareIcon = createIcon(Share)
const SquarePlusIcon = createIcon(SquarePlus)

/**
 * iPhone and iPad have no install prompt, so this walks through Safari's
 * "Add to Home Screen" (F-1901). A picker-style sheet: just the cross.
 */
export function InstallHelpDialog({
  control,
  onClose,
}: {
  control: DialogControlProps
  onClose: () => void
}) {
  const {t: l} = useLingui()
  return (
    <FormSheet.Outer
      control={control}
      testID="install-help-sheet"
      onClose={onClose}>
      <FormSheet.Inner title={l`Add Splito to your Home Screen`}>
        <View style={[a.gap_xl, a.pt_sm]}>
          <Text style={[a.text_md, a.leading_snug]}>
            <Trans>
              Splito then opens full screen like any app, and keeps working
              without a connection.
            </Trans>
          </Text>
          <Step icon={ShareIcon} n={1}>
            <Trans>Tap the Share button in your browser’s toolbar.</Trans>
          </Step>
          <Step icon={SquarePlusIcon} n={2}>
            <Trans>Scroll down and choose Add to Home Screen.</Trans>
          </Step>
          <Step icon={CheckIcon} n={3}>
            <Trans>Tap Add. Splito appears on your Home Screen.</Trans>
          </Step>
        </View>
      </FormSheet.Inner>
    </FormSheet.Outer>
  )
}

function Step({
  icon: Icon,
  n,
  children,
}: {
  icon: React.ComponentType<SVGIconProps>
  n: number
  children: React.ReactNode
}) {
  const t = useTheme()
  return (
    <View style={[a.flex_row, a.align_center, a.gap_md]}>
      <View
        style={[
          a.align_center,
          a.justify_center,
          a.rounded_full,
          t.atoms.bg_contrast_50,
          {width: 40, height: 40},
        ]}>
        <Icon size="md" fill={t.palette.primary_500} />
      </View>
      <View style={[a.flex_1, a.gap_2xs]}>
        <Text style={[a.text_sm, a.font_semi_bold, t.atoms.text_contrast_medium]}>
          <Trans>Step {n}</Trans>
        </Text>
        <Text style={[a.text_md, a.leading_snug]}>{children}</Text>
      </View>
    </View>
  )
}
