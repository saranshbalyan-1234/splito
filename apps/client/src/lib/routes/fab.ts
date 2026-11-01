/** The FAB's route allow-list (owner 190, § 26.6): where you would add an expense, with what Add expense pre-selects. */
const TAB_ROUTES = ['People', 'Groups', 'Analytics', 'Activity']

/**
 * The params of the Add expense the FAB opens on this route, or null when the route has no FAB. Shown: the five main
 * screens and their pushed copies (the same screen with Back, so the same FAB), the Person page (pre-selects that
 * friend) and the Group page (that group). Everything else, Profile (which holds Settings, owner 220) and the Settings sections, Expense and payment
 * detail, forms and the composer, has none. One list, read by `RouteFAB` in the screen scaffold; no screen decides alone.
 */
export function fabParams(route: {name: string; params?: object}): {personId?: string; groupId?: string} | null {
  const params = (route.params ?? {}) as Record<string, string | undefined>
  const name = route.name.startsWith('Pushed') ? route.name.slice('Pushed'.length) : route.name
  if (TAB_ROUTES.includes(name)) return {}
  if (route.name === 'Person' && params.personId) return {personId: params.personId}
  if (route.name === 'Group' && params.groupId) return {groupId: params.groupId}
  return null
}
