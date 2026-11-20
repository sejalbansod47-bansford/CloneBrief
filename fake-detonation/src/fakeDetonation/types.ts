export type Phase = 'clone' | 'open' | 'agent' | 'install' | 'run'

export type Severity = 'info' | 'pause' | 'danger'

/** Everything the analyzer needs. Built from the GitHub API or from a static sample. */
export interface RepoSnapshot {
  owner: string
  repo: string
  defaultBranch: string
  /** Every file path in the default branch tree. */
  paths: string[]
  /** Text of the few files we read. Never executed, only parsed as text. */
  files: Record<string, string>
  createdAt?: string
  ownerCreatedAt?: string
  stars?: number
  truncated?: boolean
}

export interface Finding {
  phase: Phase
  severity: Severity
  /** The command or config exactly as it appears in the repo (display only). */
  command: string
  /** One plain-English sentence: what would happen. */
  why: string
  /** Where it came from: file path, optionally with a line number or key. */
  evidence: string
}

export type ReplayLine =
  | { kind: 'phase'; phase: Phase; text: string }
  | { kind: 'cmd'; text: string; severity: Severity; evidence?: string }
  | { kind: 'say'; text: string; severity: Severity }

export interface Replay {
  repo: string
  findings: Finding[]
  lines: ReplayLine[]
  summary: { danger: number; pause: number }
}
