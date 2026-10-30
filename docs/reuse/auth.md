# Reuse record - auth stream (F-225)

Upstream: `bluesky-social/social-app@4e4ad9c5f5cc584bd06473ab6f16318fd0bd8465` (MIT).
Every file below starts with `// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - <upstream path>`.
Paths are relative to `apps/client/`. Icons are Lucide (ISC, `LICENSES/lucide.txt`); no Bluesky
glyphs, illustrations, logos or `assets/images` are copied (the phone splash illustration and the
Logo / Logotype / Logomark components are replaced by the Splito mark in `components/brand/Logo.tsx`).
Merge these rows into `docs/REUSE_MAP.md`.

## Copied (screen for screen, ARCHITECTURE 26.15, decision 65)

| Splito file | Upstream file | Splito changes |
|---|---|---|
| `src/screens/Login/index.tsx` | `src/screens/Login/index.tsx` | Hosting-provider service query, analytics and logged-out view state removed; the forms are the one Continue flow's steps (F-250): contact, credential, forgot, reset, updated, and for a new account verify, name, other contact, password |
| `src/screens/Login/ContinueForm.tsx` | `src/screens/Login/LoginForm.tsx`, `src/view/com/auth/SplashScreen.web.tsx` | The splash (mark, name, tagline) and LoginForm's identifier field in one screen: Apple, Google, "Email or phone", Continue; hosting-provider dialogs and 2FA removed; the dev account button (dev and e2e builds) |
| `src/screens/Login/CredentialForm.tsx` | `src/screens/Login/LoginForm.tsx` | The password field and Forgot? with a Password / Code segmented choice (owner 144); the identifier is already known from the Continue screen |
| `src/screens/Login/FormContainer.tsx` | `src/screens/Login/FormContainer.tsx` | - |
| `src/screens/Login/ForgotPasswordForm.tsx` | `src/screens/Login/ForgotPasswordForm.tsx` | The contact is known from the Continue screen; sends the code through the AuthClient |
| `src/screens/Login/SetNewPasswordForm.tsx` | `src/screens/Login/SetNewPasswordForm.tsx` | 6-digit code field instead of `TokenField`; the code is optional so a new account sets its password here too; strength meter |
| `src/screens/Login/PasswordUpdatedForm.tsx` | `src/screens/Login/PasswordUpdatedForm.tsx` | - |
| `src/screens/Login/components/AuthLayout/index.tsx` | `src/screens/Login/components/AuthLayout/index.tsx` | - |
| `src/screens/Login/components/AuthLayout/context.ts` | `src/screens/Login/components/AuthLayout/context.ts` | - |
| `src/screens/Login/components/AuthLayout/Header/index.tsx` | `src/screens/Login/components/AuthLayout/Header/index.tsx` | Splito mark instead of Logomark |
| `src/screens/Login/components/AuthLayout/Header/index.web.tsx` | `src/screens/Login/components/AuthLayout/Header/index.web.tsx` | - |
| `src/components/LoggedOutLayout.tsx` | `src/view/com/util/layouts/LoggedOutLayout.tsx` | ALF theme atoms instead of `usePalette`; fills its parent instead of `100vh` |
| `src/components/ScreenTransition.tsx` | `src/components/ScreenTransition.tsx` | Cross-fade under reduced motion |
| `src/components/forms/PasswordField.tsx` | `src/components/forms/PasswordField.tsx` | Lucide Eye, EyeOff and Lock |

## F-250 / F-249: Bluesky search (what was copied, what was written, why)

- Searched `src/view/com/auth/` (LoggedOut, SplashScreen), `src/screens/Login/`, `src/screens/Signup/`, `src/state/session/`, `src/view/com/pager/`.
- Copied and reduced to the one Continue screen: the splash look, `LoginForm`'s field and password layout, the Forgot password trio, `AuthLayout`, `LoggedOutLayout`, `ScreenTransition`, `PasswordField`. `Signup` (handle, captcha steps) is gone; its multi-step shape is the new-account steps.
- Written from scratch: the `AuthClient` interface and its dev client (Bluesky signs in to AT Protocol; Splito has its own API, F-2101); `state/session.ts` is Bluesky's `useSession()` shape on a module store (Bluesky's has agents and tokens, Splito's token joins with the credential store, ARCHITECTURE 11); the intro slides (`screens/Welcome`): Bluesky's `Pager` is a `react-native-pager-view` native module this app does not ship (a native rebuild for five slides), so the slides use Bluesky's direction-aware `ScreenTransition` and a touch swipe, with dots in place of its `TabBar`; the artwork is original.
- Expensify: `FeatureTrainingModal` / `OnboardingHeader` were read for the slide layout (title, one sentence, dots, a primary button, a skip); no code copied.
