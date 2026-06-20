import { earlierThan, isDateOnly } from './dateOnly'
import { normalizeCandidates } from './normalize'
import { ApiError, type Ingredient, type SaveResult, type Snapshot } from './types'

export interface IngredientStore {
  list(): Promise<Ingredient[]>
  create(records: Ingredient[]): Promise<void>
  update(records: Ingredient[]): Promise<void>
}
export interface Lock { tryLock(): Promise<boolean>; release(): void }

export async function saveWithStore(store: IngredientStore, lock: Lock, exposureDate: string, candidates: string[]): Promise<SaveResult> {
  if (!isDateOnly(exposureDate)) throw new ApiError('INVALID_DATE', 'Choose a valid date.')
  if (!Array.isArray(candidates) || candidates.length < 1 || candidates.length > 20 || candidates.some((item) => typeof item !== 'string' || item.length > 200)) throw new ApiError('INVALID_INGREDIENTS', 'Enter between 1 and 20 ingredients.')
  const normalized = normalizeCandidates(candidates)
  if (!normalized.length) throw new ApiError('INVALID_INGREDIENTS', 'Enter at least one usable ingredient.')
  if (!(await lock.tryLock())) throw new ApiError('CONFLICT_RETRY', 'Another save is in progress. Please retry.')
  try {
    const existing = await store.list()
    const byKey = new Map(existing.map((record) => [record.key, record]))
    const created: Ingredient[] = []
    const alreadyKnown: Ingredient[] = []
    const dateCorrected: Ingredient[] = []
    for (const candidate of normalized) {
      const known = byKey.get(candidate.key)
      if (!known) {
        const record = { ...candidate, firstExposureDate: exposureDate, notes: '' }
        created.push(record); byKey.set(record.key, record)
      } else if (earlierThan(exposureDate, known.firstExposureDate)) {
        const corrected = { ...known, firstExposureDate: exposureDate }
        dateCorrected.push(corrected); byKey.set(corrected.key, corrected)
      } else alreadyKnown.push(known)
    }
    await store.create(created)
    await store.update(dateCorrected)
    return { summary: { totalIngredients: existing.length + created.length, goal: 100 }, created, alreadyKnown, dateCorrected, allIngredientKeys: normalized.map((item) => item.key) }
  } finally { lock.release() }
}

export async function snapshotFrom(store: IngredientStore): Promise<Snapshot> {
  const ingredients = await store.list()
  return { summary: { totalIngredients: ingredients.length, goal: 100 }, ingredients }
}
