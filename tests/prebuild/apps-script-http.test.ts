import { afterEach, describe, expect, it } from 'vitest'

const live = process.env.RUN_LIVE_PREBUILD_TESTS === 'true'
const url = process.env.APPS_SCRIPT_URL || ''
const passcode = process.env.TEST_FAMILY_PASSCODE || ''
const testBase = process.env.TEST_AIRTABLE_BASE_ID || ''
const disposableToken = process.env.TEST_AIRTABLE_TOKEN || ''
const required = [url, passcode, testBase, disposableToken]
const createdIds: string[] = []

async function post(payload: Record<string, unknown>) {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) })
  return response.json() as Promise<Record<string, unknown>>
}
async function cleanup() {
  await Promise.all(createdIds.splice(0).map(async (id) => fetch(`https://api.airtable.com/v0/${encodeURIComponent(testBase)}/Ingredients/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${disposableToken}` } })))
}
afterEach(cleanup)

describe.runIf(live && required.every(Boolean))('live Apps Script HTTP contract (disposable base only)', () => {
  it('uses anonymous simple POSTs, protects reads, and supports create/read/date correction', async () => {
    const health = await fetch(`${url}${url.includes('?') ? '&' : '?'}action=health`).then((response) => response.json() as Promise<Record<string, unknown>>)
    expect(health).toMatchObject({ ok: true, service: 'magnus-food-tracker' })
    expect(JSON.stringify(health)).not.toMatch(/Ingredients|app[a-zA-Z0-9]+|pat[a-zA-Z0-9]+/)
    expect(await post({ action: 'snapshot', passcode: 'definitely-wrong' })).toMatchObject({ ok: false, code: 'INVALID_PASSCODE' })
    expect(await post({ action: 'verifyTestTarget', passcode, expectedBaseId: testBase })).toMatchObject({ ok: true, verified: true })
    const key = `codexspike${Date.now().toString(36)}`
    const created = await post({ action: 'saveIngredients', passcode, exposureDate: '2026-06-17', ingredients: [key] })
    expect(created).toMatchObject({ summary: { goal: 100 } })
    const snapshot = await post({ action: 'snapshot', passcode })
    const ingredients = snapshot.ingredients as Array<{ id: string; key: string; firstExposureDate: string }>
    const saved = ingredients.find((item) => item.key === key)
    expect(saved).toBeDefined(); createdIds.push(saved!.id)
    const corrected = await post({ action: 'saveIngredients', passcode, exposureDate: '2026-06-10', ingredients: [key] })
    expect(corrected.dateCorrected).toHaveLength(1)
    const reread = await post({ action: 'snapshot', passcode })
    expect((reread.ingredients as Array<{ key: string; firstExposureDate: string }>).find((item) => item.key === key)?.firstExposureDate).toBe('2026-06-10')
  })
})
