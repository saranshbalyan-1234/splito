import {useState} from 'react'
import {View} from 'react-native'
import {type Category} from '@splito/sync'
import {Trans, useLingui} from '@lingui/react/macro'

import {useHaptics} from '#/lib/haptics'
import {CATEGORY_COLORS} from '#/alf/swatches'
import {atoms as a, useTheme, web} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as TextField from '#/components/forms/TextField'
import {Check_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/Check'
import {
  CATEGORY_ICON_IDS,
  CategoryGlyph,
  CategoryIcon,
  useCategoryName,
} from '#/components/settings/CategoryIcon'
import {Text} from '#/components/Typography'

const NAME_MAX = 32

/**
 * Add or edit an expense category: name, colour and icon, previewed live.
 * Categories are never deleted, because past expenses point at them; they
 * can be hidden from the list instead.
 */
export function CategoryDialog({
  control,
  category,
  onCategorySaved,
}: {
  control: Dialog.DialogControlProps
  /** Undefined adds a new category. */
  category?: Category
  onCategorySaved: (draft: Pick<Category, 'name' | 'color' | 'icon'>) => void
}) {
  return (
    <Dialog.Outer control={control}>
      <Dialog.Handle />
      {/* Keyed so the form starts from the category being edited. The dialog itself must not remount, or it would lose its open state. */}
      <Inner
        key={category?.id ?? 'new'}
        category={category}
        onCategorySaved={onCategorySaved}
      />
    </Dialog.Outer>
  )
}

function Inner({
  category,
  onCategorySaved,
}: {
  category?: Category
  onCategorySaved: (draft: Pick<Category, 'name' | 'color' | 'icon'>) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const control = Dialog.useDialogContext()
  const haptics = useHaptics()
  // Built-in categories open with their name in the UI language.
  const categoryName = useCategoryName()
  const shownName = category ? categoryName(category) : ''
  const [name, setName] = useState(shownName)
  const [color, setColor] = useState<string>(
    category?.color ?? CATEGORY_COLORS[0],
  )
  const [icon, setIcon] = useState(category?.icon ?? 'tag')
  const trimmed = name.trim()
  const isValid = trimmed.length > 0 && trimmed.length <= NAME_MAX

  const save = () => {
    if (!isValid) return
    haptics.success()
    // An untouched built-in name keeps following the UI language.
    const savedName =
      category && trimmed === shownName ? category.name : trimmed
    control.close(() => onCategorySaved({name: savedName, color, icon}))
  }

  return (
    <Dialog.ScrollableInner
      label={category ? l`Edit category` : l`New category`}
      style={[web({maxWidth: 440})]}>
      <View style={[a.gap_xl]}>
        <View style={[a.flex_row, a.align_center, a.gap_md]}>
          <CategoryIcon category={{color, icon}} size={48} />
          <Text style={[a.flex_1, a.text_2xl, a.font_bold]} numberOfLines={1}>
            {category ? (
              <Trans>Edit category</Trans>
            ) : (
              <Trans>New category</Trans>
            )}
          </Text>
        </View>

        <View>
          <TextField.LabelText>
            <Trans>Name</Trans>
          </TextField.LabelText>
          <TextField.Root isInvalid={name.length > 0 && !isValid}>
            <TextField.Input
              testID="category-name"
              label={l`Name`}
              placeholder={l`For example, Rent`}
              value={name}
              onChangeText={setName}
              maxLength={NAME_MAX}
              autoFocus={!category}
              returnKeyType="done"
              onSubmitEditing={save}
            />
          </TextField.Root>
        </View>

        <View>
          <TextField.LabelText>
            <Trans>Color</Trans>
          </TextField.LabelText>
          <View style={[a.flex_row, a.flex_wrap, a.gap_sm]} role="radiogroup">
            {CATEGORY_COLORS.map(c => {
              const isSelected = c === color
              return (
                <Button
                  key={c}
                  testID={`category-color-${c.slice(1)}`}
                  label={l`Color ${c}`}
                  role="radio"
                  accessibilityState={{checked: isSelected}}
                  aria-checked={isSelected}
                  onPress={() => {
                    haptics.selection()
                    setColor(c)
                  }}
                  style={[
                    a.rounded_full,
                    a.align_center,
                    a.justify_center,
                    {width: 36, height: 36, backgroundColor: c},
                    isSelected && {
                      borderWidth: 3,
                      borderColor: t.atoms.bg.backgroundColor,
                      outlineColor: c,
                      outlineStyle: 'solid',
                      outlineWidth: 2,
                    },
                  ]}>
                  <>
                    {isSelected && (
                      <CheckIcon size="xs" fill={t.palette.white} />
                    )}
                  </>
                </Button>
              )
            })}
          </View>
        </View>

        <View>
          <TextField.LabelText>
            <Trans>Icon</Trans>
          </TextField.LabelText>
          <View style={[a.flex_row, a.flex_wrap, a.gap_xs]} role="radiogroup">
            {CATEGORY_ICON_IDS.map(id => {
              const isSelected = id === icon
              return (
                <Button
                  key={id}
                  testID={`category-icon-${id}`}
                  label={id}
                  role="radio"
                  accessibilityState={{checked: isSelected}}
                  aria-checked={isSelected}
                  onPress={() => {
                    haptics.selection()
                    setIcon(id)
                  }}
                  style={[
                    a.rounded_sm,
                    a.align_center,
                    a.justify_center,
                    {width: 44, height: 44},
                    isSelected
                      ? {backgroundColor: t.palette.primary_50}
                      : t.atoms.bg_contrast_25,
                  ]}
                  hoverStyle={t.atoms.bg_contrast_50}>
                  <CategoryGlyph
                    icon={id}
                    size={20}
                    color={
                      isSelected
                        ? t.palette.primary_500
                        : t.atoms.text_contrast_medium.color
                    }
                  />
                </Button>
              )
            })}
          </View>
        </View>

        <View style={[a.gap_sm, web([a.flex_row_reverse])]}>
          <Button
            testID="category-save"
            label={l`Save category`}
            onPress={save}
            disabled={!isValid}
            size="large"
            color="primary">
            <ButtonText>
              <Trans>Save</Trans>
            </ButtonText>
          </Button>
          <Button
            label={l`Cancel`}
            onPress={() => control.close()}
            size="large"
            color="secondary">
            <ButtonText>
              <Trans>Cancel</Trans>
            </ButtonText>
          </Button>
        </View>
      </View>
      <Dialog.Close />
    </Dialog.ScrollableInner>
  )
}
