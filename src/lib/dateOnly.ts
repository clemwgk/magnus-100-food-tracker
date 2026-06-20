const DATE = /^(\d{4})-(\d{2})-(\d{2})$/

export function isDateOnly(value: string): boolean {
  const match = DATE.exec(value)
  if (!match) return false
  const [year, month, day] = match.slice(1).map(Number)
  const test = new Date(Date.UTC(year, month - 1, day))
  return test.getUTCFullYear() === year && test.getUTCMonth() === month - 1 && test.getUTCDate() === day
}

export function earlierThan(left: string, right: string): boolean {
  if (!isDateOnly(left) || !isDateOnly(right)) throw new Error('Expected valid date-only values')
  return left < right
}

export function localToday(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

export function yesterday(): string {
  const now = new Date()
  now.setDate(now.getDate() - 1)
  const offset = now.getTimezoneOffset()
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10)
}
