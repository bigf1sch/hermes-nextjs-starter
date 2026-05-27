"use client";

import { useEffect, useState } from "react";

interface GitHubStats {
  user: {
    login: string;
    name: string | null;
    avatar: string;
    bio: string | null;
    publicRepos: number;
    followers: number;
    following: number;
  };
  repos: RepoSummary[];
  totals: {
    repos: number;
    stars: number;
    forks: number;
    openIssues: number;
    totalCommits: number;
  };
  recentPRs: PRSummary[];
  contributionWeeks: ContributionWeek[];
  cachedAt: string;
}

interface RepoSummary {
  name: string;
  fullName: string;
  description: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  language: string | null;
  url: string;
  commits: number;
}

interface PRSummary {
  title: string;
  repo: string;
  url: string;
  state: string;
  createdAt: string;
}

interface ContributionWeek {
  week: number;
  additions: number;
  deletions: number;
  commits: number;
}

export default function GitHubDashboard() {
  const [stats, setStats] = useState<GitHubStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/github/stats")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setStats(data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-32 rounded bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-4 w-48 rounded bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-24 rounded bg-zinc-200 dark:bg-zinc-700" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 shadow-sm dark:border-red-900 dark:bg-red-950">
        <p className="text-sm font-medium text-red-700 dark:text-red-300">
          GitHub data unavailable
        </p>
        <p className="mt-1 text-xs text-red-500 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (!stats) return null;

  const { user, totals, repos, recentPRs, contributionWeeks } = stats;

  // Contribution heatmap: last 26 weeks
  const recentWeeks = contributionWeeks.slice(-26);
  const maxCommits = Math.max(...recentWeeks.map((w) => w.commits), 1);

  const heatColors = [
    "bg-emerald-100 dark:bg-emerald-950",
    "bg-emerald-200 dark:bg-emerald-900",
    "bg-emerald-400 dark:bg-emerald-700",
    "bg-emerald-500 dark:bg-emerald-500",
    "bg-emerald-600 dark:bg-emerald-400",
  ];

  function heatClass(commits: number): string {
    if (commits === 0) return heatColors[0];
    const idx = Math.min(
      Math.ceil((commits / maxCommits) * heatColors.length) - 1,
      heatColors.length - 1
    );
    return heatColors[Math.max(idx, 1)];
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <img
          src={user.avatar}
          alt={user.login}
          className="h-12 w-12 rounded-full ring-2 ring-emerald-200 dark:ring-emerald-800"
        />
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {user.name || user.login}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            @{user.login}
            {user.bio && ` · ${user.bio.slice(0, 60)}${user.bio.length > 60 ? "…" : ""}`}
          </p>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 mb-6 sm:grid-cols-5">
        {[
          { label: "Repos", value: totals.repos },
          { label: "Stars", value: totals.stars },
          { label: "Forks", value: totals.forks },
          { label: "Commits", value: totals.totalCommits },
          { label: "Open Issues", value: totals.openIssues },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-lg border border-zinc-100 bg-zinc-50 p-3 text-center dark:border-zinc-800 dark:bg-zinc-800/50"
          >
            <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {value.toLocaleString()}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Contribution heatmap */}
      {recentWeeks.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Contributions (26 weeks)
          </h3>
          <div className="flex gap-0.5">
            {recentWeeks.map((w, i) => (
              <div
                key={i}
                className={`h-3 flex-1 rounded-sm ${heatClass(w.commits)}`}
                title={`Week of ${new Date(w.week * 1000).toLocaleDateString()}: ${w.commits} commits, ${w.additions} additions`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Repo list */}
      <div className="mb-6">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Top Repositories
        </h3>
        <div className="space-y-2">
          {repos.slice(0, 5).map((repo) => (
            <a
              key={repo.name}
              href={repo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-lg border border-zinc-100 p-3 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
            >
              <div>
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {repo.fullName}
                </span>
                {repo.description && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-xs">
                    {repo.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                {repo.language && (
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    {repo.language}
                  </span>
                )}
                <span>★ {repo.stars}</span>
                <span>{repo.commits} commits</span>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Recent PRs */}
      {recentPRs.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Recent Pull Requests
          </h3>
          <div className="space-y-1">
            {recentPRs.slice(0, 5).map((pr, i) => (
              <a
                key={i}
                href={pr.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded p-1.5 text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              >
                <span
                  className={`h-2 w-2 rounded-full ${pr.state === "open" ? "bg-green-500" : pr.state === "merged" ? "bg-purple-500" : "bg-red-500"}`}
                />
                <span className="truncate text-zinc-700 dark:text-zinc-300">
                  {pr.title}
                </span>
                <span className="ml-auto shrink-0 text-xs text-zinc-400">
                  {pr.repo}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Cache timestamp */}
      <p className="mt-4 text-right text-xs text-zinc-400 dark:text-zinc-500">
        Updated {new Date(stats.cachedAt).toLocaleTimeString()}
      </p>
    </div>
  );
}
