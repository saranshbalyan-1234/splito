import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {type EdgeRule, type SettlementRules} from '@splito/domain'
import {type Entity, type Group, updateGroupRules} from '@splito/sync'

import {useHaptics} from '#/lib/haptics'
import {logger} from '#/logger'
import {useMutationCtx, useStore} from '#/data/hooks'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as FormSheet from '#/components/FormSheet'
import * as SegmentedControl from '#/components/forms/SegmentedControl'
import * as Toggle from '#/components/forms/Toggle'
import {ArrowRotateCounterClockwise_Stroke2_Corner0_Rounded as ResetIcon} from '#/components/icons/ArrowRotate'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'

export const NO_RULES: SettlementRules = {allowListOnly: false, edges: {}}

/** The rule a pair actually gets: its own, else the group default. */
export function effectiveRule(
  rules: SettlementRules,
  from: string,
  to: string,
): EdgeRule {
  return (
    rules.edges[`${from}>${to}`] ??
    (rules.allowListOnly ? 'excluded' : 'allowed')
  )
}

/**
 * "Who you settle with" (the group page's Payment rules sheet): per directed
 * pair (payer -> receiver) allowed, preferred or excluded, plus the
 * allow-list switch. Changes stay in the sheet until Save
 * (`updateGroupRules`); Cancel drops them. The defaults are spelled out, and
 * an excluded pair is never turned into a preference.
 */
export function RulesDialog({
  control,
  group,
  names,
  me,
}: {
  control: Dialog.DialogControlProps
  group: Entity<Group>
  names: Map<string, string>
  me: string
}) {
  return (
    <FormSheet.Outer control={control} testID="rules-sheet" fullHeight>
      <RulesForm group={group} names={names} me={me} />
    </FormSheet.Outer>
  )
}

function RulesForm({
  group,
  names,
  me,
}: {
  group: Entity<Group>
  names: Map<string, string>
  me: string
}) {
  const {t: l} = useLingui()
  const control = Dialog.useDialogContext()
  const store = useStore()
  const ctx = useMutationCtx()
  const haptics = useHaptics()
  const [initial] = useState(group.data.rules ?? NO_RULES)
  const [rules, setRules] = useState(initial)
  const [isSaving, setIsSaving] = useState(false)
  const isDirty = JSON.stringify(rules) !== JSON.stringify(initial)

  const save = async () => {
    setIsSaving(true)
    try {
      await updateGroupRules(store, ctx, group.id, rules)
      haptics.success()
      control.close(() => Toast.show(l`Payment rules saved`, {type: 'success'}))
    } catch (e) {
      logger.error(e, {where: 'RulesDialog.save'})
      setIsSaving(false)
      haptics.error()
      Toast.show(l`Couldn’t save the rules. Please try again.`, {
        type: 'error',
      })
    }
  }

  return (
    <FormSheet.Inner
      title={l`Payment rules`}
      isDirty={isDirty}
      footer={{
        saveLabel: l`Save`,
        canSave: isDirty,
        isSaving,
        onSave: () => void save(),
      }}>
      <RulesEditor
        group={group}
        names={names}
        me={me}
        rules={rules}
        onRulesChange={setRules}
      />
    </FormSheet.Inner>
  )
}

/** The rules themselves: the allow-list switch, then every pair. */
function RulesEditor({
  group,
  names,
  me,
  rules,
  onRulesChange,
}: {
  group: Entity<Group>
  names: Map<string, string>
  me: string
  rules: SettlementRules
  onRulesChange: (rules: SettlementRules) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const members = group.data.members
    .map(m => m.personId)
    .sort((x, y) =>
      x === me
        ? -1
        : y === me
          ? 1
          : (names.get(x) ?? '').localeCompare(names.get(y) ?? ''),
    )
  const hasRules = rules.allowListOnly || Object.keys(rules.edges).length > 0
  const save = (change: (current: SettlementRules) => SettlementRules) =>
    onRulesChange(change(rules))

  const setRule = (from: string, to: string, rule: EdgeRule) =>
    save(r => ({...r, edges: {...r.edges, [`${from}>${to}`]: rule}}))

  return (
    <View style={[a.pb_lg]}>
      <View style={[a.pb_lg, a.gap_xs]}>
        <Text style={[a.text_lg, a.font_bold, a.leading_snug]}>
          <Trans>Who you settle with</Trans>
        </Text>
        <Text style={[a.text_md, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>
            Choose who can pay whom when this group settles up. With no rules,
            anyone can pay anyone. Preferred pairs are used first. Excluded
            pairs are never used, so a plan may need a different route or may
            not be possible.
          </Trans>
        </Text>
      </View>

      <View
        style={[
          a.mb_lg,
          a.px_lg,
          a.py_md,
          a.rounded_md,
          a.border,
          t.atoms.border_contrast_low,
        ]}>
        <Toggle.Item
          testID="rules-allow-list"
          name="allowListOnly"
          label={l`Only allowed pairs`}
          value={rules.allowListOnly}
          onChange={v => save(r => ({...r, allowListOnly: v}))}
          style={[a.w_full]}>
          <View style={[a.flex_1, a.gap_2xs, a.pr_md]}>
            <Toggle.LabelText style={[a.text_md, a.font_semi_bold]}>
              <Trans>Only allowed pairs</Trans>
            </Toggle.LabelText>
            <Text
              style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
              <Trans>
                Pairs you haven’t marked Allowed or Preferred are treated as
                excluded.
              </Trans>
            </Text>
          </View>
          <Toggle.Platform />
        </Toggle.Item>
      </View>

      {members.map(from => (
        <View key={from} style={[a.pb_md]}>
          <View
            style={[a.flex_row, a.align_center, a.gap_sm, a.pt_md, a.pb_sm]}>
            <UserAvatar size={24} name={names.get(from)} type="user" />
            <Text emoji style={[a.text_md, a.font_semi_bold]}>
              {from === me ? (
                <Trans>When you pay</Trans>
              ) : (
                <Trans>When {names.get(from) ?? ''} pays</Trans>
              )}
            </Text>
          </View>
          {members
            .filter(to => to !== from)
            .map(to => (
              <PairRow
                key={to}
                from={from}
                to={to}
                toName={to === me ? l`You` : (names.get(to) ?? l`Someone`)}
                isToMe={to === me}
                rule={effectiveRule(rules, from, to)}
                isDefault={!(`${from}>${to}` in rules.edges)}
                onRuleChanged={rule => setRule(from, to, rule)}
              />
            ))}
        </View>
      ))}

      {hasRules && (
        <View style={[a.pt_sm, a.flex_row]}>
          <Button
            testID="rules-reset"
            label={l`Reset rules`}
            size="small"
            color="secondary"
            onPress={() => save(() => NO_RULES)}>
            <ButtonIcon icon={ResetIcon} />
            <ButtonText>
              <Trans>Reset to anyone pays anyone</Trans>
            </ButtonText>
          </Button>
        </View>
      )}
    </View>
  )
}

function PairRow({
  from,
  to,
  toName,
  isToMe,
  rule,
  isDefault,
  onRuleChanged,
}: {
  from: string
  to: string
  toName: string
  isToMe: boolean
  rule: EdgeRule
  isDefault: boolean
  onRuleChanged: (rule: EdgeRule) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {gtMobile} = useBreakpoints()
  const options: Array<[EdgeRule, string]> = [
    ['allowed', l`Allowed`],
    ['preferred', l`Preferred`],
    ['excluded', l`Excluded`],
  ]

  return (
    <View
      style={[
        a.py_sm,
        a.border_t,
        t.atoms.border_contrast_low,
        gtMobile ? [a.flex_row, a.align_center, a.gap_md] : a.gap_sm,
      ]}>
      <View style={[a.flex_1, a.flex_row, a.align_center, a.gap_sm]}>
        <UserAvatar size={32} name={toName} type="user" />
        <View style={[a.flex_1]}>
          <Text emoji numberOfLines={1} style={[a.text_md, a.leading_snug]}>
            {isToMe ? <Trans>pays you</Trans> : <Trans>pays {toName}</Trans>}
          </Text>
          <Text
            style={[a.text_xs, a.leading_snug, t.atoms.text_contrast_medium]}>
            {isDefault ? (
              <Trans>Default</Trans>
            ) : (
              <Trans>Set for this group</Trans>
            )}
          </Text>
        </View>
      </View>
      <View style={[gtMobile ? {width: 340} : a.w_full]}>
        <SegmentedControl.Root
          label={l`Rule for this pair`}
          type="radio"
          size="small"
          value={rule}
          // The control reports its current value once on layout; only real changes save.
          onChange={v => v !== rule && onRuleChanged(v)}>
          {options.map(([value, label]) => (
            <SegmentedControl.Item
              key={value}
              value={value}
              label={label}
              testID={`rule-${from}-${to}-${value}`}>
              <SegmentedControl.ItemText style={[a.text_sm]}>
                {label}
              </SegmentedControl.ItemText>
            </SegmentedControl.Item>
          ))}
        </SegmentedControl.Root>
      </View>
    </View>
  )
}
