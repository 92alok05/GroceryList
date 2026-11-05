/** Mirrors the server rules in AppsScript/Code.gs; the server is the authority. */
export const PASSCODE_MIN_LENGTH = 8

export interface PasscodeRule {
  label: string
  met: boolean
}

export function passcodeRules(passcode: string): PasscodeRule[] {
  return [
    { label: `At least ${PASSCODE_MIN_LENGTH} characters`, met: passcode.length >= PASSCODE_MIN_LENGTH },
    { label: 'A letter', met: /[A-Za-z]/.test(passcode) },
    { label: 'A number', met: /[0-9]/.test(passcode) },
    { label: 'A special character', met: /[^A-Za-z0-9]/.test(passcode) },
  ]
}

export function isValidPasscode(passcode: string): boolean {
  return passcode.length <= 128 && passcodeRules(passcode).every((r) => r.met)
}

export function normalizeHouseholdName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

export function isValidHouseholdName(name: string): boolean {
  const n = normalizeHouseholdName(name)
  return n.length >= 2 && n.length <= 40
}
