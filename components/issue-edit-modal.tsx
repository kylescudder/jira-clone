'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Loader2,
  Save,
  CheckCircle,
  AlertCircle,
  Calendar,
  User,
  Clock,
  Tag,
  Component,
  ChevronDown,
  RefreshCw,
  Link as LinkIcon,
  ChevronsUpDown,
  Check,
  Eye,
  EyeOff
} from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible'
import {
  fetchIssueTransitions,
  fetchProjectUsers,
  updateIssueStatus,
  updateIssueAssignee,
  fetchIssueDetails,
  postIssueComment,
  editIssueComment,
  deleteIssueComment,
  fetchProjectVersions,
  updateIssueFixVersions,
  fetchIssue
} from '@/lib/client-api'
import { getCachedData } from '@/lib/client-api'
import {
  normalizeStatusName,
  getStatusColor,
  getStatusGroupRank
} from '@/lib/utils'
import type {
  JiraIssue,
  JiraUser,
  JiraIssueDetails,
  JiraComment
} from '@/types/jira'

interface IssueEditModalProps {
  issue: JiraIssue | null
  projectKey: string
  isOpen: boolean
  onClose: () => void
  onUpdate: () => void
}

export function IssueEditModal({
  issue,
  projectKey,
  isOpen,
  onClose,
  onUpdate
}: IssueEditModalProps) {
  // Nested component for individual comment with actions
  function CommentItem({
    issueKey,
    comment,
    onChanged
  }: {
    issueKey: string
    comment: JiraComment
    onChanged: () => void | Promise<void>
  }) {
    const [isEditing, setIsEditing] = useState(false)
    const [editText, setEditText] = useState(comment.body)
    const [saving, setSaving] = useState(false)
    const [err, setErr] = useState<string | null>(null)
    const [copiedCommentLink, setCopiedCommentLink] = useState(false)

    const handleEditSave = async () => {
      const text = editText.trim()
      if (!text) {
        setErr('Comment cannot be empty')
        return
      }
      setSaving(true)
      setErr(null)
      try {
        const ok = await editIssueComment(issueKey, comment.id, text)
        if (ok) {
          setIsEditing(false)
          await onChanged()
        } else {
          setErr('Failed to save changes')
        }
      } catch (e) {
        setErr('Failed to save changes')
      } finally {
        setSaving(false)
      }
    }

    const handleDelete = async () => {
      const confirmed = window.confirm('Delete this comment?')
      if (!confirmed) return
      try {
        const ok = await deleteIssueComment(issueKey, comment.id)
        if (ok) await onChanged()
      } catch (e) {
        // noop; could show toast
      }
    }

    return (
      <div className='flex gap-3 rounded-md border border-border bg-muted/30 p-3 group'>
        <Avatar className='h-8 w-8'>
          <AvatarImage
            src={comment.author.avatarUrls?.['24x24'] || '/placeholder.svg'}
          />
          <AvatarFallback>
            {comment.author.displayName
              .split(' ')
              .map((n) => n[0])
              .join('')}
          </AvatarFallback>
        </Avatar>
        <div className='min-w-0 flex-1'>
          <div className='flex flex-wrap items-center justify-between gap-2 text-sm relative'>
            <div className='flex flex-wrap items-center gap-x-2 gap-y-1'>
              <span className='font-medium'>{comment.author.displayName}</span>
              <span className='text-muted-foreground'>
                • {new Date(comment.created).toLocaleString()}
              </span>
            </div>
            <div className='flex items-center gap-3 text-xs text-muted-foreground'>
              {/* Copy comment link */}
              <button
                type='button'
                className={`${copiedCommentLink ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity duration-500 inline-flex items-center gap-1 border border-border rounded px-2 py-0.5 hover:bg-muted`}
                title='Copy comment link'
                aria-label='Copy comment link'
                onClick={async (e) => {
                  e.stopPropagation()
                  const base = jiraBase?.trim() || ''
                  const baseUrl = base
                    ? base.replace(/\/$/, '')
                    : typeof window !== 'undefined'
                      ? window.location.origin
                      : ''
                  const url = baseUrl
                    ? `${baseUrl}/browse/${issueKey}?focusedCommentId=${comment.id}`
                    : `${issueKey}`
                  let ok = false
                  try {
                    await navigator.clipboard.writeText(url)
                    ok = true
                  } catch (err) {
                    try {
                      const el = document.createElement('textarea')
                      el.value = url
                      el.setAttribute('readonly', '')
                      el.style.position = 'fixed'
                      el.style.top = '-9999px'
                      document.body.appendChild(el)
                      el.select()
                      document.execCommand('copy')
                      document.body.removeChild(el)
                      ok = true
                    } catch {}
                  }
                  if (ok) {
                    setCopiedCommentLink(true)
                    setTimeout(() => setCopiedCommentLink(false), 1500)
                  }
                }}
              >
                <span className='relative inline-block h-3.5 w-3.5'>
                  <LinkIcon
                    className={`absolute inset-0 h-3.5 w-3.5 transition-opacity duration-500 ${copiedCommentLink ? 'opacity-0' : 'opacity-100'}`}
                    aria-hidden={copiedCommentLink ? 'true' : 'false'}
                  />
                  <CheckCircle
                    className={`absolute inset-0 h-3.5 w-3.5 text-green-600 transition-opacity duration-500 ${copiedCommentLink ? 'opacity-100' : 'opacity-0'}`}
                    aria-hidden={copiedCommentLink ? 'false' : 'true'}
                  />
                </span>
                <span className='sr-only' aria-live='polite'>
                  {copiedCommentLink ? 'Comment link copied to clipboard' : ''}
                </span>
              </button>
              <button
                className='hover:underline'
                onClick={() => setIsEditing((v) => !v)}
              >
                {isEditing ? 'Cancel' : 'Edit'}
              </button>
              <button
                className='hover:underline text-red-600'
                onClick={handleDelete}
              >
                Delete
              </button>
            </div>
          </div>

          {isEditing ? (
            <div className='mt-2'>
              <textarea
                className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring min-h-[90px]'
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                disabled={saving}
              />
              <div className='mt-2 flex items-center justify-end gap-2'>
                {err && (
                  <span className='mr-auto text-xs text-red-600'>{err}</span>
                )}
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => setIsEditing(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button size='sm' onClick={handleEditSave} disabled={saving}>
                  {saving ? (
                    <span className='inline-flex items-center gap-2'>
                      <Loader2 className='h-4 w-4 animate-spin' />
                      Saving…
                    </span>
                  ) : (
                    'Save'
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div
              className='mt-1 text-sm prose prose-invert max-w-none'
              dangerouslySetInnerHTML={{
                __html:
                  comment.bodyHtml ||
                  (comment.body || '')
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/\n/g, '<br />')
              }}
            />
          )}
        </div>
      </div>
    )
  }

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [transitions, setTransitions] = useState<
    Array<{ id: string; name: string }>
  >([])
  const [projectUsers, setProjectUsers] = useState<JiraUser[]>([])
  const [selectedTransition, setSelectedTransition] = useState<string>('')
  const [selectedAssignee, setSelectedAssignee] = useState<string>('')
  const [hasChanges, setHasChanges] = useState(false)
  const [details, setDetails] = useState<JiraIssueDetails | null>(null)
  const [projectVersions, setProjectVersions] = useState<
    Array<{ id: string; name: string; released: boolean; archived?: boolean }>
  >([])
  const [selectedVersionIds, setSelectedVersionIds] = useState<string[]>([])
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(true)
  const [freshIssue, setFreshIssue] = useState<JiraIssue | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [preview, setPreview] = useState<{
    url: string
    filename: string
    mime?: string
  } | null>(null)
  const [newComment, setNewComment] = useState('')
  const [postingComment, setPostingComment] = useState(false)
  const [commentError, setCommentError] = useState<string | null>(null)
  const [commentSuccess, setCommentSuccess] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState(false)
  const [copiedIssueLink, setCopiedIssueLink] = useState(false)
  const [versionsOpen, setVersionsOpen] = useState(false)
  const [showReleased, setShowReleased] = useState(false)

  useEffect(() => {
    if (issue && isOpen) {
      setFreshIssue(null)
      loadEditData()
      loadDetails()
      // Load versions for this project and seed selection
      ;(async () => {
        try {
          const cached = getCachedData<
            Array<{
              id: string
              name: string
              released: boolean
              archived?: boolean
            }>
          >(`versions:${projectKey}`)
          if (cached?.length) setProjectVersions(cached)
          const versions = await fetchProjectVersions(projectKey)
          setProjectVersions(versions)
        } catch (e) {
          // ignore
        }
      })()
      setSelectedAssignee(issue.assignee?.displayName || 'unassigned')
      setSelectedTransition('')
      setSelectedVersionIds((issue.fixVersions || []).map((v) => v.id))
      setHasChanges(false)
    }
  }, [issue, isOpen])

  // Clear messages when changes are made
  useEffect(() => {
    setError(null)
    setSuccess(null)
  }, [selectedTransition, selectedAssignee, selectedVersionIds])

  // Clear comment messages when text changes
  useEffect(() => {
    setCommentError(null)
    setCommentSuccess(null)
  }, [newComment])

  // Reset when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setSelectedTransition('')
      setError(null)
      setSuccess(null)
      setHasChanges(false)
      if (issue) {
        setSelectedAssignee(issue.assignee?.displayName || 'unassigned')
      }
    }
  }, [isOpen, issue])

  // Check for changes
  useEffect(() => {
    if (!issue) return

    const currentAssignee = issue.assignee?.displayName || 'unassigned'
    const hasStatusChange = selectedTransition !== ''
    const hasAssigneeChange = selectedAssignee !== currentAssignee
    const originalVersionIds = (issue.fixVersions || []).map((v) => v.id).sort()
    const currentVersionIds = [...selectedVersionIds].sort()
    const hasVersionChange =
      originalVersionIds.length !== currentVersionIds.length ||
      originalVersionIds.some((v, i) => v !== currentVersionIds[i])

    setHasChanges(hasStatusChange || hasAssigneeChange || hasVersionChange)
  }, [selectedTransition, selectedAssignee, selectedVersionIds, issue])

  const loadDetails = async () => {
    if (!issue) return
    setDetailsLoading(true)
    try {
      // hydrate from cache immediately
      const cached = getCachedData<JiraIssueDetails>(
        `issueDetails:${issue.key}`
      )
      if (cached) setDetails(cached)

      const d = await fetchIssueDetails(issue.key)
      setDetails(d)
    } catch (e) {
      console.error('Failed to load issue details', e)
      // do not set global error as edit controls are separate
    } finally {
      setDetailsLoading(false)
    }
  }

  const loadEditData = async () => {
    if (!issue) return

    setLoading(true)
    setError(null)

    try {
      console.log(`Loading edit data for issue ${issue.key}`)

      // hydrate from cache immediately
      const cachedTransitions = getCachedData<
        Array<{ id: string; name: string }>
      >(`transitions:${issue.key}`)
      if (cachedTransitions?.length) {
        const normalizedCached = cachedTransitions.map((t) => ({
          ...t,
          name: normalizeStatusName(t.name)
        }))
        setTransitions(
          [...normalizedCached].sort((a, b) => {
            const ga = getStatusGroupRank(a.name)
            const gb = getStatusGroupRank(b.name)
            if (ga !== gb) return ga - gb
            return a.name.localeCompare(b.name)
          })
        )
      }
      const cachedUsers = getCachedData<JiraUser[]>(
        `projectUsers:${projectKey}`
      )
      if (cachedUsers?.length) setProjectUsers(cachedUsers)

      const [transitionsData, usersData] = await Promise.all([
        fetchIssueTransitions(issue.key),
        fetchProjectUsers(projectKey)
      ])

      console.log(
        `Loaded ${transitionsData.length} transitions and ${usersData.length} users`
      )

      // Normalize transition names
      const normalizedTransitions = transitionsData.map((transition) => ({
        ...transition,
        name: normalizeStatusName(transition.name)
      }))

      setTransitions(
        [...normalizedTransitions].sort((a, b) => {
          const ga = getStatusGroupRank(a.name)
          const gb = getStatusGroupRank(b.name)
          if (ga !== gb) return ga - gb
          return a.name.localeCompare(b.name)
        })
      )
      setProjectUsers(usersData)
    } catch (error) {
      console.error('Error loading edit data:', error)
      setError('Failed to load editing options. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const loadIssueBase = async () => {
    if (!issue) return
    try {
      const updated = await fetchIssue(issue.key)
      if (updated) {
        setFreshIssue(updated)
        setSelectedAssignee(updated.assignee?.displayName || 'unassigned')
        setSelectedVersionIds((updated.fixVersions || []).map((v) => v.id))
      }
    } catch (e) {
      // ignore
    }
  }

  const handleSave = async () => {
    if (!issue || !hasChanges) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    let hasUpdates = false
    const updates: string[] = []

    try {
      // Update status if changed
      if (selectedTransition) {
        console.log(
          `Updating status for ${issue.key} with transition ${selectedTransition}`
        )
        const success = await updateIssueStatus(issue.key, selectedTransition)
        if (success) {
          hasUpdates = true
          const newStatus = transitions.find(
            (t) => t.id === selectedTransition
          )?.name
          updates.push(`Status updated to ${newStatus}`)
        } else {
          throw new Error('Failed to update status')
        }
      }

      // Update assignee if changed
      const currentAssignee = issue.assignee?.displayName || 'unassigned'
      if (selectedAssignee !== currentAssignee) {
        console.log(
          `Updating assignee for ${issue.key} from ${currentAssignee} to ${selectedAssignee}`
        )

        const selectedUser =
          selectedAssignee === 'unassigned'
            ? null
            : projectUsers.find((user) => user.displayName === selectedAssignee)

        const accountId = selectedUser?.accountId || null
        const success = await updateIssueAssignee(issue.key, accountId)

        if (success) {
          hasUpdates = true
          updates.push(
            `Assignee updated to ${selectedAssignee === 'unassigned' ? 'Unassigned' : selectedAssignee}`
          )
        } else {
          throw new Error('Failed to update assignee')
        }
      }

      // Update fix versions if changed
      {
        const originalVersionIds = (issue.fixVersions || [])
          .map((v) => v.id)
          .sort()
        const currentVersionIds = [...selectedVersionIds].sort()
        const changed =
          originalVersionIds.length !== currentVersionIds.length ||
          originalVersionIds.some((v, i) => v !== currentVersionIds[i])
        if (changed) {
          const ok = await updateIssueFixVersions(issue.key, selectedVersionIds)
          if (ok) {
            hasUpdates = true
            const names =
              projectVersions
                .filter((v) => selectedVersionIds.includes(v.id))
                .map((v) => v.name)
                .join(', ') || 'No Release'
            updates.push(`Fix versions updated: ${names}`)
          } else {
            throw new Error('Failed to update fix versions')
          }
        }
      }

      if (hasUpdates) {
        setSuccess(updates.join(', '))
        onUpdate()
        setSelectedTransition('')
        setHasChanges(false)

        // Close modal after successful update
        setTimeout(() => {
          onClose()
        }, 1500)
      } else {
        setError('No changes to save')
      }
    } catch (error) {
      console.error('Error saving changes:', error)
      setError(
        error instanceof Error ? error.message : 'Failed to save changes'
      )
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setSelectedTransition('')
    setError(null)
    setSuccess(null)
    setHasChanges(false)
    if (issue) {
      setSelectedAssignee(issue.assignee?.displayName || 'unassigned')
      setSelectedVersionIds((issue.fixVersions || []).map((v) => v.id))
    }
    onClose()
  }

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'critical':
      case 'highest':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low':
      case 'lowest':
        return 'bg-green-100 text-green-800 border-green-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  if (!issue) return null

  const displayIssue = freshIssue || issue

  const normalizedStatus = normalizeStatusName(displayIssue.status.name)

  const jiraBase = process.env.JIRA_BASE_URL || ''

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className='max-h-[90vh] max-w-6xl p-0'>
        <DialogHeader className='bg-muted/50 border-b px-6 py-4'>
          <DialogTitle className='flex items-center justify-between'>
            <div className='flex items-center gap-3 group'>
              <Badge
                variant='outline'
                className={`relative px-3 py-1 font-mono text-sm cursor-pointer select-none transition-transform active:scale-95 ${
                  copiedId
                    ? 'ring-2 ring-green-400/60 ring-offset-2 ring-offset-background'
                    : ''
                }`}
                title='Click to copy issue key'
                role='button'
                aria-label='Copy issue key to clipboard'
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(issue.key)
                    setCopiedId(true)
                    setTimeout(() => setCopiedId(false), 1200)
                  } catch (e) {
                    // Fallback: create a temporary input if clipboard API not available
                    try {
                      const el = document.createElement('input')
                      el.value = issue.key
                      document.body.appendChild(el)
                      el.select()
                      document.execCommand('copy')
                      document.body.removeChild(el)
                      setCopiedId(true)
                      setTimeout(() => setCopiedId(false), 1200)
                    } catch {}
                  }
                }}
              >
                <span className='inline-flex items-center gap-2'>
                  {copiedId ? (
                    <>
                      <CheckCircle className='h-3.5 w-3.5 text-green-600' />
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
              {/* Copy issue link button */}
              <button
                type='button'
                className={`${copiedIssueLink ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity duration-500 inline-flex items-center gap-1 text-xs text-muted-foreground border border-border rounded px-2 py-1 hover:bg-muted`}
                title='Copy issue link'
                aria-label='Copy issue link'
                onClick={async (e) => {
                  e.stopPropagation()
                  const base = jiraBase?.trim() || ''
                  const baseUrl = base
                    ? base.replace(/\/$/, '')
                    : typeof window !== 'undefined'
                      ? window.location.origin
                      : ''
                  const url = baseUrl
                    ? `${baseUrl}/browse/${issue.key}`
                    : `${issue.key}`
                  let ok = false
                  try {
                    await navigator.clipboard.writeText(url)
                    ok = true
                  } catch (err) {
                    try {
                      const el = document.createElement('textarea')
                      el.value = url
                      el.setAttribute('readonly', '')
                      el.style.position = 'fixed'
                      el.style.top = '-9999px'
                      document.body.appendChild(el)
                      el.select()
                      document.execCommand('copy')
                      document.body.removeChild(el)
                      ok = true
                    } catch {}
                  }
                  if (ok) {
                    setCopiedIssueLink(true)
                    setTimeout(() => setCopiedIssueLink(false), 1500)
                  }
                }}
              >
                <span className='relative inline-block h-3.5 w-3.5'>
                  <LinkIcon
                    className={`absolute inset-0 h-3.5 w-3.5 transition-opacity duration-500 ${copiedIssueLink ? 'opacity-0' : 'opacity-100'}`}
                    aria-hidden={copiedIssueLink ? 'true' : 'false'}
                  />
                  <CheckCircle
                    className={`absolute inset-0 h-3.5 w-3.5 text-green-600 transition-opacity duration-500 ${copiedIssueLink ? 'opacity-100' : 'opacity-0'}`}
                    aria-hidden={copiedIssueLink ? 'false' : 'true'}
                  />
                </span>
                <span className='sr-only' aria-live='polite'>
                  {copiedIssueLink ? 'Issue link copied to clipboard' : ''}
                </span>
              </button>
              <h2 className='text-foreground line-clamp-2 text-xl font-semibold'>
                {displayIssue.summary}
              </h2>
            </div>
            <div className='flex items-center gap-2'></div>
          </DialogTitle>
        </DialogHeader>

        <div className='flex h-[calc(90vh-120px)]'>
          {/* Left side - Main content */}
          <div className='flex-1 overflow-y-auto p-6'>
            <div className='space-y-6'>
              {/* Success/Error Messages */}
              {success && (
                <Alert className='border-green-200 bg-green-50'>
                  <CheckCircle className='h-4 w-4 text-green-600' />
                  <AlertDescription className='text-green-800'>
                    {success}
                  </AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert className='border-red-200 bg-red-50'>
                  <AlertCircle className='h-4 w-4 text-red-600' />
                  <AlertDescription className='text-red-800'>
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              {/* Issue Metadata */}
              <div className='flex flex-wrap gap-2'>
                <Badge
                  variant='outline'
                  className='border-blue-200 bg-blue-50 text-blue-700'
                >
                  {issue.issuetype.name}
                </Badge>
                <Badge
                  variant='outline'
                  className={getPriorityColor(issue.priority.name)}
                >
                  {issue.priority.name}
                </Badge>
              </div>

              {/* Description */}
              {displayIssue.description && (
                <Card>
                  <CardHeader>
                    <CardTitle className='flex items-center gap-2 text-lg'>
                      <Component className='h-5 w-5' />
                      Description
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='prose prose-sm dark:prose-invert max-w-none'>
                      <div
                        className='text-sm leading-relaxed'
                        dangerouslySetInnerHTML={{
                          __html:
                            displayIssue.descriptionHtml ||
                            `<p>${(displayIssue.description || '')
                              .replace(/&/g, '&amp;')
                              .replace(/</g, '&lt;')
                              .replace(/>/g, '&gt;')
                              .replace(/\n/g, '<br />')}</p>`
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Labels */}
              {displayIssue.labels.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className='flex items-center gap-2 text-lg'>
                      <Tag className='h-5 w-5' />
                      Labels
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='flex flex-wrap gap-2'>
                      {displayIssue.labels.map((label) => (
                        <Badge
                          key={label}
                          variant='secondary'
                          className='text-sm'
                        >
                          {label}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Components */}
              {displayIssue.components.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className='flex items-center gap-2 text-lg'>
                      <Component className='h-5 w-5' />
                      Components
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='flex flex-wrap gap-2'>
                      {displayIssue.components.map((component) => (
                        <Badge
                          key={component.name}
                          variant='outline'
                          className='text-sm'
                        >
                          {component.name}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Attachments */}
              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center justify-between text-lg'>
                    <span>Attachments</span>
                    {detailsLoading && (
                      <span className='text-muted-foreground text-sm flex items-center gap-2'>
                        <Loader2 className='h-4 w-4 animate-spin' /> Loading...
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {details && details.attachments.length > 0 ? (
                    <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
                      {details.attachments.map((att) => {
                        const previewUrl = `/api/issues/${issue.key}/attachments/${att.id}?disposition=inline`
                        const isPdf =
                          (att.mimeType &&
                            att.mimeType.toLowerCase().includes('pdf')) ||
                          /\.pdf$/i.test(att.filename)
                        const canPreview = att.isImage || isPdf
                        return (
                          <div
                            key={att.id}
                            className='border rounded p-3 flex items-center gap-3 bg-muted/30'
                          >
                            {att.isImage ? (
                              <img
                                src={previewUrl}
                                alt={att.filename}
                                className='h-16 w-16 object-cover rounded border cursor-pointer hover:opacity-90'
                                onClick={() =>
                                  setPreview({
                                    url: previewUrl,
                                    filename: att.filename,
                                    mime: att.mimeType
                                  })
                                }
                              />
                            ) : (
                              <div
                                className={`h-16 w-16 flex items-center justify-center rounded border bg-white text-[10px] text-center px-1 ${canPreview ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                                onClick={() => {
                                  if (canPreview)
                                    setPreview({
                                      url: previewUrl,
                                      filename: att.filename,
                                      mime: att.mimeType
                                    })
                                }}
                              >
                                {isPdf ? 'PDF Preview' : 'File'}
                              </div>
                            )}
                            <div className='min-w-0 flex-1'>
                              <div className='truncate text-sm font-medium'>
                                {att.filename}
                              </div>
                              <div className='text-muted-foreground text-xs'>
                                {(att.size / 1024).toFixed(1)} KB
                              </div>
                            </div>
                            <a
                              href={`/api/issues/${issue.key}/attachments/${att.id}`}
                              className='text-blue-600 text-sm whitespace-nowrap'
                            >
                              Download
                            </a>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className='text-muted-foreground text-sm'>
                      {detailsLoading
                        ? 'Loading attachments...'
                        : 'No attachments'}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Comments */}
              <Card>
                <CardHeader className='pb-0'>
                  <Collapsible
                    open={commentsOpen}
                    onOpenChange={setCommentsOpen}
                  >
                    <CollapsibleTrigger asChild>
                      <button className='w-full flex items-center justify-between text-left focus:outline-none focus:ring-0'>
                        <CardTitle className='flex items-center justify-between text-lg w-full'>
                          <span className='flex items-center gap-2'>
                            Comments
                            {details?.comments?.length ? (
                              <Badge
                                variant='secondary'
                                className='text-xs px-2 py-0.5'
                              >
                                {details.comments.length}
                              </Badge>
                            ) : null}
                          </span>
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${commentsOpen ? 'rotate-180' : ''}`}
                          />
                        </CardTitle>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className='pt-4'>
                        {/* Add Comment Form */}
                        <div className='mb-5'>
                          <textarea
                            id='new-comment'
                            className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring min-h-[120px]'
                            placeholder='Write a comment…'
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            disabled={postingComment}
                          />
                          <div className='mt-2 flex items-center justify-between text-xs'>
                            <span className='text-muted-foreground'>
                              Press Enter for a new line. Click Add when ready.
                            </span>
                            <div className='flex items-center gap-3'>
                              {commentError && (
                                <span className='text-red-600'>
                                  {commentError}
                                </span>
                              )}
                              {commentSuccess && (
                                <span className='text-green-600'>
                                  {commentSuccess}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className='mt-3 flex justify-end'>
                            <Button
                              size='sm'
                              className='min-w-[120px] justify-center'
                              onClick={async () => {
                                if (!issue) return
                                const text = newComment.trim()
                                if (!text) {
                                  setCommentError('Please enter a comment')
                                  return
                                }
                                setPostingComment(true)
                                setCommentError(null)
                                setCommentSuccess(null)
                                try {
                                  const ok = await postIssueComment(
                                    issue.key,
                                    text
                                  )
                                  if (ok) {
                                    setCommentSuccess('Comment added')
                                    setNewComment('')
                                    await loadDetails()
                                  } else {
                                    setCommentError('Failed to add comment')
                                  }
                                } catch (e) {
                                  setCommentError('Failed to add comment')
                                } finally {
                                  setPostingComment(false)
                                }
                              }}
                              disabled={postingComment}
                            >
                              {postingComment ? (
                                <span className='inline-flex items-center gap-2'>
                                  <Loader2 className='h-4 w-4 animate-spin' />
                                  Posting…
                                </span>
                              ) : (
                                'Add Comment'
                              )}
                            </Button>
                          </div>
                        </div>

                        {details && details.comments.length > 0 ? (
                          <div className='space-y-3'>
                            {details.comments.map((c) => (
                              <CommentItem
                                key={c.id}
                                issueKey={issue.key}
                                comment={c}
                                onChanged={async () => {
                                  await loadDetails()
                                }}
                              />
                            ))}
                          </div>
                        ) : (
                          <div className='text-center text-muted-foreground text-sm py-6'>
                            {detailsLoading
                              ? 'Loading comments...'
                              : 'No comments yet'}
                          </div>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </CardHeader>
              </Card>

              {/* History */}
              <Card>
                <CardHeader>
                  <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
                    <CollapsibleTrigger asChild>
                      <button className='w-full flex items-center justify-between text-left'>
                        <CardTitle className='flex items-center justify-between text-lg w-full'>
                          <span>History</span>
                          <span className='flex items-center gap-2 text-sm text-muted-foreground'>
                            {details?.changelog?.length
                              ? `${details.changelog.length}`
                              : ''}
                            <ChevronDown
                              className={`h-4 w-4 transition-transform ${historyOpen ? 'rotate-180' : ''}`}
                            />
                          </span>
                        </CardTitle>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent>
                        {details && details.changelog.length > 0 ? (
                          <div className='space-y-3'>
                            {details.changelog.map((h) => (
                              <div key={h.id} className='text-sm'>
                                <div className='text-muted-foreground'>
                                  {h.author.displayName} •{' '}
                                  {new Date(h.created).toLocaleString()}
                                </div>
                                <ul className='ml-4 list-disc'>
                                  {h.items.map((it, idx) => (
                                    <li key={idx}>
                                      {it.field}: {it.fromString || '—'} →{' '}
                                      {it.toString || '—'}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className='text-muted-foreground text-sm'>
                            {detailsLoading
                              ? 'Loading history...'
                              : 'No history'}
                          </div>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </CardHeader>
              </Card>
            </div>
          </div>

          {/* Right side - Issue details and editing */}
          <div className='bg-muted/30 w-80 overflow-y-auto border-l p-4'>
            <div className='space-y-4'>
              <Button
                size='sm'
                variant='outline'
                onClick={async () => {
                  await Promise.all([
                    loadDetails(),
                    loadEditData(),
                    loadIssueBase()
                  ])
                  // also ask parent to refresh board data so other views stay in sync
                  try {
                    onUpdate()
                  } catch {}
                }}
                disabled={detailsLoading || loading}
                className='w-full justify-center'
                aria-label='Refresh details'
              >
                {detailsLoading ? (
                  <span className='inline-flex items-center gap-2 cursor-pointer'>
                    <Loader2 className='h-4 w-4 animate-spin' />
                    Refreshing…
                  </span>
                ) : (
                  <span className='inline-flex items-center gap-2 cursor-pointer'>
                    <RefreshCw className='h-4 w-4' />
                    Refresh
                  </span>
                )}
              </Button>
              {/* Status Section */}
              <Card>
                <CardHeader className='pb-3'>
                  <CardTitle className='flex items-center gap-2 text-sm'>
                    <Tag className='h-4 w-4' />
                    Status
                  </CardTitle>
                </CardHeader>
                <CardContent className='space-y-3'>
                  <div className='flex items-center gap-2'>
                    <Badge
                      variant='outline'
                      className={`${getStatusColor(displayIssue.status.name)} px-2 py-1 text-xs`}
                    >
                      {normalizedStatus}
                    </Badge>
                  </div>
                  {loading ? (
                    <div className='text-muted-foreground flex items-center gap-2'>
                      <Loader2 className='h-4 w-4 animate-spin' />
                      Loading transitions...
                    </div>
                  ) : (
                    <div className='space-y-2'>
                      <Label
                        htmlFor='status-select'
                        className='text-muted-foreground text-xs'
                      >
                        Change Status
                      </Label>
                      <Select
                        value={selectedTransition}
                        onValueChange={setSelectedTransition}
                      >
                        <SelectTrigger className='h-8 text-sm'>
                          <SelectValue placeholder='Select new status' />
                        </SelectTrigger>
                        <SelectContent>
                          {transitions.map((transition) => (
                            <SelectItem
                              key={transition.id}
                              value={transition.id}
                            >
                              {' '}
                              <span
                                className={`inline-block rounded border px-2 py-0.5 text-xs ${getStatusColor(transition.name)}`}
                              >
                                {transition.name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Assignee Section */}
              <Card>
                <CardHeader className='pb-3'>
                  <CardTitle className='flex items-center gap-2 text-sm'>
                    <User className='h-4 w-4' />
                    Assignee
                  </CardTitle>
                </CardHeader>
                <CardContent className='space-y-3'>
                  <div className='flex items-center gap-2'>
                    {displayIssue.assignee ? (
                      <>
                        <Avatar className='h-6 w-6'>
                          <AvatarImage
                            src={
                              displayIssue.assignee.avatarUrls['24x24'] ||
                              '/placeholder.svg'
                            }
                          />
                          <AvatarFallback className='text-xs'>
                            {displayIssue.assignee.displayName
                              .split(' ')
                              .map((n) => n[0])
                              .join('')}
                          </AvatarFallback>
                        </Avatar>
                        <span className='text-sm font-medium'>
                          {displayIssue.assignee.displayName}
                        </span>
                      </>
                    ) : (
                      <span className='text-muted-foreground text-sm'>
                        Unassigned
                      </span>
                    )}
                  </div>
                  {loading ? (
                    <div className='text-muted-foreground flex items-center gap-2'>
                      <Loader2 className='h-4 w-4 animate-spin' />
                      Loading users...
                    </div>
                  ) : (
                    <div className='space-y-2'>
                      <Label
                        htmlFor='assignee-select'
                        className='text-muted-foreground text-xs'
                      >
                        Change Assignee
                      </Label>
                      <Select
                        value={selectedAssignee}
                        onValueChange={setSelectedAssignee}
                      >
                        <SelectTrigger className='h-8 text-sm'>
                          <SelectValue placeholder='Select assignee' />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='unassigned'>Unassigned</SelectItem>
                          {projectUsers.map((user) => (
                            <SelectItem
                              key={user.accountId}
                              value={user.displayName}
                            >
                              {user.displayName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Fix Versions Section */}
              <Card>
                <CardHeader className='pb-3'>
                  <CardTitle className='flex items-center gap-2 text-sm'>
                    <Tag className='h-4 w-4' />
                    Fix Versions
                  </CardTitle>
                </CardHeader>
                <CardContent className='space-y-3'>
                  {/* Current selection as badges */}
                  <div className='flex flex-wrap gap-1'>
                    {selectedVersionIds.length > 0 ? (
                      projectVersions
                        .filter((v) => selectedVersionIds.includes(v.id))
                        .map((v) => (
                          <Badge
                            key={v.id}
                            variant='secondary'
                            className='text-xs'
                          >
                            {v.name}
                          </Badge>
                        ))
                    ) : (
                      <span className='text-muted-foreground text-sm'>
                        No Release
                      </span>
                    )}
                  </div>

                  {/* Dropdown multi-select for versions */}
                  {projectVersions.length === 0 ? (
                    <div className='text-muted-foreground text-sm flex items-center gap-2'>
                      <Loader2 className='h-4 w-4 animate-spin' /> Loading
                      versions…
                    </div>
                  ) : (
                    <div className='space-y-2'>
                      <Popover
                        open={versionsOpen}
                        onOpenChange={setVersionsOpen}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant='outline'
                            role='combobox'
                            aria-expanded={versionsOpen}
                            className={`bg-background hover:bg-accent w-full justify-between ${selectedVersionIds.length === 0 ? 'text-muted-foreground' : ''}`}
                          >
                            <div className='flex items-center gap-2'>
                              <Tag className='h-4 w-4 shrink-0' />
                              {selectedVersionIds.length === 0
                                ? 'Click to select version(s)...'
                                : selectedVersionIds.length === 1
                                  ? projectVersions.find(
                                      (v) => v.id === selectedVersionIds[0]
                                    )?.name || '1 selected'
                                  : `${selectedVersionIds.length} versions selected`}
                            </div>
                            <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className='w-[400px] p-0' align='start'>
                          <Command>
                            <CommandInput
                              placeholder='Search versions...'
                              className='h-9'
                            />

                            {/* Visibility controls */}
                            <div className='bg-muted/30 border-b px-3 py-2'>
                              <div className='flex items-center justify-between'>
                                <div className='text-muted-foreground text-xs font-medium'>
                                  Showing{' '}
                                  {
                                    projectVersions.filter(
                                      (v) =>
                                        !v.archived &&
                                        (showReleased || !v.released)
                                    ).length
                                  }{' '}
                                  of{' '}
                                  {
                                    projectVersions.filter((v) => !v.archived)
                                      .length
                                  }{' '}
                                  versions
                                </div>
                                <div className='flex items-center gap-2'>
                                  <Checkbox
                                    id='show-released'
                                    checked={showReleased}
                                    onCheckedChange={(checked) =>
                                      setShowReleased(!!checked)
                                    }
                                  />
                                  <Label
                                    htmlFor='show-released'
                                    className='flex cursor-pointer items-center gap-1 text-xs'
                                  >
                                    {showReleased ? (
                                      <Eye className='h-3 w-3' />
                                    ) : (
                                      <EyeOff className='h-3 w-3' />
                                    )}
                                    Show released
                                  </Label>
                                </div>
                              </div>
                            </div>

                            <CommandList>
                              <CommandEmpty>No versions found.</CommandEmpty>
                              <CommandGroup>
                                {projectVersions
                                  .filter(
                                    (v) =>
                                      !v.archived &&
                                      (showReleased || !v.released)
                                  )
                                  .sort((a, b) => a.name.localeCompare(b.name))
                                  .map((v) => (
                                    <CommandItem
                                      key={v.id}
                                      value={v.name}
                                      onSelect={() => {
                                        setSelectedVersionIds((prev) => {
                                          const set = new Set(prev)
                                          if (set.has(v.id)) set.delete(v.id)
                                          else set.add(v.id)
                                          return Array.from(set)
                                        })
                                      }}
                                      className='flex items-center justify-between py-2'
                                    >
                                      <div className='flex min-w-0 flex-1 items-center gap-2'>
                                        <Check
                                          className={`${selectedVersionIds.includes(v.id) ? 'text-primary opacity-100' : 'opacity-0'} h-4 w-4 shrink-0`}
                                        />
                                        <span className='truncate font-medium'>
                                          {v.name}
                                        </span>
                                      </div>
                                      <Badge
                                        variant='outline'
                                        className={`ml-2 shrink-0 text-xs ${v.released ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200' : 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-200'}`}
                                      >
                                        {v.released ? 'released' : 'unreleased'}
                                      </Badge>
                                    </CommandItem>
                                  ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Reporter */}
              <Card>
                <CardHeader className='pb-3'>
                  <CardTitle className='flex items-center gap-2 text-sm'>
                    <User className='h-4 w-4' />
                    Reporter
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='flex items-center gap-2'>
                    <Avatar className='h-6 w-6'>
                      <AvatarImage
                        src={
                          issue.reporter.avatarUrls['24x24'] ||
                          '/placeholder.svg'
                        }
                      />
                      <AvatarFallback className='text-xs'>
                        {issue.reporter.displayName
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}
                      </AvatarFallback>
                    </Avatar>
                    <span className='text-sm font-medium'>
                      {issue.reporter.displayName}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Due Date */}
              {issue.duedate && (
                <Card>
                  <CardHeader className='pb-3'>
                    <CardTitle className='flex items-center gap-2 text-sm'>
                      <Calendar className='h-4 w-4' />
                      Due Date
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <span className='text-sm font-medium'>
                      {new Date(issue.duedate).toLocaleDateString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </CardContent>
                </Card>
              )}

              {/* Created */}
              <Card>
                <CardHeader className='pb-3'>
                  <CardTitle className='flex items-center gap-2 text-sm'>
                    <Clock className='h-4 w-4' />
                    Created
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <span className='text-sm'>
                    {new Date(displayIssue.created).toLocaleDateString(
                      undefined,
                      {
                        hour: '2-digit',
                        minute: '2-digit'
                      }
                    )}
                  </span>
                </CardContent>
              </Card>

              {/* Updated */}
              <Card>
                <CardHeader className='pb-3'>
                  <CardTitle className='flex items-center gap-2 text-sm'>
                    <Clock className='h-4 w-4' />
                    Last Updated
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <span className='text-sm'>
                    {new Date(displayIssue.updated).toLocaleDateString(
                      undefined,
                      {
                        hour: '2-digit',
                        minute: '2-digit'
                      }
                    )}
                  </span>
                </CardContent>
              </Card>
            </div>
            {hasChanges && (
              <div className='sticky bottom-0 -m-4 mt-4 border-t bg-muted/50 p-4'>
                <Button
                  size='sm'
                  onClick={handleSave}
                  disabled={saving || loading}
                  className='w-full justify-center'
                >
                  {saving ? (
                    <span className='inline-flex items-center gap-2 cursor-pointer'>
                      <Loader2 className='h-4 w-4 animate-spin' />
                      Saving…
                    </span>
                  ) : (
                    <span className='inline-flex items-center gap-2 cursor-pointer'>
                      <Save className='h-4 w-4' />
                      Save Changes
                    </span>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
        {preview && (
          <Dialog
            open={!!preview}
            onOpenChange={(open) => !open && setPreview(null)}
          >
            <DialogContent className='max-w-[95vw] w-[95vw] p-0'>
              <DialogHeader className='bg-muted/50 border-b px-3 py-2'>
                <DialogTitle
                  className='flex items-center justify-between text-sm font-medium truncate'
                  title={preview.filename}
                >
                  <span className='truncate'>{preview.filename}</span>
                </DialogTitle>
              </DialogHeader>
              <div className='relative w-full h-full'>
                {(preview.mime && preview.mime.toLowerCase().includes('pdf')) ||
                /\.pdf$/i.test(preview.filename) ? (
                  <iframe
                    src={preview.url}
                    className='w-full h-full rounded-none border-0'
                  />
                ) : (
                  <img
                    src={preview.url}
                    alt={preview.filename}
                    className='w-full h-full object-contain px-8'
                  />
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  )
}
