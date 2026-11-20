# CloneBrief package checker

Portable TypeScript for Node, browser bundlers and Deno. Defensive only: never installs packages or executes their code. Alternatives come exclusively from `allowlist.json`.

## Run
```sh
cd package-checker
npm ci
npm test
npm run check -- npm expresss express some-made-up-name-zzqx
npm run check -- pypi reqeusts requests
```

Core: `checkPackages(input, {fetch, now, concurrency})` in `src/checker/index.ts`. Fetch is injectable. Default concurrency four packages, maximum eight; each request times out after 12 seconds. No Node-only APIs in core. Download-count checks are not implemented.

## API
POST `/functions/v1/check-packages`:
```json
{"ecosystem":"npm","packages":["expresss","express"]}
```
Alternatively pass `manifest` containing package.json, requirements.txt, or common pyproject dependency sections with an explicit ecosystem. For raw chatbot answers, pass `{"ecosystem":"auto","manifest":"Try npm i react\npip install requests"}`; ecosystem can be omitted for commands. Recognizes npm i/install/add, yarn/pnpm add, npx, pip/pip3 install, uv add and poetry add. No command is executed. Import/require extraction is not implemented.

Response example (alternative row abridged):
```json
{"banner":"Signals, not a guarantee. Clone copies files. Install, open, and agent-run can execute code.","results":[{"name":"expresss","ecosystem":"npm","label":"one_typo_from_famous","verdict":"pause","signals":[{"type":"typosquat","severity":"warn","title":"Similar to a curated package","why":"A similar name may be an accidental typo or impersonation.","evidence":{"url":"https://openjsf.org/projects","field":"express"}}],"alternative":{"id":"express","names":["express"]},"alternativeMessage":"Curated similar name; verify it fits your task.","otherVulnerabilities":0,"maliciousAdvisories":[]}]}
```
Full alternatives include all allowlist row fields. Labels prioritize does_not_exist, lookup_failed, one_typo_from_famous, brand_new, then real. `real` means registry presence, not safety. Verdicts: do_not_install (404 or MAL advisory), pause (warnings, including lookup failures), no_flags. Ordinary OSV advisories are informational counts across all versions; this is not a lockfile audit. PyPI separator-equivalent names count as exact matches. No extra popular-name corpus is used beyond curated names.

Maximum 50 packages; invalid input returns 400, unsupported methods 405. Network failures are per-package lookup_failed signals in a 200 response. CORS permits POST/OPTIONS. Body limit is 100,000 characters; add gateway request/rate limits for production. Keep Supabase JWT verification enabled: wildcard CORS is not authentication.

## Deploy and Lovable
From the complete repository root with Supabase CLI installed and linked:
```sh
supabase functions deploy check-packages
```
The module graph imports shared files outside the function directory; deploy the complete checkout, not a copied index.ts.
```ts
const { data, error } = await supabase.functions.invoke('check-packages', {
  body: { ecosystem: 'auto', manifest: chatbotAnswer }
});
if (error) throw error;
// Render data.banner and results: labels, verdicts, signals, alternatives.
```
Offline demos: load `samples/*.json` and render `response`. Fixtures are synthetic, not live claims. No UI is included.

## Limitations and curation
11 curated rows: Express/Fastify cite the OpenJS directory; pip cites PyPA's project listing. Other established upstream projects cite canonical registry pages under attested_popular, an identity/popularity reference, **not an independent security attestation**. Review citations periodically. Names are never generated as alternatives.

Parsing is intentionally limited, not a full TOML/requirements/shell interpreter. Supports project dependencies, optional dependency arrays, dependency-groups arrays, and Poetry dependency sections. Requirements includes/options and URL/local specs are unsupported. Use explicit names for complex manifests. Use simple commands: flags with separate values or trailing prose can be interpreted as packages; review extraction. Versions are stripped.

404s can become stale. Similarity has false positives; legitimate packages have install hooks. OSV coverage is incomplete. PyPI lacks npm-style script metadata. No source, wheels, transitive dependencies or account ownership are inspected. Never grant agents automatic install permission based on these signals.
