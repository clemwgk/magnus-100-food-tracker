import { expect, test } from '@playwright/test'

async function configure(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.locator('#endpoint').fill(`${new URL(page.url()).origin}/exec`)
  await page.locator('#passcode').fill('family-code')
  await page.getByRole('button', { name: 'Save endpoint' }).click()
}

async function mockApi(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const snapshot = { summary: { totalIngredients: 3, goal: 100 }, ingredients: [{ id: '1', name: 'Prawn', key: 'prawn', firstExposureDate: '2026-06-10' }, { id: '2', name: 'Carrot', key: 'carrot', firstExposureDate: '2026-06-12' }, { id: '3', name: 'Corn', key: 'corn', firstExposureDate: '2026-06-17' }] }
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
  await page.getByRole('button', { name: 'How it works' }).click()
  await expect(page.getByText('Quick guide', { exact: true })).toBeVisible()
  await expect(page.getByText('Fix a typo', { exact: true })).toBeVisible()
  const box = await page.locator('.app-shell').boundingBox(); expect(box?.x).toBeGreaterThanOrEqual(0)
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
