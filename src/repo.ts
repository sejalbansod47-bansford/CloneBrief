import { buildReplay } from '../fake-detonation/src/fakeDetonation/analyze'
import { parseInput } from '../package-checker/src/checker/input'
import type { RepoSnapshot } from '../fake-detonation/src/fakeDetonation/types'

export function repoPackageCount(manifest: string | undefined): number | null {
  if (!manifest) return null
  try {
    return parseInput({ manifest, ecosystem: 'npm' }).length
  } catch {
    return null
  }
}

export function createRepoCheck(snapshot: RepoSnapshot, source: string) {
  try {
    return { snapshot, replay: buildReplay(snapshot), source }
  } catch {
    throw new Error('This repo has a malformed setup config. We couldn’t build a replay. Inspect it manually; nothing was executed.')
  }
}
