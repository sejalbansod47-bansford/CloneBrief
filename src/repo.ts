import { buildReplay } from '../fake-detonation/src/fakeDetonation/analyze'
import type { RepoSnapshot } from '../fake-detonation/src/fakeDetonation/types'

export function createRepoCheck(snapshot: RepoSnapshot, source: string) {
  try {
    return { snapshot, replay: buildReplay(snapshot), source }
  } catch {
    throw new Error('This repo has a malformed setup config. We couldn’t build a replay. Inspect it manually; nothing was executed.')
  }
}
