import {useLingui} from '@lingui/react/macro'
import {CURRENCIES} from '@splito/domain'

import {type DialogControlProps} from '#/components/Dialog'
import {OptionDialog} from '#/components/settings/OptionDialog'
import {currencyName} from '#/locale/currencyName'

/**
 * The one currency picker (composer, Create group, Edit group, Record payment):
 * names in the app language, searchable by code, symbol or English name.
 * Choosing a currency closes the sheet and applies it.
 */
export function CurrencyDialog({
  control,
  value,
  onSelect,
}: {
  control: DialogControlProps
  value: string
  onSelect: (code: string) => void
}) {
  const {t: l, i18n} = useLingui()
  // The chosen currency first, so the sheet opens on it (as the old composer picker did).
  const currencies = Object.values(CURRENCIES).sort((x, y) => Number(y.code === value) - Number(x.code === value))
  const options = currencies.map(c => ({
    value: c.code,
    label: currencyName(c.code, i18n.locale),
    hint: `${c.code} · ${c.symbol}`,
    keywords: `${c.name} ${c.symbol}`,
  }))
  return (
    <OptionDialog
      testID="currency-dialog"
      control={control}
      title={l`Currency`}
      searchLabel={l`Search currencies`}
      options={options}
      value={value}
      onSelect={onSelect}
    />
  )
}
