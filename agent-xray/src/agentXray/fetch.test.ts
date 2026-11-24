import { expect, it, vi } from 'vitest'
import { allowedGithubPath, fetchAgentFiles, readLimited, targetFile } from './fetch.ts'
it('targets required files only', () => {
  for (const p of ['AGENTS.md', 'CLAUDE.md', '.cursorrules', '.cursor/rules/test.mdc', '.github/copilot-instructions.md', 'nested/SKILL.md', '.mcp.json', '.vscode/mcp.json']) expect(targetFile(p)).toBe(true)
  expect(targetFile('package.json')).toBe(false)
})
it('rejects non-normalized or non-allowlisted API paths', () => {
  for (const path of ['/repos/a/b', '/repos/a/b/git/trees/main?recursive=1']) expect(allowedGithubPath(path)).toBe(true)
  for (const path of ['/repos/../user', '/repos/a/../../user', '/repos/a/%2e%2e', '//evil.com/repos/a/b', '/user', '/repos/a/b?x=1']) expect(allowedGithubPath(path)).toBe(false)
})
it('reads only API metadata, tree and raw text; never leaks headers to raw', async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ default_branch: 'main' })).mockResolvedValueOnce(Response.json({ tree: [{ path: 'AGENTS.md', type: 'blob', size: 5 }, { path: 'package.json', type: 'blob' }] })).mockResolvedValueOnce(new Response('hello'))
  const result = await fetchAgentFiles('https://github.com/a/b', { fetch: request, token: 'test-token' })
  expect(result.files).toEqual([{ path: 'AGENTS.md', text: 'hello' }]); expect(request).toHaveBeenCalledTimes(3)
  expect(request.mock.calls[2][0]).toBe('https://raw.githubusercontent.com/a/b/main/AGENTS.md')
  expect(request.mock.calls[2][1]?.headers).toBeUndefined()
})
it('handles empty trees, oversize/unread files and file-count limits', async () => {
  const request = vi.fn<typeof fetch>().mockImplementation(async url => String(url).includes('/git/trees/') ? Response.json({ truncated: true, tree: Array.from({ length: 42 }, (_, i) => ({ path: `${i}/SKILL.md`, type: 'blob', size: 200001 })) }) : Response.json({ default_branch: 'main' }))
  const result = await fetchAgentFiles('a/b', { fetch: request })
  expect(result.files).toEqual([]); expect(result.unread).toHaveLength(42); expect(result.truncated).toBe(true)
  const empty = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ default_branch: 'main' })).mockResolvedValueOnce(Response.json({ tree: [] }))
  expect((await fetchAgentFiles('a/b', { fetch: empty })).files).toEqual([])
})
it('rejects errors and limits actual streamed bytes', async () => {
  await expect(fetchAgentFiles('https://evil.com/a/b')).rejects.toThrow()
  await expect(fetchAgentFiles('a/b', { fetch: vi.fn().mockResolvedValue(new Response('', { status: 403 })) })).rejects.toThrow('403')
  await expect(readLimited(new Response('😀'), 3)).rejects.toThrow('too large')
  const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ default_branch: 'main' })).mockResolvedValueOnce(Response.json({ tree: [{ path: 'AGENTS.md', type: 'blob' }] })).mockRejectedValueOnce(new Error('network'))
  expect((await fetchAgentFiles('a/b', { fetch: request })).unread).toEqual(['AGENTS.md'])
})
