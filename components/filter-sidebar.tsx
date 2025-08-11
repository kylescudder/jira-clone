'use client'

import { useState, useEffect } from 'react'
import { CalendarDays, Filter, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import { normalizeStatusName } from '@/lib/utils'
import type { FilterOptions, JiraIssue } from '@/types/jira'

interface FilterSidebarProps {
  filters: FilterOptions
  onFiltersChange: (filters: FilterOptions) => void
  issues: JiraIssue[]
  isOpen: boolean
  onToggle: () => void
}

const STORAGE_KEYS = {
  FILTERS: 'jira-clone-filters',
  FILTER_SECTIONS: 'jira-clone-filter-sections',
  FILTER_SIDEBAR_OPEN: 'jira-clone-filter-sidebar-open'
}

export function FilterSidebar({
  filters,
  onFiltersChange,
  issues,
  isOpen,
  onToggle
}: FilterSidebarProps) {
  const [openSections, setOpenSections] = useState({
    status: true,
    priority: true,
    assignee: true,
    issueType: true,
    sprint: false,
    release: false,
    dueDate: false,
    labels: false,
    components: false
  })

  // Load filter section states from localStorage on mount
  useEffect(() => {
    const savedSections = localStorage.getItem(STORAGE_KEYS.FILTER_SECTIONS)
    if (savedSections) {
      try {
        setOpenSections(JSON.parse(savedSections))
      } catch (error) {
        console.error('Error parsing saved filter sections:', error)
      }
    }
  }, [])

  // Save filter section states to localStorage when they change
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.FILTER_SECTIONS,
      JSON.stringify(openSections)
    )
  }, [openSections])

  // Save sidebar open state to localStorage
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.FILTER_SIDEBAR_OPEN,
      JSON.stringify(isOpen)
    )
  }, [isOpen])

  // Save filters to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.FILTERS, JSON.stringify(filters))
  }, [filters])

  // Add keyboard shortcut for toggling filter sidebar
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if 'F' key is pressed (without any modifiers like Ctrl, Alt, etc.)
      if (
        event.key.toLowerCase() === 'f' &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey &&
        !event.shiftKey
      ) {
        // Only trigger if not typing in an input field
        const activeElement = document.activeElement
        const isInputField =
          activeElement instanceof HTMLInputElement ||
          activeElement instanceof HTMLTextAreaElement ||
          activeElement instanceof HTMLSelectElement ||
          activeElement?.getAttribute('contenteditable') === 'true'

        if (!isInputField) {
          event.preventDefault()
          onToggle()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onToggle])

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  // Extract unique values from issues with normalized status names
  const uniqueStatuses = [
    ...new Set(issues.map((issue) => normalizeStatusName(issue.status.name)))
  ]
  const uniquePriorities = [
    ...new Set(issues.map((issue) => issue.priority.name))
  ]
  const uniqueAssignees = [
    ...new Set(
      issues.map((issue) => issue.assignee?.displayName).filter(Boolean)
    )
  ]
  const uniqueIssueTypes = [
    ...new Set(issues.map((issue) => issue.issuetype.name))
  ]
  const uniqueSprints = [
    ...new Set(issues.map((issue) => issue.sprint?.name).filter(Boolean))
  ]
  const uniqueLabels = [...new Set(issues.flatMap((issue) => issue.labels))]
  const uniqueComponents = [
    ...new Set(issues.flatMap((issue) => issue.components.map((c) => c.name)))
  ]

  const handleFilterChange = (key: keyof FilterOptions, value: any) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const handleMultiSelectChange = (
    key: keyof FilterOptions,
    value: string,
    checked: boolean
  ) => {
    const currentValues = (filters[key] as string[]) || []
    const newValues = checked
      ? [...currentValues, value]
      : currentValues.filter((v) => v !== value)

    handleFilterChange(key, newValues.length > 0 ? newValues : undefined)
  }

  const clearAllFilters = () => {
    onFiltersChange({})
    // Also clear from localStorage
    localStorage.removeItem(STORAGE_KEYS.FILTERS)
  }

  const getActiveFiltersCount = () => {
    return Object.entries(filters).reduce((count, [, value]) => {
      if (Array.isArray(value)) {
        return count + value.length
      }
      if (value) {
        return count + 1
      }
      return count
    }, 0)
  }

  if (!isOpen) {
    return (
      <Button
        variant='outline'
        size='sm'
        onClick={onToggle}
        className='bg-background fixed bottom-4 left-4 z-50 border shadow-lg'
      >
        <Filter className='mr-2 h-4 w-4' />
        Filters {getActiveFiltersCount() > 0 && `(${getActiveFiltersCount()})`}
        <kbd className='ml-2 rounded border bg-gray-100 px-1.5 py-0.5 text-xs'>
          F
        </kbd>
      </Button>
    )
  }

  return (
    <>
      <div
        className='fixed inset-0 z-40 bg-black/50 lg:hidden dark:bg-black/70'
        onClick={onToggle}
      />
      <Card className='bg-background fixed top-0 left-0 z-50 h-full w-80 overflow-y-auto border-r lg:relative lg:z-0'>
        <CardHeader className='flex flex-row items-center justify-between'>
          <CardTitle className='flex items-center gap-2'>
            <Filter className='h-5 w-5' />
            Filters
            <kbd className='rounded border bg-gray-100 px-1.5 py-0.5 font-mono text-xs'>
              F
            </kbd>
          </CardTitle>
          <div className='flex items-center gap-2'>
            {getActiveFiltersCount() > 0 && (
              <>
                <Badge variant='secondary'>{getActiveFiltersCount()}</Badge>
                <Button variant='ghost' size='sm' onClick={clearAllFilters}>
                  Clear All
                </Button>
              </>
            )}
            <Button variant='ghost' size='sm' onClick={onToggle}>
              <X className='h-4 w-4' />
            </Button>
          </div>
        </CardHeader>
        <CardContent className='space-y-4'>
          {/* Status Filter */}
          <Collapsible
            open={openSections.status}
            onOpenChange={() => toggleSection('status')}
          >
            <CollapsibleTrigger asChild>
              <Button variant='ghost' className='w-full justify-between p-2'>
                Status
                {filters.status?.length && (
                  <Badge variant='secondary'>{filters.status.length}</Badge>
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className='mt-2 space-y-2'>
              {uniqueStatuses.map((status) => (
                <div key={status} className='flex items-center space-x-2'>
                  <Checkbox
                    id={`status-${status}`}
                    checked={filters.status?.includes(status) || false}
                    onCheckedChange={(checked) =>
                      handleMultiSelectChange(
                        'status',
                        status,
                        checked as boolean
                      )
                    }
                  />
                  <Label htmlFor={`status-${status}`} className='text-sm'>
                    {status}
                  </Label>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Priority Filter */}
          <Collapsible
            open={openSections.priority}
            onOpenChange={() => toggleSection('priority')}
          >
            <CollapsibleTrigger asChild>
              <Button variant='ghost' className='w-full justify-between p-2'>
                Priority
                {filters.priority?.length && (
                  <Badge variant='secondary'>{filters.priority.length}</Badge>
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className='mt-2 space-y-2'>
              {uniquePriorities.map((priority) => (
                <div key={priority} className='flex items-center space-x-2'>
                  <Checkbox
                    id={`priority-${priority}`}
                    checked={filters.priority?.includes(priority) || false}
                    onCheckedChange={(checked) =>
                      handleMultiSelectChange(
                        'priority',
                        priority,
                        checked as boolean
                      )
                    }
                  />
                  <Label htmlFor={`priority-${priority}`} className='text-sm'>
                    {priority}
                  </Label>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Assignee Filter */}
          <Collapsible
            open={openSections.assignee}
            onOpenChange={() => toggleSection('assignee')}
          >
            <CollapsibleTrigger asChild>
              <Button variant='ghost' className='w-full justify-between p-2'>
                Assignee
                {filters.assignee?.length && (
                  <Badge variant='secondary'>{filters.assignee.length}</Badge>
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className='mt-2 space-y-2'>
              {/* Add Unassigned option first */}
              <div className='flex items-center space-x-2'>
                <Checkbox
                  id='assignee-unassigned'
                  checked={filters.assignee?.includes('Unassigned') || false}
                  onCheckedChange={(checked) =>
                    handleMultiSelectChange(
                      'assignee',
                      'Unassigned',
                      checked as boolean
                    )
                  }
                />
                <Label
                  htmlFor='assignee-unassigned'
                  className='text-sm font-medium text-gray-600'
                >
                  Unassigned
                </Label>
              </div>
              {uniqueAssignees.map((assignee) => (
                <div key={assignee} className='flex items-center space-x-2'>
                  <Checkbox
                    id={`assignee-${assignee}`}
                    checked={
                      filters.assignee?.includes(assignee as string) || false
                    }
                    onCheckedChange={(checked) =>
                      handleMultiSelectChange(
                        'assignee',
                        assignee as string,
                        checked as boolean
                      )
                    }
                  />
                  <Label htmlFor={`assignee-${assignee}`} className='text-sm'>
                    {assignee}
                  </Label>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Issue Type Filter */}
          <Collapsible
            open={openSections.issueType}
            onOpenChange={() => toggleSection('issueType')}
          >
            <CollapsibleTrigger asChild>
              <Button variant='ghost' className='w-full justify-between p-2'>
                Issue Type
                {filters.issueType?.length && (
                  <Badge variant='secondary'>{filters.issueType.length}</Badge>
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className='mt-2 space-y-2'>
              {uniqueIssueTypes.map((type) => (
                <div key={type} className='flex items-center space-x-2'>
                  <Checkbox
                    id={`type-${type}`}
                    checked={filters.issueType?.includes(type) || false}
                    onCheckedChange={(checked) =>
                      handleMultiSelectChange(
                        'issueType',
                        type,
                        checked as boolean
                      )
                    }
                  />
                  <Label htmlFor={`type-${type}`} className='text-sm'>
                    {type}
                  </Label>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Sprint Filter */}
          {uniqueSprints.length > 0 && (
            <>
              <Collapsible
                open={openSections.sprint}
                onOpenChange={() => toggleSection('sprint')}
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant='ghost'
                    className='w-full justify-between p-2'
                  >
                    Sprint
                    {filters.sprint?.length && (
                      <Badge variant='secondary'>{filters.sprint.length}</Badge>
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className='mt-2 space-y-2'>
                  {uniqueSprints.map((sprint) => (
                    <div key={sprint} className='flex items-center space-x-2'>
                      <Checkbox
                        id={`sprint-${sprint}`}
                        checked={
                          filters.sprint?.includes(sprint as string) || false
                        }
                        onCheckedChange={(checked) =>
                          handleMultiSelectChange(
                            'sprint',
                            sprint as string,
                            checked as boolean
                          )
                        }
                      />
                      <Label htmlFor={`sprint-${sprint}`} className='text-sm'>
                        {sprint}
                      </Label>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
              <Separator />
            </>
          )}

          {/* Release Filter */}
          {(() => {
            const uniqueReleases = [
              ...new Set(
                issues.flatMap(
                  (issue) => issue.fixVersions?.map((v) => v.name) || []
                )
              )
            ]
            return (
              <>
                {uniqueReleases.length > 0 && (
                  <>
                    <Collapsible
                      open={openSections.release}
                      onOpenChange={() => toggleSection('release')}
                    >
                      <CollapsibleTrigger asChild>
                        <Button
                          variant='ghost'
                          className='w-full justify-between p-2'
                        >
                          Release
                          {filters.release?.length && (
                            <Badge variant='secondary'>
                              {filters.release.length}
                            </Badge>
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className='mt-2 space-y-2'>
                        {/* Add No Release option first */}
                        <div className='flex items-center space-x-2'>
                          <Checkbox
                            id='release-none'
                            checked={
                              filters.release?.includes('No Release') || false
                            }
                            onCheckedChange={(checked) =>
                              handleMultiSelectChange(
                                'release',
                                'No Release',
                                checked as boolean
                              )
                            }
                          />
                          <Label
                            htmlFor='release-none'
                            className='text-sm font-medium text-gray-600'
                          >
                            No Release
                          </Label>
                        </div>
                        {uniqueReleases.map((release) => (
                          <div
                            key={release}
                            className='flex items-center space-x-2'
                          >
                            <Checkbox
                              id={`release-${release}`}
                              checked={
                                filters.release?.includes(release) || false
                              }
                              onCheckedChange={(checked) =>
                                handleMultiSelectChange(
                                  'release',
                                  release,
                                  checked as boolean
                                )
                              }
                            />
                            <Label
                              htmlFor={`release-${release}`}
                              className='text-sm'
                            >
                              {release}
                            </Label>
                          </div>
                        ))}
                      </CollapsibleContent>
                    </Collapsible>
                    <Separator />
                  </>
                )}
              </>
            )
          })()}

          {/* Due Date Filter */}
          <Collapsible
            open={openSections.dueDate}
            onOpenChange={() => toggleSection('dueDate')}
          >
            <CollapsibleTrigger asChild>
              <Button variant='ghost' className='w-full justify-between p-2'>
                <div className='flex items-center gap-2'>
                  <CalendarDays className='h-4 w-4' />
                  Due Date
                </div>
                {(filters.dueDateFrom || filters.dueDateTo) && (
                  <Badge variant='secondary'>Active</Badge>
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className='mt-2 space-y-2'>
              <div>
                <Label htmlFor='due-date-from' className='text-sm'>
                  From
                </Label>
                <Input
                  id='due-date-from'
                  type='date'
                  value={filters.dueDateFrom || ''}
                  onChange={(e) =>
                    handleFilterChange(
                      'dueDateFrom',
                      e.target.value || undefined
                    )
                  }
                  className='mt-1'
                />
              </div>
              <div>
                <Label htmlFor='due-date-to' className='text-sm'>
                  To
                </Label>
                <Input
                  id='due-date-to'
                  type='date'
                  value={filters.dueDateTo || ''}
                  onChange={(e) =>
                    handleFilterChange('dueDateTo', e.target.value || undefined)
                  }
                  className='mt-1'
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Labels Filter */}
          {uniqueLabels.length > 0 && (
            <>
              <Collapsible
                open={openSections.labels}
                onOpenChange={() => toggleSection('labels')}
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant='ghost'
                    className='w-full justify-between p-2'
                  >
                    Labels
                    {filters.labels?.length && (
                      <Badge variant='secondary'>{filters.labels.length}</Badge>
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className='mt-2 space-y-2'>
                  {uniqueLabels.map((label) => (
                    <div key={label} className='flex items-center space-x-2'>
                      <Checkbox
                        id={`label-${label}`}
                        checked={filters.labels?.includes(label) || false}
                        onCheckedChange={(checked) =>
                          handleMultiSelectChange(
                            'labels',
                            label,
                            checked as boolean
                          )
                        }
                      />
                      <Label htmlFor={`label-${label}`} className='text-sm'>
                        {label}
                      </Label>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
              <Separator />
            </>
          )}

          {/* Components Filter */}
          {uniqueComponents.length > 0 && (
            <Collapsible
              open={openSections.components}
              onOpenChange={() => toggleSection('components')}
            >
              <CollapsibleTrigger asChild>
                <Button variant='ghost' className='w-full justify-between p-2'>
                  Components
                  {filters.components?.length && (
                    <Badge variant='secondary'>
                      {filters.components.length}
                    </Badge>
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className='mt-2 space-y-2'>
                {uniqueComponents.map((component) => (
                  <div key={component} className='flex items-center space-x-2'>
                    <Checkbox
                      id={`component-${component}`}
                      checked={filters.components?.includes(component) || false}
                      onCheckedChange={(checked) =>
                        handleMultiSelectChange(
                          'components',
                          component,
                          checked as boolean
                        )
                      }
                    />
                    <Label
                      htmlFor={`component-${component}`}
                      className='text-sm'
                    >
                      {component}
                    </Label>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
        </CardContent>
      </Card>
    </>
  )
}
