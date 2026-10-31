import {useState} from 'react'
import {View} from 'react-native'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'
import {amountInputText, decimalMark, formatAmount, ZERO} from '@splito/domain'
import {type AdjustmentModes} from '@splito/sync'
import {nanoid} from 'nanoid/non-secure'

import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, tokens, useBreakpoints, useTheme, web} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {ChoiceChips} from '#/components/forms/ChoiceChips'
import * as SegmentedControl from '#/components/forms/SegmentedControl'
import * as TextField from '#/components/forms/TextField'
import * as Toggle from '#/components/forms/Toggle'
import {usePrefControl} from '#/components/settings/PrefSection'
import {useDialogControl} from '#/components/Dialog'
import {
  ArrowBottom_Stroke2_Corner0_Rounded as ArrowDownIcon,
  ArrowTop_Stroke2_Corner0_Rounded as ArrowUpIcon,
} from '#/components/icons/Arrow'
import {Check_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/Check'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import {TimesLarge_Stroke2_Corner0_Rounded as XIcon} from '#/components/icons/Times'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'
import {hasCharges, startItemize} from './charges/chargeForm'
import {ChargeList, ChargePresets} from './charges/ChargesSection'
import {useChargePresets} from './charges/hooks'
import {
  ClassPickerDialog,
  ClassSelectionBar,
  ItemClassChip,
} from './charges/ItemClass'
import {DisclosureRow, FieldError, MoneyInput, PercentInput} from './fields'
import {
  type ExpenseForm,
  type FormEvaluation,
  SPLIT_MODES,
  type SplitMode,
} from './form'
import {CoinsIcon, MinusIcon} from './icons'
import {PortionBadge} from './PortionBadge'
import {
  cashUnitText,
  useAvatarName,
  useDisplayName,
  useErrorText,
} from './shared'

type Update = (fn: (f: ExpenseForm) => ExpenseForm) => void

/** Split modes whose shares can be rounded to cash (F-402); the others are typed amounts. */
export const ROUNDABLE: SplitMode[] = ['equal', 'shares', 'percent']
/** The cash units on offer, in whole currency units (the `split.roundTo` choices). */
const ROUND_UNITS = [1, 5, 10, 50, 100] as const

/** A cap on one person's portions of one item, so a stray tap never runs away. */
const MAX_PORTIONS = 9
/** One width for every money field in Itemize, so items and charges line up. */
const ITEM_AMOUNT_WIDTH = 120

/** The split modes' names in the person's language. */
export function useSplitModeLabels(): Record<SplitMode, string> {
  const {t: l} = useLingui()
  return {
    equal: l`Equally`,
    exact: l`Exact`,
    percent: l`Percent`,
    shares: l`Shares`,
    adjusted: l`Equal + extra`,
    items: l`Itemize`,
  }
}

/**
 * The chips that choose how an expense is split (equal, exact, percent, shares,
 * equal with extras, itemised) and one line of help for the chosen one. They
 * sit behind the form's "More options" row (F-275): most expenses are equal.
 */
export function SplitModeChips({
  form,
  update,
  locale,
}: {
  form: ExpenseForm
  update: Update
  locale: string
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {gtMobile} = useBreakpoints()
  const isPointer = IS_WEB && gtMobile
  const presets = useChargePresets()
  const defaultPresetId = usePrefControl('bill.defaultPreset').value ?? 'simple'

  const labels = useSplitModeLabels()
  const help: Record<SplitMode, string> = {
    equal: l`Everyone ticked pays the same.`,
    exact: l`Type what each person owes.`,
    percent: l`Give each person a percentage.`,
    shares: l`Split by shares – say 2 for a couple, 1 for everyone else.`,
    adjusted: l`Split equally, then add or take away an amount for someone.`,
    /* One line; the way to take someone off matches the device (a tap toggles; hold or right-click also takes them off). */
    items: isPointer
      ? l`Add each item, then tap the people who had it. Right-click a name to take them off.`
      : l`Add each item, then tap the people who had it. Hold a name to take them off.`,
  }

  return (
    <View style={[a.px_lg, a.pb_sm]}>
      <ChoiceChips
        label={l`How to split`}
        value={form.mode}
        onChange={mode =>
          update(f =>
            f.mode === mode
              ? f
              : mode === 'items'
                ? startItemize(
                    {...f, mode},
                    {
                      preset: presets.find(p => p.id === defaultPresetId),
                      newKey: () => nanoid(8),
                      mark: decimalMark(locale),
                    },
                  )
                : {...f, mode},
          )
        }
        options={SPLIT_MODES.map(mode => ({value: mode, label: labels[mode], testID: `split-mode-${mode}`}))}
      />
      <Text
        style={[
          a.text_sm,
          a.leading_snug,
          a.pt_sm,
          t.atoms.text_contrast_medium,
        ]}>
        {help[form.mode]}
      </Text>
    </View>
  )
}

/**
 * Who owes what for the chosen split: one row per person with that mode's
 * input and their resulting share, or the item list for an itemised bill.
 */
export function SplitRows({
  form,
  update,
  evaluation,
  locale,
  adjustModes,
  onAdjustModesChanged,
}: {
  form: ExpenseForm
  update: Update
  evaluation: FormEvaluation
  locale: string
  /** The remembered amount / % choice per itemize charge (preference read by the caller). */
  adjustModes: AdjustmentModes | undefined
  onAdjustModesChanged: (modes: AdjustmentModes) => void
}) {
  if (form.mode === 'items')
    return (
      <ItemsEditor
        form={form}
        update={update}
        evaluation={evaluation}
        locale={locale}
        savedModes={adjustModes}
        saveModes={onAdjustModesChanged}
      />
    )
  return (
    <View>
      {form.people.map(id => (
        <SplitRow
          key={id}
          id={id}
          form={form}
          update={update}
          evaluation={evaluation}
          locale={locale}
        />
      ))}
    </View>
  )
}

function SplitRow({
  id,
  form,
  update,
  evaluation,
  locale,
}: {
  id: string
  form: ExpenseForm
  update: Update
  evaluation: FormEvaluation
  locale: string
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const name = useDisplayName()
  const avatarName = useAvatarName()
  const share = evaluation.shares?.[id]
  const isExcluded = form.excluded.includes(id)
  const rowError = evaluation.rowErrors[id]

  const shareText =
    (form.mode === 'equal' || form.mode === 'adjusted') && isExcluded
      ? l`Not splitting`
      : share !== undefined
        ? evaluation.cash?.remainderTo === id
          ? l`${formatAmount(share, form.currency, locale)} · includes ${formatAmount(evaluation.cash.remainder, form.currency, locale)} left over`
          : formatAmount(share, form.currency, locale)
        : form.mode === 'shares' && (form.shares[id] ?? 1) === 0
          ? l`Not splitting`
          : null

  const setExcluded = (isIncluded: boolean) =>
    update(f => ({
      ...f,
      excluded: isIncluded
        ? f.excluded.filter(p => p !== id)
        : [...f.excluded, id],
    }))

  const identity = (
    <>
      <UserAvatar size={36} name={avatarName(id)} type="user" />
      <View style={[a.flex_1, a.gap_2xs]}>
        <Text style={[a.text_md, a.font_medium]} numberOfLines={1}>
          {name(id)}
        </Text>
        {shareText && form.mode !== 'exact' ? (
          <Text
            testID={`share-${name(id)}`}
            style={[
              a.text_sm,
              t.atoms.text_contrast_medium,
              {fontVariant: ['tabular-nums']},
            ]}
            numberOfLines={1}>
            {shareText}
          </Text>
        ) : null}
      </View>
    </>
  )

  const rowStyle = [
    a.flex_row,
    a.align_center,
    a.gap_md,
    a.px_lg,
    a.py_sm,
    {minHeight: 60},
  ]

  if (form.mode === 'equal') {
    return (
      <Toggle.Item
        name={id}
        label={name(id)}
        value={!isExcluded}
        onChange={setExcluded}
        testID={`split-include-${name(id)}`}
        style={[...rowStyle, a.rounded_0]}>
        {({hovered}) => (
          <>
            {hovered ? (
              <View style={[a.absolute, a.inset_0, t.atoms.bg_contrast_25]} />
            ) : null}
            {identity}
            <Toggle.Checkbox />
          </>
        )}
      </Toggle.Item>
    )
  }

  return (
    <View>
      <View style={rowStyle}>
        {identity}
        {form.mode === 'exact' ? (
          <MoneyInput
            testID={`split-exact-${name(id)}`}
            label={l`Amount for ${name(id)}`}
            currency={form.currency}
            value={form.exact[id] ?? ''}
            isInvalid={!!rowError}
            onChangeText={v =>
              update(f => ({...f, exact: {...f.exact, [id]: v}}))
            }
          />
        ) : form.mode === 'percent' ? (
          <PercentInput
            testID={`split-percent-${name(id)}`}
            label={l`Percent for ${name(id)}`}
            value={form.percent[id] ?? ''}
            isInvalid={!!rowError}
            onChangeText={v =>
              update(f => ({...f, percent: {...f.percent, [id]: v}}))
            }
          />
        ) : form.mode === 'shares' ? (
          <Stepper
            testID={`split-shares-${name(id)}`}
            label={l`Shares for ${name(id)}`}
            value={form.shares[id] ?? 1}
            onChange={v =>
              update(f => ({...f, shares: {...f.shares, [id]: v}}))
            }
          />
        ) : (
          <View style={[a.flex_row, a.align_center, a.gap_sm]}>
            {!isExcluded ? (
              <MoneyInput
                testID={`split-adjust-${name(id)}`}
                label={l`Adjustment for ${name(id)}, plus or minus`}
                currency={form.currency}
                value={form.adjust[id] ?? ''}
                isInvalid={!!rowError}
                allowSign
                width={120}
                onChangeText={v =>
                  update(f => ({...f, adjust: {...f.adjust, [id]: v}}))
                }
              />
            ) : null}
            <Toggle.Item
              name={id}
              label={l`${name(id)} is splitting`}
              value={!isExcluded}
              onChange={setExcluded}
              testID={`split-include-${name(id)}`}>
              <Toggle.Checkbox />
            </Toggle.Item>
          </View>
        )}
      </View>
    </View>
  )
}

/** Bluesky-style round minus / plus buttons around a whole number. */
function Stepper({
  value,
  onChange,
  label,
  testID,
  min = 0,
  max = 99,
  minusLabel,
  plusLabel,
}: {
  value: number
  onChange: (v: number) => void
  label: string
  testID?: string
  min?: number
  max?: number
  minusLabel?: string
  plusLabel?: string
}) {
  const {t: l} = useLingui()
  return (
    <View
      style={[a.flex_row, a.align_center, a.gap_sm]}
      accessibilityLabel={label}>
      <Button
        testID={testID ? `${testID}-minus` : undefined}
        label={minusLabel ?? l`Fewer shares`}
        size="small"
        color="secondary"
        shape="round"
        disabled={value <= min}
        onPress={() => onChange(Math.max(min, value - 1))}>
        <ButtonIcon icon={MinusIcon} />
      </Button>
      <Text
        testID={testID}
        style={[
          a.text_lg,
          a.font_semi_bold,
          a.text_center,
          {minWidth: 24, fontVariant: ['tabular-nums']},
        ]}>
        {value}
      </Text>
      <Button
        testID={testID ? `${testID}-plus` : undefined}
        label={plusLabel ?? l`More shares`}
        size="small"
        color="secondary"
        shape="round"
        disabled={value >= max}
        onPress={() => onChange(Math.min(max, value + 1))}>
        <ButtonIcon icon={PlusIcon} />
      </Button>
    </View>
  )
}

function ItemsEditor({
  form,
  update,
  evaluation,
  locale,
  savedModes,
  saveModes,
}: {
  form: ExpenseForm
  update: Update
  evaluation: FormEvaluation
  locale: string
  savedModes: AdjustmentModes | undefined
  saveModes: (modes: AdjustmentModes) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const name = useDisplayName()
  const avatarName = useAvatarName()
  const errorText = useErrorText()
  /* Tax classes (F-403): the item whose picker is open, and a multi-select of items. */
  const classPicker = useDialogControl({url: 'tax-class'})
  const [pickingFor, setPickingFor] = useState<string>()
  const [selection, setSelection] = useState<string[]>()
  /* The charges stay behind one row until the bill carries some (F-275); a bill that already has them opens showing them. */
  const [isChargesOpen, setIsChargesOpen] = useState(() => hasCharges(form))

  const setItem = (key: string, patch: Partial<ExpenseForm['items'][number]>) =>
    update(f => ({
      ...f,
      items: f.items.map(i => (i.key === key ? {...i, ...patch} : i)),
    }))

  const moveItem = (index: number, by: -1 | 1) =>
    update(f => {
      const items = [...f.items]
      const [moved] = items.splice(index, 1)
      items.splice(index + by, 0, moved!)
      return {...f, items}
    })

  const extras = [
    {key: 'tax', label: l`Tax`},
    {key: 'tip', label: l`Tip`},
    {key: 'service', label: l`Service charge`},
    {key: 'discount', label: l`Discount`},
  ] as const

  /* What is set behind the charges row, in the domain's own figures (a percentage already worked out). */
  const chargesSummary = !hasCharges(form)
    ? undefined
    : form.charges
      ? plural(form.charges.length, {one: '# charge', other: '# charges'})
      : extras
          .filter(x => !!form[x.key]?.trim())
          .map(x => {
            const resolved = evaluation.adjustments?.[x.key]
            return resolved === undefined
              ? x.label
              : `${x.label} ${formatAmount(resolved, form.currency, locale)}`
          })
          .join(' · ')

  return (
    <View style={[a.px_lg, a.gap_sm]}>
      {form.charges && selection ? (
        <ClassSelectionBar
          count={selection.length}
          onClassApplied={taxClass => {
            update(f => ({
              ...f,
              items: f.items.map(i =>
                selection.includes(i.key) ? {...i, taxClass} : i,
              ),
            }))
            setSelection(undefined)
          }}
          onDone={() => setSelection(undefined)}
        />
      ) : null}
      {form.items.map((item, index) => {
        const error = evaluation.rowErrors[`item:${item.key}`]
        const controls = (
          <View style={[a.flex_row, a.align_center]}>
            {form.charges ? (
              <ItemClassChip
                testID={`item-${index}-class`}
                classId={item.taxClass}
                isSelecting={!!selection}
                isSelected={!!selection?.includes(item.key)}
                onPress={() => {
                  if (selection)
                    setSelection(
                      selection.includes(item.key)
                        ? selection.filter(k => k !== item.key)
                        : [...selection, item.key],
                    )
                  else {
                    setPickingFor(item.key)
                    classPicker.open()
                  }
                }}
                onSelectionStarted={() => setSelection([item.key])}
              />
            ) : null}
            {form.items.length > 1 && (
              <>
                <Button
                  testID={`item-${index}-up`}
                  label={l`Move item ${index + 1} up`}
                  size="small"
                  variant="ghost"
                  color="secondary"
                  shape="round"
                  disabled={index === 0}
                  style={[a.bg_transparent]}
                  onPress={() => moveItem(index, -1)}>
                  <ButtonIcon icon={ArrowUpIcon} size="sm" />
                </Button>
                <Button
                  testID={`item-${index}-down`}
                  label={l`Move item ${index + 1} down`}
                  size="small"
                  variant="ghost"
                  color="secondary"
                  shape="round"
                  disabled={index === form.items.length - 1}
                  style={[a.bg_transparent]}
                  onPress={() => moveItem(index, 1)}>
                  <ButtonIcon icon={ArrowDownIcon} size="sm" />
                </Button>
              </>
            )}
            <Button
              testID={`item-${index}-remove`}
              label={l`Remove item ${index + 1}`}
              size="small"
              variant="ghost"
              color="secondary"
              shape="round"
              style={[a.bg_transparent]}
              onPress={() =>
                update(f => ({
                  ...f,
                  items: f.items.filter(i => i.key !== item.key),
                }))
              }>
              <ButtonIcon icon={XIcon} />
            </Button>
          </View>
        )
        return (
          <View
            key={item.key}
            testID={`item-${index}`}
            style={[a.p_md, a.gap_sm, a.rounded_md, t.atoms.bg_contrast_25]}>
            {/* "Item N" with reorder and remove on its own line at every width, so the name keeps the row's width. */}
            {
              <View style={[a.flex_row, a.align_center, a.justify_between]}>
                <Text
                  style={[
                    a.text_sm,
                    a.font_semi_bold,
                    t.atoms.text_contrast_medium,
                  ]}>
                  <Trans>Item {index + 1}</Trans>
                </Text>
                {controls}
              </View>
            }
            <View style={[a.flex_row, a.align_center, a.gap_xs]}>
              <View style={[a.flex_1]}>
                <TextField.Root>
                  <TextField.Input
                    testID={`item-${index}-name`}
                    label={l`Name of item ${index + 1}`}
                    placeholder={l`Item ${index + 1}`}
                    value={item.name}
                    onChangeText={v => setItem(item.key, {name: v})}
                  />
                </TextField.Root>
              </View>
              <MoneyInput
                testID={`item-${index}-amount`}
                label={l`Price of item ${index + 1}`}
                currency={form.currency}
                value={item.amount}
                isInvalid={!!error && error !== 'UNASSIGNED_ITEM'}
                width={ITEM_AMOUNT_WIDTH}
                onChangeText={v => setItem(item.key, {amount: v})}
              />
            </View>
            {/*
             * Who had it: one tap assigns a person (one portion), another
             * takes them off again; a long press or right-click takes them
             * off too. A bill's untouched "Everyone" narrows to the person
             * tapped, so a first tap never leaves the others charged. A
             * stepper for portions ("2 of 3 beers") shows once two or more
             * people share the item. "Everyone" puts the whole split on it.
             */}
            <View style={[a.flex_row, a.flex_wrap, a.gap_xs]}>
              {(() => {
                const isEveryone =
                  form.people.every(id => item.people.includes(id)) &&
                  Object.keys(item.portions ?? {}).length === 0
                return (
                  <Button
                    testID={`item-${index}-everyone`}
                    label={l`Everyone, one portion each`}
                    accessibilityState={{selected: isEveryone}}
                    aria-pressed={isEveryone}
                    size="tiny"
                    variant="outline"
                    color={isEveryone ? 'primary' : 'secondary'}
                    onPress={() =>
                      setItem(item.key, {
                        people: [...form.people],
                        portions: {},
                      })
                    }>
                    <ButtonText>
                      <Trans>Everyone</Trans>
                    </ButtonText>
                  </Button>
                )
              })()}
              {form.people.map(id => {
                const isOn = item.people.includes(id)
                const portions = item.portions?.[id] ?? 1
                const isEveryone =
                  form.people.every(p => item.people.includes(p)) &&
                  Object.keys(item.portions ?? {}).length === 0
                const takeOff = () =>
                  setItem(item.key, {
                    people: item.people.filter(p => p !== id),
                    portions: Object.fromEntries(
                      Object.entries(item.portions ?? {}).filter(
                        ([p]) => p !== id,
                      ),
                    ),
                  })
                return (
                  <Button
                    key={id}
                    testID={`item-${index}-person-${name(id)}`}
                    label={
                      isOn && portions > 1
                        ? l`${name(id)}, ${portions} portions`
                        : name(id)
                    }
                    accessibilityHint={
                      isOn
                        ? l`Tap to take them off this item`
                        : l`Adds them to this item`
                    }
                    accessibilityState={{selected: isOn}}
                    aria-pressed={isOn}
                    size="tiny"
                    variant="outline"
                    color={isOn ? 'primary' : 'secondary'}
                    onPress={() =>
                      isEveryone && form.people.length > 1
                        ? setItem(item.key, {people: [id], portions: {}})
                        : isOn
                          ? takeOff()
                          : setItem(item.key, {people: [...item.people, id]})
                    }
                    onLongPress={isOn ? takeOff : undefined}
                    {...web({
                      onContextMenu: (e: {preventDefault: () => void}) => {
                        e.preventDefault()
                        if (isOn) takeOff()
                      },
                    })}
                    style={[a.gap_xs, a.pl_2xs]}>
                    <UserAvatar size={20} name={avatarName(id)} type="user" />
                    <ButtonText>{name(id)}</ButtonText>
                    {isOn && portions > 1 ? (
                      <PortionBadge
                        portions={portions}
                        testID={`item-${index}-portions-${name(id)}`}
                      />
                    ) : isOn ? (
                      <ButtonIcon icon={CheckIcon} size="xs" />
                    ) : null}
                  </Button>
                )
              })}
            </View>
            {/* Portions: only for people who are on the item, and only worth asking when it is shared. */}
            {item.people.length > 1 ? (
              <View
                testID={`item-${index}-portion-steppers`}
                style={[a.flex_row, a.flex_wrap, a.align_center, a.gap_md]}>
                <Text
                  style={[a.text_sm, a.font_medium, t.atoms.text_contrast_medium]}>
                  <Trans>Portions</Trans>
                </Text>
                {item.people.map(id => (
                  <View
                    key={id}
                    style={[a.flex_row, a.align_center, a.gap_xs]}>
                    <Text style={[a.text_sm]} numberOfLines={1}>
                      {name(id)}
                    </Text>
                    <Stepper
                      testID={`item-${index}-portion-${name(id)}`}
                      label={l`Portions for ${name(id)}`}
                      min={1}
                      max={MAX_PORTIONS}
                      minusLabel={l`Fewer portions`}
                      plusLabel={l`More portions`}
                      value={item.portions?.[id] ?? 1}
                      onChange={v =>
                        setItem(item.key, {
                          portions: {...item.portions, [id]: v},
                        })
                      }
                    />
                  </View>
                ))}
              </View>
            ) : null}
            {/* What each person's portions of this item come to. */}
            {evaluation.itemParts?.[item.key] ? (
              <Text
                testID={`item-${index}-parts`}
                style={[
                  a.text_sm,
                  a.leading_snug,
                  t.atoms.text_contrast_medium,
                  {fontVariant: ['tabular-nums']},
                ]}>
                {item.people
                  .map(id =>
                    // Non-breaking, so a name never wraps away from its amount.
                    `${name(id)} ${formatAmount(evaluation.itemParts![item.key]![id]!, form.currency, locale)}`.replace(
                      / /g,
                      '\u00a0',
                    ),
                  )
                  .join('  ·  ')}
              </Text>
            ) : null}
            {error ? <FieldError>{errorText(error)}</FieldError> : null}
          </View>
        )
      })}

      <Button
        testID="item-add"
        label={l`Add item`}
        size="small"
        color="secondary"
        onPress={() =>
          update(f => ({
            ...f,
            items: [
              ...f.items,
              {
                key: nanoid(8),
                name: '',
                amount: '',
                people: [...f.people],
                /* A run of dishes shares a class, so the next item starts with the last one's. */
                ...(f.charges && f.items.at(-1)?.taxClass
                  ? {taxClass: f.items.at(-1)!.taxClass}
                  : {}),
              },
            ],
          }))
        }
        style={[a.self_start]}>
        <ButtonIcon icon={PlusIcon} />
        <ButtonText>
          <Trans>Add item</Trans>
        </ButtonText>
      </Button>

      {/*
       * Charges (F-403): the four plain rows (Simple), or an ordered list of
       * scoped, stacked charges once a preset or "Add charge" is chosen.
       * Each plain row is an amount or a percentage of the items (owner
       * rule), remembered per kind for the next bill. They sit behind one
       * row, with a one-line summary of what is set (F-275).
       */}
      <View style={[a.pt_sm, a.gap_xs]}>
        <View style={{marginHorizontal: -tokens.space.lg}}>
          <DisclosureRow
            testID="item-charges-row"
            label={l`Tax, tip and discounts`}
            summary={chargesSummary}
            isOpen={isChargesOpen}
            onPress={() => setIsChargesOpen(open => !open)}
          />
        </View>
        {isChargesOpen ? (
          <View testID="item-charges" style={[a.gap_xs]}>
            <ChargePresets form={form} update={update} locale={locale} />
            {form.charges ? (
              <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
                <Trans>
                  Each charge is shared only by the people who had the items it
                  applies to. Drag to reorder: a charge can stack on the ones
                  above it.
                </Trans>
              </Text>
            ) : (
              <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
                <Trans>
                  Discount comes off the items first; service, tax and tip are
                  then worked out on what is left.
                </Trans>
              </Text>
            )}
            {form.charges ? (
              <ChargeList
                form={form}
                update={update}
                evaluation={evaluation}
                locale={locale}
              />
            ) : null}
            {!form.charges
              ? extras.map(x => {
                  const isPercent = form.adjustModes?.[x.key] === 'percent'
                  const resolved = evaluation.adjustments?.[x.key]
                  return (
                    <View
                      key={x.key}
                      style={[a.flex_row, a.align_center, a.gap_sm, a.py_xs]}>
                      <View style={[a.flex_1, a.gap_2xs]}>
                        <Text style={[a.text_md]}>{x.label}</Text>
                        {/* A percentage shows what it comes to. */}
                        {isPercent && resolved !== undefined && resolved !== ZERO ? (
                          <Text
                            testID={`item-${x.key}-resolved`}
                            style={[
                              a.text_xs,
                              t.atoms.text_contrast_medium,
                              {fontVariant: ['tabular-nums']},
                            ]}>
                            {formatAmount(resolved, form.currency, locale)}
                          </Text>
                        ) : null}
                      </View>
                      <View style={{width: 96}}>
                        <SegmentedControl.Root
                          type="radio"
                          size="small"
                          label={l`${x.label} as`}
                          value={isPercent ? 'percent' : 'amount'}
                          onChange={value => {
                            const next = value as 'amount' | 'percent'
                            update(f => ({
                              ...f,
                              /* The figure meant something else in the other unit. */
                              [x.key]: '',
                              adjustModes: {...f.adjustModes, [x.key]: next},
                            }))
                            if (savedModes) saveModes({...savedModes, [x.key]: next})
                          }}>
                          <SegmentedControl.Item
                            testID={`item-${x.key}-mode-amount`}
                            label={l`${x.label} as an amount in ${form.currency}`}
                            value="amount">
                            <SegmentedControl.ItemText>
                              {form.currency}
                            </SegmentedControl.ItemText>
                          </SegmentedControl.Item>
                          <SegmentedControl.Item
                            testID={`item-${x.key}-mode-percent`}
                            label={l`${x.label} as a percentage`}
                            value="percent">
                            <SegmentedControl.ItemText>%</SegmentedControl.ItemText>
                          </SegmentedControl.Item>
                        </SegmentedControl.Root>
                      </View>
                      {isPercent ? (
                        <PercentInput
                          testID={`item-${x.key}`}
                          label={x.label}
                          value={form[x.key] ?? ''}
                          isInvalid={!!evaluation.rowErrors[x.key]}
                          width={ITEM_AMOUNT_WIDTH}
                          onChangeText={v => update(f => ({...f, [x.key]: v}))}
                        />
                      ) : (
                        <MoneyInput
                          testID={`item-${x.key}`}
                          label={x.label}
                          currency={form.currency}
                          value={form[x.key] ?? ''}
                          isInvalid={!!evaluation.rowErrors[x.key]}
                          width={ITEM_AMOUNT_WIDTH}
                          onChangeText={v => update(f => ({...f, [x.key]: v}))}
                        />
                      )}
                    </View>
                  )
                })
              : null}
          </View>
        ) : null}
      </View>

      {evaluation.shares ? (
        <View testID="items-shares" style={[a.pt_sm, a.gap_xs]}>
          <Text
            style={[a.text_sm, a.font_semi_bold, t.atoms.text_contrast_medium]}>
            <Trans>Each person’s share</Trans>
          </Text>
          {form.people
            .filter(id => evaluation.shares![id] !== undefined)
            .map(id => (
              <View
                key={id}
                style={[a.flex_row, a.align_center, a.gap_sm, a.py_2xs]}>
                <UserAvatar size={24} name={avatarName(id)} type="user" />
                <Text style={[a.flex_1, a.text_md]} numberOfLines={1}>
                  {name(id)}
                </Text>
                <Text
                  testID={`share-${name(id)}`}
                  style={[
                    a.text_md,
                    a.font_semi_bold,
                    {fontVariant: ['tabular-nums']},
                  ]}>
                  {formatAmount(evaluation.shares![id]!, form.currency, locale)}
                </Text>
              </View>
            ))}
        </View>
      ) : null}

      {!form.charges &&
      evaluation.itemsTotal !== undefined &&
      evaluation.itemsTotal > ZERO &&
      evaluation.remaining?.kind === 'money' &&
      evaluation.remaining.value !== ZERO ? (
        <View
          style={[
            a.flex_row,
            a.align_center,
            a.justify_between,
            a.gap_md,
            a.p_md,
            a.rounded_md,
            t.atoms.bg_contrast_25,
          ]}>
          <Text
            style={[
              a.flex_1,
              a.text_sm,
              a.leading_snug,
              t.atoms.text_contrast_high,
            ]}>
            <Trans>
              Items and charges come to{' '}
              {formatAmount(evaluation.itemsTotal, form.currency, locale)}
            </Trans>
          </Text>
          <Button
            testID="items-use-total"
            label={l`Use as the total`}
            size="small"
            color="primary_subtle"
            onPress={() =>
              update(f => ({
                ...f,
                // Written by the app, so it is never asked about (F-111 C2).
                amount: amountInputText(
                  evaluation.itemsTotal!,
                  f.currency,
                  decimalMark(locale),
                ),
                amountReading: 'decimal',
              }))
            }>
            <ButtonText>
              <Trans>Use as total</Trans>
            </ButtonText>
          </Button>
        </View>
      ) : null}

      <ClassPickerDialog
        control={classPicker}
        value={form.items.find(i => i.key === pickingFor)?.taxClass}
        onClassPicked={taxClass =>
          pickingFor && setItem(pickingFor, {taxClass})
        }
      />
    </View>
  )
}

/**
 * Cash rounding (F-402): a switch under the split that rounds every share to
 * whole cash units (1, 5, 10, 50, 100 of the currency), and a line that
 * shows what does not divide - the remainder and whose share carries it -
 * so nothing is ever lost or hidden. The rounding itself is
 * `@splito/domain` `allocateCash`; this only shows it.
 */
export function CashRounding({
  form,
  update,
  evaluation,
  locale,
  defaultUnit,
  onChanged,
  actor,
}: {
  form: ExpenseForm
  update: Update
  evaluation: FormEvaluation
  locale: string
  defaultUnit: number
  onChanged: (unit: number) => void
  actor: string
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const name = useDisplayName()
  const roundTo = form.roundTo ?? 0
  const isOn = roundTo > 0
  const unitText = (n: number) => cashUnitText(form.currency, n)
  const cash = evaluation.cash
  const fmt = (v: bigint) => formatAmount(v, form.currency, locale)

  return (
    <View testID="cash-rounding" style={[a.px_lg, a.pt_lg, a.gap_sm]}>
      <Toggle.Item
        type="switch"
        testID="cash-rounding-switch"
        name="cash-rounding"
        label={l`Round shares to cash`}
        value={isOn}
        onChange={on => {
          update(f => ({...f, roundTo: on ? defaultUnit : 0}))
          onChanged(on ? defaultUnit : 0)
        }}
        style={[a.w_full, a.gap_md]}>
        <View
          style={[
            a.align_center,
            a.justify_center,
            a.rounded_sm,
            {width: 36, height: 36},
            t.atoms.bg_contrast_25,
          ]}>
          <CoinsIcon size="md" fill={t.atoms.text_contrast_medium.color} />
        </View>
        <View style={[a.flex_1, a.gap_2xs]}>
          <Text style={[a.text_md, a.font_medium]}>
            <Trans>Round shares to cash</Trans>
          </Text>
          <Text
            style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
            <Trans>Whole amounts that are easy to hand over</Trans>
          </Text>
        </View>
        <Toggle.Switch />
      </Toggle.Item>

      {isOn ? (
        <>
          <ChoiceChips
            label={l`Round to`}
            value={String(roundTo)}
            style={{paddingLeft: 48}}
            onChange={picked => {
              const unit = Number(picked) as (typeof ROUND_UNITS)[number]
              update(f => ({...f, roundTo: unit}))
              onChanged(unit)
            }}
            options={ROUND_UNITS.map(unit => ({value: String(unit), label: unitText(unit), accessibilityLabel: l`Round to ${unitText(unit)}`, testID: `cash-unit-${unit}`}))}
          />
          {cash ? (
            <Text
              testID="cash-remainder"
              style={[
                a.text_sm,
                a.leading_snug,
                t.atoms.text_contrast_high,
                {paddingLeft: 48, fontVariant: ['tabular-nums']},
              ]}>
              {cash.isExact
                ? l`The total is too small to round to ${unitText(roundTo)} for everyone, so it is split exactly. Everything adds up to ${fmt(evaluation.total!)}.`
                : cash.remainder !== ZERO && cash.remainderTo === actor
                ? l`${fmt(cash.remainder)} doesn’t round to ${unitText(roundTo)}, so it goes on your share. Everything still adds up to ${fmt(evaluation.total!)}.`
                : cash.remainder !== ZERO && cash.remainderTo
                  ? l`${fmt(cash.remainder)} doesn’t round to ${unitText(roundTo)}, so it goes on ${name(cash.remainderTo)}’s share. Everything still adds up to ${fmt(evaluation.total!)}.`
                  : l`Every share is a whole multiple of ${unitText(roundTo)} and they add up to ${fmt(evaluation.total!)}.`}
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
  )
}
