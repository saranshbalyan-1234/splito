import {describe, expect, test} from 'bun:test'

import {firstSignupIssue} from './validate'

const ok = {name: 'Riya', identifier: 'riya@example.com', password: 'longenough'}

describe('firstSignupIssue', () => {
  test('a complete form has no issue', () => {
    expect(firstSignupIssue(ok, 'IN')).toBeNull()
    expect(
      firstSignupIssue({...ok, identifier: '+91 98765 43210'}, 'IN'),
    ).toBeNull()
    expect(
      firstSignupIssue({...ok, identifier: '98765 43210'}, 'IN'),
    ).toBeNull()
  })

  test('fields are judged top to bottom', () => {
    expect(
      firstSignupIssue({name: ' ', identifier: '', password: ''}, 'IN'),
    ).toBe('name-missing')
    expect(firstSignupIssue({...ok, identifier: ''}, 'IN')).toBe(
      'identifier-missing',
    )
    expect(firstSignupIssue({...ok, identifier: 'riya@', password: ''}, 'IN')).toBe(
      'identifier-invalid',
    )
    expect(firstSignupIssue({...ok, password: ''}, 'IN')).toBe('password-missing')
    expect(firstSignupIssue({...ok, password: '1234567'}, 'IN')).toBe(
      'password-short',
    )
    expect(firstSignupIssue({...ok, password: '12345678'}, 'IN')).toBeNull()
  })

  test('a number that is not a real phone number is invalid', () => {
    expect(firstSignupIssue({...ok, identifier: '123'}, 'IN')).toBe(
      'identifier-invalid',
    )
  })
})
