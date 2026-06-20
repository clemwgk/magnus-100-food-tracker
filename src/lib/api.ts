import { ApiError, type FoodApi, type SaveResult, type Snapshot } from './types'

type Transport = (payload: Record<string, unknown>) => Promise<unknown>

function assertObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') throw new ApiError('AIRTABLE_ERROR', 'The service returned an unexpected response.')
  return value as Record<string, unknown>
}

export function createApi(endpoint: string): FoodApi {
  const cleanEndpoint = endpoint.trim()
  const post: Transport = async (payload) => {
    if (!cleanEndpoint) throw new ApiError('CONFIGURATION_ERROR', 'Add the Apps Script /exec URL in Settings first.')
    let response: Response
    try {
      response = await fetch(cleanEndpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) })
    } catch {
      throw new ApiError('AIRTABLE_ERROR', 'You appear to be offline. Your text is still here; retry when connected.')
    }
    let body: Record<string, unknown>
    try { body = assertObject(await response.json()) } catch { throw new ApiError('AIRTABLE_ERROR', 'The service returned an unreadable response.') }
    if (body.ok === false || typeof body.code === 'string') throw new ApiError((body.code as ApiError['code']) || 'AIRTABLE_ERROR', typeof body.message === 'string' ? body.message : 'The service could not complete that request.')
    return body
  }
  return {
    health: async () => {
      if (!cleanEndpoint) throw new ApiError('CONFIGURATION_ERROR', 'Add the Apps Script /exec URL in Settings first.')
      const response = await fetch(`${cleanEndpoint}${cleanEndpoint.includes('?') ? '&' : '?'}action=health`)
      return assertObject(await response.json()) as { ok: boolean; configured: Record<string, boolean> }
    },
    snapshot: async (passcode) => post({ action: 'snapshot', passcode }) as Promise<Snapshot>,
    saveIngredients: async (passcode, exposureDate, ingredients) => post({ action: 'saveIngredients', passcode, exposureDate, ingredients }) as Promise<SaveResult>
  }
}
