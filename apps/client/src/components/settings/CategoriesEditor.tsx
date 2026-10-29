import {useState} from 'react'
import {View} from 'react-native'
import {type Category} from '@splito/sync'
import {Trans, useLingui} from '@lingui/react/macro'

import {useHaptics} from '#/lib/haptics'
import {useA11y} from '#/state/a11y'
import {useMutationCtx} from '#/data/hooks'
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
import {Shapes_Stroke2_Corner0_Rounded as ShapesIcon} from '#/components/icons/Shapes'
import {CategoryDialog} from '#/components/settings/CategoryDialog'
import {CategoryIcon, useCategoryName} from '#/components/settings/CategoryIcon'
import {EyeIcon, EyeOffIcon} from '#/components/settings/icons'
import {PrefSection, usePrefControl} from '#/components/settings/PrefSection'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'

const ROW_HEIGHT = 64

/**
 * Expense categories: add, rename, recolour, re-icon, reorder (drag, or
 * arrows on web and for screen readers) and hide. Hidden categories stay on
 * past expenses and are only left out of pickers.
 */
export function CategoriesEditor() {
  const t = useTheme()
  const {t: l} = useLingui()
  const haptics = useHaptics()
  const {newId} = useMutationCtx()
  const {screenReaderEnabled} = useA11y()
  const {gtMobile} = useBreakpoints()
  const pref = usePrefControl('categories')
  const dialog = useDialogControl({url: 'category'})
  const [editing, setEditing] = useState<Category | undefined>()

  if (!pref.value) return null
  const categories = [...pref.value].sort((x, y) => x.order - y.order)
  // Keyboard users on wide web and screen readers get arrows; touch drags.
  const showArrows = (IS_WEB && gtMobile) || screenReaderEnabled

  const save = (next: Category[]) =>
    void pref.set(next.map((c, order) => ({...c, order})))

  const move = (index: number, by: -1 | 1) => {
    const next = [...categories]
    const [moved] = next.splice(index, 1)
    next.splice(index + by, 0, moved!)
    haptics.selection()
    save(next)
  }

  const openEditor = (category?: Category) => {
    setEditing(category)
    dialog.open()
  }

  return (
    <PrefSection
      pref={pref}
      icon={ShapesIcon}
      title={l`Categories`}
      description={l`Pick categories when you add an expense. Hidden ones stay on past expenses.`}>
      <View
        style={[
          a.rounded_md,
          a.overflow_hidden,
          a.border,
          t.atoms.border_contrast_low,
        ]}>
        <SortableList
          data={categories}
          keyExtractor={c => c.id}
          itemHeight={ROW_HEIGHT}
          onReorder={save}
          renderItem={(category, dragHandle) => {
            const index = categories.indexOf(category)
            return (
              <CategoryRow
                category={category}
                dragHandle={dragHandle}
                isLast={index === categories.length - 1}
                onEdit={() => openEditor(category)}
                onToggleHidden={() => {
                  haptics.toggle(category.hidden)
                  save(
                    categories.map(c =>
                      c.id === category.id ? {...c, hidden: !c.hidden} : c,
                    ),
                  )
                }}
                arrows={
                  showArrows
                    ? {
                        onUp: index > 0 ? () => move(index, -1) : undefined,
                        onDown:
                          index < categories.length - 1
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
          testID="category-add"
          label={l`Add category`}
          onPress={() => openEditor(undefined)}
          size="small"
          color="secondary">
          <ButtonIcon icon={PlusIcon} />
          <ButtonText>
            <Trans>Add category</Trans>
          </ButtonText>
        </Button>
      </View>

      <CategoryDialog
        control={dialog}
        category={editing}
        onCategorySaved={draft => {
          if (editing) {
            save(
              categories.map(c => (c.id === editing.id ? {...c, ...draft} : c)),
            )
          } else {
            save([
              ...categories,
              {id: newId(), ...draft, order: categories.length, hidden: false},
            ])
          }
        }}
      />
    </PrefSection>
  )
}

function CategoryRow({
  category,
  dragHandle,
  isLast,
  onEdit,
  onToggleHidden,
  arrows,
}: {
  category: Category
  dragHandle: React.ReactNode
  isLast: boolean
  onEdit: () => void
  onToggleHidden: () => void
  arrows?: {onUp?: () => void; onDown?: () => void}
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const name = useCategoryName()(category)
  return (
    <View
      testID={`category-${category.id}`}
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
      <View style={[category.hidden && {opacity: 0.45}]}>
        <CategoryIcon category={category} />
      </View>
      <View style={[a.flex_1, a.gap_2xs]}>
        <Text
          numberOfLines={1}
          style={[
            a.text_md,
            a.font_medium,
            a.leading_snug,
            category.hidden ? t.atoms.text_contrast_low : t.atoms.text,
          ]}>
          {name}
        </Text>
        {category.hidden && (
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
        testID={`category-hide-${category.id}`}
        label={category.hidden ? l`Show ${name}` : l`Hide ${name}`}
        onPress={onToggleHidden}
        size="small"
        color="secondary"
        variant="ghost"
        shape="round">
        <ButtonIcon icon={category.hidden ? EyeOffIcon : EyeIcon} />
      </Button>
      <Button
        testID={`category-edit-${category.id}`}
        label={l`Edit ${name}`}
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
