import {type StyleProp, type TextStyle} from 'react-native'
import {type CurrencyCode} from '@splito/domain'

export type AnimatedAmountProps = {
  /** Exact amount in minor units. */
  minor: bigint
  currency: CurrencyCode
  /** BCP 47 locale passed to formatAmount, e.g. 'en-IN'. */
  locale: string
  style?: StyleProp<TextStyle>
  testID?: string
}
