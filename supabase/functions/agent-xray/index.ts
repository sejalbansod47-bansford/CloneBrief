import { fetchAgentFiles, readLimited } from '../../../agent-xray/src/agentXray/fetch.ts'
import { applyClassifier, scanFiles } from '../../../agent-xray/src/agentXray/scan.ts'
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
export async function handler(req: Request): Promise<Response> {
  const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (req.method !== 'POST') return reply({ error: 'Use POST' }, 405)
  let body: { repoUrl?: unknown }
  try { body = JSON.parse(await readLimited(new Response(req.body, { headers: req.headers }), 4096)) }
  catch { return reply({ error: 'Invalid or oversized JSON body' }, 400) }
  if (!body || typeof body.repoUrl !== 'string' || body.repoUrl.length > 2048) return reply({ error: 'repoUrl required' }, 400)
  try {
    const snapshot = await fetchAgentFiles(body.repoUrl, { token: Deno.env.get('GITHUB_TOKEN') })
    let report = { ...scanFiles(snapshot.files), repo: snapshot.repo }
    const url = Deno.env.get('MODAL_XRAY_URL'), key = Deno.env.get('MODAL_KEY'), secret = Deno.env.get('MODAL_SECRET')
    if (url && key && secret) {
      try {
        const chunks = report.findings.slice(0, 64).map(f => ({ id: f.id, text: Array.from([f.evidence, f.decoded ?? ''].join('\n')).slice(0, 2000).join('') }))
        const res = await fetch(url, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000), headers: { 'Content-Type': 'application/json', 'Modal-Key': key, 'Modal-Secret': secret }, body: JSON.stringify({ chunks }) })
        if (!res.ok) throw new Error('Classifier unavailable')
        const data = JSON.parse(await readLimited(res, 100_000))
        if (!Array.isArray(data.results) || data.results.length !== chunks.length || new Set(data.results.map((r: { id: string }) => r.id)).size !== chunks.length || data.results.some((r: { id: string; score: number }) => !r || !chunks.some(c => c.id === r.id) || typeof r.score !== 'number' || !Number.isFinite(r.score) || r.score < 0 || r.score > 1)) throw new Error('Invalid classifier response')
        report = { ...applyClassifier(report, data.results), repo: snapshot.repo }
      } catch { report.classifier = 'unavailable' }
    } else report.classifier = 'unavailable'
    return reply({ ...report, unread: snapshot.unread, truncated: snapshot.truncated })
  } catch (error) { return reply({ error: error instanceof Error ? error.message : 'Repository read failed' }, 400) }
}
Deno.serve(handler)
