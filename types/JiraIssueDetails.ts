import type { JiraAttachmentMeta } from './JiraAttachmentMeta'
import type { JiraComment } from './JiraComment'
import type { JiraChangeLogItem } from './JiraChangeLogItem'

export interface JiraIssueLink {
  id: string
  type: {
    name: string
    inward: string
    outward: string
  }
  direction: 'inward' | 'outward'
  relationship: string
  issue: {
    key: string
    summary: string
    status?: {
      name: string
      statusCategory?: {
        key?: string
        colorName?: string
      }
    }
    issuetype?: {
      name?: string
      iconUrl?: string
    }
    priority?: {
      name?: string
      iconUrl?: string
    }
  }
}

export interface JiraIssueDetails {
  attachments: JiraAttachmentMeta[]
  comments: JiraComment[]
  changelog: JiraChangeLogItem[]
  issueLinks: JiraIssueLink[]
}
