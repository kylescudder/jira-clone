"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Check, ChevronsUpDown, X, Calendar, Clock, Archive, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

interface Sprint {
  id: string
  name: string
  state: string
}

interface SprintSelectorProps {
  sprints: Sprint[]
  selectedSprints: string[]
  onSprintChange: (sprints: string[]) => void
  disabled?: boolean
}

const STORAGE_KEYS = {
  SHOW_CLOSED_SPRINTS: "jira-clone-show-closed-sprints",
}

export function SprintSelector({ sprints, selectedSprints, onSprintChange, disabled }: SprintSelectorProps) {
  const [open, setOpen] = useState(false)
  const [showClosedSprints, setShowClosedSprints] = useState(false)

  // Load show closed sprints setting from localStorage on mount
  useEffect(() => {
    const savedShowClosed = localStorage.getItem(STORAGE_KEYS.SHOW_CLOSED_SPRINTS)
    if (savedShowClosed) {
      try {
        setShowClosedSprints(JSON.parse(savedShowClosed))
      } catch (error) {
        console.error("Error parsing saved show closed sprints setting:", error)
      }
    }
  }, [])

  // Save show closed sprints setting to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SHOW_CLOSED_SPRINTS, JSON.stringify(showClosedSprints))
  }, [showClosedSprints])

  const getSprintStateColor = (state: string) => {
    switch (state.toLowerCase()) {
      case "active":
        return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200"
      case "closed":
        return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200"
      case "future":
        return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200"
    }
  }

  const getSprintStateIcon = (state: string) => {
    switch (state.toLowerCase()) {
      case "active":
        return <Clock className="h-3 w-3" />
      case "closed":
        return <Archive className="h-3 w-3" />
      case "future":
        return <Calendar className="h-3 w-3" />
      default:
        return null
    }
  }

  const handleSprintToggle = (sprintName: string) => {
    const newSelection = selectedSprints.includes(sprintName)
      ? selectedSprints.filter((s) => s !== sprintName)
      : [...selectedSprints, sprintName]

    onSprintChange(newSelection)
  }

  const handleRemoveSprint = (sprintName: string, event: React.MouseEvent) => {
    event.stopPropagation()
    onSprintChange(selectedSprints.filter((s) => s !== sprintName))
  }

  const handleClearAll = (event: React.MouseEvent) => {
    event.stopPropagation()
    onSprintChange([])
  }

  const handleShowClosedToggle = (checked: boolean) => {
    setShowClosedSprints(checked)

    // If hiding closed sprints, remove any selected closed sprints
    if (!checked) {
      const closedSprintNames = sprints
        .filter((sprint) => sprint.state.toLowerCase() === "closed")
        .map((sprint) => sprint.name)

      const filteredSelection = selectedSprints.filter((sprintName) => !closedSprintNames.includes(sprintName))

      if (filteredSelection.length !== selectedSprints.length) {
        onSprintChange(filteredSelection)
      }
    }
  }

  // Filter sprints based on showClosedSprints setting
  const filteredSprints = showClosedSprints
    ? sprints
    : sprints.filter((sprint) => sprint.state.toLowerCase() !== "closed")

  // Sort sprints: Active first, then Future, then Closed (if shown)
  const sortedSprints = [...filteredSprints].sort((a, b) => {
    const stateOrder = { active: 0, future: 1, closed: 2 }
    const aOrder = stateOrder[a.state.toLowerCase() as keyof typeof stateOrder] ?? 3
    const bOrder = stateOrder[b.state.toLowerCase() as keyof typeof stateOrder] ?? 3

    if (aOrder !== bOrder) {
      return aOrder - bOrder
    }

    // If same state, sort by name
    return a.name.localeCompare(b.name)
  })

  const selectedSprintObjects = sprints.filter((sprint) => selectedSprints.includes(sprint.name))

  // Count sprints by state
  const sprintCounts = sprints.reduce(
    (acc, sprint) => {
      const state = sprint.state.toLowerCase()
      acc[state] = (acc[state] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  const activeFutureSprints = (sprintCounts.active || 0) + (sprintCounts.future || 0)
  const closedSprints = sprintCounts.closed || 0

  if (sprints.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Calendar className="h-4 w-4" />
        No sprints found for this project
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-[280px] justify-between bg-background hover:bg-accent",
              selectedSprints.length === 0 && "text-muted-foreground",
            )}
            disabled={disabled}
          >
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 shrink-0" />
              {selectedSprints.length === 0
                ? "Click to select sprint(s)..."
                : selectedSprints.length === 1
                  ? selectedSprints[0]
                  : `${selectedSprints.length} sprints selected`}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search sprints..." className="h-9" />

            {/* Sprint visibility controls */}
            <div className="px-3 py-2 border-b bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-muted-foreground">
                  Showing {filteredSprints.length} of {sprints.length} sprints
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="show-closed" checked={showClosedSprints} onCheckedChange={handleShowClosedToggle} />
                  <Label htmlFor="show-closed" className="text-xs cursor-pointer flex items-center gap-1">
                    {showClosedSprints ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    Show closed ({closedSprints})
                  </Label>
                </div>
              </div>

              {/* Sprint counts */}
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  Active: {sprintCounts.active || 0}
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  Future: {sprintCounts.future || 0}
                </div>
                {showClosedSprints && (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-gray-500"></div>
                    Closed: {closedSprints}
                  </div>
                )}
              </div>
            </div>

            <CommandList>
              <CommandEmpty>No sprints found.</CommandEmpty>
              <CommandGroup>
                {sortedSprints.map((sprint) => (
                  <CommandItem
                    key={sprint.id}
                    value={sprint.name}
                    onSelect={() => handleSprintToggle(sprint.name)}
                    className="flex items-center justify-between py-2"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0",
                          selectedSprints.includes(sprint.name) ? "opacity-100 text-primary" : "opacity-0",
                        )}
                      />
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {getSprintStateIcon(sprint.state)}
                        <span className="truncate font-medium">{sprint.name}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className={`ml-2 text-xs shrink-0 ${getSprintStateColor(sprint.state)}`}>
                      {sprint.state}
                    </Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>

            {selectedSprints.length > 0 && (
              <>
                <Separator />
                <div className="p-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearAll}
                    className="w-full text-muted-foreground hover:text-foreground"
                  >
                    Clear all selections
                  </Button>
                </div>
              </>
            )}
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected sprint badges */}
      {selectedSprintObjects.length > 0 && (
        <div className="flex flex-wrap gap-1 max-w-[500px]">
          {selectedSprintObjects.map((sprint) => (
            <Badge
              key={sprint.id}
              variant="secondary"
              className={cn("flex items-center gap-1 max-w-[180px] pr-1", getSprintStateColor(sprint.state))}
            >
              {getSprintStateIcon(sprint.state)}
              <span className="truncate text-xs font-medium">{sprint.name}</span>
              <X
                className="h-3 w-3 cursor-pointer hover:text-red-500 ml-1 shrink-0"
                onClick={(e) => handleRemoveSprint(sprint.name, e)}
              />
            </Badge>
          ))}
        </div>
      )}

      {/* Summary info */}
      {sprints.length > 0 && (
        <div className="text-xs text-muted-foreground">
          {activeFutureSprints} active/future
          {closedSprints > 0 && (
            <span className={cn(showClosedSprints ? "text-foreground" : "")}>
              , {closedSprints} closed {!showClosedSprints && "(hidden)"}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
