import {useRef, useState} from 'react'
import {TextInput, type TextInputProps, View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {
  amountInputText,
  cleanAmountText,
  decimalMark,
  formatAmount,
  getCurrency,
  isExpression,
} from '@splito/domain'

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
import {AmountKeypad} from './AmountKeypad'
import {type AmountKey, applyAmountKey, type Selection} from './amountKeys'
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

/** Plain digits with at most one decimal mark: the text already is the amount, so no "= result" line. */
const PLAIN_NUMBER = /^\d+([.,]\d*)?$/

/**
 * The expense total: a large amount input with the currency chip on its
 * left. It doubles as a calculator - type or tap + − × ÷ and the result shows
 * underneath; "=" replaces the sum with its result. It reads shorthand
 * ("1.5L"), other digit scripts and pasted amounts ("₹1,20,000.50": the
 * currency marks are dropped as they arrive), and asks "Did you mean ...?"
 * for an ambiguous "1,234" (F-310). With `hasKeypad` (phones; the
 * system keyboard stays for screen readers) Splito's keypad replaces the system keyboard,
 * as Expensify's amount page does. Parse errors read in plain words.
 */
export function AmountField({
  value,
  onChangeText,
  currency,
  locale,
  result,
  errorText,
  readings,
  reading,
  onReadingPicked,
  hasKeypad = false,
  onPressCurrency,
}: {
  value: string
  /** `reading` is set when the field wrote the text itself (a computed result), so it never asks about it. */
  onChangeText: (v: string, reading?: 'decimal') => void
  currency: string
  locale: string
  /** The evaluated total, when valid. */
  result: bigint | undefined
  /** Plain-words error, when the text is not a valid amount. */
  errorText: string | undefined
  /** An ambiguous amount's readings ("Did you mean ...?"). */
  readings?: {grouped: bigint; decimal?: bigint}
  /** The reading picked for an ambiguous amount; the result line then confirms it. */
  reading?: 'grouped' | 'decimal'
  onReadingPicked?: (reading: 'grouped' | 'decimal') => void
  hasKeypad?: boolean
  onPressCurrency: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null)
  const selection = useRef<Selection>({start: value.length, end: value.length})
  const {scale, symbol} = getCurrency(currency)
  const mark = decimalMark(locale)
  const isSum = isExpression(value)
  const shouldShowResult =
    result !== undefined && (!!reading || !PLAIN_NUMBER.test(value.trim()))
  /* A keypad key is being pressed: the input's blur is the key taking focus for a moment, not leaving. */
  const isKeyDown = useRef(false)
  /* Whether the input holds focus right now (the state above lags by the blur delay). */
  const hasFocus = useRef(false)
  /* A placeholder is never a value (ARCHITECTURE 5): the word, never "0.00". */
  const placeholder = l`Amount`
  const format = (v: bigint) => formatAmount(v, currency, locale)

  const changeText = (text: string) => onChangeText(cleanAmountText(text))

  /* Put the caret after a keypad key (native TextInput, or the DOM input on web). */
  const moveCaret = (caret: number) => {
    selection.current = {start: caret, end: caret}
    const input = inputRef.current as unknown as {
      setSelection?: (start: number, end: number) => void
      setSelectionRange?: (start: number, end: number) => void
    } | null
    requestAnimationFrame(() => {
      if (input?.setSelection) input.setSelection(caret, caret)
      else input?.setSelectionRange?.(caret, caret)
    })
  }

  const pressKey = (key: AmountKey) => {
    inputRef.current?.focus()
    isKeyDown.current = false
    const next = applyAmountKey(value, selection.current, key, {scale, mark})
    if (!next) return
    onChangeText(next.text)
    moveCaret(next.caret)
  }

  const append = (op: string) => {
    const trimmed = value.replace(/\s*[+\-−xX×*/÷]\s*$/, '')
    if (trimmed) onChangeText(`${trimmed} ${op} `)
    inputRef.current?.focus()
  }

  const applyResult = () => {
    isKeyDown.current = false
    inputRef.current?.focus()
    if (result === undefined) return
    const text = amountInputText(result, currency, mark)
    onChangeText(text, 'decimal')
    moveCaret(text.length)
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
            onChangeText={changeText}
            onSelectionChange={e => {
              selection.current = e.nativeEvent.selection
            }}
            onFocus={() => {
              hasFocus.current = true
              setIsFocused(true)
            }}
            /*
             * Blur late, so a tap on a calculator key (which takes focus for
             * a moment) lands before the keys hide; the key refocuses the
             * input. ponytail: fixed 200 ms, a focus-within check if it ever
             * misfires.
             */
            onBlur={() => {
              hasFocus.current = false
              setTimeout(() => {
                if (!hasFocus.current && !isKeyDown.current) setIsFocused(false)
              }, 200)
            }}
            placeholder={placeholder}
            accessibilityLabel={l`Amount`}
            accessibilityHint={l`You can type a sum, like 1200 + 300, or 2k or 1.5L`}
            /* The keypad stands in for the system keyboard (Expensify: showSoftInputOnFocus off, inputMode none). */
            showSoftInputOnFocus={!hasKeypad}
            inputMode={hasKeypad ? 'none' : 'decimal'}
            keyboardType="decimal-pad"
            style={[
              a.text_4xl,
              a.font_bold,
              {fontVariant: ['tabular-nums'], minWidth: 0, paddingVertical: 4},
            ]}
          />
        </View>
      </View>

      {readings ? (
        <View
          testID="amount-readings"
          style={[a.flex_row, a.flex_wrap, a.align_center, a.gap_sm, a.pt_sm]}>
          <Text style={[a.text_sm, a.font_medium, t.atoms.text_contrast_high]}>
            <Trans>Did you mean</Trans>
          </Text>
          {(['grouped', 'decimal'] as const).map(reading => {
            const v = readings[reading]
            if (v === undefined) return null
            return (
              <Button
                key={reading}
                testID={`amount-reading-${reading}`}
                label={l`Use ${format(v)}`}
                size="small"
                variant="outline"
                color="primary"
                onPress={() => onReadingPicked?.(reading)}>
                <ButtonText style={[{fontVariant: ['tabular-nums']}]}>
                  {format(v)}
                </ButtonText>
              </Button>
            )
          })}
          {readings.decimal === undefined ? (
            <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
              <Trans>This currency has no third decimal.</Trans>
            </Text>
          ) : null}
        </View>
      ) : errorText &&
        (!isFocused ||
          value.trim() === '' ||
          !/[+\-−xX×*/÷]\s*$/.test(value)) ? (
        <FieldError testID="amount-error">{errorText}</FieldError>
      ) : shouldShowResult ? (
        <View style={[a.flex_row, a.align_center, a.gap_sm, a.pt_xs]}>
          <Text
            testID="amount-result"
            style={[
              a.text_md,
              a.font_semi_bold,
              t.atoms.text_contrast_medium,
              {fontVariant: ['tabular-nums']},
            ]}>
            = {format(result)}
          </Text>
        </View>
      ) : null}

      {hasKeypad && isFocused ? (
        <AmountKeypad
          mark={mark}
          isExpression={isSum}
          canUseResult={result !== undefined}
          onKeyPressed={pressKey}
          onKeyPressIn={() => {
            isKeyDown.current = true
          }}
          onResultUsed={applyResult}
          onDone={() => {
            isKeyDown.current = false
            inputRef.current?.blur()
            setIsFocused(false)
          }}
        />
      ) : !hasKeypad && (isFocused || isSum) ? (
        /* The calculator keys show while the amount is being typed, like a keyboard accessory bar. */
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
          {isSum && (
            <Button
              testID="calc-equals"
              label={l`Use the result`}
              size="small"
              color="primary"
              disabled={result === undefined}
              onPress={applyResult}
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
  const {t: l} = useLingui()
  const {symbol} = getCurrency(currency)
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
          placeholder={l`Amount`}
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
  width = 104,
}: {
  value: string
  onChangeText: (v: string) => void
  label: string
  isInvalid?: boolean
  testID?: string
  width?: number
}) {
  const {t: l} = useLingui()
  return (
    <View style={{width}}>
      <TextField.Root isInvalid={isInvalid}>
        <TextField.Input
          testID={testID}
          label={label}
          value={value}
          onChangeText={onChangeText}
          placeholder={l`Rate`}
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
