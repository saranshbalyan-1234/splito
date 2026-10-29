import Animated, {FadeInUp, FadeOutUp} from 'react-native-reanimated'
import {CURRENCIES} from '@splito/domain'
import {
  PREFS,
  type PrefKey,
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
import {native} from '#/alf'
import {useDialogControl} from '#/components/Dialog'
import {HomeOpen_Stoke2_Corner0_Rounded as HomeIcon} from '#/components/icons/HomeOpen'
import {Moon_Stroke2_Corner0_Rounded as MoonIcon} from '#/components/icons/Moon'
import {AccentPicker} from '#/components/settings/AccentPicker'
import {CategoriesEditor} from '#/components/settings/CategoriesEditor'
import {TaxClassesEditor} from '#/components/settings/TaxClassesEditor'
import {useChargePresets} from '#/components/split/charges/hooks'
import {
  PickerTrigger,
  RadioPref,
  SegmentedPref,
  SwitchPref,
} from '#/components/settings/controls'
import {
  CalendarIcon,
  ClockIcon,
  ContrastIcon,
  CurrencyIcon,
  GroupsIcon,
  LanguageIcon,
  NumberIcon,
  PhoneIcon,
  SparklesIcon,
  SplitIcon,
  TextSizeIcon,
  VibrateIcon,
} from '#/components/settings/icons'
import {
  ChainLink_Stroke2_Corner0_Rounded as LinkIcon,
  PersonCheck_Stroke2_Corner0_Rounded as PersonCheckIcon,
} from '#/components/icons/Invite'
import {MagnifyingGlass_Stroke2_Corner0_Rounded as SearchIcon} from '#/components/icons/MagnifyingGlass'
import {Bubble_Stroke2_Corner2_Rounded as BubbleIcon} from '#/components/icons/Message'
import {OptionDialog} from '#/components/settings/OptionDialog'
import {NotifyRemindersPref} from '#/components/settings/NotifyRemindersPref'
import {PrefSection, usePrefControl} from '#/components/settings/PrefSection'
import {
  NavigationEditor,
  useTabLabels,
} from '#/components/settings/NavigationEditor'
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

/** F-1801: direction always has an arrow and words; this only picks the colours. */
function MoneyPalettePref() {
  const {t: l} = useLingui()
  return (
    <RadioPref
      pref={usePrefControl('moneyPalette')}
      icon={ContrastIcon}
      title={l`Money colours`}
      description={l`Arrows and words always show the direction.`}
      options={[
        {
          value: 'default',
          label: l`Green and red`,
          hint: l`Green in, red out`,
        },
        {
          value: 'colorblind',
          label: l`Colour-blind safe`,
          hint: l`Blue and orange`,
        },
        {
          value: 'mono',
          label: l`Monochrome`,
          hint: l`No colour`,
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
          ? l`Your device asks for reduced motion, so movement stays gentle.`
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
          ? l`Phones only.`
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
  const control = useDialogControl({url: 'currency'})
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
      description={l`New expenses start in this currency.`}>
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

/* Regional */

function LanguagePref() {
  const {t: l} = useLingui()
  return (
    <RadioPref
      pref={usePrefControl('language')}
      icon={LanguageIcon}
      title={l`Language`}
      options={APP_LANGUAGES.map(x => ({value: x.code2, label: x.name}))}
    />
  )
}

function TimeZonePref() {
  const {t: l} = useLingui()
  const pref = usePrefControl('timezone')
  const control = useDialogControl({url: 'timezone'})
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
      description={l`Sets which day is today. Expenses keep their own dates.`}>
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

/* Itemize bills (F-403) */

function DefaultBillPresetPref() {
  const {t: l} = useLingui()
  const presets = useChargePresets()
  return (
    <RadioPref
      pref={usePrefControl('bill.defaultPreset')}
      icon={SplitIcon}
      title={l`New bills start with`}
      description={l`The charges a new itemised bill opens with.`}
      options={presets.map(p => ({value: p.id, label: p.name}))}
    />
  )
}

/* Notifications */

function NotifyPaymentPref() {
  const {t: l} = useLingui()
  return (
    <SwitchPref
      pref={usePrefControl('notify.payment')}
      icon={CurrencyIcon}
      title={l`Payments`}
      label={l`When someone adds an expense with you or records a payment to or from you`}
    />
  )
}

function NotifyCommentsPref() {
  const {t: l} = useLingui()
  return (
    <SwitchPref
      pref={usePrefControl('notify.comments')}
      icon={BubbleIcon}
      title={l`Comments`}
      label={l`When someone comments on, or @mentions you in, an expense or payment you’re in`}
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
      label={l`They only learn you’re on Splito.`}
    />
  )
}

function FriendRequestsFromPref() {
  const {t: l} = useLingui()
  return (
    <RadioPref
      pref={usePrefControl('privacy.friendRequestsFrom')}
      icon={PersonCheckIcon}
      title={l`Friend requests from`}
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
      title={l`Friend links work for`}
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
      title={l`Group links work for`}
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
      label={l`Ask me before someone joins`}
    />
  )
}

function InviteExpiryPref() {
  const {t: l} = useLingui()
  return (
    <SegmentedPref
      pref={usePrefControl('invites.defaultExpiry')}
      icon={ClockIcon}
      title={l`Links expire after`}
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
  moneyPalette: MoneyPalettePref,
  motion: MotionPref,
  haptics: HapticsPref,
  tabs: NavigationEditor,
  homeTab: HomeTabPref,
  defaultCurrency: CurrencyPref,
  // Chosen with each charge's Amount / % toggle on a bill, which remembers it; Reset all resets it.
  itemizeAdjustmentModes: null,
  // Chosen with the Round shares to cash control on an expense, which remembers the switch and the unit per currency.
  'split.roundCash': null,
  'split.roundTo': null,
  // Remembered from Analytics' own period chip and Charts / Table toggle, where their effect shows.
  analyticsPeriod: null,
  analyticsView: null,
  // Chosen on Analytics' own scope chip, where its effect shows; Reset all resets it.
  analyticsScope: null,
  'pwa.installHintDismissed': null,
  categories: CategoriesEditor,
  'bill.taxClasses': TaxClassesEditor,
  // Chosen with the setup chips on a bill; the shipped ones are not edited in Settings.
  'bill.chargePresets': null,
  'bill.defaultPreset': DefaultBillPresetPref,
  // Saved with "Save as preset" on a bill; Reset all forgets them.
  'bill.merchantSetups': null,
  language: LanguagePref,
  timezone: TimeZonePref,
  weekStart: WeekStartPref,
  dateFormat: DateFormatPref,
  numberLocale: NumberFormatPref,
  // Remembered when the People filter is applied, where their effect shows.
  peopleSort: null,
  includeGroupsDefault: null,
  // Set from a group's menu (Hide group / Show group), where its effect shows; Reset all resets it.
  'groups.hidden': null,
  // Set on the Settle screen (Include disputed), where its effect shows; remembered per group.
  'group:settleIncludeDisputed': null,
  // Chosen in each list's filter sheet (Show settled), next to the other filters; Reset all resets them.
  'people.showSettled': null,
  'groups.showSettled': null,
  'groups.sort': null,
  'notify.payment': NotifyPaymentPref,
  'notify.comments': NotifyCommentsPref,
  'notify.invite': NotifyInvitePref,
  'notify.reminders': NotifyRemindersPref,
  // No row until telemetry has a vendor (A-046): a switch that changes nothing would be a placeholder.
  sendDiagnostics: null,
  // Remembers the switch in the Send feedback sheet, where its effect shows.
  'feedback.includeAppInfo': null,
  // Set from a deleted item's "Hide" (and the lists' "Show hidden"), where its effect shows; Reset all clears it.
  'lists.hiddenItems': null,
  // The "Show hidden" switch sits in each list's filters, where its effect shows.
  'lists.showHidden': null,
  'privacy.findByContact': FindablePref,
  'privacy.friendRequestsFrom': FriendRequestsFromPref,
  'invites.defaultMaxUses.friend': FriendInviteUsesPref,
  'invites.defaultMaxUses.group': GroupInviteUsesPref,
  'invites.defaultExpiry': InviteExpiryPref,
  'invites.approveJoins': ApproveJoinsPref,
} satisfies Record<PrefKey, React.ComponentType | null>
