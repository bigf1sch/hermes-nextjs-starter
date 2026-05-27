import GitHubDashboard from "@/components/GitHubDashboard";
import VercelDeployMonitor from "@/components/VercelDeployMonitor";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      {/* Hero */}
      <main className="flex flex-1 flex-col items-center px-6 py-16 sm:px-12">
        <div className="flex w-full max-w-5xl flex-col items-center gap-8">
          <div className="flex max-w-2xl flex-col items-center gap-8 text-center">
            {/* Badge */}
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-500/20">
              Deployed via Hermes Kanban
            </span>

            <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">
              Next.js + Tailwind
              <span className="mt-2 block text-2xl font-semibold text-emerald-600 sm:text-3xl dark:text-emerald-400">
                Ready to build
              </span>
            </h1>

            <p className="max-w-lg text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
              A production-ready starter with TypeScript, Tailwind CSS v4, and the
              Next.js App Router. Scaffolded, customized, and deployed
              automatically.
            </p>

            {/* Feature grid */}
            <div className="mt-4 grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { title: "TypeScript", desc: "Full type safety across the stack" },
                { title: "Tailwind v4", desc: "Utility-first CSS, zero config" },
                { title: "GitHub API", desc: "Live repo stats via Octokit" },
              ].map(({ title, desc }) => (
                <div
                  key={title}
                  className="rounded-xl border border-zinc-200 bg-white p-5 text-left shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {title}
                  </h3>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {desc}
                  </p>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <a
                href="/api/health"
                className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Test API Route
              </a>
              <a
                href="/api/github/stats"
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                GitHub Stats API
              </a>
              <a
                href="https://nextjs.org/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Documentation
              </a>
            </div>
          </div>

          {/* GitHub Dashboard */}
          <div className="mt-8 w-full max-w-3xl">
            <GitHubDashboard />
          </div>

          {/* Vercel Deploy Monitor */}
          <div className="mt-8 w-full max-w-4xl">
            <VercelDeployMonitor />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 py-6 text-center text-sm text-zinc-400 dark:border-zinc-800">
        Built with Next.js 16 · Hermes Kanban Worker
      </footer>
    </div>
  );
}
