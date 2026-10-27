// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/com/util/layouts/LoggedOutLayout.tsx
import {ScrollView, StyleSheet, useWindowDimensions, View} from 'react-native'

import {
  atoms as a,
  BreakpointWidthContext,
  useBreakpoints,
  useTheme,
} from '#/alf'
import {CENTER_COLUMN_WIDTH} from '#/components/Layout'
import {Text} from '#/components/Typography'
import {IS_NATIVE, IS_WEB} from '#/env'

/**
 * Bluesky's logged-out frame: a single centred column on phones, and on wider
 * web screens a tinted side panel with the right-aligned title and
 * description beside the form.
 */
export function LoggedOutLayout({
  leadin,
  title,
  description,
  children,
  scrollable,
}: React.PropsWithChildren<{
  leadin: string
  title: string
  description: string
  scrollable?: boolean
}>) {
  const t = useTheme()
  const {gtMobile, gtTablet} = useBreakpoints()
  const {width} = useWindowDimensions()

  if (IS_NATIVE || !gtMobile) {
    const content = (
      <BreakpointWidthContext
        value={IS_NATIVE ? Math.min(width, CENTER_COLUMN_WIDTH) : undefined}>
        <View
          style={[
            scrollable && a.flex_1,
            a.pt_lg,
            IS_NATIVE && [
              a.w_full,
              a.self_center,
              {maxWidth: CENTER_COLUMN_WIDTH},
            ],
          ]}>
          {children}
        </View>
      </BreakpointWidthContext>
    )

    if (scrollable) {
      return (
        <ScrollView
          style={a.flex_1}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          contentContainerStyle={[a.flex_grow]}>
          {content}
        </ScrollView>
      )
    }
    return content
  }

  return (
    <View style={styles.container}>
      <View style={[styles.side, t.atoms.bg_contrast_25]}>
        <Text
          style={[
            t.atoms.text_contrast_medium,
            styles.leadinText,
            !gtTablet && styles.leadinTextSmall,
          ]}>
          {leadin}
        </Text>
        <Text
          style={[
            {color: t.palette.primary_500},
            styles.titleText,
            !gtTablet && styles.titleTextSmall,
          ]}>
          {title}
        </Text>
        <Text
          style={[
            a.text_2xl,
            a.font_medium,
            t.atoms.text_contrast_medium,
            styles.descriptionText,
          ]}>
          {description}
        </Text>
      </View>
      {scrollable ? (
        <View
          style={[
            styles.scrollableContent,
            t.atoms.bg,
            t.atoms.border_contrast_low,
            a.border_l,
          ]}>
          <ScrollView
            style={a.flex_1}
            contentContainerStyle={styles.scrollViewContentContainer}
            keyboardShouldPersistTaps="handled"
            /*
             * RNW implements `on-drag` by blurring the focused element on ANY
             * scroll event, which kills the form's autofocus (Bluesky).
             */
            keyboardDismissMode={IS_WEB ? 'none' : 'on-drag'}>
            <View style={[styles.contentWrapper, IS_WEB && a.my_auto]}>
              {children}
            </View>
          </ScrollView>
        </View>
      ) : (
        <View
          style={[
            styles.content,
            t.atoms.bg,
            t.atoms.border_contrast_low,
            a.border_l,
          ]}>
          <View style={styles.contentWrapper}>{children}</View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  side: {
    flex: 1,
    paddingHorizontal: 40,
    paddingBottom: 80,
    justifyContent: 'center',
  },
  content: {
    flex: 2,
    paddingHorizontal: 40,
    justifyContent: 'center',
  },
  scrollableContent: {
    flex: 2,
  },
  scrollViewContentContainer: {
    flexGrow: 1,
    paddingHorizontal: 40,
  },
  leadinText: {
    fontSize: 36,
    fontWeight: '800',
    textAlign: 'right',
  },
  leadinTextSmall: {
    fontSize: 24,
  },
  titleText: {
    fontSize: 58,
    fontWeight: '800',
    textAlign: 'right',
  },
  titleTextSmall: {
    fontSize: 36,
  },
  descriptionText: {
    maxWidth: 400,
    marginTop: 10,
    marginLeft: 'auto',
    textAlign: 'right',
  },
  contentWrapper: {
    maxWidth: 600,
  },
})
