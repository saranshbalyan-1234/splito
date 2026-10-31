import {ScrollView, View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {getCurrency} from '@splito/domain'

import {atoms as a, useBreakpoints} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {GroupAvatar} from '#/components/groups/GroupAvatar'
import {ChevronBottom_Stroke2_Corner0_Rounded as ChevronDownIcon} from '#/components/icons/Chevron'
import {Group3_Stroke2_Corner0_Rounded as GroupIcon} from '#/components/icons/Group'
import {Person_Stroke2_Corner2_Rounded as PersonIcon} from '#/components/icons/Person'
import {
  ChartColumn_Stroke2_Corner0_Rounded as ChartIcon,
  Table_Stroke2_Corner0_Rounded as TableIcon,
} from '#/components/icons/Table'
import * as Menu from '#/components/Menu'
import {
  LayersIcon,
  ScopeDialog,
} from '#/screens/Analytics/components/ScopeDialog'
import {PeriodControl} from '#/screens/Analytics/components/Summary'
import {isEverything, scopeSummary} from '#/screens/Analytics/scope'
import {type Report} from '#/screens/Analytics/useReport'
import {useScopeLabel} from '#/screens/Analytics/useScopeLabel'

/**
 * The one row of filters above everything they scope: currency, the scope
 * chip and the period, all on one line (owner 171). Charts, totals,
 * the list and the CSV all follow it. Wide screens keep one row that
 * scrolls sideways if it must, with the charts / table switch at its end;
 * phones scroll the whole row, so no chip is ever cut in half.
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
  const {gtMobile} = useBreakpoints()

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

      <ScopeChip report={report} />
      <PeriodControl report={report} />
    </>
  )

  /* Charts or tables: a display choice (the `analyticsView` preference), so it sits with the filters. */
  const viewToggle = (
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
  )

  return gtMobile ? (
    <View
      testID="analytics-filters"
      style={[a.flex_row, a.align_center, a.gap_sm, a.pt_md, a.pr_lg]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[a.flex_1]}
        contentContainerStyle={[a.flex_row, a.align_center, a.gap_sm, a.pl_lg]}>
        {chips}
      </ScrollView>
      {viewToggle}
    </View>
  ) : (
    /* Phones: one row that scrolls sideways, so no chip is ever orphaned on a second line. */
    <ScrollView
      testID="analytics-filters"
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[a.pt_md]}
      contentContainerStyle={[a.flex_row, a.align_center, a.gap_sm, a.px_lg]}>
      {chips}
      {viewToggle}
    </ScrollView>
  )
}

/**
 * One chip says what is counted ("Everything", "Non-group only", "Goa trip
 * + 1" ...) and opens the "Show expenses from" sheet (26.16). Tinted while
 * it narrows anything, as an active filter is.
 */
function ScopeChip({report}: {report: Report}) {
  const {t: l} = useLingui()
  const control = Dialog.useDialogControl({url: 'scope'})
  const {scope, groupOptions, groupIds} = report
  const summary = scopeSummary(scope, groupIds)
  const name = (id: string) => report.nameOfGroup(id)

  const label = useScopeLabel(scope, groupIds, name)
  let icon: React.ReactNode = <ButtonIcon icon={GroupIcon} />
  switch (summary.kind) {
    case 'everything':
      icon = <ButtonIcon icon={LayersIcon} />
      break
    case 'nonGroup':
      icon = <ButtonIcon icon={PersonIcon} />
      break
    case 'group': {
      const g = groupOptions.find(x => x.id === summary.groupId)
      /* One group wears its own tile. */
      if (summary.more === 0 && g)
        icon = <GroupAvatar kind={g.kind} name={g.name} size={18} />
      break
    }
  }

  return (
    <>
      <Button
        testID="analytics-scope"
        label={l`Show expenses from: ${label}`}
        size="small"
        color={isEverything(scope) ? 'secondary' : 'primary_subtle'}
        onPress={control.open}>
        {icon}
        <ButtonText numberOfLines={1}>{label}</ButtonText>
        <ButtonIcon icon={ChevronDownIcon} />
      </Button>
      <ScopeDialog
        control={control}
        scope={scope}
        groups={groupOptions}
        onScopeApplied={report.setScope}
      />
    </>
  )
}
