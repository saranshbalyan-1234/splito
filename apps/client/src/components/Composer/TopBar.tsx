// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/com/composer/Composer.tsx (ComposerTopBar)
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {Loader} from '#/components/Loader'

/**
 * Bluesky's composer top bar: Cancel on the left, the primary pill on the
 * right (Bluesky's "Post", here "Save"). Drafts and publishing stages are
 * removed; `children` sits just left of the pill.
 */
export function TopBar({
  onCancel,
  onSave,
  canSave,
  isSaving = false,
  children,
}: {
  onCancel: () => void
  onSave: () => void
  canSave: boolean
  isSaving?: boolean
  children?: React.ReactNode
}) {
  const {t: l} = useLingui()

  return (
    <View style={[a.flex_row, a.align_center, a.gap_xs, a.p_sm]}>
      <Button
        testID="composer-cancel"
        label={l`Cancel`}
        variant="ghost"
        color="primary"
        shape="default"
        size="small"
        style={[{paddingLeft: 7, paddingRight: 7}]}
        hoverStyle={[a.bg_transparent, {opacity: 0.5}]}
        onPress={onCancel}
        accessibilityHint={l`Closes Add expense without saving`}>
        <ButtonText style={[a.text_md]} maxFontSizeMultiplier={2}>
          <Trans>Cancel</Trans>
        </ButtonText>
      </Button>
      <View style={a.flex_1} />
      {children}
      <Button
        testID="composer-save"
        label={l`Save expense`}
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
