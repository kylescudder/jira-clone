import type { JiraAttachmentMeta } from './JiraAttachmentMeta'
import type { JiraComment } from './JiraComment'
import type { JiraChangeLogItem } from './JiraChangeLogItem'

export interface JiraIssueDetails {
  attachments: JiraAttachmentMeta[]
  comments: JiraComment[]
  changelog: JiraChangeLogItem[]
}
