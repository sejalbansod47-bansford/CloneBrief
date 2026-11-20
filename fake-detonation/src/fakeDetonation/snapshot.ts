import { interestingPaths } from './analyze'
import type { RepoSnapshot } from './types'

export function parseGitHubUrl(input: string): { owner: string; repo: string } | null {
  const m = input.trim().match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/?#].*)?$/i)
    ?? input.trim().match(/^([\w.-]+)\/([\w.-]+)$/)
  return m ? { owner: m[1], repo: m[2] } : null
}

const MAX_FILE_BYTES = 200_000

export interface FetchOptions {
  /** Server-side only (e.g. inside an Edge Function). Never ship a token to the browser. */
  token?: string
  /**
   * Send GitHub API calls through a proxy instead, e.g.
   * `${SUPABASE_URL}/functions/v1/github-proxy?path=` (the GitHub path is appended, URL-encoded).
   */
  proxyUrl?: string
  /** Extra headers for the proxy, e.g. { apikey, Authorization: `Bearer ${anonKey}` }. */
  headers?: Record<string, string>
}

async function gh(path: string, o: FetchOptions) {
  const url = o.proxyUrl ? o.proxyUrl + encodeURIComponent(path) : `https://api.github.com${path}`
  const res = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    headers: { Accept: 'application/vnd.github+json', ...(o.token ? { Authorization: `Bearer ${o.token}` } : {}), ...o.headers },
  })
  if (res.status === 404) throw new Error('Repo not found or private. CloneBrief only reads public repos.')
  if (res.status === 403 || res.status === 429) throw new Error('GitHub is limiting requests right now. Try a sample below, or retry this public repo later.')
  if (!res.ok) throw new Error(`GitHub API error ${res.status}`)
  return res.json()
}

/**
 * Reads a public repo as text: metadata, the file tree, and a handful of files.
 * Uses 3 GitHub API calls (raw file reads do not count). Nothing is cloned or executed.
 */
export async function fetchSnapshot(url: string, opts: FetchOptions = {}): Promise<RepoSnapshot> {
  const parsed = parseGitHubUrl(url)
  if (!parsed) throw new Error('Paste a public GitHub URL like https://github.com/owner/repo')
  const meta = await gh(`/repos/${parsed.owner}/${parsed.repo}`, opts)
  if (meta.private) throw new Error('Private repo. CloneBrief only reads public repos.')
  const branch: string = meta.default_branch
  const [tree, owner] = await Promise.all([
    gh(`/repos/${meta.owner.login}/${meta.name}/git/trees/${encodeURIComponent(branch)}?recursive=1`, opts),
    gh(`/users/${meta.owner.login}`, opts).catch(() => undefined),
  ])
  const paths: string[] = tree.tree.filter((t: any) => t.type === 'blob').map((t: any) => t.path)
  const sizes = new Map<string, number>(tree.tree.map((t: any) => [t.path, t.size ?? 0]))
  const files: Record<string, string> = {}
  const unread: string[] = []
  await Promise.all(
    interestingPaths(paths).map(async (p) => {
      if ((sizes.get(p) ?? 0) > MAX_FILE_BYTES) return void unread.push(p)
      try {
        const res = await fetch(`https://raw.githubusercontent.com/${meta.owner.login}/${meta.name}/${encodeURIComponent(branch)}/${p.split('/').map(encodeURIComponent).join('/')}`, { signal: AbortSignal.timeout(15000) })
        if (!res.ok) throw new Error('File unavailable')
        files[p] = await res.text()
      } catch { unread.push(p) }
    }),
  )
  return {
    owner: meta.owner.login,
    repo: meta.name,
    defaultBranch: branch,
    paths,
    files,
    createdAt: meta.created_at,
    ownerCreatedAt: owner?.created_at,
    stars: meta.stargazers_count,
    truncated: !!tree.truncated,
    unread: unread.sort(),
  }
}
