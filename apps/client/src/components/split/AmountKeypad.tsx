/*
 * Behaviour adapted from Expensify/App (MIT) - src/components/BigNumberPad.tsx:
 * a phone-sized number pad that replaces the system keyboard for amounts,
 * keys in rows of three with "." and delete on the bottom row, and delete
 * repeating every 100 ms while held. Re-implemented on Bluesky's Button; no
 * Expensify source, icons or styles copied. Splito adds the calculator column
 * (+ − × ÷), a 000 key and the Done / "= Use result" key.
 */
import {useEffect, useRef} from 'react'
import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {useHaptics} from '#/lib/haptics'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {Text} from '#/components/Typography'
import {type AmountKey} from './amountKeys'
import {DeleteIcon} from './icons'

const ROWS: AmountKey[][] = [
  ['1', '2', '3', '÷'],
  ['4', '5', '6', '×'],
  ['7', '8', '9', '−'],
  ['mark', '0', 'delete', '+'],
]
const KEY_HEIGHT = 48
const REPEAT_MS = 100

/**
 * The amount keypad (F-310). `onKeyPressed` gets every key; the caller
 * applies it at the selection (`applyAmountKey`). The wide key is "= Use
 * result" while the amount is a sum, else Done.
 */
export function AmountKeypad({
  mark,
  isExpression,
  canUseResult,
  onKeyPressed,
  onKeyPressIn,
  onResultUsed,
  onDone,
}: {
  /** The locale's decimal mark, shown on its key. */
  mark: '.' | ','
  isExpression: boolean
  canUseResult: boolean
  onKeyPressed: (key: AmountKey) => void
  /** A key went down: the field keeps the keypad open through the focus the key takes. */
  onKeyPressIn: () => void
  onResultUsed: () => void
  onDone: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const haptics = useHaptics()
  const repeat = useRef<ReturnType<typeof setInterval>>(undefined)
  const stopRepeat = () => {
    if (repeat.current) clearInterval(repeat.current)
    repeat.current = undefined
  }
  // A rotation or close mid-hold never sends the press-out (Expensify's note).
  useEffect(() => stopRepeat, [])

  const labels: Partial<Record<AmountKey, string>> = {
    mark: l`Decimal point`,
    delete: l`Delete`,
    '+': l`Plus`,
    '−': l`Minus`,
    '×': l`Times`,
    '÷': l`Divided by`,
  }
  const press = (key: AmountKey) => {
    haptics.selection()
    onKeyPressed(key)
  }

  return (
    <View
      testID="amount-keypad"
      accessibilityLabel={l`Amount keypad`}
      style={[a.gap_xs, a.pt_md]}>
      {ROWS.map(row => (
        <View key={row.join('')} style={[a.flex_row, a.gap_xs]}>
          {row.map(key => {
            const isOperator = '+−×÷'.includes(key)
            return (
              <Button
                key={key}
                testID={`key-${key}`}
                label={labels[key] ?? key}
                variant="ghost"
                color="secondary"
                size="large"
                onPressIn={onKeyPressIn}
                onPress={() => press(key)}
                onLongPress={
                  key === 'delete'
                    ? () => {
                        haptics.longPress()
                        repeat.current = setInterval(
                          () => onKeyPressed('delete'),
                          REPEAT_MS,
                        )
                      }
                    : undefined
                }
                onPressOut={key === 'delete' ? stopRepeat : undefined}
                style={[
                  a.flex_1,
                  a.rounded_md,
                  {height: KEY_HEIGHT},
                  isOperator ? t.atoms.bg_contrast_50 : t.atoms.bg_contrast_25,
                ]}>
                {key === 'delete' ? (
                  <DeleteIcon size="lg" fill={t.atoms.text.color} />
                ) : (
                  <Text
                    style={[
                      a.text_2xl,
                      isOperator ? a.font_semi_bold : a.font_medium,
                      isOperator
                        ? {color: t.palette.primary_500}
                        : t.atoms.text,
                      {fontVariant: ['tabular-nums']},
                    ]}>
                    {key === 'mark' ? mark : key}
                  </Text>
                )}
              </Button>
            )
          })}
        </View>
      ))}
      <View style={[a.flex_row, a.gap_xs]}>
        <Button
          testID="key-000"
          label="000"
          variant="ghost"
          color="secondary"
          size="large"
          onPressIn={onKeyPressIn}
          onPress={() => press('000')}
          style={[
            a.flex_1,
            a.rounded_md,
            {height: KEY_HEIGHT},
            t.atoms.bg_contrast_25,
          ]}>
          <Text style={[a.text_xl, a.font_medium, t.atoms.text]}>000</Text>
        </Button>
        {isExpression ? (
          <Button
            testID="calc-equals"
            label={l`Use the result`}
            color="primary"
            size="large"
            disabled={!canUseResult}
            onPressIn={onKeyPressIn}
            onPress={() => {
              haptics.confirm()
              onResultUsed()
            }}
            style={[{flex: 3, height: KEY_HEIGHT}, a.rounded_md]}>
            <ButtonText style={[a.text_lg]}>{l`= Use result`}</ButtonText>
          </Button>
        ) : (
          <Button
            testID="keypad-done"
            label={l`Done`}
            color="primary"
            size="large"
            onPress={onDone}
            style={[{flex: 3, height: KEY_HEIGHT}, a.rounded_md]}>
            <ButtonText style={[a.text_lg]}>{l`Done`}</ButtonText>
          </Button>
        )}
      </View>
    </View>
  )
}
