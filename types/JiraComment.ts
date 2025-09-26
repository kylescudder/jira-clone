export interface JiraComment {
  id: string
  author: {
    displayName: string
    avatarUrls?: { '24x24'?: string }
  }
  created: string
  body: string
  bodyHtml?: string
}
