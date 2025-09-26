import type { JiraIssue } from './JiraIssue'

export interface BoardColumn {
  id: string
  title: string
  statusKeys: string[]
  issues: JiraIssue[]
}
