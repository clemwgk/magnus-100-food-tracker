import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: { baseURL: 'http://127.0.0.1:4173' },
  projects: [{ name: 'iphone', use: { ...devices['iPhone 13'] } }, { name: 'desktop', use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: 'npm run build && npx vite preview --host 127.0.0.1 --port 4173', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI }
})
