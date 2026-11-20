// Supabase Edge Function: read-only GitHub API proxy for Fake Detonation.
// Set the secret once: supabase secrets set GITHUB_TOKEN=<fine-grained PAT, public repos read-only>
// Only GETs to /repos/{o}/{r}, /repos/{o}/{r}/git/trees/..., and /users/{u} are forwarded.

const ALLOWED = [/^\/repos\/[\w.-]+\/[\w.-]+$/, /^\/repos\/[\w.-]+\/[\w.-]+\/git\/trees\/[^/?#]+\?recursive=1$/, /^\/users\/[\w.-]+$/]

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

// fetch normalises dot segments (.., %2e%2e, backslashes) and could reach the authenticated /user endpoint,
// so the path must already be in normal form.
const isNormalised = (path: string) => {
  try {
    const u = new URL(path, 'https://api.github.com')
    return u.origin === 'https://api.github.com' && u.pathname + u.search === path
  } catch {
    return false
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: cors })

  const path = new URL(req.url).searchParams.get('path') ?? ''
  if (!isNormalised(path) || !ALLOWED.some((re) => re.test(path))) return new Response('Path not allowed', { status: 400, headers: cors })

  const token = Deno.env.get('GITHUB_TOKEN')
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'clonebrief-fake-detonation',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  return new Response(await res.text(), {
    status: res.status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
  })
})
