import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {Layers} from 'lucide-react-native'

import {atoms as a, useTheme} from '#/alf'
import * as Dialog from '#/components/Dialog'
import * as FormSheet from '#/components/FormSheet'
import {SearchInput} from '#/components/forms/SearchInput'
import * as Toggle from '#/components/forms/Toggle'
import {GroupAvatar} from '#/components/groups/GroupAvatar'
import {ChevronExpand_Stroke2_Corner0_Rounded as ChevronDownIcon} from '#/components/icons/Chevron'
import {createIcon} from '#/components/icons/lucide'
import {Person_Stroke2_Corner2_Rounded as PersonIcon} from '#/components/icons/Person'
import {Pressable} from '#/components/Pressable'
import {Text} from '#/components/Typography'
import {type Scope, scopeFromTicks, ticksOf} from '#/screens/Analytics/scope'
import {type GroupOption} from '#/screens/Analytics/useReport'

/** Everything: non-group expenses and every group. */
export const LayersIcon = createIcon(Layers)

/** With more groups than this, the sheet gets a search field (26.16). */
const SEARCH_FROM = 9
const TILE = 36

/**
 * "Show expenses from": the one place Analytics' scope is chosen (26.16).
 * One checklist - All, Non-group expenses, then every group (inactive ones
 * under a fold) - in Bluesky's checkbox rows; nothing changes until Apply,
 * which stays off while nothing is ticked.
 */
export function ScopeDialog({
  control,
  scope,
  groups,
  onScopeApplied,
}: {
  control: Dialog.DialogControlProps
  scope: Scope
  /** Active first, then inactive: the sheet's order. */
  groups: GroupOption[]
  onScopeApplied: (scope: Scope) => void
}) {
  return (
    <FormSheet.Outer control={control} testID="analytics-scope-sheet">
      <Checklist
        scope={scope}
        groups={groups}
        onScopeApplied={onScopeApplied}
      />
    </FormSheet.Outer>
  )
}

function Checklist({
  scope,
  groups,
  onScopeApplied,
}: {
  scope: Scope
  groups: GroupOption[]
  onScopeApplied: (scope: Scope) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const control = Dialog.useDialogContext()
  const groupIds = groups.map(g => g.id)
  const initial = ticksOf(scope, groupIds)
  const [nonGroup, setNonGroup] = useState(initial.nonGroup)
  const [ticked, setTicked] = useState(initial.groups)
  const [query, setQuery] = useState('')
  const archived = groups.filter(g => g.isInactive)
  const [isArchivedOpen, setIsArchivedOpen] = useState(
    () => scope.groups !== 'all' && archived.some(g => ticked.includes(g.id)),
  )

  const next = scopeFromTicks(nonGroup, ticked, groupIds)
  const tickCount = Number(nonGroup) + ticked.length
  const total = 1 + groups.length
  const isAll = tickCount === total
  const q = query.trim().toLowerCase()
  const matches = (g: GroupOption) => !q || g.name.toLowerCase().includes(q)
  const active = groups.filter(g => !g.isInactive && matches(g))
  const archivedShown = archived.filter(matches)
  /* A search looks inside the fold too. */
  const isArchivedVisible = isArchivedOpen || q.length > 0

  const groupRows = (list: GroupOption[]) =>
    list.map(g => (
      <Row
        key={g.id}
        name={g.id}
        testID={`analytics-scope-group-${g.name}`}
        label={g.name}
        icon={<GroupAvatar kind={g.kind} name={g.name} size={TILE} />}
      />
    ))

  return (
    <FormSheet.Inner
      title={l`Show expenses from`}
      isDirty={
        nonGroup !== initial.nonGroup ||
        [...ticked].sort().join() !== [...initial.groups].sort().join()
      }
      footer={{
        saveLabel: l`Apply`,
        canSave: next !== null,
        onSave: () => {
          if (next) control.close(() => onScopeApplied(next))
        },
      }}>
      <FormSheet.Description>
        <Trans>Totals, charts, the list and the export count only these.</Trans>
      </FormSheet.Description>
      {groups.length >= SEARCH_FROM && (
        <View style={[a.pb_sm]}>
          <SearchInput
            testID="analytics-scope-search"
            value={query}
            onChangeText={setQuery}
            onClearText={() => setQuery('')}
            label={l`Search groups`}
            placeholder={l`Search groups`}
          />
        </View>
      )}
      {/* Outside the group: it sets every row at once rather than being one of them. */}
      {!q && (
        <Toggle.Item
          name="all"
          testID="analytics-scope-all"
          label={l`All`}
          value={isAll}
          onChange={() => {
            setNonGroup(!isAll)
            setTicked(isAll ? [] : groupIds)
          }}
          style={rowStyle(t, false)}>
          <Tile>
            <LayersIcon size="md" fill={t.atoms.text_contrast_medium.color} />
          </Tile>
          <RowText
            label={l`All`}
            note={l`Everything, including groups you add later`}
          />
          <MixedCheckbox isMixed={tickCount > 0 && !isAll} />
        </Toggle.Item>
      )}
      <Toggle.Group
        type="checkbox"
        label={l`Show expenses from`}
        values={[...(nonGroup ? [NON_GROUP] : []), ...ticked]}
        onChange={values => {
          setNonGroup(values.includes(NON_GROUP))
          setTicked(groupIds.filter(id => values.includes(id)))
        }}>
        {!q && (
          <Row
            name={NON_GROUP}
            testID="analytics-scope-non-group"
            label={l`Non-group expenses`}
            note={l`Directly with friends, outside any group`}
            icon={
              <Tile>
                <PersonIcon
                  size="md"
                  fill={t.atoms.text_contrast_medium.color}
                />
              </Tile>
            }
          />
        )}
        {groupRows(active)}
        {archived.length > 0 && (
          <Pressable
            testID="analytics-scope-archived"
            accessibilityRole="button"
            accessibilityLabel={l`Inactive groups`}
            accessibilityState={{expanded: isArchivedVisible}}
            disabled={q.length > 0}
            onPress={() => setIsArchivedOpen(o => !o)}
            style={[a.flex_row, a.align_center, a.gap_xs, a.pt_lg, a.pb_sm]}>
            <Text
              style={[
                a.text_sm,
                a.font_semi_bold,
                t.atoms.text_contrast_medium,
              ]}>
              <Trans>Inactive · {archived.length}</Trans>
            </Text>
            <ChevronDownIcon
              size="sm"
              fill={t.atoms.text_contrast_medium.color}
              active={isArchivedVisible}
            />
          </Pressable>
        )}
        {isArchivedVisible && groupRows(archivedShown)}
      </Toggle.Group>
      {q && active.length === 0 && archivedShown.length === 0 && (
        <Text
          style={[
            a.text_md,
            a.py_xl,
            a.text_center,
            t.atoms.text_contrast_medium,
          ]}>
          <Trans>No groups match “{query}”</Trans>
        </Text>
      )}
    </FormSheet.Inner>
  )
}

/* Toggle names are group ids (never empty), so this cannot collide. */
const NON_GROUP = ''

/* A hairline between rows; none under the last, where the footer draws its own. */
function rowStyle(t: ReturnType<typeof useTheme>, hasDivider = true) {
  return [
    hasDivider && a.border_t,
    t.atoms.border_contrast_low,
    a.rounded_0,
    a.px_0,
    a.py_sm,
    a.gap_md,
  ]
}

function Row({
  name,
  testID,
  label,
  note,
  icon,
}: {
  name: string
  testID: string
  label: string
  note?: string
  icon: React.ReactNode
}) {
  const t = useTheme()
  return (
    <Toggle.Item name={name} testID={testID} label={label} style={rowStyle(t)}>
      {icon}
      <RowText label={label} note={note} />
      <Toggle.Checkbox />
    </Toggle.Item>
  )
}

function RowText({label, note}: {label: string; note?: string}) {
  const t = useTheme()
  return (
    <View style={[a.flex_1, {minWidth: 0}]}>
      <Text style={[a.text_md, a.font_medium]} numberOfLines={1}>
        {label}
      </Text>
      {note ? (
        <Text
          style={[a.text_sm, t.atoms.text_contrast_medium]}
          numberOfLines={1}>
          {note}
        </Text>
      ) : null}
    </View>
  )
}

/* The neutral tile the All and Non-group rows share, sized like GroupAvatar's. */
function Tile({children}: {children: React.ReactNode}) {
  const t = useTheme()
  return (
    <View
      style={[
        a.align_center,
        a.justify_center,
        t.atoms.bg_contrast_50,
        {width: TILE, height: TILE, borderRadius: Math.round(TILE * 0.24)},
      ]}>
      {children}
    </View>
  )
}

/**
 * Bluesky's checkbox with a third, "some" state for the All row: the same
 * box, filled, with a dash. Bluesky's Toggle has no mixed state to copy.
 */
function MixedCheckbox({isMixed}: {isMixed: boolean}) {
  const t = useTheme()
  const item = Toggle.useItemContext()
  if (!isMixed) return <Toggle.Checkbox />
  const {baseStyles, baseHoverStyles} = Toggle.createSharedToggleStyles({
    theme: t,
    hovered: item.hovered,
    focused: item.focused,
    selected: true,
    disabled: item.disabled,
    isInvalid: item.isInvalid,
  })
  return (
    <View
      testID="analytics-scope-all-mixed"
      style={[
        a.justify_center,
        a.align_center,
        {borderWidth: 1, height: 24, width: 24, borderRadius: 6},
        baseStyles,
        item.hovered ? baseHoverStyles : {},
      ]}>
      <View
        style={[
          a.rounded_full,
          {width: 12, height: 2, backgroundColor: t.palette.white},
        ]}
      />
    </View>
  )
}
