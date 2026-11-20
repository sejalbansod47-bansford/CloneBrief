import { useEffect, useMemo, useRef, useState } from 'react'
import { buildReplay } from './analyze'
import type { Phase, Replay, ReplayLine, RepoSnapshot, Severity } from './types'

// Sejal palette
const C = { wine: '#68002C', powder: '#A6C9DD', terra: '#E098AC', blush: '#FFF8D5' }

const PHASE_LABEL: Record<Phase, string> = { clone: 'Clone', open: 'Open', agent: 'Agent', install: 'Install', run: 'Run' }
const PHASES: Phase[] = ['clone', 'open', 'agent', 'install', 'run']

const sevColor = (s: Severity) => (s === 'danger' ? C.terra : s === 'pause' ? C.powder : C.blush)
const sevTag = (s: Severity) => (s === 'danger' ? '[DANGER]' : s === 'pause' ? '[PAUSE]' : '')

interface Props {
  /** Pass a snapshot (from fetchSnapshot or SAMPLES) or a prebuilt replay. */
  snapshot?: RepoSnapshot
  replay?: Replay
  /** Characters typed per second. */
  speed?: number
  autoPlay?: boolean
  className?: string
}

function lineText(l: ReplayLine) {
  if (l.kind === 'phase') return `── ${l.text} ──`
  if (l.kind === 'cmd') return `$ ${l.text}`
  return `${sevTag(l.severity) ? sevTag(l.severity) + ' ' : ''}${l.text}`
}

export function FakeDetonation({ snapshot, replay: given, speed = 90, autoPlay = true, className = '' }: Props) {
  const replay = useMemo(() => given ?? (snapshot ? buildReplay(snapshot) : undefined), [given, snapshot])
  const [lineIdx, setLineIdx] = useState(0)
  const [chars, setChars] = useState(0)
  const [playing, setPlaying] = useState(autoPlay)
  const [fast, setFast] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    setLineIdx(reducedMotion ? replay?.lines.length ?? 0 : 0)
    setChars(0)
    setPlaying(autoPlay && !reducedMotion)
  }, [replay, autoPlay, reducedMotion])

  const lines = replay?.lines ?? []
  const done = reducedMotion || lineIdx >= lines.length
  const visibleIndex = reducedMotion ? lines.length : lineIdx

  useEffect(() => {
    if (!playing || done) return
    const current = lines[lineIdx]
    const full = lineText(current).length
    const typed = current.kind === 'cmd'
    if (!typed || chars >= full) {
      const pause = current.kind === 'phase' ? 500 : current.kind === 'say' ? 650 : 350
      const t = setTimeout(() => {
        setLineIdx((i) => i + 1)
        setChars(0)
      }, fast ? 60 : pause)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setChars((c) => Math.min(full, c + (fast ? 8 : 1))), 1000 / speed)
    return () => clearTimeout(t)
  }, [playing, done, lineIdx, chars, lines, speed, fast])

  useEffect(() => {
    if (!reducedMotion) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [lineIdx, reducedMotion])

  if (!replay) return null

  const activePhase = [...lines.slice(0, Math.min(lineIdx + 1, lines.length))].reverse().find((l) => l.kind === 'phase') as
    | Extract<ReplayLine, { kind: 'phase' }>
    | undefined
  const phaseHits = (p: Phase) => replay.findings.filter((f) => f.phase === p && f.severity !== 'info').length

  const restart = () => {
    setLineIdx(0)
    setChars(0)
    setPlaying(true)
  }

  return (
    <div className={`w-full overflow-hidden rounded-2xl border shadow-xl ${className}`} style={{ borderColor: C.wine, background: C.wine }}>
      {/* title bar */}
      <div className="flex items-center gap-2 px-4 py-2 text-xs font-semibold" style={{ background: C.wine, color: C.blush }}>
        <span className="h-3 w-3 rounded-full" style={{ background: C.terra }} />
        <span className="h-3 w-3 rounded-full" style={{ background: C.blush }} />
        <span className="h-3 w-3 rounded-full" style={{ background: C.powder }} />
        <span className="ml-2 truncate font-mono">Execution preview · {replay.repo}</span>
        <span className="ml-auto rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider" style={{ background: C.blush, color: C.wine }}>
          Simulation · nothing runs
        </span>
      </div>

      {/* phase stepper */}
      <div className="flex gap-1 overflow-x-auto px-3 py-2" style={{ background: C.wine }}>
        {PHASES.map((p) => {
          const reached = PHASES.indexOf(p) <= PHASES.indexOf(activePhase?.phase ?? 'clone') || done
          const hits = phaseHits(p)
          return (
            <div
              key={p}
              className="flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                background: reached ? (hits ? C.terra : C.powder) : 'transparent',
                color: reached ? C.wine : C.blush,
                border: `1px solid ${reached ? 'transparent' : C.powder}`,
              }}
            >
              {PHASE_LABEL[p]}
              {reached && hits > 0 && <span className="rounded-full px-1.5">{hits}</span>}
            </div>
          )
        })}
      </div>

      {/* terminal */}
      <p className="sr-only" role="status">{done ? lines.map(lineText).join('\n') || 'No replay lines.' : 'Replay in progress. Pause or skip to end to read the full text.'}</p>
      <div ref={scrollRef} role="region" tabIndex={0} aria-label="Simulated commands, never executed" className="h-80 overflow-y-auto px-4 py-3 font-mono text-[13px] leading-relaxed sm:h-96">
        {lines.slice(0, visibleIndex + 1).map((l, i) => {
          const full = lineText(l)
          const text = i === lineIdx && !done && l.kind === 'cmd' ? full.slice(0, chars) : full
          if (l.kind === 'phase')
            return (
              <div key={i} className="mt-3 text-xs font-bold uppercase tracking-widest first:mt-0" style={{ color: C.blush }}>
                {text}
              </div>
            )
          if (l.kind === 'cmd')
            return (
              <div key={i} className="break-all" style={{ color: sevColor(l.severity) }}>
                <span className="replay-command" style={{ display: 'inline-grid', maxWidth: '100%', verticalAlign: 'top' }}><span className="replay-reserved" aria-hidden="true" style={{ gridArea: '1 / 1', visibility: 'hidden', overflowWrap: 'anywhere', minWidth: 0 }}>{full}</span><span className="replay-typed" aria-hidden="true" style={{ gridArea: '1 / 1', overflowWrap: 'anywhere', minWidth: 0 }}>{text}</span><span className="sr-only">{full}</span></span>
                {l.evidence && <span className="ml-2 text-[11px]" style={{ color: C.powder }}>← {l.evidence}</span>}
              </div>
            )
          return (
            <div key={i} className="pl-4 text-[12px]" style={{ color: sevColor(l.severity) }}>
              {text}
            </div>
          )
        })}
        {done && (
          <div className="mt-4 rounded-lg p-3 text-[12px]" style={{ background: C.blush, color: C.wine }}>
            <b>
              {replay.summary.danger} danger · {replay.summary.pause} pause
            </b>
            {' — '}Signals, not a guarantee. Clone copies files. Install, open, and agent-run can execute code.
          </div>
        )}
      </div>

      {/* controls */}
      <div className="flex flex-wrap items-center gap-2 border-t px-4 py-2 text-xs" style={{ borderColor: C.powder, background: C.wine }}>
        <button disabled={reducedMotion} className="rounded-full px-3 py-1 font-semibold" style={{ background: C.terra, color: C.wine }} onClick={done ? restart : () => setPlaying((p) => !p)}>
          {done ? 'Replay' : playing ? 'Pause' : 'Play'}
        </button>
        <button disabled={reducedMotion} className="rounded-full px-3 py-1 font-semibold" style={{ background: C.powder, color: C.wine }} onClick={() => setFast((f) => !f)}>
          {fast ? '1x' : 'Fast'}
        </button>
        <button
          className="rounded-full px-3 py-1 font-semibold text-[#FFF8D5] ring-1 ring-[#A6C9DD]"
          onClick={() => {
            setLineIdx(lines.length)
            setPlaying(false)
          }}
        >
          Skip to end
        </button>
        <span className="ml-auto text-[#FFF8D5]">Commands are shown as text. Nothing from the repo is executed.</span>
      </div>
    </div>
  )
}
