// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/components/EmojiPicker/preload.web.ts
/** Only load the emoji picker data once per page load; every caller shares the one load. */
let loading: Promise<void> | undefined

/**
 * Preloads emoji-mart data (a separate chunk) so the picker renders instantly
 * when opened. Returns the loader, so a caller can start it on focus or hover.
 * When `immediate` is `true`, loading starts on mount.
 *
 * @see {@link https://github.com/missive/emoji-mart/blob/16978d04a766eec6455e2e8bb21cd8dc0b3c7436/README.md?plain=1#L194 | emoji-mart preloading docs}
 */
function loadEmojiData(): Promise<void> {
  loading ??= (async () => {
    try {
      // Core and data are both dynamic: neither is in the main bundle.
      const [{init}, {default: data}] = await Promise.all([
        import('emoji-mart'),
        import('@emoji-mart/data'),
      ])
      init({data})
    } catch {
      loading = undefined
    }
  })()
  return loading
}

export function useWebPreloadEmoji({immediate}: {immediate?: boolean} = {}) {
  if (immediate) void loadEmojiData()
  return loadEmojiData
}
