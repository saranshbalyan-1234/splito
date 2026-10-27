// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/components/EmojiPicker/preload.ts
/**
 * Native no-op. Emoji data preloading is only needed on web where the picker
 * uses `emoji-mart`; phones use the system keyboard's emoji.
 */
export function useWebPreloadEmoji({}: {immediate?: boolean} = {}) {
  return () => Promise.resolve()
}
