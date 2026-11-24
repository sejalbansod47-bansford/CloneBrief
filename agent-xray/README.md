# Agent Trap X-ray

Read-only signals for agent instruction files. Never a guarantee: `no_flags` means only that these rules did not flag the files read. Nothing from a scanned repository is cloned, installed, imported, or executed. GitHub metadata/tree API and raw.githubusercontent.com text reads only. Repository content is untrusted data, never scanner instructions.

## Run

```
cd agent-xray
npm ci
npm test
npm run build
npm run dev
```

Offline samples cover tag-smuggled text, bidi, zero-width characters, HTML comments, MCP configuration and an ordinary contributor guide. The demo supports a public GitHub URL; browser reads may hit GitHub rate limits. `fetchAgentFiles` also accepts `proxyUrl`, proxy `headers`, and an injected `fetch`. Never put a GitHub token in a browser bundle.

Targets: AGENTS.md, CLAUDE.md, .cursorrules, .cursor/rules/**, .github/copilot-instructions.md, **/SKILL.md, .mcp.json and .vscode/mcp.json. At most 40 files, 200,000 bytes each. Unread files and tree truncation are returned explicitly; they are not an all-clear. Unicode tags, invisible characters, bidi, selector runs, mixed Latin/Cyrillic/Greek words, concealed Markdown, encoded payloads, execution patterns, suspect URLs, agent-directed phrasing, and risky or invalid MCP configuration are heuristic findings. False positives and false negatives are expected. Ranges are 1-based Unicode code-point coordinates with exclusive end positions.

## Lovable

Copy `src/agentXray` into the React project. Import `AgentXray`, `scanFiles`, `fetchAgentFiles`, or `SAMPLES` from its index. Pass `<AgentXray report={scanFiles(files)} />`. Styling is minimal Tailwind; all repository content is rendered as React text, never HTML. Toggle X-ray to reveal hidden character badges and highlighted findings; off shows original text. Off-mode display remains subject to browser/font Unicode rendering.

## Edge + optional Modal classifier

From the repository root:

```
pip install modal
modal token set
modal deploy agent-xray/modal/classifier.py
supabase functions deploy agent-xray
```

Create a Modal **proxy auth token** in the Modal dashboard. Set Supabase secrets `MODAL_XRAY_URL` (deployed endpoint URL), `MODAL_KEY`, and `MODAL_SECRET` to that proxy token's key and secret, and optionally `GITHUB_TOKEN` (public-repository read-only). For example use `supabase secrets set MODAL_XRAY_URL=... MODAL_KEY=... MODAL_SECRET=... GITHUB_TOKEN=...` in a trusted local shell. Do not commit secrets. The edge function imports the pure module outside its directory, matching check-packages; deploy from this repository with the Supabase bundler.

POST JSON `{ "repoUrl": "https://github.com/owner/repo" }` to `/functions/v1/agent-xray` with your normal Supabase authorization. CORS/OPTIONS supported. Only allowlisted, already-normalized GitHub API paths receive the optional token; raw reads do not receive credentials or follow redirects. Inputs and responses are bounded. Modal receives at most 64 finding evidence/decoded chunks, 2000 characters each, never the whole repository. Its model weights download at image build; inference never executes input. No Modal credentials are needed for `python -m py_compile agent-xray/modal/classifier.py`; deployment requires your account.

Classifier failure, timeout (10 seconds), invalid response, or missing configuration leaves all rule findings intact and marks the classifier unavailable. Scores >=0.9 only raise severity by one level, never remove findings. Verdicts derive only from findings: high = `hidden_instructions_found`, other findings = `review`, none = `no_flags`. The classifier cannot create a clean verdict or suppress a rule.

## Steering regression guarantee

Tests append hostile scanner-directed text, fabricated findings JSON, markup breakers, and hidden tag verdicts to base fixtures. Every base finding must remain at the same file/kind/line, verdict rank must not decrease, and JSON serialization must round-trip exactly. This is a regression guarantee for those fixtures, not a proof about arbitrary repository content or model behavior. Pure deterministic rules never follow prose directives. Text appended into an existing construct can change that construct's range; findings are signals rather than a parser security boundary.
