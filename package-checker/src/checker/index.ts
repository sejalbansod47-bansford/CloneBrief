import allowlist from '../../allowlist.json' with { type: 'json' };
import { parseInput, type Input, type Package } from './input.ts';
export { parseInput } from './input.ts';
export const BANNER = 'Signals, not a guarantee. Clone copies files. Install, open, and agent-run can execute code.';
export type Signal = { type: string; severity: 'danger' | 'warn' | 'info'; title: string; why: string; evidence: { url: string; field: string } };
export type Options = { fetch?: typeof fetch; now?: number; concurrency?: number };
const normalize = (s: string) => s.toLowerCase().replace(/[-_.]/g, '');
export function distance(a: string, b: string): number {
  let row = Array.from({length:b.length+1}, (_,i) => i);
  for (let i=1;i<=a.length;i++) { const next=[i]; for(let j=1;j<=b.length;j++) next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+Number(a[i-1]!==b[j-1])); row=next; }
  return row[b.length];
}
async function checkOne(p: Package, options: Options) {
  const fetcher = options.fetch ?? fetch;
  const signals: Signal[] = [];
  const signal = (type: string, severity: Signal['severity'], title: string, why: string, url: string, field: string) => signals.push({type,severity,title,why,evidence:{url,field}});
  const curated = allowlist.filter(r=>r.ecosystem===p.ecosystem);
  const exact = curated.some(r=>r.names.some(n=>n===p.name || (p.ecosystem==='pypi' && n.replace(/[-_.]+/g,'-')===p.name.replace(/[-_.]+/g,'-'))));
  const closest = curated.map(row=>({row,d:Math.min(...row.names.map(n=>distance(normalize(n),normalize(p.name))))})).sort((a,b)=>a.d-b.d)[0];
  if (!exact && closest && closest.d<=2) signal('typosquat','warn','Similar to a curated package','A similar name may be an accidental typo or impersonation.',closest.row.trust_url,closest.row.names.join(', '));
  const registry = p.ecosystem==='npm' ? `https://registry.npmjs.org/${encodeURIComponent(p.name)}` : `https://pypi.org/pypi/${encodeURIComponent(p.name)}/json`;
  async function json(url: string, init?: RequestInit) {
    const res = await fetcher(url,{...init,signal:AbortSignal.timeout(12000)});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
  let missing=false, fresh=false;
  try {
    const res = await fetcher(registry,{signal:AbortSignal.timeout(12000)});
    if(res.status===404) { missing=true; signal('not_found','danger','Package not found',"This package doesn't exist. AI tools invent names; attackers register them.",registry,'HTTP 404'); }
    else {
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const dates: number[] = p.ecosystem==='npm' ? [Date.parse(data.time?.created)] : Object.values(data.releases ?? {}).flatMap((files: any)=>files.map((f:any)=>Date.parse(f.upload_time_iso_8601 ?? `${f.upload_time}Z`)));
      const valid=dates.filter(Number.isFinite);
      if(!valid.length) signal('lookup_failed','warn','Publish date unavailable','The registry did not provide a usable publish date.',registry,p.ecosystem==='npm'?'time.created':'releases.*.upload_time');
      else { const age=(options.now??Date.now())-Math.min(...valid); if(age>=0 && age<14*86400000) {fresh=true;signal('too_new','warn','Published less than 14 days ago','New packages have little history to evaluate.',registry,p.ecosystem==='npm'?'time.created':'releases.*.upload_time');} }
      if(p.ecosystem==='npm') {
        const latest=data['dist-tags']?.latest;
        const manifest=data.versions?.[latest];
        if(!manifest) signal('lookup_failed','warn','Latest manifest unavailable','Install scripts could not be checked.',registry,'versions[dist-tags.latest]');
        else { const hooks=['preinstall','install','postinstall'].filter(k=>manifest.scripts?.[k]); if(hooks.length) signal('install_script','warn','Runs code during installation','Install hooks can execute code on your machine.',registry,`versions.${latest}.scripts.${hooks.join(',')}`); }
      }
    }
  } catch(error) {signal('lookup_failed','warn','Registry lookup failed','The registry could not be checked; do not treat this as a clean result.',registry,String(error));}
  let otherVulnerabilities=0;
  const maliciousAdvisories: {id:string;urls:string[]}[]=[];
  const osv='https://api.osv.dev/v1/query';
  try {
    const data=await json(osv,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({package:{name:p.name,ecosystem:p.ecosystem==='npm'?'npm':'PyPI'}})});
    if(data.vulns !== undefined && !Array.isArray(data.vulns)) throw new Error('Malformed OSV response');
    for(const vuln of data.vulns??[]) {
      if(typeof vuln.id!=='string') throw new Error('Malformed advisory');
      if(vuln.id.startsWith('MAL-')) { const urls=[`https://osv.dev/vulnerability/${encodeURIComponent(vuln.id)}`,...(vuln.references??[]).map((r:any)=>r.url).filter((u:unknown)=>typeof u==='string')]; maliciousAdvisories.push({id:vuln.id,urls}); signal('malicious_advisory','danger',vuln.id,'A malicious-package advisory says not to install this package.',urls[0],'id'); }
      else otherVulnerabilities++;
    }
  } catch(error) {signal('lookup_failed','warn','Advisory lookup failed','Malicious-package advisories could not be checked.',osv,String(error));}
  if(otherVulnerabilities) signal('vulnerability_count','info',`${otherVulnerabilities} other advisories`,'Non-malicious advisories need version-specific review.',osv,'vulns');
  const verdict=signals.some(s=>s.severity==='danger')?'do_not_install':signals.some(s=>s.severity==='warn')?'pause':'no_flags';
  const label=missing?'does_not_exist':signals.some(s=>s.type==='lookup_failed')?'lookup_failed':!exact&&closest?.d<=2?'one_typo_from_famous':fresh?'brand_new':'real';
  return {...p,label,verdict,signals,otherVulnerabilities,maliciousAdvisories,alternative:!exact&&closest?.d<=2?closest.row:null,alternativeMessage:!exact&&closest?.d<=2?'Curated similar name; verify it fits your task.':'No curated alternative. We do not invent package names.'};
}
export async function checkPackages(input: Input, options: Options = {}) {
  const packages=parseInput(input);
  const results: Awaited<ReturnType<typeof checkOne>>[] = new Array(packages.length);
  let cursor=0;
  const limit=Math.max(1,Math.min(8,Math.floor(options.concurrency??4)||4));
  await Promise.all(Array.from({length:Math.min(limit,packages.length)},async()=>{while(cursor<packages.length){const i=cursor++;results[i]=await checkOne(packages[i],options);}}));
  return {banner:BANNER,results};
}
