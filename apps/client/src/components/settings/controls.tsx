// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Settings/ThreadPreferences.tsx (radio and checkbox groups)
import {View} from 'react-native'
import {type PrefKey, type PrefValue} from '@splito/sync'

import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as SegmentedControl from '#/components/forms/SegmentedControl'
import * as Toggle from '#/components/forms/Toggle'
import {ChevronBottom_Stroke2_Corner0_Rounded as ChevronDownIcon} from '#/components/icons/Chevron'
import {type Props as SVGIconProps} from '#/components/icons/common'
import {type PrefControl, PrefSection} from '#/components/settings/PrefSection'
import {Text} from '#/components/Typography'

export type Option<V> = {value: V; label: string; hint?: string}

/** A preference picked with Bluesky's segmented control (short, few options). */
export function SegmentedPref<K extends PrefKey>({
  pref,
  icon,
  title,
  description,
  options,
}: {
  pref: PrefControl<K>
  icon: React.ComponentType<SVGIconProps>
  title: string
  description?: string
  options: Option<PrefValue<K>>[]
}) {
  if (pref.value === undefined) return null
  const selected = String(pref.value)
  return (
    <PrefSection
      pref={pref}
      icon={icon}
      title={title}
      description={description}>
      <SegmentedControl.Root
        type="radio"
        label={title}
        value={selected}
        onChange={name => {
          const option = options.find(o => String(o.value) === name)
          if (option) void pref.set(option.value)
        }}>
        {options.map(option => (
          <SegmentedControl.Item
            key={String(option.value)}
            testID={`${pref.key}-${String(option.value)}`}
            label={option.label}
            value={String(option.value)}>
            <SegmentedControl.ItemText>
              {option.label}
            </SegmentedControl.ItemText>
          </SegmentedControl.Item>
        ))}
      </SegmentedControl.Root>
    </PrefSection>
  )
}

/** A preference picked from a radio list, as Bluesky's thread sort order. */
export function RadioPref<K extends PrefKey>({
  pref,
  icon,
  title,
  description,
  options,
}: {
  pref: PrefControl<K>
  icon: React.ComponentType<SVGIconProps>
  title: string
  description?: string
  options: Option<PrefValue<K>>[]
}) {
  const t = useTheme()
  if (pref.value === undefined) return null
  return (
    <PrefSection
      pref={pref}
      icon={icon}
      title={title}
      description={description}>
      <Toggle.Group
        label={title}
        type="radio"
        values={[String(pref.value)]}
        onChange={([name]) => {
          const option = options.find(o => String(o.value) === name)
          if (option) void pref.set(option.value)
        }}>
        <View style={[a.gap_md, a.flex_1]}>
          {options.map(option => (
            <Toggle.Item
              key={String(option.value)}
              testID={`${pref.key}-${String(option.value)}`}
              name={String(option.value)}
              label={option.label}>
              <Toggle.Radio />
              <Toggle.LabelText style={[a.flex_1, a.flex_row]}>
                {option.label}
                {option.hint ? (
                  <Text style={[a.font_normal, t.atoms.text_contrast_medium]}>
                    {'  '}
                    {option.hint}
                  </Text>
                ) : null}
              </Toggle.LabelText>
            </Toggle.Item>
          ))}
        </View>
      </Toggle.Group>
    </PrefSection>
  )
}

/** An on/off preference: a switch on every platform (owner 132). */
export function SwitchPref<K extends PrefKey>({
  pref,
  icon,
  title,
  label,
  description,
  disabled = false,
}: {
  pref: PrefControl<K>
  icon: React.ComponentType<SVGIconProps>
  title: string
  label: string
  description?: string
  disabled?: boolean
}) {
  if (pref.value === undefined) return null
  return (
    <PrefSection
      pref={pref}
      icon={icon}
      title={title}
      description={description}>
      <Toggle.Item
        type="switch"
        testID={`${pref.key}-switch`}
        name={pref.key}
        label={label}
        disabled={disabled}
        value={pref.value === true}
        onChange={value => void pref.set(value as PrefValue<K>)}
        style={[a.w_full, a.gap_md]}>
        <Toggle.LabelText style={[a.flex_1]}>{label}</Toggle.LabelText>
        <Toggle.Switch />
      </Toggle.Item>
    </PrefSection>
  )
}

/**
 * Opens a dialog of options (long lists). Styled as Bluesky's native
 * `Select.Trigger`: a large secondary button with the value and a chevron.
 */
export function PickerTrigger({
  testID,
  label,
  value,
  onPress,
}: {
  testID: string
  label: string
  value: string
  onPress: () => void
}) {
  const t = useTheme()
  return (
    <Button
      testID={testID}
      label={label}
      onPress={onPress}
      color="secondary"
      size="large"
      shape="rectangular"
      style={[a.flex_1, a.justify_between, a.pl_lg, a.pr_md]}>
      <ButtonText
        numberOfLines={1}
        style={[a.flex_1, a.text_left, t.atoms.text, a.font_normal]}>
        {value}
      </ButtonText>
      <ButtonIcon icon={ChevronDownIcon} />
    </Button>
  )
}
