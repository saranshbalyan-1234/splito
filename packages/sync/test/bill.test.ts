import {describe, expect, test} from 'bun:test'

import {DEFAULT_CHARGE_PRESETS, DEFAULT_TAX_CLASSES, isChargePresets, isMerchantSetups, isTaxClasses, merchantKey, MERCHANT_SETUPS_MAX} from '../src/bill'
import {PREFS} from '../src/preferences'

describe('bill preferences (F-403)', () => {
  test('defaults are valid and the registry holds them in Defaults', () => {
    expect(isTaxClasses(DEFAULT_TAX_CLASSES)).toBe(true)
    expect(isChargePresets(DEFAULT_CHARGE_PRESETS)).toBe(true)
    expect(DEFAULT_TAX_CLASSES.map(c => c.name)).toEqual(['Standard', 'Food', 'Soft drinks', 'Alcohol', 'Other'])
    expect(DEFAULT_CHARGE_PRESETS.map(p => p.name)).toEqual(['Simple', 'Restaurant India', 'Restaurant EU', 'US tip'])
    for (const k of ['taxClasses', 'chargePresets', 'defaultPreset', 'serviceChargeDefault', 'roundOffSpread', 'rememberPerMerchant', 'merchantSetups'] as const) {
      const def = PREFS[`bill.${k}`]
      expect(def.group).toBe('defaults')
      expect(def.scope).toBe('account')
      expect(def.validate(def.default)).toBe(true)
    }
    expect(PREFS['bill.defaultPreset'].default).toBe('simple')
    expect(PREFS['bill.serviceChargeDefault'].default).toBe(0)
    expect(PREFS['bill.roundOffSpread'].default).toBe('shares')
    expect(PREFS['bill.rememberPerMerchant'].default).toBe(true)
  })

  test('tax classes need unique ids and Standard', () => {
    expect(isTaxClasses(DEFAULT_TAX_CLASSES.filter(c => c.id !== 'standard'))).toBe(false)
    expect(isTaxClasses([...DEFAULT_TAX_CLASSES, DEFAULT_TAX_CLASSES[0]])).toBe(false)
    expect(isTaxClasses([{id: 'standard', name: '', order: 0, hidden: false}])).toBe(false)
  })

  test('merchant memory is capped at 200 and keyed by the normalised title', () => {
    expect(merchantKey('  The  Supper   Factory ')).toBe('the supper factory')
    const setup = (n: number) => ({key: `m${n}`, name: `M${n}`, charges: []})
    expect(isMerchantSetups(Array.from({length: MERCHANT_SETUPS_MAX}, (_, n) => setup(n)))).toBe(true)
    expect(isMerchantSetups(Array.from({length: MERCHANT_SETUPS_MAX + 1}, (_, n) => setup(n)))).toBe(false)
    expect(isMerchantSetups([setup(1), setup(1)])).toBe(false)
  })
})
