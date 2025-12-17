'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { IssueCard } from '@/components/issue-card'
import { FilterSidebar } from '@/components/filter-sidebar'
import { normalizeStatusName } from '@/lib/utils'
import {
  getCachedData,
  preloadIssues,
  preloadIssueData,
  searchIssuesGlobally,
  fetchProjectComponents
} from '@/lib/client-api'
import { JiraIssue } from '@/types/JiraIssue'
import { FilterOptions } from '@/types/FilterOptions'
import { BoardColumn } from '@/types/BoardColumn'
import { Loader2 } from 'lucide-react'

interface KanbanBoardProps {
  issues: JiraIssue[]
  onIssueClick?: (issue: JiraIssue) => void
  onIssueHover?: (issue: JiraIssue) => void
  filters: FilterOptions
  onFiltersChange: (filters: FilterOptions) => void
  isFilterSidebarOpen: boolean
  onToggleFilterSidebar: () => void
  searchQuery?: string
  projectKey?: string
}

export function KanbanBoard({
  issues,
  onIssueClick,
  onIssueHover,
  filters,
  onFiltersChange,
  isFilterSidebarOpen,
  onToggleFilterSidebar,
  searchQuery,
  projectKey
}: KanbanBoardProps) {
  const [globalSearchResults, setGlobalSearchResults] = useState<JiraIssue[]>(
    []
  )
  const [globalSearchStatus, setGlobalSearchStatus] = useState<
    'idle' | 'loading' | 'error' | 'done'
  >('idle')
  const [globalSearchError, setGlobalSearchError] = useState<string | null>(
    null
  )
  const [projectComponents, setProjectComponents] = useState<
    Array<{ id: string; name: string }>
  >([])
  const normalizedSearch = (searchQuery || '').trim()
  const issueMatchesSearch = useCallback((issue: JiraIssue, q: string) => {
    if (!q) return false
    const norm = (s: string) => s.toLowerCase()
    const stripHtml = (s: string) => s.replace(/<[^>]*>/g, ' ')
    const normKey = (k: string) => k.replace(/-/g, '').toLowerCase()
    const normQ = q.replace(/-/g, '')

    if (norm(issue.key).includes(q) || normKey(issue.key).includes(normQ))
      return true

    if (issue.summary && norm(issue.summary).includes(q)) return true
    if (issue.description && norm(issue.description).includes(q)) return true
    if (
      issue.descriptionHtml &&
      norm(stripHtml(issue.descriptionHtml)).includes(q)
    )
      return true

    const details = getCachedData<any>(`issueDetails:${issue.key}`)
    if (details?.comments?.length) {
      for (const c of details.comments) {
        const body = c.body || ''
        const bodyHtml = c.bodyHtml ? stripHtml(c.bodyHtml) : ''
        if (norm(body).includes(q) || norm(bodyHtml).includes(q)) return true
      }
    }

    return false
  }, [])

  useEffect(() => {
    if (!projectKey) {
      setProjectComponents([])
      return
    }

    let cancelled = false
    const cached =
      getCachedData<Array<{ id: string; name: string }>>(
        `components:${projectKey}`
      ) || []
    if (cached.length) setProjectComponents(cached)

    const load = async () => {
      try {
        const comps = await fetchProjectComponents(projectKey)
        if (!cancelled) setProjectComponents(comps || [])
      } catch (e) {
        // ignore component load errors; leave existing options in place
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [projectKey])

  const filteredIssues = useMemo(() => {
    let filtered = [...issues]

    // Apply status filter using normalized names
    if (filters.status?.length) {
      filtered = filtered.filter((issue) =>
        filters.status!.includes(normalizeStatusName(issue.status.name))
      )
    }

    // Apply priority filter
    if (filters.priority?.length) {
      filtered = filtered.filter((issue) =>
        filters.priority!.includes(issue.priority.name)
      )
    }

    // Apply assignee filter
    if (filters.assignee?.length) {
      filtered = filtered.filter((issue) => {
        // If "Unassigned" is selected and issue has no assignee, include it
        if (filters.assignee!.includes('Unassigned') && !issue.assignee) {
          return true
        }
        // If issue has an assignee and that assignee is in the filter, include it
        if (
          issue.assignee &&
          filters.assignee!.includes(issue.assignee.displayName)
        ) {
          return true
        }
        // Otherwise, exclude it
        return false
      })
    }

    // Apply issue type filter
    if (filters.issueType?.length) {
      filtered = filtered.filter((issue) =>
        filters.issueType!.includes(issue.issuetype.name)
      )
    }

    // Apply sprint filter
    if (filters.sprint?.length) {
      filtered = filtered.filter(
        (issue) => issue.sprint && filters.sprint!.includes(issue.sprint.name)
      )
    }

    // Apply release filter
    if (filters.release?.length) {
      filtered = filtered.filter((issue) => {
        // If "No Release" is selected and issue has no fix versions, include it
        if (
          filters.release!.includes('No Release') &&
          (!issue.fixVersions || issue.fixVersions.length === 0)
        ) {
          return true
        }
        // If issue has fix versions and any of them are in the filter, include it
        if (issue.fixVersions && issue.fixVersions.length > 0) {
          return issue.fixVersions.some((version) =>
            filters.release!.includes(version.name)
          )
        }
        // Otherwise, exclude it
        return false
      })
    }

    // Apply due date filters
    if (filters.dueDateFrom) {
      filtered = filtered.filter(
        (issue) =>
          issue.duedate &&
          new Date(issue.duedate) >= new Date(filters.dueDateFrom!)
      )
    }

    if (filters.dueDateTo) {
      filtered = filtered.filter(
        (issue) =>
          issue.duedate &&
          new Date(issue.duedate) <= new Date(filters.dueDateTo!)
      )
    }

    // Apply labels filter
    if (filters.labels?.length) {
      filtered = filtered.filter((issue) =>
        filters.labels!.some((label) => issue.labels.includes(label))
      )
    }

    // Apply components filter
    if (filters.components?.length) {
      filtered = filtered.filter((issue) =>
        filters.components!.some((component) =>
          issue.components.some((c) => c.name === component)
        )
      )
    }

    // Apply text search (issue key, summary, description, comments)
    const q = normalizedSearch.toLowerCase()
    if (q) {
      filtered = filtered.filter((issue) => issueMatchesSearch(issue, q))
    }

    return filtered
  }, [issues, filters, normalizedSearch, issueMatchesSearch])

  const cachedSearchMatches = useMemo(() => {
    const q = normalizedSearch.toLowerCase()
    if (!q) return []
    return issues.filter((issue) => issueMatchesSearch(issue, q))
  }, [issues, normalizedSearch, issueMatchesSearch])

  const columns: BoardColumn[] = useMemo(() => {
    const statusGroups = {
      'To Do': ['To Do', 'Open', 'New', 'Backlog'],
      'Attention Needed': ['Attention Needed'],
      Blocked: ['Blocked'],
      'In Progress': ['In Progress'],
      'Current Active Issue': ['Current Active Issue'],
      'In PR': ['In PR'],
      'In Review': ['In Review', 'Code Review'],
      'Awaiting Testing': ['Awaiting Testing'],
      'Iteration Required': ['Iteration Required'],
      'Awaiting Information': ['Awaiting Information'],
      'Under Monitoring': ['Under Monitoring'],
      'Requires Config Change': ['Requires Config Change'],
      Done: ['Done', 'Closed', 'Resolved', 'Complete'],
      'Not an Issue': ['Not an Issue']
    }

    const allColumns = Object.entries(statusGroups).map(
      ([title, statusKeys]) => ({
        id: title.toLowerCase().replace(/\s+/g, '-'),
        title,
        statusKeys,
        issues: filteredIssues.filter((issue) =>
          statusKeys.some((status) => {
            const issueNorm = normalizeStatusName(
              issue.status.name
            ).toLowerCase()
            const keyNorm = normalizeStatusName(status).toLowerCase()
            return issueNorm === keyNorm
          })
        )
      })
    )

    // Hide columns that have no issues to declutter the view
    return allColumns.filter((column) => column.issues.length > 0)
  }, [filteredIssues])

  useEffect(() => {
    if (!projectKey || !normalizedSearch || filteredIssues.length > 0) {
      setGlobalSearchResults([])
      setGlobalSearchStatus('idle')
      setGlobalSearchError(null)
      return
    }

    if (cachedSearchMatches.length > 0) {
      setGlobalSearchResults(cachedSearchMatches)
      setGlobalSearchStatus('done')
      setGlobalSearchError(null)
      return
    }

    let cancelled = false
    const run = async () => {
      setGlobalSearchStatus('loading')
      setGlobalSearchError(null)
      try {
        const results = await searchIssuesGlobally(projectKey, normalizedSearch)
        if (cancelled) return
        setGlobalSearchResults(results)
        setGlobalSearchStatus('done')
      } catch (err) {
        if (cancelled) return
        console.error('Global search failed', err)
        setGlobalSearchStatus('error')
        setGlobalSearchError('Failed to search Jira. Please try again.')
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [projectKey, normalizedSearch, filteredIssues.length, cachedSearchMatches])

  // Detect current UI version (V1/V2) from body[data-ui] and react to changes
  const [uiVersion, setUiVersion] = useState<'v1' | 'v2'>('v2')
  useEffect(() => {
    const read = () =>
      (typeof document !== 'undefined'
        ? document.body?.getAttribute('data-ui')
        : 'v2') as 'v1' | 'v2'
    setUiVersion(read() || 'v2')
    const body = document.body
    if (!body) return
    const obs = new MutationObserver(() => setUiVersion(read() || 'v2'))
    obs.observe(body, { attributes: true, attributeFilter: ['data-ui'] })
    return () => obs.disconnect()
  }, [])

  // V1 tinted background classes per column (legacy look)
  const getColumnTintClass = (columnTitle: string) => {
    switch (columnTitle) {
      case 'To Do':
        return 'border-[hsl(var(--chart-3))/30] bg-[hsl(var(--chart-3))/10]'
      case 'Attention Needed':
        return 'border-[hsl(var(--destructive))/30] bg-[hsl(var(--destructive))/10]'
      case 'Blocked':
        return 'border-[hsl(var(--destructive))/30] bg-[hsl(var(--destructive))/10]'
      case 'In Progress':
        return 'border-[hsl(var(--chart-4))/30] bg-[hsl(var(--chart-4))/10]'
      case 'Current Active Issue':
        return 'border-[hsl(var(--primary))/30] bg-[hsl(var(--primary))/10]'
      case 'In PR':
        return 'border-[hsl(var(--primary))/30] bg-[hsl(var(--primary))/10]'
      case 'In Review':
        return 'border-[hsl(var(--primary))/30] bg-[hsl(var(--primary))/10]'
      case 'Done':
        return 'border-[hsl(var(--chart-5))/30] bg-[hsl(var(--chart-5))/10]'
      case 'Awaiting Testing':
        return 'border-[hsl(var(--chart-1))/30] bg-[hsl(var(--chart-1))/10]'
      case 'Iteration Required':
        return 'border-[hsl(var(--primary))/30] bg-[hsl(var(--primary))/10]'
      case 'Awaiting Information':
        return 'border-[hsl(var(--chart-3))/30] bg-[hsl(var(--chart-3))/10]'
      case 'Under Monitoring':
        return 'border-[hsl(var(--chart-1))/30] bg-[hsl(var(--chart-1))/10]'
      case 'Not an Issue':
        return 'border-border bg-muted/20'
      case 'Requires Config Change':
        return 'border-[hsl(var(--chart-5))/30] bg-[hsl(var(--chart-5))/10]'
      default:
        return 'border-border bg-muted/20'
    }
  }

  // Return HSL token name for column accent strip in V2
  const getColumnHueToken = (columnTitle: string) => {
    switch (columnTitle) {
      case 'To Do':
        return '--chart-3'
      case 'Attention Needed':
      case 'Blocked':
        return '--destructive'
      case 'In Progress':
        return '--chart-4'
      case 'Current Active Issue':
      case 'In PR':
      case 'In Review':
      case 'Iteration Required':
        return '--primary'
      case 'Done':
      case 'Requires Config Change':
      case 'Not an Issue':
        return '--chart-5'
      case 'Awaiting Testing':
      case 'Under Monitoring':
        return '--chart-1'
      case 'Awaiting Information':
        return '--chart-3'
      default:
        return '--border'
    }
  }

  const getColumnAccentBarClass = (columnTitle: string) => {
    const token = getColumnHueToken(columnTitle)
    return `bg-[hsl(var(${token}))]`
  }

  // Best-effort: when searching, preload issue details for comment search
  useEffect(() => {
    if (!normalizedSearch || !projectKey || !issues.length) return
    // Preload details in background for current issues (cap to 200 for safety)
    const cap = Math.min(issues.length, 200)
    preloadIssues(issues, projectKey, cap)
  }, [normalizedSearch, projectKey, issues])

  // Prefetch on hover: avoid duplicate work within a session using a ref set
  const prefetchedRef = useRef<Set<string>>(new Set())
  const handleHoverPrefetch = (issue: JiraIssue) => {
    if (!projectKey) return
    const key = issue?.key
    if (!key || prefetchedRef.current.has(key)) return
    prefetchedRef.current.add(key)
    // Debounce slightly to avoid accidental brushes during fast scroll
    window.setTimeout(() => {
      void preloadIssueData(key, projectKey)
    }, 150)
  }

  const showGlobalSearch =
    Boolean(normalizedSearch) && filteredIssues.length === 0
  const hasCachedSearchMatches = cachedSearchMatches.length > 0

  return (
    <div className='bg-background flex h-full'>
      <FilterSidebar
        filters={filters}
        onFiltersChange={onFiltersChange}
        issues={issues}
        projectComponents={projectComponents}
        isOpen={isFilterSidebarOpen}
        onToggle={onToggleFilterSidebar}
      />

      <div className='flex-1 overflow-hidden p-2 sm:p-4'>
        {showGlobalSearch ? (
          <div className='mx-auto flex h-full max-w-5xl flex-col gap-3'>
            <Card className='border-dashed border-border/70'>
              <CardContent className='p-4'>
                <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                  <div className='space-y-1'>
                    <p className='text-sm font-semibold text-foreground'>
                      {hasCachedSearchMatches
                        ? `Showing cached matches for “${normalizedSearch}”`
                        : `No cached matches for “${normalizedSearch}”`}
                    </p>
                    <p className='text-sm text-muted-foreground'>
                      {hasCachedSearchMatches
                        ? 'These were already loaded and may sit outside your current filters.'
                        : 'Running a global Jira search across this project.'}
                    </p>
                  </div>
                  <Badge variant='secondary' size='compact'>
                    {hasCachedSearchMatches
                      ? 'Cached results'
                      : 'Global search'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {globalSearchStatus === 'loading' && (
              <Card>
                <CardContent className='flex items-center gap-2 p-4 text-sm text-muted-foreground'>
                  <Loader2 className='h-4 w-4 animate-spin' />
                  Searching Jira…
                </CardContent>
              </Card>
            )}

            {globalSearchStatus === 'error' && (
              <Card>
                <CardContent className='p-4 text-sm text-destructive'>
                  {globalSearchError ||
                    'Unable to complete Jira search. Please try again.'}
                </CardContent>
              </Card>
            )}

            {globalSearchStatus === 'done' &&
              globalSearchResults.length === 0 && (
                <Card>
                  <CardContent className='p-4 text-sm text-muted-foreground'>
                    No Jira issues found for “{normalizedSearch}”.
                  </CardContent>
                </Card>
              )}

            {globalSearchResults.length > 0 && (
              <div className='space-y-3'>
                {globalSearchResults.map((issue) => (
                  <IssueCard
                    key={issue.id}
                    issue={issue}
                    onClick={onIssueClick}
                    onHover={(iss) => {
                      handleHoverPrefetch(iss)
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Horizontal scrolling container */}
            <div className='h-full overflow-x-auto overflow-y-auto'>
              <div className='flex h-full gap-4 flex-row'>
                {columns.map((column) => (
                  <Card
                    key={column.id}
                    className={`flex sm:h-full w-full md:w-[320px] lg:w-[360px] xl:w-[380px] 2xl:w-[420px] min-w-full md:min-w-[320px] lg:min-w-[360px] xl:min-w-[380px] 2xl:min-w-[420px] shrink-0 flex-col ${uiVersion === 'v2' ? 'bg-card' : getColumnTintClass(column.title)}`}
                  >
                    {uiVersion === 'v2' ? (
                      <div className='flex-1 min-h-0 overflow-y-auto'>
                        {/* Sticky header with accent top strip */}
                        <div className='sticky top-0 z-10 bg-card'>
                          <div
                            className={`h-1 w-full ${getColumnAccentBarClass(column.title)}`}
                          ></div>
                          <div className='px-3 py-3 border-b border-border'>
                            <div className='flex items-center justify-between'>
                              <span className='truncate text-base font-medium'>
                                {column.title}
                              </span>
                              <Badge
                                variant='secondary'
                                size='compact'
                                className='ml-2 shrink-0'
                              >
                                {column.issues.length}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className='p-3'>
                          <div className='space-y-3'>
                            {column.issues.map((issue) => (
                              <IssueCard
                                key={issue.id}
                                issue={issue}
                                onClick={onIssueClick}
                                onHover={(iss) => {
                                  handleHoverPrefetch(iss)
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className='shrink-0 pb-3'>
                          <div className='px-4 pt-4'>
                            <div className='flex items-center justify-between'>
                              <span className='truncate text-lg'>
                                {column.title}
                              </span>
                              <Badge
                                variant='secondary'
                                size='compact'
                                className='ml-2 shrink-0'
                              >
                                {column.issues.length}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className='flex-1 overflow-y-auto p-3'>
                          <div className='space-y-3'>
                            {column.issues.map((issue) => (
                              <IssueCard
                                key={issue.id}
                                issue={issue}
                                onClick={onIssueClick}
                                onHover={(iss) => {
                                  handleHoverPrefetch(iss)
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
