import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from './App'
import { exposures, features, incidents, stages } from './content'

describe('supply-chain field guide', () => {
  it('keeps source-backed incident accounts separate from submitted-repo findings', () => {
    const markup = renderToStaticMarkup(createElement(App))
    expect(markup).toContain('These are historical examples, not findings about a repository you submit.')
    expect(markup).toContain('CloneBrief does not detect every attack described here.')
    expect(markup).toContain('Your repository is never cloned, installed or run.')
    for (const incident of incidents) {
      expect(markup).toContain(`href="${incident.url}"`)
      expect(incident.entry).not.toBe('')
      expect(incident.observed).not.toBe('')
      expect(incident.boundary).not.toBe('')
      expect(incident.lesson).not.toBe('')
      expect(['www.cisa.gov', 'nx.dev']).toContain(new URL(incident.url).hostname)
      expect(new URL(incident.url).protocol).toBe('https:')
    }
  })
  it('gives each potential consequence a mitigation and a documented related incident', () => {
    for (const exposure of exposures) {
      expect(incidents[exposure.incident]).toBeDefined()
      expect(exposure.pathway).not.toBe('')
      expect(exposure.consequence).not.toBe('')
      expect(exposure.action).not.toBe('')
    }
    expect(stages[0].detail).toContain('does not run the project’s setup scripts')
    expect(stages[3].detail).toContain('does not automatically gain administrator privileges')
  })
  it('links the short feature list to existing tools without endorsing results', () => {
    const markup = renderToStaticMarkup(createElement(App))
    for (const feature of features) expect(markup).toContain(`id="${feature.href.slice(1)}"`)
    expect(markup).toContain('Signals, not a guarantee.')
    expect(markup).toContain('src="/trust-boundary.webp"')
    expect(markup).toContain('No dependency entries in this manifest.')
    expect(markup).not.toContain('Check this sample')
    expect(markup).not.toMatch(/Laptop feeling|check the vibes|trust issues|you’re fine/i)
    expect(markup).toContain('No curated suggestion to show. We do not invent package names.')
  })
})
