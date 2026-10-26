import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {useHaptics} from '#/lib/haptics'
import {ACCENTS, type AccentId} from '#/alf/swatches'
import {contrastRatio, darken} from '#/alf/util/colorGeneration'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as TextField from '#/components/forms/TextField'
import {Check_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/Check'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import {PaletteIcon} from '#/components/settings/icons'
import {PrefSection, usePrefControl} from '#/components/settings/PrefSection'
import {Text} from '#/components/Typography'

const SWATCH = 40
const HEX = /^#?[0-9a-f]{6}$/i

function normalize(hex: string) {
  return (hex.startsWith('#') ? hex : `#${hex}`).toUpperCase()
}

/**
 * Accent colour: Bluesky blue plus seven presets and a custom hex. A choice
 * is only previewed (on the Apply button itself) until Apply, so the whole
 * app never flickers through colours while browsing.
 */
export function AccentPicker() {
  const t = useTheme()
  const {t: l} = useLingui()
  const haptics = useHaptics()
  const pref = usePrefControl('accent')
  const [pending, setPending] = useState<string | null>(null)
  const [custom, setCustom] = useState<string | null>(null)

  if (pref.value === undefined) return null
  const applied = normalize(pref.value)
  const isPreset = ACCENTS.some(acc => acc.hex.toUpperCase() === applied)
  const choice = pending ?? applied
  const customValid = custom !== null && HEX.test(custom)
  const isDirty = choice !== applied
  const isLowContrast = (contrastRatio(choice, t.palette.white) ?? 21) < 3

  const names: Record<AccentId, string> = {
    blue: l`Bluesky blue`,
    emerald: l`Emerald`,
    indigo: l`Indigo`,
    violet: l`Violet`,
    pink: l`Pink`,
    orange: l`Orange`,
    amber: l`Amber`,
    graphite: l`Graphite`,
  }

  const choose = (hex: string) => {
    haptics.selection()
    setPending(normalize(hex))
  }

  const apply = () => {
    haptics.confirm()
    void pref.set(choice).then(() => {
      setPending(null)
      setCustom(null)
    })
  }

  return (
    <PrefSection
      pref={{
        ...pref,
        reset: async () => {
          setPending(null)
          setCustom(null)
          await pref.reset()
        },
      }}
      icon={PaletteIcon}
      title={l`Accent color`}
      description={l`Tints buttons, links and highlights. Money keeps its green and red.`}>
      <View style={[a.flex_row, a.flex_wrap, a.gap_md, a.py_2xs]}>
        {ACCENTS.map(acc => (
          <Swatch
            key={acc.id}
            testID={`accent-${acc.id}`}
            color={acc.hex}
            label={names[acc.id]}
            isSelected={choice === acc.hex.toUpperCase()}
            onPress={() => {
              setCustom(null)
              choose(acc.hex)
            }}
          />
        ))}
        {!isPreset && custom === null ? (
          <Swatch
            testID="accent-custom-applied"
            color={applied}
            label={l`Custom color ${applied}`}
            isSelected={choice === applied}
            onPress={() => choose(applied)}
          />
        ) : null}
        <Button
          testID="accent-custom"
          label={l`Custom color`}
          onPress={() => setCustom(custom === null ? choice.slice(1) : null)}
          style={[
            a.rounded_full,
            a.border,
            a.align_center,
            a.justify_center,
            {width: SWATCH, height: SWATCH, borderStyle: 'dashed'},
            t.atoms.border_contrast_high,
          ]}>
          <PlusIcon size="md" fill={t.atoms.text_contrast_medium.color} />
        </Button>
      </View>

      {custom !== null && (
        <View style={[a.pt_sm]}>
          <TextField.LabelText>
            <Trans>Hex color</Trans>
          </TextField.LabelText>
          <TextField.Root isInvalid={custom.length > 0 && !customValid}>
            <TextField.Input
              testID="accent-hex"
              label={l`Hex color`}
              placeholder="006AFF"
              value={custom}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={7}
              onChangeText={text => {
                const next = text.replace(/[^#0-9a-f]/gi, '')
                setCustom(next)
                if (HEX.test(next)) setPending(normalize(next))
              }}
            />
          </TextField.Root>
        </View>
      )}

      {isLowContrast && (
        <Text
          style={[
            a.pt_xs,
            a.text_sm,
            a.leading_snug,
            {color: t.palette.negative_500},
          ]}>
          <Trans>
            White text is hard to read on this color. A darker shade works
            better.
          </Trans>
        </Text>
      )}

      {isDirty && (
        <View style={[a.flex_row, a.gap_sm, a.pt_sm]}>
          <Button
            testID="accent-apply"
            label={l`Apply accent color`}
            onPress={apply}
            size="small"
            color="primary"
            style={{backgroundColor: choice}}
            hoverStyle={{backgroundColor: darken(choice, 6)}}>
            <ButtonText>
              <Trans>Apply</Trans>
            </ButtonText>
          </Button>
          <Button
            testID="accent-cancel"
            label={l`Cancel`}
            onPress={() => {
              setPending(null)
              setCustom(null)
            }}
            size="small"
            color="secondary">
            <ButtonText>
              <Trans>Cancel</Trans>
            </ButtonText>
          </Button>
        </View>
      )}
    </PrefSection>
  )
}

function Swatch({
  testID,
  color,
  label,
  isSelected,
  onPress,
}: {
  testID: string
  color: string
  label: string
  isSelected: boolean
  onPress: () => void
}) {
  const t = useTheme()
  return (
    <Button
      testID={testID}
      label={label}
      onPress={onPress}
      role="radio"
      accessibilityState={{checked: isSelected}}
      aria-checked={isSelected}
      style={[
        a.rounded_full,
        a.align_center,
        a.justify_center,
        {width: SWATCH, height: SWATCH, backgroundColor: color},
        isSelected && {
          borderWidth: 3,
          borderColor: t.atoms.bg.backgroundColor,
          outlineColor: color,
          outlineStyle: 'solid',
          outlineWidth: 2,
        },
      ]}>
      <>{isSelected && <CheckIcon size="sm" fill={t.palette.white} />}</>
    </Button>
  )
}
