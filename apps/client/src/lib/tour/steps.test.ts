import {expect, test} from 'bun:test'

import {planTour, TARGET_SHAPE, type TourTargetId} from './steps'

const has =
  (...ids: TourTargetId[]) =>
  (id: TourTargetId) =>
    ids.includes(id)

test('a phone with friends: the FAB, the first row, its balance', () => {
  expect(planTour(has('fab', 'add-friend', 'friend-row', 'friend-balance', 'tab-groups'))).toEqual([
    {id: 'add-expense', target: 'fab', variant: 'normal'},
    {id: 'balances', target: 'friend-row', variant: 'normal'},
    {id: 'settle-up', target: 'friend-balance', variant: 'normal'},
  ])
})

test('desktop points at the sidebar pill instead of the FAB', () => {
  const plan = planTour(has('sidebar-add', 'add-friend', 'friend-row', 'tab-groups'))
  expect(plan.map(s => s.target)).toEqual(['sidebar-add', 'friend-row', 'tab-groups'])
})

test('a friend who is settled up has no balance: Settle up points at the Groups tab', () => {
  const plan = planTour(has('fab', 'add-friend', 'friend-row', 'tab-groups'))
  expect(plan[2]).toEqual({id: 'settle-up', target: 'tab-groups', variant: 'normal'})
})

test('a new account has no friends: the first two steps stand on Add friend and say so', () => {
  expect(planTour(has('add-friend', 'tab-groups'))).toEqual([
    {id: 'add-expense', target: 'add-friend', variant: 'empty'},
    {id: 'balances', target: 'add-friend', variant: 'empty'},
    {id: 'settle-up', target: 'tab-groups', variant: 'normal'},
  ])
})

test('a step with nothing to point at is left out, never invented', () => {
  expect(planTour(has('fab', 'friend-row'))).toEqual([
    {id: 'add-expense', target: 'fab', variant: 'normal'},
    {id: 'balances', target: 'friend-row', variant: 'normal'},
  ])
  expect(planTour(has())).toEqual([])
})

test('every target has a shape', () => {
  expect(Object.keys(TARGET_SHAPE).sort()).toEqual(['add-friend', 'fab', 'friend-balance', 'friend-row', 'sidebar-add', 'tab-groups'])
})
