'use client'

import { useState } from 'react'
import { CalendarDays, Clock, User, CheckCircle } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { JiraIssue } from '@/types/JiraIssue'

interface IssueCardProps {
  issue: JiraIssue
  onClick?: (issue: JiraIssue) => void
  onHover?: (issue: JiraIssue) => void
}

export function IssueCard({ issue, onClick, onHover }: IssueCardProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'critical':
      case 'highest':
        return 'bg-[hsl(var(--destructive))/14] text-[hsl(var(--destructive))] border-[hsl(var(--destructive))/30]'
      case 'high':
        return 'bg-[hsl(var(--chart-4))/14] text-[hsl(var(--chart-4))] border-[hsl(var(--chart-4))/30]'
      case 'medium':
        return 'bg-[hsl(var(--chart-1))/14] text-[hsl(var(--chart-1))] border-[hsl(var(--chart-1))/30]'
      case 'low':
      case 'lowest':
        return 'bg-[hsl(var(--chart-5))/14] text-[hsl(var(--chart-5))] border-[hsl(var(--chart-5))/30]'
      default:
        return 'bg-muted/30 text-muted-foreground border-border'
    }
  }

  const getIssueTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'bug':
        return 'bg-[hsl(var(--destructive))/14] text-[hsl(var(--destructive))] border-[hsl(var(--destructive))/30]'
      case 'story':
        return 'bg-[hsl(var(--chart-1))/14] text-[hsl(var(--chart-1))] border-[hsl(var(--chart-1))/30]'
      case 'task':
        return 'bg-[hsl(var(--chart-5))/14] text-[hsl(var(--chart-5))] border-[hsl(var(--chart-5))/30]'
      case 'epic':
        return 'bg-[hsl(var(--primary))/14] text-[hsl(var(--primary))] border-[hsl(var(--primary))/30]'
      default:
        return 'bg-muted/30 text-muted-foreground border-border'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  const isOverdue = issue.duedate && new Date(issue.duedate) < new Date()
  const [copiedId, setCopiedId] = useState(false)

  return (
    <Card
      className='bg-card mb-3 w-full cursor-pointer transition-shadow hover:shadow-md'
      onClick={() => onClick?.(issue)}
      onMouseEnter={() => onHover?.(issue)}
      onFocus={() => onHover?.(issue)}
    >
      <CardHeader className='space-y-3 pb-3'>
        {/* Top row - Issue key and priority */}
        <div className='flex items-center justify-between gap-2'>
          <Badge
            variant='secondary'
            className={`relative shrink-0 font-mono text-xs font-semibold cursor-pointer select-none transition-transform active:scale-95 ${copiedId ? 'ring-2 ring-[hsl(var(--chart-5))]/60 ring-offset-2 ring-offset-background' : ''}`}
            title='Click to copy issue key'
            role='button'
            aria-label='Copy issue key to clipboard'
            onClick={async (e) => {
              e.stopPropagation()
              let ok = false
              try {
                await navigator.clipboard.writeText(issue.key)
                ok = true
              } catch (err) {
                try {
                  const el = document.createElement('input')
                  el.value = issue.key
                  document.body.appendChild(el)
                  el.select()
                  document.execCommand('copy')
                  document.body.removeChild(el)
                  ok = true
                } catch {}
              }
              if (ok) {
                setCopiedId(true)
                setTimeout(() => setCopiedId(false), 1200)
              }
            }}
          >
            <span className='inline-flex items-center gap-2'>
              {copiedId ? (
                <>
                  <CheckCircle className='h-3.5 w-3.5 text-[hsl(var(--chart-5))]' />
                  Copied!
                </>
              ) : (
                <>{issue.key}</>
              )}
            </span>
            <span className='sr-only' aria-live='polite'>
              {copiedId ? 'Issue key copied to clipboard' : ''}
            </span>
          </Badge>
          <Badge
            variant='outline'
            className={`shrink-0 text-xs font-medium ${getPriorityColor(issue.priority.name)}`}
          >
            {issue.priority.name}
          </Badge>
        </div>

        {/* Second row - Issue type and status */}
        <div className='flex items-center justify-between gap-2'>
          <Badge
            variant='outline'
            className={`v1-only shrink-0 text-xs ${getIssueTypeColor(issue.issuetype.name)}`}
          >
            {issue.issuetype.name}
          </Badge>
          <Badge
            variant='outline'
            className='v2-only shrink-0 text-xs border-border bg-muted/20 text-muted-foreground'
          >
            {issue.issuetype.name}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className='space-y-4 pt-0'>
        {/* Issue title */}
        <div>
          <h3 className='v1-only text-foreground line-clamp-3 text-sm leading-tight font-medium break-words'>
            {issue.summary}
          </h3>
          <h3 className='v2-only text-foreground line-clamp-3 text-base leading-snug font-semibold break-words'>
            {issue.summary}
          </h3>
        </div>

        {/* Labels section */}
        {issue.labels.length > 0 && (
          <div className='flex flex-wrap gap-1'>
            {issue.labels.slice(0, 3).map((label) => (
              <Badge
                key={label}
                variant='secondary'
                className='max-w-20 truncate px-2 py-0.5 text-xs'
              >
                {label}
              </Badge>
            ))}
            {issue.labels.length > 3 && (
              <Badge variant='secondary' className='px-2 py-0.5 text-xs'>
                +{issue.labels.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Bottom section - Assignee and due date */}
        <div className='border-border flex items-center justify-between border-t pt-2'>
          {/* Assignee */}
          <div className='flex min-w-0 flex-1 items-center gap-2'>
            {issue.assignee ? (
              <>
                <Avatar className='h-6 w-6 shrink-0'>
                  <AvatarImage
                    src={
                      issue.assignee.avatarUrls['24x24'] || '/placeholder.svg'
                    }
                  />
                  <AvatarFallback className='bg-muted text-xs'>
                    {issue.assignee.displayName
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </AvatarFallback>
                </Avatar>
                <span className='text-muted-foreground truncate text-xs'>
                  {issue.assignee.displayName.split(' ')[0]}
                </span>
              </>
            ) : (
              <>
                <div className='bg-muted flex h-6 w-6 shrink-0 items-center justify-center rounded-full'>
                  <User className='text-muted-foreground h-3 w-3' />
                </div>
                <span className='text-muted-foreground text-xs'>
                  Unassigned
                </span>
              </>
            )}
          </div>

          {/* Due date */}
          {issue.duedate && (
            <div
              className={`ml-2 flex shrink-0 items-center gap-1 text-xs ${
                isOverdue
                  ? 'text-[hsl(var(--destructive))]'
                  : 'text-muted-foreground'
              }`}
            >
              <CalendarDays className='h-3 w-3' />
              <span className='font-medium'>{formatDate(issue.duedate)}</span>
            </div>
          )}
        </div>

        {/* Updated timestamp */}
        <div className='text-muted-foreground flex items-center gap-1 pt-1 text-xs'>
          <Clock className='h-3 w-3 shrink-0' />
          <span className='truncate'>Updated {formatDate(issue.updated)}</span>
        </div>
      </CardContent>
    </Card>
  )
}
