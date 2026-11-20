export type Ecosystem = 'npm' | 'pypi';
export type Input = { ecosystem?: Ecosystem | 'auto'; packages?: string[]; manifest?: string };
export type Package = { name: string; ecosystem: Ecosystem };
function stripComment(line: string): string {
  let quote = '';
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quote === '"' && char === '\\') { i++; continue; }
    if (quote) { if (char === quote) quote = ''; }
    else if (char === '"' || char === "'") quote = char;
    else if (char === '#') return line.slice(0,i);
  }
  return line;
}
export function cleanName(value: string, ecosystem: Ecosystem): string {
  const name = value.trim().replace(/^['"`(]+|['"`,;:.!?)]+$/g, '');
  const match = ecosystem === 'npm' ? name.match(/^(@[a-z0-9._-]+\/[a-z0-9._-]+|[a-z0-9._-]+)/i) : name.match(/^[a-z0-9][a-z0-9._-]*/i);
  if (!match || /^(https?:|git\+|file:|workspace:)/i.test(name)) throw new Error(`Unsupported package specifier: ${value}`);
  return match[0].toLowerCase();
}
const DEP_FIELDS = ['dependencies','devDependencies','optionalDependencies','peerDependencies'];
const PYPI_LINE = /^[a-z0-9][\w.-]*\s*(\[[^\]]*\])?\s*(?:[<>=!~].*|;.*|@.*)?$/i;
const NPM_LINE = /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+(?:@\S*)?$/i;
const COMMAND = String.raw`npm\s+(?:i|install|add)|yarn\s+add|pnpm\s+(?:add|i|install)|bun\s+(?:add|i|install)|npx|pip3?\s+install|uv\s+(?:add|pip\s+install)|poetry\s+add`;
const STOP_WORDS = new Set(['and','or','then','to','if']);
const DIRECT_SOURCE = /@\s*(?:https?:|git\+|git:|github:|file:)/i;
const npmTarget = (spec: string) => { const bare = spec.replace(/^['"`(]+/, ''); return (bare.match(/@npm:(.+)$/)?.[1] ?? bare).replace(/(.)@.*$/, '$1'); };
const VERSION_SPEC = /^(?:npm:|[\^~<>=*]|\d|latest$|next$|workspace:|git|github:|https?:|file:)/;
const NEXT_NAME = /\s*[@a-z0-9]/iy;
function splitTopLevelCommas(line: string): string[] {
  const parts: string[] = [];
  let depth = 0, start = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '[') depth++;
    else if (line[i] === ']') depth = Math.max(0, depth - 1);
    else if (line[i] === ',' && !depth && (NEXT_NAME.lastIndex = i + 1, NEXT_NAME.test(line))) { parts.push(line.slice(start, i)); start = i + 1; }
  }
  return [...parts, line.slice(start)].map(part => part.trim()).filter(Boolean);
}
function readPackageJson(raw: string): Record<string, any> | undefined {
  const parse = (text: string) => { try { const json = JSON.parse(text); return json && typeof json === 'object' && !Array.isArray(json) ? json : undefined; } catch {} };
  const json = parse(raw);
  if (json) return DEP_FIELDS.some(field => field in json) || !Object.values(json).every(v => typeof v === 'string' && VERSION_SPEC.test(v)) ? json : {dependencies: json};
  const fragment = raw.startsWith('{') ? undefined : parse(`{${raw.replace(/,\s*$/, '')}}`);
  if (fragment && DEP_FIELDS.some(field => field in fragment)) return fragment;
  if (fragment && Object.keys(fragment).length && Object.values(fragment).every(v => typeof v === 'string' && VERSION_SPEC.test(v))) return {dependencies: fragment};
}
export function parseInput(input: Input, skipped: string[] = []): Package[] {
  const out: Package[] = [];
  const add = (name: string, ecosystem: Ecosystem) => out.push({name: cleanName(name, ecosystem), ecosystem});
  const tryAdd = (name: string, ecosystem: Ecosystem) => { try { add(name, ecosystem); } catch { skipped.push(name.trim()); } };
  const eco = input.ecosystem === 'auto' ? undefined : input.ecosystem;
  if (input.packages?.length && !eco) throw new Error('Explicit packages require an ecosystem');
  if ((input.packages?.length ?? 0) > 50) throw new Error('Maximum 50 packages');
  input.packages?.forEach(n => add(n, eco!));
  const raw = input.manifest?.replace(/\r/g, '').trim();
  if (raw) {
    const packageJson = eco === 'pypi' ? undefined : readPackageJson(raw);
    let commands = false;
    for (const line of packageJson ? [] : raw.split('\n').flatMap(line => stripComment(line).split(/(?<=[.!?])\s+/))) {
      for (const m of line.matchAll(new RegExp(`\\b(${COMMAND})\\s+((?:(?!\\b(?:${COMMAND})\\s)[^\`\\n])+)`, 'g'))) {
        commands = true;
        const ecosystem: Ecosystem = /^(pip|uv|poetry)/.test(m[1]) ? 'pypi' : 'npm';
        for (const token of m[2].split(/\s+/)) {
          if (/^(?:&&|\||;|#|>)/.test(token) || STOP_WORDS.has(token.toLowerCase())) break;
          if (!token || token.startsWith('-')) continue;
          if (DIRECT_SOURCE.test(token)) skipped.push(token);
          else tryAdd(ecosystem === 'npm' ? npmTarget(token) : token, ecosystem);
          if (m[1] === 'npx' || /[.:!?)]$/.test(token)) break;
        }
      }
    }
    if (!commands) {
      if (packageJson) {
        for (const field of DEP_FIELDS) {
          if (packageJson[field] && typeof packageJson[field] === 'object') Object.entries(packageJson[field]).forEach(([name, specifier]) => {
            tryAdd(typeof specifier === 'string' && specifier.startsWith('npm:') ? specifier.slice(4).replace(/(.)@.*$/, '$1') : name, 'npm');
          });
        }
      } else if (raw.startsWith('{')) {
        throw new Error("That looks like a package.json but it isn't valid JSON. Check for a missing quote or a trailing comma.");
      } else if (eco !== 'npm' && /^\s*\[/m.test(raw)) {
        let section = '', collecting = false;
        for (const line of raw.split('\n').map(stripComment)) {
          const header = line.match(/^\s*\[([^\]]+)\]/);
          if (header) { section = header[1]; collecting = false; continue; }
          if (section === 'project' || section === 'project.optional-dependencies' || section === 'dependency-groups') {
            if (/^\s*(?:dependencies|[\w-]+)\s*=\s*\[/.test(line) && (section !== 'project' || /^\s*dependencies\s*=/.test(line))) collecting = true;
            if (collecting) {
              for (const m of line.matchAll(/"(?:\\.|[^"\\])*"|'[^']*'|\]/g)) {
                if (m[0] === ']') { collecting = false; break; }
                tryAdd(m[0].slice(1,-1), 'pypi');
              }
            }
          } else if (/^tool\.poetry\.(?:dependencies|group\..+\.dependencies)$/.test(section) || section === 'packages' || section === 'dev-packages') {
            const m = line.match(/^\s*([\w.-]+)\s*=/); if (m && m[1] !== 'python') tryAdd(m[1], 'pypi');
          }
        }
      } else {
        const lines = raw.split('\n').map(line => stripComment(line).trim()).filter(Boolean).flatMap(splitTopLevelCommas);
        const looksPypi = lines.some(line => /^-[rcei]\b|^--/.test(line) || /[<>=!~]=|\[[^\]]*\]|;/.test(line));
        const ecosystem = eco ?? (looksPypi ? 'pypi' : undefined);
        if (!ecosystem) throw new Error("Couldn't tell npm from PyPI. Pick one in the dropdown, or paste the install command your chatbot gave you.");
        for (const line of lines) {
          if (line.startsWith('-')) { skipped.push(line); continue; }
          if (!DIRECT_SOURCE.test(line) && (ecosystem === 'pypi' ? PYPI_LINE : NPM_LINE).test(line)) tryAdd(ecosystem === 'npm' ? npmTarget(line) : line, ecosystem);
          else skipped.push(line.length > 60 ? `${line.slice(0, 57)}…` : line);
        }
      }
    }
  }
  return [...new Map(out.map(p => [`${p.ecosystem}:${p.name}`,p])).values()];
}
