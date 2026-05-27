import { NextResponse } from "next/server";

const VERCEL_API = "https://api.vercel.com";

interface VercelDeployment {
  uid: string;
  name: string;
  url: string;
  alias: string[];
  state: string;
  readyState?: string;
  readySubstate?: string;
  created: number;
  buildingAt?: number;
  ready?: number;
  creator?: { uid: string; username: string };
  meta?: Record<string, string>;
  inspectorUrl?: string;
  errorCode?: string;
  errorMessage?: string;
  errorLink?: string;
  aliasError?: string | null;
  build?: { error?: Record<string, unknown> };
}

interface VercelEvent {
  type: string;
  created: number;
  text?: string;
  payload?: Record<string, unknown>;
}

function buildDuration(deployment: VercelDeployment): number | null {
  if (deployment.buildingAt && deployment.ready) {
    return Math.round((deployment.ready - deployment.buildingAt) / 1000);
  }
  return null;
}

function stateLabel(d: VercelDeployment): string {
  if (d.state === "READY") return d.readyState === "ERROR" ? "ERROR" : "READY";
  return d.state;
}

export async function GET() {
  const token = process.env.VERCEL_API_KEY;
  const projectId = process.env.VERCEL_PROJECT_ID || "prj_e4Tan0hKlqy0P4eH4mLbWx8bX08Y";

  if (!token) {
    return NextResponse.json(
      { error: "VERCEL_API_KEY not configured" },
      { status: 500 }
    );
  }

  const headers = { Authorization: `Bearer ${token}` };

  try {
    // Fetch deployments
    const depRes = await fetch(
      `${VERCEL_API}/v6/deployments?projectId=${projectId}&limit=10`,
      { headers, cache: "no-store" }
    );

    if (!depRes.ok) {
      const err = await depRes.text();
      return NextResponse.json(
        { error: `Vercel API error: ${depRes.status}`, detail: err },
        { status: depRes.status }
      );
    }

    const depData = await depRes.json();
    const deployments: VercelDeployment[] = depData.deployments || [];

    // Fetch events for the 3 most recent deployments (for error details)
    const eventPromises = deployments.slice(0, 3).map(async (d) => {
      try {
        const evRes = await fetch(
          `${VERCEL_API}/v2/deployments/${d.uid}/events?limit=20&direction=backward`,
          { headers, cache: "no-store" }
        );
        if (!evRes.ok) return { uid: d.uid, events: [] };
        const evData = await evRes.json();
        return { uid: d.uid, events: (evData || []) as VercelEvent[] };
      } catch {
        return { uid: d.uid, events: [] };
      }
    });

    const eventResults = await Promise.all(eventPromises);
    const eventMap = Object.fromEntries(
      eventResults.map((r) => [r.uid, r.events])
    );

    // Build response
    const entries = deployments.map((d) => {
      const events = eventMap[d.uid] || [];
      const errors = events
        .filter((e: VercelEvent) => e.type?.includes("error") || e.type === "stderr")
        .slice(0, 5);

      return {
        uid: d.uid,
        url: d.alias?.[0] || `https://${d.url}`,
        state: stateLabel(d),
        rawState: d.state,
        readySubstate: d.readySubstate || null,
        created: d.created,
        creator: d.creator?.username || "unknown",
        commitRef: d.meta?.githubCommitRef || null,
        branch: d.meta?.githubCommitRef || d.meta?.githubCommitRef || null,
        buildDurationSec: buildDuration(d),
        inspectorUrl: d.inspectorUrl || null,
        errorCode: d.errorCode || null,
        errorMessage: d.errorMessage || null,
        aliasError: d.aliasError || null,
        recentErrors: errors
          .filter((e: VercelEvent) => {
            // Only include real errors, not normal stderr build output
            const isErrorType = e.type?.includes("error") || e.type === "stderr";
            if (!isErrorType) return false;
            const raw = e.text || (e.payload && typeof e.payload === "object" && "text" in e.payload ? String((e.payload as Record<string, unknown>).text) : JSON.stringify(e.payload || {}));
            // Skip normal build output (Completed, Installing, etc.)
            const skipPatterns = ["Build Completed", "Running build", "Installing", "Collecting", "Generating", "Finalizing", "Build Completed"];
            return !skipPatterns.some((p) => raw.startsWith(p));
          })
          .map((e: VercelEvent) => {
            const raw = e.text || (e.payload && typeof e.payload === "object" && "text" in e.payload ? String((e.payload as Record<string, unknown>).text) : JSON.stringify(e.payload || {}));
            return {
              type: e.type,
              text: raw.slice(0, 200),
              created: e.created,
            };
          }),
      };
    });

    // Compute aggregate metrics
    const states = deployments.map((d) => stateLabel(d));
    const metrics = {
      totalDeployments: deployments.length,
      ready: states.filter((s) => s === "READY").length,
      error: states.filter((s) => s === "ERROR").length,
      building: states.filter((s) => s === "BUILDING").length,
      canceled: states.filter((s) => s === "CANCELED").length,
      queued: states.filter((s) => s === "QUEUED" || s === "INITIALIZING").length,
      avgBuildSec: deployments
        .filter((d) => d.state === "READY" || d.readyState === "READY")
        .map(buildDuration)
        .filter((v): v is number => v !== null && v > 0)
        .reduce((a, b, _, arr) => (a * (arr.length - 1) + b) / arr.length, 0) || null,
    };

    return NextResponse.json({
      project: { id: projectId, name: depData.project?.name || "unknown" },
      metrics,
      deployments: entries,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch Vercel data", detail: String(err) },
      { status: 500 }
    );
  }
}
