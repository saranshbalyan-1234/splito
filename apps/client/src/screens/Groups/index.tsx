import {View} from 'react-native'
import {LayoutAnimationConfig} from 'react-native-reanimated'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {groupBalances, magnitude, sumMinor, ZERO} from '@splito/domain'
import {type Entity, type Group} from '@splito/sync'

import {
  HIDING_HEADER_HEIGHT,
  HidingHeader,
  HomeHeaderModeProvider,
  MainScrollProvider,
} from '#/lib/MainScrollProvider'
import {type NavigationProp} from '#/lib/routes/types'
import {useNumberLocale} from '#/locale/numberLocale'
import {useEntities, useLedger, useMe} from '#/data/hooks'
import {EmptyState} from '#/view/com/util/EmptyState'
import {PressableWithHover} from '#/view/com/util/PressableWithHover'
import {List} from '#/view/com/util/List'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {myBalances} from '#/components/groups/net'
import {HeaderAvatar} from '#/components/HeaderAvatar'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import * as Layout from '#/components/Layout'
import {Text} from '#/components/Typography'
import {Shimmer} from '#/motion/Shimmer'
import {BalanceSummary} from '#/screens/People/components/BalanceSummary'
import {GroupRow, GroupRowPlaceholder} from './components/GroupRow'

const PLACEHOLDER_ROWS = 4

/**
 * Groups list: Bluesky's Lists screen (header with a create action,
 * list-card rows, and - as Lists - no compose FAB; a group's own page has
 * it). A line above the rows sums my balance across groups per currency.
 */
export function GroupsScreen() {
  const {t: l} = useLingui()
  const locale = useNumberLocale()
  const navigation = useNavigation<NavigationProp>()
  const {gtMobile} = useBreakpoints()
  const me = useMe()
  const groups = useEntities<Group>('group')
  const ledger = useLedger()

  const isLoading = !me || !groups || !ledger
  const balances =
    me && ledger && groups
      ? groupBalances(myBalances(ledger, me.id, groups))
      : {}
  const rows = (groups ?? [])
    .filter(g => !g.data.archived)
    .sort((x, y) => x.data.name.localeCompare(y.data.name))
  const createGroup = () => navigation.navigate('CreateGroup')
  /* Per currency, never across currencies. */
  const overall = [
    ...new Set(rows.flatMap(g => Object.keys(balances[g.id] ?? {}))),
  ]
    .sort()
    .map(currency => {
      const net = sumMinor(rows.map(g => balances[g.id]?.[currency] ?? ZERO))
      return {
        currency,
        net,
        owed: net > ZERO ? net : ZERO,
        owe: net < ZERO ? magnitude(net) : ZERO,
      }
    })
    .filter(({net}) => net !== ZERO)

  return (
    <Layout.Screen testID="screen-groups">
      <HomeHeaderModeProvider>
        <HidingHeader>
          <Layout.Header.Outer>
            {/* Empty slots as wide as the action and avatar on the right, so the title stays centred. */}
            <Layout.Header.Slot />
            <Layout.Header.Slot />
            <Layout.Header.Content>
              <Layout.Header.TitleText>
                <Trans>Groups</Trans>
              </Layout.Header.TitleText>
            </Layout.Header.Content>
            <Layout.Header.IconButton
              testID="groups-new"
              icon={PlusIcon}
              label={l`Create group`}
              onPress={createGroup}
            />
            <HeaderAvatar />
          </Layout.Header.Outer>
        </HidingHeader>
        {isLoading ? (
          <Shimmer
            testID="groups-loading"
            style={!gtMobile && {paddingTop: HIDING_HEADER_HEIGHT}}>
            {Array.from({length: PLACEHOLDER_ROWS}, (_, i) => (
              <GroupRowPlaceholder key={i} hideTopBorder={i === 0} />
            ))}
          </Shimmer>
        ) : (
          <LayoutAnimationConfig skipEntering skipExiting>
            <MainScrollProvider>
              <List
                headerOffset={gtMobile ? undefined : HIDING_HEADER_HEIGHT}
                data={rows}
                keyExtractor={(group: Entity<Group>) => group.id}
                renderItem={({
                  item,
                  index,
                }: {
                  item: Entity<Group>
                  index: number
                }) => (
                  <GroupRow
                    group={item}
                    balances={balances[item.id] ?? {}}
                    locale={locale}
                    hideTopBorder={index === 0 && overall.length === 0}
                  />
                )}
                ListHeaderComponent={
                  rows.length > 0 && overall.length > 0 ? (
                    /* People's balance card, so both tabs read the same way: my net across all groups, per currency. */
                    <BalanceSummary
                      testID="groups-balances"
                      titleTestID="groups-balances-title"
                      totals={overall}
                      locale={locale}
                    />
                  ) : undefined
                }
                ListEmptyComponent={
                  <EmptyState
                    testID="groups-empty"
                    illustration="empty-groups"
                    message={l`No groups yet. A group keeps a trip’s or a flat’s expenses and balances in one place.`}
                    button={{
                      label: l`New group`,
                      text: l`New group`,
                      icon: PlusIcon,
                      onPress: createGroup,
                      size: 'small',
                      color: 'secondary',
                    }}
                  />
                }
                ListFooterComponent={
                  rows.length > 0 ? (
                    <>
                      <NewGroupRow onPress={createGroup} />
                      {!gtMobile && <View style={{height: 100}} />}
                    </>
                  ) : undefined
                }
              />
            </MainScrollProvider>
          </LayoutAnimationConfig>
        )}
      </HomeHeaderModeProvider>
    </Layout.Screen>
  )
}

/** The list's last row: a quiet way to start another group. */
function NewGroupRow({onPress}: {onPress: () => void}) {
  const t = useTheme()
  const {t: l} = useLingui()
  return (
    <PressableWithHover
      testID="groups-new-row"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={l`Create group`}
      accessibilityHint=""
      hoverStyle={t.atoms.bg_contrast_25}
      style={[
        a.flex_row,
        a.align_center,
        a.gap_md,
        a.px_lg,
        a.py_md,
        a.border_t,
        a.border_b,
        t.atoms.border_contrast_low,
        a.transition_color,
      ]}>
      <View
        style={[
          a.align_center,
          a.justify_center,
          {
            width: 42,
            height: 42,
            borderRadius: 10,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: t.palette.contrast_300,
          },
        ]}>
        <PlusIcon size="md" fill={t.palette.primary_500} />
      </View>
      <Text style={[a.text_md, a.font_semi_bold, {color: t.palette.primary_500}]}>
        <Trans>New group</Trans>
      </Text>
    </PressableWithHover>
  )
}
