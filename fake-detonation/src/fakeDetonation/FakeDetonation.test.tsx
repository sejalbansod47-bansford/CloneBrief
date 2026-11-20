import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { FakeDetonation } from './FakeDetonation'
import { buildReplay } from './analyze'
import { SAMPLES } from './samples'

afterEach(() => vi.unstubAllGlobals())

function render(reduced: boolean, empty = false) {
  vi.stubGlobal('matchMedia', () => ({ matches: reduced }))
  const replay = buildReplay(SAMPLES[0].snapshot)
  if (empty) replay.lines = []
  return renderToStaticMarkup(<FakeDetonation replay={replay} />)
}

describe('replay accessibility', () => {
  it('offers a keyboard-readable transcript while playing', () => {
    const html = render(false)
    expect(html).toContain('tabindex="0"')
    expect(html).toContain('Replay in progress.')
  })
  it('renders all commands and the final announcement immediately with reduced motion', () => {
    const html = render(true)
    expect(html).not.toContain('Replay in progress.')
    expect(html).toContain('replay-reserved')
    expect(html).toContain('role="status"')
    expect(html).toContain('Signals, not a guarantee.')
  })
  it('announces an empty replay', () => {
    expect(render(true, true)).toContain('No replay lines.')
  })
  it('hides and overlays reserved command space without host styles', () => {
    const html = render(true)
    expect(html).toContain('display:inline-grid')
    expect(html).toContain('grid-area:1 / 1;visibility:hidden')
    expect(html).toContain('class="replay-typed" aria-hidden="true" style="grid-area:1 / 1;')
  })
})
