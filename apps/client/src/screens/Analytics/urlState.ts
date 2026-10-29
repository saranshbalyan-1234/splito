import {type DateRange} from '@splito/domain'

import {EVERYTHING, isEverything, type Scope} from './scope'

/**
 * Analytics' list state in the address (F-241): `?period=month&offset=-1&currency=EUR&scope=0:g1,g2`, or
 * `?period=custom&from=2026-01-01&to=2026-02-01`. A param that is present wins over the saved preference
 * (F-1413); absent ones fall back to it. Pure, so a test pins the encoding.
 */
export type PeriodParam = 'week' | 'month' | 'year' | 'all' | 'custom'
const PERIODS: readonly string[] = ['week', 'month', 'year', 'all', 'custom']
const DAY = /^\d{4}-\d{2}-\d{2}$/

export type AnalyticsUrlState = {
  period?: PeriodParam
  offset: number
  custom?: DateRange
  currency?: string
  scope?: Scope
}

type Params = Record<string, string | undefined> | undefined

/** Periods back or forward a link may ask for: a century of months, 23 years of weeks. Past it the date maths leaves real calendars. */
export const MAX_OFFSET = 1200

/** Only a short signed integer counts; anything else (`1e9`, `0x10`, ` 5`, `9999999`) is no offset. */
export function readOffset(value: string | undefined): number {
  if (value === undefined || !/^-?\d{1,4}$/.test(value)) return 0
  return Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, Number(value)))
}

export function readAnalyticsParams(params: Params): AnalyticsUrlState {
  const from = params?.from
  const to = params?.to
  return {
    period: params?.period && PERIODS.includes(params.period) ? (params.period as PeriodParam) : undefined,
    offset: readOffset(params?.offset),
    custom: from && to && DAY.test(from) && DAY.test(to) && from <= to ? {from, to} : undefined,
    currency: params?.currency && /^[A-Z]{3}$/.test(params.currency) ? params.currency : undefined,
    scope: params?.scope ? scopeFromParam(params.scope) : undefined,
  }
}

export function scopeToParam(scope: Scope): string | undefined {
  if (isEverything(scope)) return undefined
  return `${scope.nonGroup ? 1 : 0}:${scope.groups === 'all' ? 'all' : scope.groups.join(',')}`
}

export function scopeFromParam(value: string): Scope | undefined {
  const m = /^([01]):(all|[\w,-]*)$/.exec(value)
  if (!m) return undefined
  const groups = m[2] === 'all' ? 'all' : m[2]!.split(',').filter(Boolean)
  const nonGroup = m[1] === '1'
  return !nonGroup && groups !== 'all' && groups.length === 0 ? EVERYTHING : {nonGroup, groups}
}
