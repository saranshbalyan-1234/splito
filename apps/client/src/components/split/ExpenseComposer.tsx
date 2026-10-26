import {useEffect, useState} from 'react'
import {KeyboardAvoidingView, ScrollView, View} from 'react-native'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {decimalMark, formatAmount, magnitude, ZERO} from '@splito/domain'
import {
  createExpense,
  type Group,
  type Person,
  updateExpense,
} from '@splito/sync'

import {type NavigationProp} from '#/lib/routes/types'
import {useNumberLocale} from '#/locale/numberLocale'
import {useEntities, useMutationCtx, useStore} from '#/data/hooks'
import {atoms as a, useBreakpoints, useTheme, web} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Composer from '#/components/Composer'
import * as Dialog from '#/components/Dialog'
import {Divider} from '#/components/Divider'
import * as Prompt from '#/components/Prompt'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {IS_IOS} from '#/env'
import {SuccessCheck} from '#/motion/SuccessCheck'
import {DateDialog} from './DateDialog'
import {clearDraft, type DraftContext, writeDraft} from './drafts'
import {AmountField, DetailRow, FieldError, PlainInput} from './fields'
import {
  evaluateForm,
  type ExpenseForm,
  type FormEvaluation,
  hasContent,
} from './form'
import {Person_Stroke2_Corner2_Rounded as PersonIcon} from '#/components/icons/Person'
import {CalendarIcon, GroupIcon, NotesIcon, WalletIcon} from './icons'
import {PayersDialog} from './PayersDialog'
import {PeopleDialog} from './PeopleDialog'
import {CategoryDialog, CurrencyDialog, GroupDialog} from './pickers'
import {
  CategoryTile,
  localToday,
  SectionLabel,
  useCategories,
  useCategory,
  useDisplayName,
  useErrorText,
  useFormatDay,
} from './shared'
import {SplitEditor} from './SplitEditor'
import {suggestCategory} from './suggestCategory'

/**
 * The Add / Edit expense form inside Bluesky's composer: Cancel and the Save
 * pill on top, the title beside its category (where Bluesky puts the
 * avatar), a calculator amount, detail rows, the split, notes, and a footer
 * with the live "left to assign" readout (where Bluesky shows its character
 * counter). Save stays disabled until the expense passes `validateExpense`.
 */
export function ExpenseComposer({
  testID,
  initialForm,
  freshForm,
  expenseId,
  tz,
  draftContext,
  isDraftRestored = false,
  onClose,
}: {
  testID: string
  initialForm: ExpenseForm
  /** Add mode: the empty form "Start over" resets to. */
  freshForm?: ExpenseForm
  /** Edit mode: the expense being changed. */
  expenseId?: string
  /** Timezone the expense is stamped with. */
  tz: string
  /** Add mode: keeps a device draft for this place. */
  draftContext?: DraftContext
  isDraftRestored?: boolean
  onClose: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {gtMobile} = useBreakpoints()
  const store = useStore()
  const ctx = useMutationCtx()
  const navigation = useNavigation<NavigationProp>()
  const locale = useNumberLocale()
  const categories = useCategories()
  const groups = useEntities<Group>('group')
  const people = useEntities<Person>('person')
  const name = useDisplayName()
  const errorText = useErrorText()
  const formatDay = useFormatDay()

  const [form, setForm] = useState(initialForm)
  const [showRestored, setShowRestored] = useState(isDraftRestored)
  const [isSaving, setIsSaving] = useState(false)
  const [savedId, setSavedId] = useState<string>()
  const evaluation = evaluateForm(form, tz, decimalMark(locale))
  const category = useCategory(form.category)
  const isEdit = !!expenseId
  const isDirty = form !== initialForm

  const update = (fn: (f: ExpenseForm) => ExpenseForm) => setForm(fn)

  const currencyControl = Dialog.useDialogControl()
  const dateControl = Dialog.useDialogControl()
  const categoryControl = Dialog.useDialogControl()
  const groupControl = Dialog.useDialogControl()
  const peopleControl = Dialog.useDialogControl()
  const payersControl = Dialog.useDialogControl()
  const closePromptControl = Prompt.usePromptControl()

  /* Drafts survive closing: every change is kept on the device until Save or Discard. */
  useEffect(() => {
    if (!draftContext || savedId || form === initialForm) return
    if (hasContent(form)) writeDraft(form, draftContext)
    else clearDraft()
  }, [form, draftContext, savedId, initialForm])

  /* Edits have no draft, so a swipe-down on the iOS sheet must not drop them silently. */
  useEffect(() => {
    if (isEdit) navigation.setOptions({gestureEnabled: !isDirty})
  }, [isEdit, isDirty, navigation])

  const group = form.groupId
    ? groups?.find(g => g.id === form.groupId)
    : undefined
  const members = group?.data.members
    .filter(m => m.leftAt === null)
    .map(m => m.personId)
  const friends = (people ?? [])
    .filter(p => !p.data.isMe)
    .sort((x, y) => x.data.name.localeCompare(y.data.name))
    .map(p => p.id)
  const candidates = members ?? [ctx.actor, ...friends]

  const setPeople = (ids: string[]) =>
    update(f => {
      const next = [
        ...candidates.filter(id => ids.includes(id)),
        ...ids.filter(id => !candidates.includes(id)),
      ]
      return {
        ...f,
        people: next,
        payer: next.includes(f.payer) ? f.payer : (next[0] ?? ctx.actor),
        excluded: f.excluded.filter(p => next.includes(p)),
        items: f.items.map(i => ({
          ...i,
          people: i.people.filter(p => next.includes(p)),
        })),
      }
    })

  const selectGroup = (groupId: string | null) =>
    update(f => {
      if (!groupId) return {...f, groupId: null}
      const g = groups?.find(x => x.id === groupId)
      if (!g) return f
      const ids = g.data.members
        .filter(m => m.leftAt === null)
        .map(m => m.personId)
      const next = [
        ...ids.filter(id => id === ctx.actor),
        ...ids.filter(id => id !== ctx.actor),
      ]
      return {
        ...f,
        groupId,
        currency: g.data.currency,
        people: next,
        payer: next.includes(f.payer) ? f.payer : (next[0] ?? ctx.actor),
        excluded: [],
        items: f.items.map(i => ({
          ...i,
          people: i.people.filter(p => next.includes(p)),
        })),
      }
    })

  const setTitle = (title: string) =>
    update(f => ({
      ...f,
      title,
      category: f.isCategoryPicked
        ? f.category
        : (suggestCategory(title, categories) ?? f.category),
    }))

  const finish = (id: string) => {
    onClose()
    if (!isEdit) {
      Toast.show(
        <Toast.Outer>
          <Toast.Icon />
          <Toast.Text>
            <Trans>Expense added</Trans>
          </Toast.Text>
          <Toast.Action
            label={l`View expense`}
            onPress={() => navigation.navigate('Expense', {expenseId: id})}>
            <Trans>View</Trans>
          </Toast.Action>
        </Toast.Outer>,
        {type: 'success'},
      )
    }
  }

  const save = async () => {
    const draft = evaluation.draft
    if (!draft || isSaving || savedId) return
    setIsSaving(true)
    try {
      const saved = expenseId
        ? await updateExpense(store, ctx, expenseId, draft)
        : await createExpense(store, ctx, draft)
      if (draftContext) clearDraft()
      setSavedId(saved.id)
    } catch (e) {
      setIsSaving(false)
      Toast.show(errorText((e as {code?: string}).code ?? ''), {type: 'error'})
    }
  }

  const requestClose = () => {
    if (savedId) return
    if (isDirty && (isEdit || hasContent(form))) closePromptControl.open()
    else onClose()
  }

  const first = form.people[0] ? name(form.people[0]) : ''
  const second = form.people[1] ? name(form.people[1]) : ''
  const rest = form.people.length - 2
  const peopleSummary =
    form.people.length === 0
      ? l`Nobody yet`
      : form.people.length <= 2
        ? form.people.map(name).join(', ')
        : l`${first}, ${second} +${rest}`

  const today = localToday(tz)
  const isUpcoming = form.date > today
  const payersValue =
    form.payerMode === 'single'
      ? name(form.payer)
      : evaluation.payersRemaining !== undefined &&
          evaluation.payersRemaining !== ZERO
        ? evaluation.payersRemaining > ZERO
          ? l`${formatAmount(evaluation.payersRemaining, form.currency, locale)} left to pay`
          : l`${formatAmount(magnitude(evaluation.payersRemaining), form.currency, locale)} too much`
        : l`${Object.keys(evaluation.draft?.payers ?? form.paid).length} people`
  const isPayersOff =
    form.payerMode === 'multiple' &&
    evaluation.payersRemaining !== undefined &&
    evaluation.payersRemaining !== ZERO

  return (
    <Composer.Outer testID={testID} onDismiss={requestClose}>
      <Composer.TopBar
        onCancel={requestClose}
        onSave={() => void save()}
        canSave={!!evaluation.draft && !savedId}
        isSaving={isSaving}
        saveLabel={isEdit ? l`Save changes` : l`Save expense`}
        cancelHint={
          isEdit
            ? l`Closes without saving your changes`
            : l`Closes Add expense; your draft is kept`
        }>
        <Text
          style={[a.text_sm, a.pr_sm, t.atoms.text_contrast_medium]}
          numberOfLines={1}>
          {isEdit ? <Trans>Edit expense</Trans> : <Trans>New expense</Trans>}
        </Text>
      </Composer.TopBar>

      <KeyboardAvoidingView
        behavior={IS_IOS ? 'padding' : undefined}
        style={[a.flex_1, web(a.flex_shrink)]}>
        <ScrollView
          testID="expense-form"
          keyboardShouldPersistTaps="handled"
          style={[a.flex_1, web([a.flex_shrink, {minHeight: 0}])]}
          contentContainerStyle={[a.pb_2xl]}>
          {showRestored && freshForm ? (
            <View
              style={[
                a.mx_lg,
                a.mb_sm,
                a.px_md,
                a.py_sm,
                a.rounded_sm,
                a.flex_row,
                a.align_center,
                a.gap_sm,
                t.atoms.bg_contrast_25,
              ]}>
              <Text
                style={[
                  a.flex_1,
                  a.text_sm,
                  a.leading_snug,
                  t.atoms.text_contrast_high,
                ]}>
                <Trans>We kept your unsaved expense.</Trans>
              </Text>
              <Button
                testID="draft-start-over"
                label={l`Start over`}
                size="tiny"
                variant="ghost"
                color="primary"
                onPress={() => {
                  clearDraft()
                  setShowRestored(false)
                  setForm(freshForm)
                }}>
                <ButtonText>
                  <Trans>Start over</Trans>
                </ButtonText>
              </Button>
            </View>
          ) : null}

          {/* Title, with the category where Bluesky's composer has the avatar. */}
          <View style={[a.flex_row, a.align_start, a.gap_md, a.px_lg, a.pt_sm]}>
            <Button
              testID="expense-category"
              label={l`Category: ${category.name}. Change`}
              onPress={() => categoryControl.open()}
              style={[a.rounded_sm]}>
              <CategoryTile category={category} size={42} />
            </Button>
            <View style={[a.flex_1, a.gap_2xs]}>
              <PlainInput
                testID="expense-title"
                value={form.title}
                onChangeText={setTitle}
                placeholder={l`What was it for?`}
                accessibilityLabel={l`Title`}
                autoFocus={!isEdit && gtMobile}
                maxLength={120}
                spellCheck={false}
                returnKeyType="next"
                style={[a.text_xl, a.font_medium, {paddingVertical: 2}]}
              />
              <Text
                testID="expense-category-name"
                style={[a.text_sm, t.atoms.text_contrast_medium]}
                numberOfLines={1}>
                {category.name}
                {!form.isCategoryPicked &&
                form.title.trim() &&
                category.id !== 'other'
                  ? ` · ${l`suggested`}`
                  : ''}
              </Text>
            </View>
          </View>

          <AmountField
            value={form.amount}
            onChangeText={amount => update(f => ({...f, amount}))}
            currency={form.currency}
            locale={locale}
            result={evaluation.total}
            errorText={
              evaluation.amountError
                ? errorText(evaluation.amountError)
                : undefined
            }
            onPressCurrency={() => currencyControl.open()}
          />

          <Divider />
          <DetailRow
            testID="expense-date"
            icon={CalendarIcon}
            label={l`Date`}
            value={formatDay(form.date)}
            onPress={() => dateControl.open()}
            accessory={isUpcoming ? <UpcomingTag /> : null}
          />
          <DetailRow
            testID="expense-group"
            icon={GroupIcon}
            label={l`Group`}
            value={group ? group.data.name : l`No group`}
            onPress={() => groupControl.open()}
          />
          <DetailRow
            testID="expense-people"
            icon={PersonIcon}
            label={l`Split with`}
            value={peopleSummary}
            onPress={() => peopleControl.open()}
          />
          <DetailRow
            testID="expense-payers"
            icon={WalletIcon}
            label={l`Paid by`}
            value={payersValue}
            valueColor={isPayersOff ? t.palette.negative_500 : undefined}
            onPress={() => payersControl.open()}
          />
          <Divider />

          <SectionLabel>
            <Trans>Split</Trans>
          </SectionLabel>
          <SplitEditor
            form={form}
            update={update}
            evaluation={evaluation}
            locale={locale}
            onAddPeople={() => peopleControl.open()}
          />

          <SectionLabel>
            <Trans>Notes</Trans>
          </SectionLabel>
          <View style={[a.flex_row, a.align_start, a.gap_md, a.px_lg]}>
            <NotesIcon
              size="md"
              fill={t.atoms.text_contrast_medium.color}
              style={[{marginTop: 2}]}
            />
            <PlainInput
              testID="expense-notes"
              value={form.notes}
              onChangeText={notes => update(f => ({...f, notes}))}
              placeholder={l`Add a note (optional)`}
              accessibilityLabel={l`Notes`}
              multiline
              maxLength={1000}
              style={[a.flex_1, {lineHeight: 20, minHeight: 44, paddingTop: 0}]}
            />
          </View>
        </ScrollView>

        <Footer
          form={form}
          evaluation={evaluation}
          locale={locale}
          isDirty={isDirty}
        />
      </KeyboardAvoidingView>

      {savedId ? (
        <View
          testID="expense-saved"
          style={[
            a.absolute,
            a.inset_0,
            a.z_50,
            a.align_center,
            a.justify_center,
            a.gap_lg,
            t.atoms.bg,
          ]}>
          <SuccessCheck
            size={72}
            onCheckShown={() => setTimeout(() => finish(savedId), 350)}
          />
          <Text style={[a.text_xl, a.font_semi_bold]}>
            {isEdit ? (
              <Trans>Changes saved</Trans>
            ) : (
              <Trans>Expense added</Trans>
            )}
          </Text>
        </View>
      ) : null}

      <CurrencyDialog
        control={currencyControl}
        value={form.currency}
        onSelect={currency => update(f => ({...f, currency}))}
      />
      <DateDialog
        control={dateControl}
        title={l`Date`}
        value={form.date}
        onSelect={date => update(f => ({...f, date}))}
      />
      <CategoryDialog
        control={categoryControl}
        categories={categories}
        value={form.category}
        onSelect={id =>
          update(f => ({...f, category: id, isCategoryPicked: true}))
        }
      />
      <GroupDialog
        control={groupControl}
        groups={groups ?? []}
        value={form.groupId}
        onSelect={selectGroup}
      />
      <PeopleDialog
        control={peopleControl}
        title={l`Split with`}
        description={
          group
            ? l`Members of ${group.data.name}`
            : l`Add friends, or type a new name to add someone without an account.`
        }
        candidates={candidates}
        selected={form.people}
        allowNew={!group}
        onChange={setPeople}
      />
      <PayersDialog
        control={payersControl}
        form={form}
        update={update}
        evaluation={evaluation}
        locale={locale}
      />

      {isEdit ? (
        <Prompt.Basic
          control={closePromptControl}
          title={l`Discard changes?`}
          description={l`Your edits to this expense won’t be saved.`}
          confirmButtonCta={l`Discard`}
          confirmButtonColor="negative"
          cancelButtonCta={l`Keep editing`}
          onConfirm={onClose}
        />
      ) : (
        <Prompt.Outer
          control={closePromptControl}
          testID="expense-close-prompt">
          <Prompt.Content>
            <Prompt.TitleText>
              <Trans>Save draft?</Trans>
            </Prompt.TitleText>
            <Prompt.DescriptionText>
              <Trans>
                Would you like to keep this as a draft to finish later?
              </Trans>
            </Prompt.DescriptionText>
          </Prompt.Content>
          <Prompt.Actions>
            <Prompt.Action
              testID="draft-save"
              cta={l`Save draft`}
              color="primary"
              onPress={onClose}
            />
            <Prompt.Cancel cta={l`Keep editing`} />
            <Prompt.Action
              testID="draft-discard"
              cta={l`Discard`}
              color="negative_subtle"
              onPress={() => {
                clearDraft()
                onClose()
              }}
            />
          </Prompt.Actions>
        </Prompt.Outer>
      )}
    </Composer.Outer>
  )
}

function peopleCount(n: number) {
  return plural(n, {one: '# person', other: '# people'})
}

function UpcomingTag() {
  const t = useTheme()
  return (
    <View
      testID="upcoming-tag"
      style={[
        a.px_sm,
        a.py_2xs,
        a.rounded_full,
        {backgroundColor: t.palette.primary_50},
      ]}>
      <Text
        style={[a.text_xs, a.font_semi_bold, {color: t.palette.primary_600}]}>
        <Trans>Upcoming</Trans>
      </Text>
    </View>
  )
}

/** The composer footer: the split's live readout, like Bluesky's character counter. */
function Footer({
  form,
  evaluation,
  locale,
  isDirty,
}: {
  form: ExpenseForm
  evaluation: FormEvaluation
  locale: string
  isDirty: boolean
}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const errorText = useErrorText()
  const {total, remaining, shares} = evaluation
  const fmt = (v: bigint) => formatAmount(v, form.currency, locale)
  const pct = (bp: number) =>
    i18n.number(Math.abs(bp) / 100, {maximumFractionDigits: 2})

  let text: string | null = null
  let tone: 'ok' | 'off' | 'muted' = 'muted'

  if (remaining?.kind === 'percent') {
    tone = remaining.value === 0 ? 'ok' : 'off'
    text =
      remaining.value === 0
        ? l`100% assigned`
        : remaining.value > 0
          ? l`${pct(remaining.value)}% left to assign`
          : l`${pct(remaining.value)}% over 100%`
  } else if (remaining?.kind === 'money') {
    tone = remaining.value === ZERO ? 'ok' : 'off'
    text =
      remaining.value === ZERO
        ? l`All ${fmt(total!)} assigned`
        : remaining.value > ZERO
          ? l`${fmt(remaining.value)} left to assign`
          : l`${fmt(magnitude(remaining.value))} over the total`
  } else if (total === undefined) {
    text = l`Enter an amount to see everyone’s share`
  } else if (
    shares &&
    (form.mode === 'equal' ||
      form.mode === 'adjusted' ||
      form.mode === 'shares')
  ) {
    const values = Object.values(shares)
    const n = values.length
    const most = values.reduce((x, y) => (y > x ? y : x), ZERO)
    const least = values.reduce((x, y) => (y < x ? y : x), most)
    tone = 'ok'
    text =
      form.mode === 'equal'
        ? most === least
          ? l`${fmt(most)} each · ${peopleCount(n)}`
          : l`${fmt(least)}–${fmt(most)} each · ${peopleCount(n)}`
        : l`Split between ${peopleCount(n)}`
  }

  // When the split itself is fine, say quietly what else Save still needs (after the first edit).
  let need: string | null = null
  if (
    tone !== 'off' &&
    evaluation.error &&
    isDirty &&
    evaluation.error !== 'AMOUNT_REQUIRED' &&
    !evaluation.amountError
  ) {
    if (!['TOTAL_MISMATCH', 'PERCENT_NOT_100'].includes(evaluation.error))
      need = errorText(evaluation.error)
  }

  return (
    <View
      style={[
        a.flex_row,
        a.align_center,
        a.px_lg,
        a.py_md,
        a.border_t,
        t.atoms.border_contrast_low,
        t.atoms.bg,
        {minHeight: 48},
      ]}>
      {need ? (
        <Text
          testID="save-needs"
          style={[
            a.flex_1,
            a.text_sm,
            a.font_medium,
            t.atoms.text_contrast_medium,
          ]}
          numberOfLines={1}>
          {need}
        </Text>
      ) : null}
      {text ? (
        tone === 'off' && !remaining ? (
          <View style={[a.flex_1]}>
            <FieldError testID="split-readout">{text}</FieldError>
          </View>
        ) : (
          <Text
            testID="split-readout"
            style={[
              need ? a.text_right : a.flex_1,
              a.text_sm,
              a.font_medium,
              {fontVariant: ['tabular-nums']},
              tone === 'off'
                ? {color: t.palette.negative_500}
                : tone === 'ok'
                  ? t.atoms.text_contrast_high
                  : t.atoms.text_contrast_medium,
            ]}>
            {text}
          </Text>
        )
      ) : null}
    </View>
  )
}
