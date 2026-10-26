import {i18n} from '@lingui/core'

/* Catalogs land with the first translated strings; until then English source strings render as-is. */
i18n.load('en', {})
i18n.activate('en')

export {i18n}
