import type {
  JiraIssue,
  JiraProject,
  JiraUser,
  FilterOptions
} from '@/types/jira'

export async function fetchCurrentUser(): Promise<JiraUser | null> {
  try {
    const response = await fetch('/api/user')
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Error fetching current user:', error)
    return null
  }
}

export async function fetchProjects(): Promise<JiraProject[]> {
  try {
    const response = await fetch('/api/projects')
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Error fetching projects:', error)
    return []
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
    return await response.json()
  } catch (error) {
    console.error('Error fetching project users:', error)
    return []
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
    return await response.json()
  } catch (error) {
    console.error('Error fetching project sprints:', error)
    return []
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
    return await response.json()
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

export async function fetchIssues(
  projectKey: string,
  filters?: FilterOptions
): Promise<JiraIssue[]> {
  try {
    const params = new URLSearchParams({ project: projectKey })

    // Add filters to query parameters
    if (filters?.status?.length) {
      params.append('status', filters.status.join(','))
    }
    if (filters?.priority?.length) {
      params.append('priority', filters.priority.join(','))
    }
    if (filters?.assignee?.length) {
      // Handle "Unassigned" specially - convert to a special token
      const assigneeFilter = filters.assignee.map((assignee) =>
        assignee === 'Unassigned' ? 'UNASSIGNED' : assignee
      )
      params.append('assignee', assigneeFilter.join(','))
    }
    if (filters?.issueType?.length) {
      params.append('issueType', filters.issueType.join(','))
    }
    if (filters?.labels?.length) {
      params.append('labels', filters.labels.join(','))
    }
    if (filters?.components?.length) {
      params.append('components', filters.components.join(','))
    }
    if (filters?.sprint?.length) {
      params.append('sprint', filters.sprint.join(','))
    }
    if (filters?.release?.length) {
      params.append('release', filters.release.join(','))
    }
    if (filters?.dueDateFrom) {
      params.append('dueDateFrom', filters.dueDateFrom)
    }
    if (filters?.dueDateTo) {
      params.append('dueDateTo', filters.dueDateTo)
    }

    const response = await fetch(`/api/issues?${params.toString()}`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Error fetching issues:', error)
    return []
  }
}

export async function fetchIssueDetails(issueKey: string) {
  try {
    const response = await fetch(`/api/issues/${issueKey}/details`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Error fetching issue details:', error)
    return { attachments: [], comments: [], changelog: [] }
  }
}
