import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function normalizeStatusName(status: string): string {
  // Convert status names to a more readable format
  const statusMap: Record<string, string> = {
    // To Do group
    "to do": "To Do",
    todo: "To Do",
    open: "To Do",
    new: "To Do",
    backlog: "To Do",

    // Attention Needed group
    "attention needed": "Attention Needed",

    // Blocked group
    blocked: "Blocked",
    blocking: "Blocked",
    impediment: "Blocked",
    stuck: "Blocked",

    // In Progress group
    "in progress": "In Progress",
    inprogress: "In Progress",

    // Current Active Issue group
    "current active issue": "Current Active Issue",

    // In PR group
    "in pr": "In PR",
    "pull request": "In PR",
    "pr submitted": "In PR",
    "pr review": "In PR",
    "pull request review": "In PR",

    // In Review group
    "in review": "In Review",
    "code review": "In Review",
    review: "In Review",

    // Awaiting Testing group
    "awaiting testing": "Awaiting Testing",
    "waiting for test": "Awaiting Testing",
    "ready for testing": "Awaiting Testing",
    "pending test": "Awaiting Testing",

    // Iteration Required group
    "iteration required": "Iteration Required",
    "needs iteration": "Iteration Required",
    "requires iteration": "Iteration Required",
    "iteration needed": "Iteration Required",

    // Awaiting Information group
    "awaiting information": "Awaiting Information",
    "waiting for info": "Awaiting Information",
    "needs information": "Awaiting Information",
    "pending information": "Awaiting Information",
    "awaiting info": "Awaiting Information",

    // Under Monitoring group
    "under monitoring": "Under Monitoring",
    monitoring: "Under Monitoring",
    "being monitored": "Under Monitoring",

    // Not an Issue group
    "not an issue": "Not an Issue",
    invalid: "Not an Issue",
    "not a bug": "Not an Issue",
    "won't fix": "Not an Issue",
    "wont fix": "Not an Issue",

    // Requires a Config Change group
    "requires a config change": "Requires Config Change",
    "requires config change": "Requires Config Change",
    "config change": "Requires Config Change",
    "configuration change": "Requires Config Change",
    "needs config": "Requires Config Change",

    // Done group
    done: "Done",
    closed: "Done",
    resolved: "Done",
    complete: "Done",
    completed: "Done",
  }

  const normalized = statusMap[status.toLowerCase()]
  return normalized || status
}

export function getStatusColor(status: string): string {
  const normalizedStatus = normalizeStatusName(status).toLowerCase()

  switch (normalizedStatus) {
    case "to do":
      return "bg-blue-100 text-blue-800 border-blue-200"
    case "attention needed":
      return "bg-red-100 text-red-800 border-red-200"
    case "blocked":
      return "bg-rose-100 text-rose-800 border-rose-200"
    case "in progress":
      return "bg-yellow-100 text-yellow-800 border-yellow-200"
    case "current active issue":
      return "bg-purple-100 text-purple-800 border-purple-200"
    case "in pr":
      return "bg-violet-100 text-violet-800 border-violet-200"
    case "in review":
      return "bg-orange-100 text-orange-800 border-orange-200"
    case "awaiting testing":
      return "bg-indigo-100 text-indigo-800 border-indigo-200"
    case "iteration required":
      return "bg-pink-100 text-pink-800 border-pink-200"
    case "awaiting information":
      return "bg-cyan-100 text-cyan-800 border-cyan-200"
    case "under monitoring":
      return "bg-teal-100 text-teal-800 border-teal-200"
    case "not an issue":
      return "bg-gray-100 text-gray-800 border-gray-200"
    case "requires config change":
      return "bg-amber-100 text-amber-800 border-amber-200"
    case "done":
      return "bg-green-100 text-green-800 border-green-200"
    default:
      return "bg-gray-100 text-gray-800 border-gray-200"
  }
}
