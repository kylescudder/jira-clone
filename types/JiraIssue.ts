export interface JiraIssue {
  id: string
  key: string
  summary: string
  description?: string
  descriptionHtml?: string
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
  isLast?: boolean
  nextPageToken?: string
}
