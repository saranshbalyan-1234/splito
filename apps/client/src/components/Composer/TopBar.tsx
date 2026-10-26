// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/com/composer/Composer.tsx (ComposerTopBar)
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'

/**
 * Bluesky's composer top bar: Cancel on the left, the primary pill on the
 * right (Bluesky's "Post", here "Save"). Drafts and publishing stages are
 * removed. Splito centres `title` between them, and Cancel's text and the
 * pill's edge sit on the same 16px gutter.
 */
export function TopBar({
  onCancel,
  onSave,
  canSave,
  isSaving = false,
  saveLabel,
  cancelHint,
  title,
}: {
  onCancel: () => void
  onSave: () => void
  canSave: boolean
  isSaving?: boolean
  /** Accessible name of the Save pill (default "Save expense"). */
  saveLabel?: string
  /** Accessibility hint of Cancel (default "Closes Add expense without saving"). */
  cancelHint?: string
  /** The composer's name, centred in the bar. */
  title?: string
}) {
  const {t: l} = useLingui()

  return (
    <View
      style={[
        a.relative,
        a.flex_row,
        a.align_center,
        a.gap_xs,
        a.px_lg,
        a.py_sm,
        {minHeight: 52},
      ]}>
      {title ? (
        <View
          pointerEvents="none"
          style={[a.absolute, a.inset_0, a.align_center, a.justify_center]}>
          <Text
            numberOfLines={1}
            style={[a.text_md, a.font_semi_bold, {maxWidth: '50%'}]}>
            {title}
          </Text>
        </View>
      ) : null}
      <Button
        testID="composer-cancel"
        label={l`Cancel`}
        variant="ghost"
        color="primary"
        shape="default"
        size="small"
        style={[{paddingLeft: 7, paddingRight: 7, marginLeft: -7}]}
        hoverStyle={[a.bg_transparent, {opacity: 0.5}]}
        onPress={onCancel}
        accessibilityHint={cancelHint ?? l`Closes Add expense without saving`}>
        <ButtonText style={[a.text_md]} maxFontSizeMultiplier={2}>
          <Trans>Cancel</Trans>
        </ButtonText>
      </Button>
      <View style={a.flex_1} />
      <Button
        testID="composer-save"
        label={saveLabel ?? l`Save expense`}
        color="primary"
        size="small"
        onPress={onSave}
        disabled={!canSave || isSaving}>
        {isSaving ? (
          <Loader size="sm" />
        ) : (
          <ButtonText style={[a.text_md]} maxFontSizeMultiplier={2}>
            <Trans context="action">Save</Trans>
          </ButtonText>
        )}
      </Button>
    </View>
  )
}
