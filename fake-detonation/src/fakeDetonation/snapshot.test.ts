import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchSnapshot } from './snapshot'

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
