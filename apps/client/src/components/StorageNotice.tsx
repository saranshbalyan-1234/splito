import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import * as Admonition from '#/components/Admonition'
import {ButtonText} from '#/components/Button'

/**
 * Said when the browser's database cannot be used yet or any more
 * (ARCHITECTURE 9.7: the ledger never fails silently): `blocked` while
 * another Splito tab still holds an older version open, so the upgrade waits
 * (it finishes by itself once they close); `changed` when a newer build in
 * another tab has taken the database over, so this tab has to reload.
 */
export function StorageNotice({
  kind,
  onReload,
}: {
  kind: 'blocked' | 'changed'
  onReload: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  return (
    <View
      testID="storage-notice"
      style={[a.flex_1, a.justify_center, a.p_lg, t.atoms.bg]}>
      <Admonition.Outer type="warning">
        <Admonition.Row>
          <Admonition.Icon />
          <Admonition.Content>
            <Admonition.Text>
              {kind === 'blocked' ? (
                <Trans>
                  Close other Splito tabs to finish updating. Nothing is lost,
                  and this page opens by itself when they are closed.
                </Trans>
              ) : (
                <Trans>
                  Splito was updated in another tab. Reload to keep going.
                  Everything you saved is still here.
                </Trans>
              )}
            </Admonition.Text>
            {kind === 'changed' && (
              <Admonition.Button
                testID="storage-notice-reload"
                label={l`Reload`}
                color="primary"
                onPress={onReload}>
                <ButtonText>
                  <Trans>Reload</Trans>
                </ButtonText>
              </Admonition.Button>
            )}
          </Admonition.Content>
        </Admonition.Row>
      </Admonition.Outer>
    </View>
  )
}
