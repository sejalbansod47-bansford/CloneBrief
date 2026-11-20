import { useEffect, useMemo, useRef, useState } from 'react'
import { buildReplay } from './analyze'
import type { Phase, Replay, ReplayLine, RepoSnapshot, Severity } from './types'

// Sejal palette
const C = { wine: '#68002C', powder: '#A6C9DD', terra: '#E098AC', blush: '#FFF8D5' }

const PHASE_LABEL: Record<Phase, string> = { clone: 'Clone', open: 'Open', agent: 'Agent', install: 'Install', run: 'Run' }
const PHASES: Phase[] = ['clone', 'open', 'agent', 'install', 'run']

const sevColor = (s: Severity) => (s === 'danger' ? C.terra : s === 'pause' ? C.powder : '#d4d4d8')
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
  const done = lineIdx >= lines.length

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
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [lineIdx, chars])

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
    <div className={`w-full overflow-hidden rounded-2xl border shadow-xl ${className}`} style={{ borderColor: C.wine, background: '#140910' }}>
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
      <div className="flex gap-1 overflow-x-auto px-3 py-2" style={{ background: '#1e0e17' }}>
        {PHASES.map((p) => {
          const reached = PHASES.indexOf(p) <= PHASES.indexOf(activePhase?.phase ?? 'clone') || done
          const hits = phaseHits(p)
          return (
            <div
              key={p}
              className="flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold transition-all"
              style={{
                background: reached ? (hits ? C.terra : C.powder) : 'transparent',
                color: reached ? '#140910' : '#71717a',
                border: `1px solid ${reached ? 'transparent' : '#3f3f46'}`,
              }}
            >
              {PHASE_LABEL[p]}
              {reached && hits > 0 && <span className="rounded-full bg-black/20 px-1.5">{hits}</span>}
            </div>
          )
        })}
      </div>

      {/* terminal */}
      <div ref={scrollRef} className="h-80 overflow-y-auto px-4 py-3 font-mono text-[13px] leading-relaxed sm:h-96" role="region" aria-label="Simulated commands, never executed" tabIndex={0}>
        {lines.slice(0, lineIdx + 1).map((l, i) => {
          const full = lineText(l)
          const text = i === lineIdx && !done && l.kind === 'cmd' ? full.slice(0, chars) : full
          if (i === lineIdx && done) return null
          if (l.kind === 'phase')
            return (
              <div key={i} className="mt-3 text-xs font-bold uppercase tracking-widest first:mt-0" style={{ color: C.blush }}>
                {text}
              </div>
            )
          if (l.kind === 'cmd')
            return (
              <div key={i} className="break-all" style={{ color: l.severity === 'info' ? '#e4e4e7' : sevColor(l.severity) }}>
                {text}
                {i === lineIdx && !done && <span className="ml-0.5 inline-block w-2 animate-pulse" style={{ background: C.blush }}>&nbsp;</span>}
                {l.evidence && (i < lineIdx || done || chars >= full.length) && (
                  <span className="ml-2 text-[11px] text-zinc-500">← {l.evidence}</span>
                )}
              </div>
            )
          return (
            <div key={i} className="pl-4 text-[12px]" style={{ color: l.severity === 'info' ? '#a1a1aa' : sevColor(l.severity) }}>
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
      <div className="flex flex-wrap items-center gap-2 border-t px-4 py-2 text-xs" style={{ borderColor: '#3f3f46', background: '#1e0e17' }}>
        <button className="rounded-full px-3 py-1 font-semibold" style={{ background: C.terra, color: '#140910' }} onClick={done ? restart : () => setPlaying((p) => !p)}>
          {done ? 'Replay' : playing ? 'Pause' : 'Play'}
        </button>
        <button className="rounded-full px-3 py-1 font-semibold" aria-label="Fast playback" aria-pressed={fast} style={{ background: C.powder, color: '#140910' }} onClick={() => setFast((f) => !f)}>
          {fast ? 'Speed: fast' : 'Speed: 1×'}
        </button>
        <button className="rounded-full px-3 py-1 font-semibold text-zinc-300 ring-1 ring-zinc-600" onClick={restart}>Restart</button>
        <button className="rounded-full px-3 py-1 font-semibold text-zinc-300 ring-1 ring-zinc-600" disabled={done} onClick={() => {
          setPlaying(false)
          if (lines[lineIdx]?.kind === 'cmd' && chars < lineText(lines[lineIdx]).length) setChars(lineText(lines[lineIdx]).length)
          else { setLineIdx((i) => Math.min(i + 1, lines.length)); setChars(0) }
        }}>Step</button>
        <button
          className="rounded-full px-3 py-1 font-semibold text-zinc-300 ring-1 ring-zinc-600"
          onClick={() => {
            setLineIdx(lines.length)
            setPlaying(false)
          }}
        >
          Skip to end
        </button>
        <span className="ml-auto text-zinc-500">Commands are shown as text. Nothing from the repo is executed.</span>
      </div>
    </div>
  )
}
