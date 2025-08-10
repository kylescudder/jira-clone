import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/jira-api";

export async function GET() {
  try {
    const user = await getCurrentUser();
    return NextResponse.json(user);
  } catch (error) {
    console.error("API Error fetching current user:", error);
    return NextResponse.json(
      { error: "Failed to fetch current user" },
      { status: 500 },
    );
  }
}
