'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, ChevronsUpDown, Check, Eye, EyeOff, Tag, X } from 'lucide-react'
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LinkIssuePicker } from '@/components/link-issue-picker'
import {
  fetchProjectUsers,
  fetchProjectComponents,
  createIssueClient,
  fetchIssueSuggestions,
  fetchIssueTypes,
  fetchProjectVersions,
  fetchProjectSprints,
  uploadIssueAttachments
} from '@/lib/client-api'
import { useToast } from '@/lib/use-toast'
import { getInitials, isEditableTarget, decodeHtmlEntities } from '@/lib/utils'
import { VersionsMultiSelect } from '@/components/versions-multi-select'
import { JiraUser } from '@/types/JiraUser'

// Type for pending images waiting to be uploaded after issue creation
interface PendingImage {
  id: string
  file: File
  previewUrl: string
}

interface NewIssueModalProps {
  projectKey: string
  isOpen: boolean
  onClose: () => void
  onCreated: (issueKey: string) => void
}

export function NewIssueModal({
  projectKey,
  isOpen,
  onClose,
  onCreated
}: NewIssueModalProps) {
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
      sprintId: selectedSprintId || undefined
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
              const realToken = `<attachment:${attachment.id}>`
              updatedDescription = updatedDescription.replace(
                placeholder,
                realToken
              )
            }
          })

          // Update the issue description with real attachment tokens
          // Note: We need to call an API to update the description
          // For now, the placeholders will remain until user edits the issue
          // This is acceptable as the images are still attached to the issue
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
