import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {openSqlStore} from '../src/sqlStore'
import {bunExecutor} from './bunExecutor'
import {runStoreContract} from './storeContract'

let path = ''
runStoreContract(
  'SqlStore',
  () => {
    path = join(mkdtempSync(join(tmpdir(), 'splito-')), 'db.sqlite')
    return openSqlStore(bunExecutor(path))
  },
  () => openSqlStore(bunExecutor(path)),
)
