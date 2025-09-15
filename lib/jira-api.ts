import type {
  JiraIssue,
  JiraProject,
  JiraUser,
  FilterOptions
} from '@/types/jira'
import { cookies } from 'next/headers'

const JIRA_BASE_URL =
  process.env.JIRA_BASE_URL || 'https://your-domain.atlassian.net'
const JIRA_EMAIL = process.env.JIRA_EMAIL || ''
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || ''

const basicAuth =
  JIRA_EMAIL && JIRA_API_TOKEN
    ? Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64')
    : ''

async function getAuthAndBase() {
  // Prefer user OAuth tokens from cookies when available
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get('JIRA_ACCESS_TOKEN')?.value
    const cloudId = cookieStore.get('JIRA_CLOUD_ID')?.value

    if (accessToken && cloudId) {
      return {
        base: `https://api.atlassian.com/ex/jira/${cloudId}`,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json'
        }
      }
    }
  } catch (e) {
    // cookies() is only available in server runtime; ignore if not available
  }

  // Fallback to Basic auth using env (useful for local dev or service mode)
  return {
    base: JIRA_BASE_URL,
    headers: {
      ...(basicAuth ? { Authorization: `Basic ${basicAuth}` } : {}),
      Accept: 'application/json',
      'Content-Type': 'application/json'
    }
  }
}

async function jiraFetch(endpoint: string, options?: RequestInit) {
  const { base, headers } = await getAuthAndBase()
  let response = await fetch(`${base}/rest/api/3${endpoint}`, {
    headers: {
      ...headers
    },
    ...options
  })

  // If OAuth token is present but lacks required scope, fall back to Basic auth using env token
  if (response.status === 401 && basicAuth) {
    try {
      response = await fetch(`${JIRA_BASE_URL}/rest/api/3${endpoint}`, {
        headers: {
          Authorization: `Basic ${basicAuth}`,
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        ...options
      })
    } catch (e) {
      // network error; will be handled below as !ok
    }
  }

  if (!response.ok) {
    throw new Error(`Jira API error: ${response.status} ${response.statusText}`)
  }

  // Handle empty responses (like 204 No Content)
  const contentLength = response.headers.get('content-length')
  const contentType = response.headers.get('content-type')

  if (
    contentLength === '0' ||
    response.status === 204 ||
    !contentType?.includes('application/json')
  ) {
    return null
  }

  const text = await response.text()
  if (!text.trim()) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch (error) {
    console.error('Failed to parse JSON response:', text)
    throw new Error('Invalid JSON response from Jira API')
  }
}

// Separate function for Agile API calls (boards, sprints)
async function jiraAgileFetch(endpoint: string, options?: RequestInit) {
  const { base, headers } = await getAuthAndBase()
  let response = await fetch(`${base}/rest/agile/1.0${endpoint}`, {
    headers: {
      ...headers
    },
    ...options
  })

  // If OAuth token is present but lacks Agile scope, fall back to Basic auth using env token
  if (response.status === 401 && basicAuth) {
    try {
      response = await fetch(`${JIRA_BASE_URL}/rest/agile/1.0${endpoint}`, {
        headers: {
          Authorization: `Basic ${basicAuth}`,
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        ...options
      })
    } catch (e) {
      // network error; will be handled below as !ok
    }
  }

  if (!response.ok) {
    throw new Error(
      `Jira Agile API error: ${response.status} ${response.statusText}`
    )
  }

  // Handle empty responses
  const contentLength = response.headers.get('content-length')
  const contentType = response.headers.get('content-type')

  if (
    contentLength === '0' ||
    response.status === 204 ||
    !contentType?.includes('application/json')
  ) {
    return null
  }

  const text = await response.text()
  if (!text.trim()) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch (error) {
    console.error('Failed to parse JSON response:', text)
    throw new Error('Invalid JSON response from Jira Agile API')
  }
}

// Helper function to fetch all paginated results
async function fetchAllPaginated(
  fetchFunction: (startAt: number, maxResults: number) => Promise<any>,
  maxResults = 100
): Promise<any[]> {
  const allResults: any[] = []
  let startAt = 0
  let total = 0
  let hasMore = true

  while (hasMore) {
    try {
      const data = await fetchFunction(startAt, maxResults)

      if (!data || !data.values || data.values.length === 0) {
        break
      }

      allResults.push(...data.values)
      total = data.total || data.values.length
      startAt += data.values.length

      // Check if we have more results
      hasMore = data.values.length === maxResults && startAt < total

      console.log(
        `Fetched ${data.values.length} items. Total so far: ${allResults.length}${total > 0 ? `/${total}` : ''}`
      )

      // Safety check to prevent infinite loops
      if (allResults.length > 10000) {
        console.warn(
          'Reached safety limit of 10,000 items. Stopping pagination.'
        )
        break
      }
    } catch (error) {
      console.error('Error in pagination:', error)
      break
    }
  }

  return allResults
}

// Helper function to extract text from Jira's Atlassian Document Format (ADF)
function extractTextFromADF(adfContent: any): string {
  if (!adfContent) return ''

  const extractText = (node: any): string => {
    if (!node) return ''

    // If it's a text node, return the text
    if (node.type === 'text' && node.text) {
      return node.text
    }

    // If it has content array, recursively extract from each item
    if (node.content && Array.isArray(node.content)) {
      return node.content.map(extractText).join('')
    }

    // Handle different node types
    switch (node.type) {
      case 'paragraph':
        return extractText({ content: node.content }) + '\n\n'
      case 'heading':
        return extractText({ content: node.content }) + '\n\n'
      case 'bulletList':
      case 'orderedList':
        return (
          node.content
            ?.map((item: any) => '• ' + extractText(item))
            .join('\n') + '\n\n'
        )
      case 'listItem':
        return extractText({ content: node.content })
      case 'codeBlock':
        return `\`\`\`\n${extractText({ content: node.content })}\n\`\`\`\n\n`
      case 'blockquote':
        return `> ${extractText({ content: node.content })}\n\n`
      case 'hardBreak':
        return '\n'
      case 'mention': {
        const t = node.attrs?.text || ''
        return t || '@user'
      }
      case 'table': {
        const rows = (node.content || []).map((row: any) => extractText(row))
        return rows.join('\n') + '\n\n'
      }
      case 'tableRow': {
        const cells = (node.content || []).map((cell: any) => extractText(cell))
        return cells.join('\t')
      }
      case 'tableHeader':
      case 'tableHeaderCell':
      case 'tableCell':
        return extractText({ content: node.content })
      default:
        // For unknown types, try to extract content if it exists
        if (node.content) {
          return extractText({ content: node.content })
        }
        return ''
    }
  }

  try {
    // Handle the case where description is the full ADF document
    if (adfContent.content && Array.isArray(adfContent.content)) {
      return adfContent.content.map(extractText).join('').trim()
    }

    // Handle the case where description is already a content array
    if (Array.isArray(adfContent)) {
      return adfContent.map(extractText).join('').trim()
    }

    // Fallback for simple text
    if (typeof adfContent === 'string') {
      return adfContent
    }

    return extractText(adfContent).trim()
  } catch (error) {
    console.error('Error extracting text from ADF:', error)
    return 'Unable to parse description'
  }
}

// Convert Jira ADF to minimal HTML preserving basic formatting
export function adfToHtml(
  adf: any,
  attachments?: Array<{ id: string; filename: string; content?: string }>,
  issueKey?: string
): string {
  if (adf == null) return ''

  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  // If the input is a plain string (legacy/plain text), escape and preserve newlines
  if (typeof adf === 'string') {
    const safe = esc(adf)
    // Convert consecutive blank lines to separate paragraphs
    const parts = safe
      .split(/\n{2,}/)
      .map((block) => block.replace(/\n/g, '<br />'))
    return parts.map((p) => `<p>${p}</p>`).join('')
  }

  const renderMarks = (text: string, marks?: any[]) => {
    if (!marks || !Array.isArray(marks) || marks.length === 0) return esc(text)
    let html = esc(text)
    // Apply marks in a stable order
    const order = {
      link: 1,
      code: 2,
      strong: 3,
      em: 4,
      underline: 5,
      strike: 6
    }
    const sorted = [...marks].sort(
      (a, b) => (order[a.type] || 99) - (order[b.type] || 99)
    )
    for (const mark of sorted) {
      switch (mark.type) {
        case 'link':
          {
            const href = mark.attrs?.href || '#'
            html = `<a href="${href}" target="_blank" rel="noopener noreferrer">${html}</a>`
          }
          break
        case 'code':
          html = `<code>${html}</code>`
          break
        case 'strong':
          html = `<strong>${html}</strong>`
          break
        case 'em':
          html = `<em>${html}</em>`
          break
        case 'underline':
          html = `<u>${html}</u>`
          break
        case 'strike':
        case 'strikeout':
          html = `<s>${html}</s>`
          break
        default:
          break
      }
    }
    return html
  }

  const renderNode = (node: any): string => {
    if (!node) return ''
    if (node.type === 'text') {
      return renderMarks(node.text || '', node.marks)
    }

    const renderChildren = (n: any) =>
      (n.content || []).map((c: any) => renderNode(c)).join('')

    switch (node.type) {
      case 'doc':
        return renderChildren(node)
      case 'paragraph': {
        // If this paragraph contains block-level nodes (e.g., tables or lists),
        // do not wrap them in <p> to avoid invalid HTML and broken layout.
        const hasBlockChild =
          Array.isArray(node.content) &&
          node.content.some((c: any) => {
            const t = c?.type
            return (
              t === 'table' ||
              t === 'bulletList' ||
              t === 'orderedList' ||
              t === 'heading' ||
              t === 'codeBlock' ||
              t === 'blockquote' ||
              t === 'mediaSingle' ||
              t === 'mediaGroup'
            )
          })
        const inner = (node.content || [])
          .map((c: any) => renderNode(c))
          .join('')
        if (hasBlockChild) return inner || ''
        // If paragraph is empty, render an empty line to keep spacing
        return `<p>${inner || '<br />'}</p>`
      }
      case 'heading': {
        const level = Math.min(Math.max(Number(node.attrs?.level) || 1, 1), 6)
        return `<h${level}>${renderChildren(node)}</h${level}>`
      }
      case 'hardBreak':
        return '<br />'
      case 'bulletList':
        return `<ul>${renderChildren(node)}</ul>`
      case 'orderedList':
        return `<ol>${renderChildren(node)}</ol>`
      case 'listItem':
        return `<li>${renderChildren(node)}</li>`
      case 'blockquote':
        return `<blockquote>${renderChildren(node)}</blockquote>`
      case 'codeBlock': {
        const code = renderChildren(node)
        return `<pre><code>${code}</code></pre>`
      }
      // Tables
      case 'table': {
        const inner = (node.content || [])
          .map((row: any) => renderNode(row))
          .join('')
        // Use class-based styling for better light/dark contrast
        return `<table class="adf-table" style="width: 100%; margin: 0.5rem 0;">${inner}</table>`
      }
      case 'tableRow': {
        const cells = (node.content || [])
          .map((cell: any) => renderNode(cell))
          .join('')
        return `<tr>${cells}</tr>`
      }
      case 'tableHeader':
      case 'tableHeaderCell': // some exporters use this name
      case 'tableCell': {
        const tag =
          node.type === 'tableHeader' || node.type === 'tableHeaderCell'
            ? 'th'
            : 'td'
        const inner = renderChildren(node)
        const align = node.attrs?.colspan
          ? ` colspan="${Number(node.attrs.colspan)}"`
          : ''
        const rowspan = node.attrs?.rowspan
          ? ` rowspan="${Number(node.attrs.rowspan)}"`
          : ''
        const cls = tag === 'th' ? 'adf-th' : 'adf-td'
        return `<${tag}${align}${rowspan} class="${cls}" style="padding: 6px 8px; vertical-align: top;">${inner}</${tag}>`
      }
      // Render media containers
      case 'mediaSingle': {
        // mediaSingle usually wraps a single media node (image/video)
        const inner = renderChildren(node)
        // Wrap in a responsive container
        return `<div class="adf-media adf-media-single" style="margin: 0.5rem 0;">${inner}</div>`
      }
      case 'mediaGroup': {
        const inner = renderChildren(node)
        return `<div class="adf-media-group" style="display:flex; flex-wrap:wrap; gap:8px; margin: 0.5rem 0;">${inner}</div>`
      }
      case 'media': {
        const attrs = node.attrs || {}
        const alt = esc(attrs.alt || attrs.title || '')

        // Try to match this media node to a Jira attachment
        let matchedAttachment
        if (attachments && attachments.length) {
          // Match by filename first
          if (attrs.alt) {
            matchedAttachment = attachments.find(
              (att) => att.filename === attrs.alt
            )
          }
          // Match by mediaId in content URL if available
          if (!matchedAttachment && attrs.id) {
            matchedAttachment = attachments.find((att) =>
              att.content?.includes(`/attachment/${att.id}/`)
            )
          }
        }

        // If matched, use numeric ID for your proxy
        if (matchedAttachment) {
          const src = issueKey
            ? `/api/issues/${issueKey}/attachments/${matchedAttachment.id}?disposition=inline`
            : `/api/attachments/${matchedAttachment.id}?disposition=inline`
          return `<img src="${src}" alt="${alt}" style="max-width:100%; height:auto; border-radius:4px;" />`
        }

        // Fallback to existing UUID-based URL
        if (attrs.id || attrs.mediaId) {
          const mediaId = attrs.id || attrs.mediaId
          const src = issueKey
            ? `/api/issues/${issueKey}/attachments/${mediaId}?disposition=inline`
            : `/api/attachments/${mediaId}?disposition=inline`
          return `<img src="${src}" alt="${alt}" style="max-width:100%; height:auto; border-radius:4px;" />`
        }

        return `<span class="adf-media-file" title="${alt}" style="display:inline-block; background:rgba(125,125,125,0.1); color:inherit; font-size:12px; padding:2px 6px; border-radius:4px;">[media]</span>`
      }
      // Non-standard but sometimes seen in exported ADF
      case 'image': {
        const src = node.attrs?.src
        if (src) {
          const alt = esc(node.attrs?.alt || node.attrs?.title || '')
          let url = src
          const m = url.match(
            /(?:https?:\/\/[^/]+)?\/secure\/attachment\/(\d+)\//
          )
          if (m && m[1]) {
            url = issueKey
              ? `/api/issues/${issueKey}/attachments/${m[1]}?disposition=inline`
              : `/api/attachments/${m[1]}?disposition=inline`
          }
          return `<img src="${url}" alt="${alt}" style="max-width:100%; height:auto; border-radius:4px;" />`
        }
        return ''
      }
      case 'mention': {
        const t = esc(node.attrs?.text || '@user')
        return `<span class="jira-mention" style="background: rgba(87,114,255,0.15); color: inherit; padding: 0 2px; border-radius: 3px;">${t}</span>`
      }
      default:
        if (Array.isArray(node.content)) return renderChildren(node)
        return ''
    }
  }

  try {
    if (typeof adf === 'string') return `<p>${esc(adf)}</p>`

    // If full document
    if (adf.type === 'doc') return renderNode(adf)

    // If a node or array of nodes
    if (Array.isArray(adf)) return adf.map(renderNode).join('')

    return renderNode(adf)
  } catch (e) {
    console.warn('adfToHtml render error', e)
    return ''
  }
}

export async function getCurrentUser(): Promise<JiraUser | null> {
  try {
    const data = await jiraFetch('/myself')
    if (!data) return null

    return {
      displayName: data.displayName,
      emailAddress: data.emailAddress,
      accountId: data.accountId
    }
  } catch (error) {
    console.error('Error fetching current user:', error)
    return null
  }
}

export async function getProjects(): Promise<JiraProject[]> {
  try {
    const data = await jiraFetch('/project')
    if (!data) return []

    return data.map((project: any) => ({
      id: project.id,
      key: project.key,
      name: project.name
    }))
  } catch (error) {
    console.error('Error fetching projects:', error)
    return []
  }
}

export async function getProjectUsers(projectKey: string): Promise<JiraUser[]> {
  try {
    // Fetch all users with pagination
    const allUsers = await fetchAllPaginated(async (startAt, maxResults) => {
      const data = await jiraFetch(
        `/user/assignable/search?project=${projectKey}&startAt=${startAt}&maxResults=${maxResults}`
      )
      return { values: data || [], total: data?.length || 0 }
    }, 100)

    return allUsers.map((user: any) => ({
      displayName: user.displayName,
      emailAddress: user.emailAddress,
      accountId: user.accountId
    }))
  } catch (error) {
    console.error('Error fetching project users:', error)
    return []
  }
}

export async function getProjectSprints(
  projectKey: string
): Promise<Array<{ id: string; name: string; state: string }>> {
  try {
    console.log(`Fetching ALL sprints for project: ${projectKey}`)

    // Step 1: Get all boards for the project (with pagination)
    console.log(`Looking for all boards for project: ${projectKey}`)

    const allBoards = await fetchAllPaginated(async (startAt, maxResults) => {
      return await jiraAgileFetch(
        `/board?projectKeyOrId=${projectKey}&startAt=${startAt}&maxResults=${maxResults}`
      )
    }, 50)

    console.log(
      `Found ${allBoards.length} total boards for project ${projectKey}`
    )

    if (allBoards.length === 0) {
      console.log(`No boards found for project ${projectKey}`)
      return []
    }

    // Step 2: Prioritize scrum boards, but use any board if needed
    const scrumBoards = allBoards.filter((board: any) => board.type === 'scrum')
    const boardToUse = scrumBoards.length > 0 ? scrumBoards[0] : allBoards[0]

    console.log(
      `Using board: ${boardToUse.name} (ID: ${boardToUse.id}, Type: ${boardToUse.type})`
    )

    // Step 3: Get ALL sprints for this board with pagination
    console.log(`Fetching ALL sprints from board ${boardToUse.id}`)

    const allSprints = await fetchAllPaginated(async (startAt, maxResults) => {
      return await jiraAgileFetch(
        `/board/${boardToUse.id}/sprint?startAt=${startAt}&maxResults=${maxResults}`
      )
    }, 50)

    const sprints = allSprints.map((sprint: any) => ({
      id: sprint.id.toString(),
      name: sprint.name,
      state: sprint.state
    }))

    console.log(
      `Successfully fetched ALL ${sprints.length} sprints for project ${projectKey}`
    )

    // Log sprint breakdown by state
    const sprintsByState = sprints.reduce((acc: any, sprint) => {
      acc[sprint.state] = (acc[sprint.state] || 0) + 1
      return acc
    }, {})

    return sprints
  } catch (error) {
    console.error('Error fetching project sprints:', error)

    // Fallback: Try to get sprints via JQL search with pagination
    try {
      console.log(
        'Attempting fallback JQL-based sprint search for ALL sprints...'
      )

      const allIssues = await fetchAllPaginated(async (startAt, maxResults) => {
        const jql = `project = ${projectKey} AND sprint is not EMPTY`
        const data = await jiraFetch(
          `/search/jql?jql=${encodeURIComponent(jql)}&startAt=${startAt}&maxResults=${maxResults}&fields=customfield_10020`
        )
        return data || { values: [], total: 0 }
      }, 100)

      if (allIssues.length > 0) {
        const sprintSet = new Set<string>()
        const sprintMap = new Map<
          string,
          { id: string; name: string; state: string }
        >()

        allIssues.forEach((issue: any) => {
          const sprintField = issue.fields?.customfield_10020
          if (sprintField && Array.isArray(sprintField)) {
            sprintField.forEach((sprint: any) => {
              if (sprint && sprint.id && sprint.name) {
                const sprintKey = `${sprint.id}-${sprint.name}`
                if (!sprintSet.has(sprintKey)) {
                  sprintSet.add(sprintKey)
                  sprintMap.set(sprintKey, {
                    id: sprint.id.toString(),
                    name: sprint.name,
                    state: sprint.state || 'unknown'
                  })
                }
              }
            })
          }
        })

        const sprints = Array.from(sprintMap.values())
        console.log(`Fallback JQL search found ALL ${sprints.length} sprints`)
        return sprints
      }
    } catch (fallbackError) {
      console.error('Fallback JQL search also failed:', fallbackError)
    }

    return []
  }
}

export async function getIssueTransitions(
  issueKey: string
): Promise<Array<{ id: string; name: string }>> {
  try {
    const data = await jiraFetch(`/issue/${issueKey}/transitions`)
    if (!data || !data.transitions) return []

    return data.transitions.map((transition: any) => ({
      id: transition.id,
      name: transition.to.name
    }))
  } catch (error) {
    console.error('Error fetching issue transitions:', error)
    return []
  }
}

export async function updateIssueStatus(
  issueKey: string,
  transitionId: string
): Promise<boolean> {
  try {
    await jiraFetch(`/issue/${issueKey}/transitions`, {
      method: 'POST',
      body: JSON.stringify({
        transition: {
          id: transitionId
        }
      })
    })
    // If no error was thrown, the update was successful
    return true
  } catch (error) {
    console.error('Error updating issue status:', error)
    return false
  }
}

export async function updateIssueAssignee(
  issueKey: string,
  accountId: string | null
): Promise<boolean> {
  try {
    await jiraFetch(`/issue/${issueKey}/assignee`, {
      method: 'PUT',
      body: JSON.stringify({
        accountId: accountId
      })
    })
    // If no error was thrown, the update was successful
    return true
  } catch (error) {
    console.error('Error updating issue assignee:', error)
    return false
  }
}

export async function getIssueDetails(issueKey: string) {
  try {
    // Attachments (fetch via fields)
    const issueData = await jiraFetch(`/issue/${issueKey}?fields=attachment`)
    const attachments = (issueData?.fields?.attachment || []).map(
      (att: any) => {
        const mime: string | undefined = att.mimeType
        const filename: string = att.filename
        const isImage =
          mime?.startsWith('image/') ||
          /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(filename)
        return {
          id: String(att.id),
          filename: filename,
          size: Number(att.size) || 0,
          mimeType: mime,
          isImage
        }
      }
    )

    // Comments (paginate up to 100 for now)
    const commentsData = await jiraFetch(
      `/issue/${issueKey}/comment?orderBy=created&maxResults=100`
    )
    console.log('commentsData: ', commentsData)
    const comments = (commentsData?.comments || [])
      .map((c: any) => ({
        id: String(c.id),
        author: {
          displayName: c.author?.displayName,
          avatarUrls: c.author?.avatarUrls
        },
        created: c.created,
        body: typeof c.body === 'string' ? c.body : extractTextFromADF(c.body),
        bodyHtml:
          typeof c.body === 'string'
            ? adfToHtml(c.body, issueData?.fields?.attachment, issueKey)
            : adfToHtml(c.body, issueData?.fields?.attachment, issueKey)
      }))
      .sort((a: any, b: any) => {
        const ta = new Date(a.created).getTime()
        const tb = new Date(b.created).getTime()
        if (isNaN(ta) || isNaN(tb)) return 0
        return tb - ta // newest first
      })

    // Changelog (paginate up to 100)
    const changelogData = await jiraFetch(
      `/issue/${issueKey}/changelog?maxResults=100`
    )
    const changelog = (changelogData?.values || []).map((h: any) => ({
      id: String(h.id),
      author: { displayName: h.author?.displayName },
      created: h.created,
      items: (h.items || []).map((it: any) => ({
        field: it.field,
        fromString: it.fromString,
        toString: it.toString
      }))
    }))

    return { attachments, comments, changelog }
  } catch (error) {
    console.error('Error fetching issue details:', error)
    return { attachments: [], comments: [], changelog: [] }
  }
}

// Helper to build Atlassian Document Format (ADF) from plain text, preserving newlines
function buildADFBodyFromText(text: string) {
  // Normalize line endings
  const normalized = (text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  // Split by double newlines to create paragraphs
  const paragraphs = normalized.split(/\n\n+/)

  // Helper: split a plain text segment into ADF nodes, recognizing mention tokens
  // Token format: @[Display Name|accountId]
  const tokenize = (segment: string) => {
    const nodes: any[] = []
    if (!segment) return nodes
    const mentionRe = /@\[([^|\]]+?)\|([^\]]+?)\]/g
    let lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = mentionRe.exec(segment))) {
      const before = segment.slice(lastIndex, m.index)
      if (before) nodes.push({ type: 'text', text: before })
      const display = m[1]
      const accountId = m[2]
      nodes.push({
        type: 'mention',
        attrs: { id: accountId, text: `@${display}` }
      })
      lastIndex = m.index + m[0].length
    }
    const tail = segment.slice(lastIndex)
    if (tail) nodes.push({ type: 'text', text: tail })
    if (nodes.length === 0) nodes.push({ type: 'text', text: '' })
    return nodes
  }

  const content = paragraphs.map((para) => {
    // Within a paragraph, single newlines become hardBreak nodes
    const lines = para.split('\n')
    const paragraphContent: any[] = []
    lines.forEach((line, idx) => {
      if (line.length) {
        // Split into text and mention nodes
        paragraphContent.push(...tokenize(line))
      } else {
        // keep empty text to preserve empty lines within paragraph
        paragraphContent.push({ type: 'text', text: '' })
      }
      if (idx < lines.length - 1) {
        paragraphContent.push({ type: 'hardBreak' })
      }
    })
    // If paragraph is empty, keep an empty text node so Jira shows a blank line
    if (paragraphContent.length === 0)
      paragraphContent.push({ type: 'text', text: '' })
    return { type: 'paragraph', content: paragraphContent }
  })

  return {
    body: {
      type: 'doc',
      version: 1,
      content
    }
  }
}

export async function createIssueComment(issueKey: string, text: string) {
  const body = buildADFBodyFromText(text)

  try {
    const res = await jiraFetch(`/issue/${issueKey}/comment`, {
      method: 'POST',
      body: JSON.stringify(body)
    })
    return res
  } catch (error) {
    console.error('Error creating comment:', error)
    throw error
  }
}

export async function updateIssueComment(
  issueKey: string,
  commentId: string,
  text: string
) {
  const body = buildADFBodyFromText(text)

  try {
    const res = await jiraFetch(`/issue/${issueKey}/comment/${commentId}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    })
    return res
  } catch (error) {
    console.error('Error updating comment:', error)
    throw error
  }
}

export async function deleteIssueComment(issueKey: string, commentId: string) {
  try {
    await jiraFetch(`/issue/${issueKey}/comment/${commentId}`, {
      method: 'DELETE'
    })
    return true
  } catch (error) {
    console.error('Error deleting comment:', error)
    throw error
  }
}

export async function getIssues(
  projectKey: string,
  filters?: FilterOptions
): Promise<JiraIssue[]> {
  try {
    let jql = `project = ${projectKey}`

    // Sprint filter is now required - if no sprints specified, return empty
    if (!filters?.sprint?.length) {
      console.log('No sprints specified, returning empty result set')
      return []
    }

    // Add sprint filter (this is now required)
    jql += ` AND sprint IN (${filters.sprint.map((s) => `"${s}"`).join(',')})`

    if (filters?.status?.length) {
      jql += ` AND status IN (${filters.status.map((s) => `"${s}"`).join(',')})`
    }

    if (filters?.priority?.length) {
      jql += ` AND priority IN (${filters.priority.map((p) => `"${p}"`).join(',')})`
    }

    if (filters?.assignee?.length) {
      const assigneeConditions: string[] = []

      filters.assignee.forEach((assignee) => {
        if (assignee === 'UNASSIGNED') {
          assigneeConditions.push('assignee is EMPTY')
        } else {
          assigneeConditions.push(`assignee = "${assignee}"`)
        }
      })

      if (assigneeConditions.length > 0) {
        jql += ` AND (${assigneeConditions.join(' OR ')})`
      }
    }

    if (filters?.issueType?.length) {
      jql += ` AND issuetype IN (${filters.issueType.map((t) => `"${t}"`).join(',')})`
    }

    if (filters?.dueDateFrom) {
      jql += ` AND duedate >= "${filters.dueDateFrom}"`
    }

    if (filters?.dueDateTo) {
      jql += ` AND duedate <= "${filters.dueDateTo}"`
    }

    if (filters?.labels?.length) {
      jql += ` AND labels IN (${filters.labels.map((l) => `"${l}"`).join(',')})`
    }

    if (filters?.components?.length) {
      jql += ` AND component IN (${filters.components.map((c) => `"${c}"`).join(',')})`
    }

    if (filters?.release?.length) {
      const releaseConditions: string[] = []

      filters.release.forEach((release) => {
        if (
          release === 'NO_RELEASE' ||
          release.toLowerCase() === 'no release'
        ) {
          releaseConditions.push('fixVersion is EMPTY')
        } else {
          releaseConditions.push(`fixVersion = "${release}"`)
        }
      })

      if (releaseConditions.length > 0) {
        jql += ` AND (${releaseConditions.join(' OR ')})`
      }
    }

    console.log(`Fetching ALL issues for JQL: ${jql}`)

    // Fetch ALL issues with direct pagination (not using fetchAllPaginated)
    // because Jira search API has a different response structure
    const allIssues: any[] = []
    let startAt = 0
    const maxResults = 100
    let total = 0

    do {
      console.log(
        `Fetching issues batch: startAt=${startAt}, maxResults=${maxResults}`
      )

      const data = await jiraFetch(
        `/search/jql?jql=${encodeURIComponent(jql)}&startAt=${startAt}&maxResults=${maxResults}&fields=*all`
      )

      if (!data || !data.issues) {
        console.log('No data or issues returned, breaking pagination loop')
        break
      }

      console.log(`Received ${data.issues.length} issues in this batch`)
      console.log(`Total available: ${data.total}`)

      allIssues.push(...data.issues)
      total = data.total
      startAt += data.issues.length

      console.log(
        `Fetched ${data.issues.length} issues. Total so far: ${allIssues.length}/${total}`
      )

      // Break if we got fewer results than requested (last page)
      if (data.issues.length < maxResults) {
        console.log(
          'Received fewer issues than requested, this was the last page'
        )
        break
      }

      // Safety check to prevent infinite loops
      if (allIssues.length > 10000) {
        console.warn(
          'Reached safety limit of 10,000 issues. Stopping pagination.'
        )
        break
      }
    } while (allIssues.length < total && startAt < total)

    console.log(
      `Completed fetching ALL ${allIssues.length} issues for selected sprint(s)`
    )

    return allIssues.map((issue: any) => ({
      id: issue.id,
      key: issue.key,
      summary: issue.fields.summary,
      description: extractTextFromADF(issue.fields.description),
      descriptionHtml: adfToHtml(
        issue.fields.description,
        issue.fields.attachment,
        issue.key
      ),
      status: issue.fields.status,
      priority: issue.fields.priority,
      assignee: issue.fields.assignee,
      reporter: issue.fields.reporter,
      issuetype: issue.fields.issuetype,
      created: issue.fields.created,
      updated: issue.fields.updated,
      duedate: issue.fields.duedate,
      labels: issue.fields.labels || [],
      components: issue.fields.components || [],
      sprint: issue.fields.customfield_10020
        ? {
            id: issue.fields.customfield_10020[0]?.id,
            name: issue.fields.customfield_10020[0]?.name,
            state: issue.fields.customfield_10020[0]?.state
          }
        : undefined,
      fixVersions: (issue.fields.fixVersions || []).map((v: any) => ({
        id: String(v.id),
        name: v.name,
        released: Boolean(v.released),
        archived: Boolean(v.archived)
      }))
    }))
  } catch (error) {
    console.error('Error fetching issues:', error)
    return []
  }
}

// Streaming fetch for Jira attachments/content
export async function jiraFetchStream(endpoint: string, options?: RequestInit) {
  const { base, headers } = await getAuthAndBase()
  let response = await fetch(`${base}/rest/api/3${endpoint}`, {
    headers: {
      ...headers,
      // Do not force content-type for binary streams
      // Accept anything so Jira returns original content
      Accept: headers['Accept'] || '*/*'
    } as any,
    ...options
  })

  if ((response as any).status === 401 && basicAuth) {
    try {
      response = await fetch(`${JIRA_BASE_URL}/rest/api/3${endpoint}`, {
        headers: {
          Authorization: `Basic ${basicAuth}`,
          Accept: '*/*'
        },
        ...options
      })
    } catch (e) {
      // network error; handled by caller
    }
  }

  return response
}

export async function getProjectVersions(
  projectKey: string
): Promise<
  Array<{ id: string; name: string; released: boolean; archived?: boolean }>
> {
  try {
    const data = await jiraFetch(`/project/${projectKey}/versions`)
    const list = Array.isArray(data)
      ? data
      : Array.isArray((data as any)?.values)
        ? (data as any).values
        : []
    return list.map((v: any) => ({
      id: String(v.id),
      name: v.name,
      released: Boolean(v.released),
      archived: Boolean(v.archived)
    }))
  } catch (error) {
    console.error('Error fetching project versions:', error)
    return []
  }
}

export async function updateIssueFixVersions(
  issueKey: string,
  versionIds: string[]
): Promise<boolean> {
  try {
    await jiraFetch(`/issue/${issueKey}`, {
      method: 'PUT',
      body: JSON.stringify({
        fields: {
          fixVersions: (versionIds || []).map((id) => ({ id: String(id) }))
        }
      })
    })
    return true
  } catch (error) {
    console.error('Error updating issue fix versions:', error)
    return false
  }
}

export async function getIssue(issueKey: string): Promise<JiraIssue | null> {
  try {
    const data = await jiraFetch(`/issue/${issueKey}?fields=*all`)
    if (!data) return null
    const issue = data
    return {
      id: issue.id,
      key: issue.key,
      summary: issue.fields.summary,
      description: extractTextFromADF(issue.fields.description),
      descriptionHtml: adfToHtml(
        issue.fields.description,
        issue.fields.attachment,
        issue.key
      ),
      status: issue.fields.status,
      priority: issue.fields.priority,
      assignee: issue.fields.assignee || undefined,
      reporter: issue.fields.reporter,
      issuetype: issue.fields.issuetype,
      created: issue.fields.created,
      updated: issue.fields.updated,
      duedate: issue.fields.duedate || undefined,
      labels: issue.fields.labels || [],
      components: issue.fields.components || [],
      sprint: issue.fields.customfield_10020
        ? {
            id: issue.fields.customfield_10020[0]?.id,
            name: issue.fields.customfield_10020[0]?.name,
            state: issue.fields.customfield_10020[0]?.state
          }
        : undefined,
      fixVersions: (issue.fields.fixVersions || []).map((v: any) => ({
        id: String(v.id),
        name: v.name,
        released: Boolean(v.released),
        archived: Boolean(v.archived)
      }))
    }
  } catch (error) {
    console.error('Error fetching issue:', error)
    return null
  }
}
