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
  ChevronDown
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
  fetchIssueDetails
} from '@/lib/client-api'
import { normalizeStatusName, getStatusColor } from '@/lib/utils'
import type { JiraIssue, JiraUser, JiraIssueDetails } from '@/types/jira'

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
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(true)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [preview, setPreview] = useState<{
    url: string
    filename: string
    mime?: string
  } | null>(null)

  useEffect(() => {
    if (issue && isOpen) {
      loadEditData()
      loadDetails()
      setSelectedAssignee(issue.assignee?.displayName || 'unassigned')
      setSelectedTransition('')
      setHasChanges(false)
    }
  }, [issue, isOpen])

  // Clear messages when changes are made
  useEffect(() => {
    setError(null)
    setSuccess(null)
  }, [selectedTransition, selectedAssignee])

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

    setHasChanges(hasStatusChange || hasAssigneeChange)
  }, [selectedTransition, selectedAssignee, issue])

  const loadDetails = async () => {
    if (!issue) return
    setDetailsLoading(true)
    try {
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

      setTransitions(normalizedTransitions)
      setProjectUsers(usersData)
    } catch (error) {
      console.error('Error loading edit data:', error)
      setError('Failed to load editing options. Please try again.')
    } finally {
      setLoading(false)
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

  const normalizedStatus = normalizeStatusName(issue.status.name)

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className='max-h-[90vh] max-w-6xl p-0'>
        <DialogHeader className='bg-muted/50 border-b px-6 py-4'>
          <DialogTitle className='flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              <Badge variant='outline' className='px-3 py-1 font-mono text-sm'>
                {issue.key}
              </Badge>
              <h2 className='text-foreground line-clamp-2 text-xl font-semibold'>
                {issue.summary}
              </h2>
            </div>
            <div className='flex items-center gap-2'>
              {hasChanges && (
                <Button
                  size='sm'
                  onClick={handleSave}
                  disabled={saving || loading}
                >
                  {saving ? (
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  ) : (
                    <Save className='mr-2 h-4 w-4' />
                  )}
                  Save Changes
                </Button>
              )}
            </div>
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
              {issue.description && (
                <Card>
                  <CardHeader>
                    <CardTitle className='flex items-center gap-2 text-lg'>
                      <Component className='h-5 w-5' />
                      Description
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='prose prose-sm max-w-none'>
                      <pre className='font-sans text-sm leading-relaxed whitespace-pre-wrap text-gray-700'>
                        {issue.description}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Labels */}
              {issue.labels.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className='flex items-center gap-2 text-lg'>
                      <Tag className='h-5 w-5' />
                      Labels
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='flex flex-wrap gap-2'>
                      {issue.labels.map((label) => (
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
              {issue.components.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className='flex items-center gap-2 text-lg'>
                      <Component className='h-5 w-5' />
                      Components
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='flex flex-wrap gap-2'>
                      {issue.components.map((component) => (
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
                <CardHeader>
                  <Collapsible
                    open={commentsOpen}
                    onOpenChange={setCommentsOpen}
                  >
                    <CollapsibleTrigger asChild>
                      <button className='w-full flex items-center justify-between text-left'>
                        <CardTitle className='flex items-center justify-between text-lg w-full'>
                          <span>Comments</span>
                          <span className='flex items-center gap-2 text-sm text-muted-foreground'>
                            {details?.comments?.length
                              ? `${details.comments.length}`
                              : ''}
                            <ChevronDown
                              className={`h-4 w-4 transition-transform ${commentsOpen ? 'rotate-180' : ''}`}
                            />
                          </span>
                        </CardTitle>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent>
                        {details && details.comments.length > 0 ? (
                          <div className='space-y-4'>
                            {details.comments.map((c) => (
                              <div key={c.id} className='flex gap-3'>
                                <Avatar className='h-8 w-8'>
                                  <AvatarImage
                                    src={
                                      c.author.avatarUrls?.['24x24'] ||
                                      '/placeholder.svg'
                                    }
                                  />
                                  <AvatarFallback>
                                    {c.author.displayName
                                      .split(' ')
                                      .map((n) => n[0])
                                      .join('')}
                                  </AvatarFallback>
                                </Avatar>
                                <div className='min-w-0 flex-1'>
                                  <div className='flex items-center gap-2 text-sm'>
                                    <span className='font-medium'>
                                      {c.author.displayName}
                                    </span>
                                    <span className='text-muted-foreground'>
                                      • {new Date(c.created).toLocaleString()}
                                    </span>
                                  </div>
                                  <div className='mt-1 whitespace-pre-wrap text-sm'>
                                    {c.body}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className='text-muted-foreground text-sm'>
                            {detailsLoading
                              ? 'Loading comments...'
                              : 'No comments'}
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
                      className={`${getStatusColor(issue.status.name)} px-2 py-1 text-xs`}
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
                              {transition.name}
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
                    {issue.assignee ? (
                      <>
                        <Avatar className='h-6 w-6'>
                          <AvatarImage
                            src={
                              issue.assignee.avatarUrls['24x24'] ||
                              '/placeholder.svg'
                            }
                          />
                          <AvatarFallback className='text-xs'>
                            {issue.assignee.displayName
                              .split(' ')
                              .map((n) => n[0])
                              .join('')}
                          </AvatarFallback>
                        </Avatar>
                        <span className='text-sm font-medium'>
                          {issue.assignee.displayName}
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
                    {new Date(issue.created).toLocaleDateString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
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
                    {new Date(issue.updated).toLocaleDateString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
        {preview && (
          <Dialog
            open={!!preview}
            onOpenChange={(open) => !open && setPreview(null)}
          >
            <DialogContent className='max-w-5xl w-[95vw] h-[90vh] p-0'>
              <div className='relative w-full h-full'>
                <span className='absolute top-2 left-2 z-10 max-w-[80%] truncate rounded bg-black/50 px-2 py-1 text-[11px] text-white'>
                  {preview.filename}
                </span>
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
