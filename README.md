# CloneBrief · Hack the Trent

A short, visual repo-risk explainer. Public-repo text analysis and live npm/PyPI/OSV package checks, in one Vite + React + Tailwind app. No Supabase account required.

## Run the website

Use Node 22.12+ (verified on 22.23). From the repo root:

```sh
npm ci
npm run build
npm start                 # production UI + API on port 3000
```

For UI development, run `npm run dev:api` and `npm run dev` in separate terminals. Vite proxies `/api` to port 3000. Set `PORT` to change the production port.

```sh
npm test                  # replay, integration and package checker tests
npm run build             # TypeScript + production build
npm audit
```

There are no pre-commit hooks. CI runs the root test and build commands.

## What’s connected

- Repo input → `fetchSnapshot` → `buildReplay` → existing `FakeDetonation` component. Fictional samples work offline; real scans read selected public files through GitHub, never clone or execute them. GitHub’s anonymous rate limit applies per visitor’s IP; retry later or use a sample when limited. Unsupported malformed configs show an error without replacing the current replay.
- Package input → `POST /api/check-packages` → existing `checkPackages`. Only registry metadata and OSV advisories are fetched. The server has a 100 KB body limit, two concurrent checks and a shared 30-check/minute limit. No submitted data is saved. Names are sent to their registry and OSV; repo URLs go to GitHub. Do not paste secrets.
- “Try this instead” only uses `package-checker/allowlist.json`, with attribution and official docs. Registry presence and upstream identity are not security guarantees.

## Moving to Lovable

Copy `src/`, the root public assets, `fake-detonation/src/fakeDetonation/` and `package-checker/` preserving their relative layout, or adapt the imports. The UI uses ordinary React + Tailwind. Theme tokens are at the top of `src/index.css`. Keep the Node API on a host you control and proxy `/api/check-packages` to it, or replace that one fetch with the existing Supabase function after configuring a backend. Never expose server tokens to the browser. `vite preview` alone does **not** serve the package-check API.

The app manifest supports home-screen shortcuts; no service worker is registered. The Devin-hosted app is organization-visible and depends on its managing session; it is not a public judges’ deployment. For public hosting use the same `npm run build` / `npm start` commands on a Node host and add authentication or stronger per-client quotas before opening the API widely.

## Limitations

Selected root setup/config files only, not a recursive dependency or lockfile audit. Private repos and arbitrary archives are not accepted. Missing files, network failures and registry errors are incomplete evidence, never a clean bill of health. Ordinary OSV advisories are informational across versions. See the component READMEs for the full detector and parser limits.

Built at Hack the Trent. Defensive only.
