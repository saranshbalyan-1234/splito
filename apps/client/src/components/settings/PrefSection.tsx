// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Settings/AppearanceSettings.tsx (AppearanceToggleButtonGroup)
import {View} from 'react-native'
import {PREFS, type PrefKey, type PrefValue, resetPref} from '@splito/sync'
import {useLingui} from '@lingui/react/macro'

import {HITSLOP_10} from '#/lib/constants'
import {useHaptics} from '#/lib/haptics'
import {useData} from '#/data/StoreProvider'
import {usePref} from '#/data/hooks'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {type Props as SVGIconProps} from '#/components/icons/common'
import {Text} from '#/components/Typography'

function isSame(x: unknown, y: unknown) {
  return x === y || JSON.stringify(x) === JSON.stringify(y)
}

/**
 * One preference: its live value (undefined until the local store answers),
 * a validated setter, and Reset.
 */
export function usePrefControl<K extends PrefKey>(key: K) {
  const {store, ctx} = useData()
  const [value, set] = usePref(key)
  return {
    key,
    value,
    set,
    reset: () => resetPref(store, ctx, key),
    isDefault: value === undefined || isSame(value, PREFS[key].default),
  }
}

export type PrefControl<K extends PrefKey> = {
  key: K
  value: PrefValue<K> | undefined
  set: (v: PrefValue<K>) => Promise<void>
  reset: () => Promise<void>
  isDefault: boolean
}

/** Widest a control grows on tablet and desktop, where content fills the window. */
export const CONTROL_MAX_WIDTH = 560

/**
 * A titled block for one preference, laid out like Bluesky's Appearance
 * groups (icon and title on top, the control beneath), with a Reset action
 * on the title row whenever the value differs from its default.
 */
export function PrefSection({
  pref,
  icon,
  title,
  description,
  iconInset = false,
  children,
}: {
  pref: Pick<PrefControl<PrefKey>, 'key' | 'reset' | 'isDefault'>
  icon: React.ComponentType<SVGIconProps>
  title: string
  description?: string
  iconInset?: boolean
  children: React.ReactNode
}) {
  const t = useTheme()
  return (
    <View style={[a.w_full]} testID={`pref-${pref.key}`}>
      <SettingsList.Item style={[a.pb_2xs, {minHeight: 42}]}>
        <SettingsList.ItemIcon icon={icon} />
        {/* Splito: section titles in semibold, so each block reads as a heading over its control. */}
        <SettingsList.ItemText style={[a.font_semi_bold]}>
          {title}
        </SettingsList.ItemText>
        {!pref.isDefault && <ResetButton pref={pref} title={title} />}
      </SettingsList.Item>
      <SettingsList.Item
        iconInset={iconInset}
        style={[a.flex_col, a.pt_2xs, a.align_start, a.gap_sm]}>
        {description && (
          <Text
            style={[
              a.text_sm,
              a.leading_snug,
              t.atoms.text_contrast_medium,
              a.w_full,
            ]}>
            {description}
          </Text>
        )}
        {/* Controls stop at a readable width on wide screens; a segmented row never stretches across the page. */}
        <View style={[a.w_full, {maxWidth: 480}]}>{children}</View>
      </SettingsList.Item>
    </View>
  )
}

/** Bluesky's settings BadgeButton, as "Reset" for one preference. */
export function ResetButton({
  pref,
  title,
}: {
  pref: Pick<PrefControl<PrefKey>, 'key' | 'reset'>
  title: string
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const haptics = useHaptics()
  return (
    <Button
      testID={`reset-${pref.key}`}
      label={l`Reset ${title} to default`}
      onPress={() => {
        haptics.confirm()
        void pref.reset()
      }}
      hitSlop={HITSLOP_10}>
      {({pressed, hovered}) => (
        <ButtonText
          style={[
            a.text_md,
            a.font_normal,
            a.text_right,
            {
              color:
                pressed || hovered
                  ? t.palette.primary_600
                  : t.atoms.text_link.color,
            },
          ]}>
          {l`Reset`}
        </ButtonText>
      )}
    </Button>
  )
}
