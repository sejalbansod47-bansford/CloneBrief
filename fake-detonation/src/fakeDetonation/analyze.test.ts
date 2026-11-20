import { describe, expect, it } from 'vitest'
import { analyze, buildReplay, shellLines } from './analyze'
import { parseGitHubUrl } from './snapshot'
import { SAMPLES } from './samples'

const sample = (id: string) => SAMPLES.find((s) => s.id === id)!.snapshot

describe('analyze', () => {
  it('flags postinstall, folderOpen task and curl | bash', () => {
    const f = analyze(sample('postinstall'))
    expect(f.find((x) => x.evidence === 'package.json → scripts.postinstall')?.severity).toBe('pause')
    expect(f.find((x) => x.phase === 'open')?.severity).toBe('danger')
    expect(f.find((x) => x.command.startsWith('curl'))?.severity).toBe('danger')
  })

  it('flags agent instructions and MCP servers', () => {
    const f = analyze(sample('agent'))
    expect(f.some((x) => x.phase === 'agent' && x.command.includes('| python3') && x.severity === 'danger')).toBe(true)
    expect(f.some((x) => x.evidence.includes('mcpServers.helper'))).toBe(true)
    expect(f.some((x) => x.evidence === 'setup.py')).toBe(true)
  })

  it('keeps the boring repo calm', () => {
    const r = buildReplay(sample('boring'))
    expect(r.summary).toEqual({ danger: 0, pause: 0 })
    expect(r.lines[0]).toMatchObject({ kind: 'phase', phase: 'clone' })
  })

  it('uses ecosystem-specific stage commands', () => {
    const py = buildReplay(sample('agent')).lines.filter((l) => l.kind === 'cmd').map((l) => l.text)
    expect(py).toContain('pip install -r requirements.txt')
    expect(py).toContain('python train.py')
    expect(py.some((t) => t.startsWith('npm'))).toBe(false)
    const node = buildReplay(sample('postinstall')).lines.filter((l) => l.kind === 'cmd').map((l) => l.text)
    expect(node.filter((t) => t === 'npm install')).toHaveLength(1)
    expect(node.some((t) => t.startsWith('pip'))).toBe(false)
  })

  it('reads commands from fenced and inline markdown', () => {
    expect(shellLines('run `npm i foo` then\n```\n$ curl x | sh\ngit clone y\n```').map((c) => c.cmd)).toEqual(['npm i foo', 'curl x | sh'])
  })

  it('parses GitHub URLs', () => {
    expect(parseGitHubUrl('https://github.com/a/b.git')).toEqual({ owner: 'a', repo: 'b' })
    expect(parseGitHubUrl('github.com/a/b/tree/main')).toEqual({ owner: 'a', repo: 'b' })
    expect(parseGitHubUrl('a/b')).toEqual({ owner: 'a', repo: 'b' })
    expect(parseGitHubUrl('https://evil.example/a/b')).toBeNull()
  })
})
