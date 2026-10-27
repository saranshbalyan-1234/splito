import {useState} from 'react'
import {ScrollView, View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {decimalMark, formatAmount, ZERO} from '@splito/domain'
import {
  type ChargeTemplate,
  merchantKey,
  MERCHANT_SETUPS_MAX,
  PREFS,
} from '@splito/sync'
import {nanoid} from 'nanoid/non-secure'

import {useHaptics} from '#/lib/haptics'
import {useA11y} from '#/state/a11y'
import {atoms as a, tokens, useBreakpoints, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {useDialogControl} from '#/components/Dialog'
import {SortableList} from '#/components/DraggableList'
import {
  ArrowBottom_Stroke2_Corner0_Rounded as ArrowDownIcon,
  ArrowTop_Stroke2_Corner0_Rounded as ArrowUpIcon,
} from '#/components/icons/Arrow'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import {TimesLarge_Stroke2_Corner0_Rounded as XIcon} from '#/components/icons/Times'
import {usePrefControl} from '#/components/settings/PrefSection'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'
import {type ExpenseForm, type FormEvaluation} from '../form'
import {
  type ChargeForm,
  chargesFromTemplates,
  emptyCharge,
  templatesFromCharges,
} from './chargeForm'
import {ChargeSheet} from './ChargeSheet'
import {useChargePresets, useKindName, useTaxClasses} from './hooks'
import {LayersIcon} from './icons'
import {Reconciliation} from './Reconciliation'

type Update = (fn: (f: ExpenseForm) => ExpenseForm) => void

const ROW_HEIGHT = 64

/** Two setups are the same when their charges match field for field. */
function isSameSetup(x: ChargeTemplate[], y: ChargeTemplate[]) {
  const norm = (c: ChargeTemplate) =>
    JSON.stringify([
      c.name,
      c.kind,
      c.mode,
      c.basisPoints ?? null,
      c.classes ?? null,
      c.stacksOn,
      c.inclusive ?? false,
    ])
  return x.length === y.length && x.every((c, n) => norm(c) === norm(y[n]!))
}

/** "Service 10% · GST 5%": a setup in a line. */
function useSetupSummary() {
  const {t: l} = useLingui()
  return (templates: ChargeTemplate[], locale: string) => {
    const pct = new Intl.NumberFormat(locale, {maximumFractionDigits: 2})
    return templates
      .map(c =>
        c.mode === 'percent'
          ? `${c.name} ${pct.format((c.basisPoints ?? 0) / 100)}%`
          : c.name,
      )
      .join(' · ') || l`No charges`
  }
}

/**
 * One-tap charge setups for an itemised bill (F-403): Simple (the four plain
 * rows) and the presets, then the setup remembered for this merchant as a
 * dashed suggestion to accept with one tap.
 */
export function ChargePresets({
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
  const haptics = useHaptics()
  const presets = useChargePresets()
  const summary = useSetupSummary()
  const isRemembering = usePrefControl('bill.rememberPerMerchant').value ?? true
  const setups = usePrefControl('bill.merchantSetups').value ?? []
  const mark = decimalMark(locale)

  const current = form.charges ? templatesFromCharges(form.charges) : undefined
  const activeId = current
    ? (presets.find(p => p.id !== 'simple' && isSameSetup(p.charges, current))
        ?.id ?? 'custom')
    : 'simple'
  const setup = isRemembering
    ? setups.find(s => s.key === merchantKey(form.title))
    : undefined
  /* Offered while nothing is set up yet; accepting it fills the list. */
  const isSuggesting =
    !!setup && setup.charges.length > 0 && (form.charges?.length ?? 0) === 0

  const apply = (templates: ChargeTemplate[] | undefined) => {
    haptics.selection()
    update(f => ({
      ...f,
      charges: templates && chargesFromTemplates(templates, () => nanoid(8), mark),
      roundOff: undefined,
    }))
  }

  return (
    <View style={[a.gap_sm]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[{marginHorizontal: -tokens.space.lg}]}
        contentContainerStyle={[a.px_lg]}>
        <View
          role="radiogroup"
          accessibilityLabel={l`Charge setup`}
          style={[a.flex_row, a.gap_xs]}>
          {presets.map(p => {
            const isOn = activeId === p.id
            return (
              <Button
                key={p.id}
                testID={`charge-preset-${p.id}`}
                label={p.name}
                role="radio"
                aria-checked={isOn}
                accessibilityState={{checked: isOn}}
                size="small"
                color={isOn ? 'primary' : 'secondary'}
                onPress={() => apply(p.id === 'simple' ? undefined : p.charges)}>
                <ButtonText>{p.name}</ButtonText>
              </Button>
            )
          })}
          <Button
            testID="charge-preset-custom"
            label={l`Custom`}
            role="radio"
            aria-checked={activeId === 'custom'}
            accessibilityState={{checked: activeId === 'custom'}}
            size="small"
            color={activeId === 'custom' ? 'primary' : 'secondary'}
            onPress={() => {
              /* An open list of your own: keep the charges you have, or start empty. */
              if (form.charges === undefined) apply([])
            }}>
            <ButtonText>
              <Trans>Custom</Trans>
            </ButtonText>
          </Button>
        </View>
      </ScrollView>
      {isSuggesting ? (
        <Button
          testID="charges-suggestion"
          label={l`Use the charges from your last bill at ${setup.name}`}
          onPress={() => apply(setup.charges)}
          style={[
            a.flex_row,
            a.align_center,
            a.gap_md,
            a.p_md,
            a.rounded_md,
            a.border,
            t.atoms.border_contrast_high,
            {borderStyle: 'dashed'},
          ]}>
          <View style={[a.flex_1, a.gap_2xs]}>
            <Text style={[a.text_sm, a.font_semi_bold]} numberOfLines={1}>
              <Trans>Same as last time at {setup.name}?</Trans>
            </Text>
            <Text
              style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}
              numberOfLines={2}>
              {summary(setup.charges, locale)}
            </Text>
          </View>
          <Text style={[a.text_sm, a.font_semi_bold, {color: t.palette.primary_500}]}>
            <Trans>Use</Trans>
          </Text>
        </Button>
      ) : null}
    </View>
  )
}

/**
 * The charge list of an itemised bill: drag to reorder (the order is the
 * stacking order), tap a row to change it, add a charge, remember the setup
 * for this merchant, and the reconciliation against the printed total.
 */
export function ChargeList({
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
  const haptics = useHaptics()
  const {screenReaderEnabled} = useA11y()
  const {gtMobile} = useBreakpoints()
  const kindName = useKindName()
  const {nameOf} = useTaxClasses()
  const dialog = useDialogControl()
  const [editing, setEditing] = useState<ChargeForm>(() => emptyCharge('new'))
  const isRemembering = usePrefControl('bill.rememberPerMerchant').value ?? true
  const merchants = usePrefControl('bill.merchantSetups')
  const setups = merchants.value ?? PREFS['bill.merchantSetups'].default
  const saveSetups = merchants.set
  const charges = form.charges ?? []
  const showArrows = (IS_WEB && gtMobile) || screenReaderEnabled
  const fmt = (v: bigint) => formatAmount(v, form.currency, locale)
  const pct = new Intl.NumberFormat(locale, {maximumFractionDigits: 2})
  const title = form.title.trim()

  const setCharges = (next: ChargeForm[]) =>
    update(f => ({...f, charges: next}))
  const move = (index: number, by: -1 | 1) => {
    const next = [...charges]
    const [moved] = next.splice(index, 1)
    next.splice(index + by, 0, moved!)
    haptics.selection()
    setCharges(next)
  }
  const open = (charge: ChargeForm) => {
    setEditing(charge)
    dialog.open()
  }

  const scopeText = (c: ChargeForm) =>
    c.scope.type === 'all'
      ? l`all items`
      : c.scope.type === 'classes'
        ? c.scope.classes.map(nameOf).join(' + ')
        : l`${c.scope.items.length} chosen items`

  const saveSetup = () => {
    const templates = templatesFromCharges(charges)
    if (templates.length === 0) return
    haptics.success()
    const key = merchantKey(title)
    void saveSetups(
      [
        {key, name: title, charges: templates},
        ...setups.filter(s => s.key !== key),
      ].slice(0, MERCHANT_SETUPS_MAX),
    )
    Toast.show(l`Saved the charges for ${title}`, {type: 'success'})
  }

  return (
    <View style={[a.gap_sm]}>
      {charges.length > 0 ? (
        <View
          testID="charge-list"
          style={[
            a.rounded_md,
            a.overflow_hidden,
            a.border,
            t.atoms.border_contrast_low,
          ]}>
          <SortableList
            data={charges}
            keyExtractor={c => c.key}
            itemHeight={ROW_HEIGHT}
            onReorder={setCharges}
            renderItem={(charge, dragHandle) => {
              const index = charges.indexOf(charge)
              const line = evaluation.bill?.lines[index]
              const hasError = !!evaluation.rowErrors[`charge:${charge.key}`]
              return (
                <View
                  testID={`charge-${index}`}
                  style={[
                    a.flex_row,
                    a.align_center,
                    a.gap_xs,
                    a.pr_xs,
                    t.atoms.bg,
                    index < charges.length - 1 && [
                      a.border_b,
                      t.atoms.border_contrast_low,
                    ],
                    {height: ROW_HEIGHT},
                  ]}>
                  {dragHandle}
                  <Button
                    testID={`charge-${index}-edit`}
                    label={l`Edit ${charge.name}`}
                    onPress={() => open(charge)}
                    style={[a.flex_1, a.flex_row, a.align_center, a.gap_sm]}>
                    <View style={[a.flex_1, a.gap_2xs]}>
                      <Text
                        numberOfLines={1}
                        style={[a.text_md, a.font_semi_bold, a.leading_snug]}>
                        {charge.name}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={[
                          a.text_sm,
                          a.leading_snug,
                          hasError
                            ? {color: t.palette.negative_500}
                            : t.atoms.text_contrast_medium,
                        ]}>
                        {[
                          charge.mode === 'percent'
                            ? `${charge.value ? pct.format(Number(charge.value.replace(',', '.'))) : '0'}%`
                            : charge.value || kindName(charge.kind),
                          l`on ${scopeText(charge)}`,
                          ...(charge.stacksOn === 'earlier' ? [l`+ earlier charges`] : []),
                          ...(charge.inclusive ? [l`included`] : []),
                        ].join(' · ')}
                      </Text>
                    </View>
                    <Text
                      testID={`charge-${index}-amount`}
                      style={[
                        a.text_md,
                        a.font_semi_bold,
                        line?.isInclusive && t.atoms.text_contrast_low,
                        {fontVariant: ['tabular-nums']},
                      ]}>
                      {line && line.amount !== ZERO ? fmt(line.amount) : '–'}
                    </Text>
                  </Button>
                  {showArrows ? (
                    <>
                      <Button
                        label={l`Move ${charge.name} up`}
                        onPress={() => move(index, -1)}
                        disabled={index === 0}
                        size="small"
                        color="secondary"
                        variant="ghost"
                        shape="round">
                        <ButtonIcon icon={ArrowUpIcon} />
                      </Button>
                      <Button
                        label={l`Move ${charge.name} down`}
                        onPress={() => move(index, 1)}
                        disabled={index === charges.length - 1}
                        size="small"
                        color="secondary"
                        variant="ghost"
                        shape="round">
                        <ButtonIcon icon={ArrowDownIcon} />
                      </Button>
                    </>
                  ) : null}
                  <Button
                    testID={`charge-${index}-remove`}
                    label={l`Remove ${charge.name}`}
                    onPress={() => {
                      haptics.selection()
                      setCharges(charges.filter(c => c.key !== charge.key))
                    }}
                    size="small"
                    color="secondary"
                    variant="ghost"
                    shape="round">
                    <ButtonIcon icon={XIcon} />
                  </Button>
                </View>
              )
            }}
          />
        </View>
      ) : (
        <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>
            No charges yet. Add the service charge, taxes and anything else on
            the bill.
          </Trans>
        </Text>
      )}

      <View style={[a.flex_row, a.flex_wrap, a.gap_sm]}>
        <Button
          testID="charge-add"
          label={l`Add charge`}
          size="small"
          color="secondary"
          onPress={() => open(emptyCharge(nanoid(8)))}
          style={[a.self_start]}>
          <ButtonIcon icon={PlusIcon} />
          <ButtonText>
            <Trans>Add charge</Trans>
          </ButtonText>
        </Button>
        {isRemembering && title && charges.some(c => c.scope.type !== 'items') ? (
          <Button
            testID="charge-save-setup"
            label={l`Save as preset for ${title}`}
            size="small"
            color="secondary"
            onPress={saveSetup}
            style={[a.self_start]}>
            <ButtonIcon icon={LayersIcon} />
            <ButtonText numberOfLines={1}>
              <Trans>Save as preset for {title}</Trans>
            </ButtonText>
          </Button>
        ) : null}
      </View>

      <Reconciliation
        form={form}
        update={update}
        evaluation={evaluation}
        locale={locale}
      />

      <ChargeSheet
        control={dialog}
        charge={editing}
        currency={form.currency}
        items={form.items.map((item, n) => ({
          key: item.key,
          label: item.name || l`Item ${n + 1}`,
        }))}
        onChargeSaved={saved =>
          setCharges(
            charges.some(c => c.key === saved.key)
              ? charges.map(c => (c.key === saved.key ? saved : c))
              : [...charges, saved],
          )
        }
      />
    </View>
  )
}
