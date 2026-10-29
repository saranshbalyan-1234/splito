import {useState} from 'react'
import {View} from 'react-native'
import {type TaxClass} from '@splito/sync'
import {nanoid} from 'nanoid/non-secure'
import {Trans, useLingui} from '@lingui/react/macro'

import {useHaptics} from '#/lib/haptics'
import {useA11y} from '#/state/a11y'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {useDialogControl} from '#/components/Dialog'
import {SortableList} from '#/components/DraggableList'
import {
  ArrowBottom_Stroke2_Corner0_Rounded as ArrowDownIcon,
  ArrowTop_Stroke2_Corner0_Rounded as ArrowUpIcon,
} from '#/components/icons/Arrow'
import {Pencil_Stroke2_Corner0_Rounded as PencilIcon} from '#/components/icons/Pencil'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import {useTaxClassName} from '#/components/split/charges/hooks'
import {TagIcon} from '#/components/split/charges/icons'
import {EyeIcon, EyeOffIcon} from '#/components/settings/icons'
import {PrefSection, usePrefControl} from '#/components/settings/PrefSection'
import {TaxClassDialog} from '#/components/settings/TaxClassDialog'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'

const ROW_HEIGHT = 56

/**
 * Tax classes (F-403): the classes an itemised bill's items carry (Food,
 * Soft drinks, Alcohol ...). Add, rename, reorder (drag, or arrows on web
 * and for screen readers) and hide. A hidden class stays on past bills and
 * is only left out of the pickers. Standard is the class of an item without
 * one, so it can be renamed or hidden but not removed.
 */
export function TaxClassesEditor() {
  const t = useTheme()
  const {t: l} = useLingui()
  const haptics = useHaptics()
  const {screenReaderEnabled} = useA11y()
  const {gtMobile} = useBreakpoints()
  const pref = usePrefControl('bill.taxClasses')
  const dialog = useDialogControl()
  const [editing, setEditing] = useState<TaxClass | undefined>()
  if (!pref.value) return null
  const classes = [...pref.value].sort((x, y) => x.order - y.order)
  const showArrows = (IS_WEB && gtMobile) || screenReaderEnabled

  const save = (next: TaxClass[]) =>
    void pref.set(next.map((c, order) => ({...c, order})))
  const move = (index: number, by: -1 | 1) => {
    const next = [...classes]
    const [moved] = next.splice(index, 1)
    next.splice(index + by, 0, moved!)
    haptics.selection()
    save(next)
  }
  const openEditor = (taxClass?: TaxClass) => {
    setEditing(taxClass)
    dialog.open()
  }

  return (
    <PrefSection
      pref={pref}
      icon={TagIcon}
      title={l`Tax classes`}
      description={l`Give each item on a bill a class, like Food or Alcohol, so a charge can apply to some items only.`}>
      <View
        style={[
          a.rounded_md,
          a.overflow_hidden,
          a.border,
          t.atoms.border_contrast_low,
        ]}>
        <SortableList
          data={classes}
          keyExtractor={c => c.id}
          itemHeight={ROW_HEIGHT}
          onReorder={save}
          renderItem={(taxClass, dragHandle) => {
            const index = classes.indexOf(taxClass)
            return (
              <TaxClassRow
                taxClass={taxClass}
                dragHandle={dragHandle}
                isLast={index === classes.length - 1}
                onEdit={() => openEditor(taxClass)}
                onToggleHidden={() => {
                  haptics.toggle(taxClass.hidden)
                  save(
                    classes.map(c =>
                      c.id === taxClass.id ? {...c, hidden: !c.hidden} : c,
                    ),
                  )
                }}
                arrows={
                  showArrows
                    ? {
                        onUp: index > 0 ? () => move(index, -1) : undefined,
                        onDown:
                          index < classes.length - 1
                            ? () => move(index, 1)
                            : undefined,
                      }
                    : undefined
                }
              />
            )
          }}
        />
      </View>
      <View style={[a.flex_row, a.pt_xs]}>
        <Button
          testID="taxclass-add"
          label={l`Add tax class`}
          onPress={() => openEditor(undefined)}
          size="small"
          color="secondary">
          <ButtonIcon icon={PlusIcon} />
          <ButtonText>
            <Trans>Add tax class</Trans>
          </ButtonText>
        </Button>
      </View>

      <TaxClassDialog
        control={dialog}
        taxClass={editing}
        onNameSaved={name => {
          if (editing)
            save(classes.map(c => (c.id === editing.id ? {...c, name} : c)))
          else
            save([
              ...classes,
              {id: nanoid(8), name, order: classes.length, hidden: false},
            ])
        }}
      />
    </PrefSection>
  )
}

function TaxClassRow({
  taxClass,
  dragHandle,
  isLast,
  onEdit,
  onToggleHidden,
  arrows,
}: {
  taxClass: TaxClass
  dragHandle: React.ReactNode
  isLast: boolean
  onEdit: () => void
  onToggleHidden: () => void
  arrows?: {onUp?: () => void; onDown?: () => void}
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const name = useTaxClassName()(taxClass)
  return (
    <View
      testID={`taxclass-${taxClass.id}`}
      style={[
        a.flex_row,
        a.align_center,
        a.gap_sm,
        a.pr_sm,
        t.atoms.bg,
        !isLast && [a.border_b, t.atoms.border_contrast_low],
        {height: ROW_HEIGHT},
      ]}>
      {dragHandle}
      <View style={[a.flex_1, a.gap_2xs]}>
        <Text
          numberOfLines={1}
          style={[
            a.text_md,
            a.font_medium,
            a.leading_snug,
            taxClass.hidden ? t.atoms.text_contrast_low : t.atoms.text,
          ]}>
          {name}
        </Text>
        {taxClass.hidden && (
          <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_low]}>
            <Trans>Hidden</Trans>
          </Text>
        )}
      </View>
      {arrows && (
        <>
          <Button
            label={l`Move ${name} up`}
            onPress={arrows.onUp ?? (() => {})}
            disabled={!arrows.onUp}
            size="small"
            color="secondary"
            variant="ghost"
            shape="round">
            <ButtonIcon icon={ArrowUpIcon} />
          </Button>
          <Button
            label={l`Move ${name} down`}
            onPress={arrows.onDown ?? (() => {})}
            disabled={!arrows.onDown}
            size="small"
            color="secondary"
            variant="ghost"
            shape="round">
            <ButtonIcon icon={ArrowDownIcon} />
          </Button>
        </>
      )}
      <Button
        testID={`taxclass-hide-${taxClass.id}`}
        label={taxClass.hidden ? l`Show ${name}` : l`Hide ${name}`}
        onPress={onToggleHidden}
        size="small"
        color="secondary"
        variant="ghost"
        shape="round">
        <ButtonIcon icon={taxClass.hidden ? EyeOffIcon : EyeIcon} />
      </Button>
      <Button
        testID={`taxclass-edit-${taxClass.id}`}
        label={l`Rename ${name}`}
        onPress={onEdit}
        size="small"
        color="secondary"
        variant="ghost"
        shape="round">
        <ButtonIcon icon={PencilIcon} />
      </Button>
    </View>
  )
}
