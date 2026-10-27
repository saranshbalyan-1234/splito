// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Login/components/AuthLayout/context.ts
import {createContext} from 'react'

export const AuthLayoutNavigationContext = createContext<{
  goBack: () => void
} | null>(null)
