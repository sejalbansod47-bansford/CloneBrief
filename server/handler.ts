import type { IncomingMessage, ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { checkPackages } from '../package-checker/src/checker/index.ts'
import type { Input } from '../package-checker/src/checker/input.ts'

const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }
export function createHandler(root: string, checker = checkPackages) {
  let active = 0, windowStart = Date.now(), requests = 0
  return async (req: IncomingMessage, res: ServerResponse) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'no-referrer')
    const json = (status: number, body: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)) }
    try {
      const path = new URL(req.url || '/', 'http://localhost').pathname
      if (path === '/api/check-packages') {
        if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(405, { error: 'Use POST.' }) }
        if (Date.now() - windowStart > 60_000) { requests = 0; windowStart = Date.now() }
        if (active >= 2 || ++requests > 30) { res.setHeader('Retry-After', '60'); return json(429, { error: 'A few too many spins. Try again in a minute.' }) }
        active++
        try {
          let size = 0
          const chunks: Buffer[] = []
          for await (const chunk of req) {
            size += chunk.length
            if (size > 100_000) { json(413, { error: 'Keep your input under 100 KB.' }); req.resume(); return }
            chunks.push(Buffer.from(chunk))
          }
          let body: Input
          try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { return json(400, { error: 'Send valid JSON.' }) }
          if (!body || typeof body !== 'object' || ![undefined, 'auto', 'npm', 'pypi'].includes(body.ecosystem) || (body.manifest !== undefined && typeof body.manifest !== 'string') || (body.packages !== undefined && (!Array.isArray(body.packages) || body.packages.length > 50 || body.packages.some(n => typeof n !== 'string' || n.length > 214)))) return json(400, { error: 'Use npm, PyPI or auto, with up to 50 packages.' })
          try {
            const result = await checker(body, { concurrency: 4 })
            if (!result.results.length) return json(400, { error: 'No packages found. Paste dependencies or an install command.' })
            return json(200, result)
          } catch (error) { return json(400, { error: error instanceof Error ? error.message : 'Could not read these packages.' }) }
        } finally { active-- }
      }
      if (path.startsWith('/api/')) return json(404, { error: 'Not found.' })
      if (req.method !== 'GET' && req.method !== 'HEAD') return json(405, { error: 'Use GET.' })
      let filename = resolve(root, '.' + decodeURIComponent(path))
      if (!filename.startsWith(resolve(root) + sep) && filename !== resolve(root)) return json(403, { error: 'Not allowed.' })
      if (path === '/') filename = resolve(root, 'index.html')
      const data = await readFile(filename).catch(() => null)
      if (!data) return json(404, { error: 'Not found.' })
      res.writeHead(200, { 'Content-Type': MIME[extname(filename)] || 'application/octet-stream', 'Cache-Control': path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' })
      res.end(req.method === 'HEAD' ? undefined : data)
    } catch { if (!res.headersSent) json(500, { error: 'Something went wrong. Try again.' }); else res.end() }
  }
}
