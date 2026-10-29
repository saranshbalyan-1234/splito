import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'
import {type CommentTarget} from '@splito/sync'
import {plural} from '@lingui/core/macro'

import {useCommentCount} from '#/state/comments'
import {atoms as a, useTheme} from '#/alf'
import {Bubble_Stroke2_Corner2_Rounded as BubbleIcon} from '#/components/icons/Message'
import {Text} from '#/components/Typography'

/** How many comments an expense or payment has, as a small speech-bubble count; nothing when there are none. */
export function CommentCount({
  targetType,
  targetId,
}: {
  targetType: CommentTarget
  targetId: string
}) {
  const t = useTheme()
  const {i18n} = useLingui()
  const count = useCommentCount(targetType, targetId)
  if (!count) return null
  return (
    <View
      testID={`comment-count-${targetId}`}
      accessible
      accessibilityLabel={i18n._(
        plural(count, {one: '# comment', other: '# comments'}),
      )}
      style={[a.flex_row, a.align_center, a.gap_2xs, a.flex_shrink_0]}>
      <BubbleIcon size="xs" fill={t.atoms.text_contrast_medium.color} />
      <Text
        style={[
          a.text_sm,
          a.leading_snug,
          t.atoms.text_contrast_medium,
          {fontVariant: ['tabular-nums']},
        ]}>
        {count}
      </Text>
    </View>
  )
}
