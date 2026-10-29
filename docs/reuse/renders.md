# Reuse record - wasted-render gate (F-242, owner 108)

No upstream code is copied. One new dev dependency and our own glue.

## Library decision

| Question | Answer |
|---|---|
| Package | `@welldone-software/why-did-you-render` **10.0.1**, exact pin, `devDependencies` of `apps/client` (MIT; pulls `lodash`) |
| React 19.3 | Peer `react ^19`; its `getCurrentOwner` reads `__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE.A.getOwner()`, which React 19.3 still has. Verified by running it: owners and hook results arrive. |
| React Compiler | Works. The compiler leaves JSX alone, so the library's `jsx-dev-runtime` (set with `jsxImportSource` in `babel.config.js`, dev callers only) wraps every element, compiled or not. Hooks are tracked by patching `React.useState` / `useReducer` / `useContext` / `useSyncExternalStore`. Compiled components skip child renders by caching JSX, so most reports left are library internals. |
| Fallback (§ 17) | Not needed. The render counter (a DevTools-hook fiber walk, as `perf/save.spec.ts`) is kept anyway: it is what shows a component the compiler skipped, which no report does. |
| Dev only | `index.ts` / `index.web.ts`: `if (__DEV__) require('#/lib/whyDidYouRender')`. Metro folds the require out of production and `expo export`; `e2e/bundle.spec.ts` asserts the e2e bundle holds none of it. |

## Files

| Splito file | Role |
|---|---|
| `src/lib/whyDidYouRender.ts` | Starts the library (`include: [/.*/]`, hooks on), keeps a compact copy of each report on `window.__wdyr`, and applies the "a value really changed is not wasted" filter that the library applies only in its own console notifier |
| `babel.config.js` | `jsxImportSource` set when the caller is a dev build |
| `playwright.renders.config.ts`, `e2e-renders/renders.spec.ts`, `e2e-renders/baseline.json` | The gate (`pnpm --filter @splito/client renders`) |
| `e2e/bundle.spec.ts` | Production-bundle check |

## Findings worth knowing

- `expo export --dev` writes async chunks named by file with one shared hash, so `demoMode.ts` and `DemoMode.tsx`
  overwrite each other on a case-insensitive disk (macOS): a corrupt chunk and a blank app. The gate therefore uses
  the Metro dev server.
- The React Compiler skips a whole component when anything in it is unsupported. Found in the scenario's path:
  `ExpenseComposer` (computed key in a destructuring pattern; `try`/`catch` around a conditional) and `AddExpense`
  (a function used before its declaration). Others remain: `docs/COMPLETION_MATRIX.md` lists them (A-017).
