import {View} from 'react-native'

import {useLingui} from '@lingui/react/macro'

import {atoms as a} from '#/alf'
import * as Composer from '#/components/Composer'
import * as FormSheet from '#/components/FormSheet'
import * as Skeleton from '#/components/Skeleton'
import {Shimmer} from '#/motion/Shimmer'

/** The composer while the local store loads: same chrome, skeleton body (Bluesky's placeholders). */
export function ComposerSkeleton({
  testID,
  onClose,
}: {
  testID: string
  onClose: () => void
}) {
  const {t: l} = useLingui()
  return (
    <Composer.Outer testID={testID} onDismiss={onClose}>
      <FormSheet.Header
        title={l({message: 'Add expense', context: 'action'})}
        onClose={onClose}
      />
      <Shimmer
        testID="composer-loading"
        style={[a.px_lg, a.pt_sm, a.pb_2xl, a.gap_lg]}>
        <Skeleton.Row style={[a.gap_md, a.align_center]}>
          <Skeleton.Block style={[a.rounded_sm, {width: 42, height: 42}]} />
          <Skeleton.Col style={[a.flex_1, a.gap_xs]}>
            <Skeleton.Text style={[a.text_xl, {width: '60%'}]} />
            <Skeleton.Text style={[a.text_sm, {width: '25%'}]} />
          </Skeleton.Col>
        </Skeleton.Row>
        <Skeleton.Row style={[a.gap_md, a.align_center]}>
          <Skeleton.Pill size={32} />
          <Skeleton.Text style={[a.text_4xl, {width: 140}]} />
        </Skeleton.Row>
        {[0, 1, 2, 3].map(i => (
          <View
            key={i}
            style={[a.flex_row, a.align_center, a.justify_between, a.py_xs]}>
            <Skeleton.Text style={[a.text_md, {width: 90}]} />
            <Skeleton.Text style={[a.text_md, {width: 120}]} />
          </View>
        ))}
      </Shimmer>
    </Composer.Outer>
  )
}
