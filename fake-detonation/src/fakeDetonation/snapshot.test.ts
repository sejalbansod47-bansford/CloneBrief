import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchSnapshot, parseGitHubUrl } from './snapshot'

afterEach(() => vi.unstubAllGlobals())
describe('public repo fetch and recovery', () => {
  it('reports rate limits without recommending an unavailable backend', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 403 })))
    await expect(fetchSnapshot('https://github.com/owner/repo')).rejects.toThrow('Try a sample')
  })
  it('reports not-found and private repos honestly', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })))
    await expect(fetchSnapshot('owner/repo')).rejects.toThrow('not found or private')
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"private":true}')))
    await expect(fetchSnapshot('owner/repo')).rejects.toThrow('only reads public repos')
  })
  it('keeps the snapshot with an unread warning when headers arrive but the file body times out', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/git/trees/')) return new Response('{"tree":[{"type":"blob","path":"package.json","size":10}]}')
      if (url.includes('/users/')) return new Response('{}')
      if (url.includes('raw.githubusercontent.com')) return { ok: true, text: async () => { throw new DOMException('Body timed out', 'TimeoutError') } }
      return new Response('{"private":false,"owner":{"login":"owner"},"name":"repo","default_branch":"main"}')
    }))
    const snapshot = await fetchSnapshot('owner/repo')
    expect(snapshot.unread).toEqual(['package.json'])
    expect(snapshot.files).toEqual({})
  })
  it('only reads selected text files and carries incomplete-read warnings', async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.includes('/git/trees/')) return new Response(JSON.stringify({ tree: [{ type: 'blob', path: 'package.json', size: 10 }, { type: 'blob', path: 'index.js', size: 10 }, { type: 'blob', path: 'AGENTS.md', size: 200_001 }], truncated: true }))
      if (url.includes('/users/')) return new Response('{}')
      if (url.includes('raw.githubusercontent.com')) return new Response('{"scripts":{"postinstall":"node setup.js"}}')
      return new Response('{"private":false,"owner":{"login":"owner"},"name":"repo","default_branch":"main"}')
    })
    vi.stubGlobal('fetch', fetcher)
    const snapshot = await fetchSnapshot('owner/repo')
    expect(Object.keys(snapshot.files)).toEqual(['package.json'])
    expect(snapshot.unread).toEqual(['AGENTS.md'])
    expect(snapshot.truncated).toBe(true)
    expect(fetcher.mock.calls.every(([url]) => !url.endsWith('/index.js'))).toBe(true)
  })
})

describe('repo links', () => {
  it.each(['https://github.com/psf/requests', 'github.com/psf/requests', 'https://github.com/psf/requests/', 'https://github.com/psf/requests.git', 'https://github.com/psf/requests/tree/main'])( 'normalizes %s', (url) => {
    expect(parseGitHubUrl(url)).toEqual({ owner: 'psf', repo: 'requests' })
  })

  it.each(['', 'gibberish', 'https://gitlab.com/psf/requests'])('rejects %s without a request', async (url) => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    await expect(fetchSnapshot(url)).rejects.toThrow('Paste a public GitHub URL')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('reads an empty public repo tree from its default branch', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ owner: { login: 'psf' }, name: 'requests', default_branch: 'main' }))
      .mockResolvedValueOnce(Response.json({ tree: [] }))
      .mockResolvedValueOnce(Response.json({}))
    vi.stubGlobal('fetch', fetch)
    await expect(fetchSnapshot('psf/requests')).resolves.toMatchObject({ defaultBranch: 'main', paths: [], files: {}, unread: [] })
    expect(fetch.mock.calls[1][0]).toContain('/git/trees/main?recursive=1')
  })
})
