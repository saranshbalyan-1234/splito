/** Native shows no keyboard hint. */
export const SHORTCUT_HINT: string | undefined = undefined

/*
 * ponytail: no Cmd/Ctrl+K on iPad / Android hardware keyboards yet. React
 * Native 0.88 has no app-wide key events (View key events sit behind the
 * off-by-default `enableKeyEvents` flag, Android only), so it needs a
 * key-command native module through ARCHITECTURE § 2's native-module gate.
 */
export function useSearchAskHotkey(_: {
  onToggle: () => void
  onOpen: () => void
  isOpen: () => boolean
}) {}
