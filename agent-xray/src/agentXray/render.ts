import { invisible, visible, type Finding } from './scan.ts'
export interface Segment { text: string; highlighted: boolean; badge: boolean }
export function xraySegments(text: string, findings: Finding[]): Segment[] {
  let line = 1, column = 1
  const result: Segment[] = []
  for (const c of text) {
    const active = findings.filter(f => (line > f.line || line === f.line && column >= f.column) && (line < f.endLine || line === f.endLine && column < f.endColumn))
    const tag = active.find(f => f.kind === 'unicode-tags')
    const badge = invisible.test(c)
    const value = tag ? (line === tag.line && column === tag.column ? `[TAG: ${JSON.stringify(tag.decoded)}]` : '') : visible(c)
    const last = result.at(-1)
    if (!badge && last && !last.badge && last.highlighted === !!active.length) last.text += value
    else if (value) result.push({ text: value, highlighted: !!active.length, badge })
    if (c === '\n') { line++; column = 1 } else column++
  }
  return result
}
