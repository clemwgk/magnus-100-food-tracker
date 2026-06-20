import { describe, expect, it } from 'vitest'
import { saveWithStore, snapshotFrom, type IngredientStore, type Lock } from '../../src/lib/saveService'
import { ApiError, type Ingredient } from '../../src/lib/types'

class MemoryStore implements IngredientStore {
  records: Ingredient[] = []
  async list() { return this.records.map((item) => ({ ...item })) }
  async create(records: Ingredient[]) { this.records.push(...records.map((record, index) => ({ ...record, id: `rec${this.records.length + index}` }))) }
  async update(records: Ingredient[]) { this.records = this.records.map((item) => records.find((update) => update.id === item.id) || item) }
}
class ImmediateLock implements Lock { async tryLock() { return true }; release() {} }
class FailingLock implements Lock { async tryLock() { return false }; release() {} }

describe('safe ingredient upsert', () => {
  it('creates then idempotently re-saves the primary fixture', async () => {
    const store = new MemoryStore(), lock = new ImmediateLock()
    const first = await saveWithStore(store, lock, '2026-06-17', ['prawns', 'carrot', 'corn'])
    const second = await saveWithStore(store, lock, '2026-06-17', ['prawn', 'carrot', 'corn'])
    expect(first.created).toHaveLength(3); expect(second.created).toHaveLength(0); expect((await snapshotFrom(store)).ingredients).toHaveLength(3)
  })
  it('deduplicates a request and retains the earliest date', async () => {
    const store = new MemoryStore(), lock = new ImmediateLock()
    await saveWithStore(store, lock, '2026-06-17', ['corn', 'corn', 'CORNS'])
    const later = await saveWithStore(store, lock, '2026-06-18', ['corn'])
    const earlier = await saveWithStore(store, lock, '2026-06-10', ['corn'])
    expect(later.alreadyKnown).toHaveLength(1); expect(earlier.dateCorrected).toHaveLength(1); expect((await snapshotFrom(store)).ingredients[0].firstExposureDate).toBe('2026-06-10')
  })
  it('fails before partial writes when the lock cannot be acquired', async () => {
    const store = new MemoryStore()
    await expect(saveWithStore(store, new FailingLock(), '2026-06-17', ['corn'])).rejects.toMatchObject({ code: 'CONFLICT_RETRY' })
    expect(store.records).toEqual([])
  })
  it('validates date and candidate bounds', async () => {
    const store = new MemoryStore(), lock = new ImmediateLock()
    await expect(saveWithStore(store, lock, '2026-02-30', ['corn'])).rejects.toBeInstanceOf(ApiError)
    await expect(saveWithStore(store, lock, '2026-06-17', [])).rejects.toMatchObject({ code: 'INVALID_INGREDIENTS' })
  })
})
