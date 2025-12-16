'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { LinkIssuePicker } from '@/components/link-issue-picker'
import { VersionsMultiSelect } from '@/components/versions-multi-select'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible'
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronsDown,
  ChevronsUp,
  Clock,
  Component,
  Minus,
  Link as LinkIcon,
  Loader2,
  RefreshCw,
  Save,
  Tag,
  Trash2,
  User,
  X
} from 'lucide-react'
import {
  createIssueClient,
  deleteIssueComment,
  editIssueComment,
  fetchIssue,
  fetchIssueDetails,
  fetchIssueSuggestions,
  fetchIssueTransitions,
  fetchIssueTypes,
  fetchProjectComponents,
  fetchProjectSprints,
  fetchProjectUsers,
  fetchProjectVersions,
  getCachedData,
  linkIssueClient,
  postIssueComment,
  updateIssueAssignee,
  updateIssueDescription,
  updateIssueFixVersions,
  updateIssueSprint,
  updateIssueStatus,
  uploadIssueAttachments,
  deleteIssueAttachment,
  updateIssuePriority,
  updateIssueComponents
} from '@/lib/client-api'
import { usePasteImage, insertAtCursor } from '@/lib/use-paste-image'
import { useToast } from '@/lib/use-toast'
import {
  decodeHtmlEntities,
  getInitials,
  getStatusColor,
  getStatusGroupRank,
  isEditableTarget,
  normalizeStatusName
} from '@/lib/utils'
import { JiraComment } from '@/types/JiraComment'
import { JiraIssue } from '@/types/JiraIssue'
import { JiraIssueDetails } from '@/types/JiraIssueDetails'
import { JiraUser } from '@/types/JiraUser'

const PRIORITY_OPTIONS = [
  { value: 'Highest', tone: 'text-[hsl(var(--destructive))]' },
  { value: 'High', tone: 'text-[hsl(var(--chart-4))]' },
  { value: 'Medium', tone: 'text-[hsl(var(--chart-1))]' },
  { value: 'Low', tone: 'text-[hsl(var(--chart-5))]' },
  { value: 'Lowest', tone: 'text-muted-foreground' }
]

const PriorityGlyph = ({ level }: { level: string }) => {
  const normalized = level.toLowerCase()
  const tone =
    PRIORITY_OPTIONS.find((p) => p.value.toLowerCase() === normalized)?.tone ||
    'text-muted-foreground'

  if (normalized === 'highest') {
    return <ChevronsUp className={`h-3.5 w-3.5 ${tone}`} />
  }
  if (normalized === 'high') {
    return <ChevronUp className={`h-3.5 w-3.5 ${tone}`} />
  }
  if (normalized === 'medium') {
    return <Minus className={`h-3.5 w-3.5 ${tone}`} />
  }
  if (normalized === 'low') {
    return <ChevronDown className={`h-3.5 w-3.5 ${tone}`} />
  }
  if (normalized === 'lowest') {
    return <ChevronsDown className={`h-3.5 w-3.5 ${tone}`} />
  }
  return <Minus className={`h-3.5 w-3.5 ${tone}`} />
}

interface IssueModalProps {
  issueId?: string
  issue?: JiraIssue | null
  projectKey: string
  isOpen: boolean
  onClose: () => void
  onCreated?: (issueKey: string) => void
  onUpdated?: () => void
}

interface IssueEditProps {
  issue: JiraIssue | null
  projectKey: string
  isOpen: boolean
  onClose: () => void
  onUpdate: () => void
}

interface IssueCreateProps {
  projectKey: string
  isOpen: boolean
  onClose: () => void
  onCreated: (issueKey: string) => void
}

export function IssueModal({
  issueId,
  issue,
  projectKey,
  isOpen,
  onClose,
  onCreated,
  onUpdated
}: IssueModalProps) {
  if (issueId) {
    return (
      <IssueEditContent
        issue={issue ?? null}
        projectKey={projectKey}
        isOpen={isOpen}
        onClose={onClose}
        onUpdate={onUpdated ?? (() => {})}
      />
    )
  }

  return (
    <IssueCreateContent
      projectKey={projectKey}
      isOpen={isOpen}
      onClose={onClose}
      onCreated={onCreated ?? (() => {})}
    />
  )
}

function IssueEditContent({
  issue,
  projectKey,
  isOpen,
  onClose,
  onUpdate
}: IssueEditProps) {
  // Keyboard shortcut: 'a' to open assignee selector; 's' to open status selector
  const assigneeTriggerRef = useRef<HTMLButtonElement | null>(null)
  const [assigneeSelectOpen, setAssigneeSelectOpen] = useState(false)
  const statusTriggerRef = useRef<HTMLButtonElement | null>(null)
  const [statusSelectOpen, setStatusSelectOpen] = useState(false)
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      if (isEditableTarget(e.target)) return
      const key = e.key.toLowerCase()
      if (key === 'a') {
        e.preventDefault()
        setAssigneeSelectOpen(true)
        // focus the trigger so Radix Select knows the anchor
        assigneeTriggerRef.current?.focus()
      } else if (key === 's') {
        e.preventDefault()
        setStatusSelectOpen(true)
        statusTriggerRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen])
  // Nested component for individual comment with actions
  // Helper: extract MP4 urls from HTML or plain text
  const extractMp4Urls = (input: string | undefined | null): string[] => {
    if (!input) return []
    const urls = new Set<string>()

    // 1) From href/src attributes with absolute http(s) URLs ending in .mp4
    const hrefAbs = /href=["'](https?:\/\/[^"']+?\.mp4)(?:\?[^"']*)?["']/gi
    let m: RegExpExecArray | null
    while ((m = hrefAbs.exec(input))) {
      urls.add(m[1])
    }
    const srcAbs = /src=["'](https?:\/\/[^"']+?\.mp4)(?:\?[^"']*)?["']/gi
    while ((m = srcAbs.exec(input))) {
      urls.add(m[1])
    }

    // 2) From href/src attributes with relative URLs ending in .mp4
    const hrefRel = /href=["'](\/["']?[^"']*?\.mp4)(?:\?[^"']*)?["']/gi
    while ((m = hrefRel.exec(input))) {
      urls.add(m[1])
    }
    const srcRel = /src=["'](\/["']?[^"']*?\.mp4)(?:\?[^"']*)?["']/gi
    while ((m = srcRel.exec(input))) {
      urls.add(m[1])
    }

    // 3) From plain text absolute and relative URLs that end in .mp4
    const urlAbs = /(https?:\/\/[^\s"'>]+?\.mp4)(?:\?[^\s"'>]*)?/gi
    let n: RegExpExecArray | null
    while ((n = urlAbs.exec(input))) {
      urls.add(n[1])
    }
    const urlRel = /(\/[^\s"'>]+?\.mp4)(?:\?[^\s"'>]*)?/gi
    while ((n = urlRel.exec(input))) {
      urls.add(n[1])
    }

    // 4) Special case: Jira ADF renders attachments as <img> with alt containing the filename.
    // If the <img> alt ends with .mp4, treat its src as a playable video URL even if src lacks .mp4.
    const imgTagRegex = /<img\b[^>]*>/gi
    let t: RegExpExecArray | null
    while ((t = imgTagRegex.exec(input))) {
      const tag = t[0]
      const altMatch = tag.match(/alt=["']([^"']+)["']/i)
      if (altMatch && /\.mp4$/i.test(altMatch[1].trim())) {
        const srcMatch = tag.match(/src=["']([^"']+)["']/i)
        if (srcMatch) {
          urls.add(srcMatch[1])
        }
      }
    }

    return Array.from(urls)
  }

  const filenameFromUrl = (url: string) => {
    try {
      const u = new URL(url)
      const pathname = u.pathname
      const base = pathname.split('/').pop() || 'video.mp4'
      return decodeURIComponent(base)
    } catch {
      return url.split('/').pop() || 'video.mp4'
    }
  }

  const VideoThumb = ({ url }: { url: string }) => {
    const name = filenameFromUrl(url)
    return (
      <button
        type='button'
        className='group relative inline-flex items-center justify-center rounded-md border bg-black/40 overflow-hidden w-40 h-24'
        onClick={() => setPreview({ url, filename: name, mime: 'video/mp4' })}
        title={`Play ${name}`}
      >
        <video
          className='w-full h-full object-cover opacity-80 group-hover:opacity-60 transition-opacity'
          muted
          preload='metadata'
          src={url + '#t=0.1'}
        />
        <span className='absolute inset-0 flex items-center justify-center'>
          <span className='inline-flex items-center justify-center rounded-full bg-black/70 text-white p-2 shadow-lg'>
            ▶
          </span>
        </span>
      </button>
    )
  }

  function CommentItem({
    issueKey,
    comment,
    onChanged,
    projectUsers
  }: {
    issueKey: string
    comment: JiraComment
    onChanged: () => void | Promise<void>
    projectUsers: JiraUser[]
  }) {
    const [isEditing, setIsEditing] = useState(false)
    const [editText, setEditText] = useState(comment.body)
    const [saving, setSaving] = useState(false)
    const [err, setErr] = useState<string | null>(null)
    const [copiedCommentLink, setCopiedCommentLink] = useState(false)

    // Inline video enhancement for rendered comment HTML
    const commentHtmlRef = useRef<HTMLDivElement | null>(null)
    useEffect(() => {
      const root = commentHtmlRef.current
      if (!root) return

      const makeThumb = (url: string) => {
        const name = filenameFromUrl(url)
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className =
          'group relative inline-flex items-center justify-center rounded-md border bg-black/40 overflow-hidden w-40 h-24 align-middle'
        btn.title = `Play ${name}`
        btn.setAttribute('data-inline-video', 'true')

        const vid = document.createElement('video')
        vid.className =
          'w-full h-full object-cover opacity-80 group-hover:opacity-60 transition-opacity'
        vid.muted = true
        vid.playsInline = true
        vid.preload = 'metadata'
        vid.src = url + '#t=0.1'

        const overlay = document.createElement('span')
        overlay.className = 'absolute inset-0 flex items-center justify-center'
        const inner = document.createElement('span')
        inner.className =
          'inline-flex items-center justify-center rounded-full bg-black/70 text-white p-2 shadow-lg'
        inner.textContent = '▶'
        overlay.appendChild(inner)

        btn.appendChild(vid)
        btn.appendChild(overlay)
        btn.addEventListener('click', () => {
          setPreview({ url, filename: name, mime: 'video/mp4' })
        })
        return btn
      }

      // Replace Jira ADF images that actually represent MP4s
      const imgs = Array.from(
        root.querySelectorAll('img[alt$=".mp4" i]')
      ) as HTMLImageElement[]
      imgs.forEach((img) => {
        const src = img.getAttribute('src')
        if (!src) return
        const btn = makeThumb(src)
        img.replaceWith(btn)
      })

      // Replace anchor links that point to MP4s
      const anchors = Array.from(
        root.querySelectorAll('a[href]')
      ) as HTMLAnchorElement[]
      anchors.forEach((a) => {
        const href = a.getAttribute('href') || ''
        if (/\.mp4(\?|$)/i.test(href)) {
          const btn = makeThumb(href)
          a.replaceWith(btn)
        }
      })
    }, [comment.bodyHtml, comment.body])

    // Mention autocomplete state for edit textarea
    const editTextareaRef = useRef<HTMLTextAreaElement | null>(null)
    const [editMentionOpen, setEditMentionOpen] = useState(false)
    const [editMentionQuery, setEditMentionQuery] = useState('')
    const [editMentionStart, setEditMentionStart] = useState<number | null>(
      null
    )
    const [editMentionIndex, setEditMentionIndex] = useState(0)

    // Paste image handling for edit comment
    const {
      onPaste: handleEditCommentPaste,
      isUploading: isUploadingEditComment
    } = usePasteImage({
      issueKey,
      onInsert: (token, textarea) => {
        insertAtCursor(textarea, token, setEditText)
      },
      onUploadEnd: (success, error) => {
        if (success) {
          // Refresh to show new attachment
          onChanged()
        }
      }
    })

    const detectMentionTrigger = (value: string, caret: number) => {
      const prefix = value.slice(0, caret)
      const m = prefix.match(/(^|\s)@([\w .\-]{1,40})$/)
      if (m) {
        const query = m[2]
        const start = caret - query.length - 1
        return { query, start }
      }
      return null
    }

    const insertMentionTokenAtCaret = (
      ta: HTMLTextAreaElement,
      displayName: string,
      accountId: string,
      startIndex: number | null
    ) => {
      const selStart = ta.selectionStart
      const selEnd = ta.selectionEnd
      const start = startIndex ?? selStart
      const before = editText.slice(0, start)
      const after = editText.slice(selEnd)
      const token = `@[${displayName}|${accountId}]`
      const next = before + token + after
      setEditText(next)
      // Move caret to after token
      const pos = (before + token).length
      requestAnimationFrame(() => {
        ta.focus()
        ta.setSelectionRange(pos, pos)
      })
    }

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
                className={`${copiedCommentLink ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity duration-500 inline-flex items-center gap-1 border border-border rounded-md px-2 py-0.5 hover:bg-muted`}
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
                    className={`absolute inset-0 h-3.5 w-3.5 text-[hsl(var(--chart-5))] transition-opacity duration-500 ${copiedCommentLink ? 'opacity-100' : 'opacity-0'}`}
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
                className='hover:underline text-[hsl(var(--destructive))]'
                onClick={handleDelete}
              >
                Delete
              </button>
            </div>
          </div>

          {isEditing ? (
            <div className='mt-2 relative'>
              <textarea
                ref={editTextareaRef}
                className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring min-h-[90px]'
                value={editText}
                onChange={(e) => {
                  const val = e.target.value
                  setEditText(val)
                  const caret = e.target.selectionStart || val.length
                  const t = detectMentionTrigger(val, caret)
                  if (t) {
                    setEditMentionOpen(true)
                    setEditMentionQuery(t.query)
                    setEditMentionStart(t.start)
                    setEditMentionIndex(0)
                  } else {
                    setEditMentionOpen(false)
                    setEditMentionQuery('')
                    setEditMentionStart(null)
                  }
                }}
                onKeyDown={(e) => {
                  if (editMentionOpen) {
                    const candidates = (projectUsers || [])
                      .filter((u) =>
                        (u.displayName || '')
                          .toLowerCase()
                          .includes((editMentionQuery || '').toLowerCase())
                      )
                      .slice(0, 8)
                    if (e.key === 'ArrowDown') {
                      e.preventDefault()
                      setEditMentionIndex((i) =>
                        Math.min(candidates.length - 1, i + 1)
                      )
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault()
                      setEditMentionIndex((i) => Math.max(0, i - 1))
                    } else if (e.key === 'Enter') {
                      const ta = editTextareaRef.current
                      if (ta && candidates.length) {
                        const u = candidates[editMentionIndex] || candidates[0]
                        e.preventDefault()
                        insertMentionTokenAtCaret(
                          ta,
                          u.displayName,
                          u.accountId,
                          editMentionStart
                        )
                        setEditMentionOpen(false)
                        setEditMentionQuery('')
                        setEditMentionStart(null)
                        setEditMentionIndex(0)
                      }
                    } else if (e.key === 'Escape') {
                      e.preventDefault()
                      setEditMentionOpen(false)
                    }
                  }
                }}
                onClick={(e) => {
                  const ta = e.currentTarget
                  const caret = ta.selectionStart || 0
                  const t = detectMentionTrigger(ta.value, caret)
                  if (t) {
                    setEditMentionOpen(true)
                    setEditMentionQuery(t.query)
                    setEditMentionStart(t.start)
                  } else {
                    setEditMentionOpen(false)
                  }
                }}
                onPaste={handleEditCommentPaste}
                disabled={saving || isUploadingEditComment}
              />
              {isUploadingEditComment && (
                <div className='absolute inset-0 flex items-center justify-center bg-background/80 rounded-md'>
                  <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                    <Loader2 className='h-4 w-4 animate-spin' />
                    Uploading image...
                  </div>
                </div>
              )}
              {editMentionOpen && projectUsers?.length ? (
                <div className='absolute z-20 left-0 mt-1 w-64 max-h-60 overflow-auto rounded-md border border-border bg-popover shadow-sm'>
                  <div className='p-2 border-b border-border text-xs text-muted-foreground'>
                    Mention someone
                  </div>
                  {projectUsers
                    .filter((u) =>
                      (u.displayName || '')
                        .toLowerCase()
                        .includes((editMentionQuery || '').toLowerCase())
                    )
                    .slice(0, 8)
                    .map((u, idx) => (
                      <button
                        key={u.accountId}
                        type='button'
                        className={`flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-accent hover:text-accent-foreground ${idx === editMentionIndex ? 'bg-accent text-accent-foreground' : ''}`}
                        onMouseEnter={() => setEditMentionIndex(idx)}
                        onMouseDown={(ev) => ev.preventDefault()}
                        onClick={() => {
                          const ta = editTextareaRef.current
                          if (!ta) return
                          insertMentionTokenAtCaret(
                            ta,
                            u.displayName,
                            u.accountId,
                            editMentionStart
                          )
                          setEditMentionOpen(false)
                        }}
                      >
                        <span className='inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs'>
                          @
                        </span>
                        <span className='truncate'>{u.displayName}</span>
                      </button>
                    ))}
                </div>
              ) : null}
              <div className='mt-2 flex items-center justify-end gap-2'>
                {err && (
                  <span className='mr-auto text-xs text-[hsl(var(--destructive))]'>
                    {err}
                  </span>
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
            <>
              <div
                ref={commentHtmlRef}
                className='mt-1 text-sm jira-description prose prose-invert max-w-none'
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
            </>
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
    Array<{
      id: string
      name: string
      released: boolean
      archived?: boolean
    }>
  >([])
  const [selectedVersionIds, setSelectedVersionIds] = useState<string[]>([])
  const [selectedPriority, setSelectedPriority] = useState<string>('')
  const [projectComponents, setProjectComponents] = useState<
    Array<{ id: string; name: string }>
  >([])
  const [selectedComponentId, setSelectedComponentId] = useState<string>('')
  const [componentSelectOpen, setComponentSelectOpen] = useState(false)
  const [projectSprints, setProjectSprints] = useState<
    Array<{ id: string; name: string; state: string }>
  >([])
  const [selectedSprintId, setSelectedSprintId] = useState<string>('')
  const [sprintSelectOpen, setSprintSelectOpen] = useState(false)
  const [sprintsLoading, setSprintsLoading] = useState(false)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(true)
  const [attachmentsOpen, setAttachmentsOpen] = useState(true)
  const [freshIssue, setFreshIssue] = useState<JiraIssue | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [deletingAttachments, setDeletingAttachments] = useState<Set<string>>(
    new Set()
  )
  const [preview, setPreview] = useState<{
    url: string
    filename: string
    mime?: string
  } | null>(null)
  const [newComment, setNewComment] = useState('')
  const [postingComment, setPostingComment] = useState(false)
  const [commentError, setCommentError] = useState<string | null>(null)
  const [commentSuccess, setCommentSuccess] = useState<string | null>(null)
  const [planningOpen, setPlanningOpen] = useState(false)

  // Mention autocomplete for new comment
  const newTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [newMentionOpen, setNewMentionOpen] = useState(false)
  const [newMentionQuery, setNewMentionQuery] = useState('')
  const [newMentionStart, setNewMentionStart] = useState<number | null>(null)
  const [newMentionIndex, setNewMentionIndex] = useState(0)

  // Toast for paste image feedback
  const { toast } = useToast()

  // Paste image handling for new comment
  const { onPaste: handleNewCommentPaste, isUploading: isUploadingNewComment } =
    usePasteImage({
      issueKey: issue?.key ?? null,
      onInsert: (token, textarea) => {
        insertAtCursor(textarea, token, setNewComment)
      },
      onUploadStart: () => {
        // Optionally show uploading state
      },
      onUploadEnd: (success, error) => {
        if (success) {
          toast({
            title: 'Image uploaded',
            description:
              'Image has been attached and inserted into your comment.'
          })
          // Refresh attachments list
          loadDetails()
        } else {
          toast({
            title: 'Upload failed',
            description: error || 'Failed to upload image',
            variant: 'destructive'
          })
        }
      }
    })

  const detectNewMentionTrigger = (value: string, caret: number) => {
    const prefix = value.slice(0, caret)
    const m = prefix.match(/(^|\s)@([\w .\-]{1,40})$/)
    if (m) {
      const query = m[2]
      const start = caret - query.length - 1
      return { query, start }
    }
    return null
  }

  const insertNewMentionTokenAtCaret = (
    ta: HTMLTextAreaElement,
    displayName: string,
    accountId: string,
    startIndex: number | null
  ) => {
    const selStart = ta.selectionStart
    const selEnd = ta.selectionEnd
    const start = startIndex ?? selStart
    const before = newComment.slice(0, start)
    const after = newComment.slice(selEnd)
    const token = `@[${displayName}|${accountId}]`
    const next = before + token + after
    setNewComment(next)
    const pos = (before + token).length
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(pos, pos)
    })
  }
  const [copiedId, setCopiedId] = useState(false)
  const [copiedIssueLink, setCopiedIssueLink] = useState(false)
  // Link to Issue (post-creation)
  const [linkIssueKey, setLinkIssueKey] = useState<string>('')
  const [linkType, setLinkType] = useState<string>('Relates')
  const [linkLoading, setLinkLoading] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)

  useEffect(() => {
    if (issue && isOpen) {
      setFreshIssue(null)
      loadEditData()
      loadDetails()
      // Also fetch the full issue payload (with attachments) so inline
      // descriptionHtml is rendered with correct attachment URLs on first open.
      ;(async () => {
        try {
          await loadIssueBase()
        } catch (e) {
          // ignore
        }
      })()
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
      setSelectedPriority(issue.priority?.name || '')
      setSelectedComponentId(getPrimaryComponentKey(issue))
      setSelectedSprintId(issue.sprint?.id ? String(issue.sprint.id) : '')
      setHasChanges(false)
    }
  }, [issue, isOpen])

  useEffect(() => {
    if (!issue || !isOpen) return
    let cancelled = false

    const loadComponents = async () => {
      try {
        const cached =
          getCachedData<Array<{ id: string; name: string }>>(
            `components:${projectKey}`
          ) || []
        if (cached.length && !cancelled) setProjectComponents(cached)
        const comps = await fetchProjectComponents(projectKey)
        if (!cancelled) setProjectComponents(comps)
      } catch {
        // ignore component load errors
      }
    }

    loadComponents()
    return () => {
      cancelled = true
    }
  }, [issue, isOpen, projectKey])

  useEffect(() => {
    if (!issue || !isOpen) return
    let cancelled = false
    const loadSprints = async () => {
      setSprintsLoading(true)
      try {
        const cached = getCachedData<
          Array<{ id: string; name: string; state: string }>
        >(`sprints:${projectKey}`)
        if (cached?.length && !cancelled) setProjectSprints(cached)
        const sprints = await fetchProjectSprints(projectKey)
        if (!cancelled) setProjectSprints(sprints)
      } catch {
        // ignore sprint load errors
      } finally {
        if (!cancelled) setSprintsLoading(false)
      }
    }
    loadSprints()
    return () => {
      cancelled = true
    }
  }, [issue, isOpen, projectKey])

  // Clear messages when changes are made
  useEffect(() => {
    setError(null)
    setSuccess(null)
  }, [
    selectedTransition,
    selectedAssignee,
    selectedVersionIds,
    selectedSprintId,
    selectedPriority,
    selectedComponentId
  ])

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
        setSelectedSprintId(issue.sprint?.id ? String(issue.sprint.id) : '')
      }
    }
  }, [isOpen, issue])

  // Check for changes
  useEffect(() => {
    if (!issue) return
    const baseIssue = freshIssue || issue

    const currentAssignee = baseIssue.assignee?.displayName || 'unassigned'
    const hasStatusChange = selectedTransition !== ''
    const hasAssigneeChange = selectedAssignee !== currentAssignee
    const originalVersionIds = (baseIssue.fixVersions || [])
      .map((v) => v.id)
      .sort()
    const currentVersionIds = [...selectedVersionIds].sort()
    const hasVersionChange =
      originalVersionIds.length !== currentVersionIds.length ||
      originalVersionIds.some((v, i) => v !== currentVersionIds[i])
    const basePriority = baseIssue.priority?.name || ''
    const hasPriorityChange =
      selectedPriority &&
      selectedPriority.trim().toLowerCase() !==
        basePriority.trim().toLowerCase()
    const baseSprintId = baseIssue.sprint?.id ? String(baseIssue.sprint.id) : ''
    const hasSprintChange = (selectedSprintId || '') !== (baseSprintId || '')
    const baseComponentId = getPrimaryComponentKey(baseIssue)
    const hasComponentChange =
      (selectedComponentId || '') !== (baseComponentId || '')

    setHasChanges(
      hasStatusChange ||
        hasAssigneeChange ||
        hasVersionChange ||
        hasPriorityChange ||
        hasSprintChange ||
        hasComponentChange
    )
  }, [
    selectedTransition,
    selectedAssignee,
    selectedVersionIds,
    selectedPriority,
    selectedSprintId,
    issue,
    freshIssue,
    selectedComponentId
  ])

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

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!issue) return
    setDeletingAttachments((prev) => new Set(prev).add(attachmentId))
    try {
      const ok = await deleteIssueAttachment(issue.key, attachmentId)
      if (!ok) {
        toast({
          title: 'Failed to delete attachment',
          description: 'Please try again.',
          variant: 'destructive'
        })
        return
      }

      setDetails((prev) =>
        prev
          ? {
              ...prev,
              attachments: prev.attachments.filter(
                (att) => att.id !== attachmentId
              )
            }
          : prev
      )

      toast({ title: 'Attachment deleted' })
      await loadDetails()
      onUpdate()
    } catch (error) {
      console.error('Error deleting attachment', error)
      toast({
        title: 'Failed to delete attachment',
        description: 'Please try again.',
        variant: 'destructive'
      })
    } finally {
      setDeletingAttachments((prev) => {
        const next = new Set(prev)
        next.delete(attachmentId)
        return next
      })
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
        const effectiveSprint = updated.sprint || issue.sprint
        const merged = effectiveSprint
          ? { ...updated, sprint: effectiveSprint }
          : updated
        setFreshIssue(merged)
        setSelectedAssignee(updated.assignee?.displayName || 'unassigned')
        setSelectedVersionIds((updated.fixVersions || []).map((v) => v.id))
        setSelectedPriority(updated.priority?.name || '')
        setSelectedComponentId(getPrimaryComponentKey(merged))
        setSelectedSprintId(
          effectiveSprint?.id ? String(effectiveSprint.id) : ''
        )
      }
    } catch (e) {
      // ignore
    }
  }

  const componentOptions = useMemo(
    () =>
      projectComponents.length > 0
        ? projectComponents
        : (freshIssue || issue)?.components?.map((c) => ({
            id: c.id || c.name,
            name: c.name
          })) || [],
    [projectComponents, freshIssue, issue]
  )

  const handleSave = async () => {
    if (!issue || !hasChanges) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    let hasUpdates = false
    const updates: string[] = []
    const baseIssue = freshIssue || issue

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

      // Update priority if changed
      const currentPriority = issue.priority?.name || ''
      if (
        selectedPriority &&
        selectedPriority.trim().toLowerCase() !==
          currentPriority.trim().toLowerCase()
      ) {
        const ok = await updateIssuePriority(issue.key, selectedPriority)
        if (ok) {
          hasUpdates = true
          updates.push(`Priority updated to ${selectedPriority}`)
          setFreshIssue((prev) =>
            prev
              ? {
                  ...prev,
                  priority: { ...prev.priority, name: selectedPriority }
                }
              : prev
          )
        } else {
          throw new Error('Failed to update priority')
        }
      }

      // Update sprint if changed
      const originalSprintId = issue.sprint?.id ? String(issue.sprint.id) : ''
      if ((selectedSprintId || '') !== (originalSprintId || '')) {
        const ok = await updateIssueSprint(issue.key, selectedSprintId || null)
        if (ok) {
          hasUpdates = true
          const sprintName =
            projectSprints.find((s) => s.id === selectedSprintId)?.name ||
            (selectedSprintId ? 'Selected sprint' : 'No sprint')
          updates.push(
            selectedSprintId
              ? `Sprint updated to ${sprintName}`
              : 'Sprint cleared'
          )
          setFreshIssue((prev) =>
            prev
              ? {
                  ...prev,
                  sprint: selectedSprintId
                    ? {
                        id: selectedSprintId,
                        name: sprintName,
                        state:
                          projectSprints.find((s) => s.id === selectedSprintId)
                            ?.state || ''
                      }
                    : undefined
                }
              : prev
          )
        } else {
          throw new Error('Failed to update sprint')
        }
      }

      // Update component if changed
      {
        const baseComponentId = getPrimaryComponentKey(baseIssue)
        const changed = (selectedComponentId || '') !== (baseComponentId || '')
        if (changed) {
          const ok = await updateIssueComponents(
            issue.key,
            selectedComponentId || null
          )
          if (ok) {
            hasUpdates = true
            const name =
              selectedComponentId && componentOptions.length > 0
                ? componentOptions.find((c) => c.id === selectedComponentId)
                    ?.name || selectedComponentId
                : 'No component'
            updates.push(
              selectedComponentId
                ? `Component updated to ${name}`
                : 'Component cleared'
            )
            setFreshIssue((prev) =>
              prev
                ? {
                    ...prev,
                    components: selectedComponentId
                      ? [
                          {
                            id: selectedComponentId,
                            name:
                              componentOptions.find(
                                (c) => c.id === selectedComponentId
                              )?.name ||
                              prev.components?.[0]?.name ||
                              selectedComponentId
                          }
                        ]
                      : []
                  }
                : prev
            )
          } else {
            throw new Error('Failed to update component')
          }
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
    setComponentSelectOpen(false)
    if (issue) {
      setSelectedAssignee(issue.assignee?.displayName || 'unassigned')
      setSelectedVersionIds((issue.fixVersions || []).map((v) => v.id))
      setSelectedPriority(issue.priority?.name || '')
      setSelectedComponentId(getPrimaryComponentKey(issue))
      setSelectedSprintId(issue.sprint?.id ? String(issue.sprint.id) : '')
    }
    onClose()
  }

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

  const getPrimaryComponentKey = (issueLike: JiraIssue | null) => {
    const comp = issueLike?.components?.[0]
    if (!comp) return ''
    return (comp.id ? String(comp.id) : comp.name) || ''
  }

  if (!issue) return null

  const displayIssue = freshIssue || issue

  const normalizedStatus = normalizeStatusName(displayIssue.status.name)

  const jiraBase = process.env.JIRA_BASE_URL || ''

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className='max-h-[90vh] max-w-[98vw] w-[98vw]! sm:w-auto sm:max-w-[110rem] p-0 rounded-2xl overflow-hidden'>
        <DialogHeader className='bg-muted/50 border-b px-6 py-4'>
          <DialogTitle className='flex items-center justify-between'>
            <div className='flex items-center gap-3 group'>
              <Badge
                variant='outline'
                className={`relative px-3 py-1 font-mono text-sm cursor-pointer select-none transition-transform active:scale-95 ${
                  copiedId
                    ? 'ring-2 ring-[hsl(var(--chart-5))]/60 ring-offset-2 ring-offset-background'
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
              {/* Copy issue link button */}
              <button
                type='button'
                className={`${copiedIssueLink ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity duration-500 inline-flex items-center gap-1 text-xs text-muted-foreground border border-border rounded-md px-2 py-1 hover:bg-muted`}
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
                    className={`absolute inset-0 h-3.5 w-3.5 text-[hsl(var(--chart-5))] transition-opacity duration-500 ${copiedIssueLink ? 'opacity-100' : 'opacity-0'}`}
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
                <Alert className='border-[hsl(var(--chart-5))/30] bg-[hsl(var(--chart-5))/12]'>
                  <CheckCircle className='h-4 w-4 text-[hsl(var(--chart-5))]' />
                  <AlertDescription className='text-[hsl(var(--chart-5))]'>
                    {success}
                  </AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert className='border-[hsl(var(--destructive))/30] bg-[hsl(var(--destructive))/12]'>
                  <AlertCircle className='h-4 w-4 text-[hsl(var(--destructive))]' />
                  <AlertDescription className='text-[hsl(var(--destructive))]'>
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              {/* Issue Metadata */}
              <div className='flex flex-wrap gap-2'>
                <Badge
                  variant='outline'
                  className='v1-only border-[hsl(var(--primary))/30] bg-[hsl(var(--primary))/12] text-[hsl(var(--primary))]'
                >
                  {issue.issuetype.name}
                </Badge>
                <Badge
                  variant='outline'
                  className='v2-only border-border bg-muted/20 text-muted-foreground'
                >
                  {issue.issuetype.name}
                </Badge>
                <Badge
                  variant='outline'
                  className={getPriorityColor(displayIssue.priority.name)}
                >
                  <span className='inline-flex items-center gap-1'>
                    <PriorityGlyph level={displayIssue.priority.name} />
                    {displayIssue.priority.name}
                  </span>
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
                    <div className='jira-description prose prose-sm dark:prose-invert max-w-none'>
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
                    {(() => {
                      const vids = extractMp4Urls(
                        displayIssue.descriptionHtml || displayIssue.description
                      )
                      return vids.length ? (
                        <div className='mt-3 flex flex-wrap gap-2'>
                          {vids.map((u) => (
                            <VideoThumb key={u} url={u} />
                          ))}
                        </div>
                      ) : null
                    })()}
                    <style jsx>{`
                      .jira-description {
                        --adf-table-border: rgba(0, 0, 0, 0.45);
                        --adf-table-header-bg: rgba(0, 0, 0, 0.06);
                      }
                      :global(.dark) .jira-description {
                        --adf-table-border: rgba(255, 255, 255, 0.45);
                        --adf-table-header-bg: rgba(255, 255, 255, 0.1);
                      }
                      .jira-description :global(.adf-table) {
                        width: 100%;
                        table-layout: auto;
                        border-radius: var(--radius-sm);
                        overflow: hidden;
                      }
                      .jira-description :global(.adf-table th),
                      .jira-description :global(.adf-table td),
                      .jira-description :global(.adf-th),
                      .jira-description :global(.adf-td),
                      .jira-description :global(.prose .adf-table th),
                      .jira-description :global(.prose .adf-table td) {
                        border: 1.5px solid var(--adf-table-border) !important;
                      }
                      .jira-description :global(.adf-th),
                      .jira-description :global(.adf-table th),
                      .jira-description :global(.prose .adf-table th) {
                        background-color: var(--adf-table-header-bg) !important;
                        font-weight: 600;
                      }
                      .jira-description :global(.adf-table) {
                        border-collapse: separate;
                        border-spacing: 0;
                        border-radius: 0;
                        overflow: visible;
                      }
                      .jira-description
                        :global(.adf-table tr:first-child th:first-child) {
                        border-top-left-radius: var(--radius-md);
                      }
                      .jira-description
                        :global(.adf-table tr:first-child th:last-child) {
                        border-top-right-radius: var(--radius-md);
                      }
                      .jira-description
                        :global(.adf-table tr:last-child td:first-child),
                      .jira-description
                        :global(.adf-table tr:last-child th:first-child) {
                        border-bottom-left-radius: var(--radius-md);
                      }
                      .jira-description
                        :global(.adf-table tr:last-child td:last-child),
                      .jira-description
                        :global(.adf-table tr:last-child th:last-child) {
                        border-bottom-right-radius: var(--radius-md);
                      }
                    `}</style>
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

              {/* Releases & Links (collapsible) */}
              <Card>
                <CardHeader>
                  <Collapsible
                    open={planningOpen}
                    onOpenChange={setPlanningOpen}
                  >
                    <CollapsibleTrigger asChild>
                      <button className='w-full h-10 flex items-center justify-between text-left focus:outline-none focus:ring-0'>
                        <CardTitle className='flex items-center justify-between text-lg w-full leading-none'>
                          <span className='flex items-center gap-2'>
                            Releases & Links
                          </span>
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${planningOpen ? 'rotate-180' : ''}`}
                          />
                        </CardTitle>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className='pt-4 space-y-6'>
                        {/* Fix Versions Section */}
                        <div className='space-y-3'>
                          <div className='flex items-center gap-2 text-sm font-medium'>
                            <Tag className='h-4 w-4' />
                            <span>Fix Versions</span>
                          </div>
                          {projectVersions.length === 0 ? (
                            <div className='text-muted-foreground text-sm flex items-center gap-2'>
                              <Loader2 className='h-4 w-4 animate-spin' />{' '}
                              Loading versions…
                            </div>
                          ) : (
                            <VersionsMultiSelect
                              id='edit-releases'
                              versions={projectVersions}
                              selectedIds={selectedVersionIds}
                              onChange={setSelectedVersionIds}
                              showBadgesSummary
                            />
                          )}
                        </div>

                        {/* Link to Issue (post-creation) */}
                        <div className='space-y-3'>
                          <div className='flex items-center gap-2 text-sm font-medium'>
                            <LinkIcon className='h-4 w-4' />
                            <span>Link to Issue</span>
                          </div>
                          {linkError && (
                            <Alert variant='destructive'>
                              <AlertDescription>{linkError}</AlertDescription>
                            </Alert>
                          )}
                          <LinkIssuePicker
                            projectKey={projectKey}
                            linkIssueKey={linkIssueKey}
                            onLinkIssueKeyChange={setLinkIssueKey}
                            linkType={linkType}
                            onLinkTypeChange={setLinkType}
                            disabled={linkLoading}
                          />
                          <div className='flex justify-end'>
                            <Button
                              variant='default'
                              disabled={
                                !linkIssueKey.trim() || linkLoading || !issue
                              }
                              onClick={async () => {
                                if (!issue) return
                                setLinkError(null)
                                setLinkLoading(true)
                                const ok = await linkIssueClient({
                                  issueKey: issue.key,
                                  toIssueKey: linkIssueKey.trim(),
                                  linkType
                                })
                                setLinkLoading(false)
                                if (!ok) {
                                  setLinkError(
                                    'Failed to create link. Please try again.'
                                  )
                                  return
                                }
                                // reset
                                setLinkIssueKey('')
                                setLinkType('Relates')
                                try {
                                  await loadDetails()
                                } catch (_) {
                                  // ignore refresh error
                                }
                                onUpdate()
                              }}
                            >
                              {linkLoading ? (
                                <span className='inline-flex items-center gap-2'>
                                  <Loader2 className='h-4 w-4 animate-spin' />{' '}
                                  Linking...
                                </span>
                              ) : (
                                'Link Issue'
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </CardHeader>
              </Card>

              {/* Attachments */}
              {details && details.attachments.length > 0 ? (
                <Card>
                  <CardHeader>
                    <Collapsible
                      open={attachmentsOpen}
                      onOpenChange={setAttachmentsOpen}
                    >
                      <CollapsibleTrigger asChild>
                        <button className='w-full flex items-center justify-between text-left focus:outline-none focus:ring-0'>
                          <CardTitle className='flex items-center justify-between text-lg w-full'>
                            <span className='flex items-center gap-2'>
                              Attachments
                              <Badge
                                variant='secondary'
                                className='text-xs px-2 py-0.5'
                              >
                                {details.attachments.length}
                              </Badge>
                            </span>
                            <ChevronDown
                              className={`h-4 w-4 transition-transform ${attachmentsOpen ? 'rotate-180' : ''}`}
                            />
                          </CardTitle>
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent>
                          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
                            {details.attachments.map((att) => {
                              const previewUrl = `/api/issues/${issue.key}/attachments/${att.id}?disposition=inline`
                              const isPdf =
                                (att.mimeType &&
                                  att.mimeType.toLowerCase().includes('pdf')) ||
                                /\.pdf$/i.test(att.filename)
                              const canPreview = att.isImage || isPdf
                              const isDeleting = deletingAttachments.has(att.id)
                              return (
                                <div
                                  key={att.id}
                                  className='border rounded-md p-3 flex items-center gap-3 bg-muted/30'
                                >
                                  {att.isImage ? (
                                    <img
                                      src={previewUrl}
                                      alt={att.filename}
                                      className='h-16 w-16 object-cover rounded-md border cursor-pointer hover:opacity-90'
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
                                      className={`h-16 w-16 flex items-center justify-center rounded-md border border-border bg-card text-[10px] text-center px-1 ${canPreview ? 'cursor-pointer hover:bg-muted/40' : ''}`}
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
                                  <div className='flex items-center gap-2 self-center ml-auto'>
                                    <a
                                      href={`/api/issues/${issue.key}/attachments/${att.id}`}
                                      className='text-[hsl(var(--primary))] text-sm whitespace-nowrap'
                                    >
                                      Download
                                    </a>
                                    <Button
                                      variant='ghost'
                                      size='icon'
                                      className='h-8 w-8 text-muted-foreground hover:text-destructive'
                                      onClick={() =>
                                        handleDeleteAttachment(att.id)
                                      }
                                      disabled={isDeleting}
                                      aria-label={`Delete ${att.filename}`}
                                    >
                                      {isDeleting ? (
                                        <Loader2 className='h-4 w-4 animate-spin' />
                                      ) : (
                                        <Trash2 className='h-4 w-4' />
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Collapsible>
                  </CardHeader>
                </Card>
              ) : null}

              {/* Comments */}
              <Card>
                <CardHeader>
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
                        <div className='mb-5 relative'>
                          <textarea
                            id='new-comment'
                            ref={newTextareaRef}
                            className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring min-h-[120px]'
                            placeholder='Write a comment…'
                            value={newComment}
                            onChange={(e) => {
                              const val = e.target.value
                              setNewComment(val)
                              const caret =
                                e.target.selectionStart || val.length
                              const t = detectNewMentionTrigger(val, caret)
                              if (t) {
                                setNewMentionOpen(true)
                                setNewMentionQuery(t.query)
                                setNewMentionStart(t.start)
                                setNewMentionIndex(0)
                              } else {
                                setNewMentionOpen(false)
                                setNewMentionQuery('')
                                setNewMentionStart(null)
                              }
                            }}
                            onKeyDown={(e) => {
                              if (newMentionOpen) {
                                const candidates = (projectUsers || [])
                                  .filter((u) =>
                                    (u.displayName || '')
                                      .toLowerCase()
                                      .includes(
                                        (newMentionQuery || '').toLowerCase()
                                      )
                                  )
                                  .slice(0, 8)
                                if (e.key === 'ArrowDown') {
                                  e.preventDefault()
                                  setNewMentionIndex((i) =>
                                    Math.min(candidates.length - 1, i + 1)
                                  )
                                } else if (e.key === 'ArrowUp') {
                                  e.preventDefault()
                                  setNewMentionIndex((i) => Math.max(0, i - 1))
                                } else if (e.key === 'Enter') {
                                  const ta = newTextareaRef.current
                                  if (ta && candidates.length) {
                                    const u =
                                      candidates[newMentionIndex] ||
                                      candidates[0]
                                    e.preventDefault()
                                    insertNewMentionTokenAtCaret(
                                      ta,
                                      u.displayName,
                                      u.accountId,
                                      newMentionStart
                                    )
                                    setNewMentionOpen(false)
                                    setNewMentionQuery('')
                                    setNewMentionStart(null)
                                    setNewMentionIndex(0)
                                  }
                                } else if (e.key === 'Escape') {
                                  e.preventDefault()
                                  setNewMentionOpen(false)
                                }
                              }
                            }}
                            onClick={(e) => {
                              const ta = e.currentTarget
                              const caret = ta.selectionStart || 0
                              const t = detectNewMentionTrigger(ta.value, caret)
                              if (t) {
                                setNewMentionOpen(true)
                                setNewMentionQuery(t.query)
                                setNewMentionStart(t.start)
                              } else {
                                setNewMentionOpen(false)
                              }
                            }}
                            onPaste={handleNewCommentPaste}
                            disabled={postingComment || isUploadingNewComment}
                          />
                          {isUploadingNewComment && (
                            <div className='absolute inset-0 flex items-center justify-center bg-background/80 rounded-md'>
                              <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                                <Loader2 className='h-4 w-4 animate-spin' />
                                Uploading image...
                              </div>
                            </div>
                          )}
                          {newMentionOpen && projectUsers?.length ? (
                            <div className='absolute z-20 left-0 mt-1 w-64 max-h-60 overflow-auto rounded-md border border-border bg-popover shadow-sm'>
                              <div className='p-2 border-b border-border text-xs text-muted-foreground'>
                                Mention someone
                              </div>
                              {projectUsers
                                .filter((u) =>
                                  (u.displayName || '')
                                    .toLowerCase()
                                    .includes(
                                      (newMentionQuery || '').toLowerCase()
                                    )
                                )
                                .slice(0, 8)
                                .map((u, idx) => (
                                  <button
                                    key={u.accountId}
                                    type='button'
                                    className={`flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-accent hover:text-accent-foreground ${idx === newMentionIndex ? 'bg-accent text-accent-foreground' : ''}`}
                                    onMouseEnter={() => setNewMentionIndex(idx)}
                                    onMouseDown={(ev) => ev.preventDefault()}
                                    onClick={() => {
                                      const ta = newTextareaRef.current
                                      if (!ta) return
                                      insertNewMentionTokenAtCaret(
                                        ta,
                                        u.displayName,
                                        u.accountId,
                                        newMentionStart
                                      )
                                      setNewMentionOpen(false)
                                    }}
                                  >
                                    <span className='inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs'>
                                      @
                                    </span>
                                    <span className='truncate'>
                                      {u.displayName}
                                    </span>
                                  </button>
                                ))}
                            </div>
                          ) : null}
                          <div className='mt-2 flex items-center justify-between text-xs'>
                            <span className='text-muted-foreground'>
                              Press Enter for a new line. Click Add when ready.
                            </span>
                            <div className='flex items-center gap-3'>
                              {commentError && (
                                <span className='text-[hsl(var(--destructive))]'>
                                  {commentError}
                                </span>
                              )}
                              {commentSuccess && (
                                <span className='text-[hsl(var(--chart-5))]'>
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
                                projectUsers={projectUsers}
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
                      <button className='w-full flex items-center justify-between text-left focus:outline-none focus:ring-0'>
                        <CardTitle className='flex items-center justify-between text-lg w-full'>
                          <span className='flex items-center gap-2'>
                            History
                            {details?.changelog?.length ? (
                              <Badge
                                variant='secondary'
                                className='text-xs px-2 py-0.5'
                              >
                                {details.changelog.length}
                              </Badge>
                            ) : null}
                          </span>
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${historyOpen ? 'rotate-180' : ''}`}
                          />
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
                  await Promise.all([loadDetails(), loadIssueBase()])
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
                  {transitions.length === 0 && loading ? (
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
                        disabled={loading && transitions.length === 0}
                        open={statusSelectOpen}
                        onOpenChange={setStatusSelectOpen}
                      >
                        <SelectTrigger
                          ref={statusTriggerRef}
                          className='h-8 text-sm'
                        >
                          <SelectValue placeholder='Select new status' />
                        </SelectTrigger>
                        <SelectContent>
                          {transitions.map((transition) => (
                            <SelectItem
                              key={transition.id}
                              value={transition.id}
                            >
                              <span
                                className={`inline-block rounded-md border px-2 py-0.5 text-xs ${getStatusColor(transition.name)}`}
                              >
                                {decodeHtmlEntities(transition.name)}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Priority Section */}
              <Card>
                <CardHeader className='pb-3'>
                  <CardTitle className='flex items-center gap-2 text-sm'>
                    <ChevronUp className='h-4 w-4' />
                    Priority
                  </CardTitle>
                </CardHeader>
                <CardContent className='space-y-3'>
                  <div className='flex items-center gap-2'>
                    <Badge
                      variant='outline'
                      className={`${getPriorityColor(displayIssue.priority.name)} px-2 py-1 text-xs`}
                    >
                      <span className='inline-flex items-center gap-1'>
                        <PriorityGlyph level={displayIssue.priority.name} />
                        {displayIssue.priority.name}
                      </span>
                    </Badge>
                  </div>
                  <div className='space-y-2'>
                    <Label
                      htmlFor='priority-select'
                      className='text-muted-foreground text-xs'
                    >
                      Change Priority
                    </Label>
                    <Select
                      value={selectedPriority || displayIssue.priority.name}
                      onValueChange={setSelectedPriority}
                    >
                      <SelectTrigger className='h-8 text-sm'>
                        <SelectValue placeholder='Select priority' />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            <span className='inline-flex items-center gap-2'>
                              <PriorityGlyph level={p.value} />
                              {p.value}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Component Section */}
              <Card>
                <CardHeader className='pb-3'>
                  <CardTitle className='flex items-center gap-2 text-sm'>
                    <Component className='h-4 w-4' />
                    Component
                  </CardTitle>
                </CardHeader>
                <CardContent className='space-y-3'>
                  <div className='flex flex-wrap items-center gap-2'>
                    {displayIssue.components.length > 0 ? (
                      displayIssue.components.map((component) => (
                        <Badge
                          key={component.id || component.name}
                          variant='outline'
                          className='px-2 py-1 text-xs'
                        >
                          {component.name}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant='outline' className='px-2 py-1 text-xs'>
                        No component
                      </Badge>
                    )}
                  </div>
                  <div className='space-y-2'>
                    <Label
                      htmlFor='component-select'
                      className='text-muted-foreground text-xs'
                    >
                      Change Component
                    </Label>
                    <Popover
                      open={componentSelectOpen}
                      onOpenChange={setComponentSelectOpen}
                    >
                      <PopoverTrigger asChild>
                        <button
                          type='button'
                          id='component-select'
                          className='border-input bg-background text-foreground w-full justify-between inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-hidden'
                          aria-haspopup='listbox'
                          aria-expanded={componentSelectOpen}
                        >
                          <span className='truncate'>
                            {selectedComponentId
                              ? componentOptions.find(
                                  (c) => c.id === selectedComponentId
                                )?.name ||
                                displayIssue.components[0]?.name ||
                                'Select a component'
                              : 'Select a component'}
                          </span>
                          <ChevronsUpDown className='h-4 w-4 opacity-60' />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className='p-0 w-[--radix-popover-trigger-width] min-w-[260px]'>
                        <Command>
                          <CommandInput placeholder='Search components...' />
                          <CommandList>
                            <CommandEmpty>No components found.</CommandEmpty>
                            <CommandGroup heading='Components'>
                              <CommandItem
                                key='__no_component__'
                                onSelect={() => {
                                  setSelectedComponentId('')
                                  setComponentSelectOpen(false)
                                }}
                              >
                                <span className='truncate'>No component</span>
                                {selectedComponentId === '' && (
                                  <Check className='ml-auto h-4 w-4 opacity-70' />
                                )}
                              </CommandItem>
                              {componentOptions.map((component) => {
                                const value = component.id || component.name
                                return (
                                  <CommandItem
                                    key={value}
                                    value={component.name}
                                    onSelect={() => {
                                      setSelectedComponentId(value)
                                      setComponentSelectOpen(false)
                                    }}
                                  >
                                    <span className='truncate'>
                                      {component.name}
                                    </span>
                                    {selectedComponentId === value && (
                                      <Check className='ml-auto h-4 w-4 opacity-70' />
                                    )}
                                  </CommandItem>
                                )
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </CardContent>
              </Card>

              {/* Sprint Section */}
              <Card>
                <CardHeader className='pb-3'>
                  <CardTitle className='flex items-center gap-2 text-sm'>
                    <Calendar className='h-4 w-4' />
                    Sprint
                  </CardTitle>
                </CardHeader>
                <CardContent className='space-y-3'>
                  <div className='flex items-center gap-2'>
                    <Badge variant='outline' className='px-2 py-1 text-xs'>
                      {decodeHtmlEntities(
                        displayIssue.sprint?.name || 'No sprint'
                      )}
                    </Badge>
                    {displayIssue.sprint?.state ? (
                      <Badge
                        variant='secondary'
                        className='px-2 py-0.5 text-[11px] capitalize'
                      >
                        {displayIssue.sprint.state.toLowerCase()}
                      </Badge>
                    ) : null}
                  </div>
                  {projectSprints.length === 0 && sprintsLoading ? (
                    <div className='text-muted-foreground flex items-center gap-2'>
                      <Loader2 className='h-4 w-4 animate-spin' />
                      Loading sprints...
                    </div>
                  ) : (
                    <div className='space-y-2'>
                      <Label
                        htmlFor='sprint-select'
                        className='text-muted-foreground text-xs'
                      >
                        Change Sprint
                      </Label>
                      <Popover
                        open={sprintSelectOpen}
                        onOpenChange={setSprintSelectOpen}
                      >
                        <PopoverTrigger asChild>
                          <button
                            type='button'
                            id='sprint-select'
                            className='border-input bg-background text-foreground w-full justify-between inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-hidden'
                            disabled={
                              sprintsLoading && projectSprints.length === 0
                            }
                            aria-haspopup='listbox'
                            aria-expanded={sprintSelectOpen}
                          >
                            <span className='truncate'>
                              {selectedSprintId
                                ? decodeHtmlEntities(
                                    projectSprints.find(
                                      (s) => s.id === selectedSprintId
                                    )?.name || 'Select a sprint'
                                  )
                                : 'Select a sprint'}
                            </span>
                            <ChevronsUpDown className='h-4 w-4 opacity-60' />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className='p-0 w-[--radix-popover-trigger-width] min-w-[260px]'>
                          <Command>
                            <CommandInput placeholder='Search sprints...' />
                            <CommandList>
                              <CommandEmpty>No sprints found.</CommandEmpty>
                              <CommandGroup heading='Sprints'>
                                <CommandItem
                                  key='__no_sprint__'
                                  onSelect={() => {
                                    setSelectedSprintId('')
                                    setSprintSelectOpen(false)
                                  }}
                                >
                                  <span className='truncate'>No sprint</span>
                                  {selectedSprintId === '' && (
                                    <Check className='ml-auto h-4 w-4 opacity-70' />
                                  )}
                                </CommandItem>
                                {projectSprints
                                  .filter(
                                    (s) =>
                                      (s.state || '').toLowerCase() !==
                                        'closed' || s.id === selectedSprintId
                                  )
                                  .slice()
                                  .sort((a, b) => {
                                    const order = {
                                      active: 0,
                                      future: 1,
                                      closed: 2
                                    } as any
                                    const sa = (a.state || '').toLowerCase()
                                    const sb = (b.state || '').toLowerCase()
                                    if (order[sa] !== order[sb])
                                      return order[sa] - order[sb]
                                    return a.name.localeCompare(b.name)
                                  })
                                  .map((s) => (
                                    <CommandItem
                                      key={s.id}
                                      value={`${s.name} ${s.state}`}
                                      onSelect={() => {
                                        setSelectedSprintId(s.id)
                                        setSprintSelectOpen(false)
                                      }}
                                    >
                                      <span className='truncate'>
                                        {decodeHtmlEntities(s.name)}
                                      </span>
                                      <span className='ml-2 text-[11px] capitalize text-muted-foreground'>
                                        {s.state.toLowerCase()}
                                      </span>
                                      {selectedSprintId === s.id && (
                                        <Check className='ml-auto h-4 w-4 opacity-70' />
                                      )}
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
                            {getInitials(displayIssue.assignee.displayName)}
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
                  {projectUsers.length === 0 && loading ? (
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
                        disabled={loading && projectUsers.length === 0}
                        open={assigneeSelectOpen}
                        onOpenChange={setAssigneeSelectOpen}
                      >
                        <SelectTrigger
                          ref={assigneeTriggerRef}
                          className='h-8 text-sm'
                        >
                          <SelectValue placeholder='Select assignee' />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='unassigned'>Unassigned</SelectItem>
                          {projectUsers.map((user) => (
                            <SelectItem
                              key={user.accountId}
                              value={user.displayName}
                            >
                              {decodeHtmlEntities(user.displayName)}
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
            <DialogContent className='max-w-[95vw] w-[95vw] max-h-[90vh] p-0 overflow-hidden'>
              <DialogHeader className='bg-muted/50 border-b px-3 py-2'>
                <DialogTitle
                  className='flex items-center justify-between text-sm font-medium truncate'
                  title={preview.filename}
                >
                  <span className='truncate'>{preview.filename}</span>
                </DialogTitle>
              </DialogHeader>
              <div className='relative w-full h-full'>
                {preview.mime &&
                preview.mime.toLowerCase().includes('video') ? (
                  <video
                    src={preview.url}
                    controls
                    autoPlay
                    className='w-full h-full object-contain bg-black'
                  />
                ) : (preview.mime &&
                    preview.mime.toLowerCase().includes('pdf')) ||
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

// Type for pending images waiting to be uploaded after issue creation
interface PendingImage {
  id: string
  file: File
  previewUrl: string
}

function IssueCreateContent({
  projectKey,
  isOpen,
  onClose,
  onCreated
}: IssueCreateProps) {
  const { toast } = useToast()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assignee, setAssignee] = useState<string>('')
  const [componentId, setComponentId] = useState<string>('')
  const [linkIssueKey, setLinkIssueKey] = useState<string>('')
  const [linkType, setLinkType] = useState<string>('Relates')
  const [relOpen, setRelOpen] = useState(false)
  const [issueTypeId, setIssueTypeId] = useState<string>('')
  // Typeahead suggestions for linkIssueKey
  const [suggestions, setSuggestions] = useState<
    Array<{ key: string; summary: string }>
  >([])
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [suggestIndex, setSuggestIndex] = useState(0)
  const [debounceTimer, setDebounceTimer] = useState<any>(null)

  const [users, setUsers] = useState<JiraUser[]>([])
  const [components, setComponents] = useState<
    Array<{ id: string; name: string }>
  >([])
  const [issueTypes, setIssueTypes] = useState<
    Array<{ id: string; name: string }>
  >([])
  const [versions, setVersions] = useState<
    Array<{ id: string; name: string; released?: boolean; archived?: boolean }>
  >([])
  const [selectedVersionIds, setSelectedVersionIds] = useState<string[]>([])
  const [priority, setPriority] = useState<string>('Medium')

  // Sprints
  const [sprints, setSprints] = useState<
    Array<{ id: string; name: string; state: string }>
  >([])
  const [selectedSprintId, setSelectedSprintId] = useState<string>('')
  const [sprintOpen, setSprintOpen] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Popovers for improved dropdown UX
  const [assigneeOpen, setAssigneeOpen] = useState(false)
  const [componentOpen, setComponentOpen] = useState(false)
  const [issueTypeOpen, setIssueTypeOpen] = useState(false)

  // Mention autocomplete for description
  const descRef = useRef<HTMLTextAreaElement | null>(null)
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionStart, setMentionStart] = useState<number | null>(null)
  const [mentionIndex, setMentionIndex] = useState(0)

  // Pending images for paste-to-upload (queued until issue is created)
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])

  // Handle paste event on description textarea
  const handleDescriptionPaste = (
    e: React.ClipboardEvent<HTMLTextAreaElement>
  ) => {
    const items = e.clipboardData?.items
    if (!items) return

    // Find image item in clipboard
    let imageFile: File | null = null
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) {
          imageFile = file
          break
        }
      }
    }

    // No image found, let default paste behavior continue
    if (!imageFile) return

    // Prevent default paste behavior for images
    e.preventDefault()

    const textarea = e.currentTarget

    // Generate a unique ID and filename for the pasted image
    const timestamp = Date.now()
    const extension = imageFile.type.split('/')[1] || 'png'
    const filename = `pasted-image-${timestamp}.${extension}`
    const placeholderId = `pending-${timestamp}`

    // Create a new file with the proper filename
    const namedFile = new File([imageFile], filename, { type: imageFile.type })

    // Create preview URL for thumbnail
    const previewUrl = URL.createObjectURL(namedFile)

    // Add to pending images
    setPendingImages((prev) => [
      ...prev,
      { id: placeholderId, file: namedFile, previewUrl }
    ])

    // Insert placeholder token at cursor
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const currentValue = description
    const token = `<pending-image:${placeholderId}>`
    const newValue =
      currentValue.slice(0, start) + token + currentValue.slice(end)
    setDescription(newValue)

    // Set cursor position after inserted text
    const newCursorPos = start + token.length
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    })

    toast({
      title: 'Image queued',
      description: 'Image will be uploaded when the issue is created.'
    })
  }

  // Remove a pending image
  const removePendingImage = (id: string) => {
    setPendingImages((prev) => {
      const img = prev.find((p) => p.id === id)
      if (img) {
        URL.revokeObjectURL(img.previewUrl)
      }
      return prev.filter((p) => p.id !== id)
    })
    // Also remove the placeholder from description
    setDescription((prev) => prev.replace(`<pending-image:${id}>`, ''))
  }

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      pendingImages.forEach((img) => URL.revokeObjectURL(img.previewUrl))
    }
  }, [])

  // Keyboard shortcut: press 'a' to open Assignee dropdown (like Linear)
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore if modifier keys are pressed
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      if (isEditableTarget(e.target)) return
      if (e.key.toLowerCase() === 'a') {
        e.preventDefault()
        setAssigneeOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !projectKey) return
    let cancelled = false
    const load = async () => {
      try {
        setError(null)
        const [
          usersData,
          componentsData,
          issueTypesData,
          versionsData,
          sprintsData
        ] = await Promise.all([
          fetchProjectUsers(projectKey),
          fetchProjectComponents(projectKey),
          fetchIssueTypes(projectKey),
          fetchProjectVersions(projectKey),
          fetchProjectSprints(projectKey)
        ])
        if (!cancelled) {
          setUsers(usersData)
          setComponents(componentsData)
          setIssueTypes(issueTypesData.map((t) => ({ id: t.id, name: t.name })))
          setVersions(versionsData)
          setSprints(sprintsData)
        }
      } catch (e) {
        if (!cancelled)
          setError('Failed to load users/components/issue types/versions.')
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [isOpen, projectKey])

  const reset = () => {
    setTitle('')
    setDescription('')
    setAssignee('')
    setComponentId('')
    setLinkIssueKey('')
    setLinkType('Relates')
    setIssueTypeId('')
    setSelectedVersionIds([])
    setSelectedSprintId('')
    setSprintOpen(false)
    setPriority('Medium')
    setSuggestions([])
    setSuggestOpen(false)
    setSuggestLoading(false)
    setSuggestIndex(0)
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      setDebounceTimer(null)
    }
    setError(null)
    setLoading(false)
    setMentionOpen(false)
    setMentionQuery('')
    setMentionStart(null)
    setMentionIndex(0)
    // Clear pending images and revoke their preview URLs
    pendingImages.forEach((img) => URL.revokeObjectURL(img.previewUrl))
    setPendingImages([])
  }

  const handleClose = () => {
    if (loading) return
    reset()
    onClose()
  }

  const detectMentionTrigger = (value: string, caret: number) => {
    const prefix = value.slice(0, caret)
    const m = prefix.match(/(^|\s)@([\w .\-]{1,40})$/)
    if (m) {
      const query = m[2]
      const start = caret - query.length - 1
      return { query, start }
    }
    return null
  }

  const insertMentionTokenAtCaret = (
    ta: HTMLTextAreaElement,
    displayName: string,
    accountId: string,
    startIndex: number | null
  ) => {
    const selStart = ta.selectionStart
    const selEnd = ta.selectionEnd
    const start = startIndex ?? selStart
    const before = description.slice(0, start)
    const after = description.slice(selEnd)
    const token = `@[${displayName}|${accountId}]`
    const next = before + token + after
    setDescription(next)
    const pos = (before + token).length
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(pos, pos)
    })
  }

  const filteredUsers = users
    .filter((u) =>
      (u.displayName || '').toLowerCase().includes(mentionQuery.toLowerCase())
    )
    .slice(0, 8)

  const handleSubmit = async () => {
    setError(null)
    if (!title.trim() || !description.trim() || !componentId) {
      setError('Please fill in title, description and component.')
      return
    }
    setLoading(true)

    // Create the issue first (with placeholder tokens in description)
    const res = await createIssueClient({
      projectKey,
      title: title.trim(),
      description: description.trim(),
      assigneeAccountId: assignee || null,
      componentId,
      issueTypeId: issueTypeId || undefined,
      linkIssueKey: linkIssueKey.trim() || undefined,
      linkType: linkIssueKey.trim() ? linkType : undefined,
      versionIds: selectedVersionIds,
      sprintId: selectedSprintId || undefined,
      priority
    })

    if (!res?.key) {
      setLoading(false)
      setError('Failed to create issue. Check console for details.')
      return
    }

    const key = res.key

    // If there are pending images, upload them and update the description
    if (pendingImages.length > 0) {
      try {
        // Upload all pending images
        const files = pendingImages.map((p) => p.file)
        const uploadResults = await uploadIssueAttachments(key, files)

        if (uploadResults && uploadResults.length > 0) {
          // Build a mapping from placeholder ID to real attachment ID
          let updatedDescription = description.trim()
          pendingImages.forEach((pending, index) => {
            const attachment = uploadResults[index]
            if (attachment) {
              const placeholder = `<pending-image:${pending.id}>`
              const realToken = attachment.content
                ? `[${attachment.filename || 'attachment'}](${attachment.content})`
                : ''
              updatedDescription = updatedDescription
                .split(placeholder)
                .join(realToken)
            }
          })

          const ok = await updateIssueDescription(key, updatedDescription)
          if (ok) {
            setDescription(updatedDescription)
          } else {
            console.warn('Issue created but description update failed')
          }

          toast({
            title: 'Images uploaded',
            description: `${uploadResults.length} image(s) attached to ${key}.`
          })
        }
      } catch (uploadError) {
        console.error('Error uploading pending images:', uploadError)
        toast({
          title: 'Image upload warning',
          description:
            'Issue created but some images failed to upload. You can add them manually.',
          variant: 'destructive'
        })
      }
    }

    setLoading(false)

    // Show success toast with actions
    try {
      const link =
        typeof window !== 'undefined'
          ? `${window.location.origin}/browse/${key}`
          : key
      toast({
        title: 'Issue created',
        description: `${key} has been created successfully.`,
        action: {
          label: 'Open',
          onClick: () => {
            onCreated(key)
          },
          secondaryLabel: 'Copy link',
          onSecondaryClick: async () => {
            try {
              if (typeof window !== 'undefined' && navigator?.clipboard) {
                await navigator.clipboard.writeText(link)
              }
            } catch (e) {
              // ignore copy error
            }
          }
        }
      })
    } catch (_) {
      // ignore toast error
    }
    reset()
    onClose()
    // Keep behavior to auto-open via onCreated to preserve existing UX
    onCreated(key)
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => (!open ? handleClose() : null)}
    >
      <DialogContent className='sm:max-w-[720px] md:max-w-[800px]'>
        <DialogHeader>
          <DialogTitle>Create New Issue</DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant='destructive'>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='title'>Title</Label>
            <Input
              id='title'
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder='Issue title'
              disabled={loading}
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='description'>Description</Label>
            <div className='relative'>
              <textarea
                ref={descRef}
                id='description'
                value={description}
                onChange={(e) => {
                  const val = e.target.value
                  setDescription(val)
                  const caret = e.target.selectionStart || val.length
                  const trig = detectMentionTrigger(val, caret)
                  if (trig) {
                    setMentionOpen(true)
                    setMentionQuery(trig.query)
                    setMentionStart(trig.start)
                    setMentionIndex(0)
                  } else {
                    setMentionOpen(false)
                    setMentionQuery('')
                    setMentionStart(null)
                  }
                }}
                onKeyDown={(e) => {
                  if (!mentionOpen) return
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setMentionIndex((i) =>
                      Math.min(filteredUsers.length - 1, i + 1)
                    )
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setMentionIndex((i) => Math.max(0, i - 1))
                  } else if (e.key === 'Enter') {
                    if (filteredUsers.length > 0 && descRef.current) {
                      e.preventDefault()
                      const u = filteredUsers[mentionIndex] || filteredUsers[0]
                      insertMentionTokenAtCaret(
                        descRef.current,
                        u.displayName,
                        u.accountId,
                        mentionStart
                      )
                      setMentionOpen(false)
                      setMentionQuery('')
                      setMentionStart(null)
                    }
                  } else if (e.key === 'Escape') {
                    e.preventDefault()
                    setMentionOpen(false)
                    setMentionQuery('')
                    setMentionStart(null)
                  }
                }}
                onPaste={handleDescriptionPaste}
                placeholder='Describe the issue... (type @ to mention, paste images)'
                rows={6}
                disabled={loading}
                className='border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-hidden min-h-[120px]'
              />

              {/* Pending images thumbnails */}
              {pendingImages.length > 0 && (
                <div className='mt-2 flex flex-wrap gap-2'>
                  {pendingImages.map((img) => (
                    <div
                      key={img.id}
                      className='relative group rounded-md border border-border overflow-hidden'
                    >
                      <img
                        src={img.previewUrl}
                        alt={img.file.name}
                        className='w-16 h-16 object-cover'
                      />
                      <button
                        type='button'
                        onClick={() => removePendingImage(img.id)}
                        className='absolute top-0 right-0 p-0.5 bg-destructive text-destructive-foreground rounded-bl-md opacity-0 group-hover:opacity-100 transition-opacity'
                        title='Remove image'
                      >
                        <X className='h-3 w-3' />
                      </button>
                      <div className='absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1 truncate'>
                        {img.file.name}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {mentionOpen && filteredUsers.length > 0 && (
                <div className='absolute left-0 right-0 z-20 mt-1 max-h-56 overflow-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md'>
                  {filteredUsers.map((u, idx) => (
                    <button
                      key={u.accountId}
                      type='button'
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground ${idx === mentionIndex ? 'bg-accent text-accent-foreground' : ''}`}
                      onMouseDown={(e) => {
                        // prevent textarea blur
                        e.preventDefault()
                        if (descRef.current) {
                          insertMentionTokenAtCaret(
                            descRef.current,
                            u.displayName,
                            u.accountId,
                            mentionStart
                          )
                          setMentionOpen(false)
                          setMentionQuery('')
                          setMentionStart(null)
                          setMentionIndex(0)
                        }
                      }}
                    >
                      @{u.displayName}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <Label htmlFor='assignee'>Assignee</Label>
              <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
                <PopoverTrigger asChild>
                  <button
                    type='button'
                    id='assignee'
                    className='border-input bg-background text-foreground w-full justify-between inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-hidden'
                    disabled={loading}
                    aria-haspopup='listbox'
                    aria-expanded={assigneeOpen}
                  >
                    <div className='flex items-center gap-2 min-w-0'>
                      <Avatar className='h-5 w-5'>
                        {(() => {
                          const selectedUser = users.find(
                            (u) => u.accountId === assignee
                          )
                          const src = selectedUser?.accountId
                            ? selectedUser?.['avatarUrls' as any]?.['24x24']
                            : undefined
                          return (
                            <>
                              <AvatarImage src={src || ''} />
                              <AvatarFallback className='text-[10px]'>
                                {getInitials(selectedUser?.displayName || 'UA')}
                              </AvatarFallback>
                            </>
                          )
                        })()}
                      </Avatar>
                      <span className='truncate'>
                        {assignee
                          ? users.find((u) => u.accountId === assignee)
                              ?.displayName || 'Unassigned'
                          : 'Unassigned'}
                      </span>
                    </div>
                    <ChevronsUpDown className='h-4 w-4 opacity-60' />
                  </button>
                </PopoverTrigger>
                <PopoverContent className='p-0 w-[--radix-popover-trigger-width] min-w-[260px]'>
                  <Command>
                    <CommandInput placeholder='Search assignee...' />
                    <CommandList>
                      <CommandEmpty>No users found.</CommandEmpty>
                      <CommandGroup heading='Assignee'>
                        <CommandItem
                          key='__unassigned__'
                          onSelect={() => {
                            setAssignee('')
                            setAssigneeOpen(false)
                          }}
                          className='flex items-center gap-2'
                        >
                          <div className='h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px]'>
                            UA
                          </div>
                          <span>Unassigned</span>
                          {assignee === '' && (
                            <Check className='ml-auto h-4 w-4 opacity-70' />
                          )}
                        </CommandItem>
                        {users.map((u) => (
                          <CommandItem
                            key={u.accountId}
                            value={u.displayName}
                            onSelect={() => {
                              setAssignee(u.accountId)
                              setAssigneeOpen(false)
                            }}
                            className='flex items-center gap-2'
                          >
                            <Avatar className='h-5 w-5'>
                              <AvatarImage
                                src={(u as any).avatarUrls?.['24x24']}
                              />
                              <AvatarFallback className='text-[10px]'>
                                {getInitials(u.displayName)}
                              </AvatarFallback>
                            </Avatar>
                            <span className='truncate'>{u.displayName}</span>
                            {assignee === u.accountId && (
                              <Check className='ml-auto h-4 w-4 opacity-70' />
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='issueType'>Issue type</Label>
              <Popover open={issueTypeOpen} onOpenChange={setIssueTypeOpen}>
                <PopoverTrigger asChild>
                  <button
                    type='button'
                    id='issueType'
                    className='border-input bg-background text-foreground w-full justify-between inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-hidden'
                    disabled={loading}
                    aria-haspopup='listbox'
                    aria-expanded={issueTypeOpen}
                  >
                    <span className='truncate'>
                      {issueTypeId
                        ? issueTypes.find((t) => t.id === issueTypeId)?.name ||
                          'Select an issue type'
                        : 'Select an issue type'}
                    </span>
                    <ChevronsUpDown className='h-4 w-4 opacity-60' />
                  </button>
                </PopoverTrigger>
                <PopoverContent className='p-0 w-[--radix-popover-trigger-width] min-w-[260px]'>
                  <Command>
                    <CommandInput placeholder='Search issue types...' />
                    <CommandList>
                      <CommandEmpty>No issue types found.</CommandEmpty>
                      <CommandGroup heading='Issue types'>
                        {issueTypes.map((t) => (
                          <CommandItem
                            key={t.id}
                            value={t.name}
                            onSelect={() => {
                              setIssueTypeId(t.id)
                              setIssueTypeOpen(false)
                            }}
                          >
                            <span className='truncate'>{t.name}</span>
                            {issueTypeId === t.id && (
                              <Check className='ml-auto h-4 w-4 opacity-70' />
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='priority'>Priority</Label>
              <Select
                value={priority}
                onValueChange={setPriority}
                disabled={loading}
              >
                <SelectTrigger id='priority' className='h-10'>
                  <SelectValue placeholder='Select priority' />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      <span className='inline-flex items-center gap-2'>
                        <PriorityGlyph level={p.value} />
                        {p.value}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='component'>Component</Label>
              <Popover open={componentOpen} onOpenChange={setComponentOpen}>
                <PopoverTrigger asChild>
                  <button
                    type='button'
                    id='component'
                    className='border-input bg-background text-foreground w-full justify-between inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-hidden'
                    disabled={loading}
                    aria-haspopup='listbox'
                    aria-expanded={componentOpen}
                  >
                    <span className='truncate'>
                      {componentId
                        ? components.find((c) => c.id === componentId)?.name ||
                          'Select a component'
                        : 'Select a component'}
                    </span>
                    <ChevronsUpDown className='h-4 w-4 opacity-60' />
                  </button>
                </PopoverTrigger>
                <PopoverContent className='p-0 w-[--radix-popover-trigger-width] min-w-[260px]'>
                  <Command>
                    <CommandInput placeholder='Search components...' />
                    <CommandList>
                      <CommandEmpty>No components found.</CommandEmpty>
                      <CommandGroup heading='Components'>
                        {components.map((c) => (
                          <CommandItem
                            key={c.id}
                            value={c.name}
                            onSelect={() => {
                              setComponentId(c.id)
                              setComponentOpen(false)
                            }}
                          >
                            <span className='truncate'>{c.name}</span>
                            {componentId === c.id && (
                              <Check className='ml-auto h-4 w-4 opacity-70' />
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='sprint'>Sprint</Label>
              <Popover open={sprintOpen} onOpenChange={setSprintOpen}>
                <PopoverTrigger asChild>
                  <button
                    type='button'
                    id='sprint'
                    className='border-input bg-background text-foreground w-full justify-between inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-hidden'
                    disabled={loading}
                    aria-haspopup='listbox'
                    aria-expanded={sprintOpen}
                  >
                    <span className='truncate'>
                      {selectedSprintId
                        ? sprints.find((s) => s.id === selectedSprintId)
                            ?.name || 'Select a sprint'
                        : 'Select a sprint'}
                    </span>
                    <ChevronsUpDown className='h-4 w-4 opacity-60' />
                  </button>
                </PopoverTrigger>
                <PopoverContent className='p-0 w-[--radix-popover-trigger-width] min-w-[260px]'>
                  <Command>
                    <CommandInput placeholder='Search sprints...' />
                    <CommandList>
                      <CommandEmpty>No sprints found.</CommandEmpty>
                      <CommandGroup heading='Sprints'>
                        <CommandItem
                          key='__no_sprint__'
                          onSelect={() => {
                            setSelectedSprintId('')
                            setSprintOpen(false)
                          }}
                        >
                          <span className='truncate'>No sprint</span>
                          {selectedSprintId === '' && (
                            <Check className='ml-auto h-4 w-4 opacity-70' />
                          )}
                        </CommandItem>
                        {sprints
                          .slice()
                          .sort((a, b) => {
                            const order = {
                              active: 0,
                              future: 1,
                              closed: 2
                            } as any
                            const sa = (a.state || '').toLowerCase()
                            const sb = (b.state || '').toLowerCase()
                            if (order[sa] !== order[sb])
                              return order[sa] - order[sb]
                            return a.name.localeCompare(b.name)
                          })
                          .map((s) => (
                            <CommandItem
                              key={s.id}
                              value={`${s.name} ${s.state}`}
                              onSelect={() => {
                                setSelectedSprintId(s.id)
                                setSprintOpen(false)
                              }}
                            >
                              <span className='truncate'>{s.name}</span>
                              {selectedSprintId === s.id && (
                                <Check className='ml-auto h-4 w-4 opacity-70' />
                              )}
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='releases'>Releases</Label>
              <VersionsMultiSelect
                id='releases'
                versions={versions}
                selectedIds={selectedVersionIds}
                onChange={setSelectedVersionIds}
                disabled={loading}
              />
            </div>
          </div>

          <LinkIssuePicker
            projectKey={projectKey}
            linkIssueKey={linkIssueKey}
            onLinkIssueKeyChange={setLinkIssueKey}
            linkType={linkType}
            onLinkTypeChange={setLinkType}
            disabled={loading}
          />

          <div className='flex justify-end gap-2 pt-2'>
            <Button variant='outline' onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? (
                <span className='inline-flex items-center gap-2'>
                  <Loader2 className='h-4 w-4 animate-spin' /> Creating...
                </span>
              ) : (
                'Create Issue'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
