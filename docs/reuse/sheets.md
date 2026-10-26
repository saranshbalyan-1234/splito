# Reuse record - form sheets (owner rule 7)

Upstream: `bluesky-social/social-app@4e4ad9c5f5cc584bd06473ab6f16318fd0bd8465` (MIT).
Every adapted file starts with `// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - <upstream path>`.
Paths are relative to `apps/client/`. The close cross is Lucide `X` (ISC) through `createIcon`;
no Bluesky glyphs, illustrations, logos or `assets/images` are copied. No new dependency
(`react-native-keyboard-controller` was already installed; its provider is now mounted).

| Splito file | Upstream file | Splito changes |
|---|---|---|
| `src/components/FormSheet/shared.tsx` | `src/screens/Profile/Header/EditProfileDialog.tsx` (dirty close: `preventDismiss`, `onBackgroundPress`, "Discard changes?" `Prompt.Basic`), `src/components/Dialog/shared.tsx` (header bar and its `border_b` hairline, shown here only while the body is scrolled under it) | One `Outer` for every sheet built on `#/components/Dialog`; the form reports `isDirty`, then the cross, Cancel, scrim, Escape and swipe ask "Discard changes?"; title on the left and a round grey cross (`sheet-close`) on the right instead of Bluesky's centred title with text buttons; footer with Cancel (`sheet-cancel`) and the primary action (`sheet-save`), side by side on phones, bottom right on wide web; a readout slot above the footer |
| `src/components/FormSheet/index.tsx` | `src/components/Dialog/index.tsx` (`FlatListFooter` keyboard offset) | Native `Inner` on `Dialog.ScrollableInner`: header as its sticky header, footer kept above the iOS keyboard with the same `useReanimatedKeyboardAnimation` offset |
| `src/components/FormSheet/index.web.tsx` | - (composes `Dialog.Inner`) | Web `Inner`: Bluesky's dialog centred in the window; on phone widths pinned to the bottom edge as a sheet; Escape routed through the dirty check by re-providing the dialog context |
| `src/components/FormSheet/Screen.tsx` | `src/view/com/composer/Composer.tsx` (`KeyboardAvoidingView` from react-native-keyboard-controller, `useKeyboardVerticalOffset`) | The same top bar, footer and discard prompt for route sheets (Add / Edit expense, Add friend, New group); native swipe-down and Back go through React Navigation's `usePreventRemove` |
| `modules/bottom-sheet/ios/*`, `modules/bottom-sheet/android/*` | `modules/bottom-sheet/ios/*`, `modules/bottom-sheet/android/*` | Verbatim (header line added). The JS side was copied earlier without its native code, so every Dialog on iOS/Android threw "Cannot find native module 'BottomSheet'" |
| `src/components/Composer/index.web.tsx` | `src/view/shell/Composer.web.tsx` | Centred like Bluesky's dialogs instead of 50px from the top; a sheet from the bottom edge on phone widths instead of full screen; a click that starts and ends on the scrim asks to close |
| `src/App.tsx` | `src/App.tsx` | `KeyboardControllerProvider preload={false}` mounted as upstream |
| `public/index.html` | `src/style.css` | Keyframes for the ALF animation atoms (`fadeIn`, `fadeOut`, `zoomIn`, `slideInLeft`, `slideOutLeft`), missing until now so web dialogs never animated; plus Splito's `slideInUp` for phone sheets |
| `src/components/settings/OptionDialog.tsx` | `src/components/dialogs/LanguageSelectDialog.tsx` | Title row is the shared sheet header (cross on native too); phone-width web shows it as a bottom sheet |

Written without an upstream equivalent (Bluesky has no such screens), following the dialogs above:
`src/components/groups/EditGroupDialog.tsx`, `src/components/groups/GroupFields.tsx` (fields moved out
of `src/screens/CreateGroup.tsx`), `RulesDialog` in `src/components/groups/RulesEditor.tsx`, the accent
sheet in `src/components/settings/AccentPicker.tsx`, and `updateGroup` in `packages/sync`.
