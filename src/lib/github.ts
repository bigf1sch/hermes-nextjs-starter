import { Octokit } from "@octokit/rest";

// --------------- cache layer ---------------

interface CacheEntry<T> {
  data: T;
  expires: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — avoids GitHub rate limits

function getCached<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, expires: Date.now() + CACHE_TTL_MS });
}

// --------------- octokit client ---------------

function getOctokit(): Octokit {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN env var not set");
  return new Octokit({ auth: token });
}

// --------------- types ---------------

export interface GitHubStats {
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

export interface RepoSummary {
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

export interface PRSummary {
  title: string;
  repo: string;
  url: string;
  state: string;
  createdAt: string;
}

export interface ContributionWeek {
  week: number; // unix timestamp of week start
  additions: number;
  deletions: number;
  commits: number;
}

// --------------- data fetching ---------------

export async function fetchGitHubStats(username: string): Promise<GitHubStats> {
  const cacheKey = `stats:${username}`;
  const cached = getCached<GitHubStats>(cacheKey);
  if (cached) return cached;

  const octokit = getOctokit();

  // 1. user profile
  const { data: user } = await octokit.rest.users.getByUsername({ username });

  // 2. repos (owned, not forks, sorted by pushed)
  const repos = await octokit.paginate(octokit.rest.repos.listForUser, {
    username,
    type: "owner",
    sort: "pushed",
    per_page: 30,
  });

  const ownedRepos = repos.filter((r) => !r.fork).slice(0, 10);

  // 3. per-repo stats (commits + participation) — parallel
  const repoSummaries: RepoSummary[] = [];
  let totalStars = 0;
  let totalForks = 0;
  let totalOpenIssues = 0;
  let totalCommits = 0;

  // contribution weeks aggregation
  const weekMap = new Map<number, ContributionWeek>();

  for (const repo of ownedRepos) {
    // Get contributor stats for this repo to count user's commits
    try {
      const { data: contributors } = await octokit.rest.repos.listContributors({
        owner: repo.owner.login,
        repo: repo.name,
        per_page: 100,
      });

      const userContrib = contributors.find(
        (c) => c.login?.toLowerCase() === username.toLowerCase()
      );
      const commits = userContrib?.contributions ?? 0;

      // Fetch participation (weekly commit counts)
      try {
        const { data: participation } =
          await octokit.rest.repos.getCommitActivityStats({
            owner: repo.owner.login,
            repo: repo.name,
          });

        if (Array.isArray(participation)) {
          for (const week of participation) {
            const existing = weekMap.get(week.week);
            if (existing) {
              existing.additions += week.total;
              existing.commits += 1;
            } else {
              weekMap.set(week.week, {
                week: week.week,
                additions: week.total,
                deletions: 0,
                commits: 1,
              });
            }
          }
        }
      } catch {
        // stats not yet computed for this repo (GitHub returns 202)
      }

      repoSummaries.push({
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        stars: repo.stargazers_count ?? 0,
        forks: repo.forks_count ?? 0,
        openIssues: repo.open_issues_count ?? 0,
        language: repo.language ?? null,
        url: repo.html_url,
        commits,
      });

      totalStars += repo.stargazers_count ?? 0;
      totalForks += repo.forks_count ?? 0;
      totalOpenIssues += repo.open_issues_count ?? 0;
      totalCommits += commits;
    } catch {
      // skip repos that error out
    }
  }

  // 4. recent PRs via search
  let recentPRs: PRSummary[] = [];
  try {
    const { data: prs } = await octokit.rest.search.issuesAndPullRequests({
      q: `type:pr author:${username}`,
      sort: "created",
      order: "desc",
      per_page: 10,
    });
    recentPRs = prs.items.map((pr) => ({
      title: pr.title,
      repo: pr.repository_url.split("/").slice(-2).join("/"),
      url: pr.html_url,
      state: pr.state,
      createdAt: pr.created_at,
    }));
  } catch {
    // search may fail
  }

  // 5. build contribution weeks (sorted)
  const contributionWeeks = Array.from(weekMap.values()).sort(
    (a, b) => a.week - b.week
  );

  const stats: GitHubStats = {
    user: {
      login: user.login,
      name: user.name ?? null,
      avatar: user.avatar_url,
      bio: user.bio,
      publicRepos: user.public_repos,
      followers: user.followers,
      following: user.following,
    },
    repos: repoSummaries,
    totals: {
      repos: repoSummaries.length,
      stars: totalStars,
      forks: totalForks,
      openIssues: totalOpenIssues,
      totalCommits,
    },
    recentPRs,
    contributionWeeks,
    cachedAt: new Date().toISOString(),
  };

  setCache(cacheKey, stats);
  return stats;
}
