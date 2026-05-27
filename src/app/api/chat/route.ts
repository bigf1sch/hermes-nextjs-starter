import { NextRequest } from "next/server";
import { fetchGitHubStats, GitHubStats } from "@/lib/github";

// ── types ──

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
}

// ── DeepSeek client ──

const DEEPSEEK_BASE = "https://api.deepseek.com/v1";

interface DeepSeekDelta {
  role?: string;
  content?: string;
}

interface DeepSeekChoice {
  index: number;
  delta: DeepSeekDelta;
  finish_reason: string | null;
}

interface DeepSeekChunk {
  choices: DeepSeekChoice[];
}

// ── Vercel data fetching (inline to avoid circular deps) ──

interface VercelDeployment {
  uid: string;
  url: string;
  alias?: string[];
  state: string;
  readyState?: string;
  created: number;
  creator?: { username: string };
  meta?: Record<string, string>;
  errorMessage?: string;
}

interface VercelSnapshot {
  project: string;
  recentDeployments: {
    url: string;
    state: string;
    created: string;
    branch: string | null;
    error: string | null;
  }[];
  summary: {
    total: number;
    ready: number;
    error: number;
    building: number;
  };
}

async function fetchVercelSnapshot(): Promise<VercelSnapshot | null> {
  const token = process.env.VERCEL_API_KEY;
  const projectId = process.env.VERCEL_PROJECT_ID || "prj_e4Tan0hKlqy0P4eH4mLbWx8bX08Y";
  if (!token) return null;

  try {
    const res = await fetch(
      `https://api.vercel.com/v6/deployments?projectId=${projectId}&limit=10`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );
    if (!res.ok) return null;

    const data = await res.json();
    const deployments: VercelDeployment[] = data.deployments || [];

    const recent = deployments.slice(0, 6).map((d) => ({
      url: d.alias?.[0] || `https://${d.url}`,
      state: d.readyState === "ERROR" ? "ERROR" : d.state,
      created: new Date(d.created).toISOString(),
      branch: d.meta?.githubCommitRef || null,
      error: d.errorMessage || null,
    }));

    const summary = {
      total: deployments.length,
      ready: recent.filter((d) => d.state === "READY").length,
      error: recent.filter((d) => d.state === "ERROR").length,
      building: recent.filter((d) => d.state === "BUILDING").length,
    };

    return { project: data.project?.name || "unknown", recentDeployments: recent, summary };
  } catch {
    return null;
  }
}

// ── Context builder ──

function buildSystemPrompt(gh: GitHubStats | null, vc: VercelSnapshot | null): string {
  const parts: string[] = [
    "You are a helpful AI assistant embedded in a Mission Control dashboard for the bigf1sch GitHub account.",
    "You have live access to the user's GitHub statistics and Vercel deployment status.",
    "Answer questions concisely and directly. When asked about repos, deployments, or activity, use the live data below.",
    "If you don't have the data to answer a question, say so honestly.",
    "",
  ];

  if (gh) {
    parts.push("## GitHub Live Data");
    parts.push(`- User: ${gh.user.name || gh.user.login} (@${gh.user.login})`);
    parts.push(`- Public repos: ${gh.user.publicRepos}, Followers: ${gh.user.followers}, Following: ${gh.user.following}`);
    parts.push(`- Totals: ${gh.totals.repos} repos, ${gh.totals.stars} stars, ${gh.totals.forks} forks, ${gh.totals.totalCommits} commits, ${gh.totals.openIssues} open issues`);
    parts.push("");
    parts.push("### Top Repositories");
    for (const r of gh.repos.slice(0, 8)) {
      parts.push(`- **${r.fullName}** (${r.language || "unknown"}): ${r.stars}★ ${r.forks} forks, ${r.commits} commits — ${r.description || "no description"}`);
    }
    if (gh.recentPRs.length > 0) {
      parts.push("");
      parts.push("### Recent Pull Requests");
      for (const pr of gh.recentPRs.slice(0, 5)) {
        parts.push(`- ${pr.state.toUpperCase()}: ${pr.title} (${pr.repo})`);
      }
    }
    parts.push("");
  }

  if (vc) {
    parts.push("## Vercel Live Data");
    parts.push(`- Project: ${vc.project}`);
    parts.push(`- Status: ${vc.summary.ready} ready, ${vc.summary.error} errors, ${vc.summary.building} building`);
    parts.push("");
    parts.push("### Recent Deployments");
    for (const d of vc.recentDeployments.slice(0, 6)) {
      const branchStr = d.branch ? ` [${d.branch.slice(0, 7)}]` : "";
      const errStr = d.error ? ` — ERROR: ${d.error}` : "";
      parts.push(`- ${d.state}${branchStr}: ${d.url} (${d.created})${errStr}`);
    }
    parts.push("");
  }

  parts.push("Use this data to answer questions. Keep responses brief and scannable — this is a dashboard tool.");
  return parts.join("\n");
}

// ── route handler ──

export async function POST(request: NextRequest) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "DEEPSEEK_API_KEY not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: ChatRequest;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    return new Response(
      JSON.stringify({ error: "messages array is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // ── Fetch live context (parallel) ──
  const [gh, vc] = await Promise.all([
    process.env.GITHUB_TOKEN
      ? fetchGitHubStats("bigf1sch").catch(() => null)
      : Promise.resolve(null),
    fetchVercelSnapshot(),
  ]);

  const systemPrompt = buildSystemPrompt(gh, vc);

  const deepseekMessages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...body.messages.filter((m) => m.role !== "system"),
  ];

  // ── Stream from DeepSeek ──
  try {
    const dsRes = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: deepseekMessages,
        stream: true,
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!dsRes.ok) {
      const errText = await dsRes.text();
      return new Response(
        JSON.stringify({ error: `DeepSeek API error: ${dsRes.status}`, detail: errText.slice(0, 500) }),
        { status: dsRes.status, headers: { "Content-Type": "application/json" } }
      );
    }

    // Stream back to client as SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = dsRes.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith("data: ")) continue;
              const data = trimmed.slice(6);
              if (data === "[DONE]") {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                continue;
              }

              try {
                const chunk: DeepSeekChunk = JSON.parse(data);
                const delta = chunk.choices?.[0]?.delta;
                if (delta?.content) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ content: delta.content })}\n\n`)
                  );
                }
              } catch {
                // skip unparseable chunks
              }
            }
          }
        } catch (e) {
          console.error("Stream error:", e);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Failed to reach DeepSeek API", detail: message }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}
