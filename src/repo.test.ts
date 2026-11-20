import { describe, expect, it } from 'vitest'
import { createRepoCheck } from './repo'
import { SAMPLES } from '../fake-detonation/src/fakeDetonation/samples'

describe('repo state preparation', () => {
  it('builds each curated sample before putting it into render state', () => {
    for (const sample of SAMPLES) expect(createRepoCheck(sample.snapshot, 'sample').replay.lines.length).toBeGreaterThan(0)
  })
  it('rejects malformed untrusted config before replacing the current UI state', () => {
    const snapshot = { ...SAMPLES[0].snapshot, files: { '.vscode/tasks.json': '{"tasks":{}}' } }
    expect(() => createRepoCheck(snapshot, 'live')).toThrow('malformed setup config')
  })
})
