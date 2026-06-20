import { describe, expect, it } from 'vitest'

const live = process.env.RUN_LIVE_PREBUILD_TESTS === 'true'
const baseId = process.env.TEST_AIRTABLE_BASE_ID || ''
const token = process.env.TEST_AIRTABLE_TOKEN || ''

describe.runIf(live && baseId && token)('live disposable Airtable schema contract', () => {
  it('has exactly the required Ingredients fields and types', async () => {
    const response = await fetch(`https://api.airtable.com/v0/meta/bases/${encodeURIComponent(baseId)}/tables`, { headers: { Authorization: `Bearer ${token}` } })
    expect(response.ok).toBe(true)
    type Table = { name: string; fields: Array<{ name: string; type: string; options?: { dateFormat?: { format: string }; includeTime?: boolean } }> }
    const body = await response.json() as { tables: Table[] }
    const table = body.tables.find((item) => item.name === 'Ingredients')
    expect(table).toBeDefined()
    expect(table!.fields.map((field) => [field.name, field.type])).toEqual([
      ['Name', 'singleLineText'], ['Key', 'singleLineText'], ['First Exposure Date', 'date'], ['Notes', 'multilineText'], ['Created At', 'createdTime']
    ])
    const date = table!.fields.find((field) => field.name === 'First Exposure Date')
    expect(date?.options?.includeTime).toBeFalsy()
  })
})
