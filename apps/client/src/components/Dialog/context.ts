// Adapted from bluesky-social/social-app@4e4ad9c (MIT) — src/components/Dialog/context.ts
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react'
import {BottomSheetSnapPoint} from '@bsky.app/bottom-sheet/src/BottomSheet.types'
import {NavigationRouteContext} from '@react-navigation/native'

import {isGlobalSheet} from '#/lib/links/table'
import {
  closeSheetMarkers,
  hasPending,
  markerFor,
  openSheetMarkers,
  ownerOf,
  sheetsVersion,
  subscribeSheets,
  takePending,
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
   * Called again each render until the sheet is open, so it may wait for data; the default just opens.
   */
  onUrlOpen?: (query: Record<string, string>) => unknown
  /** Reads the sheet's own query (`q`, `mode`) from an address that opens it, then the sheet opens as usual. */
  onUrlQuery?: (query: Record<string, string>) => void
}

/** The page a dialog's content was rendered for: portals lose React context, so the dialog hands it down. */
export const SheetOwnerContext = createContext<SheetOwner | undefined>(undefined)
SheetOwnerContext.displayName = 'SheetOwnerContext'

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
  useSyncExternalStore(subscribeSheets, sheetsVersion)

  /* Everything the control's functions read lives here, so they stay one object across renders. */
  const live = useRef({owner, isUrlOpen: false})
  const marker = chain && IS_WEB ? markerFor(owner, chain) : undefined
  const isUrlOpen = !!marker
  useEffect(() => {
    live.current = {owner, isUrlOpen}
  })
  const isOpen = useRef(false)
  const closedByUi = useRef(false)
  const hostOptions = useRef<DialogControlOpenOptions | null>(null)

  /* The address and the dialog agree: a marker opens it, the marker going (browser Back) closes it. */
  useEffect(() => {
    if (!chain) return
    if (!IS_WEB) {
      if (!isOpen.current && hasPending()) {
        const query = takePending(owner, chain)
        if (query) {
          if (settings?.onUrlOpen) settings.onUrlOpen(query)
          else {
            settings?.onUrlQuery?.(query)
            control.current.open()
          }
        }
      }
      return
    }
    if (isUrlOpen) {
      if (isOpen.current || closedByUi.current) return
      const options = hostOptions.current
      hostOptions.current = null
      if (options) control.current.open(options)
      else if (settings?.onUrlOpen) settings.onUrlOpen(marker?.query ?? {})
      else {
        settings?.onUrlQuery?.(marker?.query ?? {})
        control.current.open()
      }
    } else {
      closedByUi.current = false
      if (isOpen.current) control.current.close()
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
            },
            notifyClosed: () => {
              isOpen.current = false
              /* Closed from inside (X, Cancel, Save, the scrim): take its address off the stack. */
              if (live.current.isUrlOpen) {
                closedByUi.current = true
                closeSheetMarkers(live.current.owner, chain)
              }
            },
          }
        : undefined,
      open: options => {
        if (chain && IS_WEB && !live.current.isUrlOpen && !isOpen.current) {
          /* Push the address; the effect above opens the dialog once the stack has it. */
          hostOptions.current = options ?? {}
          openSheetMarkers(live.current.owner, chain, options?.urlQuery)
          return
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
