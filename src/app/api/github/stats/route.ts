import { NextRequest, NextResponse } from "next/server";
import { fetchGitHubStats } from "@/lib/github";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username") || "bigf1sch";

  if (!process.env.GITHUB_TOKEN) {
    return NextResponse.json(
      { error: "GITHUB_TOKEN not configured on server" },
      { status: 500 }
    );
  }

  try {
    const stats = await fetchGitHubStats(username);
    return NextResponse.json(stats, {
      headers: {
        // Cache at the edge for 4 minutes (just under our 5-min in-memory TTL)
        "Cache-Control": "public, s-maxage=240, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("GitHub stats fetch failed:", message);

    if (message.includes("Bad credentials") || message.includes("401")) {
      return NextResponse.json(
        { error: "Invalid GitHub token" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch GitHub stats", detail: message },
      { status: 500 }
    );
  }
}
