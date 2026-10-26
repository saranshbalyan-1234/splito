import {ScrollView, View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {getCurrency} from '@splito/domain'

import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as Toggle from '#/components/forms/Toggle'
import {CalendarDays_Stroke2_Corner0_Rounded as CalendarIcon} from '#/components/icons/CalendarDays'
import {ChevronBottom_Stroke2_Corner0_Rounded as ChevronDownIcon} from '#/components/icons/Chevron'
import {Group3_Stroke2_Corner0_Rounded as GroupIcon} from '#/components/icons/Group'
import * as Menu from '#/components/Menu'
import {RangeDialog} from '#/screens/Analytics/components/RangeDialog'
import {type PeriodChoice, type Report} from '#/screens/Analytics/useReport'

/**
 * The one row of filters above everything they scope: period first, then
 * currency, group and Include groups. Charts, totals, the list and the CSV
 * all follow it. Phones scroll the row sideways.
 */
export function FilterBar({report}: {report: Report}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {gtMobile} = useBreakpoints()
  const rangeControl = Dialog.useDialogControl()

  const periods: Array<{
    value: Exclude<PeriodChoice, 'custom'>
    label: string
  }> = [
    {value: 'week', label: l`Week`},
    {value: 'month', label: l`Month`},
    {value: 'year', label: l`Year`},
    {value: 'all', label: l`All time`},
  ]
  const periodName =
    report.period === 'custom'
      ? l`Custom range`
      : periods.find(p => p.value === report.period)!.label
  const groupLabel = report.groupId
    ? report.nameOfGroup(report.groupId)
    : l`All groups`

  const chips = (
    <>
      <Menu.Root>
        <Menu.Trigger label={l`Period: ${periodName}`}>
          {({props}) => (
            <Button
              testID="analytics-period"
              {...props}
              label={props.accessibilityLabel}
              size="small"
              color="secondary">
              <ButtonIcon icon={CalendarIcon} />
              <ButtonText>{periodName}</ButtonText>
              <ButtonIcon icon={ChevronDownIcon} />
            </Button>
          )}
        </Menu.Trigger>
        <Menu.Outer>
          <Menu.Group>
            {periods.map(p => (
              <Menu.Item
                key={p.value}
                testID={`analytics-period-${p.value}`}
                label={p.label}
                onPress={() => report.setPeriod(p.value)}>
                <Menu.ItemText>{p.label}</Menu.ItemText>
                <Menu.ItemRadio selected={report.period === p.value} />
              </Menu.Item>
            ))}
          </Menu.Group>
          <Menu.Divider />
          <Menu.Group>
            <Menu.Item
              testID="analytics-period-custom"
              label={l`Custom range…`}
              onPress={() => rangeControl.open()}>
              <Menu.ItemText>
                <Trans>Custom range…</Trans>
              </Menu.ItemText>
              <Menu.ItemRadio selected={report.period === 'custom'} />
            </Menu.Item>
          </Menu.Group>
        </Menu.Outer>
      </Menu.Root>

      <Menu.Root>
        <Menu.Trigger label={l`Currency: ${report.currency}`}>
          {({props}) => (
            <Button
              testID="analytics-currency"
              {...props}
              label={props.accessibilityLabel}
              size="small"
              color="secondary">
              <ButtonText>{report.currency}</ButtonText>
              <ButtonIcon icon={ChevronDownIcon} />
            </Button>
          )}
        </Menu.Trigger>
        <Menu.Outer>
          <Menu.LabelText>
            <Trans>Amounts are never added across currencies.</Trans>
          </Menu.LabelText>
          <Menu.Group>
            {report.currencies.map(c => (
              <Menu.Item
                key={c}
                testID={`analytics-currency-${c}`}
                label={`${c} – ${getCurrency(c).name}`}
                onPress={() => report.setCurrency(c)}>
                <Menu.ItemText>{`${c} – ${getCurrency(c).name}`}</Menu.ItemText>
                <Menu.ItemRadio selected={report.currency === c} />
              </Menu.Item>
            ))}
          </Menu.Group>
        </Menu.Outer>
      </Menu.Root>

      {report.groupChoices.length > 0 && (
        <Menu.Root>
          <Menu.Trigger label={l`Group: ${groupLabel}`}>
            {({props}) => (
              <Button
                testID="analytics-group"
                {...props}
                label={props.accessibilityLabel}
                size="small"
                color="secondary">
                <ButtonIcon icon={GroupIcon} />
                <ButtonText>{groupLabel}</ButtonText>
                <ButtonIcon icon={ChevronDownIcon} />
              </Button>
            )}
          </Menu.Trigger>
          <Menu.Outer>
            <Menu.Group>
              <Menu.Item
                testID="analytics-group-all"
                label={l`All groups`}
                onPress={() => report.setGroupId(undefined)}>
                <Menu.ItemText>
                  <Trans>All groups</Trans>
                </Menu.ItemText>
                <Menu.ItemRadio selected={!report.groupId} />
              </Menu.Item>
            </Menu.Group>
            <Menu.Divider />
            <Menu.Group>
              {report.groupChoices.map(g => (
                <Menu.Item
                  key={g.id}
                  testID={`analytics-group-${g.name}`}
                  label={g.name}
                  onPress={() => report.setGroupId(g.id)}>
                  <Menu.ItemText>{g.name}</Menu.ItemText>
                  <Menu.ItemRadio selected={report.groupId === g.id} />
                </Menu.Item>
              ))}
            </Menu.Group>
          </Menu.Outer>
        </Menu.Root>
      )}

      {!report.groupId && report.groupChoices.length > 0 && (
        <Toggle.Item
          testID="analytics-include-groups"
          name="include-groups"
          label={l`Include groups`}
          value={report.includeGroups}
          onChange={report.setIncludeGroups}
          style={[
            a.rounded_full,
            a.pl_sm,
            a.pr_md,
            {height: 33},
            t.atoms.bg_contrast_50,
          ]}>
          <Toggle.Checkbox />
          <Toggle.LabelText style={[a.text_sm]}>
            <Trans>Include groups</Trans>
          </Toggle.LabelText>
        </Toggle.Item>
      )}
    </>
  )

  return (
    <>
      {gtMobile ? (
        <View
          testID="analytics-filters"
          style={[
            a.flex_row,
            a.flex_wrap,
            a.align_center,
            a.gap_sm,
            a.px_lg,
            a.pt_md,
          ]}>
          {chips}
        </View>
      ) : (
        <ScrollView
          testID="analytics-filters"
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[a.align_center, a.gap_sm, a.px_lg, a.pt_md]}>
          {chips}
        </ScrollView>
      )}
      <RangeDialog
        control={rangeControl}
        initial={report.customRange}
        today={report.today}
        weekStart={report.weekStart}
        onApply={report.setCustom}
      />
    </>
  )
}
