import {useRef, useState} from 'react'
import {TextInput, type TextInputProps, View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {formatAmount, getCurrency, toDecimalString} from '@splito/domain'

import {
  applyFonts,
  atoms as a,
  flatten,
  type MutableTextStyle,
  type TextStyleProp,
  useAlf,
  useTheme,
  web,
} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as TextField from '#/components/forms/TextField'
import {ChevronRight_Stroke2_Corner0_Rounded as ChevronRightIcon} from '#/components/icons/Chevron'
import {type Props as SVGIconProps} from '#/components/icons/common'
import {Warning_Stroke2_Corner0_Rounded as WarningIcon} from '#/components/icons/Warning'
import {Text} from '#/components/Typography'
import {ChevronDownIcon} from './icons'

/**
 * A borderless text input in ALF type, like the text box of Bluesky's
 * composer. Fonts go through `applyFonts` so Android gets Inter.
 */
export function PlainInput({
  style,
  ref,
  ...props
}: TextInputProps & {
  style?: TextStyleProp['style']
  ref?: React.Ref<React.ComponentRef<typeof TextInput>>
}) {
  const t = useTheme()
  const {fonts} = useAlf()
  const s: MutableTextStyle = {
    ...flatten([a.text_md, t.atoms.text, web({outlineStyle: 'none'}), style]),
  }
  applyFonts(s, fonts.family)
  if (s.fontSize) s.fontSize = Math.round(s.fontSize * fonts.scaleMultiplier)
  return (
    <TextInput
      placeholderTextColor={t.palette.contrast_500}
      keyboardAppearance={t.scheme}
      {...props}
      ref={ref}
      style={s}
    />
  )
}

/** Error line under a field, in plain words, with Bluesky's warning glyph. */
export function FieldError({
  children,
  testID,
}: {
  children: React.ReactNode
  testID?: string
}) {
  const t = useTheme()
  return (
    <View
      testID={testID}
      style={[a.flex_row, a.align_center, a.gap_xs, a.pt_xs]}>
      <WarningIcon size="xs" fill={t.palette.negative_500} />
      <Text
        style={[
          a.flex_1,
          a.text_sm,
          a.leading_snug,
          {color: t.palette.negative_500},
        ]}>
        {children}
      </Text>
    </View>
  )
}

const OPERATORS = [
  {key: '+', label: '+'},
  {key: '−', label: '−'},
  {key: '×', label: '×'},
  {key: '÷', label: '÷'},
] as const

/**
 * The expense total: a large amount input with the currency chip on its
 * left. It doubles as a calculator - type or tap + − × ÷ and the result shows
 * underneath; "=" replaces the sum with its result. Parse errors read in
 * plain words.
 */
export function AmountField({
  value,
  onChangeText,
  currency,
  locale,
  result,
  errorText,
  onPressCurrency,
}: {
  value: string
  onChangeText: (v: string) => void
  currency: string
  locale: string
  /** The evaluated total, when valid. */
  result: bigint | undefined
  /** Plain-words error, when the text is not a valid amount. */
  errorText: string | undefined
  onPressCurrency: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null)
  const {scale, symbol} = getCurrency(currency)
  const isExpression = /\d\s*[+\-−xX×*/÷]/.test(value)
  const placeholder = scale ? `0.${'0'.repeat(scale)}` : '0'

  const append = (op: string) => {
    const trimmed = value.replace(/\s*[+\-−xX×*/÷]\s*$/, '')
    if (trimmed) onChangeText(`${trimmed} ${op} `)
    inputRef.current?.focus()
  }

  return (
    <View style={[a.px_lg, a.pt_sm, a.pb_md]}>
      <View style={[a.flex_row, a.align_center, a.gap_md]}>
        <Button
          testID="amount-currency"
          label={l`Currency: ${currency}. Change`}
          size="small"
          color="secondary"
          onPress={onPressCurrency}
          style={[a.gap_xs]}>
          <ButtonText
            style={[a.font_semi_bold]}>{`${symbol} ${currency}`}</ButtonText>
          <ButtonIcon icon={ChevronDownIcon} size="xs" />
        </Button>
        {/* An underline, as a field's edge: it reads as editable and lights up while typing. */}
        <View
          style={[
            a.flex_1,
            {
              borderBottomWidth: isFocused ? 2 : 1,
              marginBottom: isFocused ? 0 : 1,
              borderColor: isFocused
                ? t.palette.primary_500
                : t.atoms.border_contrast_medium.borderColor,
            },
          ]}>
          <PlainInput
            testID="amount-input"
            ref={inputRef}
            value={value}
            onChangeText={onChangeText}
            onFocus={() => setIsFocused(true)}
            /*
             * Blur late, so a tap on a calculator key (which takes focus for
             * a moment) lands before the keys hide; the key refocuses the
             * input. ponytail: fixed 200 ms, a focus-within check if it ever
             * misfires.
             */
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            placeholder={placeholder}
            accessibilityLabel={l`Amount`}
            accessibilityHint={l`You can type a sum, like 1200 + 300`}
            inputMode="decimal"
            keyboardType="decimal-pad"
            style={[
              a.text_4xl,
              a.font_bold,
              {fontVariant: ['tabular-nums'], minWidth: 0, paddingVertical: 4},
            ]}
          />
        </View>
      </View>

      {errorText &&
      (!isFocused || value.trim() === '' || !/[+\-−xX×*/÷]\s*$/.test(value)) ? (
        <FieldError testID="amount-error">{errorText}</FieldError>
      ) : isExpression && result !== undefined ? (
        <View style={[a.flex_row, a.align_center, a.gap_sm, a.pt_xs]}>
          <Text
            testID="amount-result"
            style={[
              a.text_md,
              a.font_semi_bold,
              t.atoms.text_contrast_medium,
              {fontVariant: ['tabular-nums']},
            ]}>
            = {formatAmount(result, currency, locale)}
          </Text>
        </View>
      ) : null}

      {/* The calculator keys show while the amount is being typed, like a keyboard accessory bar. */}
      {isFocused || isExpression ? (
        <View
          style={[a.flex_row, a.align_center, a.gap_sm, a.pt_md]}
          accessibilityLabel={l`Calculator`}>
          {OPERATORS.map(op => (
            <Button
              key={op.key}
              testID={`calc-${op.label}`}
              label={op.label}
              size="small"
              color="secondary"
              shape="round"
              onPress={() => append(op.key)}
              style={[{width: 40, height: 40}]}>
              <ButtonText style={[a.text_lg, a.font_semi_bold]}>
                {op.label}
              </ButtonText>
            </Button>
          ))}
          {isExpression && (
            <Button
              testID="calc-equals"
              label={l`Use the result`}
              size="small"
              color="primary"
              disabled={result === undefined}
              onPress={() => {
                if (result !== undefined)
                  onChangeText(toDecimalString(result, scale))
              }}
              style={[a.ml_auto]}>
              <ButtonText>
                <Trans>= Use result</Trans>
              </ButtonText>
            </Button>
          )}
        </View>
      ) : null}
    </View>
  )
}

/**
 * A compact amount input for split rows (exact amounts, adjustments, what
 * each payer paid, item prices), Bluesky's TextField with the currency
 * symbol in front. Accepts the same calculator sums as the total.
 */
export function MoneyInput({
  value,
  onChangeText,
  label,
  currency,
  isInvalid = false,
  testID,
  width = 132,
  allowSign = false,
}: {
  value: string
  onChangeText: (v: string) => void
  label: string
  currency: string
  isInvalid?: boolean
  testID?: string
  width?: number
  allowSign?: boolean
}) {
  const t = useTheme()
  const {scale, symbol} = getCurrency(currency)
  return (
    <View style={{width}}>
      <TextField.Root isInvalid={isInvalid}>
        <Text
          style={[a.z_20, a.text_md, t.atoms.text_contrast_medium, a.pl_xs]}>
          {symbol}
        </Text>
        <TextField.Input
          testID={testID}
          label={label}
          value={value}
          onChangeText={onChangeText}
          placeholder={scale ? `0.${'0'.repeat(scale)}` : '0'}
          inputMode={allowSign ? 'text' : 'decimal'}
          keyboardType={allowSign ? 'numbers-and-punctuation' : 'decimal-pad'}
          /* Left-aligned, so the figure sits right after its currency symbol. */
          style={[{fontVariant: ['tabular-nums']}]}
        />
      </TextField.Root>
    </View>
  )
}

/** A percent input for percentage splits. */
export function PercentInput({
  value,
  onChangeText,
  label,
  isInvalid = false,
  testID,
}: {
  value: string
  onChangeText: (v: string) => void
  label: string
  isInvalid?: boolean
  testID?: string
}) {
  return (
    <View style={{width: 104}}>
      <TextField.Root isInvalid={isInvalid}>
        <TextField.Input
          testID={testID}
          label={label}
          value={value}
          onChangeText={onChangeText}
          placeholder="0"
          inputMode="decimal"
          keyboardType="decimal-pad"
          style={[a.text_right, {fontVariant: ['tabular-nums']}]}
        />
        <TextField.SuffixText label="%">%</TextField.SuffixText>
      </TextField.Root>
    </View>
  )
}

/**
 * One line of the expense form, in the shape of Bluesky's settings rows:
 * icon, label, the current value on the right and a chevron.
 */
export function DetailRow({
  icon: Icon,
  label,
  value,
  onPress,
  testID,
  accessory,
  valueColor,
}: {
  icon: React.ComponentType<SVGIconProps>
  label: string
  value: string
  onPress: () => void
  testID?: string
  accessory?: React.ReactNode
  valueColor?: string
}) {
  const t = useTheme()
  return (
    <Button
      testID={testID}
      label={`${label}: ${value}`}
      onPress={onPress}
      hoverStyle={t.atoms.bg_contrast_25}
      style={[
        a.w_full,
        a.flex_row,
        a.align_center,
        a.gap_md,
        a.px_lg,
        a.rounded_0,
        a.justify_start,
        {minHeight: 52},
      ]}>
      <Icon size="md" fill={t.atoms.text_contrast_medium.color} />
      <Text style={[a.text_md, a.font_medium]}>{label}</Text>
      <View
        style={[a.flex_1, a.flex_row, a.align_center, a.justify_end, a.gap_sm]}>
        {accessory}
        <Text
          testID={testID ? `${testID}-value` : undefined}
          style={[
            a.text_md,
            a.text_right,
            a.flex_shrink,
            valueColor ? {color: valueColor} : t.atoms.text_contrast_medium,
          ]}
          numberOfLines={1}>
          {value}
        </Text>
      </View>
      <ChevronRightIcon size="sm" fill={t.atoms.text_contrast_low.color} />
    </Button>
  )
}
