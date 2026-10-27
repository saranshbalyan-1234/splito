// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Signup/state.ts
import {createContext, useContext} from 'react'

/*
 * Bluesky's steps are Info, Handle and Captcha. Splito drops the last two
 * (no handles, no captcha), so Create account is one step today; the reducer
 * and the step indicator keep Bluesky's shape for the verification-code step
 * the auth backend will add.
 */
export enum SignupStep {
  INFO,
}

export const SIGNUP_STEPS = [SignupStep.INFO] as const

type ErrorField = 'name' | 'identifier' | 'password'

export type SignupState = {
  activeStep: SignupStep
  screenTransitionDirection: 'Forward' | 'Backward'

  name: string
  /** An email address or a phone number, as typed. */
  identifier: string
  password: string

  error: string
  errorField?: ErrorField
  /** Set once every field passes: the honest "arrives with sync" answer. */
  isNotLive: boolean
}

export type SignupAction =
  | {type: 'prev'}
  | {type: 'next'}
  | {type: 'setName'; value: string}
  | {type: 'setIdentifier'; value: string}
  | {type: 'setPassword'; value: string}
  | {type: 'setError'; value: string; field?: ErrorField}
  | {type: 'clearError'}
  | {type: 'finish'}

export const initialState: SignupState = {
  activeStep: SignupStep.INFO,
  screenTransitionDirection: 'Forward',

  name: '',
  identifier: '',
  password: '',

  error: '',
  errorField: undefined,
  isNotLive: false,
}

export function reducer(s: SignupState, a: SignupAction): SignupState {
  const next = {...s}

  switch (a.type) {
    case 'prev': {
      if (s.activeStep !== SIGNUP_STEPS[0]) {
        next.screenTransitionDirection = 'Backward'
        next.activeStep--
        next.error = ''
        next.errorField = undefined
      }
      break
    }
    case 'next': {
      if (s.activeStep !== SIGNUP_STEPS[SIGNUP_STEPS.length - 1]) {
        next.screenTransitionDirection = 'Forward'
        next.activeStep++
        next.error = ''
        next.errorField = undefined
      }
      break
    }
    case 'setName': {
      next.name = a.value
      next.isNotLive = false
      break
    }
    case 'setIdentifier': {
      next.identifier = a.value
      next.isNotLive = false
      break
    }
    case 'setPassword': {
      next.password = a.value
      next.isNotLive = false
      break
    }
    case 'setError': {
      next.error = a.value
      next.errorField = a.field
      next.isNotLive = false
      break
    }
    case 'clearError': {
      next.error = ''
      next.errorField = undefined
      break
    }
    case 'finish': {
      next.error = ''
      next.errorField = undefined
      next.isNotLive = true
      break
    }
  }

  return next
}

export const SignupContext = createContext<{
  state: SignupState
  dispatch: React.ActionDispatch<[SignupAction]>
}>({} as never)
SignupContext.displayName = 'SignupContext'

export const useSignupContext = () => useContext(SignupContext)
