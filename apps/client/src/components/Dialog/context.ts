// Adapted from bluesky-social/social-app@4e4ad9c (MIT) — src/components/Dialog/context.ts
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import {BottomSheetSnapPoint} from '@bsky.app/bottom-sheet/src/BottomSheet.types'
import {NavigationRouteContext} from '@react-navigation/native'

import {isGlobalSheet} from '#/lib/links/table'
import {
  canPushSheet,
  closeSheetMarkers,
  donePending,
  markerFor,
  openSheetMarkers,
  ownerOf,
  peekPending,
  sheetsVersion,
  subscribeSheets,
} from '#/navigation/sheets'
import {useDialogStateContext} from '#/state/dialogs'
import {
  type DialogContextProps,
  type DialogControlOpenOptions,
  type DialogControlRefProps,
  type DialogOuterProps,
  type SheetOwner,
} from '#/components/Dialog/types'
import {IS_DEV, IS_WEB} from '#/env'

export const Context = createContext<DialogContextProps>({
  close: () => {},
  isNativeDialog: false,
  availableWidth: undefined,
  presentationBottomOffset: 0,
  isNativePopover: false,
  nativeSnapPoint: BottomSheetSnapPoint.Hidden,
  disableDrag: false,
  setDisableDrag: () => {},
  isWithinDialog: false,
  isHeightConstrained: false,
  shouldMeasureContentHeight: false,
  setDesiredContentHeight: () => {},
})
Context.displayName = 'DialogContext'

export function useDialogContext() {
  return useContext(Context)
}

/** What a control with a `url` takes besides the sheet's path (F-241). */
export type DialogControlSettings = {
  /** The sheet's path under its page (`record-payment/currency`); see `#/lib/links/table`. */
  url?: string
  /**
   * Prepares the host for a sheet the address opened (a draft, a target) and opens it by calling `control.open()`.
   * Returns `'wait'` while the host's data is not ready (it renders again when it is), `false` when the host
   * cannot show it (the friend or group is not on this device, nothing to settle): the address is then taken off
   * the stack and the page shows alone. Anything else means it opened.
   */
  onUrlOpen?: (query: Record<string, string>) => unknown
  /** Reads the sheet's own query (`q`, `mode`) from an address that opens it, then the sheet opens as usual. */
  onUrlQuery?: (query: Record<string, string>) => void
}

/** The page a dialog's content was rendered for: portals lose React context, so the dialog hands it down. */
export const SheetOwnerContext = createContext<SheetOwner | undefined>(undefined)
SheetOwnerContext.displayName = 'SheetOwnerContext'

const noSubscribe = () => () => {}
const never = () => 0
/** A sheet that never opened on its own (its dialog is not mounted) is given up on after this long. */
const GIVE_UP_MS = 3000

export function useDialogControl(settings?: DialogControlSettings): DialogOuterProps['control'] {
  const id = useId()
  const control = useRef<DialogControlRefProps>({
    open: () => {},
    close: () => {},
  })
  const {activeDialogs} = useDialogStateContext()

  useEffect(() => {
    activeDialogs.current.set(id, control)
    return () => {
      activeDialogs.current.delete(id)
    }
  }, [id, activeDialogs])

  const url = settings?.url
  const chain = useMemo(() => (url ? url.split('/') : null), [url])
  const route = useContext(NavigationRouteContext)
  const parentOwner = useContext(SheetOwnerContext)
  const owner: SheetOwner = chain && !isGlobalSheet(chain) ? (parentOwner ?? (route ? ownerOf(route) : null)) : null
  /*
   * Read through the store, so React Compiler cannot cache the lookup between renders. Web follows the markers in
   * the stack; a phone only needs a nudge when a link queues a sheet.
   */
  const marker = useSyncExternalStore(IS_WEB ? subscribeSheets : noSubscribe, () => (chain && IS_WEB ? markerFor(owner, chain) : undefined))
  useSyncExternalStore(IS_WEB ? noSubscribe : subscribeSheets, IS_WEB ? never : sheetsVersion)
  const isUrlOpen = !!marker

  /* Everything the control's functions read lives here, so they stay one object across renders. */
  const live = useRef({owner, isUrlOpen})
  useEffect(() => {
    live.current = {owner, isUrlOpen}
  })
  const isOpen = useRef(false)
  const closedByUi = useRef(false)
  /* Opened without an address (a page further down the stack, no page, or a sheet the table does not list here). */
  const isPlain = useRef(false)
  const isDeclined = useRef(false)
  const hostOptions = useRef<DialogControlOpenOptions | null>(null)
  const giveUp = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [, setTick] = useState(0)

  useEffect(() => () => clearTimeout(giveUp.current), [])

  /* The address and the dialog agree: a marker opens it, the marker going (browser Back) closes it. */
  useEffect(() => {
    if (!chain) return
    const decline = () => {
      isDeclined.current = true
      clearTimeout(giveUp.current)
      giveUp.current = undefined
      if (IS_WEB) closeSheetMarkers(live.current.owner, chain)
      else donePending()
    }
    /* Opens the dialog for an address; reports whether to stop trying. */
    const attempt = (query: Record<string, string>, options: DialogControlOpenOptions | null) => {
      let result: unknown
      if (options) control.current.open(options)
      else if (settings?.onUrlOpen) result = settings.onUrlOpen(query)
      else {
        settings?.onUrlQuery?.(query)
        control.current.open()
      }
      if (isOpen.current) {
        clearTimeout(giveUp.current)
        giveUp.current = undefined
      } else if (result === false) decline()
      else if (result === 'wait') {
        clearTimeout(giveUp.current)
        giveUp.current = undefined
      } else if (!giveUp.current) {
        /* The dialog is not mounted yet: it tells us when it is (`notifyMounted`). If it never is, give up once. */
        giveUp.current = setTimeout(() => {
          giveUp.current = undefined
          if (!isOpen.current) decline()
        }, GIVE_UP_MS)
      }
    }
    if (!IS_WEB) {
      if (isOpen.current) return
      const query = peekPending(owner, chain)
      if (query) attempt(query, null)
      return
    }
    if (isUrlOpen) {
      if (isOpen.current || closedByUi.current || isDeclined.current) return
      const options = hostOptions.current
      hostOptions.current = null
      attempt(marker?.query ?? {}, options)
    } else {
      closedByUi.current = false
      isDeclined.current = false
      clearTimeout(giveUp.current)
      giveUp.current = undefined
      if (isOpen.current && !isPlain.current) control.current.close()
    }
  })

  return useMemo<DialogOuterProps['control']>(
    () => ({
      id,
      ref: control,
      url: chain
        ? {
            get owner() {
              return live.current.owner
            },
            notifyOpen: () => {
              isOpen.current = true
              /* A phone's held sheet is consumed here, when its dialog has actually opened. */
              if (!IS_WEB && peekPending(live.current.owner, chain)) donePending()
            },
            notifyClosed: () => {
              isOpen.current = false
              isPlain.current = false
              /* Closed from inside (X, Cancel, Save, the scrim): take its address off the stack. */
              if (IS_WEB && live.current.isUrlOpen) {
                closedByUi.current = true
                closeSheetMarkers(live.current.owner, chain)
              }
            },
            notifyMounted: () => {
              if (giveUp.current || (!IS_WEB && peekPending(live.current.owner, chain))) setTick(n => n + 1)
            },
          }
        : undefined,
      open: options => {
        if (chain && IS_WEB && !live.current.isUrlOpen && !isOpen.current) {
          if (canPushSheet(live.current.owner, chain)) {
            /* Push the address; the effect above opens the dialog once the stack has it. */
            hostOptions.current = options ?? {}
            openSheetMarkers(live.current.owner, chain, options?.urlQuery)
            return
          }
          isPlain.current = true
        }
        if (control.current) {
          control.current.open(options)
        } else {
          if (IS_DEV) {
            console.warn(
              'Attemped to open a dialog control that was not attached to a dialog!\n' +
                'Please ensure that the Dialog is mounted when calling open/close',
            )
          }
        }
      },
      close: cb => {
        if (control.current) {
          control.current.close(cb)
        } else {
          if (IS_DEV) {
            console.warn(
              'Attemped to close a dialog control that was not attached to a dialog!\n' +
                'Please ensure that the Dialog is mounted when calling open/close',
            )
          }
        }
      },
    }),
    [id, control, chain],
  )
}
