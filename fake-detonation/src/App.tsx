import { useState } from 'react'
import { FakeDetonation, SAMPLES, buildReplay, fetchSnapshot, type Replay } from './fakeDetonation'

export default function App() {
  const [url, setUrl] = useState('')
  const [replay, setReplay] = useState<Replay>(() => buildReplay(SAMPLES[0].snapshot))
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const scan = async () => {
    setError('')
    setLoading(true)
    try {
      setReplay(buildReplay(await fetchSnapshot(url)))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-black tracking-tight text-[#7C113A] sm:text-4xl">What would this repo do to my laptop?</h1>
      <p className="mt-2 text-[#7C113A]/80">Paste a public GitHub repo. We replay what would run when you open, agent, install and run it. As text. Nothing executes.</p>

      <form
        className="mt-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          scan()
        }}
      >
        <input
          className="min-w-0 flex-1 rounded-full border-2 border-[#7C113A] bg-white px-4 py-2 outline-none focus:ring-2 focus:ring-[#B9D6FC]"
          placeholder="https://github.com/owner/repo"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button disabled={loading || !url} className="shrink-0 rounded-full bg-[#7C113A] px-5 py-2 font-bold text-[#FBEAE7] disabled:opacity-50">
          {loading ? 'Reading…' : 'Detonate (fake)'}
        </button>
      </form>
      {error && <p className="mt-2 text-sm font-semibold text-[#EA6244]">{error}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        {SAMPLES.map((s) => (
          <button
            key={s.id}
            className="rounded-full bg-[#B9D6FC] px-3 py-1 text-sm font-semibold text-[#7C113A]"
            onClick={() => {
              setError('')
              setReplay(buildReplay(s.snapshot))
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      <FakeDetonation replay={replay} className="mt-6" />
    </main>
  )
}
