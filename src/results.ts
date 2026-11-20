export function packageHeadline(result: { verdict: string; signals: { type: string }[] }) {
  if (result.verdict === 'do_not_install') return 'do not install'
  if (result.verdict === 'pause') return 'pause + check'
  if (result.signals.some(signal => signal.type === 'vulnerability_count')) return 'advisories found · review affected versions'
  if (result.signals.length) return 'signals found · review the evidence'
  return 'no signals found in these limited checks'
}
