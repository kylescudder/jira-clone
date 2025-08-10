import { NextResponse } from "next/server"

const JIRA_BASE_URL = process.env.JIRA_BASE_URL || "https://your-domain.atlassian.net"
const JIRA_EMAIL = process.env.JIRA_EMAIL || ""
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || ""

const auth = btoa(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`)

async function jiraAgileFetch(endpoint: string) {
  const response = await fetch(`${JIRA_BASE_URL}/rest/agile/1.0${endpoint}`, {
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  })

  if (!response.ok) {
    throw new Error(`Jira Agile API error: ${response.status} ${response.statusText}`)
  }

  return await response.json()
}

// Helper function to fetch all paginated results
async function fetchAllPaginated(
  fetchFunction: (startAt: number, maxResults: number) => Promise<any>,
  maxResults = 50,
): Promise<any[]> {
  const allResults: any[] = []
  let startAt = 0
  let hasMore = true

  while (hasMore) {
    try {
      const data = await fetchFunction(startAt, maxResults)

      if (!data || !data.values || data.values.length === 0) {
        break
      }

      allResults.push(...data.values)
      startAt += data.values.length

      // Check if we have more results
      hasMore = data.values.length === maxResults

      console.log(`Fetched ${data.values.length} boards. Total so far: ${allResults.length}`)

      // Safety check to prevent infinite loops
      if (allResults.length > 1000) {
        console.warn("Reached safety limit of 1,000 boards. Stopping pagination.")
        break
      }
    } catch (error) {
      console.error("Error in board pagination:", error)
      break
    }
  }

  return allResults
}

export async function GET(request: Request, { params }: { params: { projectKey: string } }) {
  try {
    console.log(`Fetching ALL boards for project: ${params.projectKey}`)

    // Get ALL boards for the project with pagination
    const allBoards = await fetchAllPaginated(async (startAt, maxResults) => {
      return await jiraAgileFetch(
        `/board?projectKeyOrId=${params.projectKey}&startAt=${startAt}&maxResults=${maxResults}`,
      )
    }, 50)

    const boards = allBoards.map((board: any) => ({
      id: board.id,
      name: board.name,
      type: board.type,
      location: board.location,
    }))

    console.log(`Found ALL ${boards.length} boards for project ${params.projectKey}`)

    return NextResponse.json(boards)
  } catch (error) {
    console.error("API Error fetching project boards:", error)
    return NextResponse.json({ error: "Failed to fetch project boards" }, { status: 500 })
  }
}
