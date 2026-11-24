import { useState } from 'react'
import type { Report } from './scan.ts'
import { xraySegments } from './render.ts'
export function AgentXray({ report }: { report: Report }) {
  const [selected, setSelected] = useState(''), [xray, setXray] = useState(true)
  const file = report.files.find(f => f.path === selected) ?? report.files[0]
  return <section className="space-y-4 border p-4">
    <p>{report.banner}</p><p>Verdict: {report.verdict} · Classifier: {report.classifier}</p>
    <label><input type="checkbox" checked={xray} onChange={e => setXray(e.target.checked)} /> X-ray</label>
    <nav className="flex flex-wrap gap-2">{report.files.map(f => <button className="border p-2" key={f.path} onClick={() => setSelected(f.path)}>{f.path} ({f.findings.length})</button>)}</nav>
    {!file && <p>No instruction files were read.</p>}
    {file && <pre className="whitespace-pre-wrap break-all border p-3">{xray ? xraySegments(file.text, file.findings).map((s, i) => <span key={i} className={s.badge ? 'bg-amber-200 text-black border' : s.highlighted ? 'bg-yellow-100 text-black' : ''}>{s.text}</span>) : file.text}</pre>}
    <ul className="space-y-2">{report.findings.map(f => <li key={f.id}><button onClick={() => setSelected(f.file)}>{f.file}:{f.line}:{f.column}</button> — {f.severity}: {f.title}<p>{f.why}</p><code className="whitespace-pre-wrap break-all">{f.evidence}</code>{f.decoded !== undefined && <pre className="whitespace-pre-wrap">Decoded: {f.decoded}</pre>}</li>)}</ul>
  </section>
}
