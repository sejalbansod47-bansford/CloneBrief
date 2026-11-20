export function RiskIcon({ kind }: { kind: string }) {
  return <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'key' ? <><path d="M22 26a11 11 0 1 1 2-12l18-1v7h-6v6h-7l-5 1"/><path d="M15 18h.1M8 10q-6 10 0 19m20-12 12-1" opacity=".35"/></> : kind === 'file' ? <><path d="m11 5 18-1 9 10 1 29-29 1ZM29 4v11l9-1M17 23l-4 4 4 4m14-9 5 4-4 5m-8-11-4 15"/><path d="M8 7 7 45l29 1" opacity=".35"/></> : <><path d="m6 8 35-1 1 26-36 1ZM3 40l41-1M19 34v5m9-5v5M12 15h12m-12 5h21m-20 6h16"/><path d="m8 10 31-1 1 22M5 43l37-1" opacity=".35"/></>}
  </svg>
}
