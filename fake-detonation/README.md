# Fake Detonation (CloneBrief)

Paste a public GitHub repo and a pretend terminal plays out what **would** run at each moment a student or agent touches it: **Clone → Open → Agent → Install → Run**. It types out the real `postinstall`, `curl | bash`, `.vscode/tasks.json`, `.mcp.json`, `AGENTS.md` and devcontainer commands it found, with the file each came from.

**Defensive only.** The repo is read as text through the GitHub API (3 calls) and `raw.githubusercontent.com`. Nothing is cloned, installed or executed. Commands are rendered as React text, never `eval`'d.

## Try it

```bash
npm install
npm run dev      # demo page with 3 offline samples + live URL box
npm test         # analyzer tests
```

## Drop it into the Lovable app

Copy `src/fakeDetonation/` into the Lovable project's `src/` (GitHub sync, or paste the files). It needs only React + Tailwind, which Lovable already has.

```tsx
import { FakeDetonation, SAMPLES, buildReplay, fetchSnapshot } from '@/fakeDetonation'

// offline sample (works when venue Wi-Fi hits the GitHub rate limit)
<FakeDetonation replay={buildReplay(SAMPLES[0].snapshot)} />

// live repo
const replay = buildReplay(await fetchSnapshot('https://github.com/owner/repo'))
<FakeDetonation replay={replay} />
```

`replay.findings` is plain data (`phase`, `severity`, `command`, `why`, `evidence`) if you want to render CloneBrief's own threat cards from it.

### Rate limit: Supabase proxy (optional)

Anonymous GitHub API is 60 requests/hour per IP, i.e. about 20 scans on shared Wi-Fi. To lift it:

1. Copy `supabase/functions/github-proxy/` into the Lovable project's `supabase/functions/`.
2. Add a Supabase secret `GITHUB_TOKEN` (fine-grained PAT, public repos, read-only).
3. Call:

```ts
fetchSnapshot(url, {
  proxyUrl: `${SUPABASE_URL}/functions/v1/github-proxy?path=`,
  headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
})
```

The proxy only forwards GETs to the 3 GitHub paths the scanner uses. The token stays server-side.

### Lovable prompt (if pasting instead of syncing)

> Add a "Fake detonation" section under the scan result. Use the `FakeDetonation` component from `src/fakeDetonation` (already in the repo, do not rewrite it). Feed it `buildReplay(snapshot)`. Add three sample buttons from `SAMPLES`. Do not execute or eval anything from the scanned repo. Do not add any package names.

## What it detects

| Phase | Source | Example |
|---|---|---|
| Open | `.vscode/tasks.json` with `runOn: folderOpen`; devcontainer `initializeCommand` / `postCreateCommand` | task runs when you open the folder |
| Agent | `.mcp.json` servers; commands inside `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `SKILL.md`, `.cursor/rules` | agent starts `npx -y some-mcp` |
| Install | `package.json` `preinstall`/`install`/`postinstall`/`prepare`; `setup.py`; odd `pyproject` build backend; README install lines | `postinstall: node setup.js` |
| Run | `package.json` `start`/`dev`/`serve`; README run lines | `npm start` |

Any command is upgraded to **DANGER** when it pipes a download into a shell, decodes base64, runs inline code, touches `~/.ssh` / `.env` / tokens, calls a raw IP / webhook / paste site, or asks for `sudo` / persistence. Everything else is **PAUSE** (auto-runs) or info. No findings is not "safe".
