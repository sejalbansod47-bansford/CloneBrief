import type { AgentFile } from './scan.ts'
export interface FetchOptions { proxyUrl?: string; headers?: Record<string, string>; fetch?: typeof fetch; token?: string }
export const MAX_FILES = 40, MAX_BYTES = 200_000
export function allowedGithubPath(path: string): boolean {
  const u = new URL(path, 'https://api.github.com')
  return u.origin === 'https://api.github.com' && u.pathname + u.search === path && [/^\/repos\/[\w.-]+\/[\w.-]+$/, /^\/repos\/[\w.-]+\/[\w.-]+\/git\/trees\/[^/?#]+\?recursive=1$/].some(r => r.test(path))
}
export async function readLimited(res: Response, max: number): Promise<string> {
  if (Number(res.headers.get('content-length')) > max) throw new Error('Response too large')
  const reader = res.body?.getReader(); if (!reader) return ''
  const chunks: Uint8Array[] = []; let size = 0
  try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > max) throw new Error('Response too large'); chunks.push(value) } }
  finally { await reader.cancel() }
  const bytes = new Uint8Array(size); let offset = 0; for (const c of chunks) { bytes.set(c, offset); offset += c.length }
  return new TextDecoder().decode(bytes)
}
export function targetFile(path: string): boolean {
  return /(?:^|\/)(?:AGENTS\.md|CLAUDE\.md|SKILL\.md|\.cursorrules|\.mcp\.json)$/.test(path) || /^(?:\.cursor\/rules\/.+|\.github\/copilot-instructions\.md|\.vscode\/mcp\.json)$/.test(path)
}
export async function fetchAgentFiles(repoUrl: string, opts: FetchOptions = {}): Promise<{ repo: string; files: AgentFile[]; unread: string[]; truncated: boolean }> {
  const match = repoUrl.trim().match(/^(?:https:\/\/github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/)
  if (!match || [match[1], match[2]].some(p => p === '.' || p === '..')) throw new Error('Use a GitHub owner/repo or repository URL')
  const repo = `${match[1]}/${match[2]}`, request = opts.fetch ?? fetch
  const gh = async (path: string) => {
    if (!allowedGithubPath(path)) throw new Error('GitHub path not allowed')
    const response = await request(opts.proxyUrl ? opts.proxyUrl + encodeURIComponent(path) : `https://api.github.com${path}`, { redirect: 'error', signal: AbortSignal.timeout(15000), headers: { Accept: 'application/vnd.github+json', ...(opts.token && !opts.proxyUrl ? { Authorization: `Bearer ${opts.token}` } : {}), ...opts.headers } })
    if (!response.ok) throw new Error(`GitHub API error ${response.status}`)
    return JSON.parse(await readLimited(response, 8_000_000))
  }
  const meta = await gh(`/repos/${repo}`)
  if (meta.private || typeof meta.default_branch !== 'string') throw new Error('Public repository required')
  const tree = await gh(`/repos/${repo}/git/trees/${encodeURIComponent(meta.default_branch)}?recursive=1`)
  if (!Array.isArray(tree.tree)) throw new Error('Invalid GitHub tree')
  const targets = tree.tree.filter((t: { type: string; path: string }) => t.type === 'blob' && typeof t.path === 'string' && targetFile(t.path)).sort((a: { path: string }, b: { path: string }) => a.path.localeCompare(b.path))
  const files: AgentFile[] = [], unread: string[] = targets.slice(MAX_FILES).map((t: { path: string }) => t.path)
  for (const entry of targets.slice(0, MAX_FILES)) {
    if (entry.size > MAX_BYTES || entry.path.split('/').some((p: string) => p === '.' || p === '..' || p.includes('\\'))) { unread.push(entry.path); continue }
    try {
      const res = await request(`https://raw.githubusercontent.com/${repo}/${encodeURIComponent(meta.default_branch)}/${entry.path.split('/').map(encodeURIComponent).join('/')}`, { redirect: 'error', signal: AbortSignal.timeout(15000) })
      if (!res.ok) throw new Error('File unavailable')
      files.push({ path: entry.path, text: await readLimited(res, MAX_BYTES) })
    } catch { unread.push(entry.path) }
  }
  return { repo, files, unread, truncated: !!tree.truncated }
}
