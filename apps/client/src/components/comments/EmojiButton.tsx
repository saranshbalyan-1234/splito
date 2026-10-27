/** Phones use the system keyboard's emoji; only the web composer has a picker (see EmojiButton.web.tsx). */
export function EmojiButton(_props: {
  onPick: (emoji: string) => void
  onClosed: () => void
}): React.ReactNode {
  return null
}
