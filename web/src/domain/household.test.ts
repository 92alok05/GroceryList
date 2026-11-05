import { describe, expect, it } from 'vitest'
import { isValidHouseholdName, isValidPasscode, normalizeHouseholdName } from './household'

describe('passcode rules', () => {
  it.each(['Fresh&Milk42', 'a1!aaaaa', 'Zz9$Zz9$Zz9$'])('accepts %s', (p) => expect(isValidPasscode(p)).toBe(true))
  it.each([
    ['too short', 'Ab1!xyz'],
    ['no number', 'Fresh&Milk!!'],
    ['no special character', 'FreshMilk42'],
    ['no letter', '12345678!!'],
    ['empty', ''],
  ])('rejects a passcode that is %s', (_l, p) => expect(isValidPasscode(p)).toBe(false))
})

describe('household name', () => {
  it('normalizes whitespace and enforces 2-40 characters', () => {
    expect(normalizeHouseholdName('  The   Joshis ')).toBe('The Joshis')
    expect(isValidHouseholdName(' a ')).toBe(false)
    expect(isValidHouseholdName('The Joshis')).toBe(true)
    expect(isValidHouseholdName('x'.repeat(41))).toBe(false)
  })
})
