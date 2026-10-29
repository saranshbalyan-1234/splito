import {useState} from 'react'
import {View} from 'react-native'
import Animated, {FadeInUp, FadeOutUp} from 'react-native-reanimated'
import {CURRENCIES} from '@splito/domain'
import {
  PREFS,
  type PrefKey,
  ROUND_TO_UNITS,
  roundToFor,
  type SwipeAction,
  type TabId,
} from '@splito/sync'
import {useLingui} from '@lingui/react/macro'
import {getLocales} from 'expo-localization'

import {useA11y} from '#/state/a11y'
import {TEXT_SCALE_STEPS} from '#/state/preferences/mirror'
import {usePref} from '#/data/hooks'
import {
  allTimeZones,
  deviceTimeZone,
  formatLocalDate,
  utcOffsetLabel,
} from '#/locale/dates'
import {resolveNumberLocale} from '#/locale/numberLocale'
import {APP_LANGUAGES} from '#/locale/languages'
import {useDateLocale, useToday} from '#/locale/useDates'
import {atoms as a, native} from '#/alf'
import {useDialogControl} from '#/components/Dialog'
import * as SegmentedControl from '#/components/forms/SegmentedControl'
import {ChartPie_Stroke2_Corner0_Rounded as ChartIcon} from '#/components/icons/ChartPie'
import {Cloud_Stroke2_Corner0_Rounded as CloudIcon} from '#/components/icons/Cloud'
import {HomeOpen_Stoke2_Corner0_Rounded as HomeIcon} from '#/components/icons/HomeOpen'
import {Moon_Stroke2_Corner0_Rounded as MoonIcon} from '#/components/icons/Moon'
import {AccentPicker} from '#/components/settings/AccentPicker'
import {CategoriesEditor} from '#/components/settings/CategoriesEditor'
import {TaxClassesEditor} from '#/components/settings/TaxClassesEditor'
import {useChargePresets} from '#/components/split/charges/hooks'
import {
  type Option,
  PickerTrigger,
  RadioPref,
  SegmentedPref,
  SwitchPref,
} from '#/components/settings/controls'
import {
  CalendarIcon,
  CashIcon,
  ClockIcon,
  ContrastIcon,
  CurrencyIcon,
  DensityIcon,
  GroupsIcon,
  KeypadIcon,
  LanguageIcon,
  NotifyIcon,
  NumberIcon,
  PhoneIcon,
  ShorthandIcon,
  SearchHistoryIcon,
  SortIcon,
  SparklesIcon,
  SplitIcon,
  SwipeLeftIcon,
  SwipeRightIcon,
  TextSizeIcon,
  VibrateIcon,
} from '#/components/settings/icons'
import {
  ChainLink_Stroke2_Corner0_Rounded as LinkIcon,
  PersonCheck_Stroke2_Corner0_Rounded as PersonCheckIcon,
} from '#/components/icons/Invite'
import {MagnifyingGlass_Stroke2_Corner0_Rounded as SearchIcon} from '#/components/icons/MagnifyingGlass'
import {CommentsShowHistoryPref} from '#/components/comments/CommentsPref'
import {OptionDialog} from '#/components/settings/OptionDialog'
import {NotifyRemindersPref} from '#/components/settings/NotifyRemindersPref'
import {PrefSection, usePrefControl} from '#/components/settings/PrefSection'
import {
  NavigationEditor,
  useTabLabels,
} from '#/components/settings/NavigationEditor'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'

/* Appearance */

/** Color mode, then (as Bluesky) the dark theme choice while dark mode can apply. */
function ThemePref() {
  const {t: l} = useLingui()
  const pref = usePrefControl('theme')
  return (
    <>
      <SegmentedPref
        pref={pref}
        icon={PhoneIcon}
        title={l`Color mode`}
        options={[
          {value: 'system', label: l`System`},
          {value: 'light', label: l`Light`},
          {value: 'dark', label: l`Dark`},
        ]}
      />
      {pref.value && pref.value !== 'light' ? <DarkThemePref /> : null}
    </>
  )
}

function DarkThemePref() {
  const {t: l} = useLingui()
  const pref = usePrefControl('darkTheme')
  return (
    <Animated.View entering={native(FadeInUp)} exiting={native(FadeOutUp)}>
      <SegmentedPref
        pref={pref}
        icon={MoonIcon}
        title={l`Dark mode style`}
        description={l`Used whenever Splito is in dark mode.`}
        options={[
          {value: 'dim', label: l`Dim`},
          {value: 'dark', label: l`Black`},
        ]}
      />
    </Animated.View>
  )
}

function TextScalePref() {
  const {t: l} = useLingui()
  const labels = [l`Smaller`, l`Default`, l`Larger`, l`Largest`]
  return (
    <SegmentedPref
      pref={usePrefControl('textScale')}
      icon={TextSizeIcon}
      title={l`Text size`}
      options={TEXT_SCALE_STEPS.map(([, value], i) => ({
        value,
        label: labels[i]!,
      }))}
    />
  )
}

function DensityPref() {
  const {t: l} = useLingui()
  return (
    <SegmentedPref
      pref={usePrefControl('density')}
      icon={DensityIcon}
      title={l`List density`}
      description={l`Compact fits more people, groups and activity on screen.`}
      options={[
        {value: 'comfortable', label: l`Comfortable`},
        {value: 'compact', label: l`Compact`},
      ]}
    />
  )
}

/** F-1801: direction always has an arrow and words; this only picks the colours. */
function MoneyPalettePref() {
  const {t: l} = useLingui()
  return (
    <RadioPref
      pref={usePrefControl('moneyPalette')}
      icon={ContrastIcon}
      title={l`Money colours`}
      description={l`Balances always show an arrow and words like “owes you”, so they read without colour too.`}
      options={[
        {
          value: 'default',
          label: l`Green and red`,
          hint: l`Green when money comes to you, red when you pay`,
        },
        {
          value: 'colorblind',
          label: l`Colour-blind safe`,
          hint: l`Blue and orange, easy to tell apart with any colour vision`,
        },
        {
          value: 'mono',
          label: l`Monochrome`,
          hint: l`No colour: arrows and bold type show the direction`,
        },
      ]}
    />
  )
}

/* Motion */

function MotionPref() {
  const {t: l} = useLingui()
  const {reduceMotionEnabled} = useA11y()
  return (
    <SegmentedPref
      pref={usePrefControl('motion')}
      icon={SparklesIcon}
      title={l`Animations`}
      description={
        reduceMotionEnabled
          ? l`Your device asks for reduced motion, so Splito keeps movement to gentle fades whatever you pick here.`
          : l`Reduced swaps movement for gentle fades. Off shows every change instantly.`
      }
      options={[
        {value: 'full', label: l`Full`},
        {value: 'reduced', label: l`Reduced`},
        {value: 'off', label: l`Off`},
      ]}
    />
  )
}

function HapticsPref() {
  const {t: l} = useLingui()
  return (
    <SwitchPref
      pref={usePrefControl('haptics')}
      icon={VibrateIcon}
      title={l`Haptics`}
      label={l`Gentle vibrations when you tap, toggle and save`}
      description={
        IS_WEB
          ? l`Browsers can't vibrate. This applies in the Splito app on your phone.`
          : undefined
      }
    />
  )
}

function ShakeToFeedbackPref() {
  const {t: l} = useLingui()
  return (
    <SwitchPref
      pref={usePrefControl('shakeToFeedback')}
      icon={VibrateIcon}
      title={l`Shake to send feedback`}
      label={l`Shaking your phone opens Send feedback`}
      description={
        IS_WEB
          ? l`Browsers can't tell when you shake. This applies in the Splito app on your phone.`
          : undefined
      }
    />
  )
}

/* Navigation */

function HomeTabPref() {
  const {t: l} = useLingui()
  const labels = useTabLabels()
  const [tabs = PREFS.tabs.default] = usePref('tabs')
  /* Only a bar item with a page of its own can be where Splito opens. */
  const destinations = tabs.filter(
    (tab): tab is TabId => tab !== 'ask' && tab !== 'settings',
  )
  return (
    <RadioPref
      pref={usePrefControl('homeTab')}
      icon={HomeIcon}
      title={l`Open on`}
      description={l`The tab Splito opens on.`}
      options={destinations.map(tab => ({value: tab, label: labels[tab]}))}
    />
  )
}

/* Defaults */

function useCurrencyName() {
  const [language = 'en'] = usePref('language')
  let names: Intl.DisplayNames | undefined
  try {
    names = new Intl.DisplayNames([language], {type: 'currency'})
  } catch {}
  return (code: string) => names?.of(code) ?? CURRENCIES[code]?.name ?? code
}

function CurrencyPref() {
  const {t: l} = useLingui()
  const pref = usePrefControl('defaultCurrency')
  const control = useDialogControl()
  const nameOf = useCurrencyName()
  if (!pref.value) return null
  const options = Object.values(CURRENCIES).map(c => ({
    value: c.code,
    label: nameOf(c.code),
    hint: `${c.code} · ${c.symbol}`,
    keywords: c.name,
  }))
  return (
    <PrefSection
      pref={pref}
      icon={CurrencyIcon}
      title={l`Default currency`}
      description={l`New expenses start in this currency. You can change it on any expense.`}>
      <PickerTrigger
        testID="currency-picker"
        label={l`Choose default currency`}
        value={`${nameOf(pref.value)} (${pref.value})`}
        onPress={control.open}
      />
      <OptionDialog
        testID="currency-dialog"
        control={control}
        title={l`Default currency`}
        searchLabel={l`Search currencies`}
        options={options}
        value={pref.value}
        onSelect={code => void pref.set(code)}
      />
    </PrefSection>
  )
}

/** Whether Itemize's tax, tip, service charge and discount start as an amount or a percentage. */
function ItemizeChargesPref() {
  const {t: l} = useLingui()
  const pref = usePrefControl('itemizeAdjustmentModes')
  if (pref.value === undefined) return null
  const modes = pref.value
  const kinds = [
    {key: 'tax', label: l`Tax`},
    {key: 'tip', label: l`Tip`},
    {key: 'service', label: l`Service charge`},
    {key: 'discount', label: l`Discount`},
  ] as const
  return (
    <PrefSection
      pref={pref}
      icon={SplitIcon}
      title={l`Itemize charges`}
      description={l`Whether each charge on an itemised bill starts as an amount or a percentage. The last choice you make in a bill is remembered.`}>
      <View style={[a.gap_sm]}>
        {kinds.map(kind => (
          <View
            key={kind.key}
            style={[a.flex_row, a.align_center, a.justify_between, a.gap_md]}>
            <Text style={[a.text_md]}>{kind.label}</Text>
            <View style={{width: 180}}>
              <SegmentedControl.Root
                type="radio"
                size="small"
                label={kind.label}
                value={modes[kind.key]}
                onChange={value =>
                  void pref.set({
                    ...modes,
                    [kind.key]: value as 'amount' | 'percent',
                  })
                }>
                <SegmentedControl.Item
                  testID={`itemizeAdjustmentModes-${kind.key}-amount`}
                  label={l`Amount`}
                  value="amount">
                  <SegmentedControl.ItemText>
                    {l`Amount`}
                  </SegmentedControl.ItemText>
                </SegmentedControl.Item>
                <SegmentedControl.Item
                  testID={`itemizeAdjustmentModes-${kind.key}-percent`}
                  label="%"
                  value="percent">
                  <SegmentedControl.ItemText>%</SegmentedControl.ItemText>
                </SegmentedControl.Item>
              </SegmentedControl.Root>
            </View>
          </View>
        ))}
      </View>
    </PrefSection>
  )
}

function SplitModePref() {
  const {t: l} = useLingui()
  return (
    <RadioPref
      pref={usePrefControl('defaultSplitMode')}
      icon={SplitIcon}
      title={l`Default split`}
      description={l`How new expenses are divided until you change it.`}
      options={[
        {value: 'equal', label: l`Equally`},
        {value: 'exact', label: l`Exact amounts`},
        {value: 'percent', label: l`Percentages`},
        {value: 'shares', label: l`Shares`},
      ]}
    />
  )
}

/** F-402: new splits start rounded to cash; the unit shows while it is on, as Dark mode style does under Color mode. */
function RoundCashPref() {
  const {t: l} = useLingui()
  const pref = usePrefControl('split.roundCash')
  return (
    <>
      <SwitchPref
        pref={pref}
        icon={CashIcon}
        title={l`Round shares to cash`}
        label={l`Start equal, shares and percent splits rounded to whole cash amounts`}
        description={l`Whatever doesn’t round is shown and added to one person’s share, so nothing is lost. You can change it on each expense.`}
      />
      {pref.value ? <RoundToPref /> : null}
    </>
  )
}

/** The cash unit is kept per currency, so a ₹100 unit never rounds euros (audit M15). */
function RoundToPref() {
  const {t: l} = useLingui()
  const pref = usePrefControl('split.roundTo')
  const [defaultCurrency = 'INR'] = usePref('defaultCurrency')
  const [picked, setPicked] = useState<string>()
  const currency = picked ?? defaultCurrency
  const control = useDialogControl()
  const nameOf = useCurrencyName()
  if (!pref.value) return null
  const units = pref.value
  const options = Object.values(CURRENCIES).map(c => ({
    value: c.code,
    label: nameOf(c.code),
    hint: `${c.code} · ${c.symbol}`,
    keywords: c.name,
  }))
  const setUnit = (unit: number) => {
    // The control reports its current value once on layout: nothing to write.
    if (unit === roundToFor(units, currency)) return
    const {[currency]: _, ...rest} = units
    void pref.set(unit === 1 ? rest : {...rest, [currency]: unit})
  }
  return (
    <PrefSection
      pref={pref}
      icon={CashIcon}
      title={l`Round to`}
      description={l`Pick a currency, then the whole amount its shares round to. Each currency keeps its own.`}>
      <View style={[a.gap_sm]}>
        <PickerTrigger
          testID="round-to-currency"
          label={l`Choose the currency to set`}
          value={`${nameOf(currency)} (${currency})`}
          onPress={control.open}
        />
        <SegmentedControl.Root
          type="radio"
          size="small"
          label={l`Round to`}
          value={String(roundToFor(units, currency))}
          onChange={value => setUnit(Number(value))}>
          {ROUND_TO_UNITS.map(unit => (
            <SegmentedControl.Item
              key={unit}
              testID={`round-to-${unit}`}
              label={String(unit)}
              value={String(unit)}>
              <SegmentedControl.ItemText>
                {String(unit)}
              </SegmentedControl.ItemText>
            </SegmentedControl.Item>
          ))}
        </SegmentedControl.Root>
      </View>
      <OptionDialog
        testID="round-to-currency-dialog"
        control={control}
        title={l`Currency`}
        searchLabel={l`Search currencies`}
        options={options}
        value={currency}
        onSelect={setPicked}
      />
    </PrefSection>
  )
}

function AmountKeypadPref() {
  const {t: l} = useLingui()
  return (
    <SwitchPref
      pref={usePrefControl('amount.keypad')}
      icon={KeypadIcon}
      title={l`Amount keypad`}
      label={l`Use Splito’s calculator keypad for amounts on phones`}
      description={l`Big keys with + − × ÷ and 000. Turn it off to use your phone’s keyboard.`}
    />
  )
}

function AnalyticsPeriodPref() {
  const {t: l} = useLingui()
  return (
    <RadioPref
      pref={usePrefControl('analyticsPeriod')}
      icon={CalendarIcon}
      title={l`Analytics period`}
      description={l`The range Analytics opens with.`}
      options={[
        {value: 'week', label: l`Week`},
        {value: 'month', label: l`Month`},
        {value: 'year', label: l`Year`},
        {value: 'all', label: l`All time`},
      ]}
    />
  )
}

function AnalyticsViewPref() {
  const {t: l} = useLingui()
  return (
    <SegmentedPref
      pref={usePrefControl('analyticsView')}
      icon={ChartIcon}
      title={l`Analytics view`}
      options={[
        {value: 'charts', label: l`Charts`},
        {value: 'table', label: l`Table`},
      ]}
    />
  )
}

/* Regional */

function LanguagePref() {
  const {t: l} = useLingui()
  return (
    <RadioPref
      pref={usePrefControl('language')}
      icon={LanguageIcon}
      title={l`Language`}
      description={l`Splito's language. Names, notes and amounts you enter stay as you typed them.`}
      options={APP_LANGUAGES.map(x => ({value: x.code2, label: x.name}))}
    />
  )
}

function TimeZonePref() {
  const {t: l} = useLingui()
  const pref = usePrefControl('timezone')
  const control = useDialogControl()
  if (!pref.value) return null
  const zoneName = (zone: string) => zone.replace(/_/g, ' ')
  const deviceZone = zoneName(deviceTimeZone())
  const options = [
    {value: 'device', label: l`Same as this device`, hint: deviceZone},
    ...allTimeZones().map(zone => ({
      value: zone,
      label: zoneName(zone),
      hint: () => utcOffsetLabel(zone),
    })),
  ]
  const current =
    pref.value === 'device'
      ? l`Same as this device (${deviceZone})`
      : zoneName(pref.value)
  return (
    <PrefSection
      pref={pref}
      icon={ClockIcon}
      title={l`Timezone`}
      description={l`Decides which day "today" is and where weeks and months begin in reports. Each expense keeps the date it happened.`}>
      <PickerTrigger
        testID="timezone-picker"
        label={l`Choose timezone`}
        value={current}
        onPress={control.open}
      />
      <OptionDialog
        testID="timezone-dialog"
        control={control}
        title={l`Timezone`}
        searchLabel={l`Search timezones`}
        options={options}
        value={pref.value}
        onSelect={zone => void pref.set(zone)}
      />
    </PrefSection>
  )
}

function useWeekdayName() {
  const locale = useDateLocale()
  const format = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    timeZone: 'UTC',
  })
  // 2026-10-25 is a Sunday.
  return (day: number) => format.format(Date.UTC(2026, 9, 25 + day))
}

function WeekStartPref() {
  const {t: l} = useLingui()
  const weekday = useWeekdayName()
  return (
    <SegmentedPref
      pref={usePrefControl('weekStart')}
      icon={CalendarIcon}
      title={l`Week starts on`}
      options={[1, 0, 6].map(day => ({
        value: day as 0 | 1 | 6,
        label: weekday(day),
      }))}
    />
  )
}

function DateFormatPref() {
  const {t: l} = useLingui()
  const locale = useDateLocale()
  const today = useToday()
  const example = (format: 'auto' | 'dmy' | 'mdy' | 'ymd') =>
    formatLocalDate(today, format, locale)
  return (
    <RadioPref
      pref={usePrefControl('dateFormat')}
      icon={CalendarIcon}
      title={l`Date format`}
      options={[
        {value: 'auto', label: l`Automatic`, hint: example('auto')},
        {value: 'dmy', label: l`Day first`, hint: example('dmy')},
        {value: 'mdy', label: l`Month first`, hint: example('mdy')},
        {value: 'ymd', label: l`Year first`, hint: example('ymd')},
      ]}
    />
  )
}

function NumberFormatPref() {
  const {t: l} = useLingui()
  const [language = 'en'] = usePref('language')
  const example = (pref: 'auto' | 'en-IN' | 'en-US' | 'de-DE' | 'fr-FR') =>
    new Intl.NumberFormat(
      resolveNumberLocale(pref, language, getLocales()[0]?.languageTag),
      {minimumFractionDigits: 2},
    ).format(1234567.5)
  return (
    <RadioPref
      pref={usePrefControl('numberLocale')}
      icon={NumberIcon}
      title={l`Number format`}
      description={l`How amounts are grouped and punctuated.`}
      options={[
        {value: 'auto', label: l`Automatic`, hint: example('auto')},
        {value: 'en-IN', label: l`Indian`, hint: example('en-IN')},
        {value: 'en-US', label: l`International`, hint: example('en-US')},
        {value: 'de-DE', label: l`European`, hint: example('de-DE')},
        {value: 'fr-FR', label: l`Spaced`, hint: example('fr-FR')},
      ]}
    />
  )
}

function AmountShorthandPref() {
  const {t: l} = useLingui()
  return (
    <SwitchPref
      pref={usePrefControl('amount.shorthand')}
      icon={ShorthandIcon}
      title={l`Amount shortcuts`}
      label={l`Read 2k as 2,000, 1.5L as 1,50,000 and 1cr as 1,00,00,000`}
      description={l`Also works for m (million) and inside sums, like 2k + 500.`}
    />
  )
}

/* Lists */

function PeopleSortPref() {
  const {t: l} = useLingui()
  return (
    <RadioPref
      pref={usePrefControl('peopleSort')}
      icon={SortIcon}
      title={l`Sort people by`}
      options={[
        {value: 'amount', label: l`Biggest balance first`},
        {value: 'name', label: l`Name`},
        {value: 'recent', label: l`Recent activity`},
      ]}
    />
  )
}

function IncludeGroupsPref() {
  const {t: l} = useLingui()
  return (
    <SwitchPref
      pref={usePrefControl('includeGroupsDefault')}
      icon={GroupsIcon}
      title={l`Include groups`}
      label={l`Count shared group expenses in each person's balance`}
      description={l`The starting point for the People filter; you can still switch it there.`}
    />
  )
}

function ShowInactiveFoldPref() {
  const {t: l} = useLingui()
  return (
    <SwitchPref
      pref={usePrefControl('groups.showInactiveFold')}
      icon={GroupsIcon}
      title={l`Inactive groups`}
      label={l`Show an Inactive fold at the end of the Groups list`}
      description={l`Inactive groups take no new expenses but can still be settled. Turn this off to reach them only through the Groups filter and search.`}
    />
  )
}

function ShowSyncStatusPref() {
  const {t: l} = useLingui()
  return (
    <SwitchPref
      pref={usePrefControl('showSyncStatus')}
      icon={CloudIcon}
      title={l`Sync status`}
      label={l`Show a small dot on each expense, payment and request`}
      description={l`Green when synced, yellow while it syncs, red when it is only on this device. Each item's page always says it in words.`}
    />
  )
}

/* Itemize bills (F-403) */

function DefaultBillPresetPref() {
  const {t: l} = useLingui()
  const presets = useChargePresets()
  return (
    <RadioPref
      pref={usePrefControl('bill.defaultPreset')}
      icon={SplitIcon}
      title={l`New bills start with`}
      description={l`The charge setup a new itemised bill opens with. You can change it on each bill.`}
      options={presets.map(p => ({value: p.id, label: p.name}))}
    />
  )
}

function ServiceChargeDefaultPref() {
  const {t: l} = useLingui()
  return (
    <SegmentedPref
      pref={usePrefControl('bill.serviceChargeDefault')}
      icon={CashIcon}
      title={l`Service charge on new bills`}
      description={l`For Simple bills. Start with this service charge already filled in.`}
      options={[
        {value: 0, label: l`Off`},
        {value: 500, label: '5%'},
        {value: 1000, label: '10%'},
        {value: 1250, label: '12.5%'},
        {value: 1500, label: '15%'},
      ]}
    />
  )
}

function RoundOffSpreadPref() {
  const {t: l} = useLingui()
  return (
    <SegmentedPref
      pref={usePrefControl('bill.roundOffSpread')}
      icon={CashIcon}
      title={l`Bill round-off goes to`}
      description={l`When a bill’s printed total differs by a few paise from the items and charges, the round-off is shared like this.`}
      options={[
        {value: 'shares', label: l`Everyone, by share`},
        {value: 'payer', label: l`The payer`},
      ]}
    />
  )
}

function RememberPerMerchantPref() {
  const {t: l} = useLingui()
  return (
    <SwitchPref
      pref={usePrefControl('bill.rememberPerMerchant')}
      icon={SearchHistoryIcon}
      title={l`Charges per merchant`}
      label={l`Offer the charges you saved for a merchant`}
      description={l`Use Save as preset on a bill; next time that title is typed, the setup is suggested.`}
    />
  )
}

/** The merchants remembered so far; Reset on the title clears them. */
function MerchantSetupsPref() {
  const {t: l} = useLingui()
  const pref = usePrefControl('bill.merchantSetups')
  if (!pref.value || pref.value.length === 0) return null
  const count = pref.value.length
  return (
    <PrefSection
      pref={pref}
      icon={GroupsIcon}
      title={l`Remembered merchants`}
      description={
        count === 1
          ? l`1 merchant has saved charges. Reset forgets them.`
          : l`${count} merchants have saved charges. Reset forgets them.`
      }>
      <></>
    </PrefSection>
  )
}

function useSwipeOptions(): Option<SwipeAction>[] {
  const {t: l} = useLingui()
  return [
    {value: 'markRead', label: l`Mark as read`},
    {value: 'hide', label: l`Hide from Activity`},
    {value: 'delete', label: l`Delete from Activity`},
    {value: 'none', label: l`Nothing`},
  ]
}

function SwipeLeftPref() {
  const {t: l} = useLingui()
  return (
    <RadioPref
      pref={usePrefControl('swipeLeft')}
      icon={SwipeLeftIcon}
      title={l`Swipe left on Activity`}
      description={l`Every swipe action is also on the item's menu. Deleting only removes it from your feed, never from the record.`}
      options={useSwipeOptions()}
    />
  )
}

function SwipeRightPref() {
  const {t: l} = useLingui()
  return (
    <RadioPref
      pref={usePrefControl('swipeRight')}
      icon={SwipeRightIcon}
      title={l`Swipe right on Activity`}
      options={useSwipeOptions()}
    />
  )
}

function RememberSearchesPref() {
  const {t: l} = useLingui()
  return (
    <SwitchPref
      pref={usePrefControl('rememberSearches')}
      icon={SearchHistoryIcon}
      title={l`Recent searches`}
      label={l`Remember what you search for`}
      description={l`Search shows your last few searches, kept on this device only.`}
    />
  )
}

/* Notifications */

function NotifyExpensePref() {
  const {t: l} = useLingui()
  return (
    <SwitchPref
      pref={usePrefControl('notify.expense')}
      icon={NotifyIcon}
      title={l`New expenses`}
      label={l`When someone adds an expense that includes you`}
    />
  )
}

function NotifyPaymentPref() {
  const {t: l} = useLingui()
  return (
    <SwitchPref
      pref={usePrefControl('notify.payment')}
      icon={CurrencyIcon}
      title={l`Payments`}
      label={l`When a payment to or from you is recorded`}
    />
  )
}

function NotifyInvitePref() {
  const {t: l} = useLingui()
  return (
    <SwitchPref
      pref={usePrefControl('notify.invite')}
      icon={GroupsIcon}
      title={l`Invites`}
      label={l`When someone accepts your invite`}
    />
  )
}

/* Privacy (26.18) */

function FindablePref() {
  const {t: l} = useLingui()
  return (
    <SwitchPref
      pref={usePrefControl('privacy.findByContact')}
      icon={SearchIcon}
      title={l`Find me by email or phone`}
      label={l`Let people who know my email or number find me`}
      description={l`They only learn that you’re on Splito, never anything else.`}
    />
  )
}

function FriendRequestsFromPref() {
  const {t: l} = useLingui()
  return (
    <RadioPref
      pref={usePrefControl('privacy.friendRequestsFrom')}
      icon={PersonCheckIcon}
      title={l`Who can send me friend requests`}
      options={[
        {value: 'everyone', label: l`Everyone`},
        {value: 'link-only', label: l`Only people with my invite link`},
      ]}
    />
  )
}

function useUsesOptions() {
  const {t: l} = useLingui()
  return [
    {value: 1 as const, label: '1'},
    {value: 5 as const, label: '5'},
    {value: 25 as const, label: '25'},
    {value: 'unlimited' as const, label: l`No limit`},
  ]
}

function FriendInviteUsesPref() {
  const {t: l} = useLingui()
  return (
    <SegmentedPref
      pref={usePrefControl('invites.defaultMaxUses.friend')}
      icon={LinkIcon}
      title={l`Friend invite links work for`}
      description={l`How many people can use a new friend link. You can change it on each link.`}
      options={useUsesOptions()}
    />
  )
}

function GroupInviteUsesPref() {
  const {t: l} = useLingui()
  return (
    <SegmentedPref
      pref={usePrefControl('invites.defaultMaxUses.group')}
      icon={GroupsIcon}
      title={l`Group invite links work for`}
      options={useUsesOptions()}
    />
  )
}

function ApproveJoinsPref() {
  const {t: l} = useLingui()
  return (
    <SwitchPref
      pref={usePrefControl('invites.approveJoins')}
      icon={GroupsIcon}
      title={l`Approve group joins`}
      label={l`New group links make people wait until you let them in`}
    />
  )
}

function InviteExpiryPref() {
  const {t: l} = useLingui()
  return (
    <SegmentedPref
      pref={usePrefControl('invites.defaultExpiry')}
      icon={ClockIcon}
      title={l`New invite links expire after`}
      options={[
        {value: '24h', label: l`1 day`},
        {value: '7d', label: l`7 days`},
        {value: '30d', label: l`30 days`},
        {value: 'never', label: l`Never`},
      ]}
    />
  )
}

/**
 * The control for every preference in the registry. The Settings sections
 * are generated from `PREFS` (group and order); this map only says how each
 * one is edited, and TypeScript fails the build if a new preference has none.
 */
export const PREF_CONTROLS = {
  theme: ThemePref,
  // Shown under Color mode, as Bluesky does.
  darkTheme: null,
  accent: AccentPicker,
  textScale: TextScalePref,
  density: DensityPref,
  moneyPalette: MoneyPalettePref,
  motion: MotionPref,
  haptics: HapticsPref,
  shakeToFeedback: ShakeToFeedbackPref,
  tabs: NavigationEditor,
  homeTab: HomeTabPref,
  defaultCurrency: CurrencyPref,
  itemizeAdjustmentModes: ItemizeChargesPref,
  defaultSplitMode: SplitModePref,
  'split.roundCash': RoundCashPref,
  // Shown under Round shares to cash while it is on.
  'split.roundTo': null,
  'amount.keypad': AmountKeypadPref,
  analyticsPeriod: AnalyticsPeriodPref,
  analyticsView: AnalyticsViewPref,
  // Chosen on Analytics' own scope chip, where its effect shows; Reset all resets it.
  analyticsScope: null,
  'pwa.installHintDismissed': null,
  categories: CategoriesEditor,
  'bill.taxClasses': TaxClassesEditor,
  // Chosen with the setup chips on a bill; the shipped ones are not edited in Settings.
  'bill.chargePresets': null,
  'bill.defaultPreset': DefaultBillPresetPref,
  'bill.serviceChargeDefault': ServiceChargeDefaultPref,
  'bill.roundOffSpread': RoundOffSpreadPref,
  'bill.rememberPerMerchant': RememberPerMerchantPref,
  'bill.merchantSetups': MerchantSetupsPref,
  language: LanguagePref,
  timezone: TimeZonePref,
  weekStart: WeekStartPref,
  dateFormat: DateFormatPref,
  numberLocale: NumberFormatPref,
  'amount.shorthand': AmountShorthandPref,
  peopleSort: PeopleSortPref,
  includeGroupsDefault: IncludeGroupsPref,
  'groups.showInactiveFold': ShowInactiveFoldPref,
  // Set from a group's menu (Hide group / Show group), where its effect shows; Reset all resets it.
  'groups.hidden': null,
  showSyncStatus: ShowSyncStatusPref,
  swipeLeft: SwipeLeftPref,
  swipeRight: SwipeRightPref,
  rememberSearches: RememberSearchesPref,
  'notify.expense': NotifyExpensePref,
  'notify.payment': NotifyPaymentPref,
  'notify.invite': NotifyInvitePref,
  'notify.reminders': NotifyRemindersPref,
  // No rows until recurring expenses (F-306) and the digest exist: a switch that changes nothing would be a placeholder.
  'notify.recurring': null,
  'notify.digest': null,
  // No row until telemetry has a vendor (A-046): a switch that changes nothing would be a placeholder.
  sendDiagnostics: null,
  // Remembers the switch in the Send feedback sheet, where its effect shows.
  'feedback.includeAppInfo': null,
  // Set from a deleted item's "Hide" (and the lists' "Show hidden"), where its effect shows; Reset all clears it.
  'lists.hiddenItems': null,
  // The "Show hidden" switch sits in each list's filters, where its effect shows.
  'lists.showHidden': null,
  'comments.showHistory': CommentsShowHistoryPref,
  'privacy.findByContact': FindablePref,
  'privacy.friendRequestsFrom': FriendRequestsFromPref,
  'invites.defaultMaxUses.friend': FriendInviteUsesPref,
  'invites.defaultMaxUses.group': GroupInviteUsesPref,
  'invites.defaultExpiry': InviteExpiryPref,
  'invites.approveJoins': ApproveJoinsPref,
} satisfies Record<PrefKey, React.ComponentType | null>
