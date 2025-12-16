// Simple client-side cache using localStorage with TTL
// Note: Only available in the browser. Always guard against SSR.
import { JiraUser } from '@/types/JiraUser'
import { JiraProject } from '@/types/JiraProject'
import { FilterOptions } from '@/types/FilterOptions'
import { JiraIssue } from '@/types/JiraIssue'

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
      // expired - remove and return null so callers can fetch fresh
      localStorage.removeItem(CACHE_PREFIX + key)
      return null
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

// Generic cache-first + background-refresh fetch helper to reduce repetition
async function fetchWithCache<T = any>(options: {
  url: string
  cacheKey: string
  ttlMs: number
  transform?: (data: T) => T
}): Promise<T> {
  const { url, cacheKey, ttlMs, transform } = options
  try {
    const cached = getCachedData<T>(cacheKey)
    if (cached != null) {
      // Background refresh
      ;(async () => {
        try {
          const r = await fetch(url)
          if (!r.ok) return
          let fresh = (await r.json()) as T
          if (transform) fresh = transform(fresh)
          setCachedData(cacheKey, fresh, ttlMs)
        } catch {
          // ignore background errors
        }
      })()
      return cached
    }

    // No cache -> fetch
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    let data = (await response.json()) as T
    if (transform) data = transform(data)
    setCachedData(cacheKey, data, ttlMs)
    return data
  } catch (error) {
    console.error('fetchWithCache error:', error)
    return getCachedData<T>(cacheKey) as T as T
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
  if (!projectKey?.trim()) return []
  const cacheKey = `projectUsers:${projectKey}`
  try {
    return await fetchWithCache<JiraUser[]>({
      url: `/api/projects/${projectKey}/users`,
      cacheKey,
      ttlMs: 60 * 60 * 1000
    })
  } catch (error) {
    console.error('Error fetching project users:', error)
    return getCachedData<JiraUser[]>(cacheKey) || []
  }
}

export async function fetchProjectSprints(
  projectKey: string
): Promise<Array<{ id: string; name: string; state: string }>> {
  if (!projectKey?.trim()) return []
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

export interface UploadedAttachment {
  id: string
  filename: string
  mimeType?: string
  size?: number
}

export async function uploadIssueAttachments(
  issueKey: string,
  files: File[]
): Promise<UploadedAttachment[] | null> {
  try {
    const formData = new FormData()
    for (const file of files) {
      formData.append('file', file, file.name)
    }

    const response = await fetch(`/api/issues/${issueKey}/attachments`, {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(
        `Attachment upload failed: ${response.status} ${response.statusText}`,
        errorText
      )
      return null
    }

    const data = await response.json()

    // Handle both plain arrays and wrapped responses
    if (Array.isArray(data)) {
      return data as UploadedAttachment[]
    }

    if (data?.attachments && Array.isArray(data.attachments)) {
      return data.attachments as UploadedAttachment[]
    }

    console.error('Unexpected attachment upload response shape:', data)
    return null
  } catch (error) {
    console.error('Error uploading attachments:', error)
    return null
  }
}

export async function deleteIssueAttachment(
  issueKey: string,
  attachmentId: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `/api/issues/${issueKey}/attachments/${attachmentId}`,
      {
        method: 'DELETE'
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error(
        `Attachment delete failed: ${response.status} ${response.statusText}`,
        errorText
      )
      return false
    }

    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`${CACHE_PREFIX}issueDetails:${issueKey}`)
      }
    } catch {
      // ignore cache cleanup errors
    }

    return true
  } catch (error) {
    console.error('Error deleting attachment:', error)
    return false
  }
}

export async function updateIssuePriority(
  issueKey: string,
  priority: string
): Promise<boolean> {
  try {
    const response = await fetch(`/api/issues/${issueKey}/priority`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(
        `Priority update failed: ${response.status} ${response.statusText}`,
        errorText
      )
      return false
    }

    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`${CACHE_PREFIX}issue:${issueKey}`)
        localStorage.removeItem(`${CACHE_PREFIX}issueDetails:${issueKey}`)
      }
    } catch {
      // ignore cache cleanup errors
    }

    return true
  } catch (error) {
    console.error('Error updating priority:', error)
    return false
  }
}

export async function updateIssueComponents(
  issueKey: string,
  componentId: string | null
): Promise<boolean> {
  try {
    const response = await fetch(`/api/issues/${issueKey}/components`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ componentId })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(
        `Component update failed: ${response.status} ${response.statusText}`,
        errorText
      )
      return false
    }

    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`${CACHE_PREFIX}issue:${issueKey}`)
        localStorage.removeItem(`${CACHE_PREFIX}issueDetails:${issueKey}`)
      }
    } catch {
      // ignore cache cleanup errors
    }

    return true
  } catch (error) {
    console.error('Error updating components:', error)
    return false
  }
}

export async function updateIssueSprint(
  issueKey: string,
  sprintId: string | null | undefined
): Promise<boolean> {
  try {
    const response = await fetch(`/api/issues/${issueKey}/sprint`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sprintId })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(
        `Sprint update failed: ${response.status} ${response.statusText}`,
        errorText
      )
      return false
    }

    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`${CACHE_PREFIX}issue:${issueKey}`)
        localStorage.removeItem(`${CACHE_PREFIX}issueDetails:${issueKey}`)
      }
    } catch {
      // ignore cache cleanup errors
    }

    return true
  } catch (error) {
    console.error('Error updating sprint:', error)
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

export async function searchIssuesGlobally(
  projectKey: string,
  query: string
): Promise<JiraIssue[]> {
  const trimmed = (query || '').trim()
  if (!trimmed) return []

  const cacheKey = `globalSearch:${projectKey || 'all'}:${trimmed.toLowerCase()}`
  const cached = getCachedData<JiraIssue[]>(cacheKey)
  if (cached) return cached

  try {
    const params = new URLSearchParams()
    if (projectKey) params.set('project', projectKey)
    params.set('query', trimmed)

    const response = await fetch(`/api/issues/search?${params.toString()}`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = (await response.json()) as JiraIssue[]
    setCachedData(cacheKey, data, 5 * 60 * 1000)
    return data
  } catch (error) {
    console.error('Error performing global issue search:', error)
    return getCachedData<JiraIssue[]>(cacheKey) || []
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
  if (!projectKey?.trim()) return []
  const cacheKey = `versions:${projectKey}`
  type Version = {
    id: string
    name: string
    released: boolean
    archived?: boolean
  }
  try {
    return await fetchWithCache<Version[]>({
      url: `/api/projects/${projectKey}/versions`,
      cacheKey,
      ttlMs: 15 * 60 * 1000
    })
  } catch (error) {
    console.error('Error fetching project versions:', error)
    return getCachedData<Version[]>(cacheKey) || []
  }
}

export async function updateIssueDescription(
  issueKey: string,
  description: string
): Promise<boolean> {
  try {
    const response = await fetch(`/api/issues/${issueKey}/description`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description })
    })
    return response.ok
  } catch (error) {
    console.error('Error updating issue description:', error)
    return false
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
  if (!projectKey?.trim()) return []
  const cacheKey = `components:${projectKey}`
  try {
    return await fetchWithCache<Array<{ id: string; name: string }>>({
      url: `/api/projects/${projectKey}/components`,
      cacheKey,
      ttlMs: 60 * 60 * 1000
    })
  } catch (error) {
    console.error('Error fetching project components:', error)
    return getCachedData<Array<{ id: string; name: string }>>(cacheKey) || []
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
  versionIds?: string[]
  sprintId?: string
  priority?: string
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

export async function fetchIssueTypes(
  projectKey: string
): Promise<
  Array<{ id: string; name: string; subtask?: boolean; iconUrl?: string }>
> {
  if (!projectKey?.trim()) return []
  const cacheKey = `issuetypes:${projectKey}`
  type IssueType = {
    id: string
    name: string
    subtask?: boolean
    iconUrl?: string
  }
  const transform = (list: IssueType[]) =>
    (list || []).filter(Boolean).length
      ? // distinct by normalized name
        (list || []).filter(Boolean).reduce<IssueType[]>((acc, cur) => {
          const key = (cur.name || '').trim().toLowerCase()
          if (!key) return acc
          if (acc.find((x) => (x.name || '').trim().toLowerCase() === key))
            return acc
          acc.push(cur)
          return acc
        }, [])
      : []
  try {
    return await fetchWithCache<IssueType[]>({
      url: `/api/issuetypes?project=${encodeURIComponent(projectKey)}`,
      cacheKey,
      ttlMs: 60 * 60 * 1000,
      transform
    })
  } catch (error) {
    console.error('Error fetching issue types:', error)
    return getCachedData<IssueType[]>(cacheKey) || []
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

// Prefetch dropdown lookups so the user never waits
export function prefetchProjectLookups(projectKey: string) {
  if (!projectKey || typeof window === 'undefined') return
  // Kick all off; cache-first fetchers will return fast and revalidate
  void fetchProjectUsers(projectKey)
  void fetchProjectComponents(projectKey)
  void fetchIssueTypes(projectKey)
  void fetchProjectVersions(projectKey)
}

export async function linkIssueClient(params: {
  issueKey: string
  toIssueKey: string
  linkType?: string
}): Promise<boolean> {
  try {
    const { issueKey, toIssueKey, linkType } = params
    const res = await fetch(
      `/api/issues/${encodeURIComponent(issueKey)}/link`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toIssueKey, linkType: linkType || 'Relates' })
      }
    )
    if (!res.ok) return false
    return true
  } catch (e) {
    console.error('linkIssueClient error', e)
    return false
  }
}
