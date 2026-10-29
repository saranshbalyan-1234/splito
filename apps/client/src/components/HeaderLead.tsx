import {useIsPushedCopy} from '#/lib/hooks/useIsPushedCopy'
import * as Layout from '#/components/Layout'
import {HeaderAvatar} from '#/components/HeaderAvatar'

/**
 * The left slot of a main screen's header (owner 179): the avatar on the tab itself, Back when the screen was
 * pushed from a link ("See all", a search result, a notification). Main screens use this in place of `HeaderAvatar`.
 */
export function HeaderLead() {
  return useIsPushedCopy() ? <Layout.Header.BackButton /> : <HeaderAvatar />
}
