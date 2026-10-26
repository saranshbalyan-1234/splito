import 'fake-indexeddb/auto'
import {IDBFactory} from 'fake-indexeddb'

import {openIdbStore} from '../src/idbStore'
import {runStoreContract} from './storeContract'

let factory = new IDBFactory()
runStoreContract(
  'IdbStore',
  () => {
    factory = new IDBFactory()
    return openIdbStore('splito', factory)
  },
  () => openIdbStore('splito', factory),
)
