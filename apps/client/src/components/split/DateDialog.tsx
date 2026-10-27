import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {addDays} from '@splito/domain'

import {useToday} from '#/locale/useDates'
import {usePref} from '#/data/hooks'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as FormSheet from '#/components/FormSheet'
import {ChevronRight_Stroke2_Corner0_Rounded as ChevronRightIcon} from '#/components/icons/Chevron'
import {Text} from '#/components/Typography'
import {ChevronDownIcon, ChevronLeftIcon} from './icons'


const MIN_YEAR = 1900
const MAX_YEAR = 2200
const YEARS_PER_PAGE = 12
const CELL = 40

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`

/**
 * A month calendar in a Bluesky dialog (bottom sheet on native). Any date
 * from 1900 to 2200; tapping the month title switches to a year grid for far
 * dates. The week starts on the Week starts on preference.
 */
export function DateDialog({
  control,
  title,
  value,
  onSelect,
}: {
  control: Dialog.DialogControlProps
  title: string
  value: string
  onSelect: (date: string) => void
}) {
  return (
    <FormSheet.Outer control={control} testID="date-dialog">
      <Calendar title={title} value={value} onSelect={onSelect} />
    </FormSheet.Outer>
  )
}

function Calendar({
  title,
  value,
  onSelect,
}: {
  title: string
  value: string
  onSelect: (date: string) => void
}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const control = Dialog.useDialogContext()
  const [weekStart = 1] = usePref('weekStart')
  const today = useToday()
  const start = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : today
  const [vy, vm] = start.split('-').map(Number) as [number, number]
  const [view, setView] = useState({y: vy, m: vm - 1})
  const [isPickingYear, setIsPickingYear] = useState(false)
  const [yearPage, setYearPage] = useState(() =>
    Math.floor((vy - MIN_YEAR) / YEARS_PER_PAGE),
  )

  const pick = (date: string) => control.close(() => onSelect(date))
  const step = (delta: number) => {
    const n = view.y * 12 + view.m + delta
    const y = Math.floor(n / 12)
    if (y < MIN_YEAR || y > MAX_YEAR) return
    setView({y, m: n % 12})
  }

  const monthTitle = i18n.date(new Date(Date.UTC(view.y, view.m, 1)), {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
  const daysInMonth = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate()
  const lead =
    (new Date(Date.UTC(view.y, view.m, 1)).getUTCDay() - weekStart + 7) % 7
  const cells: Array<number | null> = [
    ...Array(lead).fill(null),
    ...Array.from({length: daysInMonth}, (_, i) => i + 1),
  ]
  while (cells.length % 7) cells.push(null)
  // 1 Jan 2023 was a Sunday.
  const weekdays = Array.from({length: 7}, (_, i) =>
    i18n.date(new Date(Date.UTC(2023, 0, 1 + ((weekStart + i) % 7))), {
      weekday: 'short',
      timeZone: 'UTC',
    }),
  )
  const years = Array.from(
    {length: YEARS_PER_PAGE},
    (_, i) => MIN_YEAR + yearPage * YEARS_PER_PAGE + i,
  ).filter(y => y <= MAX_YEAR)

  const isFirstMonth = view.y === MIN_YEAR && view.m === 0
  const isLastMonth = view.y === MAX_YEAR && view.m === 11

  return (
    <FormSheet.Inner title={title}>
      <View style={[a.flex_row, a.align_center, a.justify_between, a.pb_md]}>
        <Button
          testID="calendar-title"
          label={isPickingYear ? l`Show days` : l`Choose a year`}
          size="small"
          variant="ghost"
          color="secondary"
          onPress={() => setIsPickingYear(v => !v)}
          style={[{marginLeft: -12}]}>
          <ButtonText style={[a.text_lg, a.font_semi_bold, t.atoms.text]}>
            {isPickingYear
              ? `${years[0]} – ${years[years.length - 1]}`
              : monthTitle}
          </ButtonText>
          <ButtonIcon icon={ChevronDownIcon} size="sm" />
        </Button>
        <View style={[a.flex_row, a.gap_xs]}>
          <Button
            testID="calendar-prev"
            label={isPickingYear ? l`Earlier years` : l`Previous month`}
            size="small"
            variant="ghost"
            color="secondary"
            shape="round"
            disabled={isPickingYear ? yearPage === 0 : isFirstMonth}
            onPress={() =>
              isPickingYear ? setYearPage(p => p - 1) : step(-1)
            }>
            <ButtonIcon icon={ChevronLeftIcon} size="md" />
          </Button>
          <Button
            testID="calendar-next"
            label={isPickingYear ? l`Later years` : l`Next month`}
            size="small"
            variant="ghost"
            color="secondary"
            shape="round"
            disabled={
              isPickingYear ? years[years.length - 1]! >= MAX_YEAR : isLastMonth
            }
            onPress={() => (isPickingYear ? setYearPage(p => p + 1) : step(1))}>
            <ButtonIcon icon={ChevronRightIcon} size="md" />
          </Button>
        </View>
      </View>

      {isPickingYear ? (
        <View style={[a.flex_row, a.flex_wrap]}>
          {years.map(y => {
            const isSelected = y === view.y
            return (
              <View key={y} style={[a.p_xs, {width: '25%'}]}>
                <Button
                  testID={`calendar-year-${y}`}
                  label={String(y)}
                  size="small"
                  color={isSelected ? 'primary' : 'secondary'}
                  onPress={() => {
                    setView(v => ({...v, y}))
                    setIsPickingYear(false)
                  }}>
                  <ButtonText>{String(y)}</ButtonText>
                </Button>
              </View>
            )
          })}
        </View>
      ) : (
        <View>
          <View style={[a.flex_row]}>
            {weekdays.map(d => (
              <View key={d} style={[a.flex_1, a.align_center, a.pb_sm]}>
                <Text
                  style={[
                    a.text_xs,
                    a.font_semi_bold,
                    t.atoms.text_contrast_medium,
                  ]}>
                  {d}
                </Text>
              </View>
            ))}
          </View>
          {Array.from({length: cells.length / 7}, (_, row) => (
            <View key={row} style={[a.flex_row]}>
              {cells.slice(row * 7, row * 7 + 7).map((day, i) => {
                if (day === null)
                  return <View key={i} style={[a.flex_1, {height: CELL + 4}]} />
                const date = iso(view.y, view.m, day)
                const isSelected = date === value
                const isToday = date === today
                return (
                  <View
                    key={i}
                    style={[a.flex_1, a.align_center, {height: CELL + 4}]}>
                    <Button
                      testID={`calendar-day-${date}`}
                      label={i18n.date(new Date(`${date}T00:00:00Z`), {
                        dateStyle: 'full',
                        timeZone: 'UTC',
                      })}
                      accessibilityState={{selected: isSelected}}
                      onPress={() => pick(date)}
                      hoverStyle={
                        isSelected ? undefined : t.atoms.bg_contrast_50
                      }
                      style={[
                        a.align_center,
                        a.justify_center,
                        a.rounded_full,
                        {width: CELL, height: CELL},
                        isSelected && {backgroundColor: t.palette.primary_500},
                      ]}>
                      <Text
                        style={[
                          a.text_md,
                          {fontVariant: ['tabular-nums']},
                          isSelected
                            ? [a.font_semi_bold, {color: t.palette.white}]
                            : isToday
                              ? [a.font_bold, {color: t.palette.primary_500}]
                              : undefined,
                        ]}>
                        {day}
                      </Text>
                    </Button>
                  </View>
                )
              })}
            </View>
          ))}
        </View>
      )}

      <View style={[a.flex_row, a.gap_sm, a.pt_md]}>
        <Button
          testID="calendar-today"
          label={l`Today`}
          size="small"
          color="secondary"
          onPress={() => pick(today)}>
          <ButtonText>
            <Trans>Today</Trans>
          </ButtonText>
        </Button>
        <Button
          testID="calendar-yesterday"
          label={l`Yesterday`}
          size="small"
          color="secondary"
          onPress={() => pick(addDays(today, -1))}>
          <ButtonText>
            <Trans>Yesterday</Trans>
          </ButtonText>
        </Button>
      </View>
      <Text
        style={[
          a.text_sm,
          a.leading_snug,
          a.pt_md,
          t.atoms.text_contrast_medium,
        ]}>
        <Trans>
          Future dates are fine – they show as upcoming until the day arrives.
        </Trans>
      </Text>
    </FormSheet.Inner>
  )
}
