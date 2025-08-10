"use client"

import { CalendarDays, Clock, User } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { normalizeStatusName, getStatusColor } from "@/lib/utils"
import type { JiraIssue } from "@/types/jira"

interface IssueCardProps {
  issue: JiraIssue
  onClick?: (issue: JiraIssue) => void
}

export function IssueCard({ issue, onClick }: IssueCardProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "critical":
      case "highest":
        return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200 dark:border-red-800"
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900 dark:text-orange-200 dark:border-orange-800"
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200 dark:border-yellow-800"
      case "low":
      case "lowest":
        return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200 dark:border-green-800"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700"
    }
  }

  const getIssueTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case "bug":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
      case "story":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      case "task":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "epic":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })
  }

  const isOverdue = issue.duedate && new Date(issue.duedate) < new Date()
  const normalizedStatus = normalizeStatusName(issue.status.name)

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow mb-3 w-full bg-card"
      onClick={() => onClick?.(issue)}
    >
      <CardHeader className="pb-3 space-y-3">
        {/* Top row - Issue key and priority */}
        <div className="flex items-center justify-between gap-2">
          <Badge variant="secondary" className="text-xs font-mono shrink-0 font-semibold">
            {issue.key}
          </Badge>
          <Badge variant="outline" className={`text-xs shrink-0 font-medium ${getPriorityColor(issue.priority.name)}`}>
            {issue.priority.name}
          </Badge>
        </div>

        {/* Second row - Issue type and status */}
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline" className={`text-xs shrink-0 ${getIssueTypeColor(issue.issuetype.name)}`}>
            {issue.issuetype.name}
          </Badge>
          <Badge variant="outline" className={`text-xs shrink-0 ${getStatusColor(issue.status.name)}`}>
            {normalizedStatus}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-4">
        {/* Issue title */}
        <div>
          <h3 className="font-medium text-sm leading-tight line-clamp-3 break-words text-foreground">
            {issue.summary}
          </h3>
        </div>

        {/* Labels section */}
        {issue.labels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {issue.labels.slice(0, 3).map((label) => (
              <Badge key={label} variant="secondary" className="text-xs truncate max-w-20 px-2 py-0.5">
                {label}
              </Badge>
            ))}
            {issue.labels.length > 3 && (
              <Badge variant="secondary" className="text-xs px-2 py-0.5">
                +{issue.labels.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Bottom section - Assignee and due date */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          {/* Assignee */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {issue.assignee ? (
              <>
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarImage src={issue.assignee.avatarUrls["24x24"] || "/placeholder.svg"} />
                  <AvatarFallback className="text-xs bg-muted">
                    {issue.assignee.displayName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-foreground truncate">
                  {issue.assignee.displayName.split(" ")[0]}
                </span>
              </>
            ) : (
              <>
                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <User className="h-3 w-3 text-muted-foreground" />
                </div>
                <span className="text-xs text-muted-foreground">Unassigned</span>
              </>
            )}
          </div>

          {/* Due date */}
          {issue.duedate && (
            <div
              className={`flex items-center gap-1 text-xs shrink-0 ml-2 ${
                isOverdue ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
              }`}
            >
              <CalendarDays className="h-3 w-3" />
              <span className="font-medium">{formatDate(issue.duedate)}</span>
            </div>
          )}
        </div>

        {/* Updated timestamp */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground pt-1">
          <Clock className="h-3 w-3 shrink-0" />
          <span className="truncate">Updated {formatDate(issue.updated)}</span>
        </div>
      </CardContent>
    </Card>
  )
}
