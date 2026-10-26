// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/components/StarterPack/QrCode.tsx (QrCodeInner)
import {View} from 'react-native'
// @ts-expect-error the package ships no types for its root entry (as upstream)
import QRCode from 'react-native-qrcode-styled'

import {atoms as a, useTheme} from '#/alf'
import {LogoMark} from '#/components/brand/Logo'

const SIZE = 224
const LOGO_TILE = 52

/**
 * The invite link as a QR code in Bluesky's starter-pack style (rounded
 * pieces, accent eyes), with the accent logo in the centre. The logo sits on
 * a tile over the code rather than inside it, so it is the same component as
 * everywhere else (one logo source, 26.11); high error correction keeps the
 * code readable under it.
 */
export function InviteQrCode({link}: {link: string}) {
  const t = useTheme()
  const eye = (radius: number[]) => ({
    borderRadius: radius,
    color: t.palette.primary_500,
  })
  return (
    <View
      testID="invite-qr"
      accessibilityRole="image"
      style={[a.relative, a.rounded_md, a.overflow_hidden, {width: SIZE, height: SIZE}]}>
      <QRCode
        data={link}
        errorCorrectionLevel="H"
        style={{width: SIZE, height: SIZE, backgroundColor: t.palette.white}}
        pieceSize={6}
        padding={16}
        pieceBorderRadius={3}
        color={t.palette.black}
        outerEyesOptions={{
          topLeft: eye([12, 12, 0, 12]),
          topRight: eye([12, 12, 12, 0]),
          bottomLeft: eye([12, 0, 12, 12]),
        }}
        innerEyesOptions={{borderRadius: 3, color: t.palette.primary_500}}
      />
      <View
        pointerEvents="none"
        style={[
          a.absolute,
          a.align_center,
          a.justify_center,
          a.rounded_sm,
          {
            width: LOGO_TILE,
            height: LOGO_TILE,
            left: (SIZE - LOGO_TILE) / 2,
            top: (SIZE - LOGO_TILE) / 2,
            backgroundColor: t.palette.white,
          },
        ]}>
        <LogoMark size={36} />
      </View>
    </View>
  )
}
