/**
 * The guided tour's steps (F-253, owner 142/213): exactly three, only what a new user must know to start. A pure model:
 * which control each step points at, what to point at when the preferred one is not there (a new account has no friends,
 * so no FAB and no friend row), and which copy variant applies. The words live in `features/tour/copy.ts` (Lingui).
 */

/** The controls a step can spotlight; each registers itself with `useTourRef` (`registry.ts`). */
export type TourTargetId = 'fab' | 'sidebar-add' | 'add-friend' | 'friend-row' | 'friend-balance' | 'tab-groups'

export type TourStepId = 'add-expense' | 'balances' | 'settle-up'

/** `normal`: the control does what the sentence says. `empty`: nothing to show yet, so the sentence points at Add friend. */
export type TourVariant = 'normal' | 'empty'

export type TourStep = {id: TourStepId; target: TourTargetId; variant: TourVariant}

type StepDef = {
  id: TourStepId
  /** In order of preference. */
  targets: TourTargetId[]
  /** Used, with the empty wording, when none of `targets` is there. */
  fallback: TourTargetId | null
}

const STEPS: readonly StepDef[] = [
  /* The FAB on phones, the sidebar pill on rail and desktop; with no friends the FAB is held back, so Add friend stands in. */
  {id: 'add-expense', targets: ['fab', 'sidebar-add'], fallback: 'add-friend'},
  {id: 'balances', targets: ['friend-row'], fallback: 'add-friend'},
  /* The balance on the first friend row, else the Groups tab; with nothing to point at the step is left out. */
  {id: 'settle-up', targets: ['friend-balance', 'tab-groups'], fallback: null},
]

/**
 * The steps to show, given which targets are on screen right now. A step whose preferred targets are missing uses its
 * fallback with the `empty` wording; a step with neither is left out, so "Step N of M" always counts what is shown.
 */
export function planTour(has: (id: TourTargetId) => boolean): TourStep[] {
  const out: TourStep[] = []
  for (const def of STEPS) {
    const target = def.targets.find(has)
    if (target) out.push({id: def.id, target, variant: 'normal'})
    else if (def.fallback && has(def.fallback)) out.push({id: def.id, target: def.fallback, variant: 'empty'})
  }
  return out
}

/** How a target's cut-out is rounded: a circle or pill follows its own size, a row gets a fixed corner. */
export const TARGET_SHAPE: Record<TourTargetId, 'round' | 'rect'> = {
  fab: 'round',
  'sidebar-add': 'round',
  'add-friend': 'round',
  'friend-row': 'rect',
  'friend-balance': 'rect',
  'tab-groups': 'rect',
}
