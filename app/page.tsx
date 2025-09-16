'use client'

import { useState, useEffect, useRef } from 'react'
import { KanbanBoard } from '@/components/kanban-board'
import { IssueEditModal } from '@/components/issue-edit-modal'
import { SprintSelector } from '@/components/sprint-selector'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import {
  RefreshCw,
  Loader2,
  AlertCircle,
  Calendar,
  Archive
} from 'lucide-react'
import {
  fetchIssues,
  fetchProjects,
  fetchCurrentUser,
  fetchProjectSprints,
  getCachedData,
  preloadIssueData,
  preloadIssues,
  fetchIssueDetails,
  prefetchProjectLookups
} from '@/lib/client-api'
import type {
  JiraIssue,
  JiraProject,
  JiraUser,
  FilterOptions
} from '@/types/jira'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent } from '@/components/ui/card'
import { KeyboardKey } from '@/components/ui/keyboard-key'
import { Input } from '@/components/ui/input'
import { LoadingTracker } from '@/components/loading-tracker'
import type { TrackerStatus } from '@/components/loading-tracker'
import { NewIssueModal } from '@/components/new-issue-modal'
import { isEditableTarget } from '@/lib/utils'
import { STORAGE_KEYS } from '@/lib/constants'

interface Sprint {
  id: string
  name: string
  state: string
}

export default function HomePage() {
  const [issues, setIssues] = useState<JiraIssue[]>([])
  const [newIssueOpen, setNewIssueOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const [projects, setProjects] = useState<JiraProject[]>([])
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [currentUser, setCurrentUser] = useState<JiraUser | null>(null)
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [selectedSprints, setSelectedSprints] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEYS.SELECTED_SPRINTS)
        if (saved) {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed)) return parsed as string[]
        }
      } catch (e) {
        // ignore parse errors
      }
    }
    return []
  })
  const [filters, setFilters] = useState<FilterOptions>(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedFilters = localStorage.getItem(STORAGE_KEYS.FILTERS)
        if (savedFilters) {
          const parsed = JSON.parse(savedFilters)
          // Ensure it's an object
          if (parsed && typeof parsed === 'object')
            return parsed as FilterOptions
        }
      } catch (e) {
        // ignore parse errors
      }
    }
    return {}
  })
  const [isFilterSidebarOpen, setIsFilterSidebarOpen] = useState<boolean>(
    () => {
      if (typeof window !== 'undefined') {
        try {
          const saved = localStorage.getItem(STORAGE_KEYS.FILTER_SIDEBAR_OPEN)
          if (saved != null) return JSON.parse(saved)
        } catch (e) {
          // ignore parse errors
        }
      }
      return false
    }
  )
  const [loading, setLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [selectedIssue, setSelectedIssue] = useState<JiraIssue | null>(null)

  // Keyboard shortcut: 'c' to open Create (New Issue) modal
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      if (isEditableTarget(e.target)) return
      if (e.key.toLowerCase() === 'c') {
        e.preventDefault()
        setNewIssueOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Loading tracker state
  const [trackerVisible, setTrackerVisible] = useState(false)
  const [trackerCurrent, setTrackerCurrent] = useState(0)
  const [trackerTotal, setTrackerTotal] = useState(0)
  const [trackerMessage, setTrackerMessage] = useState<string>('')
  const [trackerStatus, setTrackerStatus] = useState<TrackerStatus>('loading')
  // Delay timer so fast operations (<1s) never show the tracker
  const TRACKER_SHOW_DELAY_MS = 1000
  const trackerDelayTimeoutRef = useRef<number | null>(null)

  const openTracker = (total: number, message: string) => {
    // Clear any pending timers and hide immediately
    if (trackerDelayTimeoutRef.current != null) {
      clearTimeout(trackerDelayTimeoutRef.current)
      trackerDelayTimeoutRef.current = null
    }
    setTrackerVisible(false)

    setTrackerTotal(total)
    setTrackerCurrent(0)
    setTrackerMessage(message)
    setTrackerStatus('loading')

    // Only show after delay to prevent flicker
    trackerDelayTimeoutRef.current = window.setTimeout(() => {
      setTrackerVisible(true)
      trackerDelayTimeoutRef.current = null
    }, TRACKER_SHOW_DELAY_MS)
  }
  const advanceTracker = (message?: string) => {
    setTrackerCurrent((c) => Math.min(trackerTotal, c + 1))
    if (message) setTrackerMessage(message)
  }
  const finishTracker = (successMessage: string) => {
    setTrackerCurrent(trackerTotal)
    setTrackerMessage(successMessage)
    setTrackerStatus('success')
    // If not yet visible (i.e., finished before delay), cancel showing entirely
    if (!trackerVisible && trackerDelayTimeoutRef.current != null) {
      clearTimeout(trackerDelayTimeoutRef.current)
      trackerDelayTimeoutRef.current = null
      // keep it hidden; do not flash success
    }
  }
  const failTracker = (errorMessage: string) => {
    setTrackerMessage(errorMessage)
    setTrackerStatus('error')
    // If not yet visible (i.e., finished before delay), cancel showing entirely
    if (!trackerVisible && trackerDelayTimeoutRef.current != null) {
      clearTimeout(trackerDelayTimeoutRef.current)
      trackerDelayTimeoutRef.current = null
      // keep it hidden; do not flash error
    }
  }

  // Clear pending show-delay timer on unmount to avoid leaks
  useEffect(() => {
    return () => {
      if (trackerDelayTimeoutRef.current != null) {
        clearTimeout(trackerDelayTimeoutRef.current)
        trackerDelayTimeoutRef.current = null
      }
    }
  }, [])

  // Load all saved states and cached data from localStorage on mount
  useEffect(() => {
    const savedProject = localStorage.getItem(STORAGE_KEYS.SELECTED_PROJECT)
    const savedSprints = localStorage.getItem(STORAGE_KEYS.SELECTED_SPRINTS)
    const savedFilters = localStorage.getItem(STORAGE_KEYS.FILTERS)
    const savedSidebarOpen = localStorage.getItem(
      STORAGE_KEYS.FILTER_SIDEBAR_OPEN
    )

    if (savedProject) {
      setSelectedProject(savedProject)
    }

    if (savedSprints) {
      try {
        setSelectedSprints(JSON.parse(savedSprints))
      } catch (error) {
        console.error('Error parsing saved sprints:', error)
      }
    }

    if (savedFilters) {
      try {
        setFilters(JSON.parse(savedFilters))
      } catch (error) {
        console.error('Error parsing saved filters:', error)
      }
    }

    if (savedSidebarOpen) {
      try {
        setIsFilterSidebarOpen(JSON.parse(savedSidebarOpen))
      } catch (error) {
        console.error('Error parsing saved sidebar state:', error)
      }
    }

    // Hydrate from cache immediately
    const cachedProjects = getCachedData<JiraProject[]>('projects') || []
    if (cachedProjects.length) setProjects(cachedProjects)

    const cachedUser = getCachedData<JiraUser>('currentUser')
    if (cachedUser) setCurrentUser(cachedUser)

    if (savedProject) {
      const cachedSprints =
        getCachedData<Sprint[]>(`sprints:${savedProject}`) || []
      if (cachedSprints.length) setSprints(cachedSprints)

      // If we have saved sprints, hydrate base (unfiltered) issues cache too
      try {
        const parsedSprints: string[] = savedSprints
          ? JSON.parse(savedSprints)
          : []
        if (parsedSprints.length) {
          const base: FilterOptions = { sprint: parsedSprints }
          const params = new URLSearchParams({ project: savedProject })
          if (base.sprint?.length)
            params.append('sprint', [...base.sprint].sort().join(','))
          const cacheKey = `issues:${savedProject}:${params.toString()}`
          const cachedIssues = getCachedData<JiraIssue[]>(cacheKey) || []
          if (cachedIssues.length) setIssues(cachedIssues)
        }
      } catch (e) {
        // ignore
      }
    }
  }, [])

  // Save to localStorage when project changes
  useEffect(() => {
    if (selectedProject) {
      localStorage.setItem(STORAGE_KEYS.SELECTED_PROJECT, selectedProject)
    }
  }, [selectedProject])

  // Save to localStorage when sprints change
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.SELECTED_SPRINTS,
      JSON.stringify(selectedSprints)
    )
  }, [selectedSprints])

  // Add keyboard shortcut for opening current user's active issue
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() === 'c' &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey &&
        !event.shiftKey
      ) {
        const activeElement = document.activeElement
        const isInputField =
          activeElement instanceof HTMLInputElement ||
          activeElement instanceof HTMLTextAreaElement ||
          activeElement instanceof HTMLSelectElement ||
          (activeElement as HTMLElement | null)?.getAttribute?.(
            'contenteditable'
          ) === 'true'

        if (!isInputField && currentUser) {
          event.preventDefault()

          const currentActiveIssue = issues.find(
            (issue) =>
              issue.assignee?.displayName === currentUser.displayName &&
              issue.status.name.toLowerCase().includes('current active issue')
          )

          if (currentActiveIssue) {
            setSelectedIssue(currentActiveIssue)
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [issues, currentUser])

  // Add Cmd/Ctrl+K shortcut to focus search input
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      const isMod =
        (event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey
      if (isMod && key === 'k') {
        const activeElement = document.activeElement
        const isInputField =
          activeElement instanceof HTMLInputElement ||
          activeElement instanceof HTMLTextAreaElement ||
          activeElement instanceof HTMLSelectElement ||
          (activeElement as HTMLElement | null)?.getAttribute?.(
            'contenteditable'
          ) === 'true'
        // If we're already in an input/text area, let the native behavior happen (e.g., browser search fields)
        if (isInputField && activeElement === searchInputRef.current) return
        event.preventDefault()
        searchInputRef.current?.focus()
        // Select existing value to allow quick overwrite
        if (searchInputRef.current) {
          searchInputRef.current.select?.()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Load projects and user on mount
  useEffect(() => {
    const initializeApp = async () => {
      try {
        setLoading(true)
        setLoadingMessage('Loading projects...')
        setError(null)

        openTracker(2, 'Loading projects...')
        const projectsData = await fetchProjects()
        setProjects(projectsData)
        advanceTracker('Loading user information...')

        const user = await fetchCurrentUser()
        setCurrentUser(user)
        finishTracker('App data loaded')

        // If we have a saved project, set it (sprints will be loaded by the selectedProject effect)
        const savedProject = localStorage.getItem(STORAGE_KEYS.SELECTED_PROJECT)
        const projectToLoad = savedProject || 'MP5'
        const project = projectsData.find((p) => p.key === projectToLoad)

        if (project) {
          // Avoid redundant state churn if already set by hydration effect
          setSelectedProject((prev) => prev || project.key)
          // Do not call loadSprintsForProject here; let the selectedProject effect handle it
        }
      } catch (err) {
        setError(
          'Failed to load data from Jira. Please check your configuration.'
        )
        console.error('Error initializing app:', err)
        failTracker('Failed to load initial data')
      } finally {
        setLoading(false)
        setLoadingMessage('')
      }
    }

    initializeApp()
  }, [])

  // Load sprints when project changes and prefetch lookup dropdown data
  useEffect(() => {
    if (selectedProject) {
      // Warm caches for dropdowns so UI never waits
      prefetchProjectLookups(selectedProject)
      loadSprintsForProject(selectedProject)
    }
  }, [selectedProject])

  // Auto-load issues when sprints are restored from localStorage (only once)
  const hasAutoLoadedIssues = useRef(false)
  useEffect(() => {
    if (hasAutoLoadedIssues.current) return
    const savedSprints = localStorage.getItem(STORAGE_KEYS.SELECTED_SPRINTS)
    if (savedSprints && selectedProject && sprints.length > 0) {
      try {
        const parsedSprints = JSON.parse(savedSprints)
        if (Array.isArray(parsedSprints) && parsedSprints.length > 0) {
          hasAutoLoadedIssues.current = true
          // Auto-load issues for saved sprints
          loadIssues(parsedSprints)
        }
      } catch (error) {
        console.error('Error parsing saved sprints for auto-load:', error)
      }
    }
  }, [selectedProject, sprints])

  const loadSprintsForProject = async (projectKey: string) => {
    try {
      // Hydrate from cache immediately
      const cached = getCachedData<Sprint[]>(`sprints:${projectKey}`) || []
      if (cached.length) setSprints(cached)

      setLoadingMessage('Loading sprints...')
      console.log(`Loading sprints for project: ${projectKey}`)

      openTracker(1, 'Loading sprints...')
      const sprintsData = await fetchProjectSprints(projectKey)
      console.log(
        `Loaded ${sprintsData.length} sprints for project ${projectKey}:`,
        sprintsData
      )

      setSprints(sprintsData)
      finishTracker(
        `Loaded ${sprintsData.length} sprint${sprintsData.length === 1 ? '' : 's'}`
      )

      // Clear selected sprints if they don't exist in the new project
      const validSprints = selectedSprints.filter((sprintName) =>
        sprintsData.some((sprint) => sprint.name === sprintName)
      )
      if (validSprints.length !== selectedSprints.length) {
        console.log(
          `Cleared invalid sprints. Valid: ${validSprints.length}, Previous: ${selectedSprints.length}`
        )
        setSelectedSprints(validSprints)
      }
    } catch (err) {
      console.error('Error loading sprints:', err)
      setError(
        `Failed to load sprints for project ${projectKey}. Check console for details.`
      )
      failTracker('Failed to load sprints')
    }
  }

  const loadIssues = async (sprintsToLoad?: string[]) => {
    const sprintsForQuery = sprintsToLoad || selectedSprints

    if (!selectedProject || sprintsForQuery.length === 0) {
      setIssues([])
      return
    }

    try {
      setLoading(true)
      setLoadingMessage(
        `Loading issues for ${sprintsForQuery.length} sprint(s)...`
      )
      setError(null)

      openTracker(
        1,
        `Loading issues for ${sprintsForQuery.length} sprint(s)...`
      )

      // Hydrate from cache immediately while fetching
      try {
        const params = new URLSearchParams({ project: selectedProject })
        // Use sprint-only key for base issues
        if (sprintsForQuery.length)
          params.append('sprint', [...sprintsForQuery].sort().join(','))
        const cacheKey = `issues:${selectedProject}:${params.toString()}`
        const cachedIssues = getCachedData<JiraIssue[]>(cacheKey)
        if (cachedIssues && cachedIssues.length) setIssues(cachedIssues)
      } catch {}

      // Fetch base (unfiltered) issues for the selected sprint(s)
      const baseIssues = await fetchIssues(selectedProject, {
        sprint: sprintsForQuery
      })
      setIssues(baseIssues)
      // Notify user when data loads successfully via custom tracker
      finishTracker(
        `Loaded ${baseIssues.length} issue${baseIssues.length === 1 ? '' : 's'}`
      )
    } catch (err) {
      setError('Failed to load issues from Jira.')
      // Do not clear here, we may already be showing cached data
      console.error('Error loading issues:', err)
      failTracker('Failed to load issues from Jira')
    } finally {
      setLoading(false)
      setLoadingMessage('')
    }
  }

  const handleProjectChange = (projectKey: string) => {
    setSelectedProject(projectKey)
    setSelectedSprints([])
    setIssues([])
    // Clear filters when changing projects
    setFilters({})
    localStorage.removeItem(STORAGE_KEYS.FILTERS)
  }

  const handleSprintChange = (sprints: string[]) => {
    setSelectedSprints(sprints)
    // Don't auto-load issues, wait for user to click Load
  }

  const handleFiltersChange = (newFilters: FilterOptions) => {
    setFilters(newFilters)
    // Filters are automatically saved to localStorage in FilterSidebar component
  }

  const handleLoadIssues = () => {
    loadIssues()
  }

  const handleIssueClick = (issue: JiraIssue) => {
    setSelectedIssue(issue)
  }

  const handleIssueHover = (issue: JiraIssue) => {
    if (!selectedProject) return
    // Preload best-effort on hover/focus
    void preloadIssueData(issue.key, selectedProject)
  }

  const handleIssueUpdate = async () => {
    if (selectedProject && selectedSprints.length > 0) {
      // Refresh base (unfiltered) issues for options and board filtering
      const baseIssues = await fetchIssues(selectedProject, {
        sprint: selectedSprints
      })
      setIssues(baseIssues)

      // Also refresh the selected issue's details (comments and history)
      if (selectedIssue) {
        try {
          await fetchIssueDetails(selectedIssue.key)
        } catch (e) {
          // Best-effort: ignore errors here to avoid breaking UI refresh
          console.warn('Failed to refresh issue details during update:', e)
        }
      }
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/jira/logout', { method: 'POST' })
    } catch (e) {
      // ignore
    } finally {
      window.location.href = '/login'
    }
  }

  const currentActiveIssue = currentUser
    ? issues.find(
        (issue) =>
          issue.assignee?.displayName === currentUser.displayName &&
          issue.status.name.toLowerCase().includes('current active issue')
      )
    : null

  const canLoadIssues = selectedProject && selectedSprints.length > 0

  // Preload in background when issues list changes
  useEffect(() => {
    if (!selectedProject || issues.length === 0) return
    // Preload current active issue first if present
    if (currentActiveIssue) {
      void preloadIssueData(currentActiveIssue.key, selectedProject)
    }
    // Then preload first N visible issues
    preloadIssues(issues, selectedProject, 20)
  }, [issues, selectedProject, currentActiveIssue])

  // Calculate sprint statistics
  const sprintStats = sprints.reduce(
    (acc, sprint) => {
      const state = sprint.state.toLowerCase()
      acc[state] = (acc[state] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const activeFutureSprints =
    (sprintStats.active || 0) + (sprintStats.future || 0)
  const closedSprints = sprintStats.closed || 0

  // Count active filters
  const activeFiltersCount = Object.entries(filters).reduce(
    (count, [key, value]) => {
      if (key === 'sprint') return count // Don't count sprint filter as it's handled separately
      if (Array.isArray(value)) {
        return count + value.length
      }
      if (value) {
        return count + 1
      }
      return count
    },
    0
  )

  return (
    <div className='bg-background h-screen w-full flex flex-col overflow-hidden'>
      <div className='bg-background border-border space-y-4 border-b p-4'>
        {/* Header Row */}
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <div className='flex items-center gap-4'>
            <h1 className='text-foreground text-2xl font-bold'>
              Project Board
            </h1>
            {selectedProject && (
              <Badge variant='outline' className='text-sm font-medium'>
                {selectedProject}
              </Badge>
            )}
            {sprints.length > 0 && (
              <div className='flex items-center gap-2 text-sm'>
                <Badge
                  variant='secondary'
                  className='bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-3 py-1'
                >
                  {activeFutureSprints} active/future
                </Badge>
                {closedSprints > 0 && (
                  <Badge
                    variant='secondary'
                    className='bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 px-3 py-1'
                  >
                    <Archive className='mr-1 h-3 w-3' />
                    {closedSprints} closed
                  </Badge>
                )}
              </div>
            )}
            {activeFiltersCount > 0 && (
              <Badge
                variant='outline'
                className='border-blue-200 bg-blue-50 text-blue-700'
              >
                {activeFiltersCount} filter{activeFiltersCount !== 1 ? 's' : ''}{' '}
                active
              </Badge>
            )}
            {currentUser && (
              <div className='flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400'>
                <span>Welcome, {currentUser.displayName}</span>
                {currentActiveIssue && (
                  <Badge
                    variant='outline'
                    className='cursor-pointer'
                    onClick={() => setSelectedIssue(currentActiveIssue)}
                  >
                    Active: {currentActiveIssue.key}
                    <KeyboardKey size='xs' className='ml-1'>
                      C
                    </KeyboardKey>
                  </Badge>
                )}
              </div>
            )}
          </div>
          <div className='flex flex-wrap items-center gap-2 sm:gap-4 w-full sm:w-auto'>
            <div className='w-full sm:w-[280px]'>
              <Input
                ref={searchInputRef}
                type='text'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder='Search key, title, description, comments'
                aria-label='Search issues'
              />
            </div>
            <ThemeToggle />
            <Badge variant='outline'>{issues.length} issues loaded</Badge>
            <Button
              size='sm'
              onClick={() => setNewIssueOpen(true)}
              className='whitespace-nowrap cursor-pointer'
              disabled={!selectedProject}
            >
              New Issue
            </Button>
            <Button
              variant='outline'
              size='sm'
              onClick={handleLogout}
              className='whitespace-nowrap cursor-pointer'
            >
              Logout
            </Button>
          </div>
        </div>

        {/* Controls Row */}
        <Card className='bg-muted/30'>
          <CardContent className='p-4'>
            <div className='flex flex-wrap items-center gap-6'>
              {/* Project Selection */}
              {projects.length > 0 && (
                <div className='flex items-center gap-2'>
                  <Label
                    htmlFor='project-select'
                    className='text-sm font-medium whitespace-nowrap'
                  >
                    1. Project:
                  </Label>
                  <div className='min-w-0 max-w-full'>
                    <select
                      id='project-select'
                      className='border-input bg-background text-foreground focus:ring-ring w-full sm:w-auto sm:max-w-[50vw] md:max-w-[320px] lg:max-w-[420px] truncate rounded border px-3 py-2 text-sm focus:ring-2 focus:outline-hidden'
                      value={selectedProject}
                      onChange={(e) => handleProjectChange(e.target.value)}
                      disabled={loading}
                    >
                      <option value=''>Select a project</option>
                      {projects.map((project) => (
                        <option key={project.key} value={project.key}>
                          {project.name} ({project.key})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Sprint Selection */}
              {selectedProject && (
                <div className='flex min-w-0 flex-1 items-center gap-2'>
                  <Label className='text-sm font-medium whitespace-nowrap'>
                    2. Sprint(s):
                  </Label>
                  <SprintSelector
                    sprints={sprints}
                    selectedSprints={selectedSprints}
                    onSprintChange={handleSprintChange}
                    disabled={loading}
                  />
                </div>
              )}

              {/* Load Button */}
              {selectedProject && (
                <Button
                  onClick={handleLoadIssues}
                  size='default'
                  disabled={loading || !canLoadIssues}
                  className='whitespace-nowrap w-full sm:w-[150px] justify-center'
                >
                  {loading ? (
                    <span className='inline-flex items-center gap-2 cursor-pointer'>
                      <Loader2 className='h-4 w-4 animate-spin' />
                      Loading...
                    </span>
                  ) : (
                    <span className='inline-flex items-center gap-2 cursor-pointer'>
                      <RefreshCw className='h-4 w-4' />
                      3. Load Issues
                    </span>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Sprint selection requirement */}
        {selectedProject &&
          selectedSprints.length === 0 &&
          !loading &&
          sprints.length > 0 && (
            <Alert>
              <Calendar className='h-4 w-4' />
              <AlertDescription>
                <strong>Step 2:</strong> Please select at least one sprint from
                the dropdown above to load issues.
                {activeFutureSprints > 0 && (
                  <span className='mt-1 block text-sm'>
                    💡 <strong>Tip:</strong> By default, only active and future
                    sprints are shown. Use the "Show closed" checkbox to see
                    historical sprints.
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

        {/* No sprints found */}
        {selectedProject && sprints.length === 0 && !loading && (
          <Alert>
            <AlertCircle className='h-4 w-4' />
            <AlertDescription>
              No sprints found for project <strong>{selectedProject}</strong>.
              This project might not have any sprints configured or you might
              not have access to view them.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant='destructive'>
            <AlertCircle className='h-4 w-4' />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>

      <IssueEditModal
        issue={selectedIssue}
        projectKey={selectedProject}
        isOpen={!!selectedIssue}
        onClose={() => setSelectedIssue(null)}
        onUpdate={handleIssueUpdate}
      />

      <NewIssueModal
        projectKey={selectedProject}
        isOpen={newIssueOpen}
        onClose={() => setNewIssueOpen(false)}
        onCreated={async (_key) => {
          // Refresh issues after creating a new one
          await loadIssues()
        }}
      />

      <div className='flex-1 min-h-0 overflow-hidden'>
        <div className='h-full overflow-auto'>
          <KanbanBoard
            issues={issues}
            onIssueClick={handleIssueClick}
            onIssueHover={handleIssueHover}
            filters={filters}
            onFiltersChange={handleFiltersChange}
            isFilterSidebarOpen={isFilterSidebarOpen}
            onToggleFilterSidebar={() =>
              setIsFilterSidebarOpen(!isFilterSidebarOpen)
            }
            searchQuery={searchQuery}
            projectKey={selectedProject}
          />
        </div>
      </div>

      <LoadingTracker
        visible={trackerVisible}
        current={trackerCurrent}
        total={trackerTotal}
        message={trackerMessage}
        status={trackerStatus}
        onClose={() => setTrackerVisible(false)}
      />
    </div>
  )
}
