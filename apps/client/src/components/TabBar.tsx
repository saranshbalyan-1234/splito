// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/com/pager/TabBar.web.tsx
import {StyleSheet, View} from 'react-native'

import {PressableWithHover} from '#/view/com/util/PressableWithHover'
import {atoms as a, useTheme, web} from '#/alf'
import {Text} from '#/components/Typography'

/*
 * Bluesky's tab bar, as drawn on web, used on every platform. Bluesky pairs
 * it with a swipeable Pager (react-native-pager-view); Splito's only tabbed
 * page has two short tabs that always fit, so the horizontal scroller and the
 * drag-following indicator are left out and a press switches the tab.
 */
export function TabBar({
  testID,
  selectedPage,
  items,
  onSelect,
}: {
  testID?: string
  selectedPage: number
  items: string[]
  onSelect: (index: number) => void
}) {
  const t = useTheme()
  return (
    <View
      testID={testID}
      style={[t.atoms.bg, styles.outer]}
      accessibilityRole="tablist">
      {items.map((item, i) => {
        const selected = i === selectedPage
        return (
          <PressableWithHover
            testID={`${testID}-selector-${i}`}
            key={`${item}-${i}`}
            style={styles.item}
            hoverStyle={t.atoms.bg_contrast_25}
            onPress={() => onSelect(i)}
            accessibilityRole="tab"
            accessibilityState={{selected}}
            aria-selected={selected}>
            <View style={styles.itemInner}>
              <Text
                emoji
                style={[
                  styles.itemText,
                  selected ? t.atoms.text : t.atoms.text_contrast_medium,
                  a.text_md,
                  a.font_semi_bold,
                  {lineHeight: 20},
                ]}>
                {item}
              </Text>
              <View
                style={[
                  styles.itemIndicator,
                  selected && {backgroundColor: t.palette.primary_500},
                ]}
              />
            </View>
          </PressableWithHover>
        )
      })}
      <View style={[t.atoms.border_contrast_low, styles.outerBottomBorder]} />
    </View>
  )
}

const styles = StyleSheet.create({
  outer: {
    flexDirection: 'row',
    paddingHorizontal: 6,
  },
  item: {
    flexGrow: 1,
    flexBasis: 0,
    alignItems: 'stretch',
    paddingTop: 10,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  // Shrinks to the label (at least the indicator's minimum), so the indicator matches the label.
  itemInner: {
    alignSelf: 'center',
    alignItems: 'center',
    minWidth: 45,
    ...web({overflowX: 'hidden'}),
  },
  itemText: {
    textAlign: 'center',
    paddingBottom: 10 + 3,
  },
  itemIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  outerBottomBorder: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '100%',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
})
