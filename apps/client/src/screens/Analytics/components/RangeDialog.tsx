import {useState} from 'react'
import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'
import {addDays, type DateRange, type WeekStart} from '@splito/domain'

import {atoms as a, useTheme} from '#/alf'
import {Pressable} from '#/components/Pressable'
import {Button, ButtonIcon} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as FormSheet from '#/components/FormSheet'
import {
  ChevronLeft_Stroke2_Corner0_Rounded as ChevronLeftIcon,
  ChevronRight_Stroke2_Corner0_Rounded as ChevronRightIcon,
} from '#/components/icons/Chevron'
import {Text} from '#/components/Typography'
import {utcDate} from '#/screens/Analytics/useReport'

const CELL = 40

/** First day of the month `ym` ("YYYY-MM") moved by `by` months. */
function shiftMonth(ym: string, by: number) {
  const d = new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7) - 1 + by, 1))
  return d.toISOString().slice(0, 7)
}

/**
 * Custom range: a month calendar where the first tap sets the start and the
 * second the end (tapping before the start moves the start). Bluesky's
 * dialog: a bottom sheet on phones, a centred dialog on web.
 */
export function RangeDialog({
  control,
  initial,
  today,
  weekStart,
  onApply,
}: {
  control: Dialog.DialogControlProps
  initial: DateRange | undefined
  today: string
  weekStart: WeekStart
  onApply: (range: DateRange) => void
}) {
  return (
    <FormSheet.Outer control={control} testID="analytics-range-dialog">
      <Calendar
        initial={initial}
        today={today}
        weekStart={weekStart}
        onApply={range => control.close(() => onApply(range))}
      />
    </FormSheet.Outer>
  )
}

function Calendar({
  initial,
  today,
  weekStart,
  onApply,
}: {
  initial: DateRange | undefined
  today: string
  weekStart: WeekStart
  onApply: (range: DateRange) => void
}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  /* Open on the month the range ends in, or this month; never a future month the range merely reaches. */
  const [month, setMonth] = useState(
    (initial && initial.to < today ? initial.to : today).slice(0, 7),
  )
  const [from, setFrom] = useState(initial?.from)
  const [to, setTo] = useState(initial?.to)

  const date = (d: string, o: Intl.DateTimeFormatOptions) =>
    i18n.date(utcDate(d), {...o, timeZone: 'UTC'})
  const first = `${month}-01`
  const lead = (utcDate(first).getUTCDay() - weekStart + 7) % 7
  const days = new Date(
    Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0),
  ).getUTCDate()
  const cells = [
    ...Array.from({length: lead}, () => null),
    ...Array.from({length: days}, (_, i) => addDays(first, i)),
  ]
  const weekdays = Array.from({length: 7}, (_, i) =>
    /* 2023-01-01 was a Sunday. */
    date(addDays('2023-01-01', (weekStart + i) % 7), {weekday: 'narrow'}),
  )

  const pick = (d: string) => {
    if (!from || to || d < from) {
      setFrom(d)
      setTo(undefined)
    } else {
      setTo(d)
    }
  }
  const end = to ?? from
  const summary = from
    ? `${date(from, {day: 'numeric', month: 'short', year: 'numeric'})} – ${
        to ? date(to, {day: 'numeric', month: 'short', year: 'numeric'}) : '…'
      }`
    : l`Pick the first day`

  return (
    <FormSheet.Inner
      title={l`Custom range`}
      isDirty={from !== initial?.from || to !== initial?.to}
      footer={{
        saveLabel: l`Apply`,
        canSave: !!from,
        onSave: () => from && onApply({from, to: to ?? from}),
      }}>
      <View style={[a.gap_lg]}>
        <View style={a.gap_xs}>
          <Text
            testID="analytics-range-summary"
            style={[a.text_md, a.leading_snug, t.atoms.text_contrast_medium]}>
            {summary}
          </Text>
        </View>

        <View style={[a.gap_sm, a.align_center]}>
          <View
            style={[
              a.flex_row,
              a.align_center,
              a.justify_between,
              {width: CELL * 7},
            ]}>
            <Button
              testID="analytics-range-prev-month"
              label={l`Previous month`}
              size="small"
              color="secondary"
              variant="ghost"
              shape="round"
              onPress={() => setMonth(m => shiftMonth(m, -1))}>
              <ButtonIcon icon={ChevronLeftIcon} />
            </Button>
            <Text style={[a.text_md, a.font_semi_bold]}>
              {date(first, {month: 'long', year: 'numeric'})}
            </Text>
            <Button
              testID="analytics-range-next-month"
              label={l`Next month`}
              size="small"
              color="secondary"
              variant="ghost"
              shape="round"
              onPress={() => setMonth(m => shiftMonth(m, 1))}>
              <ButtonIcon icon={ChevronRightIcon} />
            </Button>
          </View>
          <View style={[a.flex_row, {width: CELL * 7}]}>
            {weekdays.map((w, i) => (
              <Text
                key={i}
                aria-hidden
                style={[
                  a.text_xs,
                  a.font_semi_bold,
                  a.text_center,
                  t.atoms.text_contrast_low,
                  {width: CELL},
                ]}>
                {w}
              </Text>
            ))}
          </View>
          <View style={[a.flex_row, a.flex_wrap, {width: CELL * 7}]}>
            {cells.map((d, i) => {
              if (!d)
                return (
                  <View key={`lead-${i}`} style={{width: CELL, height: CELL}} />
                )
              const isEnd = d === from || d === end
              const isInside = !!from && !!end && d > from && d < end
              return (
                <View
                  key={d}
                  style={[
                    {width: CELL, height: CELL},
                    isInside && {backgroundColor: t.palette.primary_50},
                    d === from &&
                      end !== from && {
                        backgroundColor: t.palette.primary_50,
                        borderTopLeftRadius: CELL / 2,
                        borderBottomLeftRadius: CELL / 2,
                      },
                    d === end &&
                      end !== from && {
                        backgroundColor: t.palette.primary_50,
                        borderTopRightRadius: CELL / 2,
                        borderBottomRightRadius: CELL / 2,
                      },
                  ]}>
                  <Pressable
                    testID={`analytics-range-day-${d}`}
                    accessibilityRole="button"
                    accessibilityLabel={date(d, {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                    accessibilityHint=""
                    accessibilityState={{selected: isEnd}}
                    onPress={() => pick(d)}
                    style={({hovered, pressed}) => [
                      a.flex_1,
                      a.align_center,
                      a.justify_center,
                      a.rounded_full,
                      isEnd
                        ? {backgroundColor: t.palette.primary_500}
                        : (hovered || pressed) && t.atoms.bg_contrast_50,
                    ]}>
                    <Text
                      style={[
                        a.text_sm,
                        d === today && a.font_bold,
                        isEnd
                          ? {color: t.palette.white}
                          : d === today
                            ? {color: t.palette.primary_500}
                            : t.atoms.text,
                      ]}>
                      {date(d, {day: 'numeric'})}
                    </Text>
                  </Pressable>
                </View>
              )
            })}
          </View>
        </View>
      </View>
    </FormSheet.Inner>
  )
}
