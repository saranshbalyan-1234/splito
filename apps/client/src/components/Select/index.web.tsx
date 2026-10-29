// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/components/Select/index.web.tsx
/*
 * Web: Bluesky's Radix dropdown on rail and desktop. On phone width (under
 * 800 px, ARCHITECTURE 26.8) every modal is a bottom sheet, so the same
 * Select renders Bluesky's native sheet there. One Root decides; the parts
 * follow it through context.
 */
import {createContext, useContext} from 'react'

import {useBreakpoints} from '#/alf'
import * as Radix from './Radix'
import * as Sheet from './Sheet'
import {
  type ContentProps,
  type IconProps,
  type ItemIndicatorProps,
  type ItemProps,
  type ItemTextProps,
  type RootProps,
  type TriggerProps,
  type ValueProps,
} from './types'

const IsSheetContext = createContext(false)
IsSheetContext.displayName = 'SelectIsSheetContext'

export function Root(props: RootProps) {
  const {gtMobile} = useBreakpoints()
  return gtMobile ? (
    <Radix.Root {...props} />
  ) : (
    <IsSheetContext.Provider value>
      <Sheet.Root {...props} />
    </IsSheetContext.Provider>
  )
}

export function Trigger(props: TriggerProps) {
  const Part = useContext(IsSheetContext) ? Sheet : Radix
  return <Part.Trigger {...props} />
}

export function ValueText(props: ValueProps) {
  const Part = useContext(IsSheetContext) ? Sheet : Radix
  return <Part.ValueText {...props} />
}

export function Icon(props: IconProps) {
  const Part = useContext(IsSheetContext) ? Sheet : Radix
  return <Part.Icon {...props} />
}

export function Content<T>(props: ContentProps<T>) {
  if (!useContext(IsSheetContext)) return <Radix.Content {...props} />
  /* The sheet renders in the dialog portal, outside Root's tree: its items need the mode again. */
  return (
    <Sheet.Content
      {...props}
      renderItem={(...args) => (
        <IsSheetContext.Provider value>
          {props.renderItem(...args)}
        </IsSheetContext.Provider>
      )}
    />
  )
}

export function useItemContext() {
  const Part = useContext(IsSheetContext) ? Sheet : Radix
  return Part.useItemContext()
}

export function Item(props: ItemProps) {
  const Part = useContext(IsSheetContext) ? Sheet : Radix
  return <Part.Item {...props} />
}

export function ItemText(props: ItemTextProps) {
  const Part = useContext(IsSheetContext) ? Sheet : Radix
  return <Part.ItemText {...props} />
}

export function ItemIndicator(props: ItemIndicatorProps) {
  const Part = useContext(IsSheetContext) ? Sheet : Radix
  return <Part.ItemIndicator {...props} />
}

export function Separator() {
  const Part = useContext(IsSheetContext) ? Sheet : Radix
  return <Part.Separator />
}
