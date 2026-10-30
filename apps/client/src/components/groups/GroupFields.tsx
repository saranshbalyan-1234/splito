import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {type Group} from '@splito/sync'

import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {DateField} from '#/components/forms/DateField'
import * as SegmentedControl from '#/components/forms/SegmentedControl'
import * as TextField from '#/components/forms/TextField'
import {ChevronRight_Stroke2_Corner0_Rounded as ChevronIcon} from '#/components/icons/Chevron'
import {Group3_Stroke2_Corner0_Rounded as GroupIcon} from '#/components/icons/Group'
import {MapPin_Stroke2_Corner0_Rounded as MapPinIcon} from '#/components/icons/MapPin'
import {currencyName} from '#/components/people/ledger'
import {Text} from '#/components/Typography'

export type GroupFieldValues = Pick<Group, 'name' | 'kind' | 'currency'> & {
  /** `YYYY-MM-DD`, or '' when not set. */
  startDate: string
  endDate: string
  /** A trip's place, '' when not set. Kept (hidden) when the type changes away from Trip. */
  location: string
}

/**
 * A group's name, type, currency, trip dates and trip place: the same fields in New
 * group and Edit group.
 */
export function GroupFields({
  value,
  error,
  onChange,
  onPressCurrency,
  testIDPrefix = 'create-group',
  autoFocus = false,
}: {
  value: GroupFieldValues
  error: 'name' | 'dates' | null
  onChange: (patch: Partial<GroupFieldValues>) => void
  onPressCurrency: () => void
  testIDPrefix?: string
  autoFocus?: boolean
}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const kinds: Array<[Group['kind'], string]> = [
    ['trip', l`Trip`],
    ['home', l`Home`],
    ['couple', l`Couple`],
    ['other', l`Other`],
  ]
  return (
    <>
      <View>
        <TextField.LabelText>
          <Trans>Name</Trans>
        </TextField.LabelText>
        <TextField.Root isInvalid={error === 'name'}>
          <TextField.Icon icon={GroupIcon} />
          <TextField.Input
            testID={`${testIDPrefix}-name`}
            label={l`Group name`}
            value={value.name}
            onChangeText={name => onChange({name})}
            placeholder={l`e.g. Goa trip`}
            autoFocus={autoFocus}
            maxLength={64}
          />
        </TextField.Root>
        {error === 'name' && (
          <Text style={[a.pt_sm, a.text_sm, {color: t.palette.negative_500}]}>
            <Trans>Enter a name.</Trans>
          </Text>
        )}
      </View>

      <View>
        <TextField.LabelText>
          <Trans>Type</Trans>
        </TextField.LabelText>
        <SegmentedControl.Root
          label={l`Group type`}
          type="radio"
          size="small"
          value={value.kind}
          // The control reports its current value once on layout; only real changes count.
          onChange={kind => kind !== value.kind && onChange({kind})}>
          {kinds.map(([kind, label]) => (
            <SegmentedControl.Item
              key={kind}
              value={kind}
              label={label}
              testID={`${testIDPrefix}-kind-${kind}`}>
              <SegmentedControl.ItemText style={[a.text_sm]}>
                {label}
              </SegmentedControl.ItemText>
            </SegmentedControl.Item>
          ))}
        </SegmentedControl.Root>
      </View>

      <View>
        <TextField.LabelText>
          <Trans>Currency</Trans>
        </TextField.LabelText>
        <Button
          testID={`${testIDPrefix}-currency`}
          label={l`Currency: ${currencyName(value.currency, i18n.locale)}`}
          size="large"
          color="secondary"
          style={[a.justify_between]}
          onPress={onPressCurrency}>
          <ButtonText style={[a.flex_1, a.text_left]}>
            {value.currency} · {currencyName(value.currency, i18n.locale)}
          </ButtonText>
          <ButtonIcon icon={ChevronIcon} />
        </Button>
      </View>

      {value.kind === 'trip' && (
        <>
          <View>
            <TextField.LabelText>
              <Trans>Where? (optional)</Trans>
            </TextField.LabelText>
            <TextField.Root>
              <TextField.Icon icon={MapPinIcon} />
              <TextField.Input
                testID={`${testIDPrefix}-location`}
                label={l`Where is the trip?`}
                value={value.location}
                onChangeText={location => onChange({location})}
                placeholder={l`e.g. Goa`}
                maxLength={64}
              />
            </TextField.Root>
          </View>
          <View>
            <TextField.LabelText>
              <Trans>Dates (optional)</Trans>
            </TextField.LabelText>
            <View style={[a.flex_row, a.gap_sm]}>
              <View style={[a.flex_1]}>
                <DateField
                  testID={`${testIDPrefix}-start`}
                  label={l`Start date`}
                  value={value.startDate}
                  onChangeDate={startDate => onChange({startDate})}
                  isInvalid={error === 'dates'}
                />
              </View>
              <View style={[a.flex_1]}>
                <DateField
                  testID={`${testIDPrefix}-end`}
                  label={l`End date`}
                  value={value.endDate}
                  onChangeDate={endDate => onChange({endDate})}
                  isInvalid={error === 'dates'}
                />
              </View>
            </View>
            {error === 'dates' && (
              <Text
                style={[a.pt_sm, a.text_sm, {color: t.palette.negative_500}]}>
                <Trans>
                  Check the dates: the trip can’t end before it starts.
                </Trans>
              </Text>
            )}
          </View>
        </>
      )}
    </>
  )
}
