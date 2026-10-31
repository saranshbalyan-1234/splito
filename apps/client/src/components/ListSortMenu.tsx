import {type ListSort, LIST_SORTS} from '@splito/sync'
import {useLingui} from '@lingui/react/macro'

import {HITSLOP_10} from '#/lib/constants'
import {Button, ButtonIcon} from '#/components/Button'
import {ArrowUpDown_Stroke2_Corner0_Rounded as SortIcon} from '#/components/icons/ArrowUpDown'
import * as Menu from '#/components/Menu'

/** The default order of People and Groups (owner 199). */
export const DEFAULT_LIST_SORT: ListSort = 'lastActive'

/**
 * The Sort button of the People and Groups headers, beside Filters (owner 199): a Bluesky `Menu` of four radio
 * rows. A non-default order tints the button, as an active filter does.
 */
export function ListSortMenu({value, onChange}: {value: ListSort; onChange: (sort: ListSort) => void}) {
  const {t: l} = useLingui()
  const labels: Record<ListSort, string> = {
    lastActive: l`Last active`,
    name: l`Name`,
    amount: l`Amount, largest first`,
    newest: l`Newest`,
  }
  const isActive = value !== DEFAULT_LIST_SORT
  return (
    <Menu.Root>
      <Menu.Trigger label={isActive ? l`Sort, by ${labels[value]}` : l`Sort`}>
        {({props}) => (
          <Button
            {...props}
            testID="list-sort"
            label={props.accessibilityLabel}
            size="small"
            variant="ghost"
            color={isActive ? 'primary' : 'secondary'}
            shape="round"
            hitSlop={HITSLOP_10}>
            <ButtonIcon icon={SortIcon} size="md" />
          </Button>
        )}
      </Menu.Trigger>
      <Menu.Outer>
        <Menu.Group>
          {LIST_SORTS.map(sort => (
            <Menu.Item
              key={sort}
              testID={`list-sort-${sort}`}
              label={labels[sort]}
              role="radio"
              aria-checked={sort === value}
              onPress={() => onChange(sort)}>
              <Menu.ItemText>{labels[sort]}</Menu.ItemText>
              <Menu.ItemRadio selected={sort === value} />
            </Menu.Item>
          ))}
        </Menu.Group>
      </Menu.Outer>
    </Menu.Root>
  )
}
