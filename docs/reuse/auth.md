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
| `src/screens/LoggedOut/index.tsx` | `src/view/com/auth/LoggedOut.tsx` | Placed under `screens/` (no new `view/` files); only splash, Login and Signup states; accounts, starter-pack and group-chat landing removed; the close button is always shown (the flow is optional) |
| `src/screens/LoggedOut/SplashScreen.tsx` | `src/view/com/auth/NativeSplashScreen.tsx` | Illustration, blur and Logotype dropped; Splito mark, name, tagline and the two buttons; offline-first note |
| `src/screens/LoggedOut/SplashScreen.web.tsx` | `src/view/com/auth/SplashScreen.web.tsx` | Splito mark, name and tagline; footer links and language dropdown replaced by the offline-first note; App Clip overlay removed |
| `src/screens/Login/index.tsx` | `src/screens/Login/index.tsx` | Hosting-provider service query, analytics and logged-out view state removed; accounts come from `useSession()` |
| `src/screens/Login/FormContainer.tsx` | `src/screens/Login/FormContainer.tsx` | - |
| `src/screens/Login/LoginForm.tsx` | `src/screens/Login/LoginForm.tsx` | "Email or phone" in place of the handle field (validated with `parseContact`); hosting-provider dialogs and 2FA removed; Next shows the honest "arrives with sync" Admonition |
| `src/screens/Login/ChooseAccountForm.tsx` | `src/screens/Login/ChooseAccountForm.tsx`, `src/components/AccountList.tsx` | The account list is inline; picking an account fills the form (no sessions to resume) |
| `src/screens/Login/ForgotPasswordForm.tsx` | `src/screens/Login/ForgotPasswordForm.tsx` | Email or phone instead of email plus hosting provider; no request is sent |
| `src/screens/Login/SetNewPasswordForm.tsx` | `src/screens/Login/SetNewPasswordForm.tsx` | 6-digit code field instead of `TokenField`; no reset is performed |
| `src/screens/Login/PasswordUpdatedForm.tsx` | `src/screens/Login/PasswordUpdatedForm.tsx` | - (reached only once a reset can succeed) |
| `src/screens/Login/components/AuthLayout/index.tsx` | `src/screens/Login/components/AuthLayout/index.tsx` | - |
| `src/screens/Login/components/AuthLayout/context.ts` | `src/screens/Login/components/AuthLayout/context.ts` | - |
| `src/screens/Login/components/AuthLayout/Header/index.tsx` | `src/screens/Login/components/AuthLayout/Header/index.tsx` | Splito mark instead of Logomark |
| `src/screens/Login/components/AuthLayout/Header/index.web.tsx` | `src/screens/Login/components/AuthLayout/Header/index.web.tsx` | - |
| `src/screens/Signup/index.tsx` | `src/screens/Signup/index.tsx` | Handle and captcha steps, service query, starter-pack card, device attestation and support footer removed; the step indicator shows once there is more than one step |
| `src/screens/Signup/state.ts` | `src/screens/Signup/state.ts` | One step (Info); fields are name, email or phone, password; no service, analytics or submit task |
| `src/screens/Signup/BackNextButtons.tsx` | `src/screens/Signup/BackNextButtons.tsx` | Retry, loading and hide-next props removed (unused) |
| `src/screens/Signup/StepInfo/index.tsx` | `src/screens/Signup/StepInfo/index.tsx` | Name, email or phone, password; invite code, birth date, age assurance, hosting provider and policies removed; validation codes from `validate.ts` |
| `src/components/LoggedOutLayout.tsx` | `src/view/com/util/layouts/LoggedOutLayout.tsx` | ALF theme atoms instead of `usePalette`; fills its parent instead of `100vh` |
| `src/components/ScreenTransition.tsx` | `src/components/ScreenTransition.tsx` | Cross-fade under reduced motion |
| `src/components/forms/PasswordField.tsx` | `src/components/forms/PasswordField.tsx` | Lucide Eye, EyeOff and Lock |
