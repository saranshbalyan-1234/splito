import {ScrollView, View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {formatAmount, getCurrency, toDecimalString, ZERO} from '@splito/domain'
import {nanoid} from 'nanoid/non-secure'

import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, tokens, useTheme, web} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as TextField from '#/components/forms/TextField'
import * as Toggle from '#/components/forms/Toggle'
import {
  ArrowBottom_Stroke2_Corner0_Rounded as ArrowDownIcon,
  ArrowTop_Stroke2_Corner0_Rounded as ArrowUpIcon,
} from '#/components/icons/Arrow'
import {Check_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/Check'
import {PersonPlus_Filled_Stroke2_Corner0_Rounded as PersonPlusIcon} from '#/components/icons/Person'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import {TimesLarge_Stroke2_Corner0_Rounded as XIcon} from '#/components/icons/Times'
import {Text} from '#/components/Typography'
import {FieldError, MoneyInput, PercentInput} from './fields'
import {
  type ExpenseForm,
  type FormEvaluation,
  SPLIT_MODES,
  type SplitMode,
} from './form'
import {MinusIcon} from './icons'
import {useAvatarName, useDisplayName, useErrorText} from './shared'

type Update = (fn: (f: ExpenseForm) => ExpenseForm) => void

/** A cap on one person's portions of one item, so a stray tap never runs away. */
const MAX_PORTIONS = 9

/**
 * The split section of the expense form: a segmented control for the mode
 * (equal, exact, percent, shares, equal with adjustments, itemised) and one
 * row per person with that mode's input and their resulting share.
 */
export function SplitEditor({
  form,
  update,
  evaluation,
  locale,
  onAddPeople,
}: {
  form: ExpenseForm
  update: Update
  evaluation: FormEvaluation
  locale: string
  onAddPeople: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()

  const labels: Record<SplitMode, string> = {
    equal: l`Equally`,
    exact: l`Exact`,
    percent: l`Percent`,
    shares: l`Shares`,
    adjusted: l`Adjust`,
    items: l`Itemize`,
  }
  const help: Record<SplitMode, string> = {
    equal: l`Everyone ticked pays the same.`,
    exact: l`Type what each person owes.`,
    percent: l`Give each person a percentage.`,
    shares: l`Split by shares – say 2 for a couple, 1 for everyone else.`,
    adjusted: l`Split equally, then add or take away an amount for someone.`,
    items: l`Add the bill’s items and pick who had each. Tax and tip follow what people had.`,
  }

  return (
    <View>
      <View style={[a.px_lg, a.pb_sm]}>
        {/* One row of choice chips on every width; it scrolls sideways when six do not fit. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[{marginHorizontal: -tokens.space.lg}]}
          contentContainerStyle={[a.px_lg]}>
          <View
            role="radiogroup"
            accessibilityLabel={l`How to split`}
            style={[a.flex_row, a.gap_xs]}>
            {SPLIT_MODES.map(mode => {
              const isOn = form.mode === mode
              return (
                <Button
                  key={mode}
                  testID={`split-mode-${mode}`}
                  label={labels[mode]}
                  role="radio"
                  aria-checked={isOn}
                  accessibilityState={{checked: isOn}}
                  size="small"
                  color={isOn ? 'primary' : 'secondary'}
                  onPress={() =>
                    update(f => (f.mode === mode ? f : {...f, mode}))
                  }>
                  <ButtonText>{labels[mode]}</ButtonText>
                </Button>
              )
            })}
          </View>
        </ScrollView>
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
      {form.mode === 'items' ? (
        <ItemsEditor
          form={form}
          update={update}
          evaluation={evaluation}
          locale={locale}
        />
      ) : (
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
          <View style={[a.px_lg, a.pt_xs]}>
            <Button
              testID="split-add-people"
              label={l`Add people`}
              size="small"
              color="secondary"
              onPress={onAddPeople}
              style={[a.self_start]}>
              <ButtonIcon icon={PersonPlusIcon} />
              <ButtonText>
                <Trans>Add people</Trans>
              </ButtonText>
            </Button>
          </View>
        </View>
      )}
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
        ? formatAmount(share, form.currency, locale)
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
}: {
  value: number
  onChange: (v: number) => void
  label: string
  testID?: string
}) {
  const {t: l} = useLingui()
  return (
    <View
      style={[a.flex_row, a.align_center, a.gap_sm]}
      accessibilityLabel={label}>
      <Button
        testID={testID ? `${testID}-minus` : undefined}
        label={l`Fewer shares`}
        size="small"
        color="secondary"
        shape="round"
        disabled={value <= 0}
        onPress={() => onChange(Math.max(0, value - 1))}>
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
        label={l`More shares`}
        size="small"
        color="secondary"
        shape="round"
        disabled={value >= 99}
        onPress={() => onChange(Math.min(99, value + 1))}>
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
}: {
  form: ExpenseForm
  update: Update
  evaluation: FormEvaluation
  locale: string
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const name = useDisplayName()
  const avatarName = useAvatarName()
  const errorText = useErrorText()

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
    {key: 'discount', label: l`Discount`},
  ] as const

  return (
    <View style={[a.px_lg, a.gap_sm]}>
      {form.items.map((item, index) => {
        const error = evaluation.rowErrors[`item:${item.key}`]
        return (
          <View
            key={item.key}
            testID={`item-${index}`}
            style={[a.p_md, a.gap_sm, a.rounded_md, t.atoms.bg_contrast_25]}>
            <View style={[a.flex_row, a.align_center, a.gap_xs]}>
              <View style={[a.flex_1]}>
                <TextField.Root>
                  <TextField.Input
                    testID={`item-${index}-name`}
                    label={l`Item name`}
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
                width={120}
                onChangeText={v => setItem(item.key, {amount: v})}
              />
              {form.items.length > 1 && (
                <View style={[a.flex_row]}>
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
                </View>
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
            {/*
             * Who had it: a tap adds someone, another tap gives them one more
             * portion ("2 of 3 beers"), a long press or right-click takes
             * them off. "Everyone" puts the whole split on it, one each.
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
                      setItem(item.key, {people: [...form.people], portions: {}})
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
                        ? l`Tap for one more portion; hold to take them off`
                        : l`Adds them to this item`
                    }
                    accessibilityState={{selected: isOn}}
                    aria-pressed={isOn}
                    size="tiny"
                    variant="outline"
                    color={isOn ? 'primary' : 'secondary'}
                    onPress={() =>
                      setItem(
                        item.key,
                        isOn
                          ? {
                              portions: {
                                ...item.portions,
                                [id]: Math.min(portions + 1, MAX_PORTIONS),
                              },
                            }
                          : {people: [...item.people, id]},
                      )
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
                      <Text
                        testID={`item-${index}-portions-${name(id)}`}
                        style={[
                          a.text_xs,
                          a.font_bold,
                          {color: t.palette.primary_500},
                        ]}>
                        ×{portions}
                      </Text>
                    ) : isOn ? (
                      <ButtonIcon icon={CheckIcon} size="xs" />
                    ) : null}
                  </Button>
                )
              })}
            </View>
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
              {key: nanoid(8), name: '', amount: '', people: [...f.people]},
            ],
          }))
        }
        style={[a.self_start]}>
        <ButtonIcon icon={PlusIcon} />
        <ButtonText>
          <Trans>Add item</Trans>
        </ButtonText>
      </Button>

      <View style={[a.pt_sm]}>
        {extras.map(x => (
          <View
            key={x.key}
            style={[a.flex_row, a.align_center, a.justify_between, a.py_xs]}>
            <Text style={[a.text_md]}>{x.label}</Text>
            <MoneyInput
              testID={`item-${x.key}`}
              label={x.label}
              currency={form.currency}
              value={form[x.key]}
              isInvalid={!!evaluation.rowErrors[x.key]}
              width={140}
              onChangeText={v => update(f => ({...f, [x.key]: v}))}
            />
          </View>
        ))}
      </View>

      {evaluation.itemsTotal !== undefined &&
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
              Items, tax and tip come to{' '}
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
                amount: toDecimalString(
                  evaluation.itemsTotal!,
                  getCurrency(f.currency).scale,
                ),
              }))
            }>
            <ButtonText>
              <Trans>Use as total</Trans>
            </ButtonText>
          </Button>
        </View>
      ) : null}
    </View>
  )
}
