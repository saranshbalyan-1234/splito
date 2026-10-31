import {readFileSync} from 'node:fs'
import {dirname, join} from 'node:path'

import {expect, test} from 'bun:test'

/*
 * patches/@react-navigation__native-stack@7.21.0.patch: the web SceneView keeps one headerBack object while its title
 * and href hold. Without it every tab switch hands a new HeaderBackContext value to the shown and hidden screens and
 * React walks their whole trees (propagateParentContextChanges, about 30 ms per switch at CPU x6, 2026-10-31). Fails
 * when an upgrade drops the patch: re-apply it or check that upstream now memoises headerBack.
 */
test('the native-stack web SceneView keeps its headerBack object (Splito patch applied)', () => {
  const pkg = require.resolve('@react-navigation/native-stack/package.json')
  const view = readFileSync(join(dirname(pkg), 'lib/module/views/NativeStackView.js'), 'utf8')
  expect(view).toContain('Splito patch: the same object while its title and href hold')
  expect(view).toContain('React.useMemo(() => previousDescriptor ?')
})
