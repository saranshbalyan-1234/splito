import {useState} from 'react'
import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'
import {type DateRange, type WeekStart} from '@splito/domain'

import {atoms as a, useTheme} from '#/alf'
import * as Dialog from '#/components/Dialog'
import * as FormSheet from '#/components/FormSheet'
import {MonthCalendar} from '#/components/forms/MonthCalendar'
import {Text} from '#/components/Typography'
import {utcDate} from '#/screens/Analytics/useReport'

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
  const month = (initial && initial.to < today ? initial.to : today).slice(0, 7)
  const [from, setFrom] = useState(initial?.from)
  const [to, setTo] = useState(initial?.to)

  const date = (d: string, o: Intl.DateTimeFormatOptions) =>
    i18n.date(utcDate(d), {...o, timeZone: 'UTC'})

  const pick = (d: string) => {
    if (!from || to || d < from) {
      setFrom(d)
      setTo(undefined)
    } else {
      setTo(d)
    }
  }
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

        <MonthCalendar
          testIDPrefix="analytics-range"
          initialMonth={month}
          from={from}
          to={to}
          today={today}
          weekStart={weekStart}
          onPick={pick}
        />
      </View>
    </FormSheet.Inner>
  )
}
