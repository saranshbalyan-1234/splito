import {i18n} from '@lingui/core'
import {compileMessage} from '@lingui/message-utils/compileMessage'

/*
 * Catalogs land with the first translated strings; until then English source
 * strings render as-is. Without compiled catalogs, Lingui needs the runtime
 * compiler to interpolate placeholders (`owes you {amount}`).
 */
i18n.setMessagesCompiler(compileMessage)
i18n.load('en', {})
i18n.activate('en')

export {i18n}
