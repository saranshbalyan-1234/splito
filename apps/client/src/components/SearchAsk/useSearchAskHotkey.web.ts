// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/components/Lightbox/Lightbox.web.tsx (window keydown listener)
import {useEffect} from 'react'

import {searchAskKeyAction, shortcutHint} from './hotkeyAction'

/** "⌘K" on Apple devices, "Ctrl K" elsewhere, for the button tooltip and the input. */
export const SHORTCUT_HINT: string | undefined =
  typeof navigator === 'undefined'
    ? undefined
    : shortcutHint(navigator.platform)

/**
 * Cmd/Ctrl+K toggles the Search & Ask drawer from anywhere and "/" opens it
 * (decision 75). Listens on the window, as Bluesky's lightbox does, so it
 * works whatever has focus, the drawer's own input included.
 */
export function useSearchAskHotkey({
  onToggle,
  onOpen,
  isOpen,
}: {
  onToggle: () => void
  onOpen: () => void
  isOpen: () => boolean
}) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.isComposing) return
      const target = e.target as HTMLElement | null
      const action = searchAskKeyAction({
        key: e.key,
        metaKey: e.metaKey,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        shiftKey: e.shiftKey,
        isEditable:
          !!target &&
          (target.isContentEditable ||
            /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)),
        isOpen: isOpen(),
      })
      if (!action) return
      // Browsers put Ctrl+K in the address bar; this one is ours.
      e.preventDefault()
      if (action === 'toggle') onToggle()
      else onOpen()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onToggle, onOpen, isOpen])
}
