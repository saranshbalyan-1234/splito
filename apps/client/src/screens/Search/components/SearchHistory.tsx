// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Search/components/SearchHistory.tsx
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {MagnifyingGlass_Stroke2_Corner0_Rounded as SearchIcon} from '#/components/icons/MagnifyingGlass'
import {TimesLarge_Stroke2_Corner0_Rounded as XIcon} from '#/components/icons/Times'
import * as Layout from '#/components/Layout'
import * as Prompt from '#/components/Prompt'
import {Text} from '#/components/Typography'

/*
 * Bluesky's recent searches (term rows with a remove button, "Clear all"
 * behind a prompt) without its recent-profiles strip or filter chips, then
 * a few example searches where Bluesky shows Explore, so a first visit
 * learns what the box understands. With nothing to show yet, Bluesky's
 * signed-out search art and line head the page.
 */
export function SearchHistory({
  searchHistory,
  onItemClick,
  onRemoveItemClick,
  onClearAll,
}: {
  searchHistory: string[]
  onItemClick: (item: string) => void
  onRemoveItemClick: (item: string) => void
  onClearAll: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const clearAllPromptControl = Prompt.usePromptControl()

  /* The queries stay in English: date words are matched in English only. */
  const tips = [
    {
      q: 'dinner',
      hint: l`Words in titles, notes, items, categories, people and groups`,
    },
    {q: '450', hint: l`An exact amount, in any currency`},
    {q: '> 1000', hint: l`Amounts over 1,000 (or under, with <)`},
    {q: 'yesterday', hint: l`A day: today or yesterday`},
    {q: 'march', hint: l`A month, with a year if you like: march 2026`},
  ]

  return (
    <Layout.Content
      testID="search-history"
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled">
      <View style={[a.w_full, a.gap_md]}>
        {searchHistory.length > 0 ? (
          <View>
            <View
              style={[
                a.flex_row,
                a.align_center,
                a.justify_between,
                a.gap_md,
                a.px_lg,
                a.pt_sm,
              ]}>
              <Text style={[a.flex_1, a.text_md, a.font_semi_bold]}>
                <Trans>Recent searches</Trans>
              </Text>
              {searchHistory.length > 1 && (
                <Button
                  label={l`Clear all recent searches`}
                  onPress={() => clearAllPromptControl.open()}
                  size="tiny"
                  color="secondary"
                  style={[a.flex_shrink_0]}
                  testID="searchHistoryClearAllBtn">
                  <ButtonText>
                    <Trans context="action">Clear all</Trans>
                  </ButtonText>
                </Button>
              )}
            </View>
            <View style={[a.pt_sm]}>
              {searchHistory.slice(0, 5).map(item => (
                <SearchHistoryItem
                  key={item}
                  q={item}
                  onPress={() => onItemClick(item)}
                  onRemove={() => onRemoveItemClick(item)}
                />
              ))}
            </View>
          </View>
        ) : (
          <View
            style={[
              a.align_center,
              a.justify_center,
              a.pt_4xl,
              a.pb_lg,
              a.gap_lg,
              a.px_xl,
            ]}>
            <SearchIcon size="2xl" style={t.atoms.text_contrast_medium} />
            <Text
              style={[a.text_md, a.text_center, t.atoms.text_contrast_medium]}>
              <Trans>Find any expense, friend or group on this device</Trans>
            </Text>
          </View>
        )}

        <View testID="search-tips">
          <Text
            style={[a.px_lg, a.pt_sm, a.pb_xs, a.text_md, a.font_semi_bold]}>
            <Trans>Try searching for</Trans>
          </Text>
          {tips.map(tip => (
            <Button
              key={tip.q}
              testID={`search-tip-${tip.q}`}
              label={l`Search for ${tip.q}`}
              onPress={() => onItemClick(tip.q)}>
              {({hovered, focused, pressed}) => (
                <View
                  style={[
                    a.flex_1,
                    a.flex_row,
                    a.align_center,
                    a.gap_md,
                    a.px_lg,
                    a.py_sm,
                    (hovered || focused || pressed) && t.atoms.bg_contrast_25,
                  ]}>
                  <View
                    style={[
                      a.rounded_sm,
                      a.px_sm,
                      a.py_2xs,
                      t.atoms.bg_contrast_50,
                      {minWidth: 92},
                    ]}>
                    <Text
                      style={[
                        a.text_sm,
                        a.font_semi_bold,
                        a.text_center,
                        {fontVariant: ['tabular-nums']},
                      ]}
                      numberOfLines={1}>
                      {tip.q}
                    </Text>
                  </View>
                  <Text
                    style={[
                      a.flex_1,
                      a.text_sm,
                      a.leading_snug,
                      t.atoms.text_contrast_medium,
                    ]}
                    numberOfLines={2}>
                    {tip.hint}
                  </Text>
                </View>
              )}
            </Button>
          ))}
        </View>
      </View>

      <Prompt.Basic
        control={clearAllPromptControl}
        title={l`Clear all recent searches?`}
        description={l`This can’t be undone, and all of your recent searches will be removed.`}
        onConfirm={onClearAll}
        confirmButtonCta={l({message: 'Clear', context: 'action'})}
        cancelButtonCta={l`Cancel`}
        confirmButtonColor="negative"
      />
    </Layout.Content>
  )
}

function SearchHistoryItem({
  q,
  onPress,
  onRemove,
}: {
  q: string
  onPress: () => void
  onRemove: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()

  return (
    <View style={[a.flex_row, a.align_center]}>
      <Button
        testID={`search-recent-${q}`}
        label={l`Search for ${q}`}
        onPress={onPress}
        style={[a.flex_1]}>
        {({hovered, focused, pressed}) => (
          <View
            style={[
              a.flex_1,
              a.flex_row,
              a.align_center,
              a.gap_sm,
              a.px_lg,
              a.py_md,
              a.pr_5xl,
              (hovered || focused || pressed) && t.atoms.bg_contrast_25,
            ]}>
            <Text
              emoji
              style={[a.text_md, a.leading_snug, a.flex_shrink]}
              numberOfLines={1}>
              {q}
            </Text>
          </View>
        )}
      </Button>
      <Button
        label={l`Remove ${q}`}
        onPress={onRemove}
        size="small"
        variant="ghost"
        color="secondary"
        shape="round"
        style={[a.absolute, {right: 16}, a.bg_transparent]}>
        <ButtonIcon icon={XIcon} />
      </Button>
    </View>
  )
}
