// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/com/pager/TabBar.web.tsx
import {StyleSheet, View} from 'react-native'

import {PressableWithHover} from '#/view/com/util/PressableWithHover'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {Text} from '#/components/Typography'

/**
 * Bluesky's feed tab bar: equal-width text tabs with a 3px indicator under
 * the selected one and a hairline beneath. Splito's tab sets are short, so
 * the horizontal scroller and its scroll-into-view are removed and the same
 * bar runs on native. Upstream caps the tabs at its 600px centre column;
 * Splito's content is full width beside the sidebar (owner directive), so
 * the tabs split that width like the list under them.
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
  const {gtMobile} = useBreakpoints()
  const styles = gtMobile ? desktopStyles : mobileStyles

  return (
    <View testID={testID} style={[t.atoms.bg, a.w_full]} role="tablist">
      <View style={styles.contentContainer}>
        {items.map((item, i) => {
          const selected = i === selectedPage
          return (
            <PressableWithHover
              testID={testID ? `${testID}-${i}` : undefined}
              key={`${item}-${i}`}
              style={styles.item}
              hoverStyle={t.atoms.bg_contrast_25}
              onPress={() => onSelect(i)}
              role="tab"
              aria-selected={selected}
              accessibilityRole="tab"
              accessibilityState={{selected}}>
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
      </View>
      <View style={[t.atoms.border_contrast_low, styles.outerBottomBorder]} />
    </View>
  )
}

const shared = StyleSheet.create({
  itemInner: {
    alignItems: 'center',
    alignSelf: 'center',
    minWidth: 45,
  },
  itemText: {
    textAlign: 'center',
    paddingBottom: 10 + 3,
  },
  itemIndicator: {
    position: 'absolute',
    bottom: 0,
    height: 3,
    left: 0,
    right: 0,
  },
  outerBottomBorder: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '100%',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
})

const desktopStyles = StyleSheet.create({
  ...shared,
  contentContainer: {
    flexDirection: 'row',
  },
  item: {
    flexGrow: 1,
    flexBasis: 0,
    alignItems: 'stretch',
    paddingTop: 14,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
})

const mobileStyles = StyleSheet.create({
  ...shared,
  contentContainer: {
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
})
