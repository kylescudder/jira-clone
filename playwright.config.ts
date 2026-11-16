import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:44323', screenshot: 'on', trace: 'off' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 } } }
  ],
  webServer: {
    command: 'bun run dev -- --hostname 127.0.0.1 --port 44323',
    url: 'http://127.0.0.1:44323',
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      JIRA_EMAIL: '',
      JIRA_API_TOKEN: '',
      JIRA_BASE_URL: '',
      ATLASSIAN_CLIENT_ID: '',
      ATLASSIAN_CLIENT_SECRET: ''
    }
  }
})
