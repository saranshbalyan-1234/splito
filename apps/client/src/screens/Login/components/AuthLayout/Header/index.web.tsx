// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Login/components/AuthLayout/Header/index.web.tsx
import {type ButtonProps} from '#/components/Button'
import {Header} from '#/components/Layout'

// Web has no auth header: its Back lives in each form's footer (Bluesky).

export const Slot = Header.Slot

export function Outer({}: {children: React.ReactNode}) {
  return null
}

export function Content({}: {children?: React.ReactNode}) {
  return null
}

export function Logo() {
  return null
}

export function BackButton({}: Partial<ButtonProps>) {
  return null
}
