import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {addDays} from '@splito/domain'

import {useToday} from '#/locale/useDates'
import {usePref} from '#/data/hooks'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as FormSheet from '#/components/FormSheet'
import {MonthCalendar} from '#/components/forms/MonthCalendar'
import {Text} from '#/components/Typography'

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
  const {t: l} = useLingui()
  const control = Dialog.useDialogContext()
  const [weekStart = 1] = usePref('weekStart')
  const today = useToday()
  const start = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : today

  const pick = (date: string) => control.close(() => onSelect(date))

  return (
    <FormSheet.Inner title={title}>
      <MonthCalendar
        testIDPrefix="calendar"
        initialMonth={start.slice(0, 7)}
        from={value}
        today={today}
        weekStart={weekStart}
        shouldPickYear
        onPick={pick}
      />

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
