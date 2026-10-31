/** The keyboard's own "context menu" gestures: the ContextMenu key and Shift+F10. */
export function isContextMenuKey(e: {key: string; shiftKey: boolean}) {
  return e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')
}
