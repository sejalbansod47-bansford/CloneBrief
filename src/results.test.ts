import { describe, expect, it } from 'vitest'
import { packageHeadline } from './results'

describe('package result headlines', () => {
  it('does not hide version-specific advisories behind a no-issues headline', () => {
    expect(packageHeadline({ verdict: 'no_flags', signals: [{ type: 'vulnerability_count' }] })).toBe('advisories found · review affected versions')
  })
  it('retains the stronger blocked and pause verdicts', () => {
    for (const [verdict, expected] of [['do_not_install', 'do not install'], ['pause', 'pause + check']]) {
      expect(packageHeadline({ verdict, signals: [{ type: 'vulnerability_count' }] })).toBe(expected)
    }
  })
  it('limits an empty result claim to the checks performed', () => {
    expect(packageHeadline({ verdict: 'no_flags', signals: [] })).toBe('no signals found in these limited checks')
  })
})
