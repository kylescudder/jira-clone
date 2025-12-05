import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function normalizeStatusName(status: string): string {
  // Convert status names to a more readable format
  const statusMap: Record<string, string> = {
    // To Do group
    'to do': 'To Do',
    todo: 'To Do',
    open: 'To Do',
    new: 'To Do',
    backlog: 'To Do',

    // Attention Needed group
    'attention needed': 'Attention Needed',

    // Blocked group
    blocked: 'Blocked',
    blocking: 'Blocked',
    impediment: 'Blocked',
    stuck: 'Blocked',

    // In Progress group
    'in progress': 'In Progress',
    inprogress: 'In Progress',

    // Current Active Issue group
    'current active issue': 'Current Active Issue',

    // In PR group
    'in pr': 'In PR',
    'pull request': 'In PR',
    'pr submitted': 'In PR',
    'pr review': 'In PR',
    'pull request review': 'In PR',

    // In Review group
    'in review': 'In Review',
    'code review': 'In Review',
    review: 'In Review',

    // Awaiting Testing group
    'awaiting testing': 'Awaiting Testing',
    'waiting for test': 'Awaiting Testing',
    'ready for testing': 'Awaiting Testing',
    'pending test': 'Awaiting Testing',

    // Iteration Required group
    'iteration required': 'Iteration Required',
    'needs iteration': 'Iteration Required',
    'requires iteration': 'Iteration Required',
    'iteration needed': 'Iteration Required',

    // Awaiting Information group
    'awaiting information': 'Awaiting Information',
    'waiting for info': 'Awaiting Information',
    'needs information': 'Awaiting Information',
    'pending information': 'Awaiting Information',
    'awaiting info': 'Awaiting Information',

    // Under Monitoring group
    'under monitoring': 'Under Monitoring',
    monitoring: 'Under Monitoring',
    'being monitored': 'Under Monitoring',

    // For Product Prioritisation (as provided)
    'for product prioritisation': 'For Product Prioritisation',

    // Not an Issue group
    'not an issue': 'Not an Issue',
    invalid: 'Not an Issue',
    'not a bug': 'Not an Issue',
    "won't fix": 'Not an Issue',
    'wont fix': 'Not an Issue',

    // Requires a Config Change group
    'requires a config change': 'Requires Config Change',
    'requires config change': 'Requires Config Change',
    'config change': 'Requires Config Change',
    'configuration change': 'Requires Config Change',
    'needs config': 'Requires Config Change',

    // Done group
    done: 'Done',
    closed: 'Done',
    resolved: 'Done',
    complete: 'Done',
    completed: 'Done'
  }

  const normalized = statusMap[status.toLowerCase()]
  return normalized || status
}

export function getStatusColor(status: string): string {
  const s = normalizeStatusName(status).toLowerCase()

  // Map normalized statuses to Catppuccin hues via our theme tokens
  // We use subtle tints for backgrounds with strong text color:
  // bg: token /12–20, text: token, border: token /30
  const tokenFor: Record<string, string> = {
    // To Do group → Sapphire (chart-3)
    'to do': '--chart-3',

    // Attention Needed → Red (destructive)
    'attention needed': '--destructive',

    // Blocked → Red (destructive)
    blocked: '--destructive',

    // In Progress → Peach (chart-4)
    'in progress': '--chart-4',

    // Current Active Issue → Mauve (primary)
    'current active issue': '--primary',

    // In PR → Mauve (primary)
    'in pr': '--primary',

    // In Review → Mauve (primary)
    'in review': '--primary',

    // Awaiting Testing → Blue (chart-1)
    'awaiting testing': '--chart-1',

    // Iteration Required → Mauve (primary)
    'iteration required': '--primary',

    // Awaiting Information → Sapphire (chart-3)
    'awaiting information': '--chart-3',

    // Under Monitoring → Blue (chart-1)
    'under monitoring': '--chart-1',

    // For Product Prioritisation → Sapphire (chart-3)
    'for product prioritisation': '--chart-3',

    // Requires Config Change → Green (chart-5)
    'requires config change': '--chart-5',

    // Not an Issue → Green (chart-5)
    'not an issue': '--chart-5',

    // Done → Green (chart-5)
    done: '--chart-5'
  }

  const token = tokenFor[s]
  if (token) {
    return `bg-[hsl(var(${token}))/14] text-[hsl(var(${token}))] border-[hsl(var(${token}))/30]`
  }

  // Fallback to muted neutral
  return 'bg-muted/30 text-muted-foreground border-border'
}

export function getStatusGroupRank(status: string): number {
  const s = normalizeStatusName(status).toLowerCase()
  const greyGroup = new Set([
    'to do',
    'awaiting testing',
    'for product prioritisation'
  ])
  const blueGroup = new Set([
    'in progress',
    'iteration required',
    'blocked',
    'current active issue',
    'in pr',
    'awaiting information',
    'under monitoring'
  ])
  const greenGroup = new Set(['done', 'requires config change', 'not an issue'])
  if (greyGroup.has(s)) return 0
  if (blueGroup.has(s)) return 1
  if (greenGroup.has(s)) return 2
  // Unknowns: place after known groups but before green? Put at end to be safe
  return 3
}

// New shared helpers to reduce duplication across components
export function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  const tag = (el?.tagName || '').toLowerCase()
  const isContentEditable = (el as any)?.isContentEditable === true
  return tag === 'input' || tag === 'textarea' || isContentEditable
}

export function getInitials(name: string): string {
  return (name || '')
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function dedupeBy<T, K>(items: T[], keySelector: (item: T) => K): T[] {
  const seen = new Set<K>()
  const out: T[] = []
  for (const it of items || []) {
    const key = keySelector(it)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(it)
  }
  return out
}

// Minimal HTML entity decoder for safely displaying text values that may already
// be entity-encoded (e.g., names in dropdowns). This does NOT execute HTML; it
// only converts common entities back to their characters so React can render
// them as plain text.
export function decodeHtmlEntities(input: string | null | undefined): string {
  if (!input) return ''
  return input
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#x27;/gi, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}
