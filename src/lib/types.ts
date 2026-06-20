export type Ingredient = {
  id?: string
  name: string
  key: string
  firstExposureDate: string
  notes?: string
}

export type Summary = { totalIngredients: number; goal: number }

export type Snapshot = { summary: Summary; ingredients: Ingredient[] }

export type SaveResult = {
  summary: Summary
  created: Ingredient[]
  alreadyKnown: Ingredient[]
  dateCorrected: Ingredient[]
  allIngredientKeys: string[]
}

export type ApiErrorCode =
  | 'INVALID_PASSCODE'
  | 'PASSCODE_THROTTLED'
  | 'INVALID_ACTION'
  | 'INVALID_DATE'
  | 'INVALID_INGREDIENTS'
  | 'CONFLICT_RETRY'
  | 'AIRTABLE_ERROR'
  | 'CONFIGURATION_ERROR'

export class ApiError extends Error {
  constructor(public readonly code: ApiErrorCode, message: string) { super(message) }
}

export type FoodApi = {
  health: () => Promise<{ ok: boolean; configured: Record<string, boolean> }>
  snapshot: (passcode: string) => Promise<Snapshot>
  saveIngredients: (passcode: string, exposureDate: string, ingredients: string[]) => Promise<SaveResult>
}
