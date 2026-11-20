import { useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { buildReplay, FakeDetonation, fetchSnapshot, SAMPLES } from '../fake-detonation/src/fakeDetonation'
import type { RepoSnapshot } from '../fake-detonation/src/fakeDetonation'
import type { checkPackages } from '../package-checker/src/checker/index'

type Check = Awaited<ReturnType<typeof checkPackages>>
const labels: Record<string, string> = { real: 'real', one_typo_from_famous: 'one typo away', brand_new: 'born yesterday', does_not_exist: "doesn't exist", lookup_failed: 'lookup incomplete' }
const moments = [
  { title: 'clone', command: 'git clone', copy: 'just copying files. the next step matters.', tip: 'Copying is not the same as trusting. Keep the folder closed until you’ve had a look.', face: 'calm' },
  { title: 'open', command: 'code .', copy: 'your editor or AI agent can trigger hidden setup.', tip: 'Check editor tasks, devcontainers and agent instructions before trusting the workspace.', face: 'hmm' },
  { title: 'install', command: 'npm install', copy: 'install scripts can run before you read a line.', tip: 'Read the scripts block and build config. Dependencies can bring their own install hooks.', face: 'oh' },
  { title: 'run', command: 'npm start', copy: 'their code gets your permissions. keys included.', tip: 'Use an isolated environment without personal tokens or files. Read the entry point first.', face: 'yikes' },
]
const flags = [
  { symbol: '>_', name: 'the copy-paste trap', code: 'curl … | bash', copy: 'one command. someone else’s script.', detail: 'A download piped into a shell runs before you can inspect it. Open the script and read it first.', action: 'read the script first' },
  { symbol: '{ }', name: 'the sneaky install', code: '"postinstall": "…"', copy: 'plot twist: install can mean run.', detail: 'Install hooks run during setup. Check preinstall, install and postinstall in package.json — plus your dependencies.', action: 'check the scripts block' },
  { symbol: '?', name: 'the made-up package', code: 'AI confidence ≠ existence', copy: 'your chatbot can hallucinate dependencies.', detail: 'An invented name can become a real attacker-owned package later. Check the registry, spelling and upstream docs.', action: 'check it’s real first' },
]

function Arrow({ diagonal = false }: { diagonal?: boolean }) { return <span aria-hidden="true">{diagonal ? '↗' : '→'}</span> }
function Laptop({ mood = 0, small = false }: { mood?: number; small?: boolean }) {
  return <svg className={small ? 'laptop laptop-small' : 'laptop'} viewBox="0 0 360 260" role="img" aria-label={`Laptop feeling ${moments[mood].face}`}>
    <ellipse cx="184" cy="238" rx="140" ry="13" fill="#68002C" opacity=".1" />
    <path d="M70 48 Q70 30 88 30 H279 Q296 30 296 48 V198 H70Z" fill="#A6C9DD" stroke="#68002C" strokeWidth="5"/>
    <rect x="83" y="43" width="199" height="141" rx="9" fill="#FDF6F2" stroke="#68002C" strokeWidth="3"/>
    <path d="M69 198 36 220 Q31 229 45 230 H320 Q334 229 328 220 L296 198Z" fill="#A6C9DD" stroke="#68002C" strokeWidth="5"/>
    <path d="M149 202H215L224 217H140Z" fill="#FFF8D5" stroke="#68002C" strokeWidth="2"/>
    <path d="M107 67h35m-35 9h19" stroke="#68002C" strokeWidth="4" strokeLinecap="round" opacity=".25"/>
    <ellipse cx="147" cy="112" rx="7" ry={mood > 1 ? 12 : 9} fill="#68002C"/><ellipse cx="219" cy="112" rx="7" ry={mood > 1 ? 12 : 9} fill="#68002C"/>
    <ellipse cx="127" cy="133" rx="13" ry="6" fill="#E098AC" opacity=".35"/><ellipse cx="239" cy="133" rx="13" ry="6" fill="#E098AC" opacity=".35"/>
    {mood === 0 ? <path d="M169 137q14 17 28 0" fill="none" stroke="#68002C" strokeWidth="4" strokeLinecap="round"/> : mood === 1 ? <path d="m172 143 22-5" stroke="#68002C" strokeWidth="4" strokeLinecap="round"/> : <ellipse cx="183" cy="145" rx={mood === 3 ? 12 : 7} ry={mood === 3 ? 15 : 9} fill="#68002C"/>}
    {mood > 1 && <path d="M259 70q-15 19 0 22 15-3 0-22" fill="#A6C9DD" stroke="#68002C" strokeWidth="2"/>}
    <path d="M63 113q-25-4-32 12m268-11q27-7 35 6" stroke="#68002C" strokeWidth="4" fill="none" strokeLinecap="round"/>
  </svg>
}

export default function App() {
  const [tab, setTab] = useState<'repo' | 'package'>('repo')
  const [url, setUrl] = useState('')
  const [snapshot, setSnapshot] = useState<RepoSnapshot>(SAMPLES[0].snapshot)
  const [source, setSource] = useState('sample · install-script trap')
  const [repoBusy, setRepoBusy] = useState(false)
  const [repoError, setRepoError] = useState('')
  const [manifest, setManifest] = useState('')
  const [ecosystem, setEcosystem] = useState('auto')
  const [packageBusy, setPackageBusy] = useState(false)
  const [packageError, setPackageError] = useState('')
  const [check, setCheck] = useState<Check | null>(null)
  const [moment, setMoment] = useState(0)
  const [flipped, setFlipped] = useState<number | null>(null)
  const terminal = useRef<HTMLElement>(null)
  const packageSection = useRef<HTMLElement>(null)
  const replay = useMemo(() => buildReplay(snapshot), [snapshot])
  const alternative = check?.results.find(result => result.alternative)?.alternative
  const scrollTo = (element: HTMLElement | null) => element?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' })
  function chooseSample(index: number) {
    setSnapshot(SAMPLES[index].snapshot)
    setSource(`sample · ${SAMPLES[index].label.toLowerCase()}`)
    setRepoError('')
    scrollTo(terminal.current)
  }
  async function scanRepo(event: FormEvent) {
    event.preventDefault()
    setRepoError(''); setRepoBusy(true)
    try { const next = await fetchSnapshot(url); setSnapshot(next); setSource('live public repo · read as text'); scrollTo(terminal.current) }
    catch (error) { setRepoError(error instanceof Error ? error.message : 'Could not read this repo. Try a sample.') }
    finally { setRepoBusy(false) }
  }
  async function spin(event: FormEvent) {
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
  function openPackages() { setTab('package'); scrollTo(packageSection.current) }

  return <>
    <header className="site-header wrap">
      <a href="#" className="wordmark" aria-label="CloneBrief home"><span className="logo-mark" aria-hidden="true">c<span>›</span></span>clonebrief<span className="wordmark-dot">.</span></a>
      <nav aria-label="Main navigation"><a href="#moments">the risks</a><a href="#detonation">the replay</a><button onClick={openPackages} className="nav-button">check a package <Arrow diagonal /></button></nav>
    </header>
    <main>
      <section className="hero wrap" aria-labelledby="hero-title">
        <div className="hero-copy"><span className="eyebrow"><span className="tiny-dot"/> less blind trust. more main character.</span>
          <h1 id="hero-title">you cloned it.<br/>cool. <span className="highlight">what<br className="desktop-break"/> runs next?</span><span className="title-star" aria-hidden="true">✳</span></h1>
          <p className="hero-sub">git clone copies files.<br/>the next command is where it gets spicy.</p>
          <div className="hero-tags"><span>read-only checks</span><span>zero repo code executed</span></div>
        </div>
        <div className="hero-art" aria-hidden="true"><span className="art-spark spark-one">✦</span><span className="art-spark spark-two">✳</span><div className="art-circle"/><div className="speech">it’s just a quick<br/>npm install… right?</div><Laptop mood={2}/><span className="sticker">trust issues?<br/><b>valid.</b></span><span className="art-caption">your laptop, probably.</span></div>
        <div className="scan-card">
          <div className="tabs" role="tablist" aria-label="Choose a check"><button role="tab" id="repo-tab" aria-controls="repo-panel" aria-selected={tab === 'repo'} onClick={() => setTab('repo')}>↗ repo check</button><button role="tab" id="package-tab" aria-controls="package-panel" aria-selected={tab === 'package'} onClick={openPackages}>{'{ }'} package check</button><span>curious is a good look.</span></div>
          {tab === 'repo' ? <div id="repo-panel" role="tabpanel" aria-labelledby="repo-tab"><form onSubmit={scanRepo} className="repo-form"><label className="sr-only" htmlFor="repo-url">Public GitHub repository link</label><span className="input-icon" aria-hidden="true">↗</span><input id="repo-url" value={url} onChange={e => setUrl(e.target.value)} placeholder="paste a github link" required disabled={repoBusy}/><button className="primary" disabled={repoBusy}>{repoBusy ? 'reading the repo…' : 'check the vibes'} <Arrow/></button></form><div className="samples"><span>or try a sample:</span>{['install-script trap', 'agent bait', 'low-drama repo'].map((name, i) => <button key={name} onClick={() => chooseSample(i)} disabled={repoBusy}>{name} <Arrow diagonal/></button>)}</div>{repoError && <p className="error" role="alert">{repoError}</p>}<p className="form-note">public repos only · selected files, not a full audit · samples are fictional demos</p></div> : <div id="package-panel" role="tabpanel" aria-labelledby="package-tab" className="package-intro"><p>AI told you to install something? let’s check it exists.</p><button className="primary" onClick={() => scrollTo(packageSection.current)}>to the package checker <Arrow/></button></div>}
        </div>
      </section>

      <section className="moments-section" id="moments" aria-labelledby="moments-title"><div className="wrap"><div className="section-heading"><div><span className="eyebrow">01 / the plot thickens</span><h2 id="moments-title">same repo. <span>four very different moments.</span></h2></div><span className="hand-note">tap a moment ↙</span></div>
        <div className="moment-grid">{moments.map((item, index) => <button key={item.title} className={`moment-card moment-${index} ${moment === index ? 'selected' : ''}`} onClick={() => setMoment(index)} aria-pressed={moment === index}><span className="moment-top"><span className="step">0{index + 1}</span><span className="moment-arrow" aria-hidden="true">↗</span></span><Laptop mood={index} small/><h3>{item.title}<span>.</span></h3><code>{item.command}</code><p>{item.copy}</p></button>)}</div>
        <div className="moment-tip" role="status"><span className="tip-label">the move</span><p>{moments[moment].tip}</p></div>
      </div></section>

      <section className="wrap flags-section" aria-labelledby="flags-title"><div className="section-heading"><div><span className="eyebrow">02 / spot the ick</span><h2 id="flags-title">3 red flags. <span>10 seconds.</span></h2></div><p>tiny checks. fewer bad surprises.</p></div><div className="flag-grid">{flags.map((flag, index) => <button key={flag.name} className={`flag-card ${flipped === index ? 'is-flipped' : ''}`} onClick={() => setFlipped(flipped === index ? null : index)} aria-expanded={flipped === index}><span className="flag-symbol" aria-hidden="true">{flag.symbol}</span><span className="flag-number">0{index + 1}</span><h3>{flag.name}</h3>{flipped === index ? <p className="flag-detail">{flag.detail}</p> : <><code>{flag.code}</code><p>{flag.copy}</p></>}<span className="flag-action">{flipped === index ? flag.action : 'flip for the fix'} <span aria-hidden="true">↻</span></span></button>)}</div></section>

      <section className="package-section" id="packages" ref={packageSection} aria-labelledby="packages-title"><div className="wrap package-layout"><div className="package-copy"><span className="eyebrow">03 / fact-check your chatbot</span><h2 id="packages-title">did your AI<br/><span>make this up?</span></h2><p>big confidence. questionable dependency.<br/>check the name before you install.</p><div className={`slot-machine ${packageBusy ? 'spinning' : ''}`} aria-hidden="true"><span>real</span><span>typo?</span><span>new?</span></div><p className="small-print">registry presence ≠ a trust stamp.<br/>we check npm, PyPI and OSV advisories.</p></div>
        <div className="package-box"><form onSubmit={spin}><div className="field-heading"><label htmlFor="package-input">drop the dependencies</label><select aria-label="Package ecosystem" value={ecosystem} onChange={e => setEcosystem(e.target.value)} disabled={packageBusy}><option value="auto">auto detect</option><option value="npm">npm / package.json</option><option value="pypi">PyPI / requirements.txt</option></select></div><textarea id="package-input" rows={5} value={manifest} onChange={e => setManifest(e.target.value)} maxLength={95000} placeholder={'paste a requirements.txt, package.json,\nor what your chatbot told you to install…\n\nnpm install react'} required disabled={packageBusy}/><div className="package-actions"><button type="button" className="text-button" disabled={packageBusy} onClick={() => { setManifest('pip install reqeusts'); setEcosystem('auto'); setCheck(null); setPackageError('') }}>try a typo example ↗</button><button className="primary" disabled={packageBusy}>{packageBusy ? 'checking…' : 'spin'} <span aria-hidden="true">✳</span></button></div></form>
          {packageBusy && <p className="checking" role="status">checking the registries + advisories. not installing anything.</p>}{packageError && <p className="error" role="alert">{packageError}</p>}
          {check && <div className="package-results" aria-live="polite"><p className="result-note">live signals · expand a result for sources</p>{check.results.map(result => <details key={`${result.ecosystem}:${result.name}`}><summary><span className="result-name">{result.name}<small>{result.ecosystem}</small></span><span className={`stamp stamp-${result.label}`}>{labels[result.label]}</span></summary><div className="result-detail"><b>{result.verdict === 'do_not_install' ? 'do not install' : result.verdict === 'pause' ? 'pause + check' : 'no flags in these checks'}</b>{!result.signals.length && <p>Found in the registry. That alone tells us nothing about the code’s intent.</p>}{result.signals.map((signal, index) => <p key={index}><a href={signal.evidence.url} target="_blank" rel="noreferrer">{signal.title} ↗</a><br/>{signal.why}</p>)}</div></details>)}</div>}
        </div></div></section>

      <section className="wrap terminal-section" id="detonation" ref={terminal} aria-labelledby="terminal-title"><div className="section-heading"><div><span className="eyebrow">04 / a preview, not an execution</span><h2 id="terminal-title">what would have run.<br/><span>(we didn’t run it.)</span></h2></div><div className="replay-source"><span className="source-pill">{source}</span><p>commands are text. your laptop stays out of it.</p></div></div><FakeDetonation replay={replay} speed={170} className="replay-terminal"/>{snapshot.files['package.json'] && <button className="text-button repo-dependencies" onClick={() => { setManifest(snapshot.files['package.json']); setEcosystem('npm'); setCheck(null); setPackageError(''); openPackages() }}>check this {source.startsWith('sample') ? 'sample’s' : 'repo’s'} package.json too <Arrow/></button>}</section>

      <section className="wrap swap-section" aria-labelledby="swap-title"><div className="swap-icon" aria-hidden="true">↔</div><div className="swap-copy"><span className="eyebrow">05 / no made-up recommendations</span><h2 id="swap-title">try this instead.</h2>{alternative ? <><p><b>{alternative.names.join(', ')}</b> · a curated similar name. verify it fits your task.</p><p className="small-print">{alternative.trust_basis === 'openjs' ? 'Listed by the OpenJS Foundation.' : alternative.trust_basis === 'pypa' ? 'Listed by PyPA.' : 'Identity reference: canonical upstream registry page, not an independent security attestation.'} <a href={alternative.trust_url} target="_blank" rel="noreferrer">check the source ↗</a></p></> : <p>no verified swap for this one.<br/>we don’t make up package names.</p>}</div>{alternative ? <a className="primary" href={alternative.docs} target="_blank" rel="noreferrer">official docs <Arrow diagonal/></a> : <span className="swap-tag">allowlist only. always.</span>}</section>
    </main>
    <footer className="wrap"><a href="#" className="wordmark footer-brand">clonebrief.</a><span>built at Hack the Trent. defensive only.</span><a href="https://app.devin.ai/sessions/7e40655b76b2482db40da84aebdc0e7d" target="_blank" rel="noreferrer">request changes ↗</a></footer>
    <div className="bottom-banner"><span aria-hidden="true">✳</span> signals, not a guarantee. <span>no scanner can promise what a repo will do.</span></div>
  </>
}
