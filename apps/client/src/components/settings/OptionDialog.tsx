// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/components/dialogs/LanguageSelectDialog.tsx
import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, tokens, useTheme, web} from '#/alf'
import {Button, ButtonIcon} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {SearchInput} from '#/components/forms/SearchInput'
import * as Toggle from '#/components/forms/Toggle'
import {TimesLarge_Stroke2_Corner0_Rounded as XIcon} from '#/components/icons/Times'
import {Text} from '#/components/Typography'
import {IS_NATIVE, IS_WEB} from '#/env'

export type DialogOption = {
  value: string
  label: string
  /** Secondary text on the right, e.g. a currency code or UTC offset. */
  hint?: string | (() => string)
  /** Extra words the search matches (codes, English names). */
  keywords?: string
}

/**
 * A searchable single-choice list (currencies, timezones). Bluesky's
 * language picker with radios instead of checkboxes: choosing an option
 * closes the dialog and applies it.
 */
export function OptionDialog({
  control,
  title,
  searchLabel,
  options,
  value,
  onSelect,
  testID,
}: {
  control: Dialog.DialogControlProps
  title: string
  searchLabel: string
  options: DialogOption[]
  value: string
  onSelect: (value: string) => void
  testID?: string
}) {
  return (
    <Dialog.Outer control={control} nativeOptions={{fullHeight: true}}>
      <Dialog.Handle />
      <DialogInner
        title={title}
        searchLabel={searchLabel}
        options={options}
        value={value}
        onSelect={onSelect}
        testID={testID}
      />
    </Dialog.Outer>
  )
}

function DialogInner({
  title,
  searchLabel,
  options,
  value,
  onSelect,
  testID,
}: {
  title: string
  searchLabel: string
  options: DialogOption[]
  value: string
  onSelect: (value: string) => void
  testID?: string
}) {
  const control = Dialog.useDialogContext()
  const t = useTheme()
  const {t: l} = useLingui()
  const [search, setSearch] = useState('')
  const [headerHeight, setHeaderHeight] = useState(0)

  const query = search.trim().toLowerCase()
  const shown = query
    ? options.filter(o =>
        `${o.label} ${o.value} ${o.keywords ?? ''}`
          .toLowerCase()
          .includes(query),
      )
    : options

  const listHeader = (
    <View
      style={[a.pb_xs, t.atoms.bg, IS_NATIVE && a.pt_2xl]}
      onLayout={evt => setHeaderHeight(evt.nativeEvent.layout.height)}>
      <View style={[a.flex_row, a.w_full, a.justify_between, a.align_start]}>
        <Text
          nativeID="dialog-title"
          style={[
            t.atoms.text,
            a.text_left,
            a.font_semi_bold,
            a.text_xl,
            a.mb_md,
          ]}>
          {title}
        </Text>
        {IS_WEB && (
          <Button
            variant="ghost"
            size="small"
            color="secondary"
            shape="round"
            label={l`Close dialog`}
            onPress={() => control.close()}>
            <ButtonIcon icon={XIcon} />
          </Button>
        )}
      </View>
      <SearchInput
        testID={testID ? `${testID}-search` : undefined}
        value={search}
        onChangeText={setSearch}
        placeholder={searchLabel}
        label={searchLabel}
        maxLength={50}
        onClearText={() => setSearch('')}
      />
    </View>
  )

  return (
    <Toggle.Group
      values={[value]}
      onChange={([next]) => {
        if (next) control.close(() => onSelect(next))
      }}
      type="radio"
      label={title}
      style={web([a.contents])}>
      <Dialog.InnerFlatList
        testID={testID}
        data={shown}
        keyExtractor={(o: DialogOption) => o.value}
        ListHeaderComponent={listHeader}
        stickyHeaderIndices={[0]}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={20}
        contentContainerStyle={[
          a.gap_0,
          IS_NATIVE && {paddingBottom: tokens.space._5xl},
        ]}
        style={[IS_NATIVE && a.px_lg, IS_WEB && {paddingBottom: 40}]}
        scrollIndicatorInsets={{top: headerHeight}}
        ListEmptyComponent={
          <Text
            style={[
              a.py_2xl,
              a.text_center,
              a.text_md,
              t.atoms.text_contrast_medium,
            ]}>
            <Trans>Nothing matches “{search}”</Trans>
          </Text>
        }
        renderItem={({item, index}: {item: DialogOption; index: number}) => {
          const hint = typeof item.hint === 'function' ? item.hint() : item.hint
          return (
            <Toggle.Item
              testID={testID ? `${testID}-${item.value}` : undefined}
              name={item.value}
              label={item.label}
              style={[
                t.atoms.border_contrast_low,
                index < shown.length - 1 && a.border_b,
                a.rounded_0,
                a.px_0,
                a.py_md,
              ]}>
              <Toggle.Radio />
              <Toggle.LabelText style={[a.flex_1]}>
                {item.label}
              </Toggle.LabelText>
              {hint ? (
                <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                  {hint}
                </Text>
              ) : null}
            </Toggle.Item>
          )
        }}
      />
    </Toggle.Group>
  )
}
