// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Settings/Settings.tsx (settings page frame and rows)
import {pathTo} from '#/lib/links/make'
import {useOpenLink} from '#/data/useOpenLink'
import {useEffect, useRef, useState} from 'react'
import {View} from 'react-native'
import {LayoutAnimationConfig} from 'react-native-reanimated'
import {Plural, Trans, useLingui} from '@lingui/react/macro'
import {type RouteProp, useNavigation, useRoute} from '@react-navigation/native'
import {isSettledBalance, personSummary} from '@splito/domain'
import {type Entity, type InviteLink, isRemovedFriend, type Person, restoreFriend} from '@splito/sync'

import {useHaptics} from '#/lib/haptics'
import {type AllNavigatorParams, type NavigationProp} from '#/lib/routes/types'
import {logger} from '#/logger'
import {useBalanceRows, useEntities, useMutationCtx, useSortedInviteLinks, useStore} from '#/data/hooks'
import {RemoveFriendDialog} from '#/features/friends/RemoveFriendDialog'
import {useNumberLocale} from '#/locale/numberLocale'
import {List, type ListMethods} from '#/view/com/util/List'
import {useInviteLinkRows} from '#/screens/Invites/InviteLinks'
import {SectionHeader} from '#/screens/People/components/SectionHeader'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {BalanceText} from '#/components/BalanceText'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {useDialogControl} from '#/components/Dialog'
import {SearchInput} from '#/components/forms/SearchInput'
import {DotGrid3x1_Stroke2_Corner0_Rounded as DotsIcon} from '#/components/icons/DotGrid'
import {PersonMinus_Stroke2_Corner0_Rounded as RemoveIcon} from '#/components/icons/Export'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import {PersonPlus_Filled_Stroke2_Corner0_Rounded as AddFriendIcon} from '#/components/icons/Person'
import * as Layout from '#/components/Layout'
import * as Menu from '#/components/Menu'
import {RequestAction, RequestRow} from '#/components/people/RequestRow'
import {PREF_CONTROLS} from '#/components/settings/prefControls'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'

/** Above this many friends the section gets a search field. */
const SEARCH_ABOVE = 10

/** The defaults this page owns: friend requests and the invite-link choices (Privacy keeps "find me"). */
const DEFAULT_PREFS = [
  'privacy.friendRequestsFrom',
  'invites.defaultMaxUses.friend',
  'invites.defaultMaxUses.group',
  'invites.defaultExpiry',
  'invites.approveJoins',
] as const

type Item =
  | {type: 'header'; key: string; title: string; count?: number; action?: 'add' | 'create'}
  | {type: 'search'; key: string}
  | {type: 'friend'; key: string; person: Entity<Person>}
  | {type: 'removed'; key: string; person: Entity<Person>}
  | {type: 'note'; key: string; text: string}
  | {type: 'link'; key: string; link: Entity<InviteLink>}
  | {type: 'defaults'; key: string}

/**
 * Settings > Friends and invites (ARCHITECTURE 26.18, F-621): every friend with Remove, the invite links and the
 * defaults for new links. Requests and invites sent are handled in Activity (owner 195), not listed here.
 */
export function FriendsAndInvitesScreen() {
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const openLink = useOpenLink()
  const route = useRoute<RouteProp<AllNavigatorParams, 'FriendsAndInvites'>>()
  const people = useEntities<Person>('person')
  const {active, inactive, now} = useSortedInviteLinks()
  const {renderLink, prompt} = useInviteLinkRows(now)
  const [query, setQuery] = useState('')
  const list = useRef<ListMethods>(null)
  const removeControl = useDialogControl()
  const [removing, setRemoving] = useState<Entity<Person> | null>(null)
  const scrolled = useRef(false)

  const all = (people ?? []).filter(p => !p.deleted && !p.data.isMe)
  const friends = all.filter(p => !isRemovedFriend(p.data)).sort((x, y) => x.data.name.localeCompare(y.data.name))
  const removed = all.filter(p => isRemovedFriend(p.data)).sort((x, y) => x.data.name.localeCompare(y.data.name))
  const q = query.trim().toLowerCase()
  const shown = q ? friends.filter(p => p.data.name.toLowerCase().includes(q)) : friends

  const items: Item[] = []
  items.push({type: 'header', key: 'h-friends', title: l`Friends`, count: friends.length, action: 'add'})
  if (friends.length > SEARCH_ABOVE) items.push({type: 'search', key: 'search'})
  for (const p of shown) items.push({type: 'friend', key: p.id, person: p})
  if (friends.length === 0) items.push({type: 'note', key: 'no-friends', text: l`No friends yet. Add one with the button above.`})
  else if (shown.length === 0) items.push({type: 'note', key: 'no-match', text: l`No friends match “${query.trim()}”.`})
  if (removed.length > 0) {
    items.push({type: 'header', key: 'h-removed', title: l`Removed friends`, count: removed.length})
    for (const p of removed) items.push({type: 'removed', key: `removed-${p.id}`, person: p})
  }
  const linksAt = items.length
  items.push({type: 'header', key: 'h-links', title: l`Invite links`, count: active.length, action: 'create'})
  for (const link of active) items.push({type: 'link', key: link.id, link})
  if (active.length === 0) items.push({type: 'note', key: 'no-links', text: l`No active invite links. Make one to add friends without typing their number.`})
  else if (inactive.length > 0)
    items.push({type: 'note', key: 'inactive', text: l`${inactive.length} expired, used or revoked links aren’t shown.`})
  items.push({type: 'header', key: 'h-defaults', title: l`Defaults for new links and requests`})
  items.push({type: 'defaults', key: 'defaults'})

  /* Arriving from the invite sheet's "Manage links": land on the links once the rows exist, never before (an index past the data throws on native). */
  const wantsLinks = route.params?.section === 'links'
  const isReady = !!people && items.length > linksAt
  useEffect(() => {
    if (!wantsLinks || !isReady || scrolled.current) return
    const frame = requestAnimationFrame(() => {
      scrolled.current = true
      list.current?.scrollToIndex({index: linksAt, animated: false})
    })
    return () => cancelAnimationFrame(frame)
  }, [wantsLinks, isReady, linksAt])

  const openRemove = (p: Entity<Person>) => {
    setRemoving(p)
    removeControl.open()
  }

  return (
    <Layout.Screen testID="screen-friends-invites">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Friends and invites</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <LayoutAnimationConfig skipEntering skipExiting>
        <List
          ref={list}
          data={people ? items : []}
          keyExtractor={(item: Item) => item.key}
          /* Rows are not measured up front: fall back to an estimated offset, then try the index again once it is on screen. */
          onScrollToIndexFailed={info => {
            list.current?.scrollToOffset({offset: info.averageItemLength * info.index, animated: false})
            setTimeout(() => list.current?.scrollToIndex({index: info.index, animated: false}), 120)
          }}
          renderItem={({item}: {item: Item}) => {
            switch (item.type) {
              case 'header':
                return (
                  <SectionHeader
                    title={item.title}
                    testID={`hub-${item.key}`}
                    count={item.count}
                    action={
                      item.action === 'add' ? (
                        <Button
                          testID="hub-add-friend"
                          label={l`Add friend`}
                          size="small"
                          color="primary"
                          onPress={() => navigation.navigate('AddFriend')}>
                          <ButtonIcon icon={AddFriendIcon} />
                          <ButtonText>
                            <Trans>Add friend</Trans>
                          </ButtonText>
                        </Button>
                      ) : item.action === 'create' ? (
                        <Button
                          testID="hub-create-link"
                          label={l`Create invite link`}
                          size="small"
                          color="secondary"
                          onPress={() => navigation.navigate('CreateInvite', {kind: 'friend'})}>
                          <ButtonIcon icon={PlusIcon} />
                          <ButtonText>
                            <Trans>Create invite link</Trans>
                          </ButtonText>
                        </Button>
                      ) : undefined
                    }
                  />
                )
              case 'search':
                return (
                  <View style={[a.px_lg, a.pb_sm]}>
                    <SearchInput
                      testID="hub-friends-search"
                      label={l`Search friends`}
                      placeholder={l`Search friends`}
                      value={query}
                      onChangeText={setQuery}
                      onClearText={() => setQuery('')}
                    />
                  </View>
                )
              case 'friend':
                return <FriendRow person={item.person} onRemove={() => openRemove(item.person)} />
              case 'removed':
                return <RemovedRow person={item.person} />
              case 'note':
                return <Note text={item.text} />
              case 'link':
                return renderLink(item.link)
              case 'defaults':
                return (
                  <SettingsList.Container>
                    {DEFAULT_PREFS.map((key, i) => {
                      const Control = PREF_CONTROLS[key]
                      return (
                        <View key={key}>
                          {i > 0 && <SettingsList.Divider />}
                          <Control />
                        </View>
                      )
                    })}
                  </SettingsList.Container>
                )
            }
          }}
          ListFooterComponent={<View style={{height: 40}} />}
        />
      </LayoutAnimationConfig>
      {prompt}
      <RemoveFriendDialog
        control={removeControl}
        person={removing}
        onSettleUp={() => removing && openLink.go(pathTo('Person', {personId: removing.id}, ['record-payment']))}
        onCallItEven={() => removing && openLink.go(pathTo('Person', {personId: removing.id}, ['call-it-even']))}
      />
    </Layout.Screen>
  )
}

function Note({text}: {text: string}) {
  const t = useTheme()
  return (
    <Text testID="hub-note" style={[a.px_lg, a.py_md, a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
      {text}
    </Text>
  )
}

/** Open parts per currency, or the settled state. */
function useOpenBalances(personId: string) {
  const rows = useBalanceRows()
  const summary = personSummary(rows ?? [], {includeGroups: true}).find(s => s.person === personId)
  return Object.entries(summary?.byCurrency ?? {})
    .filter(([, b]) => !isSettledBalance(b))
    .sort(([x], [y]) => (x < y ? -1 : 1))
}

function FriendRow({person, onRemove}: {person: Entity<Person>; onRemove: () => void}) {
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const {gtMobile} = useBreakpoints()
  const locale = useNumberLocale()
  const open = useOpenBalances(person.id)
  const name = person.data.name
  const detail =
    open.length === 0 ? (
      <Trans>Settled up</Trans>
    ) : open.length === 1 ? (
      <BalanceText amount={open[0]![1].total} currency={open[0]![0]} locale={locale} />
    ) : (
      <Plural value={open.length} one="Open in # currency" other="Open in # currencies" />
    )
  return (
    <RequestRow testID={`hub-friend-${name}`} name={name} sync={person} detail={detail}>
      <Button
        testID="hub-friend-open"
        label={l`Open ${name}`}
        size="small"
        color="secondary"
        variant="ghost"
        onPress={() => navigation.navigate('Person', {personId: person.id})}>
        <ButtonText>
          <Trans>Open</Trans>
        </ButtonText>
      </Button>
      {gtMobile ? (
        <RequestAction
          testID="hub-friend-remove"
          label={l`Remove ${name}`}
          text={l({message: 'Remove', context: 'button'})}
          icon={RemoveIcon}
          onPress={onRemove}
        />
      ) : (
        <Menu.Root>
          <Menu.Trigger label={l`Options for ${name}`}>
            {({props}) => (
              <Button {...props} testID="hub-friend-menu" label={props.accessibilityLabel} size="small" color="secondary" variant="ghost" shape="round">
                <ButtonIcon icon={DotsIcon} size="lg" />
              </Button>
            )}
          </Menu.Trigger>
          <Menu.Outer>
            <Menu.Item testID="hub-friend-remove" label={l`Remove friend`} destructive onPress={onRemove}>
              <Menu.ItemText>
                <Trans>Remove friend</Trans>
              </Menu.ItemText>
              <Menu.ItemIcon icon={RemoveIcon} position="right" />
            </Menu.Item>
          </Menu.Outer>
        </Menu.Root>
      )}
    </RequestRow>
  )
}

function RemovedRow({person}: {person: Entity<Person>}) {
  const {t: l} = useLingui()
  const store = useStore()
  const ctx = useMutationCtx()
  const haptics = useHaptics()
  const name = person.data.name
  return (
    <RequestRow testID={`hub-removed-${name}`} name={name} detail={<Trans>Removed · history kept</Trans>}>
      <RequestAction
        testID="hub-removed-add-back"
        label={l`Add ${name} back`}
        text={l({message: 'Add back', context: 'button'})}
        icon={PlusIcon}
        onPress={() =>
          void restoreFriend(store, ctx, person.id).then(
            () => {
              haptics.success()
              Toast.show(l`${name} is back in your friends`, {type: 'success'})
            },
            e => {
              logger.error(e, {where: 'FriendsAndInvites.addBack'})
              Toast.show(l`Couldn’t add them back. Please try again.`, {type: 'error'})
            },
          )
        }
      />
    </RequestRow>
  )
}
