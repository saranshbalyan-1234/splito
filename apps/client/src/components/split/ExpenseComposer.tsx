import {useEffect, useState} from 'react'
import {View} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {
  assignedFraction,
  decimalMark,
  formatAmount,
  magnitude,
  ZERO,
} from '@splito/domain'
import {
  createExpense,
  type Group,
  type Person,
  updateExpense,
} from '@splito/sync'

import {type NavigationProp} from '#/lib/routes/types'
import {useNumberLocale} from '#/locale/numberLocale'
import {useFormatDay, useToday} from '#/locale/useDates'
import {useEntities, useMutationCtx, usePref, useStore} from '#/data/hooks'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as FormSheet from '#/components/FormSheet'
import * as Dialog from '#/components/Dialog'
import {Divider} from '#/components/Divider'
import * as Prompt from '#/components/Prompt'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {SuccessCheck} from '#/motion/SuccessCheck'
import {useShouldReduceMotion} from '#/motion/useShouldReduceMotion'
import {DateDialog} from './DateDialog'
import {clearDraft, type DraftContext, writeDraft} from './drafts'
import {AmountField, DetailRow, FieldError, PlainInput} from './fields'
import {
  evaluateForm,
  type ExpenseForm,
  formPayers,
  type FormEvaluation,
  hasContent,
  withPeople,
} from './form'
import {formWithGroup} from './groupPick'
import {CircleCheck_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/CircleCheck'
import {Warning_Stroke2_Corner0_Rounded as WarningIcon} from '#/components/icons/Warning'
import {
  CalendarIcon,
  FolderIcon,
  GroupIcon,
  NotesIcon,
  WalletIcon,
} from './icons'
import {PayersDialog} from './PayersDialog'
import {PeopleDialog} from './PeopleDialog'
import {CategoryDialog, CurrencyDialog, GroupDialog} from './pickers'
import {
  CategoryTile,
  SectionLabel,
  useCategories,
  useCategory,
  useDisplayName,
  useErrorText,
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
  const [adjustModes, saveAdjustModes] = usePref('itemizeAdjustmentModes')
  const [defaultRoundTo = 1] = usePref('split.roundTo')
  const people = useEntities<Person>('person')
  const name = useDisplayName()
  const errorText = useErrorText()
  const formatDay = useFormatDay()

  const [form, setForm] = useState(initialForm)
  const [showRestored, setShowRestored] = useState(isDraftRestored)
  const [isSaving, setIsSaving] = useState(false)
  /* Once the currency was chosen (or restored from a draft) a group never overwrites it (audit M5). */
  const [isCurrencyPicked, setIsCurrencyPicked] = useState(isDraftRestored)
  const [savedId, setSavedId] = useState<string>()
  const [isTitleFocused, setIsTitleFocused] = useState(false)
  const [isShorthandOn = true] = usePref('amount.shorthand')
  const [isKeypadOn = true] = usePref('amount.keypad')
  const evaluation = evaluateForm(form, tz, decimalMark(locale), {
    shorthand: isShorthandOn,
  })
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

  /* Drafts survive closing: every change is kept on the device until Save or Discard. */
  useEffect(() => {
    if (!draftContext || savedId || form === initialForm) return
    if (hasContent(form)) writeDraft(form, draftContext)
    else clearDraft(draftContext)
  }, [form, draftContext, savedId, initialForm])

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
    update(f => withPeople(f, ids, candidates))

  const selectGroup = (groupId: string | null) =>
    update(f => {
      if (!groupId) return {...f, groupId: null}
      const g = groups?.find(x => x.id === groupId)
      if (!g) return f
      return formWithGroup(
        f,
        {id: g.id, currency: g.data.currency, members: g.data.members},
        ctx.actor,
        {isEdit, isCurrencyPicked},
      )
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
      if (draftContext) clearDraft(draftContext)
      setSavedId(saved.id)
    } catch (e) {
      setIsSaving(false)
      Toast.show(errorText((e as {code?: string}).code ?? ''), {type: 'error'})
    }
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

  const today = useToday()
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
    <FormSheet.Screen
      testID={testID}
      scrollTestID="expense-form"
      title={
        isEdit
          ? l`Edit expense`
          : l({message: 'Add expense', context: 'action'})
      }
      closeHint={
        isEdit
          ? l`Closes without saving your changes`
          : l`Closes Add expense; your draft is kept`
      }
      isDirty={!savedId && isDirty && (isEdit || hasContent(form))}
      onClose={onClose}
      discardDescription={l`Your edits to this expense won’t be saved.`}
      renderDiscardPrompt={
        isEdit
          ? undefined
          : ({control, onDiscardConfirmed}) => (
              <DraftPrompt
                control={control}
                onDraftKept={onDiscardConfirmed}
                onDraftDiscarded={() => {
                  if (draftContext) clearDraft(draftContext)
                  onDiscardConfirmed()
                }}
              />
            )
      }
      footer={{
        saveLabel: l`Save expense`,
        onSave: () => void save(),
        canSave: !!evaluation.draft && !savedId,
        isSaving,
      }}
      readout={
        <Readout
          form={form}
          evaluation={evaluation}
          locale={locale}
          isDirty={isDirty}
        />
      }
      overlay={
        <>
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
            onSelect={currency => {
              setIsCurrencyPicked(true)
              update(f => ({...f, currency}))
            }}
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
            lockedIds={formPayers(form)}
            lockedNote={l`Paid · change who paid to remove`}
            allowNew={!group}
            showPending={!group}
            onChange={setPeople}
          />
          <PayersDialog
            control={payersControl}
            form={form}
            update={update}
            evaluation={evaluation}
            locale={locale}
          />
        </>
      }>
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
              if (draftContext) clearDraft(draftContext)
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
          <View
            style={[
              {
                borderBottomWidth: isTitleFocused ? 2 : 1,
                marginBottom: isTitleFocused ? 0 : 1,
                borderColor: isTitleFocused
                  ? t.palette.primary_500
                  : t.atoms.border_contrast_medium.borderColor,
              },
            ]}>
            <PlainInput
              testID="expense-title"
              value={form.title}
              onChangeText={setTitle}
              onFocus={() => setIsTitleFocused(true)}
              onBlur={() => setIsTitleFocused(false)}
              placeholder={l`What was it for?`}
              accessibilityLabel={l`Title`}
              autoFocus={!isEdit && gtMobile}
              maxLength={120}
              spellCheck={false}
              returnKeyType="next"
              style={[a.text_xl, a.font_medium, {paddingVertical: 4}]}
            />
          </View>
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
        onChangeText={(amount, amountReading) =>
          update(f => ({...f, amount, amountReading}))
        }
        currency={form.currency}
        locale={locale}
        result={evaluation.total}
        errorText={
          evaluation.amountError ? errorText(evaluation.amountError) : undefined
        }
        readings={evaluation.amountReadings}
        reading={form.amountReading}
        onReadingPicked={amountReading => update(f => ({...f, amountReading}))}
        hasKeypad={isKeypadOn && !gtMobile}
        onPressCurrency={() => currencyControl.open()}
      />

      <Divider />
      <DetailRow
        testID="expense-date"
        icon={CalendarIcon}
        label={l`Date`}
        value={formatDay(form.date, {relative: true})}
        onPress={() => dateControl.open()}
        accessory={isUpcoming ? <UpcomingTag /> : null}
      />
      <DetailRow
        testID="expense-group"
        icon={FolderIcon}
        label={l`Group`}
        value={group ? group.data.name : l`No group`}
        onPress={() => groupControl.open()}
      />
      <DetailRow
        testID="expense-people"
        icon={GroupIcon}
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
        adjustModes={adjustModes}
        onAdjustModesChanged={saveAdjustModes}
        defaultRoundTo={defaultRoundTo}
        me={ctx.actor}
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
    </FormSheet.Screen>
  )
}

/**
 * Add expense keeps a device draft, so closing with something typed offers
 * to keep it (Bluesky's composer asks the same) besides discarding it.
 */
function DraftPrompt({
  control,
  onDraftKept,
  onDraftDiscarded,
}: {
  control: Prompt.PromptControlProps
  onDraftKept: () => void
  onDraftDiscarded: () => void
}) {
  const {t: l} = useLingui()
  return (
    <Prompt.Outer control={control} testID="expense-close-prompt">
      <Prompt.Content>
        <Prompt.TitleText>
          <Trans>Discard changes?</Trans>
        </Prompt.TitleText>
        <Prompt.DescriptionText>
          <Trans>Or keep them as a draft to finish later.</Trans>
        </Prompt.DescriptionText>
      </Prompt.Content>
      <Prompt.Actions>
        <Prompt.Action
          testID="draft-discard"
          cta={l`Discard`}
          color="negative"
          onPress={onDraftDiscarded}
        />
        <Prompt.Action
          testID="draft-save"
          cta={l`Save draft`}
          color="secondary"
          onPress={onDraftKept}
        />
        <Prompt.Cancel cta={l`Keep editing`} />
      </Prompt.Actions>
    </Prompt.Outer>
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

/** The split's live readout above the footer, like Bluesky's character counter. */
function Readout({
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
  const {t: l} = useLingui()
  const errorText = useErrorText()
  const {total, remaining, shares} = evaluation
  const fmt = (v: bigint) => formatAmount(v, form.currency, locale)
  const pct = (bp: number) =>
    new Intl.NumberFormat(locale, {maximumFractionDigits: 2}).format(
      Math.abs(bp) / 100,
    )

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
    <View style={[a.pb_sm]}>
      <View style={[a.flex_row, a.align_center, {minHeight: 28}]}>
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
            <View
              style={[
                need ? null : a.flex_1,
                a.flex_row,
                a.align_center,
                a.gap_xs,
              ]}>
              {/* A status mark: green check when the split adds up, red when it does not. */}
              {remaining && tone === 'ok' ? (
                <CheckIcon size="sm" fill={t.palette.positive_600} />
              ) : remaining && tone === 'off' ? (
                <WarningIcon size="sm" fill={t.palette.negative_500} />
              ) : null}
              <Text
                testID="split-readout"
                style={[
                  need ? a.text_right : a.flex_1,
                  a.text_sm,
                  a.font_medium,
                  {fontVariant: ['tabular-nums']},
                  tone === 'off'
                    ? {color: t.palette.negative_500}
                    : remaining && tone === 'ok'
                      ? {color: t.palette.positive_600}
                      : tone === 'ok'
                        ? t.atoms.text_contrast_high
                        : t.atoms.text_contrast_medium,
                ]}>
                {text}
              </Text>
            </View>
          )
        ) : null}
      </View>
      {/* How much is assigned, as a bar: money readouts only, once there is a total. */}
      {remaining?.kind === 'money' && total !== undefined ? (
        <AssignedBar
          fraction={assignedFraction(total, remaining.value)}
          tone={
            remaining.value < ZERO
              ? 'off'
              : remaining.value === ZERO
                ? 'ok'
                : 'partial'
          }
        />
      ) : null}
    </View>
  )
}

/** A thin track filling as the split is assigned; green when complete, red when over. */
function AssignedBar({
  fraction,
  tone,
}: {
  fraction: number
  tone: 'ok' | 'partial' | 'off'
}) {
  const t = useTheme()
  const reduceMotion = useShouldReduceMotion()
  const width = useSharedValue(fraction)
  useEffect(() => {
    width.set(reduceMotion ? fraction : withTiming(fraction, {duration: 220}))
  }, [fraction, reduceMotion, width])
  const fill = useAnimatedStyle(() => ({width: `${width.get() * 100}%`}))
  return (
    <View
      testID="split-progress"
      aria-hidden
      style={[
        a.mt_2xs,
        a.rounded_full,
        a.overflow_hidden,
        t.atoms.bg_contrast_50,
        {height: 3},
      ]}>
      <Animated.View
        style={[
          a.h_full,
          a.rounded_full,
          {
            backgroundColor:
              tone === 'ok'
                ? t.palette.positive_600
                : tone === 'off'
                  ? t.palette.negative_500
                  : t.palette.primary_500,
          },
          fill,
        ]}
      />
    </View>
  )
}
