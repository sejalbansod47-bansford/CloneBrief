import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHandler } from './handler'
import { checkPackages } from '../package-checker/src/checker/index'

describe('production UI and package API', () => {
  let root: string, origin: string
  const calls: unknown[] = []
  const server = createServer((req, res) => handler(req, res))
  let handler: ReturnType<typeof createHandler>
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'clonebrief-'))
    await writeFile(join(root, 'index.html'), '<h1>CloneBrief</h1>')
    await writeFile(join(root, 'illustration.webp'), 'image fixture')
    handler = createHandler(root, async (input) => {
      calls.push(input)
      return checkPackages(input, { now: Date.parse('2026-11-20'), fetch: async (url) => {
        if (String(url).includes('osv.dev')) return new Response('{"vulns":[]}')
        return new Response(JSON.stringify({ time: { created: '2015-01-01' }, 'dist-tags': { latest: '1.0.0' }, versions: { '1.0.0': {} } }))
      } })
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })
  afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); await rm(root, { recursive: true, force: true }) })
  const post = (body: unknown) => fetch(origin + '/api/check-packages', { method: 'POST', body: JSON.stringify(body) })
  it('serves the built site, not source files, and supports HEAD', async () => {
    expect(await (await fetch(origin)).text()).toContain('CloneBrief')
    expect((await fetch(origin + '/package.json')).status).toBe(404)
    const head = await fetch(origin, { method: 'HEAD' })
    expect(head.status).toBe(200); expect(await head.text()).toBe('')
  })
  it('runs the existing checker and returns only curated alternatives', async () => {
    const res = await post({ ecosystem: 'auto', manifest: 'npm install expresss' })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.results[0]).toMatchObject({ name: 'expresss', label: 'one_typo_from_famous', alternative: { id: 'express', docs: 'https://expressjs.com' } })
  })
  it('serves WebP artwork with its image media type', async () => {
    const res = await fetch(origin + '/illustration.webp')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/webp')
  })
  it('rejects malformed inputs without running checks', async () => {
    const count = calls.length
    for (const body of [null, { ecosystem: 'other' }, { packages: [4] }, { manifest: 4 }, { ecosystem: 'npm', packages: Array(51).fill('react') }]) expect((await post(body)).status).toBe(400)
    expect(calls.length).toBe(count)
    expect((await fetch(origin + '/api/check-packages', { method: 'POST', body: '{' })).status).toBe(400)
  })
  it('rejects empty manifests, oversized requests and unsupported methods', async () => {
    expect((await post({ manifest: '' })).status).toBe(400)
    expect((await post({ manifest: 'x'.repeat(100_001) })).status).toBe(413)
    expect((await fetch(origin + '/api/check-packages')).status).toBe(405)
    expect((await fetch(origin + '/api/unknown')).status).toBe(404)
  })
})
