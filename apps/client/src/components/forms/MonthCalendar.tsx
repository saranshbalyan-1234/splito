import {useState} from 'react'
import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'
import {type LocalDate, type WeekStart} from '@splito/domain'

import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {
  ChevronBottom_Stroke2_Corner0_Rounded as ChevronDownIcon,
  ChevronLeft_Stroke2_Corner0_Rounded as ChevronLeftIcon,
  ChevronRight_Stroke2_Corner0_Rounded as ChevronRightIcon,
} from '#/components/icons/Chevron'
import {Text} from '#/components/Typography'
import {monthGrid, shiftMonth} from './monthGrid'

const MIN_YEAR = 1900
const MAX_YEAR = 2200
const YEARS_PER_PAGE = 12
const CELL = 40

/**
 * The one month calendar (F-274 finding 46): the date field's picker and the Analytics custom range both
 * draw it. Any day from 1900 to 2200; the week starts on `weekStart`. `from` alone is a single chosen
 * day; with `to` too, the days between are banded. With `shouldPickYear` the month title opens a year
 * grid for far dates. Test ids are `<testIDPrefix>-title | -prev | -next | -year-YYYY | -day-YYYY-MM-DD`.
 */
export function MonthCalendar({
  initialMonth,
  from,
  to,
  today,
  weekStart,
  shouldPickYear = false,
  testIDPrefix,
  onPick,
}: {
  /** The month to open on, "YYYY-MM". */
  initialMonth: string
  from?: LocalDate
  to?: LocalDate
  today: LocalDate
  weekStart: WeekStart
  shouldPickYear?: boolean
  testIDPrefix: string
  onPick: (date: LocalDate) => void
}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const [month, setMonth] = useState(initialMonth)
  const [isPickingYear, setIsPickingYear] = useState(false)
  const [yearPage, setYearPage] = useState(() =>
    Math.floor((+initialMonth.slice(0, 4) - MIN_YEAR) / YEARS_PER_PAGE),
  )

  const year = +month.slice(0, 4)
  const step = (by: number) => {
    const next = shiftMonth(month, by)
    if (+next.slice(0, 4) < MIN_YEAR || +next.slice(0, 4) > MAX_YEAR) return
    setMonth(next)
  }
  const date = (d: string, o: Intl.DateTimeFormatOptions) =>
    i18n.date(new Date(`${d}T00:00:00Z`), {...o, timeZone: 'UTC'})
  const monthTitle = date(`${month}-01`, {month: 'long', year: 'numeric'})
  const cells = monthGrid(month, weekStart)
  /* 2023-01-01 was a Sunday. */
  const weekdays = Array.from({length: 7}, (_, i) =>
    date(`2023-01-0${1 + ((weekStart + i) % 7)}`, {weekday: 'short'}),
  )
  const years = Array.from(
    {length: YEARS_PER_PAGE},
    (_, i) => MIN_YEAR + yearPage * YEARS_PER_PAGE + i,
  ).filter(y => y <= MAX_YEAR)
  const isFirstMonth = year === MIN_YEAR && month.endsWith('-01')
  const isLastMonth = year === MAX_YEAR && month.endsWith('-12')
  const end = to ?? from

  return (
    <View>
      <View style={[a.flex_row, a.align_center, a.justify_between, a.pb_md]}>
        {shouldPickYear ? (
          <Button
            testID={`${testIDPrefix}-title`}
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
        ) : (
          <Text
            testID={`${testIDPrefix}-title`}
            style={[a.text_lg, a.font_semi_bold]}>
            {monthTitle}
          </Text>
        )}
        <View style={[a.flex_row, a.gap_xs]}>
          <Button
            testID={`${testIDPrefix}-prev`}
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
            testID={`${testIDPrefix}-next`}
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
          {years.map(y => (
            <View key={y} style={[a.p_xs, {width: '25%'}]}>
              <Button
                testID={`${testIDPrefix}-year-${y}`}
                label={String(y)}
                size="small"
                color={y === year ? 'primary' : 'secondary'}
                onPress={() => {
                  setMonth(`${y}${month.slice(4)}`)
                  setIsPickingYear(false)
                }}>
                <ButtonText>{String(y)}</ButtonText>
              </Button>
            </View>
          ))}
        </View>
      ) : (
        <View>
          <View style={[a.flex_row]}>
            {weekdays.map((d, i) => (
              <View key={i} style={[a.flex_1, a.align_center, a.pb_sm]}>
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
                const isSelected = day === from || day === end
                const isToday = day === today
                const isBanded = !!from && !!end && from !== end
                const isInside = isBanded && day > from && day < end
                return (
                  <View
                    key={i}
                    style={[a.flex_1, a.align_center, {height: CELL + 4}]}>
                    {isBanded && (isInside || isSelected) ? (
                      <View
                        style={[
                          a.absolute,
                          {
                            top: 2,
                            height: CELL,
                            left: day === from ? '50%' : 0,
                            right: day === end ? '50%' : 0,
                            backgroundColor: t.palette.primary_50,
                          },
                        ]}
                      />
                    ) : null}
                    <Button
                      testID={`${testIDPrefix}-day-${day}`}
                      label={date(day, {dateStyle: 'full'})}
                      accessibilityState={{selected: isSelected}}
                      onPress={() => onPick(day)}
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
                        {Number(day.slice(8))}
                      </Text>
                    </Button>
                  </View>
                )
              })}
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
