import { test, expect } from '@playwright/test'

test('signed-out visitors are sent to Jira sign-in and protected pages stay private', async ({
  page
}) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Login to Jira Clone' })
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Connect to Jira' })
  ).toHaveAttribute('href', '/api/auth/jira/login')
  await expect(
    page.getByRole('button', { name: 'New Issue', exact: true })
  ).toHaveCount(0)
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Login to Jira Clone' })
  ).toBeVisible()
})

test('OAuth reports missing configuration rather than granting a session', async ({
  request
}) => {
  const response = await request.get('/api/auth/jira/login', {
    maxRedirects: 0
  })
  expect(response.status()).toBe(500)
})
