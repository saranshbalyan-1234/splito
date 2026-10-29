import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {useHaptics} from '#/lib/haptics'
import {ACCENTS, type AccentId} from '#/alf/swatches'
import {contrastRatio} from '#/alf/util/colorGeneration'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as TextField from '#/components/forms/TextField'
import * as FormSheet from '#/components/FormSheet'
import {Check_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/Check'
import {ChevronRight_Stroke2_Corner0_Rounded as ChevronIcon} from '#/components/icons/Chevron'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import {PaletteIcon} from '#/components/settings/icons'
import {PrefSection, usePrefControl} from '#/components/settings/PrefSection'
import {Text} from '#/components/Typography'

const SWATCH = 40
const HEX = /^#?[0-9a-f]{6}$/i

function normalize(hex: string) {
  return (hex.startsWith('#') ? hex : `#${hex}`).toUpperCase()
}

function useAccentNames(): Record<AccentId, string> {
  const {t: l} = useLingui()
  return {
    blue: l`Blue`,
    emerald: l`Emerald`,
    indigo: l`Indigo`,
    violet: l`Violet`,
    pink: l`Pink`,
    graphite: l`Graphite`,
  }
}

/**
 * Accent colour: the current colour on a row that opens the Accent color
 * sheet (owner rule 7: settings editors are form sheets). The sheet offers
 * Bluesky blue, five presets and a custom hex, previewed inside the sheet
 * only, so the whole app never flickers through colours while browsing.
 */
export function AccentPicker() {
  const t = useTheme()
  const {t: l} = useLingui()
  const names = useAccentNames()
  const pref = usePrefControl('accent')
  const control = Dialog.useDialogControl({url: 'accent'})

  if (pref.value === undefined) return null
  const applied = normalize(pref.value)
  const preset = ACCENTS.find(acc => acc.hex.toUpperCase() === applied)
  const name = preset ? names[preset.id] : l`Custom ${applied}`

  return (
    <PrefSection
      pref={pref}
      icon={PaletteIcon}
      title={l`Accent color`}
      description={l`Tints buttons, links and highlights. Money keeps its green and red.`}>
      <Button
        testID="accent-open"
        label={l`Accent color: ${name}. Change`}
        onPress={() => control.open()}
        color="secondary"
        size="large"
        shape="rectangular"
        style={[a.justify_between, a.pl_md, a.pr_md, a.gap_md]}>
        <View
          style={[
            a.rounded_full,
            {width: 24, height: 24, backgroundColor: applied},
          ]}
        />
        <ButtonText
          numberOfLines={1}
          style={[a.flex_1, a.text_left, t.atoms.text, a.font_normal]}>
          {name}
        </ButtonText>
        <ButtonIcon icon={ChevronIcon} />
      </Button>
      <FormSheet.Outer control={control} testID="accent-sheet">
        <AccentForm applied={applied} onApply={hex => pref.set(hex)} />
      </FormSheet.Outer>
    </PrefSection>
  )
}

function AccentForm({
  applied,
  onApply,
}: {
  applied: string
  onApply: (hex: string) => Promise<void>
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const haptics = useHaptics()
  const names = useAccentNames()
  const control = Dialog.useDialogContext()
  const [choice, setChoice] = useState(applied)
  const [custom, setCustom] = useState<string | null>(null)
  const isPreset = ACCENTS.some(acc => acc.hex.toUpperCase() === applied)
  const isCustomValid = custom !== null && HEX.test(custom)
  const isDirty = choice !== applied
  const isLowContrast = (contrastRatio(choice, t.palette.white) ?? 21) < 3

  const choose = (hex: string) => {
    haptics.selection()
    setChoice(normalize(hex))
  }

  const apply = () => {
    haptics.confirm()
    control.close(() => void onApply(choice))
  }

  return (
    <FormSheet.Inner
      title={l`Accent color`}
      isDirty={isDirty}
      footer={{
        saveLabel: l`Apply`,
        canSave: isDirty && (custom === null || isCustomValid),
        onSave: apply,
      }}>
      <View style={[a.gap_lg]}>
        {/* 8px gaps keep the presets and the custom swatch on one row on a phone. */}
        <View
          role="radiogroup"
          style={[a.flex_row, a.flex_wrap, a.gap_sm, a.py_2xs]}>
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
          <View>
            <TextField.LabelText>
              <Trans>Hex color</Trans>
            </TextField.LabelText>
            <TextField.Root isInvalid={custom.length > 0 && !isCustomValid}>
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
                  if (HEX.test(next)) setChoice(normalize(next))
                }}
              />
            </TextField.Root>
          </View>
        )}

        {/* The preview: a primary button and a link in the chosen colour. */}
        <View
          style={[
            a.flex_row,
            a.align_center,
            a.gap_md,
            a.p_md,
            a.rounded_md,
            t.atoms.bg_contrast_25,
          ]}>
          <View
            testID="accent-preview"
            style={[
              a.px_lg,
              a.py_sm,
              a.rounded_full,
              {backgroundColor: choice},
            ]}>
            <Text
              style={[a.text_sm, a.font_semi_bold, {color: t.palette.white}]}>
              <Trans>Preview</Trans>
            </Text>
          </View>
          <Text style={[a.text_sm, a.font_semi_bold, {color: choice}]}>
            <Trans>A link</Trans>
          </Text>
        </View>

        {isLowContrast && (
          <Text
            style={[
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
      </View>
    </FormSheet.Inner>
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
