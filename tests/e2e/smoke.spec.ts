import { test, expect } from '@playwright/test'

test.describe('Smoke: core pages render', () => {
  const routes = ['/', '/search', '/explore', '/maps']

  for (const route of routes) {
    test(`renders ${route} without console errors`, async ({ page }) => {
      const errors: string[] = []
      page.on('console', (msg) => {
        const type = msg.type()
        if (type === 'error') errors.push(msg.text())
      })
      await page.goto(route)
      // basic sanity: body exists and some content
      await expect(page.locator('body')).toBeVisible()
      // avoid flakiness on dev loads
      await page.waitForTimeout(200)
      expect(errors.join('\n')).toBe('')
    })
  }
})

