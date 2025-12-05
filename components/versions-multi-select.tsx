'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { ChevronsUpDown, Check, Eye, EyeOff, Tag } from 'lucide-react'
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
import { decodeHtmlEntities } from '@/lib/utils'

export type VersionItem = {
  id: string
  name: string
  released: boolean
  archived?: boolean
}

interface VersionsMultiSelectProps {
  versions: VersionItem[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
  id?: string
  className?: string
  buttonClassName?: string
  showBadgesSummary?: boolean
}

export function VersionsMultiSelect({
  versions,
  selectedIds,
  onChange,
  disabled,
  id,
  className,
  buttonClassName,
  showBadgesSummary
}: VersionsMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [showReleased, setShowReleased] = useState(false)

  const visibleVersions = useMemo(
    () => versions.filter((v) => !v.archived && (showReleased || !v.released)),
    [versions, showReleased]
  )

  const selectedText = useMemo(() => {
    if (selectedIds.length === 0) return 'Click to select version(s)...'
    if (selectedIds.length === 1) {
      const v = versions.find((x) => x.id === selectedIds[0])
      return decodeHtmlEntities(v?.name || '1 selected')
    }
    return `${selectedIds.length} versions selected`
  }, [selectedIds, versions])

  return (
    <div className={className}>
      {showBadgesSummary ? (
        <div className='flex flex-wrap gap-1 mb-2'>
          {selectedIds.length > 0 ? (
            versions
              .filter((v) => selectedIds.includes(v.id))
              .map((v) => (
                <Badge
                  key={v.id}
                  variant='secondary'
                  size='compact'
                  className='text-xs'
                >
                  {decodeHtmlEntities(v.name)}
                </Badge>
              ))
          ) : (
            <span className='text-muted-foreground text-sm'>No Release</span>
          )}
        </div>
      ) : null}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant='outline'
            role='combobox'
            aria-expanded={open}
            className={`bg-background hover:bg-accent w-full justify-between ${
              selectedIds.length === 0 ? 'text-muted-foreground' : ''
            } ${buttonClassName || ''}`}
            disabled={disabled}
          >
            <div className='flex items-center gap-2'>
              <Tag className='h-4 w-4 shrink-0' />
              {selectedText}
            </div>
            <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
          </Button>
        </PopoverTrigger>
        <PopoverContent className='w-[90vw] sm:w-[400px] p-0' align='start'>
          <Command>
            <CommandInput placeholder='Search versions...' className='h-9' />

            <div className='bg-muted/30 border-b px-3 py-2'>
              <div className='flex items-center justify-between'>
                <div className='text-muted-foreground text-xs font-medium'>
                  Showing {visibleVersions.length} of{' '}
                  {versions.filter((v) => !v.archived).length} versions
                </div>
                <div className='flex items-center gap-2'>
                  <Checkbox
                    id={`${id || 'versions'}-show-released`}
                    checked={showReleased}
                    onCheckedChange={(checked) => setShowReleased(!!checked)}
                  />
                  <Label
                    htmlFor={`${id || 'versions'}-show-released`}
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
                {visibleVersions
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((v) => (
                    <CommandItem
                      key={v.id}
                      value={v.name}
                      onSelect={() => {
                        onChange(
                          ((prev) => {
                            const set = new Set(prev)
                            if (set.has(v.id)) set.delete(v.id)
                            else set.add(v.id)
                            return Array.from(set)
                          })(selectedIds)
                        )
                      }}
                      className='flex items-center justify-between py-2'
                    >
                      <div className='flex min-w-0 flex-1 items-center gap-2'>
                        <Check
                          className={`${selectedIds.includes(v.id) ? 'text-primary opacity-100' : 'opacity-0'} h-4 w-4 shrink-0`}
                        />
                        <span className='truncate font-medium'>
                          {decodeHtmlEntities(v.name)}
                        </span>
                      </div>
                      <Badge
                        variant='outline'
                        className={`ml-2 shrink-0 text-xs ${v.released ? 'bg-[hsl(var(--chart-5))/14] text-[hsl(var(--chart-5))] border-[hsl(var(--chart-5))/30]' : 'bg-[hsl(var(--chart-1))/14] text-[hsl(var(--chart-1))] border-[hsl(var(--chart-1))/30]'}`}
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
  )
}

export default VersionsMultiSelect
