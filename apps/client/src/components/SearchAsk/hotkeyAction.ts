/**
 * What a key press does to the Search & Ask drawer (ARCHITECTURE 26.3,
 * decision 75): Cmd+K (Ctrl+K off Apple) toggles it from anywhere, even
 * while typing; "/" opens it when focus is not in a text field.
 */
export function searchAskKeyAction({
  key,
  metaKey,
  ctrlKey,
  altKey,
  shiftKey,
  isEditable,
  isOpen,
}: {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  /** Focus is in an input, textarea or contenteditable. */
  isEditable: boolean
  isOpen: boolean
}): 'toggle' | 'open' | null {
  if (
    key.toLowerCase() === 'k' &&
    (metaKey || ctrlKey) &&
    !altKey &&
    !shiftKey
  ) {
    return 'toggle'
  }
  if (
    key === '/' &&
    !metaKey &&
    !ctrlKey &&
    !altKey &&
    !isEditable &&
    !isOpen
  ) {
    return 'open'
  }
  return null
}

/** The shortcut as the platform writes it: "⌘K" on Apple, "Ctrl K" elsewhere. */
export function shortcutHint(platform: string) {
  return /mac|iphone|ipad|ipod/i.test(platform) ? '⌘K' : 'Ctrl K'
}
