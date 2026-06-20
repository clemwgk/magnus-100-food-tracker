import { describe, expect, it } from 'vitest'
import { earlierThan, isDateOnly } from '../../src/lib/dateOnly'

describe('date-only values', () => {
  it('accepts real ordinary and leap dates', () => { expect(isDateOnly('2026-06-17')).toBe(true); expect(isDateOnly('2024-02-29')).toBe(true) })
  it('rejects malformed and impossible dates', () => { expect(isDateOnly('2026-02-30')).toBe(false); expect(isDateOnly('17-06-2026')).toBe(false) })
  it('compares calendar strings without timezone conversion', () => { expect(earlierThan('2026-06-17', '2026-06-18')).toBe(true); expect(earlierThan('2026-06-18', '2026-06-18')).toBe(false) })
})
