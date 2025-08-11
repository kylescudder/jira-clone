export interface JiraIssue {
  id: string
  key: string
  summary: string
  description?: string
  status: {
    name: string
    statusCategory: {
      key: string
      colorName: string
    }
  }
  priority: {
    name: string
    iconUrl: string
  }
  assignee?: {
    displayName: string
    avatarUrls: {
      '24x24': string
    }
  }
  reporter: {
    displayName: string
    avatarUrls: {
      '24x24': string
    }
  }
  issuetype: {
    name: string
    iconUrl: string
  }
  created: string
  updated: string
  duedate?: string
  labels: string[]
  components: Array<{
    name: string
  }>
  sprint?: {
    id: number
    name: string
    state: string
  }
  fixVersions: Array<{
    id: string
    name: string
    released: boolean
    archived?: boolean
  }>
}

export interface JiraAttachmentMeta {
  id: string
  filename: string
  size: number
  mimeType?: string
  isImage: boolean
}

export interface JiraComment {
  id: string
  author: {
    displayName: string
    avatarUrls?: { '24x24'?: string }
  }
  created: string
  body: string
}

export interface JiraChangeLogItem {
  id: string
  author: {
    displayName: string
  }
  created: string
  items: Array<{
    field: string
    fromString?: string
    toString?: string
  }>
}

export interface JiraIssueDetails {
  attachments: JiraAttachmentMeta[]
  comments: JiraComment[]
  changelog: JiraChangeLogItem[]
}

export interface JiraProject {
  id: string
  key: string
  name: string
}

export interface JiraUser {
  displayName: string
  emailAddress: string
  accountId: string
}

export interface FilterOptions {
  status?: string[]
  priority?: string[]
  assignee?: string[]
  issueType?: string[]
  labels?: string[]
  dueDateFrom?: string
  dueDateTo?: string
  components?: string[]
  reporter?: string[]
  sprint?: string[]
  release?: string[]
}

export interface BoardColumn {
  id: string
  title: string
  statusKeys: string[]
  issues: JiraIssue[]
}
