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
