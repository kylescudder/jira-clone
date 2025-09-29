'use client'

import { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
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
import { ChevronsUpDown, Check, Loader2 } from 'lucide-react'
import { fetchIssueSuggestions } from '@/lib/client-api'
import { decodeHtmlEntities } from '@/lib/utils'

interface LinkIssuePickerProps {
  projectKey: string
  linkIssueKey: string
  onLinkIssueKeyChange: (v: string) => void
  linkType: string
  onLinkTypeChange: (v: string) => void
  disabled?: boolean
  label?: string
  layout?: 'row' | 'stack'
}

export function LinkIssuePicker({
  projectKey,
  linkIssueKey,
  onLinkIssueKeyChange,
  linkType,
  onLinkTypeChange,
  disabled,
  label = 'Link to issue (optional)',
  layout = 'row'
}: LinkIssuePickerProps) {
  const [suggestions, setSuggestions] = useState<
    Array<{ key: string; summary: string }>
  >([])
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [suggestIndex, setSuggestIndex] = useState(0)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [debounceTimer, setDebounceTimer] = useState<any>(null)
  const [relOpen, setRelOpen] = useState(false)
  const [displayText, setDisplayText] = useState<string | null>(null)

  // Clear display text if parent clears the key
  useEffect(() => {
    if (!linkIssueKey || linkIssueKey.trim() === '') {
      setDisplayText(null)
    }
  }, [linkIssueKey])

  useEffect(() => {
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
    }
  }, [debounceTimer])

  return (
    <div className='space-y-2'>
      {label ? <Label>{label}</Label> : null}
      <div
        className={layout === 'stack' ? 'flex flex-col gap-3' : 'flex gap-2'}
      >
        {/* Relationship type dropdown */}
        <div className={layout === 'stack' ? 'w-full' : 'w-[220px] shrink-0'}>
          <Popover open={relOpen} onOpenChange={setRelOpen}>
            <PopoverTrigger asChild>
              <button
                type='button'
                className='border-input bg-background text-foreground w-full justify-between inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-hidden disabled:opacity-60'
                disabled={disabled || !linkIssueKey.trim()}
                aria-haspopup='listbox'
                aria-expanded={relOpen}
              >
                <span className='truncate'>{linkType}</span>
                <ChevronsUpDown className='h-4 w-4 opacity-60' />
              </button>
            </PopoverTrigger>
            <PopoverContent className='p-0 w-[--radix-popover-trigger-width] min-w-[220px]'>
              <Command>
                <CommandInput placeholder='Search relationship...' />
                <CommandList>
                  <CommandEmpty>No types found.</CommandEmpty>
                  <CommandGroup heading='Types'>
                    {[
                      'Relates',
                      'Blocks',
                      'Blocked by',
                      'Duplicates',
                      'Duplicated by',
                      'Clones',
                      'Cloned by'
                    ].map((t) => (
                      <CommandItem
                        key={t}
                        value={t}
                        onSelect={() => {
                          onLinkTypeChange(t)
                          setRelOpen(false)
                        }}
                      >
                        {t}
                        {linkType.toLowerCase() === t.toLowerCase() && (
                          <Check className='ml-auto h-4 w-4 opacity-70' />
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <div className='text-[11px] text-muted-foreground mt-1'>
            Direction is applied automatically.
          </div>
        </div>

        {/* Issue search input */}
        <div
          className={layout === 'stack' ? 'relative w-full' : 'relative grow'}
        >
          <Input
            value={displayText ?? linkIssueKey}
            className='rounded-md'
            onChange={(e) => {
              setDisplayText(null)
              const val = e.target.value
              onLinkIssueKeyChange(val)
              setSuggestIndex(0)
              if (debounceTimer) {
                clearTimeout(debounceTimer)
                setDebounceTimer(null)
              }
              const trimmed = val.trim()
              if (!projectKey || trimmed.length < 6) {
                setSuggestions([])
                setSuggestOpen(false)
                return
              }
              const timer = setTimeout(async () => {
                setSuggestLoading(true)
                const list = await fetchIssueSuggestions(projectKey, trimmed)
                setSuggestions(list)
                setSuggestOpen(list.length > 0)
                setSuggestLoading(false)
              }, 300)
              setDebounceTimer(timer)
            }}
            onFocus={() => {
              if (suggestions.length > 0) setSuggestOpen(true)
            }}
            onKeyDown={(e) => {
              if (!suggestOpen) return
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSuggestIndex((i) => Math.min(suggestions.length - 1, i + 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSuggestIndex((i) => Math.max(0, i - 1))
              } else if (e.key === 'Enter') {
                if (suggestions.length > 0) {
                  e.preventDefault()
                  const item = suggestions[suggestIndex] || suggestions[0]
                  onLinkIssueKeyChange(item.key)
                  setDisplayText(
                    `${item.key} — ${decodeHtmlEntities(item.summary)}`
                  )
                  setSuggestOpen(false)
                }
              } else if (e.key === 'Escape') {
                setSuggestOpen(false)
              }
            }}
            placeholder='Type at least 6 characters of the issue key, e.g. MP5-12'
            disabled={disabled}
          />
          {linkIssueKey.trim().length < 6 && (
            <div className='text-xs text-muted-foreground mt-1'>
              Type at least 6 characters to search (e.g., MP5-12).
            </div>
          )}
          {suggestOpen && (
            <div className='absolute left-0 right-0 z-30 mt-1 max-h-64 overflow-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md'>
              {suggestLoading && (
                <div className='px-3 py-2 text-sm text-muted-foreground'>
                  <Loader2 className='inline mr-2 h-4 w-4 animate-spin' />
                  Loading...
                </div>
              )}
              {!suggestLoading && suggestions.length === 0 && (
                <div className='px-3 py-2 text-sm text-muted-foreground'>
                  No results
                </div>
              )}
              {!suggestLoading &&
                suggestions.map((s, idx) => (
                  <button
                    key={s.key}
                    type='button'
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground ${idx === suggestIndex ? 'bg-accent text-accent-foreground' : ''}`}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      onLinkIssueKeyChange(s.key)
                      setDisplayText(
                        `${s.key} — ${decodeHtmlEntities(s.summary)}`
                      )
                      setSuggestOpen(false)
                    }}
                  >
                    <span className='font-medium'>{s.key}</span>
                    <span className='ml-2 text-muted-foreground truncate inline-block max-w-[70%] align-middle'>
                      {decodeHtmlEntities(s.summary)}
                    </span>
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
