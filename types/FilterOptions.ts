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
