// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Profile/Header/EditProfileDialog.tsx (dirty close: preventDismiss, onBackgroundPress, "Discard changes?" prompt)
import {createContext, useContext, useState} from 'react'
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {Trans, useLingui} from '@lingui/react/macro'

import {useWorkAtStake} from '#/lib/pwa/workAtStake'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {useDeferredReady} from '#/lib/hooks/useAfterTransition'
import {TimesLarge_Stroke2_Corner0_Rounded as XIcon} from '#/components/icons/Times'
import {Loader} from '#/components/Loader'
import * as Prompt from '#/components/Prompt'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'

/*
 * One layout for every form sheet and web dialog (owner rule 7: "all the
 * drawers to have cross button like this and cancel and save button at
 * bottom; drawers become modal/popup on web with a cross button on top right
 * and save and cancel on bottom right"). Phones get Bluesky's bottom sheet,
 * wider web Bluesky's centred dialog: the title on the left and a round
 * cross at the top right, then the body, then Cancel and the primary action
 * at the bottom. Pickers keep only the cross.
 */

/**
 * True where a sheet rises from the bottom (native phones and phone-width
 * web) and its two footer buttons share the width; false where it is a
 * centred popup with the buttons at its bottom right.
 */
export function useIsSheet() {
  return !useBreakpoints().gtMobile
}

type SheetContextValue = {
  /** Side padding shared by the top bar, body and footer, so their edges line up. */
  inset?: ViewStyle
  /** Closes the sheet, first asking "Discard changes?" if anything changed. */
  requestClose: () => void
  setIsDirty: (isDirty: boolean) => void
  testID?: string
}

export const SheetContext = createContext<SheetContextValue>({
  requestClose: () => {},
  setIsDirty: () => {},
})
SheetContext.displayName = 'FormSheetContext'

/** A heavy body's blank stand-in while it waits a frame; a sheet passes its own skeleton for a closer match. */
const SHEET_BODY_STAND_IN_HEIGHT = 280

/**
 * A heavy sheet's body (owner 152, `deferBody` on `FormSheet.Inner` / `Screen`):
 * the title, cross and footer start the open motion at once; the rows, pickers
 * and fields mount a frame later as a transition, after `standIn`. Small sheets
 * do not use it: they open complete, with no jump (owner 129).
 * ponytail: one fixed stand-in height, not a measured one; the sheet grows while it is still rising.
 */
export function SheetBody({
  children,
  standIn,
}: {
  children: React.ReactNode
  standIn?: React.ReactNode
}) {
  return useDeferredReady() ? (
    children
  ) : (
    (standIn ?? <View style={{minHeight: SHEET_BODY_STAND_IN_HEIGHT}} />)
  )
}

/** The open sheet's close request, for a body that ends with its own buttons. */
export function useFormSheet() {
  return useContext(SheetContext)
}

/**
 * A form sheet on Bluesky's Dialog. Its `Inner` reports whether the form has
 * unsaved changes; then the cross, Cancel, the scrim, Escape and a swipe down
 * ask "Discard changes?" instead of closing (Bluesky's EditProfileDialog).
 */
export function Outer({
  control,
  testID,
  children,
  fullHeight = false,
  onClose,
}: {
  control: Dialog.DialogControlProps
  testID?: string
  children: React.ReactNode
  /** Native: open at full height (long lists, text fields that need room). */
  fullHeight?: boolean
  onClose?: () => void
}) {
  const discardControl = Prompt.usePromptControl()
  const [isDirty, setIsDirty] = useState(false)
  useWorkAtStake(isDirty)
  const {gtMobile} = useBreakpoints()
  /* Bluesky's dialog padding: 24 on wide web, 20 elsewhere. */
  const inset = IS_WEB && gtMobile ? a.px_2xl : a.px_xl
  const requestClose = () => {
    if (isDirty) discardControl.open()
    else control.close()
  }

  return (
    <Dialog.Outer
      control={control}
      testID={testID}
      onClose={() => {
        setIsDirty(false)
        onClose?.()
      }}
      nativeOptions={{
        fullHeight,
        preventExpansion: !fullHeight,
        preventDismiss: isDirty,
        onAttemptDismiss: () => discardControl.open(),
      }}
      webOptions={{alignCenter: true, onBackgroundPress: requestClose}}>
      <Dialog.Handle />
      <SheetContext.Provider value={{requestClose, setIsDirty, testID, inset}}>
        {children}
      </SheetContext.Provider>
      <DiscardPrompt
        control={discardControl}
        onDiscardConfirmed={() => control.close()}
      />
    </Dialog.Outer>
  )
}

/** Bluesky's "Discard changes?" prompt, shared by every sheet. */
export function DiscardPrompt({
  control,
  description,
  onDiscardConfirmed,
}: {
  control: Prompt.PromptControlProps
  description?: string
  onDiscardConfirmed: () => void
}) {
  const {t: l} = useLingui()
  return (
    <Prompt.Basic
      control={control}
      title={l`Discard changes?`}
      description={description ?? l`What you changed here won’t be saved.`}
      confirmButtonCta={l`Discard`}
      confirmButtonColor="negative"
      cancelButtonCta={l`Keep editing`}
      onConfirm={onDiscardConfirmed}
    />
  )
}

/**
 * Whether the body has scrolled under the top bar, so the bar can show
 * Bluesky's Dialog.Header hairline only while something is underneath it.
 */
export function useIsScrolled() {
  const [isScrolled, setIsScrolled] = useState(false)
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setIsScrolled(e.nativeEvent.contentOffset.y > 0)
  return [isScrolled, onScroll] as const
}

/** Title on the left, a round grey close cross at the top right. */
export function Header({
  title,
  onClose,
  closeHint,
  isScrolled = false,
  style,
}: {
  title: string
  onClose: () => void
  /** Draws the hairline under the bar while the body is scrolled under it. */
  isScrolled?: boolean
  /** Accessibility hint of the cross (default: closes without saving). */
  closeHint?: string
  style?: StyleProp<ViewStyle>
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {inset = a.px_lg} = useFormSheet()
  return (
    <View
      testID="sheet-header"
      style={[
        a.flex_row,
        a.align_center,
        a.gap_md,
        inset,
        a.pt_md,
        a.pb_sm,
        t.atoms.bg,
        {minHeight: 56},
        a.border_b,
        isScrolled ? t.atoms.border_contrast_low : {borderColor: 'transparent'},
        style,
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

/** A line of help under the title, at the top of the sheet's body. */
export function Description({children}: {children: React.ReactNode}) {
  const t = useTheme()
  return (
    <Text
      style={[
        a.pb_lg,
        a.text_md,
        a.leading_snug,
        t.atoms.text_contrast_medium,
      ]}>
      {children}
    </Text>
  )
}

export type FooterProps = {
  onSave: () => void
  /** The primary action's words, e.g. "Save expense". */
  saveLabel: string
  canSave?: boolean
  isSaving?: boolean
  /** The secondary button's words (default "Cancel"). */
  cancelLabel?: string
  /** Default: the sheet's close request (asks first if anything changed). */
  onCancel?: () => void
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
}: FooterProps & {readout?: React.ReactNode}) {
  const t = useTheme()
  const isSheet = useIsSheet()
  const {bottom} = useSafeAreaInsets()
  const {inset = a.px_lg} = useFormSheet()

  return (
    <View
      style={[
        inset,
        a.pt_md,
        /* Web: the drawer already sits above the home indicator. */
        {paddingBottom: Math.max(IS_WEB ? 0 : bottom, isSheet ? 12 : 16)},
        a.border_t,
        t.atoms.border_contrast_low,
        t.atoms.bg,
      ]}>
      {readout}
      <Actions {...actions} />
    </View>
  )
}

/** The footer's two buttons. */
function Actions({
  onCancel,
  onSave,
  saveLabel,
  cancelLabel,
  canSave = true,
  isSaving = false,
}: FooterProps) {
  const {t: l} = useLingui()
  const {requestClose} = useFormSheet()
  const isSheet = useIsSheet()
  const size = isSheet ? 'large' : 'small'
  return (
    <View
      style={[a.flex_row, a.align_center, a.gap_sm, !isSheet && a.justify_end]}>
      <Button
        testID="sheet-cancel"
        label={cancelLabel ?? l`Cancel`}
        color="secondary"
        size={size}
        style={[isSheet && a.flex_1]}
        onPress={onCancel ?? requestClose}>
        <ButtonText maxFontSizeMultiplier={2} numberOfLines={1}>
          {cancelLabel ?? <Trans>Cancel</Trans>}
        </ButtonText>
      </Button>
      <Button
        testID="sheet-save"
        label={saveLabel}
        color="primary"
        size={size}
        disabled={!canSave || isSaving}
        style={[isSheet && a.flex_1]}
        onPress={onSave}>
        {isSaving ? (
          <Loader size="sm" />
        ) : (
          <ButtonText maxFontSizeMultiplier={2} numberOfLines={1}>{saveLabel}</ButtonText>
        )}
      </Button>
    </View>
  )
}
