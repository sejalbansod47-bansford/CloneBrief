import { useState } from 'react'
import { AgentXray, SAMPLES, fetchAgentFiles, scanFiles } from './agentXray'
export default function App() {
  const [report, setReport] = useState(scanFiles(SAMPLES['Tag smuggling'])), [url, setUrl] = useState(''), [status, setStatus] = useState(''), [busy, setBusy] = useState(false)
  async function load() {
    setBusy(true); setStatus('Reading repository files as text…')
    try { const result = await fetchAgentFiles(url); setReport({ ...scanFiles(result.files), repo: result.repo }); setStatus(`${result.unread.length} files unread; tree ${result.truncated ? 'truncated' : 'complete'}. File and size limits apply.`) }
    catch (e) { setStatus(e instanceof Error ? e.message : 'Read failed') }
    finally { setBusy(false) }
  }
  return <main className="max-w-5xl mx-auto p-6 space-y-4"><h1 className="text-2xl">Agent Trap X-ray</h1><div className="flex flex-wrap gap-2">{Object.entries(SAMPLES).map(([name, files]) => <button className="border p-2" key={name} disabled={busy} onClick={() => { setReport(scanFiles(files)); setStatus('Offline sample') }}>{name}</button>)}</div><form onSubmit={e => { e.preventDefault(); void load() }}><input className="border p-2" aria-label="GitHub repository URL" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://github.com/owner/repo" /><button className="border p-2" disabled={busy}>Scan text</button></form><p role="status">{status}</p><AgentXray report={report} /></main>
}
