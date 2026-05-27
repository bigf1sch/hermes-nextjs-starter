"use client";

import { useEffect, useState, useCallback } from "react";

interface DeploymentEntry {
  uid: string;
  url: string;
  state: string;
  rawState: string;
  readySubstate: string | null;
  created: number;
  creator: string;
  commitRef: string | null;
  branch: string | null;
  buildDurationSec: number | null;
  inspectorUrl: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  aliasError: string | null;
  recentErrors: { type: string; text: string; created: number }[];
}

interface VercelData {
  project: { id: string; name: string };
  metrics: {
    totalDeployments: number;
    ready: number;
    error: number;
    building: number;
    canceled: number;
    queued: number;
    avgBuildSec: number | null;
  };
  deployments: DeploymentEntry[];
  fetchedAt: string;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function stateBadge(state: string) {
  switch (state) {
    case "READY":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
    case "ERROR":
      return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
    case "BUILDING":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
    case "CANCELED":
      return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
    case "QUEUED":
    case "INITIALIZING":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
    default:
      return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
  }
}

function formatDuration(sec: number | null): string {
  if (sec === null || isNaN(sec)) return "—";
  const s = Math.round(sec);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return rs > 0 ? `${m}m ${rs}s` : `${m}m`;
}

export default function VercelDeployMonitor() {
  const [data, setData] = useState<VercelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<number>(0);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/vercel-deployments");
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        setError(err.error || `HTTP ${res.status}`);
        return;
      }
      const json: VercelData = await res.json();
      setData(json);
      setError(null);
      setLastFetch(Date.now());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + auto-refresh every 30s
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="w-full rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-3 text-zinc-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-emerald-500" />
          <span className="text-sm">Loading Vercel deployments…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950">
        <p className="text-sm font-medium text-red-700 dark:text-red-400">
          Vercel API Error: {error}
        </p>
        <button
          onClick={fetchData}
          className="mt-2 text-xs text-red-600 underline hover:no-underline dark:text-red-400"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { metrics, deployments } = data;

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Vercel Deployments
        </h2>
        <span className="text-xs text-zinc-400">
          auto-refreshes · updated {lastFetch ? timeAgo(lastFetch) : "—"}
        </span>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricCard label="Ready" value={metrics.ready} color="emerald" />
        <MetricCard label="Errors" value={metrics.error} color="red" />
        <MetricCard label="Building" value={metrics.building} color="blue" />
        <MetricCard label="Avg Build" value={formatDuration(metrics.avgBuildSec)} color="zinc" />
      </div>

      {/* Deployment list */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
              <th className="px-4 py-2.5">Deployment</th>
              <th className="hidden px-4 py-2.5 sm:table-cell">State</th>
              <th className="hidden px-4 py-2.5 md:table-cell">Build</th>
              <th className="hidden px-4 py-2.5 lg:table-cell">Created</th>
              <th className="px-4 py-2.5 text-right">URL</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {deployments.map((d) => (
              <tr
                key={d.uid}
                className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
              >
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="font-mono text-xs text-zinc-500">
                      {d.uid.slice(0, 10)}…
                    </span>
                    {d.commitRef && (
                      <span className="text-xs text-zinc-400">
                        {d.commitRef.slice(0, 7)}
                      </span>
                    )}
                    {d.errorMessage && (
                      <span className="mt-0.5 max-w-[180px] truncate text-xs text-red-600 dark:text-red-400">
                        {d.errorMessage}
                      </span>
                    )}
                    {d.recentErrors.length > 0 && (
                      <span className="mt-0.5 text-xs text-red-500">
                        {d.recentErrors.length} build error{d.recentErrors.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${stateBadge(d.state)}`}
                  >
                    {d.state}
                    {d.readySubstate && d.state === "READY" && (
                      <span className="ml-1 opacity-70">· {d.readySubstate}</span>
                    )}
                  </span>
                </td>
                <td className="hidden px-4 py-3 font-mono text-xs text-zinc-500 md:table-cell">
                  {formatDuration(d.buildDurationSec)}
                </td>
                <td className="hidden px-4 py-3 text-xs text-zinc-500 lg:table-cell">
                  {timeAgo(d.created * 1000)}
                </td>
                <td className="px-4 py-3 text-right">
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-emerald-600 hover:underline dark:text-emerald-400"
                  >
                    {d.url.replace(/^https?:\/\//, "").slice(0, 24)}…
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Error details for errored deployments */}
      {deployments.some((d) => d.state === "ERROR" && d.recentErrors.length > 0) && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/50">
          <h3 className="mb-2 text-sm font-medium text-red-800 dark:text-red-300">
            Build Error Details
          </h3>
          <div className="space-y-3">
            {deployments
              .filter((d) => d.state === "ERROR" && d.recentErrors.length > 0)
              .map((d) => (
                <div key={d.uid}>
                  <p className="text-xs font-mono text-red-600 dark:text-red-400">
                    {d.uid.slice(0, 12)}… — {d.errorMessage || "Build failed"}
                  </p>
                  <div className="mt-1 max-h-32 overflow-y-auto rounded border border-red-200 bg-white p-2 dark:border-red-800 dark:bg-zinc-900">
                    {d.recentErrors.map((e, i) => (
                      <p
                        key={i}
                        className="font-mono text-xs text-red-700 dark:text-red-300"
                      >
                        {e.text}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: "emerald" | "red" | "blue" | "zinc";
}) {
  const colors = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
    red: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
    blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
    zinc: "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300",
  };

  return (
    <div className={`rounded-lg border px-3 py-2.5 ${colors[color]}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="mt-0.5 text-lg font-bold">{value}</p>
    </div>
  );
}
