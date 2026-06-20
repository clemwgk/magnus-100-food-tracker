import { expect, it } from 'vitest'
import { saveWithStore, type IngredientStore, type Lock } from '../../src/lib/saveService'
import { type Ingredient } from '../../src/lib/types'

class SerializedLock implements Lock {
  private busy = false
  async tryLock() { if (this.busy) return false; this.busy = true; return true }
  release() { this.busy = false }
}
class Store implements IngredientStore {
  records: Ingredient[] = []
  async list() { return this.records.map((item) => ({ ...item })) }
  async create(records: Ingredient[]) { this.records.push(...records) }
  async update() {}
}

it('near-simultaneous saves leave one record per key; the second caller can retry', async () => {
  const store = new Store(), lock = new SerializedLock()
  const attempts = await Promise.allSettled([saveWithStore(store, lock, '2026-06-17', ['banana']), saveWithStore(store, lock, '2026-06-17', ['banana'])])
  expect(attempts.filter((item) => item.status === 'fulfilled')).toHaveLength(1)
  expect(store.records).toHaveLength(1)
  await saveWithStore(store, lock, '2026-06-17', ['banana'])
  expect(store.records).toHaveLength(1)
})
