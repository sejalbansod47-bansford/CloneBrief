export function WorkspaceSketch() {
  return <svg className="workspace-sketch" viewBox="0 0 520 338" fill="none" aria-hidden="true">
    <defs>
      <pattern id="pencil-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(28)"><path d="M0 0V7" stroke="currentColor" strokeWidth=".6" opacity=".16"/></pattern>
    </defs>
    <path d="M62 251 362 250 410 284 24 286Z" fill="url(#pencil-hatch)"/>
    <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M81 78 340 72 345 245 78 250Z" fill="var(--paper)" strokeWidth="1.5"/>
      <path d="m78 79 261-4 8 172-270 5M88 88l240-5 5 150-244 4Z" strokeWidth=".7" opacity=".4"/>
      <path d="m78 250-47 31 366-2-52-34M30 286l366-3 2-4M159 253l98-2 18 16-137 2Z" strokeWidth="1.5"/>
      <path d="m93 102 234-4M100 114l58-1M100 123l33-1M100 132l46-1" opacity=".35"/>
      <path d="m177 121-13 12 14 11m26-23 13 11-13 12m-13-28-6 33" strokeWidth="1.8"/>
      <path d="m163 163 130-3m-129 13 83-2m-83 12 110-2m-109 12 65-1" strokeWidth="1.1" opacity=".5"/>
      <path d="M246 209h63m-61 4h48" strokeWidth=".6"/>
      <path d="m349 122 43-1m-6-5 7 5-7 5M348 207l44 25m-2-8 3 9-9-1" strokeDasharray="3 5" opacity=".7"/>
      <path d="m406 90 65-2 2 64-66 2Z" fill="var(--blue-light)" strokeWidth="1.2"/>
      <path d="m404 92 67-6 4 69-68 1M418 105l31-1m-30 9 39-1" opacity=".3" strokeWidth=".8"/>
      <path d="M427 134a7 7 0 1 1 12-5l14-1m-5 0v6m-5-6v4" strokeWidth="1.5"/>
      <path d="m405 219 51-2 15 13 1 46-66 2Zm51-2 1 15 14-2m-52 16 38-1m-38 10 27-1" strokeWidth="1.2"/>
      <path d="m404 220 53-5 17 15-1 48-68 3" opacity=".3" strokeWidth=".7"/>
      <path d="M126 56q36-27 84-21m-7-5 8 5-9 5M400 176q31 17 57 3" strokeWidth=".8" opacity=".5"/>
      <path d="M53 308q177-7 352-3M45 312l100-1" strokeWidth=".7" opacity=".23"/>
    </g>
    <g fill="currentColor" fontFamily="ui-monospace, monospace" fontSize="10" letterSpacing=".5">
      <text x="73" y="43">01 / UNTRUSTED CODE</text><text x="402" y="76">02 / ACCESS</text><text x="397" y="299">03 / IMPACT</text>
    </g>
  </svg>
}

export function RiskIcon({ kind }: { kind: string }) {
  return <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'key' ? <><path d="M22 26a11 11 0 1 1 2-12l18-1v7h-6v6h-7l-5 1"/><path d="M15 18h.1M8 10q-6 10 0 19m20-12 12-1" opacity=".35"/></> : kind === 'file' ? <><path d="m11 5 18-1 9 10 1 29-29 1ZM29 4v11l9-1M17 23l-4 4 4 4m14-9 5 4-4 5m-8-11-4 15"/><path d="M8 7 7 45l29 1" opacity=".35"/></> : <><path d="m6 8 35-1 1 26-36 1ZM3 40l41-1M19 34v5m9-5v5M12 15h12m-12 5h21m-20 6h16"/><path d="m8 10 31-1 1 22M5 43l37-1" opacity=".35"/></>}
  </svg>
}
