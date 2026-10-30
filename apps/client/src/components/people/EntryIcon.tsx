import {View} from 'react-native'

import {atoms as a, useTheme} from '#/alf'
import {
  Banknote_Stroke2_Corner0_Rounded as BanknoteIcon,
  Handshake_Stroke2_Corner0_Rounded as HandshakeIcon,
} from '#/components/icons/Money'
import {CategoryTile, useCategoryLookup} from '#/components/split/shared'

const SIZE = 42

/**
 * The leading tile of a history row, in the place Bluesky puts an avatar:
 * the expense's category tile (the same one the expense page shows), a
 * banknote for a recorded payment, or a handshake for a write-off ("Call it
 * even"). A category that is gone shows as Other; no category at all, a
 * neutral receipt.
 */
export function EntryIcon({
  category,
  isPayment = false,
  isWriteOff = false,
  size = SIZE,
}: {
  category?: string
  isPayment?: boolean
  isWriteOff?: boolean
  size?: number
}) {
  const t = useTheme()
  const lookup = useCategoryLookup()
  if (!isPayment && !isWriteOff) {
    return (
      <CategoryTile
        category={category ? lookup(category) : {icon: 'receipt', color: t.atoms.text_contrast_medium.color}}
        size={size}
      />
    )
  }
  return (
    <View
      style={[
        a.align_center,
        a.justify_center,
        a.rounded_full,
        {
          width: size,
          height: size,
          backgroundColor: isWriteOff ? t.palette.positive_50 : t.palette.primary_50,
        },
      ]}>
      {isWriteOff ? (
        <HandshakeIcon size="md" fill={t.palette.positive_600} />
      ) : (
        <BanknoteIcon size="md" fill={t.palette.primary_500} />
      )}
    </View>
  )
}
