import { test, expect, type Page } from '@playwright/test'

const icon = 'data:image/gif;base64,R0lGODlhAQABAAAAACw='
const person = (displayName: string) => ({
  displayName,
  avatarUrls: { '24x24': icon }
})
const issue = (
  key: string,
  summary: string,
  status: string,
  category: string,
  assignee?: string
) => ({
  id: key,
  key,
  summary,
  status: {
    name: status,
    statusCategory: { key: category, colorName: 'blue' }
  },
  priority: { name: 'Medium', iconUrl: icon },
  ...(assignee ? { assignee: person(assignee) } : {}),
  reporter: person('Riley Reporter'),
  issuetype: { name: 'Task', iconUrl: icon },
  created: '2026-11-01T09:00:00.000Z',
  updated: '2026-11-02T09:00:00.000Z',
  labels: [],
  components: [],
  fixVersions: []
})

const issues = [
  issue('DEMO-1', 'Draft the release notes', 'To Do', 'new', 'Avery Assignee'),
  issue('DEMO-2', 'Fix the login redirect', 'In Progress', 'indeterminate'),
  issue('DEMO-3', 'Ship the board filters', 'Done', 'done', 'Avery Assignee')
]

async function signInWithStubbedJira(page: Page) {
  // The middleware only checks that both OAuth cookies exist; Jira itself is replaced below.
  await page.context().addCookies(
    ['JIRA_ACCESS_TOKEN', 'JIRA_CLOUD_ID'].map((name) => ({
      name,
      value: 'e2e-stub',
      url: 'http://127.0.0.1:44323'
    }))
  )
  await page.route('**/api/**', async (route) => {
    const { pathname } = new URL(route.request().url())
    const json = (body: unknown) => route.fulfill({ json: body })
    if (pathname === '/api/user')
      return json({
        displayName: 'Avery Assignee',
        emailAddress: 'avery@example.test',
        accountId: 'avery'
      })
    if (pathname === '/api/projects')
      return json([{ id: '1', key: 'DEMO', name: 'Demo Project' }])
    if (pathname === '/api/issues') return json(issues)
    if (pathname.endsWith('/users')) return json([])
    if (pathname.endsWith('/sprints'))
      return json([{ id: '7', name: 'Sprint 7', state: 'active' }])
    if (/\/(versions|components)$/.test(pathname)) return json([])
    if (pathname === '/api/issuetypes') return json([])
    if (pathname.endsWith('/transitions')) return json([])
    return json({})
  })
}

test('a signed-in user sees the project board grouped by status', async ({
  page
}) => {
  await signInWithStubbedJira(page)
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Project Board' })
  ).toBeVisible()
  await page.getByLabel('Project', { exact: true }).selectOption('DEMO')
  const load = page.getByRole('button', { name: 'Load Issues' })
  await expect(load).toBeDisabled()
  await page.getByText('Click to select sprint(s)...').click()
  await page.getByText('Sprint 7').click()
  await page.keyboard.press('Escape')
  await load.click()

  for (const { summary } of issues)
    await expect(
      page.getByText(summary, { exact: true }).filter({ visible: true }).first()
    ).toBeVisible()
  await expect(
    page.getByText('DEMO-2', { exact: true }).filter({ visible: true }).first()
  ).toBeVisible()
  // The count badge is hidden on narrow screens, so only check the loaded total.
  await expect(page.getByText('3 issues loaded').first()).toBeAttached()
  for (const column of ['To Do', 'In Progress', 'Done'])
    await expect(
      page.getByText(column, { exact: true }).filter({ visible: true }).first()
    ).toBeVisible()
})
