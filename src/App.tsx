import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { FakeDetonation, fetchSnapshot, SAMPLES } from '../fake-detonation/src/fakeDetonation'
import { createRepoCheck, repoPackageCount } from './repo'
import { packageHeadline } from './results'
import { exposures, features, incidents, stages } from './content'
import { RiskIcon } from './Illustrations'
import type { checkPackages } from '../package-checker/src/checker/index'

type Check = Awaited<ReturnType<typeof checkPackages>>
const labels: Record<string, string> = { real: 'Registry match', one_typo_from_famous: 'Similar name', brand_new: 'New publication', does_not_exist: 'Not found', known_malicious: 'Reported malicious', lookup_failed: 'Lookup incomplete' }
const verdictText: Record<string, string> = { do_not_install: 'do not install', pause: 'pause + check', no_flags: 'no flags' }
const verdictRank: Record<string, number> = { do_not_install: 0, pause: 1, no_flags: 2 }
const sampleNames = ['Install-script trap', 'Agent instructions', 'No-flags demo']

function Arrow() { return <span aria-hidden="true">↗</span> }

export default function App() {
  const [url, setUrl] = useState('')
  const [{ snapshot, replay, source }, setScan] = useState(() => createRepoCheck(SAMPLES[0].snapshot, `Sample · ${sampleNames[0]}`))
  const [repoBusy, setRepoBusy] = useState(false)
  const [repoError, setRepoError] = useState('')
  const [manifest, setManifest] = useState('')
  const [ecosystem, setEcosystem] = useState('auto')
  const [packageBusy, setPackageBusy] = useState(false)
  const [packageError, setPackageError] = useState('')
  const [check, setCheck] = useState<Check | null>(null)
  const [stage, setStage] = useState(0)
  const [expandedRisk, setExpandedRisk] = useState<number | null>(null)
  const terminal = useRef<HTMLElement>(null)
  const packageSection = useRef<HTMLElement>(null)
  const alternative = check?.results.find(result => result.alternative)?.alternative
  const repoManifest = snapshot.files['package.json']
  const packageCount = repoPackageCount(repoManifest)
  const scrollTo = (element: HTMLElement | null) => element?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' })

  function chooseSample(index: number) {
    setScan(createRepoCheck(SAMPLES[index].snapshot, `Sample · ${sampleNames[index]}`))
    setRepoError('')
    scrollTo(terminal.current)
  }
  async function scanRepo(event: FormEvent) {
    event.preventDefault()
    setRepoError(''); setRepoBusy(true)
    try {
      const next = await fetchSnapshot(url)
      setScan(createRepoCheck(next, 'Public repository · read as text'))
      scrollTo(terminal.current)
    } catch (error) { setRepoError(error instanceof Error ? error.message : 'Could not read this repository. Try a sample.') }
    finally { setRepoBusy(false) }
  }
  async function checkDependencies(event: FormEvent) {
    event.preventDefault()
    setCheck(null); setPackageError(''); setPackageBusy(true)
    try {
      const response = await fetch('/api/check-packages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ manifest, ecosystem }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Lookup failed. Try again.')
      setCheck(data)
    } catch (error) { setPackageError(error instanceof Error ? error.message : 'Lookup failed. Try again.') }
    finally { setPackageBusy(false) }
  }

  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header wrap">
      <a href="#" className="wordmark" aria-label="CloneBrief home"><span className="brand-mark" aria-hidden="true">⌘</span>CloneBrief<span className="brand-dot">.</span></a>
      <nav aria-label="Main navigation"><a href="#risks">The risks</a><a href="#incidents">Real incidents</a><a href="#packages">Package checks <Arrow/></a></nav>
    </header>
    <main id="main">
      <section className="hero wrap" aria-labelledby="hero-title">
        <div className="hero-copy">
          <span className="eyebrow">A field guide to software supply-chain risk</span>
          <h1 id="hero-title">Understand what runs.<br/><em>Before you trust it.</em></h1>
          <p className="hero-sub">One dependency can put more than your project at risk. See how untrusted code can reach your credentials, source code and connected systems.</p>
          <div className="hero-meta"><span className="status-dot"/> Read-only analysis <span aria-hidden="true">/</span> No repository code executed</div>
        </div>
        <figure className="hero-illustration"><img src="/trust-boundary.webp" width="400" height="400" alt="A pixelated cursor reaches toward an illustrated human hand through a blue opening in textured paper."/><figcaption>A small action can cross a larger trust boundary.</figcaption></figure>
        <div className="review-box" id="review">
          <div className="review-heading"><h2>Start with a repository</h2><span>PUBLIC GITHUB REPOSITORIES</span></div>
          <form onSubmit={scanRepo} className="repo-form">
            <label className="sr-only" htmlFor="repo-url">Public GitHub repository link</label>
            <span className="input-icon" aria-hidden="true">↗</span>
            <input id="repo-url" value={url} onChange={event => setUrl(event.target.value)} placeholder="https://github.com/owner/repository" required disabled={repoBusy}/>
            <button className="primary" disabled={repoBusy}>{repoBusy ? 'Reading repository…' : 'Review repository'} <Arrow/></button>
          </form>
          {repoError && <p className="error" role="alert">{repoError}</p>}
          <div className="samples"><span>Or explore a fictional sample:</span>{sampleNames.map((name, index) => <button key={name} onClick={() => chooseSample(index)} disabled={repoBusy}>{name} <Arrow/></button>)}</div>
          <p className="form-note">Selected setup files only, not a full audit. Your repository is never cloned, installed or run.</p>
        </div>
      </section>

      <section className="feature-strip wrap" aria-label="Features">
        {features.map(feature => <a key={feature.number} href={feature.href}><span className="feature-number">{feature.number}</span><div><h2>{feature.name} <Arrow/></h2><p>{feature.copy}</p></div></a>)}
      </section>

      <section className="section wrap" id="workflow" aria-labelledby="workflow-title">
        <div className="section-heading"><div><span className="eyebrow">01 / The trust boundary</span><h2 id="workflow-title">Cloning is not the same as running.</h2></div><p>Exposure changes at each step.<br/>Select a stage to see the checkpoint.</p></div>
        <div className="stage-grid">{stages.map((item, index) => <button key={item.name} className={`stage-card ${stage === index ? 'selected' : ''}`} onClick={() => setStage(index)} aria-pressed={stage === index} aria-controls="stage-detail"><span className="stage-number">0{index + 1}<span aria-hidden="true">→</span></span><h3>{item.name}</h3><p>{item.copy}</p><code>{item.command}</code></button>)}</div>
        <div className="stage-detail" id="stage-detail" role="status"><span className="checkpoint">{stages[stage].checkpoint}</span><p>{stages[stage].detail}</p></div>
      </section>

      <section className="risk-band" id="risks" aria-labelledby="risks-title"><div className="wrap section">
        <div className="section-heading"><div><span className="eyebrow">02 / What is at stake</span><h2 id="risks-title">Your laptop is not the limit.</h2></div><p>Potential consequences of executing untrusted code.<br/>The scope depends on the access it can reach.</p></div>
        <div className="risk-grid">{exposures.map((risk, index) => <article className="risk-card" key={risk.name}>
          <div className="risk-top"><RiskIcon kind={risk.icon}/><span>0{index + 1}</span></div><h3>{risk.name}</h3><p>{risk.copy}</p>
          <button className="text-button risk-toggle" onClick={() => setExpandedRisk(expandedRisk === index ? null : index)} aria-expanded={expandedRisk === index} aria-controls={`risk-${index}`}>{expandedRisk === index ? 'Close details' : 'How this happens'} <span aria-hidden="true">{expandedRisk === index ? '−' : '+'}</span></button>
          <div className="risk-detail" id={`risk-${index}`} hidden={expandedRisk !== index}>
            <span className="eyebrow">{risk.label}</span><dl><dt>Pathway</dt><dd>{risk.pathway}</dd><dt>Potential impact</dt><dd>{risk.consequence}</dd><dt>Reduce exposure</dt><dd>{risk.action}</dd></dl>
            <a className="source-link" href={incidents[risk.incident].url} target="_blank" rel="noreferrer">Related incident: {incidents[risk.incident].name} <Arrow/></a>
          </div>
        </article>)}</div>
        <div className="trust-chain" aria-label="Potential path from untrusted code to wider impact"><span>Untrusted code</span><span aria-hidden="true">→</span><span>Local permissions</span><span aria-hidden="true">→</span><span>Connected systems</span></div>
      </div></section>

      <section className="section wrap incidents-section" id="incidents" aria-labelledby="incidents-title">
        <div className="section-heading"><div><span className="eyebrow">03 / Documented, not hypothetical</span><h2 id="incidents-title">Small entry points. Wider consequences.</h2></div><p>Selected incidents from 2025–2026.<br/>Read the evidence, not just the headline.</p></div>
        <div className="incident-list">{incidents.map(incident => <details className="incident" key={incident.name}>
          <summary><time dateTime={incident.dateTime}>{incident.date}</time><div><span className="incident-category">{incident.category}</span><h3>{incident.name}</h3><p>{incident.summary}</p></div><span className="expand-icon" aria-hidden="true"/></summary>
          <div className="incident-body"><dl><div><dt>Entry point</dt><dd>{incident.entry}</dd></div><div><dt>Observed outcome</dt><dd>{incident.observed}</dd></div><div><dt>Scope matters</dt><dd>{incident.boundary}</dd></div><div><dt>The practical lesson</dt><dd>{incident.lesson}</dd></div></dl><a className="source-link" href={incident.url} target="_blank" rel="noreferrer">{incident.source} <Arrow/></a></div>
        </details>)}</div>
        <p className="scope-note">These are historical examples, not findings about a repository you submit. CloneBrief does not detect every attack described here.</p>
      </section>

      <section className="tools-band" aria-label="Read-only analysis tools">
        <section className="section wrap terminal-section" id="replay" ref={terminal} aria-labelledby="replay-title">
          <div className="section-heading"><div><span className="eyebrow">04 / Review tool</span><h2 id="replay-title">Preview the execution path.</h2><p className="heading-description">Potential commands, grouped by when they could run. A text simulation—not a sandbox.</p></div><span className="source-pill">{source}</span></div>
          <FakeDetonation replay={replay} speed={170} className="replay-terminal"/>
          <div className="terminal-notes"><p>Selected files only. Actual runtime behavior and transitive dependencies are not audited.</p>{repoManifest && (packageCount !== null && packageCount > 0 ? <button className="text-button" onClick={() => { setManifest(repoManifest); setEcosystem('npm'); setCheck(null); setPackageError(''); scrollTo(packageSection.current) }}>Check this {source.startsWith('Sample') ? 'sample’s' : 'repository’s'} package.json <Arrow/></button> : <p>{packageCount === 0 ? 'No dependency entries in this manifest.' : 'This manifest needs manual review.'} <a className="source-link" href="#packages">Open package checker <Arrow/></a></p>)}</div>
        </section>

        <section className="section wrap package-section" id="packages" ref={packageSection} aria-labelledby="packages-title">
          <div className="package-copy"><span className="eyebrow">05 / Review tool</span><h2 id="packages-title">Verify the name.<br/>Review the evidence.</h2><p>AI suggestions and familiar names are not guarantees. Check registry metadata and known advisory reports before installing.</p><ul className="coverage-list"><li>npm and PyPI registry lookups</li><li>OSV advisory signals</li><li>Curated similar names, where available</li></ul><p className="scope-note">Not a package-code or dependency-tree audit. Advisory counts require version-specific review.</p></div>
          <div className="package-box"><form onSubmit={checkDependencies}>
            <div className="field-heading"><label htmlFor="package-input">Dependencies or an install command</label><select aria-label="Package ecosystem" value={ecosystem} onChange={event => setEcosystem(event.target.value)} disabled={packageBusy}><option value="auto">Auto detect</option><option value="npm">npm / package.json</option><option value="pypi">PyPI / requirements.txt</option></select></div>
            <textarea id="package-input" rows={5} value={manifest} onChange={event => setManifest(event.target.value)} maxLength={95000} placeholder={'Paste package.json, requirements.txt,\nor what your AI suggested installing.\n\nnpm install react'} required disabled={packageBusy}/>
            <div className="package-actions"><button type="button" className="text-button" disabled={packageBusy} onClick={() => { setManifest('pip install reqeusts'); setEcosystem('auto'); setCheck(null); setPackageError('') }}>Try a typo example <Arrow/></button><button className="primary" disabled={packageBusy}>{packageBusy ? 'Checking…' : 'Check packages'} <Arrow/></button></div>
            <p className="form-note">Do not paste secrets. Package names are sent to npm / PyPI and OSV.</p>
          </form>
          {packageBusy && <p className="checking" role="status">Checking registry metadata and advisory reports. Nothing is installed.</p>}{packageError && <p className="error" role="alert">{packageError}</p>}
          {check && <div className="package-results" aria-live="polite"><p className="result-note">Checked {check.results.length} package{check.results.length === 1 ? '' : 's'}: {['do_not_install', 'pause', 'no_flags'].map(v => [v, check.results.filter(r => r.verdict === v).length] as const).filter(([, n]) => n).map(([v, n]) => `${n} ${verdictText[v]}`).join(' · ')}. Limited checks, not an endorsement. Expand a result for evidence.</p>{check.notChecked > 0 && <p className="result-note result-warn">Only the first {check.results.length} were checked. {check.notChecked} more not checked: paste them in a second check.</p>}{check.skipped.length > 0 && <p className="result-note result-warn">Not checked (not a registry name): {check.skipped.join(', ')}</p>}{check.results.length === 0 && <p>No supported package names found. Add dependencies or an install command.</p>}{[...check.results].sort((a, b) => verdictRank[a.verdict] - verdictRank[b.verdict]).map(result => <details key={`${result.ecosystem}:${result.name}`}><summary><span className="result-name">{result.name}<small>{result.ecosystem}</small></span><span className={`stamp stamp-${result.label}`}>{labels[result.label]}</span></summary><div className="result-detail"><b>{packageHeadline(result)}</b>{!result.signals.length && <p>A registry match does not tell us what the code will do.</p>}{result.signals.map((signal, index) => <p key={index}><a className="source-link" href={signal.evidence.url} target="_blank" rel="noreferrer">{signal.title} <Arrow/></a><br/>{signal.why}</p>)}</div></details>)}</div>}
          <aside className="alternative" aria-label="Curated similar package"><span className="eyebrow">Curated similar name</span>{alternative ? <><h3>{alternative.names.join(', ')}</h3><p>Verify this fits your task. A similar name is not a security endorsement.</p><p className="scope-note">{alternative.trust_basis === 'openjs' ? 'Listed by the OpenJS Foundation.' : alternative.trust_basis === 'pypa' ? 'Listed by PyPA.' : 'Identity reference: canonical upstream registry page, not an independent security attestation.'}</p><div className="alternative-links"><a className="source-link" href={alternative.docs} target="_blank" rel="noreferrer">Official documentation <Arrow/></a><a className="source-link" href={alternative.trust_url} target="_blank" rel="noreferrer">Identity source <Arrow/></a></div></> : <p>No curated suggestion to show. We do not invent package names.</p>}</aside>
          </div>
        </section>
      </section>

      <aside className="disclaimer wrap"><b>Signals, not a guarantee.</b><p>No scanner can promise what a repository will do. Review the source and permissions before you run it.</p></aside>
    </main>
    <footer className="wrap"><a href="#" className="wordmark">CloneBrief.</a><span>Built at Hack the Trent. Defensive use only.</span><a href="https://app.devin.ai/sessions/7e40655b76b2482db40da84aebdc0e7d" target="_blank" rel="noreferrer">Request changes <Arrow/></a></footer>
  </>
}
