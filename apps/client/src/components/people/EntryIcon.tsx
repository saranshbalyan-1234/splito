import {View} from 'react-native'

import {usePref} from '#/data/hooks'
import {atoms as a, useTheme, utils} from '#/alf'
import {
  Banknote_Stroke2_Corner0_Rounded as BanknoteIcon,
  Handshake_Stroke2_Corner0_Rounded as HandshakeIcon,
} from '#/components/icons/Money'
import {CategoryGlyph} from '#/components/settings/CategoryIcon'

const SIZE = 42

/**
 * The leading tile of a history row, in the place Bluesky puts an avatar:
 * the expense's category glyph on a soft tint of the category's colour (as
 * the expense page shows it), a banknote for a recorded payment, or a
 * handshake for a write-off ("Call it even").
 */
export function EntryIcon({
  category,
  isPayment = false,
  isWriteOff = false,
}: {
  category?: string
  isPayment?: boolean
  isWriteOff?: boolean
}) {
  const t = useTheme()
  const [categories] = usePref('categories')
  const found = categories?.find(c => c.id === category)
  const color = found?.color ?? t.atoms.text_contrast_medium.color

  return (
    <View
      style={[
        a.align_center,
        a.justify_center,
        isPayment || isWriteOff ? a.rounded_full : {borderRadius: 10},
        {
          width: SIZE,
          height: SIZE,
          backgroundColor: isWriteOff
            ? t.palette.positive_50
            : isPayment
              ? t.palette.primary_50
              : utils.alpha(color, t.scheme === 'light' ? 0.14 : 0.22),
        },
      ]}>
      {isWriteOff ? (
        <HandshakeIcon size="md" fill={t.palette.positive_600} />
      ) : isPayment ? (
        <BanknoteIcon size="md" fill={t.palette.primary_500} />
      ) : (
        <CategoryGlyph icon={found?.icon ?? 'receipt'} color={color} />
      )}
    </View>
  )
}
