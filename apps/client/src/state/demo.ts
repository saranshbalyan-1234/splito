/**
 * Whether dev and e2e demo mode is showing, and the switch (ARCHITECTURE 26.1).
 * Always off and inert in production builds. Lives here so `components/` and
 * `lib/` can ask without importing `data/`.
 */
export {useDemoMode} from '#/data/hooks'
