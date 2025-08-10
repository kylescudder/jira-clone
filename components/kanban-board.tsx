"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { IssueCard } from "@/components/issue-card"
import { FilterSidebar } from "@/components/filter-sidebar"
import { normalizeStatusName } from "@/lib/utils"
import type { JiraIssue, FilterOptions, BoardColumn } from "@/types/jira"

interface KanbanBoardProps {
  issues: JiraIssue[]
  onIssueClick?: (issue: JiraIssue) => void
  filters: FilterOptions
  onFiltersChange: (filters: FilterOptions) => void
  isFilterSidebarOpen: boolean
  onToggleFilterSidebar: () => void
}

export function KanbanBoard({
  issues,
  onIssueClick,
  filters,
  onFiltersChange,
  isFilterSidebarOpen,
  onToggleFilterSidebar,
}: KanbanBoardProps) {
  // Remove the internal filter state
  // const [filters, setFilters] = useState<FilterOptions>({})
  // const [isFilterSidebarOpen, setIsFilterSidebarOpen] = useState(false)

  const filteredIssues = useMemo(() => {
    let filtered = [...issues]

    // Apply status filter using normalized names
    if (filters.status?.length) {
      filtered = filtered.filter((issue) => filters.status!.includes(normalizeStatusName(issue.status.name)))
    }

    // Apply priority filter
    if (filters.priority?.length) {
      filtered = filtered.filter((issue) => filters.priority!.includes(issue.priority.name))
    }

    // Apply assignee filter
    if (filters.assignee?.length) {
      filtered = filtered.filter((issue) => {
        // If "Unassigned" is selected and issue has no assignee, include it
        if (filters.assignee!.includes("Unassigned") && !issue.assignee) {
          return true
        }
        // If issue has an assignee and that assignee is in the filter, include it
        if (issue.assignee && filters.assignee!.includes(issue.assignee.displayName)) {
          return true
        }
        // Otherwise, exclude it
        return false
      })
    }

    // Apply issue type filter
    if (filters.issueType?.length) {
      filtered = filtered.filter((issue) => filters.issueType!.includes(issue.issuetype.name))
    }

    // Apply sprint filter
    if (filters.sprint?.length) {
      filtered = filtered.filter((issue) => issue.sprint && filters.sprint!.includes(issue.sprint.name))
    }

    // Apply release filter
    if (filters.release?.length) {
      filtered = filtered.filter((issue) => {
        // If "No Release" is selected and issue has no fix versions, include it
        if (filters.release!.includes("No Release") && (!issue.fixVersions || issue.fixVersions.length === 0)) {
          return true
        }
        // If issue has fix versions and any of them are in the filter, include it
        if (issue.fixVersions && issue.fixVersions.length > 0) {
          return issue.fixVersions.some((version) => filters.release!.includes(version.name))
        }
        // Otherwise, exclude it
        return false
      })
    }

    // Apply due date filters
    if (filters.dueDateFrom) {
      filtered = filtered.filter((issue) => issue.duedate && new Date(issue.duedate) >= new Date(filters.dueDateFrom!))
    }

    if (filters.dueDateTo) {
      filtered = filtered.filter((issue) => issue.duedate && new Date(issue.duedate) <= new Date(filters.dueDateTo!))
    }

    // Apply labels filter
    if (filters.labels?.length) {
      filtered = filtered.filter((issue) => filters.labels!.some((label) => issue.labels.includes(label)))
    }

    // Apply components filter
    if (filters.components?.length) {
      filtered = filtered.filter((issue) =>
        filters.components!.some((component) => issue.components.some((c) => c.name === component)),
      )
    }

    return filtered
  }, [issues, filters])

  const columns: BoardColumn[] = useMemo(() => {
    const statusGroups = {
      "To Do": ["To Do", "Open", "New", "Backlog"],
      "Attention Needed": ["Attention Needed"],
      Blocked: ["Blocked"],
      "In Progress": ["In Progress"],
      "Current Active Issue": ["Current Active Issue"],
      "In PR": ["In PR"],
      "In Review": ["In Review", "Code Review"],
      "Awaiting Testing": ["Awaiting Testing"],
      "Iteration Required": ["Iteration Required"],
      "Awaiting Information": ["Awaiting Information"],
      "Under Monitoring": ["Under Monitoring"],
      "Requires Config Change": ["Requires Config Change"],
      Done: ["Done", "Closed", "Resolved", "Complete"],
      "Not an Issue": ["Not an Issue"],
    }

    const allColumns = Object.entries(statusGroups).map(([title, statusKeys]) => ({
      id: title.toLowerCase().replace(/\s+/g, "-"),
      title,
      statusKeys,
      issues: filteredIssues.filter((issue) =>
        statusKeys.some((status) =>
          normalizeStatusName(issue.status.name).toLowerCase().includes(status.toLowerCase()),
        ),
      ),
    }))

    // If status filter is active, only show columns that:
    // 1. Have issues in them, OR
    // 2. Could potentially have issues (their status is in the filter)
    if (filters.status?.length) {
      return allColumns.filter((column) => {
        // Show column if it has issues
        if (column.issues.length > 0) {
          return true
        }

        // Show column if any of its status keys match the filter
        return column.statusKeys.some((statusKey) =>
          filters.status!.some(
            (filterStatus) => normalizeStatusName(statusKey).toLowerCase() === filterStatus.toLowerCase(),
          ),
        )
      })
    }

    // If no status filter, show all columns
    return allColumns
  }, [filteredIssues, filters.status])

  const getColumnColor = (columnTitle: string) => {
    switch (columnTitle) {
      case "To Do":
        return "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950"
      case "Attention Needed":
        return "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"
      case "Blocked":
        return "border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950"
      case "In Progress":
        return "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950"
      case "Current Active Issue":
        return "border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-950"
      case "In PR":
        return "border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-950"
      case "In Review":
        return "border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950"
      case "Done":
        return "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950"
      case "Awaiting Testing":
        return "border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950"
      case "Iteration Required":
        return "border-pink-200 bg-pink-50 dark:border-pink-800 dark:bg-pink-950"
      case "Awaiting Information":
        return "border-cyan-200 bg-cyan-50 dark:border-cyan-800 dark:bg-cyan-950"
      case "Under Monitoring":
        return "border-teal-200 bg-teal-50 dark:border-teal-800 dark:bg-teal-950"
      case "Not an Issue":
        return "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900"
      case "Requires Config Change":
        return "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950"
      default:
        return "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900"
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <FilterSidebar
        filters={filters}
        onFiltersChange={onFiltersChange}
        issues={issues}
        isOpen={isFilterSidebarOpen}
        onToggle={onToggleFilterSidebar}
      />

      <div className="flex-1 p-4 overflow-hidden">
        {/* Horizontal scrolling container */}
        <div className="h-full overflow-x-auto overflow-y-hidden">
          <div className="flex gap-4 h-full" style={{ minWidth: `${columns.length * 280}px` }}>
            {columns.map((column) => (
              <Card
                key={column.id}
                className={`flex flex-col h-full shrink-0 w-[270px] ${getColumnColor(column.title)}`}
              >
                <CardHeader className="pb-3 shrink-0">
                  <CardTitle className="flex items-center justify-between">
                    <span className="text-lg truncate">{column.title}</span>
                    <Badge variant="secondary" className="ml-2 shrink-0">
                      {column.issues.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-3">
                  <div className="space-y-3">
                    {column.issues.map((issue) => (
                      <IssueCard key={issue.id} issue={issue} onClick={onIssueClick} />
                    ))}
                    {column.issues.length === 0 && (
                      <div className="text-center text-muted-foreground py-8 text-sm">No issues in this column</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
