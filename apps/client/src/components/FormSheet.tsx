import {View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {TimesLarge_Stroke2_Corner0_Rounded as XIcon} from '#/components/icons/Times'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'

/*
 * One layout for every form sheet and web dialog (owner: "all the drawers to
 * have cross button like this and cancel and save button at bottom; drawers
 * become modal/popup on web with a cross button on top right and save and
 * cancel on bottom right"). The sheet itself is Bluesky's Dialog (or the
 * composer surface for Add / Edit expense); these are its top bar and
 * footer.
 */

/** Title on the left, a round grey close cross at the top right. */
export function Header({
  title,
  onClose,
  closeHint,
}: {
  title: string
  onClose: () => void
  /** Accessibility hint of the cross (default: closes without saving). */
  closeHint?: string
}) {
  const {t: l} = useLingui()
  return (
    <View
      style={[
        a.flex_row,
        a.align_center,
        a.gap_md,
        a.px_lg,
        a.pt_md,
        a.pb_sm,
        {minHeight: 56},
      ]}>
      <Text
        accessibilityRole="header"
        numberOfLines={1}
        style={[a.flex_1, a.text_xl, a.font_bold, a.leading_tight]}>
        {title}
      </Text>
      <Button
        testID="sheet-close"
        label={l`Close`}
        accessibilityHint={closeHint ?? l`Closes without saving`}
        color="secondary"
        size="small"
        shape="round"
        style={[{width: 32, height: 32}]}
        onPress={onClose}>
        <ButtonIcon icon={XIcon} size="sm" />
      </Button>
    </View>
  )
}

/**
 * Cancel and the primary action, pinned to the bottom: side by side and
 * filling the width on phones (above the home indicator), right-aligned on
 * wide screens. A live readout - the split's "left to assign" - sits right
 * above them.
 */
export function Footer({
  readout,
  ...actions
}: ActionsProps & {readout?: React.ReactNode}) {
  const t = useTheme()
  const {gtMobile} = useBreakpoints()
  const {bottom} = useSafeAreaInsets()

  return (
    <View
      style={[
        a.px_lg,
        a.pt_sm,
        {paddingBottom: Math.max(bottom, gtMobile ? 16 : 12)},
        a.border_t,
        t.atoms.border_contrast_low,
        t.atoms.bg,
      ]}>
      {readout}
      <Actions {...actions} />
    </View>
  )
}

type ActionsProps = {
  onCancel: () => void
  onSave: () => void
  /** The primary action's words, e.g. "Save expense". */
  saveLabel: string
  canSave?: boolean
  isSaving?: boolean
  /** Default `sheet-save`; dialogs keep their own so nested sheets never share one. */
  saveTestID?: string
  cancelTestID?: string
}

/** The footer's two buttons, also used at the end of a dialog's content. */
export function Actions({
  onCancel,
  onSave,
  saveLabel,
  canSave = true,
  isSaving = false,
  saveTestID = 'sheet-save',
  cancelTestID = 'sheet-cancel',
}: ActionsProps) {
  const {t: l} = useLingui()
  const {gtMobile} = useBreakpoints()
  const size = gtMobile ? 'small' : 'large'
  return (
    <View
      style={[a.flex_row, a.align_center, a.gap_sm, gtMobile && a.justify_end]}>
      <Button
        testID={cancelTestID}
        label={l`Cancel`}
        color="secondary"
        size={size}
        style={[!gtMobile && a.flex_1]}
        onPress={onCancel}>
        <ButtonText maxFontSizeMultiplier={2}>
          <Trans>Cancel</Trans>
        </ButtonText>
      </Button>
      <Button
        testID={saveTestID}
        label={saveLabel}
        color="primary"
        size={size}
        disabled={!canSave || isSaving}
        style={[!gtMobile && a.flex_1]}
        onPress={onSave}>
        {isSaving ? (
          <Loader size="sm" />
        ) : (
          <ButtonText maxFontSizeMultiplier={2}>{saveLabel}</ButtonText>
        )}
      </Button>
    </View>
  )
}
