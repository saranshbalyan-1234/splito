import Animated, {FadeInUp, FadeOutUp} from 'react-native-reanimated'
import {CURRENCIES} from '@splito/domain'
import {PREFS, type PrefKey, type SwipeAction} from '@splito/sync'
import {useLingui} from '@lingui/react/macro'
import {getLocales} from 'expo-localization'

import {useA11y} from '#/state/a11y'
import {TEXT_SCALE_STEPS} from '#/state/preferences/mirror'
import {usePref} from '#/data/hooks'
import {
  allTimeZones,
  deviceTimeZone,
  formatLocalDate,
  todayIn,
  utcOffsetLabel,
} from '#/locale/dates'
import {resolveNumberLocale} from '#/locale/numberLocale'
import {useDateLocale, useTimeZone} from '#/locale/useDates'
import {native} from '#/alf'
import {useDialogControl} from '#/components/Dialog'
import {ChartPie_Stroke2_Corner0_Rounded as ChartIcon} from '#/components/icons/ChartPie'
import {HomeOpen_Stoke2_Corner0_Rounded as HomeIcon} from '#/components/icons/HomeOpen'
import {Moon_Stroke2_Corner0_Rounded as MoonIcon} from '#/components/icons/Moon'
import {Route_Stroke2_Corner0_Rounded as RouteIcon} from '#/components/icons/Route'
import {AccentPicker} from '#/components/settings/AccentPicker'
import {CategoriesEditor} from '#/components/settings/CategoriesEditor'
import {
  type Option,
  PickerTrigger,
  RadioPref,
  SegmentedPref,
  SwitchPref,
} from '#/components/settings/controls'
import {
  CalendarIcon,
  ClockIcon,
  CurrencyIcon,
  DensityIcon,
  GroupsIcon,
  LanguageIcon,
  NotifyIcon,
  NumberIcon,
  PhoneIcon,
  SortIcon,
  SparklesIcon,
  SplitIcon,
  SwipeLeftIcon,
  SwipeRightIcon,
  TextSizeIcon,
  VibrateIcon,
} from '#/components/settings/icons'
import {OptionDialog} from '#/components/settings/OptionDialog'
import {PrefSection, usePrefControl} from '#/components/settings/PrefSection'
import {TabsEditor, useTabLabels} from '#/components/settings/TabsEditor'
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
        title={l`Dark theme`}
        options={[
          {value: 'dim', label: l`Dim`},
          {value: 'dark', label: l`Dark`},
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

/* Defaults */

function HomeTabPref() {
  const {t: l} = useLingui()
  const labels = useTabLabels()
  const [tabs = PREFS.tabs.default] = usePref('tabs')
  return (
    <RadioPref
      pref={usePrefControl('homeTab')}
      icon={HomeIcon}
      title={l`Home tab`}
      description={l`The tab Splito opens on.`}
      options={tabs.map(tab => ({value: tab, label: labels[tab]}))}
    />
  )
}

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

function SettleModePref() {
  const {t: l} = useLingui()
  return (
    <SegmentedPref
      pref={usePrefControl('settleMode')}
      icon={RouteIcon}
      title={l`Settle-up plan`}
      description={l`Direct pays each person you owe. Via others uses fewer payments by routing through group members.`}
      options={[
        {value: 'direct', label: l`Direct`},
        {value: 'transit', label: l`Via others`},
      ]}
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
      options={[
        {value: 'en', label: 'English'},
        {value: 'hi', label: 'हिन्दी', hint: 'Hindi'},
      ]}
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
  const today = todayIn(useTimeZone())
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
  motion: MotionPref,
  haptics: HapticsPref,
  tabs: TabsEditor,
  homeTab: HomeTabPref,
  defaultCurrency: CurrencyPref,
  defaultSplitMode: SplitModePref,
  settleMode: SettleModePref,
  analyticsPeriod: AnalyticsPeriodPref,
  analyticsView: AnalyticsViewPref,
  categories: CategoriesEditor,
  language: LanguagePref,
  timezone: TimeZonePref,
  weekStart: WeekStartPref,
  dateFormat: DateFormatPref,
  numberLocale: NumberFormatPref,
  peopleSort: PeopleSortPref,
  includeGroupsDefault: IncludeGroupsPref,
  swipeLeft: SwipeLeftPref,
  swipeRight: SwipeRightPref,
  'notify.expense': NotifyExpensePref,
  'notify.payment': NotifyPaymentPref,
  'notify.invite': NotifyInvitePref,
} satisfies Record<PrefKey, React.ComponentType | null>
