import { describe, expect, it } from 'vitest'
import { createRepoCheck, repoPackageCount } from './repo'
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

describe('repository package handoff', () => {
  it('does not offer dependency-free or missing manifests as package checks', () => {
    expect(repoPackageCount(SAMPLES[0].snapshot.files['package.json'])).toBe(0)
    expect(repoPackageCount('{"dependencies":{}}')).toBe(0)
    expect(repoPackageCount(undefined)).toBeNull()
  })
  it('uses the same dependency, alias and deduplication rules as the checker', () => {
    const manifest = JSON.stringify({ dependencies: { react: '*', alias: 'npm:react@18' }, devDependencies: { typescript: '*' }, optionalDependencies: { express: '*' }, peerDependencies: { next: '*' } })
    expect(repoPackageCount(manifest)).toBe(4)
  })
  it('leaves malformed or over-limit input for manual review', () => {
    expect(repoPackageCount('{')).toBeNull()
    const dependencies = Object.fromEntries(Array.from({ length: 51 }, (_, index) => [`pkg${index}`, '*']))
    expect(repoPackageCount(JSON.stringify({ dependencies }))).toBeNull()
  })
})
