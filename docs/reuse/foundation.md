# Reuse record - foundation stream

The client foundation (ALF, Dialog, Menu, Toast, Layout, forms, env, haptics, list utilities) was copied from
`bluesky-social/social-app@4e4ad9c5f5cc584bd06473ab6f16318fd0bd8465` (MIT) before the per-stream reuse files
existed. These rows were recorded on 2026-10-26 from each file's attribution header, so the architecture test
(`apps/client/src/architecture`, rule `attribution`) can check every adapted file has a row. Paths are relative
to `apps/client/`. Splito's changes to each file are in its git history; none copies Bluesky icon glyphs,
illustrations, logos or `assets/images`.

## Copied files

| Splito file | Upstream file | Upstream |
|---|---|---|
| `src/alf/atoms.ts` | `src/alf/atoms.ts` | bluesky-social/social-app@4e4ad9c |
| `src/alf/breakpoints.native.ts` | `src/alf/breakpoints.native.ts` | bluesky-social/social-app@4e4ad9c |
| `src/alf/fonts.ts` | `src/alf/fonts.ts` | bluesky-social/social-app@4e4ad9c |
| `src/alf/index.tsx` | `src/alf/index.tsx` | bluesky-social/social-app@4e4ad9c |
| `src/alf/tokens.ts` | `src/alf/tokens.ts` | bluesky-social/social-app@4e4ad9c |
| `src/alf/typography.tsx` | `src/alf/typography.tsx` | bluesky-social/social-app@4e4ad9c |
| `src/alf/util/flatten.ts` | `src/alf/util/flatten.ts` | bluesky-social/social-app@4e4ad9c |
| `src/alf/util/platform.ts` | `src/alf/util/platform.ts` | bluesky-social/social-app@4e4ad9c |
| `src/alf/util/themeSelector.ts` | `src/alf/util/themeSelector.ts` | bluesky-social/social-app@4e4ad9c |
| `src/alf/util/unusedUseFonts.android.ts` | `src/alf/util/unusedUseFonts.android.ts` | bluesky-social/social-app@4e4ad9c |
| `src/alf/util/unusedUseFonts.ts` | `src/alf/util/unusedUseFonts.ts` | bluesky-social/social-app@4e4ad9c |
| `src/alf/util/useColorModeTheme.ts` | `src/alf/util/useColorModeTheme.ts` | bluesky-social/social-app@4e4ad9c |
| `src/alf/util/useGutters.ts` | `src/alf/util/useGutters.ts` | bluesky-social/social-app@4e4ad9c |
| `src/components/Button.tsx` | `src/components/Button.tsx` | bluesky-social/social-app@4e4ad9c |
| `src/components/Dialog/context.ts` | `src/components/Dialog/context.ts` | bluesky-social/social-app@4e4ad9c |
| `src/components/Dialog/index.web.tsx` | `src/components/Dialog/index.web.tsx` | bluesky-social/social-app@4e4ad9c |
| `src/components/Dialog/sheetSizing.ts` | `src/components/Dialog/sheetSizing.ts` | bluesky-social/social-app@4e4ad9c |
| `src/components/Dialog/sourceViewTag.ts` | `src/components/Dialog/sourceViewTag.ts` | bluesky-social/social-app@4e4ad9c |
| `src/components/Dialog/types.ts` | `src/components/Dialog/types.ts` | bluesky-social/social-app@4e4ad9c |
| `src/components/Dialog/utils.ts` | `src/components/Dialog/utils.ts` | bluesky-social/social-app@4e4ad9c |
| `src/components/Divider.tsx` | `src/components/Divider.tsx` | bluesky-social/social-app@4e4ad9c |
| `src/components/Layout/const.ts` | `src/components/Layout/const.ts` | bluesky-social/social-app@4e4ad9c |
| `src/components/Layout/context.ts` | `src/components/Layout/context.ts` | bluesky-social/social-app@4e4ad9c |
| `src/components/Loader.tsx` | `src/components/Loader.tsx` | bluesky-social/social-app@4e4ad9c |
| `src/components/Loader.web.tsx` | `src/components/Loader.web.tsx` | bluesky-social/social-app@4e4ad9c |
| `src/components/Menu/context.tsx` | `src/components/Menu/context.tsx` | bluesky-social/social-app@4e4ad9c |
| `src/components/Menu/index.tsx` | `src/components/Menu/index.tsx` | bluesky-social/social-app@4e4ad9c |
| `src/components/Menu/index.web.tsx` | `src/components/Menu/index.web.tsx` | bluesky-social/social-app@4e4ad9c |
| `src/components/Menu/sourceViewTag.ts` | `src/components/Menu/sourceViewTag.ts` | bluesky-social/social-app@4e4ad9c |
| `src/components/Menu/types.ts` | `src/components/Menu/types.ts` | bluesky-social/social-app@4e4ad9c |
| `src/components/Portal.tsx` | `src/components/Portal.tsx` | bluesky-social/social-app@4e4ad9c |
| `src/components/Pressable.tsx` | `src/components/Pressable.tsx` | bluesky-social/social-app@4e4ad9c |
| `src/components/Prompt.tsx` | `src/components/Prompt.tsx` | bluesky-social/social-app@4e4ad9c |
| `src/components/Skeleton.tsx` | `src/components/Skeleton.tsx` | bluesky-social/social-app@4e4ad9c |
| `src/components/Toast/Toast.tsx` | `src/components/Toast/Toast.tsx` | bluesky-social/social-app@4e4ad9c |
| `src/components/Toast/const.ts` | `src/components/Toast/const.ts` | bluesky-social/social-app@4e4ad9c |
| `src/components/Toast/index.tsx` | `src/components/Toast/index.tsx` | bluesky-social/social-app@4e4ad9c |
| `src/components/Toast/index.web.tsx` | `src/components/Toast/index.web.tsx` | bluesky-social/social-app@4e4ad9c |
| `src/components/Toast/sonner/index.ts` | `src/components/Toast/sonner/index.ts` | bluesky-social/social-app@4e4ad9c |
| `src/components/Toast/sonner/index.web.ts` | `src/components/Toast/sonner/index.web.ts` | bluesky-social/social-app@4e4ad9c |
| `src/components/Toast/types.ts` | `src/components/Toast/types.ts` | bluesky-social/social-app@4e4ad9c |
| `src/components/Typography.tsx` | `src/components/Typography.tsx` | bluesky-social/social-app@4e4ad9c |
| `src/components/forms/TextField.tsx` | `src/components/forms/TextField.tsx` | bluesky-social/social-app@4e4ad9c |
| `src/components/forms/Toggle/Panel.tsx` | `src/components/forms/Toggle/Panel.tsx` | bluesky-social/social-app@4e4ad9c |
| `src/components/forms/Toggle/index.tsx` | `src/components/forms/Toggle/index.tsx` | bluesky-social/social-app@4e4ad9c |
| `src/components/hooks/useInteractionState.ts` | `src/components/hooks/useInteractionState.ts` | bluesky-social/social-app@4e4ad9c |
| `src/components/hooks/useOnKeyboard.ts` | `src/components/hooks/useOnKeyboard.ts` | bluesky-social/social-app@4e4ad9c |
| `src/components/icons/common.tsx` | `src/components/icons/common.tsx` | bluesky-social/social-app@4e4ad9c |
| `src/env/common.ts` | `src/env/common.ts` | bluesky-social/social-app@4e4ad9c |
| `src/env/index.ts` | `src/env/index.ts` | bluesky-social/social-app@4e4ad9c |
| `src/env/index.web.ts` | `src/env/index.web.ts` | bluesky-social/social-app@4e4ad9c |
| `src/lib/ScrollContext.tsx` | `src/lib/ScrollContext.tsx` | bluesky-social/social-app@4e4ad9c |
| `src/lib/batchedUpdates.ts` | `src/lib/batchedUpdates.ts` | bluesky-social/social-app@4e4ad9c |
| `src/lib/batchedUpdates.web.ts` | `src/lib/batchedUpdates.web.ts` | bluesky-social/social-app@4e4ad9c |
| `src/lib/haptics/android.ts` | `src/lib/haptics/android.ts` | bluesky-social/social-app@4e4ad9c |
| `src/lib/haptics/index.ts` | `src/lib/haptics/index.ts` | bluesky-social/social-app@4e4ad9c |
| `src/lib/hooks/useNonReactiveCallback.ts` | `src/lib/hooks/useNonReactiveCallback.ts` | bluesky-social/social-app@4e4ad9c |
| `src/lib/merge-refs.ts` | `src/lib/merge-refs.ts` | bluesky-social/social-app@4e4ad9c |
| `src/lib/styles.ts` | `src/lib/styles.ts` | bluesky-social/social-app@4e4ad9c |
| `src/locale/i18n.web.ts` | `src/locale/i18n.web.ts` | bluesky-social/social-app@4e4ad9c |
| `src/motion/Illustration/index.tsx` | `src/components/Lottie/index.tsx` | Expensify/App@a60491f |
| `src/motion/Illustration/index.web.tsx` | `src/components/Lottie/index.tsx` | Expensify/App@a60491f |
| `src/motion/PressableScale.tsx` | `src/lib/custom-animations/PressableScale.tsx` | bluesky-social/social-app@4e4ad9c |
| `src/state/a11y.tsx` | `src/state/a11y.tsx` | bluesky-social/social-app@4e4ad9c |
| `src/state/dialogs/index.tsx` | `src/state/dialogs/index.tsx` | bluesky-social/social-app@4e4ad9c |
| `src/state/shell/shell-layout.tsx` | `src/state/shell/shell-layout.tsx` | bluesky-social/social-app@4e4ad9c |
| `src/storage/index.ts` | `src/storage/index.ts` | bluesky-social/social-app@4e4ad9c |
| `src/view/com/util/List.tsx` | `src/view/com/util/List.tsx` | bluesky-social/social-app@4e4ad9c |
| `src/view/com/util/List.web.tsx` | `src/view/com/util/List.web.tsx` | bluesky-social/social-app@4e4ad9c |
| `src/view/com/util/Views.tsx` | `src/view/com/util/Views.tsx` | bluesky-social/social-app@4e4ad9c |

## Copied files added later without a row

| Splito file | Upstream file | Upstream |
|---|---|---|
| `src/view/shell/desktop/RecentTransactions.tsx` | `src/view/shell/desktop/Feeds.tsx` (row and "More feeds" link styling) | bluesky-social/social-app@4e4ad9c |
