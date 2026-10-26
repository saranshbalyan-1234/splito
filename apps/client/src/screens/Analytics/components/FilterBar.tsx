import {ScrollView, View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {getCurrency} from '@splito/domain'

import {atoms as a} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {Check_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/Check'
import {ChevronBottom_Stroke2_Corner0_Rounded as ChevronDownIcon} from '#/components/icons/Chevron'
import {Group3_Stroke2_Corner0_Rounded as GroupIcon} from '#/components/icons/Group'
import {
  ChartColumn_Stroke2_Corner0_Rounded as ChartIcon,
  Table_Stroke2_Corner0_Rounded as TableIcon,
} from '#/components/icons/Table'
import * as Menu from '#/components/Menu'
import {type Report} from '#/screens/Analytics/useReport'

/**
 * The one row of filters above everything they scope: currency, group and
 * Include groups (the period is the headline's own control). Charts,
 * totals, the list and the CSV all follow it. The row scrolls sideways when
 * it does not fit; the charts / table switch stays at its end.
 */
export function FilterBar({
  report,
  isTable,
  onToggleView,
}: {
  report: Report
  isTable: boolean
  onToggleView: () => void
}) {
  const {t: l} = useLingui()
  const groupLabel = report.groupId
    ? report.nameOfGroup(report.groupId)
    : l`All groups`

  const chips = (
    <>
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
        /* A filter chip that is on or off, like the others: filled with a tick when on. */
        <Button
          testID="analytics-include-groups"
          label={l`Include groups`}
          role="switch"
          aria-checked={report.includeGroups}
          accessibilityState={{checked: report.includeGroups}}
          size="small"
          color={report.includeGroups ? 'primary_subtle' : 'secondary'}
          onPress={() => report.setIncludeGroups(!report.includeGroups)}>
          {report.includeGroups && <ButtonIcon icon={CheckIcon} />}
          <ButtonText>
            <Trans>Include groups</Trans>
          </ButtonText>
        </Button>
      )}

    </>
  )

  return (
    <View
      testID="analytics-filters"
      style={[a.flex_row, a.align_center, a.gap_sm, a.pt_md, a.pr_lg]}>
      {/* The filters scroll sideways in one row; the view switch stays put at the end. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[a.flex_1]}
        contentContainerStyle={[a.flex_row, a.align_center, a.gap_sm, a.pl_lg]}>
        {chips}
      </ScrollView>
      {/* Charts or tables: a display choice (the `analyticsView` preference), so it sits with the filters. */}
      <Button
        testID="analytics-view-toggle"
        label={isTable ? l`Show charts` : l`Show as tables`}
        size="small"
        color="secondary"
        onPress={onToggleView}>
        <ButtonIcon icon={isTable ? ChartIcon : TableIcon} />
        <ButtonText>
          {isTable ? <Trans>Charts</Trans> : <Trans>Table</Trans>}
        </ButtonText>
      </Button>
    </View>
  )
}
