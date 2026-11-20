import type { Finding, Phase, Replay, ReplayLine, RepoSnapshot, Severity } from './types'

const MAX_CMD = 160

const clip = (s: string) => {
  const one = s.replace(/\s+/g, ' ').trim()
  return one.length > MAX_CMD ? one.slice(0, MAX_CMD - 1) + '…' : one
}

const base = (p: string) => p.split('/').pop()!.toLowerCase()

/** Patterns that make an otherwise boring command scary. */
const DANGER_PATTERNS: [RegExp, string][] = [
  [/\b(curl|wget|iwr|invoke-webrequest)\b[^|;&]*\|\s*(sudo\s+)?(ba|z|da)?sh\b/i, 'downloads a script and runs it straight away'],
  [/\b(curl|wget)\b[^|;&]*\|\s*(sudo\s+)?(python3?|node|perl|ruby)\b/i, 'downloads code and pipes it into an interpreter'],
  [/\b(iex|invoke-expression)\b/i, 'runs downloaded PowerShell'],
  [/powershell[^\n]*-e(nc|ncodedcommand)?\s/i, 'runs a hidden, encoded PowerShell command'],
  [/base64\s+(-d|--decode)|atob\(|Buffer\.from\([^)]*base64/i, 'decodes hidden text and likely runs it'],
  [/\beval\b|node\s+-e\b|python3?\s+-c\b/i, 'runs inline code you cannot easily read'],
  [/\.ssh|id_rsa|\.aws\/credentials|\.npmrc|\.env\b|GITHUB_TOKEN|NPM_TOKEN|process\.env/i, 'touches secrets or tokens on your machine'],
  [/https?:\/\/(\d{1,3}\.){3}\d{1,3}|discord(app)?\.com\/api\/webhooks|ngrok|pastebin|transfer\.sh/i, 'talks to a raw IP, webhook or paste site'],
  [/\bsudo\b|chmod\s+\+x|\/etc\/|crontab|launchctl|systemctl/i, 'asks for admin rights or sets up persistence'],
]

function judge(cmd: string, fallback: Severity, fallbackWhy: string): { severity: Severity; why: string } {
  for (const [re, why] of DANGER_PATTERNS) if (re.test(cmd)) return { severity: 'danger', why: `This ${why}.` }
  return { severity: fallback, why: fallbackWhy }
}

/** Strips JSONC comments and trailing commas outside string literals. */
export function stripJsonc(text: string): string {
  let out = ''
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      let j = i + 1
      while (j < text.length && text[j] !== '"') j += text[j] === '\\' ? 2 : 1
      out += text.slice(i, j + 1)
      i = j
    } else if (ch === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++
      out += '\n'
    } else if (ch === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2)
      i = end === -1 ? text.length : end + 1
    } else if (ch === ',') {
      let j = i + 1
      for (;;) {
        while (j < text.length && /\s/.test(text[j])) j++
        if (text.startsWith('//', j)) while (j < text.length && text[j] !== '\n') j++
        else if (text.startsWith('/*', j)) j = text.indexOf('*/', j + 2) === -1 ? text.length : text.indexOf('*/', j + 2) + 2
        else break
      }
      if (text[j] !== '}' && text[j] !== ']') out += ch
    } else out += ch
  }
  return out
}

function safeJson(text: string | undefined): any {
  if (!text) return undefined
  try {
    return JSON.parse(stripJsonc(text))
  } catch {
    return undefined
  }
}

const SHELL_LINE = /^\s*(?:\$\s*)?((?:sudo\s+)?(?:curl|wget|npm|npx|pnpm|yarn|bun|bunx|pip3?|pipx|uv|python3?|node|bash|sh|make|docker|iwr|powershell|git)\b.*)$/i

/** Shell-looking lines in markdown code blocks (README, AGENTS.md, SKILL.md...). */
export function shellLines(md: string): { line: number; cmd: string }[] {
  const out: { line: number; cmd: string }[] = []
  let inFence = false
  md.split('\n').forEach((raw, i) => {
    if (/^\s*```/.test(raw)) {
      inFence = !inFence
      return
    }
    const inline = !inFence ? raw.match(/`([^`]+)`/g)?.map((s) => s.slice(1, -1)) ?? [] : [raw]
    for (const candidate of inline) {
      const m = candidate.match(SHELL_LINE)
      if (m && !/^git\s+(clone|status|log|diff|add|commit|push|pull|checkout)\b/i.test(m[1])) out.push({ line: i + 1, cmd: m[1].trim() })
    }
  })
  return out
}

const INSTALL_HOOKS = ['preinstall', 'install', 'postinstall', 'prepare']
const RUN_SCRIPTS = ['start', 'dev', 'serve']

const AGENT_FILES = ['agents.md', 'claude.md', 'gemini.md', '.cursorrules', '.windsurfrules', 'copilot-instructions.md', 'skill.md']

export function findAgentFiles(paths: string[]): string[] {
  return paths.filter((p) => {
    const b = base(p)
    const shallow = !p.includes('/') || /^\.(github|cursor|claude)\//i.test(p)
    return (shallow && AGENT_FILES.includes(b)) || /(^|\/)\.cursor\/rules\//i.test(p) || /(^|\/)\.claude\/(commands|skills|agents)\//i.test(p)
  })
}

/** Paths whose text the analyzer wants to read. The fetch layer uses this. */
export function interestingPaths(paths: string[]): string[] {
  const want = new Set<string>()
  const readme = paths.find((p) => /^readme(\.md|\.markdown|\.txt)?$/i.test(p))
  if (readme) want.add(readme)
  for (const p of paths) {
    const b = base(p)
    if (p === 'package.json' || p === 'setup.py' || p === 'pyproject.toml' || p === 'Makefile') want.add(p)
    if (/^\.vscode\/tasks\.json$/i.test(p) || /^\.devcontainer(\/[^/]+)?\/devcontainer\.json$|^\.devcontainer\.json$/i.test(p)) want.add(p)
    if (b === '.mcp.json' || /^\.(cursor|vscode)\/mcp\.json$/i.test(p)) want.add(p)
  }
  findAgentFiles(paths).slice(0, 6).forEach((p) => want.add(p))
  return [...want].slice(0, 14)
}

export function analyze(snap: RepoSnapshot): Finding[] {
  const f: Finding[] = []
  const seen = new Set<string>()
  const add = (phase: Phase, command: string, evidence: string, fallback: Severity, why: string) => {
    const key = phase + '|' + command.replace(/\s+/g, ' ').trim()
    if (seen.has(key)) return
    seen.add(key)
    const j = judge(command, fallback, why)
    f.push({ phase, command: clip(command), evidence, severity: j.severity, why: j.why })
  }
  const files = snap.files

  // OPEN: editor and devcontainer auto-run
  const tasks = safeJson(files['.vscode/tasks.json'])
  for (const t of tasks?.tasks ?? []) {
    const cmd = [t.command, ...(t.args ?? [])].filter(Boolean).join(' ')
    if (t?.runOptions?.runOn === 'folderOpen' && cmd)
      add('open', cmd, `.vscode/tasks.json → "${t.label ?? 'task'}" runOn: folderOpen`, 'pause', 'Runs the moment you open the folder in VS Code or Cursor, if Workspace Trust is off or you click Trust.')
  }
  for (const p of Object.keys(files).filter((p) => /devcontainer\.json$/i.test(p))) {
    const dc = safeJson(files[p])
    for (const key of ['initializeCommand', 'onCreateCommand', 'postCreateCommand', 'postStartCommand', 'postAttachCommand']) {
      const v = dc?.[key]
      if (!v) continue
      const cmd = typeof v === 'string' ? v : Array.isArray(v) ? v.join(' ') : Object.values(v).map((c) => (Array.isArray(c) ? c.join(' ') : String(c))).join(' && ')
      add('open', cmd, `${p} → ${key}`, 'pause', key === 'initializeCommand' ? 'Runs on your own machine (not the container) when you reopen in a dev container.' : 'Runs when the dev container starts.')
    }
  }

  // AGENT: instruction files and MCP servers
  for (const p of Object.keys(files).filter((p) => base(p).endsWith('mcp.json'))) {
    const servers = safeJson(files[p])?.mcpServers ?? safeJson(files[p])?.servers ?? {}
    for (const [name, s] of Object.entries<any>(servers)) {
      const cmd = [s?.command, ...(s?.args ?? [])].filter(Boolean).join(' ') || s?.url
      if (cmd) add('agent', cmd, `${p} → mcpServers.${name}`, 'pause', 'Your coding agent starts this as a tool server with your user rights when it loads the project.')
    }
  }
  for (const p of findAgentFiles(snap.paths)) {
    const text = files[p]
    const cmds = text ? shellLines(text) : []
    if (!cmds.length) {
      f.push({ phase: 'agent', severity: 'info', command: `cat ${p}`, evidence: p, why: 'Agents read this file as instructions. Check what it tells them to do.' })
    }
    for (const c of cmds.slice(0, 4)) add('agent', c.cmd, `${p}:${c.line}`, 'info', 'An agent following this file would run this command for you, often without asking.')
  }

  // INSTALL: lifecycle hooks
  const pkg = safeJson(files['package.json'])
  for (const hook of INSTALL_HOOKS) {
    const cmd = pkg?.scripts?.[hook]
    if (cmd) add('install', cmd, `package.json → scripts.${hook}`, 'pause', `npm runs "${hook}" automatically on npm install, before you have read any code.`)
  }
  if (files['setup.py'] !== undefined)
    add('install', 'python setup.py (via pip install .)', 'setup.py', 'pause', 'pip runs setup.py as normal Python code when you install this folder.')
  const pyBackend = files['pyproject.toml']?.match(/build-backend\s*=\s*"([^"]+)"/)?.[1]
  if (pyBackend && !/^(setuptools|hatchling|poetry|flit_core|pdm|maturin|scikit_build_core)/.test(pyBackend))
    add('install', `build-backend = "${pyBackend}"`, 'pyproject.toml', 'pause', 'An unusual build backend runs custom code during pip install.')

  // README: install / run commands people copy-paste
  const readme = Object.keys(files).find((p) => /^readme/i.test(p))
  for (const c of readme ? shellLines(files[readme]).slice(0, 8) : []) {
    const isRun = /^(npm\s+(run\s+)?(start|dev)|yarn\s+(start|dev)|pnpm\s+(start|dev)|node\s|python3?\s+(?!-m\s+pip)\S+\.py|make\b|docker\s+run|bun\s+(run\s+)?(start|dev))/i.test(c.cmd)
    const isInstall = /\b(install|add|i)\b|curl|wget|iwr/i.test(c.cmd)
    if (!isRun && !isInstall) continue
    add(isRun ? 'run' : 'install', c.cmd, `${readme}:${c.line}`, 'info', isRun ? 'The README tells you to start this. It runs with your user rights.' : 'The README tells you to paste this. It runs with your user rights.')
  }

  // RUN: package scripts
  for (const s of RUN_SCRIPTS) {
    const cmd = pkg?.scripts?.[s]
    if (cmd) add('run', cmd, `package.json → scripts.${s}`, 'info', `"npm run ${s}" runs this.`)
  }

  return f
}

const PHASES: { phase: Phase; title: string }[] = [
  { phase: 'clone', title: 'CLONE' },
  { phase: 'open', title: 'OPEN in editor' },
  { phase: 'agent', title: 'AGENT reads the repo' },
  { phase: 'install', title: 'INSTALL' },
  { phase: 'run', title: 'RUN' },
]

/** What a student would type at each stage, based on the repo's ecosystem. */
export function stagePrompts(snap: RepoSnapshot, findings: Finding[]): Record<Phase, string[]> {
  const has = (p: string) => snap.paths.includes(p)
  const node = has('package.json')
  const py = has('requirements.txt') || has('setup.py') || has('pyproject.toml')
  const install: string[] = []
  if (node) install.push('npm install')
  if (has('requirements.txt')) install.push('pip install -r requirements.txt')
  else if (py) install.push('pip install .')
  const scripts = safeJson(snap.files['package.json'])?.scripts ?? {}
  const run = findings.some((x) => x.phase === 'run')
    ? []
    : node && scripts.start
      ? ['npm start']
      : node && scripts.dev
        ? ['npm run dev']
        : []
  return { clone: [`git clone https://github.com/${snap.owner}/${snap.repo}`], open: ['code .'], agent: ['agent "set this project up"'], install, run }
}

const NOTHING: Record<Phase, string> = {
  clone: '',
  open: 'Nothing found that auto-runs on open. That is not a guarantee.',
  agent: 'No agent instructions or MCP servers found. That is not a guarantee.',
  install: 'No install step found. That is not a guarantee.',
  run: 'No run command found.',
}

export function buildReplay(snap: RepoSnapshot, findings = analyze(snap)): Replay {
  const name = `${snap.owner}/${snap.repo}`
  const prompts = stagePrompts(snap, findings)
  const lines: ReplayLine[] = []
  for (const { phase, title } of PHASES) {
    lines.push({ kind: 'phase', phase, text: title })
    const here = findings.filter((x) => x.phase === phase)
    for (const p of prompts[phase]) if (!here.some((x) => x.command === p)) lines.push({ kind: 'cmd', text: p, severity: 'info' })
    if (phase === 'clone') {
      lines.push({ kind: 'say', text: `${snap.paths.length} file paths listed. This is a text preview — nothing was cloned or executed.`, severity: 'info' })
      if (snap.unread?.length)
        lines.push({ kind: 'say', text: `Could not read ${snap.unread.join(', ')}. Results below may be incomplete.`, severity: 'pause' })
      if (snap.truncated) lines.push({ kind: 'say', text: 'Repo is too big to list fully. Results below may be incomplete.', severity: 'pause' })
      continue
    }
    if (!here.length) {
      lines.push({ kind: 'say', text: NOTHING[phase], severity: 'info' })
      continue
    }
    for (const x of here) {
      lines.push({ kind: 'cmd', text: x.command, severity: x.severity, evidence: x.evidence })
      lines.push({ kind: 'say', text: x.why, severity: x.severity })
    }
  }
  return {
    repo: name,
    findings,
    lines,
    summary: {
      danger: findings.filter((x) => x.severity === 'danger').length,
      pause: findings.filter((x) => x.severity === 'pause').length,
    },
  }
}
