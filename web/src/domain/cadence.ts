/** How often a grocery item should reappear on the checklist after being checked off. */
export const REPEAT_CADENCES = [
  'One Time',
  'Daily',
  'Weekly',
  'Every 2 Weeks',
  'Monthly',
  'Custom',
] as const

export type RepeatCadence = (typeof REPEAT_CADENCES)[number]

/** Unknown values fall back to One Time, like `RepeatCadence(rawValue:) ?? .oneTime` in Swift. */
export function parseCadence(raw: string): RepeatCadence {
  return (REPEAT_CADENCES as readonly string[]).includes(raw) ? (raw as RepeatCadence) : 'One Time'
}

/** Days until the item should be unchecked again; `null` for One Time (no auto refresh). */
export function cadenceDays(cadence: RepeatCadence, customDays: number): number | null {
  switch (cadence) {
    case 'One Time':
      return null
    case 'Daily':
      return 1
    case 'Weekly':
      return 7
    case 'Every 2 Weeks':
      return 14
    case 'Monthly':
      return 30
    case 'Custom':
      return Math.max(customDays, 1)
  }
}

/** Calendar-day arithmetic in the device's local time zone (DST aware), like `Calendar.current`. */
export function addDays(timestamp: number, days: number): number {
  const date = new Date(timestamp)
  date.setDate(date.getDate() + days)
  return date.getTime()
}

const HOUR_MS = 3_600_000

export function addHours(timestamp: number, hours: number): number {
  return timestamp + hours * HOUR_MS
}
