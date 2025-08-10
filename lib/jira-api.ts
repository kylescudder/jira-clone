import type {
  JiraIssue,
  JiraProject,
  JiraUser,
  FilterOptions
} from '@/types/jira'
import { cookies } from 'next/headers'

const JIRA_BASE_URL =
  process.env.JIRA_BASE_URL || 'https://your-domain.atlassian.net'
const JIRA_EMAIL = process.env.JIRA_EMAIL || ''
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || ''

const basicAuth =
  JIRA_EMAIL && JIRA_API_TOKEN
    ? Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64')
    : ''

async function getAuthAndBase() {
  // Prefer user OAuth tokens from cookies when available
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get('JIRA_ACCESS_TOKEN')?.value
    const cloudId = cookieStore.get('JIRA_CLOUD_ID')?.value

    if (accessToken && cloudId) {
      return {
        base: `https://api.atlassian.com/ex/jira/${cloudId}`,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json'
        }
      }
    }
  } catch (e) {
    // cookies() is only available in server runtime; ignore if not available
  }

  // Fallback to Basic auth using env (useful for local dev or service mode)
  return {
    base: JIRA_BASE_URL,
    headers: {
      ...(basicAuth ? { Authorization: `Basic ${basicAuth}` } : {}),
      Accept: 'application/json',
      'Content-Type': 'application/json'
    }
  }
}

async function jiraFetch(endpoint: string, options?: RequestInit) {
  const { base, headers } = await getAuthAndBase()
  const response = await fetch(`${base}/rest/api/3${endpoint}`, {
    headers: {
      ...headers
    },
    ...options
  })

  if (!response.ok) {
    throw new Error(`Jira API error: ${response.status} ${response.statusText}`)
  }

  // Handle empty responses (like 204 No Content)
  const contentLength = response.headers.get('content-length')
  const contentType = response.headers.get('content-type')

  if (
    contentLength === '0' ||
    response.status === 204 ||
    !contentType?.includes('application/json')
  ) {
    return null
  }

  const text = await response.text()
  if (!text.trim()) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch (error) {
    console.error('Failed to parse JSON response:', text)
    throw new Error('Invalid JSON response from Jira API')
  }
}

// Separate function for Agile API calls (boards, sprints)
async function jiraAgileFetch(endpoint: string, options?: RequestInit) {
  const { base, headers } = await getAuthAndBase()
  let response = await fetch(`${base}/rest/agile/1.0${endpoint}`, {
    headers: {
      ...headers
    },
    ...options
  })

  // If OAuth token is present but lacks Agile scope, fall back to Basic auth using env token
  if (response.status === 401 && basicAuth) {
    try {
      response = await fetch(`${JIRA_BASE_URL}/rest/agile/1.0${endpoint}`, {
        headers: {
          Authorization: `Basic ${basicAuth}`,
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        ...options
      })
    } catch (e) {
      // network error; will be handled below as !ok
    }
  }

  if (!response.ok) {
    throw new Error(
      `Jira Agile API error: ${response.status} ${response.statusText}`
    )
  }

  // Handle empty responses
  const contentLength = response.headers.get('content-length')
  const contentType = response.headers.get('content-type')

  if (
    contentLength === '0' ||
    response.status === 204 ||
    !contentType?.includes('application/json')
  ) {
    return null
  }

  const text = await response.text()
  if (!text.trim()) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch (error) {
    console.error('Failed to parse JSON response:', text)
    throw new Error('Invalid JSON response from Jira Agile API')
  }
}

// Helper function to fetch all paginated results
async function fetchAllPaginated(
  fetchFunction: (startAt: number, maxResults: number) => Promise<any>,
  maxResults = 100
): Promise<any[]> {
  const allResults: any[] = []
  let startAt = 0
  let total = 0
  let hasMore = true

  while (hasMore) {
    try {
      const data = await fetchFunction(startAt, maxResults)

      if (!data || !data.values || data.values.length === 0) {
        break
      }

      allResults.push(...data.values)
      total = data.total || data.values.length
      startAt += data.values.length

      // Check if we have more results
      hasMore = data.values.length === maxResults && startAt < total

      console.log(
        `Fetched ${data.values.length} items. Total so far: ${allResults.length}${total > 0 ? `/${total}` : ''}`
      )

      // Safety check to prevent infinite loops
      if (allResults.length > 10000) {
        console.warn(
          'Reached safety limit of 10,000 items. Stopping pagination.'
        )
        break
      }
    } catch (error) {
      console.error('Error in pagination:', error)
      break
    }
  }

  return allResults
}

// Helper function to extract text from Jira's Atlassian Document Format (ADF)
function extractTextFromADF(adfContent: any): string {
  if (!adfContent) return ''

  const extractText = (node: any): string => {
    if (!node) return ''

    // If it's a text node, return the text
    if (node.type === 'text' && node.text) {
      return node.text
    }

    // If it has content array, recursively extract from each item
    if (node.content && Array.isArray(node.content)) {
      return node.content.map(extractText).join('')
    }

    // Handle different node types
    switch (node.type) {
      case 'paragraph':
        return extractText({ content: node.content }) + '\n\n'
      case 'heading':
        return extractText({ content: node.content }) + '\n\n'
      case 'bulletList':
      case 'orderedList':
        return (
          node.content
            ?.map((item: any) => '• ' + extractText(item))
            .join('\n') + '\n\n'
        )
      case 'listItem':
        return extractText({ content: node.content })
      case 'codeBlock':
        return `\`\`\`\n${extractText({ content: node.content })}\n\`\`\`\n\n`
      case 'blockquote':
        return `> ${extractText({ content: node.content })}\n\n`
      case 'hardBreak':
        return '\n'
      default:
        // For unknown types, try to extract content if it exists
        if (node.content) {
          return extractText({ content: node.content })
        }
        return ''
    }
  }

  try {
    // Handle the case where description is the full ADF document
    if (adfContent.content && Array.isArray(adfContent.content)) {
      return adfContent.content.map(extractText).join('').trim()
    }

    // Handle the case where description is already a content array
    if (Array.isArray(adfContent)) {
      return adfContent.map(extractText).join('').trim()
    }

    // Fallback for simple text
    if (typeof adfContent === 'string') {
      return adfContent
    }

    return extractText(adfContent).trim()
  } catch (error) {
    console.error('Error extracting text from ADF:', error)
    return 'Unable to parse description'
  }
}

export async function getCurrentUser(): Promise<JiraUser | null> {
  try {
    const data = await jiraFetch('/myself')
    if (!data) return null

    return {
      displayName: data.displayName,
      emailAddress: data.emailAddress,
      accountId: data.accountId
    }
  } catch (error) {
    console.error('Error fetching current user:', error)
    return null
  }
}

export async function getProjects(): Promise<JiraProject[]> {
  try {
    const data = await jiraFetch('/project')
    if (!data) return []

    return data.map((project: any) => ({
      id: project.id,
      key: project.key,
      name: project.name
    }))
  } catch (error) {
    console.error('Error fetching projects:', error)
    return []
  }
}

export async function getProjectUsers(projectKey: string): Promise<JiraUser[]> {
  try {
    // Fetch all users with pagination
    const allUsers = await fetchAllPaginated(async (startAt, maxResults) => {
      const data = await jiraFetch(
        `/user/assignable/search?project=${projectKey}&startAt=${startAt}&maxResults=${maxResults}`
      )
      return { values: data || [], total: data?.length || 0 }
    }, 100)

    return allUsers.map((user: any) => ({
      displayName: user.displayName,
      emailAddress: user.emailAddress,
      accountId: user.accountId
    }))
  } catch (error) {
    console.error('Error fetching project users:', error)
    return []
  }
}

export async function getProjectSprints(
  projectKey: string
): Promise<Array<{ id: string; name: string; state: string }>> {
  try {
    console.log(`Fetching ALL sprints for project: ${projectKey}`)

    // Step 1: Get all boards for the project (with pagination)
    console.log(`Looking for all boards for project: ${projectKey}`)

    const allBoards = await fetchAllPaginated(async (startAt, maxResults) => {
      return await jiraAgileFetch(
        `/board?projectKeyOrId=${projectKey}&startAt=${startAt}&maxResults=${maxResults}`
      )
    }, 50)

    console.log(
      `Found ${allBoards.length} total boards for project ${projectKey}`
    )

    if (allBoards.length === 0) {
      console.log(`No boards found for project ${projectKey}`)
      return []
    }

    // Step 2: Prioritize scrum boards, but use any board if needed
    const scrumBoards = allBoards.filter((board: any) => board.type === 'scrum')
    const boardToUse = scrumBoards.length > 0 ? scrumBoards[0] : allBoards[0]

    console.log(
      `Using board: ${boardToUse.name} (ID: ${boardToUse.id}, Type: ${boardToUse.type})`
    )

    // Step 3: Get ALL sprints for this board with pagination
    console.log(`Fetching ALL sprints from board ${boardToUse.id}`)

    const allSprints = await fetchAllPaginated(async (startAt, maxResults) => {
      return await jiraAgileFetch(
        `/board/${boardToUse.id}/sprint?startAt=${startAt}&maxResults=${maxResults}`
      )
    }, 50)

    const sprints = allSprints.map((sprint: any) => ({
      id: sprint.id.toString(),
      name: sprint.name,
      state: sprint.state
    }))

    console.log(
      `Successfully fetched ALL ${sprints.length} sprints for project ${projectKey}`
    )

    // Log sprint breakdown by state
    const sprintsByState = sprints.reduce((acc: any, sprint) => {
      acc[sprint.state] = (acc[sprint.state] || 0) + 1
      return acc
    }, {})
    console.log(`Sprint breakdown:`, sprintsByState)

    return sprints
  } catch (error) {
    console.error('Error fetching project sprints:', error)

    // Fallback: Try to get sprints via JQL search with pagination
    try {
      console.log(
        'Attempting fallback JQL-based sprint search for ALL sprints...'
      )

      const allIssues = await fetchAllPaginated(async (startAt, maxResults) => {
        const jql = `project = ${projectKey} AND sprint is not EMPTY`
        const data = await jiraFetch(
          `/search?jql=${encodeURIComponent(jql)}&startAt=${startAt}&maxResults=${maxResults}&fields=customfield_10020`
        )
        return data || { values: [], total: 0 }
      }, 100)

      if (allIssues.length > 0) {
        const sprintSet = new Set<string>()
        const sprintMap = new Map<
          string,
          { id: string; name: string; state: string }
        >()

        allIssues.forEach((issue: any) => {
          const sprintField = issue.fields?.customfield_10020
          if (sprintField && Array.isArray(sprintField)) {
            sprintField.forEach((sprint: any) => {
              if (sprint && sprint.id && sprint.name) {
                const sprintKey = `${sprint.id}-${sprint.name}`
                if (!sprintSet.has(sprintKey)) {
                  sprintSet.add(sprintKey)
                  sprintMap.set(sprintKey, {
                    id: sprint.id.toString(),
                    name: sprint.name,
                    state: sprint.state || 'unknown'
                  })
                }
              }
            })
          }
        })

        const sprints = Array.from(sprintMap.values())
        console.log(`Fallback JQL search found ALL ${sprints.length} sprints`)
        return sprints
      }
    } catch (fallbackError) {
      console.error('Fallback JQL search also failed:', fallbackError)
    }

    return []
  }
}

export async function getIssueTransitions(
  issueKey: string
): Promise<Array<{ id: string; name: string }>> {
  try {
    const data = await jiraFetch(`/issue/${issueKey}/transitions`)
    if (!data || !data.transitions) return []

    return data.transitions.map((transition: any) => ({
      id: transition.id,
      name: transition.to.name
    }))
  } catch (error) {
    console.error('Error fetching issue transitions:', error)
    return []
  }
}

export async function updateIssueStatus(
  issueKey: string,
  transitionId: string
): Promise<boolean> {
  try {
    await jiraFetch(`/issue/${issueKey}/transitions`, {
      method: 'POST',
      body: JSON.stringify({
        transition: {
          id: transitionId
        }
      })
    })
    // If no error was thrown, the update was successful
    return true
  } catch (error) {
    console.error('Error updating issue status:', error)
    return false
  }
}

export async function updateIssueAssignee(
  issueKey: string,
  accountId: string | null
): Promise<boolean> {
  try {
    await jiraFetch(`/issue/${issueKey}/assignee`, {
      method: 'PUT',
      body: JSON.stringify({
        accountId: accountId
      })
    })
    // If no error was thrown, the update was successful
    return true
  } catch (error) {
    console.error('Error updating issue assignee:', error)
    return false
  }
}

export async function getIssues(
  projectKey: string,
  filters?: FilterOptions
): Promise<JiraIssue[]> {
  try {
    let jql = `project = ${projectKey}`

    // Sprint filter is now required - if no sprints specified, return empty
    if (!filters?.sprint?.length) {
      console.log('No sprints specified, returning empty result set')
      return []
    }

    // Add sprint filter (this is now required)
    jql += ` AND sprint IN (${filters.sprint.map((s) => `"${s}"`).join(',')})`

    if (filters?.status?.length) {
      jql += ` AND status IN (${filters.status.map((s) => `"${s}"`).join(',')})`
    }

    if (filters?.priority?.length) {
      jql += ` AND priority IN (${filters.priority.map((p) => `"${p}"`).join(',')})`
    }

    if (filters?.assignee?.length) {
      const assigneeConditions: string[] = []

      filters.assignee.forEach((assignee) => {
        if (assignee === 'UNASSIGNED') {
          assigneeConditions.push('assignee is EMPTY')
        } else {
          assigneeConditions.push(`assignee = "${assignee}"`)
        }
      })

      if (assigneeConditions.length > 0) {
        jql += ` AND (${assigneeConditions.join(' OR ')})`
      }
    }

    if (filters?.issueType?.length) {
      jql += ` AND issuetype IN (${filters.issueType.map((t) => `"${t}"`).join(',')})`
    }

    if (filters?.dueDateFrom) {
      jql += ` AND duedate >= "${filters.dueDateFrom}"`
    }

    if (filters?.dueDateTo) {
      jql += ` AND duedate <= "${filters.dueDateTo}"`
    }

    if (filters?.labels?.length) {
      jql += ` AND labels IN (${filters.labels.map((l) => `"${l}"`).join(',')})`
    }

    if (filters?.components?.length) {
      jql += ` AND component IN (${filters.components.map((c) => `"${c}"`).join(',')})`
    }

    if (filters?.release?.length) {
      const releaseConditions: string[] = []

      filters.release.forEach((release) => {
        if (release === 'NO_RELEASE') {
          releaseConditions.push('fixVersion is EMPTY')
        } else {
          releaseConditions.push(`fixVersion = "${release}"`)
        }
      })

      if (releaseConditions.length > 0) {
        jql += ` AND (${releaseConditions.join(' OR ')})`
      }
    }

    console.log(`Fetching ALL issues for JQL: ${jql}`)

    // Fetch ALL issues with direct pagination (not using fetchAllPaginated)
    // because Jira search API has a different response structure
    const allIssues: any[] = []
    let startAt = 0
    const maxResults = 100
    let total = 0

    do {
      console.log(
        `Fetching issues batch: startAt=${startAt}, maxResults=${maxResults}`
      )

      const data = await jiraFetch(
        `/search?jql=${encodeURIComponent(jql)}&startAt=${startAt}&maxResults=${maxResults}&fields=*all`
      )

      if (!data || !data.issues) {
        console.log('No data or issues returned, breaking pagination loop')
        break
      }

      console.log(`Received ${data.issues.length} issues in this batch`)
      console.log(`Total available: ${data.total}`)

      allIssues.push(...data.issues)
      total = data.total
      startAt += data.issues.length

      console.log(
        `Fetched ${data.issues.length} issues. Total so far: ${allIssues.length}/${total}`
      )

      // Break if we got fewer results than requested (last page)
      if (data.issues.length < maxResults) {
        console.log(
          'Received fewer issues than requested, this was the last page'
        )
        break
      }

      // Safety check to prevent infinite loops
      if (allIssues.length > 10000) {
        console.warn(
          'Reached safety limit of 10,000 issues. Stopping pagination.'
        )
        break
      }
    } while (allIssues.length < total && startAt < total)

    console.log(
      `Completed fetching ALL ${allIssues.length} issues for selected sprint(s)`
    )

    return allIssues.map((issue: any) => ({
      id: issue.id,
      key: issue.key,
      summary: issue.fields.summary,
      description: extractTextFromADF(issue.fields.description),
      status: issue.fields.status,
      priority: issue.fields.priority,
      assignee: issue.fields.assignee,
      reporter: issue.fields.reporter,
      issuetype: issue.fields.issuetype,
      created: issue.fields.created,
      updated: issue.fields.updated,
      duedate: issue.fields.duedate,
      labels: issue.fields.labels || [],
      components: issue.fields.components || [],
      sprint: issue.fields.customfield_10020
        ? {
            id: issue.fields.customfield_10020[0]?.id,
            name: issue.fields.customfield_10020[0]?.name,
            state: issue.fields.customfield_10020[0]?.state
          }
        : undefined,
      fixVersions: issue.fields.fixVersions || []
    }))
  } catch (error) {
    console.error('Error fetching issues:', error)
    return []
  }
}
