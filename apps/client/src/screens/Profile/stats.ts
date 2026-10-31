import {type Entity, type Group, isGroupInactive, isRemovedFriend, type Person} from '@splito/sync'

/** Friends I have now: everyone but me and removed friends. */
export function countFriends(people: readonly Entity<Person>[]): number {
  return people.filter(p => !p.data.isMe && !isRemovedFriend(p.data)).length
}

/** Groups still running (inactive ones have left the lists). */
export function countGroups(groups: readonly Entity<Group>[]): number {
  return groups.filter(g => !isGroupInactive(g.data)).length
}

/** The calendar year of `today` (`YYYY-MM-DD`), first to last day: "You paid this year". */
export function yearRange(today: string): {from: string; to: string} {
  const year = today.slice(0, 4)
  return {from: `${year}-01-01`, to: `${year}-12-31`}
}
