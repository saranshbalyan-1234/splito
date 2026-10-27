import {useLingui} from '@lingui/react/macro'
import {
  type ChargePreset,
  type ChargeTemplate,
  DEFAULT_CHARGE_PRESETS,
  DEFAULT_TAX_CLASSES,
  PREFS,
  type TaxClass,
} from '@splito/sync'
import {type ChargeKind} from '@splito/domain'

import {usePrefControl} from '#/components/settings/PrefSection'

/** A tax class by the name a person sees: built-in names follow the UI language until renamed. */
export function useTaxClassName() {
  const {t: l} = useLingui()
  const builtIn: Record<string, string> = {
    standard: l`Standard`,
    food: l`Food`,
    soft: l`Soft drinks`,
    alcohol: l`Alcohol`,
    other: l`Other`,
  }
  return (c: Pick<TaxClass, 'id' | 'name'>) =>
    DEFAULT_TAX_CLASSES.find(d => d.id === c.id)?.name === c.name
      ? (builtIn[c.id] ?? c.name)
      : c.name
}

/** Every tax class in the person's order (hidden ones included, for showing what a bill used). */
export function useTaxClasses(): {
  all: TaxClass[]
  visible: TaxClass[]
  nameOf: (id: string | undefined) => string
} {
  const classes = usePrefControl('bill.taxClasses').value ?? PREFS['bill.taxClasses'].default
  const displayName = useTaxClassName()
  const all = [...classes].sort((x, y) => x.order - y.order)
  return {
    all,
    visible: all.filter(c => !c.hidden),
    nameOf: id => {
      const c = all.find(x => x.id === (id ?? 'standard'))
      return c ? displayName(c) : (id ?? 'standard')
    },
  }
}

/** Charge kinds as people say them. */
export function useKindName() {
  const {t: l} = useLingui()
  const names: Record<ChargeKind, string> = {
    service: l`Service`,
    tax: l`Tax`,
    packing: l`Packing`,
    delivery: l`Delivery`,
    other: l`Other`,
    discount: l`Discount`,
  }
  return (kind: ChargeKind) => names[kind]
}

/** The presets in the person's list, names in the UI language while they are the shipped ones. */
export function useChargePresets(): ChargePreset[] {
  const {t: l} = useLingui()
  const presets = usePrefControl('bill.chargePresets').value ?? PREFS['bill.chargePresets'].default
  const names: Record<string, string> = {
    simple: l`Simple`,
    'restaurant-india': l`Restaurant India`,
    'restaurant-eu': l`Restaurant EU`,
    'us-tip': l`US tip`,
  }
  const charges: Record<string, string> = {
    'Service charge': l`Service charge`,
    GST: l`GST`,
    'Liquor VAT': l`Liquor VAT`,
    'VAT 10%': l`VAT 10%`,
    'VAT 20%': l`VAT 20%`,
    Tip: l`Tip`,
    'Sales tax': l`Sales tax`,
  }
  return presets.map(p => {
    const stock = DEFAULT_CHARGE_PRESETS.find(d => d.id === p.id)
    if (!stock) return p
    return {
      ...p,
      name: stock.name === p.name ? (names[p.id] ?? p.name) : p.name,
      charges: p.charges.map(
        (c, n): ChargeTemplate => ({
          ...c,
          name: stock.charges[n]?.name === c.name ? (charges[c.name] ?? c.name) : c.name,
        }),
      ),
    }
  })
}
