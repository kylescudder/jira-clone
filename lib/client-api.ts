import type {
  JiraIssue,
  JiraProject,
  JiraUser,
  FilterOptions
} from '@/types/jira'

// Simple client-side cache using localStorage with TTL
// Note: Only available in the browser. Always guard against SSR.
const CACHE_PREFIX = 'jira-clone-cache:'

type CacheEntry<T> = { data: T; ts: number; ttl: number }

function now() {
  return Date.now()
}

export function getCachedData<T = any>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheEntry<T>
    if (!parsed || typeof parsed.ts !== 'number') return null
    // TTL of 0 means no expiry
    if (parsed.ttl > 0 && now() - parsed.ts > parsed.ttl) {
      // expired
      return parsed.data ?? null
    }
    return parsed.data
  } catch (e) {
    console.warn('getCachedData parse error for', key, e)
    return null
  }
}

export function setCachedData<T = any>(
  key: string,
  data: T,
  ttlMs = 5 * 60 * 1000
) {
  if (typeof window === 'undefined') return
  try {
    const entry: CacheEntry<T> = { data, ts: now(), ttl: ttlMs }
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry))
  } catch (e) {
    // Ignore quota errors
  }
}

export async function fetchCurrentUser(): Promise<JiraUser | null> {
  try {
    const response = await fetch('/api/user')
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = (await response.json()) as JiraUser | null
    if (data) setCachedData('currentUser', data, 10 * 60 * 1000)
    return data
  } catch (error) {
    console.error('Error fetching current user:', error)
    return getCachedData<JiraUser>('currentUser')
  }
}

export async function fetchProjects(): Promise<JiraProject[]> {
  try {
    const response = await fetch('/api/projects')
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = (await response.json()) as JiraProject[]
    setCachedData('projects', data, 60 * 60 * 1000)
    return data
  } catch (error) {
    console.error('Error fetching projects:', error)
    return getCachedData<JiraProject[]>('projects') || []
  }
}

export async function fetchProjectUsers(
  projectKey: string
): Promise<JiraUser[]> {
  try {
    const response = await fetch(`/api/projects/${projectKey}/users`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = (await response.json()) as JiraUser[]
    setCachedData(`projectUsers:${projectKey}`, data, 60 * 60 * 1000)
    return data
  } catch (error) {
    console.error('Error fetching project users:', error)
    return getCachedData<JiraUser[]>(`projectUsers:${projectKey}`) || []
  }
}

export async function fetchProjectSprints(
  projectKey: string
): Promise<Array<{ id: string; name: string; state: string }>> {
  try {
    const response = await fetch(`/api/projects/${projectKey}/sprints`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = (await response.json()) as Array<{
      id: string
      name: string
      state: string
    }>
    setCachedData(`sprints:${projectKey}`, data, 15 * 60 * 1000)
    return data
  } catch (error) {
    console.error('Error fetching project sprints:', error)
    return (
      getCachedData<Array<{ id: string; name: string; state: string }>>(
        `sprints:${projectKey}`
      ) || []
    )
  }
}

export async function fetchIssueTransitions(
  issueKey: string
): Promise<Array<{ id: string; name: string }>> {
  try {
    const response = await fetch(`/api/issues/${issueKey}/transitions`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = (await response.json()) as Array<{ id: string; name: string }>
    setCachedData(`transitions:${issueKey}`, data, 60 * 60 * 1000)
    return data
  } catch (error) {
    console.error('Error fetching issue transitions:', error)
    return (
      getCachedData<Array<{ id: string; name: string }>>(
        `transitions:${issueKey}`
      ) || []
    )
  }
}

export async function updateIssueStatus(
  issueKey: string,
  transitionId: string
): Promise<boolean> {
  try {
    const response = await fetch(`/api/issues/${issueKey}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ transitionId })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(
        `Status update failed: ${response.status} ${response.statusText}`,
        errorText
      )
      return false
    }

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
    const response = await fetch(`/api/issues/${issueKey}/assignee`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ accountId })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(
        `Assignee update failed: ${response.status} ${response.statusText}`,
        errorText
      )
      return false
    }

    return true
  } catch (error) {
    console.error('Error updating issue assignee:', error)
    return false
  }
}

export async function postIssueComment(
  issueKey: string,
  text: string
): Promise<boolean> {
  try {
    const response = await fetch(`/api/issues/${issueKey}/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    })
    if (!response.ok) {
      const errorText = await response.text()
      console.error(
        `Comment post failed: ${response.status} ${response.statusText}`,
        errorText
      )
      return false
    }
    return true
  } catch (error) {
    console.error('Error posting comment:', error)
    return false
  }
}

export async function editIssueComment(
  issueKey: string,
  commentId: string,
  text: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `/api/issues/${issueKey}/comment/${commentId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      }
    )
    if (!response.ok) {
      const errorText = await response.text()
      console.error(
        `Comment edit failed: ${response.status} ${response.statusText}`,
        errorText
      )
      return false
    }
    return true
  } catch (error) {
    console.error('Error editing comment:', error)
    return false
  }
}

export async function deleteIssueComment(
  issueKey: string,
  commentId: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `/api/issues/${issueKey}/comment/${commentId}`,
      { method: 'DELETE' }
    )
    if (!response.ok) {
      const errorText = await response.text()
      console.error(
        `Comment delete failed: ${response.status} ${response.statusText}`,
        errorText
      )
      return false
    }
    return true
  } catch (error) {
    console.error('Error deleting comment:', error)
    return false
  }
}

export async function fetchIssues(
  projectKey: string,
  filters?: FilterOptions
): Promise<JiraIssue[]> {
  try {
    const params = new URLSearchParams({ project: projectKey })

    // Add filters to query parameters (normalize by sorting for stable cache keys)
    if (filters?.status?.length) {
      params.append('status', [...filters.status].sort().join(','))
    }
    if (filters?.priority?.length) {
      params.append('priority', [...filters.priority].sort().join(','))
    }
    if (filters?.assignee?.length) {
      // Handle "Unassigned" specially - convert to a special token, then sort
      const assigneeFilter = filters.assignee
        .map((assignee) =>
          assignee === 'Unassigned' ? 'UNASSIGNED' : assignee
        )
        .sort()
      params.append('assignee', assigneeFilter.join(','))
    }
    if (filters?.issueType?.length) {
      params.append('issueType', [...filters.issueType].sort().join(','))
    }
    if (filters?.labels?.length) {
      params.append('labels', [...filters.labels].sort().join(','))
    }
    if (filters?.components?.length) {
      params.append('components', [...filters.components].sort().join(','))
    }
    if (filters?.sprint?.length) {
      params.append('sprint', [...filters.sprint].sort().join(','))
    }
    if (filters?.release?.length) {
      params.append('release', [...filters.release].sort().join(','))
    }
    if (filters?.dueDateFrom) {
      params.append('dueDateFrom', filters.dueDateFrom)
    }
    if (filters?.dueDateTo) {
      params.append('dueDateTo', filters.dueDateTo)
    }

    const query = params.toString()
    const cacheKey = `issues:${projectKey}:${query}`
    const response = await fetch(`/api/issues?${query}`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = (await response.json()) as JiraIssue[]
    setCachedData(cacheKey, data, 5 * 60 * 1000)
    return data
  } catch (error) {
    console.error('Error fetching issues:', error)
    // Try cache by reconstructing the same query
    try {
      const params = new URLSearchParams({ project: projectKey })
      if (filters?.status?.length)
        params.append('status', [...filters.status].sort().join(','))
      if (filters?.priority?.length)
        params.append('priority', [...filters.priority].sort().join(','))
      if (filters?.assignee?.length)
        params.append(
          'assignee',
          filters.assignee
            .map((a) => (a === 'Unassigned' ? 'UNASSIGNED' : a))
            .sort()
            .join(',')
        )
      if (filters?.issueType?.length)
        params.append('issueType', [...filters.issueType].sort().join(','))
      if (filters?.labels?.length)
        params.append('labels', [...filters.labels].sort().join(','))
      if (filters?.components?.length)
        params.append('components', [...filters.components].sort().join(','))
      if (filters?.sprint?.length)
        params.append('sprint', [...filters.sprint].sort().join(','))
      if (filters?.release?.length)
        params.append('release', [...filters.release].sort().join(','))
      if (filters?.dueDateFrom)
        params.append('dueDateFrom', filters.dueDateFrom)
      if (filters?.dueDateTo) params.append('dueDateTo', filters.dueDateTo)
      const cacheKey = `issues:${projectKey}:${params.toString()}`
      return getCachedData<JiraIssue[]>(cacheKey) || []
    } catch {
      return []
    }
  }
}

export async function fetchIssueDetails(issueKey: string) {
  try {
    const response = await fetch(`/api/issues/${issueKey}/details`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()
    setCachedData(`issueDetails:${issueKey}`, data, 30 * 60 * 1000)
    return data
  } catch (error) {
    console.error('Error fetching issue details:', error)
    return (
      getCachedData(`issueDetails:${issueKey}`) || {
        attachments: [],
        comments: [],
        changelog: []
      }
    )
  }
}

// Optimistic preloading helpers
export async function preloadIssueData(issueKey: string, projectKey: string) {
  try {
    // If running on server, skip
    if (typeof window === 'undefined') return

    const needsDetails = !getCachedData(`issueDetails:${issueKey}`)
    const needsTransitions = !getCachedData(`transitions:${issueKey}`)
    const needsUsers = !getCachedData(`projectUsers:${projectKey}`)

    const tasks: Array<Promise<any>> = []
    // Fire off requests without awaiting serially; let cache be populated when complete
    if (needsDetails)
      tasks.push(
        fetch(`/api/issues/${issueKey}/details`)
          .then(async (r) => {
            if (r.ok) {
              const data = await r.json()
              setCachedData(`issueDetails:${issueKey}`, data, 30 * 60 * 1000)
            }
          })
          .catch(() => {})
      )
    if (needsTransitions)
      tasks.push(
        fetch(`/api/issues/${issueKey}/transitions`)
          .then(async (r) => {
            if (r.ok) {
              const data = await r.json()
              setCachedData(`transitions:${issueKey}`, data, 60 * 60 * 1000)
            }
          })
          .catch(() => {})
      )
    if (needsUsers)
      tasks.push(
        fetch(`/api/projects/${projectKey}/users`)
          .then(async (r) => {
            if (r.ok) {
              const data = await r.json()
              setCachedData(`projectUsers:${projectKey}`, data, 60 * 60 * 1000)
            }
          })
          .catch(() => {})
      )

    // Do not throw; allow background completion
    await Promise.allSettled(tasks)
  } catch {
    // silent fail - preloading is best-effort
  }
}

export function preloadIssues(
  issues: JiraIssue[],
  projectKey: string,
  limit = 10
) {
  if (!issues || issues.length === 0) return
  const slice = issues.slice(0, Math.max(0, limit))
  // Kick off preloads without awaiting
  slice.forEach((issue) => {
    void preloadIssueData(issue.key, projectKey)
  })
}

export async function fetchProjectVersions(
  projectKey: string
): Promise<
  Array<{ id: string; name: string; released: boolean; archived?: boolean }>
> {
  try {
    const response = await fetch(`/api/projects/${projectKey}/versions`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = (await response.json()) as Array<{
      id: string
      name: string
      released: boolean
      archived?: boolean
    }>
    setCachedData(`versions:${projectKey}`, data, 15 * 60 * 1000)
    return data
  } catch (error) {
    console.error('Error fetching project versions:', error)
    return (
      getCachedData<
        Array<{
          id: string
          name: string
          released: boolean
          archived?: boolean
        }>
      >(`versions:${projectKey}`) || []
    )
  }
}

export async function updateIssueFixVersions(
  issueKey: string,
  versionIds: string[]
): Promise<boolean> {
  try {
    const response = await fetch(`/api/issues/${issueKey}/fix-versions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ versionIds })
    })
    if (!response.ok) {
      const errorText = await response.text()
      console.error(
        `Fix versions update failed: ${response.status} ${response.statusText}`,
        errorText
      )
      return false
    }
    return true
  } catch (error) {
    console.error('Error updating issue fix versions:', error)
    return false
  }
}

export async function fetchIssue(issueKey: string): Promise<JiraIssue | null> {
  try {
    const response = await fetch(`/api/issues/${issueKey}`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = (await response.json()) as JiraIssue
    setCachedData(`issue:${issueKey}`, data, 5 * 60 * 1000)
    return data
  } catch (error) {
    console.error('Error fetching issue:', error)
    return getCachedData<JiraIssue>(`issue:${issueKey}`) || null
  }
}

export async function fetchProjectComponents(
  projectKey: string
): Promise<Array<{ id: string; name: string }>> {
  try {
    const response = await fetch(`/api/projects/${projectKey}/components`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = (await response.json()) as Array<{ id: string; name: string }>
    setCachedData(`components:${projectKey}`, data, 60 * 60 * 1000)
    return data
  } catch (error) {
    console.error('Error fetching project components:', error)
    return (
      getCachedData<Array<{ id: string; name: string }>>(
        `components:${projectKey}`
      ) || []
    )
  }
}

export async function createIssueClient(params: {
  projectKey: string
  title: string
  description: string
  assigneeAccountId: string | null
  componentId: string
  issueTypeId?: string
  linkIssueKey?: string
  linkType?: string
}): Promise<{ key: string } | null> {
  try {
    const response = await fetch(`/api/issues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    })
    if (!response.ok) {
      const text = await response.text()
      console.error('Create issue failed', response.status, text)
      return null
    }
    const data = (await response.json()) as { key: string }
    return data
  } catch (error) {
    console.error('Error creating issue:', error)
    return null
  }
}

export async function fetchIssueTypes(): Promise<
  Array<{ id: string; name: string; subtask?: boolean; iconUrl?: string }>
> {
  try {
    const cacheKey = `issuetypes`
    const cached =
      getCachedData<
        Array<{ id: string; name: string; subtask?: boolean; iconUrl?: string }>
      >(cacheKey)
    if (cached) return cached
    const response = await fetch(`/api/issuetypes`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = (await response.json()) as Array<{
      id: string
      name: string
      subtask?: boolean
      iconUrl?: string
    }>
    setCachedData(cacheKey, data, 60 * 60 * 1000)
    return data
  } catch (error) {
    console.error('Error fetching issue types:', error)
    return (
      getCachedData<
        Array<{ id: string; name: string; subtask?: boolean; iconUrl?: string }>
      >('issuetypes') || []
    )
  }
}

export async function fetchIssueSuggestions(
  projectKey: string,
  query: string
): Promise<Array<{ key: string; summary: string }>> {
  try {
    if (!projectKey || (query || '').trim().length < 6) return []
    const params = new URLSearchParams({ project: projectKey, query })
    const cacheKey = `suggest:${projectKey}:${query}`
    const cached =
      getCachedData<Array<{ key: string; summary: string }>>(cacheKey)
    if (cached) return cached
    const res = await fetch(`/api/issues/picker?${params.toString()}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as Array<{ key: string; summary: string }>
    setCachedData(cacheKey, data, 60 * 1000) // short TTL 1 minute
    return data
  } catch (e) {
    console.warn('fetchIssueSuggestions error', e)
    return []
  }
}
