export type Ecosystem = 'npm' | 'pypi';
export type Input = { ecosystem?: Ecosystem | 'auto'; packages?: string[]; manifest?: string };
export type Package = { name: string; ecosystem: Ecosystem };
export function cleanName(value: string, ecosystem: Ecosystem): string {
  const name = value.trim().replace(/^['"]|['",;]$/g, '');
  const match = ecosystem === 'npm' ? name.match(/^(@[a-z0-9._-]+\/[a-z0-9._-]+|[a-z0-9._-]+)/i) : name.match(/^[a-z0-9][a-z0-9._-]*/i);
  if (!match || /^(https?:|git\+|file:|workspace:)/i.test(name)) throw new Error(`Unsupported package specifier: ${value}`);
  return match[0].toLowerCase();
}
export function parseInput(input: Input): Package[] {
  const out: Package[] = [];
  const add = (name: string, ecosystem: Ecosystem) => out.push({name: cleanName(name, ecosystem), ecosystem});
  const eco = input.ecosystem === 'auto' ? undefined : input.ecosystem;
  if (input.packages?.length && !eco) throw new Error('Explicit packages require an ecosystem');
  input.packages?.forEach(n => add(n, eco!));
  const raw = input.manifest?.trim();
  if (raw) {
    let packageJson: Record<string, any> | undefined;
    try {
      const json = JSON.parse(raw);
      if (json && typeof json === 'object' && ['dependencies','devDependencies','optionalDependencies','peerDependencies'].some(field => field in json)) packageJson = json;
    } catch {}
    let commands = false;
    for (const line of packageJson ? [] : raw.split('\n')) {
      const m = line.match(/\b(npm\s+(?:i|install|add)|yarn\s+add|pnpm\s+add|npx|pip3?\s+install|uv\s+add|poetry\s+add)\s+([^`\n]+)/);
      if (!m) continue;
      commands = true;
      const ecosystem: Ecosystem = /^(pip|uv|poetry)/.test(m[1]) ? 'pypi' : 'npm';
      for (const token of m[2].split(/\s+/)) {
        if (/^(?:&&|\||;|#)/.test(token)) break;
        if (!token || token.startsWith('-')) continue;
        if (/^[`]/.test(token)) break;
        add(token, ecosystem);
      }
    }
    if (!commands) {
      if (!eco && !packageJson) throw new Error('Manifest requires ecosystem, or install commands for auto detection');
      if (packageJson || eco === 'npm') {
        const json = packageJson ?? JSON.parse(raw);
        for (const field of ['dependencies','devDependencies','optionalDependencies','peerDependencies']) {
          if (json[field]) Object.entries(json[field]).forEach(([name, specifier]) => {
            add(typeof specifier === 'string' && specifier.startsWith('npm:') ? specifier.slice(4) : name, 'npm');
          });
        }
      } else if (/^\s*\[/m.test(raw)) {
        let section = '', collecting = false;
        for (const line of raw.split('\n')) {
          const header = line.match(/^\s*\[([^\]]+)\]/);
          if (header) { section = header[1]; collecting = false; continue; }
          if (section === 'project' || section === 'project.optional-dependencies' || section === 'dependency-groups') {
            if (/^\s*(?:dependencies|[\w-]+)\s*=\s*\[/.test(line) && (section !== 'project' || /^\s*dependencies\s*=/.test(line))) collecting = true;
            if (collecting) {
              for (const m of line.matchAll(/"(?:\\.|[^"\\])*"|'[^']*'|\]/g)) {
                if (m[0] === ']') { collecting = false; break; }
                add(m[0].slice(1,-1), 'pypi');
              }
            }
          } else if (/^tool\.poetry\.(?:dependencies|group\..+\.dependencies)$/.test(section)) {
            const m = line.match(/^\s*([\w.-]+)\s*=/); if (m && m[1] !== 'python') add(m[1], 'pypi');
          }
        }
      } else {
        for (const line of raw.split('\n')) { const s = line.trim(); if (s && !s.startsWith('#')) { if (s.startsWith('-')) throw new Error('Requirements options/includes are not supported'); add(s, 'pypi'); } }
      }
    }
  }
  const unique = [...new Map(out.map(p => [`${p.ecosystem}:${p.name}`,p])).values()];
  if (unique.length > 50) throw new Error('Maximum 50 packages');
  return unique;
}
