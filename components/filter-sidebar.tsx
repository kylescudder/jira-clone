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
import {
  normalizeStatusName,
  getStatusColor,
  getStatusGroupRank,
  isEditableTarget
} from '@/lib/utils'
import type { FilterOptions, JiraIssue } from '@/types/jira'
import { KeyboardKey } from '@/components/ui/keyboard-key'
import { STORAGE_KEYS } from '@/lib/constants'

interface FilterSidebarProps {
  filters: FilterOptions
  onFiltersChange: (filters: FilterOptions) => void
  issues: JiraIssue[]
  isOpen: boolean
  onToggle: () => void
}

export function FilterSidebar({
  filters,
  onFiltersChange,
  issues,
  isOpen,
  onToggle
}: FilterSidebarProps) {
  const [openSections, setOpenSections] = useState(() => {
    const defaults = {
      status: true,
      priority: true,
      assignee: true,
      issueType: true,
      sprint: false,
      release: false,
      dueDate: false,
      labels: false,
      components: false,
      // Release subsections
      releaseUnreleased: true,
      releaseReleased: false,
      releaseArchived: false
    }
    try {
      const saved =
        typeof window !== 'undefined'
          ? localStorage.getItem(STORAGE_KEYS.FILTER_SECTIONS)
          : null
      if (saved) {
        const parsed = JSON.parse(saved)
        // Merge to ensure any new keys receive defaults
        return { ...defaults, ...parsed }
      }
    } catch (e) {
      // ignore parse errors
    }
    return defaults
  })

  // Load filter section states from localStorage on mount (merge to keep new defaults)
  useEffect(() => {
    const savedSections = localStorage.getItem(STORAGE_KEYS.FILTER_SECTIONS)
    if (savedSections) {
      try {
        const parsed = JSON.parse(savedSections)
        setOpenSections((prev) => ({ ...prev, ...parsed }))
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

  // Keyboard shortcut: When filter sidebar is open, press 'a' to open Assignee section; 's' to open Status section
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      if (isEditableTarget(e.target)) return
      const key = e.key.toLowerCase()
      if (key === 'a') {
        e.preventDefault()
        setOpenSections((prev: any) => ({ ...prev, assignee: true }))
        // try to focus the Unassigned checkbox or its label
        const el = document.getElementById(
          'assignee-unassigned'
        ) as HTMLElement | null
        el?.focus?.()
        el?.scrollIntoView?.({ block: 'center' })
      } else if (key === 's') {
        e.preventDefault()
        setOpenSections((prev: any) => ({ ...prev, status: true }))
        // try to focus the first status checkbox if exists
        const statusSection = document.querySelector(
          '[id^="status-"]'
        ) as HTMLElement | null
        statusSection?.focus?.()
        statusSection?.scrollIntoView?.({ block: 'center' })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen])

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
        Filters{' '}
        {getActiveFiltersCount() > 0 && (
          <Badge variant='secondary'>{getActiveFiltersCount()}</Badge>
        )}
        <KeyboardKey size='xs' className='ml-2'>
          F
        </KeyboardKey>
      </Button>
    )
  }

  return (
    <>
      <div
        className='fixed inset-0 z-40 bg-black/50 lg:hidden dark:bg-black/70'
        onClick={onToggle}
      />
      <Card className='bg-background fixed top-0 left-0 z-50 h-full w-80 overflow-y-auto overflow-x-hidden border-r lg:relative lg:z-0'>
        <CardHeader className='flex flex-row items-center justify-between'>
          <CardTitle className='flex items-center gap-2'>
            <Filter className='h-5 w-5' />
            Filters
            {getActiveFiltersCount() > 0 && (
              <>
                <Badge variant='secondary'>{getActiveFiltersCount()}</Badge>
                <Button variant='ghost' size='sm' onClick={clearAllFilters}>
                  Clear All
                </Button>
              </>
            )}
            <KeyboardKey size='sm'>F</KeyboardKey>
          </CardTitle>
          <div className='flex items-center gap-2'>
            <Button variant='ghost' size='sm' onClick={onToggle}>
              <X className='h-4 w-4' />
            </Button>
          </div>
        </CardHeader>
        <CardContent className='space-y-4 overflow-x-hidden'>
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
              {[...uniqueStatuses]
                .sort((a, b) => {
                  const ga = getStatusGroupRank(a)
                  const gb = getStatusGroupRank(b)
                  if (ga !== gb) return ga - gb
                  return a.localeCompare(b)
                })
                .map((status) => (
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
                      <span
                        className={`inline-block rounded border px-2 py-0.5 text-xs ${getStatusColor(status)}`}
                      >
                        {status}
                      </span>
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
            // Collect all versions from issues, including their released/archived flags
            const allVersions = issues.flatMap(
              (issue) => issue.fixVersions || []
            )

            // De-duplicate by id when present, otherwise by name
            const versionMap = new Map<
              string,
              { name: string; released: boolean; archived?: boolean }
            >()
            for (const v of allVersions) {
              const key = (v.id && String(v.id)) || v.name
              if (!versionMap.has(key)) {
                versionMap.set(key, {
                  name: v.name,
                  released: !!v.released,
                  archived: v.archived
                })
              } else {
                // Merge in case different issues have different flags (prefer archived true, then released true)
                const prev = versionMap.get(key)!
                versionMap.set(key, {
                  name: prev.name,
                  released: prev.released || !!v.released,
                  archived: prev.archived || v.archived
                })
              }
            }
            const versions = Array.from(versionMap.values())

            // Group like Jira
            const archived = versions.filter((v) => v.archived)
            const released = versions.filter((v) => v.released && !v.archived)
            const unreleased = versions.filter(
              (v) => !v.released && !v.archived
            )

            const total = versions.length

            return (
              <>
                {total > 0 && (
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
                      <CollapsibleContent className='mt-2 space-y-3'>
                        {/* No Release option */}
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

                        {/* Unreleased subsection (default open) */}
                        <Collapsible
                          open={openSections.releaseUnreleased}
                          onOpenChange={() =>
                            toggleSection('releaseUnreleased')
                          }
                        >
                          <CollapsibleTrigger asChild>
                            <Button
                              variant='ghost'
                              className='w-full justify-between px-1 py-2'
                            >
                              <span>Unreleased</span>
                              <Badge variant='secondary'>
                                {unreleased.length}
                              </Badge>
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className='mt-2 space-y-2'>
                            {unreleased.length === 0 ? (
                              <div className='text-muted-foreground text-xs'>
                                No unreleased versions
                              </div>
                            ) : (
                              unreleased
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map((v) => (
                                  <div
                                    key={`release-unreleased-${v.name}`}
                                    className='flex items-center space-x-2'
                                  >
                                    <Checkbox
                                      id={`release-${v.name}`}
                                      checked={
                                        filters.release?.includes(v.name) ||
                                        false
                                      }
                                      onCheckedChange={(checked) =>
                                        handleMultiSelectChange(
                                          'release',
                                          v.name,
                                          checked as boolean
                                        )
                                      }
                                    />
                                    <Label
                                      htmlFor={`release-${v.name}`}
                                      className='text-sm'
                                    >
                                      {v.name}
                                    </Label>
                                  </div>
                                ))
                            )}
                          </CollapsibleContent>
                        </Collapsible>

                        {/* Released subsection */}
                        <Collapsible
                          open={openSections.releaseReleased}
                          onOpenChange={() => toggleSection('releaseReleased')}
                        >
                          <CollapsibleTrigger asChild>
                            <Button
                              variant='ghost'
                              className='w-full justify-between px-1 py-2'
                            >
                              <span>Released</span>
                              <Badge variant='secondary'>
                                {released.length}
                              </Badge>
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className='mt-2 space-y-2'>
                            {released.length === 0 ? (
                              <div className='text-muted-foreground text-xs'>
                                No released versions
                              </div>
                            ) : (
                              released
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map((v) => (
                                  <div
                                    key={`release-released-${v.name}`}
                                    className='flex items-center space-x-2'
                                  >
                                    <Checkbox
                                      id={`release-${v.name}`}
                                      checked={
                                        filters.release?.includes(v.name) ||
                                        false
                                      }
                                      onCheckedChange={(checked) =>
                                        handleMultiSelectChange(
                                          'release',
                                          v.name,
                                          checked as boolean
                                        )
                                      }
                                    />
                                    <Label
                                      htmlFor={`release-${v.name}`}
                                      className='text-sm'
                                    >
                                      {v.name}
                                    </Label>
                                  </div>
                                ))
                            )}
                          </CollapsibleContent>
                        </Collapsible>

                        {/* Archived subsection */}
                        <Collapsible
                          open={openSections.releaseArchived}
                          onOpenChange={() => toggleSection('releaseArchived')}
                        >
                          <CollapsibleTrigger asChild>
                            <Button
                              variant='ghost'
                              className='w-full justify-between px-1 py-2'
                            >
                              <span>Archived</span>
                              <Badge variant='secondary'>
                                {archived.length}
                              </Badge>
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className='mt-2 space-y-2'>
                            {archived.length === 0 ? (
                              <div className='text-muted-foreground text-xs'>
                                No archived versions
                              </div>
                            ) : (
                              archived
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map((v) => (
                                  <div
                                    key={`release-archived-${v.name}`}
                                    className='flex items-center space-x-2'
                                  >
                                    <Checkbox
                                      id={`release-${v.name}`}
                                      checked={
                                        filters.release?.includes(v.name) ||
                                        false
                                      }
                                      onCheckedChange={(checked) =>
                                        handleMultiSelectChange(
                                          'release',
                                          v.name,
                                          checked as boolean
                                        )
                                      }
                                    />
                                    <Label
                                      htmlFor={`release-${v.name}`}
                                      className='text-sm'
                                    >
                                      {v.name}
                                    </Label>
                                  </div>
                                ))
                            )}
                          </CollapsibleContent>
                        </Collapsible>
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
