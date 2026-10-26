/**
 * Stand-in for Bluesky's react-hotkeys-hook scopes. Dialogs disable the global
 * scope while open; Splito has no global web shortcuts yet, so this is a no-op.
 */
export function useHotkeysContext() {
  return {disableScope: (_scope: string) => {}, enableScope: (_scope: string) => {}}
}
