export type Severity = 'low' | 'medium' | 'high'
export interface Finding { id: string; file: string; line: number; column: number; endLine: number; endColumn: number; kind: string; severity: Severity; title: string; why: string; evidence: string; decoded?: string }
export interface AgentFile { path: string; text: string }
export interface Report { repo?: string; files: (AgentFile & { findings: Finding[] })[]; findings: Finding[]; verdict: 'hidden_instructions_found' | 'review' | 'no_flags'; classifier: 'used' | 'unavailable' | 'skipped'; banner: string }
export const invisible = /[\u00ad\u180e\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff\ufe00-\ufe0f\u{e0000}-\u{e007f}\u{e0100}-\u{e01ef}]/u
export function visible(text: string): string {
  const names: Record<number, string> = { 0x200b: 'ZWSP', 0x200c: 'ZWNJ', 0x200d: 'ZWJ', 0x202e: 'RLO', 0x202d: 'LRO', 0xfeff: 'BOM' }
  return Array.from(text, c => invisible.test(c) ? `[${names[c.codePointAt(0)!] ?? 'U+' + c.codePointAt(0)!.toString(16).toUpperCase()}]` : c).join('')
}
export function scanFile(file: AgentFile): Finding[] {
  const out: Finding[] = [], text = file.text
  const position = (offset: number) => { const lines = text.slice(0, offset).split('\n'); return { line: lines.length, column: Array.from(lines.at(-1)!).length + 1 } }
  const add = (start: number, value: string, kind: string, severity: Severity, why: string, decoded?: string) => {
    const p = position(start), end = position(start + value.length)
    out.push({ id: `${file.path}:${start}:${kind}`, file: file.path, ...p, endLine: end.line, endColumn: end.column, kind, severity, title: kind.replaceAll('-', ' '), why, evidence: visible(value), ...(decoded === undefined ? {} : { decoded }) })
  }
  const matches = (re: RegExp, kind: string, severity: Severity, why: string) => { for (const m of text.matchAll(re)) add(m.index!, m[0], kind, severity, why) }
  for (const m of text.matchAll(/[\u{e0000}-\u{e007f}]+/gu)) add(m.index!, m[0], 'unicode-tags', 'high', 'Hidden ASCII carried in Unicode tags.', Array.from(m[0], c => String.fromCodePoint(c.codePointAt(0)! - 0xe0000)).join(''))
  for (const m of text.matchAll(/[\u200b-\u200f\u2060-\u2064\ufeff\u180e\u00ad]+/gu)) {
    if (m.index === 0 && m[0] === '\ufeff') continue
    const before = Array.from(text.slice(0, m.index)).at(-1) ?? '', after = Array.from(text.slice(m.index! + m[0].length))[0] ?? ''
    add(m.index!, m[0], 'invisible', Array.from(m[0]).length > 1 || (/\p{L}/u.test(before) && /\p{L}/u.test(after)) ? 'high' : 'medium', 'Invisible characters can conceal or split instructions.')
  }
  matches(/[\u202a-\u202e\u2066-\u2069]/gu, 'bidi', 'high', 'Directional controls can reorder displayed text.')
  matches(/[\ufe00-\ufe0f\u{e0100}-\u{e01ef}]{3,}/gu, 'variation-selectors', 'high', 'Long selector runs can carry hidden data.')
  for (const m of text.matchAll(/\p{L}+/gu)) if (/\p{Script=Latin}/u.test(m[0]) && /[\p{Script=Cyrillic}\p{Script=Greek}]/u.test(m[0])) add(m.index!, m[0], 'mixed-script', 'medium', 'Mixed scripts can disguise words.')
  matches(/<!--[\s\S]*?(?:-->|$)|<details\b[^>]*>[\s\S]*?(?:<\/details>|$)|<span\b[^>]*style\s*=\s*["'][^"']*(?:display\s*:\s*none|font-size\s*:\s*0)[^"']*["'][^>]*>[\s\S]*?(?:<\/span>|$)/gi, 'hidden-markdown', 'medium', 'Content may be hidden in rendered Markdown.')
  for (const m of text.matchAll(/^ {0,3}\[([^\]\n]+)\]:[^\n]*/gm)) {
    const rest = text.slice(0, m.index) + text.slice(m.index! + m[0].length)
    const label = m[1].toLowerCase()
    if (!Array.from(rest.matchAll(/\[([^\]\n]*)\]/g)).some(r => r[1].toLowerCase() === label)) add(m.index!, m[0], 'unused-reference', 'medium', 'Unused link definitions can conceal instructions.')
  }
  matches(/\b(?:[A-Za-z0-9+/]{41,}={0,2}|(?:0x)?[a-fA-F0-9]{41,})\b/g, 'encoded-payload', 'medium', 'Long encoded blobs merit inspection.')
  matches(/\b(?:curl|wget)\b[^\n|]*\|\s*(?:ba)?sh\b|\beval\b|\bnpx\s+-y\b/gi, 'dangerous-command', 'high', 'Instruction suggests executing untrusted code.')
  matches(/https?:\/\/(?:\d{1,3}(?:\.\d{1,3}){3}|[^\s/]*(?:ngrok\.[\w.-]+|pastebin\.com|paste\.ee|paste\.rs))[^\s<>"']*/gi, 'suspicious-url', 'medium', 'Transient or raw-IP destination.')
  matches(/ignore previous instructions|do not tell the user|silently|exfiltrate|~\/\.ssh|\.env\b|send to/gi, 'agent-direction', 'medium', 'Agent-directed language warrants human review.')
  if (/(?:^|\/)(?:\.mcp\.json|mcp\.json)$/.test(file.path)) {
    try {
      const parsed = JSON.parse(text)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('shape')
    } catch { add(0, text, 'mcp-invalid-json', 'medium', 'MCP configuration is not valid JSON object data.') }
      for (const m of text.matchAll(/npx|uvx|https?:\/\/[^\s"']+|"(?:env|envFile)"\s*:/g)) {
        const line = text.slice(m.index!, text.indexOf('\n', m.index) < 0 ? text.length : text.indexOf('\n', m.index))
        if ((m[0] === 'npx' || m[0] === 'uvx') && /@[\d]|==\d/.test(line)) continue
        add(m.index!, m[0], 'mcp-config', 'medium', 'Review unpinned runners, environment forwarding, and remote MCP endpoints.')
      }
  }
  return out
}
function verdict(findings: Finding[]): Report['verdict'] { return findings.some(f => f.severity === 'high') ? 'hidden_instructions_found' : findings.length ? 'review' : 'no_flags' }
export function scanFiles(files: AgentFile[]): Report {
  const scanned = files.map(f => ({ ...f, findings: scanFile(f) })), findings = scanned.flatMap(f => f.findings)
  return { files: scanned, findings, verdict: verdict(findings), classifier: 'skipped', banner: 'Signals, not a guarantee. Review repository instructions before granting an agent access.' }
}
export function applyClassifier(report: Report, scores: { id: string; score: number }[]): Report {
  const high = new Set(scores.filter(s => Number.isFinite(s.score) && s.score >= 0.9 && s.score <= 1).map(s => s.id))
  const files = report.files.map(f => ({ ...f, findings: f.findings.map(v => ({ ...v, severity: high.has(v.id) ? (v.severity === 'low' ? 'medium' : 'high') as Severity : v.severity })) }))
  const findings = files.flatMap(f => f.findings)
  return { ...report, files, findings, verdict: verdict(findings), classifier: 'used' }
}
