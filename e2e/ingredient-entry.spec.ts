import { expect, test } from '@playwright/test'

async function configure(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.locator('#endpoint').fill(`${new URL(page.url()).origin}/exec`)
  await page.locator('#passcode').fill('family-code')
  await page.getByRole('button', { name: 'Save endpoint' }).click()
}

async function localToday(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const now = new Date()
    const offset = now.getTimezoneOffset()
    return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10)
  })
}

async function mockApi(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const snapshot = {
      summary: { totalIngredients: 4, goal: 100 },
      ingredients: [
        { id: '1', name: 'Prawn', key: 'prawn', firstExposureDate: '2026-06-10' },
        { id: '2', name: 'Carrot', key: 'carrot', firstExposureDate: '2026-06-12' },
        { id: '3', name: 'Corn', key: 'corn', firstExposureDate: '2026-06-17' },
        { id: '4', name: 'Apple', key: 'apple', firstExposureDate: '2026-06-08' }
      ]
    }
    window.__MAGNUS_TEST_API__ = {
      health: async () => ({ ok: true, configured: {} }), snapshot: async () => snapshot,
      saveIngredients: async () => ({ summary: snapshot.summary, created: [{ name: 'Corn', key: 'corn', firstExposureDate: '2026-06-17' }], alreadyKnown: snapshot.ingredients.slice(0, 2), dateCorrected: [], allIngredientKeys: ['prawn', 'carrot', 'corn'] })
    }
  })
}

test('parses ingredients, saves only missing ones, and exposes labelled controls', async ({ page }) => {
  await mockApi(page)
  await configure(page)
  await page.locator('#ingredients').fill('blended prawns, carrot, and corn')
  await expect(page.getByText('Prawn', { exact: true })).toBeVisible(); await expect(page.getByText('Carrot', { exact: true })).toBeVisible(); await expect(page.getByText('Corn', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Yesterday' }).click()
  await page.getByRole('button', { name: 'Save ingredients' }).click()
  await expect(page.locator('.result')).toBeVisible()
  await expect(page.locator('.result')).toContainText(/New:\s*Corn/)
  await expect(page.locator('.result')).toContainText(/Already tracked:\s*Prawn, Carrot/)
  await page.locator('#exposure-date').focus()
  await expect(page.locator('#exposure-date')).toBeFocused()
  await expect(page.locator('#exposure-date')).toHaveAttribute('type', 'date')
  await expect(page.locator('#ingredients')).toBeVisible(); await expect(page.getByRole('button', { name: 'Save ingredients' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Today' })).toBeVisible()
  await page.getByRole('button', { name: 'How it works' }).click()
  await expect(page.getByText('Quick guide', { exact: true })).toBeVisible()
  await expect(page.getByText('Fix a typo', { exact: true })).toBeVisible()
  const box = await page.locator('.app-shell').boundingBox(); expect(box?.x).toBeGreaterThanOrEqual(0)
})

test('remembers passcode and resets stale draft dates to today on reopen', async ({ page }) => {
  await configure(page)
  await page.getByRole('button', { name: 'Settings & diagnostics' }).click()
  await expect(page.locator('#passcode')).toHaveValue('family-code')
  await page.evaluate(() => localStorage.setItem('magnus.draft', JSON.stringify({ text: 'banana', date: '2020-01-01' })))
  await page.reload()
  await expect(page.locator('#ingredients')).toHaveValue('banana')
  await expect(page.locator('#exposure-date')).toHaveValue(await localToday(page))
  await page.getByRole('button', { name: 'Today' }).click()
  await expect(page.locator('#exposure-date')).toHaveValue(await localToday(page))
})

test('tracked ingredients can be sorted by latest date inside a scrollable panel', async ({ page }) => {
  await mockApi(page)
  await configure(page)
  await page.getByRole('button', { name: 'Refresh' }).click()
  await expect(page.locator('.ingredient-list li').first()).toContainText('Apple')
  await page.locator('#sort-order').selectOption('latest')
  await expect(page.locator('.ingredient-list li').first()).toContainText('Corn')
  await expect(page.locator('.ingredient-list')).toHaveCSS('overflow-y', 'auto')
})

test('offline save stays pending rather than claiming success', async ({ page, context }) => {
  await configure(page)
  await page.locator('#ingredients').fill('banana')
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Save ingredients' }).click()
  await expect(page.getByRole('status')).toContainText(/offline|retry/i)
  await expect(page.locator('#ingredients')).toHaveValue('banana')
})

test('manifest, icon, and service worker are available', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', /manifest\.webmanifest/)
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', /icons\/icon\.svg/)
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.getRegistration().then((registration) => Boolean(registration)))).toBe(true)
})
