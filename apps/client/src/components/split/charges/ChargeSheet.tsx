import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {type ChargeKind, parseBasisPoints} from '@splito/domain'

import {useHaptics} from '#/lib/haptics'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as FormSheet from '#/components/FormSheet'
import * as SegmentedControl from '#/components/forms/SegmentedControl'
import * as TextField from '#/components/forms/TextField'
import * as Toggle from '#/components/forms/Toggle'
import {Text} from '#/components/Typography'
import {MoneyInput, PercentInput} from '../fields'
import {
  CHARGE_KINDS,
  type ChargeForm,
  type ChargeScopeForm,
} from './chargeForm'
import {useKindName, useTaxClasses} from './hooks'

const NAME_MAX = 40

/**
 * Add or change one charge of an itemised bill (F-403): its name and kind, a
 * rate or an amount, what it applies to (all items, tax classes or chosen
 * items), whether it stacks on the charges before it and, for a tax, whether
 * the prices already include it. A bottom drawer on phones, a centred popup
 * on desktop (FormSheet).
 */
export function ChargeSheet({
  control,
  charge,
  items,
  currency,
  onChargeSaved,
}: {
  control: Dialog.DialogControlProps
  /** The charge being edited, or a blank one (`emptyCharge`) for a new charge. */
  charge: ChargeForm
  /** The items on the bill, for "chosen items". */
  items: Array<{key: string; label: string}>
  currency: string
  onChargeSaved: (charge: ChargeForm) => void
}) {
  return (
    <FormSheet.Outer control={control} testID="charge-sheet" fullHeight>
      {/* Keyed, so the form starts from the charge being edited; the dialog itself must not remount. */}
      <Inner
        key={charge.key}
        charge={charge}
        items={items}
        currency={currency}
        onChargeSaved={onChargeSaved}
      />
    </FormSheet.Outer>
  )
}

function Inner({
  charge,
  items,
  currency,
  onChargeSaved,
}: {
  charge: ChargeForm
  items: Array<{key: string; label: string}>
  currency: string
  onChargeSaved: (charge: ChargeForm) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const control = Dialog.useDialogContext()
  const haptics = useHaptics()
  const kindName = useKindName()
  const {visible, nameOf} = useTaxClasses()
  const [draft, setDraft] = useState(charge)
  const patch = (p: Partial<ChargeForm>) => setDraft(d => ({...d, ...p}))

  let isValueValid = true
  if (draft.mode === 'percent')
    try {
      parseBasisPoints(draft.value)
    } catch {
      isValueValid = false
    }
  const scope = draft.scope
  const isScopeValid =
    scope.type === 'all' ||
    (scope.type === 'classes' ? scope.classes.length > 0 : scope.items.length > 0)
  const canSave = isValueValid && isScopeValid

  const save = () => {
    if (!canSave) return
    haptics.success()
    control.close(() =>
      onChargeSaved({
        ...draft,
        name: draft.name.trim() || kindName(draft.kind),
        // An inclusive discount makes no sense: it comes off.
        inclusive: draft.kind === 'tax' ? draft.inclusive : false,
      }),
    )
  }

  const setScope = (type: ChargeScopeForm['type']) => {
    haptics.selection()
    patch({
      scope:
        type === 'all'
          ? {type}
          : type === 'classes'
            ? {type, classes: scope.type === 'classes' ? scope.classes : []}
            : {type, items: scope.type === 'items' ? scope.items : []},
    })
  }
  const toggle = (list: string[], id: string) =>
    list.includes(id) ? list.filter(x => x !== id) : [...list, id]

  return (
    <FormSheet.Inner
      title={charge.name ? l`Edit charge` : l`New charge`}
      isDirty={JSON.stringify(draft) !== JSON.stringify(charge)}
      footer={{saveLabel: l`Save`, canSave, onSave: save}}>
      <View style={[a.gap_xl]}>
        <View>
          <TextField.LabelText>
            <Trans>Name</Trans>
          </TextField.LabelText>
          <TextField.Root>
            <TextField.Input
              testID="charge-name"
              label={l`Name`}
              placeholder={l`For example, Service charge`}
              value={draft.name}
              onChangeText={name => patch({name})}
              maxLength={NAME_MAX}
              returnKeyType="done"
            />
          </TextField.Root>
        </View>

        <View>
          <TextField.LabelText>
            <Trans>Kind</Trans>
          </TextField.LabelText>
          <View
            role="radiogroup"
            accessibilityLabel={l`Kind`}
            style={[a.flex_row, a.flex_wrap, a.gap_xs]}>
            {CHARGE_KINDS.map((kind: ChargeKind) => (
              <Button
                key={kind}
                testID={`charge-kind-${kind}`}
                label={kindName(kind)}
                role="radio"
                aria-checked={draft.kind === kind}
                accessibilityState={{checked: draft.kind === kind}}
                size="small"
                color={draft.kind === kind ? 'primary' : 'secondary'}
                onPress={() => patch({kind})}>
                <ButtonText>{kindName(kind)}</ButtonText>
              </Button>
            ))}
          </View>
        </View>

        <View>
          <TextField.LabelText>
            <Trans>Amount</Trans>
          </TextField.LabelText>
          <View style={[a.flex_row, a.align_center, a.gap_sm]}>
            <View style={{width: 112}}>
              <SegmentedControl.Root
                type="radio"
                size="small"
                label={l`Charge as`}
                value={draft.mode}
                onChange={value => {
                  /* The figure meant something else in the other unit. */
                  patch({mode: value as 'percent' | 'amount', value: ''})
                }}>
                <SegmentedControl.Item
                  testID="charge-mode-percent"
                  label={l`As a percentage of the items`}
                  value="percent">
                  <SegmentedControl.ItemText>%</SegmentedControl.ItemText>
                </SegmentedControl.Item>
                <SegmentedControl.Item
                  testID="charge-mode-amount"
                  label={l`As an amount in ${currency}`}
                  value="amount">
                  <SegmentedControl.ItemText>{currency}</SegmentedControl.ItemText>
                </SegmentedControl.Item>
              </SegmentedControl.Root>
            </View>
            {draft.mode === 'percent' ? (
              <PercentInput
                testID="charge-value"
                label={l`Rate`}
                value={draft.value}
                isInvalid={!isValueValid}
                width={140}
                onChangeText={value => patch({value})}
              />
            ) : (
              <MoneyInput
                testID="charge-value"
                label={l`Amount`}
                currency={currency}
                value={draft.value}
                width={140}
                onChangeText={value => patch({value})}
              />
            )}
          </View>
        </View>

        <View>
          <TextField.LabelText>
            <Trans>Applies to</Trans>
          </TextField.LabelText>
          <View
            role="radiogroup"
            accessibilityLabel={l`Applies to`}
            style={[a.flex_row, a.flex_wrap, a.gap_xs]}>
            {(
              [
                ['all', l`All items`],
                ['classes', l`Tax classes`],
                ['items', l`Chosen items`],
              ] as const
            ).map(([type, text]) => (
              <Button
                key={type}
                testID={`charge-scope-${type}`}
                label={text}
                role="radio"
                aria-checked={scope.type === type}
                accessibilityState={{checked: scope.type === type}}
                size="small"
                color={scope.type === type ? 'primary' : 'secondary'}
                onPress={() => setScope(type)}>
                <ButtonText>{text}</ButtonText>
              </Button>
            ))}
          </View>
          {scope.type === 'classes' ? (
            <View style={[a.flex_row, a.flex_wrap, a.gap_xs, a.pt_sm]}>
              {visible.map(c => {
                const isOn = scope.classes.includes(c.id)
                return (
                  <Button
                    key={c.id}
                    testID={`charge-class-${c.id}`}
                    label={nameOf(c.id)}
                    accessibilityState={{selected: isOn}}
                    aria-pressed={isOn}
                    size="tiny"
                    variant="outline"
                    color={isOn ? 'primary' : 'secondary'}
                    onPress={() =>
                      patch({scope: {type: 'classes', classes: toggle(scope.classes, c.id)}})
                    }>
                    <ButtonText>{nameOf(c.id)}</ButtonText>
                  </Button>
                )
              })}
            </View>
          ) : null}
          {scope.type === 'items' ? (
            <View style={[a.flex_row, a.flex_wrap, a.gap_xs, a.pt_sm]}>
              {items.map(item => {
                const isOn = scope.items.includes(item.key)
                return (
                  <Button
                    key={item.key}
                    testID={`charge-item-${item.key}`}
                    label={item.label}
                    accessibilityState={{selected: isOn}}
                    aria-pressed={isOn}
                    size="tiny"
                    variant="outline"
                    color={isOn ? 'primary' : 'secondary'}
                    onPress={() =>
                      patch({scope: {type: 'items', items: toggle(scope.items, item.key)}})
                    }>
                    <ButtonText>{item.label}</ButtonText>
                  </Button>
                )
              })}
              {items.length === 0 ? (
                <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                  <Trans>Add items first</Trans>
                </Text>
              ) : null}
            </View>
          ) : null}
          {!isScopeValid ? (
            <Text
              style={[a.text_sm, a.pt_sm, {color: t.palette.negative_500}]}>
              {scope.type === 'classes' ? (
                <Trans>Pick at least one tax class</Trans>
              ) : (
                <Trans>Pick at least one item</Trans>
              )}
            </Text>
          ) : null}
        </View>

        <View style={[a.gap_md]}>
          <SwitchRow
            testID="charge-stacks"
            label={l`Stacks on earlier charges`}
            hint={l`Worked out on the items plus the charges above it that fall on the same items`}
            value={draft.stacksOn === 'earlier'}
            onChange={on => patch({stacksOn: on ? 'earlier' : 'items'})}
          />
          {draft.kind === 'tax' ? (
            <SwitchRow
              testID="charge-inclusive"
              label={l`Prices include this tax`}
              hint={l`Shows the tax portion and adds nothing to the total`}
              value={draft.inclusive}
              onChange={inclusive => patch({inclusive})}
            />
          ) : null}
        </View>
      </View>
    </FormSheet.Inner>
  )
}

function SwitchRow({
  label,
  hint,
  value,
  onChange,
  testID,
}: {
  label: string
  hint: string
  value: boolean
  onChange: (v: boolean) => void
  testID: string
}) {
  const t = useTheme()
  return (
    <Toggle.Item
      type="checkbox"
      testID={testID}
      name={testID}
      label={label}
      value={value}
      onChange={onChange}
      style={[a.w_full, a.gap_md]}>
      <View style={[a.flex_1, a.gap_2xs]}>
        <Text style={[a.text_md, a.font_medium]}>{label}</Text>
        <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          {hint}
        </Text>
      </View>
      <Toggle.Platform />
    </Toggle.Item>
  )
}
