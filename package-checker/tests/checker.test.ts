import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkPackages,parseInput} from '../src/checker/index.ts';
const old={time:{created:'2020-01-01'},'dist-tags':{latest:'1'},versions:{'1':{}}};
test('ignores TOML and requirements comments without treating them as dependencies or commands',()=>{
  const manifest=`[project]
dependencies = [ # "fake-start" ]
  "requests[socks]>=2", # "fake-inline" ]
  # "fake-comment" ] npm i fake-command
  'numpy; python_version == "3#literal"', # "fake-other"
  "pandas"
] # "fake-end"`;
  assert.deepEqual(parseInput({ecosystem:'pypi',manifest}).map(p=>p.name),['requests','numpy','pandas']);
  assert.deepEqual(parseInput({ecosystem:'pypi',manifest:'# pip install fake\nrequests[socks]>=2 # npm i fake\nnumpy # "fake"\n# pandas'}).map(p=>p.name),['requests','numpy']);
});
test('npm aliases resolve to their registry target including scopes',()=>{
  const manifest=JSON.stringify({dependencies:{'react-v18':'npm:react@^18'},devDependencies:{'scoped-alias':'npm:@scope/pkg@^2'},optionalDependencies:{optional:'npm:express@4'},peerDependencies:{peer:'npm:next@14',react:'^18'}});
  assert.deepEqual(parseInput({ecosystem:'npm',manifest}).map(p=>p.name),['react','@scope/pkg','express','next']);
});
test('TOML extras do not close multiline dependency arrays',()=>{
  const manifest=`[project]
dependencies = [
  "requests[socks]>=2",
  'numpy[extra]==1',
  "pandas>=2"
]
description = "not-a-dependency"
[project.optional-dependencies]
web = ["flask[async]", "django>=4"]`;
  assert.deepEqual(parseInput({ecosystem:'pypi',manifest}).map(p=>p.name),['requests','numpy','pandas','flask','django']);
});
test('package.json dependencies take priority over script commands',()=>{
  const manifest=JSON.stringify({scripts:{check:'npx tsc --noEmit'},dependencies:{react:'*'},devDependencies:{typescript:'*'},optionalDependencies:{express:'*'},peerDependencies:{next:'*'}});
  for (const ecosystem of ['npm','auto'] as const) assert.deepEqual(parseInput({ecosystem,manifest}).map(p=>p.name),['react','typescript','express','next']);
  assert.deepEqual(parseInput({ecosystem:'npm',manifest:'{"dependencies":{},"scripts":{"check":"npx tsc --noEmit"}}'}),[]);
});
const mock=(registry:unknown=old, osv:unknown={},status=200)=> (async(url:any)=>new Response(JSON.stringify(String(url).includes('osv.dev')?osv:registry),{status:String(url).includes('osv.dev')?200:status})) as typeof fetch;
test('clean exact name and empty input',async()=>{
  const r=await checkPackages({ecosystem:'npm',packages:['express']},{fetch:mock()});
  assert.equal(r.results[0].verdict,'no_flags');assert.equal(r.results[0].label,'real');
  assert.deepEqual((await checkPackages({ecosystem:'npm',packages:[]})).results,[]);
});
test('404, typo and curated alternative',async()=>{
  const {results:[r]}=await checkPackages({ecosystem:'npm',packages:['expresss']},{fetch:mock({}, {},404)});
  assert.equal(r.label,'does_not_exist');assert.equal(r.verdict,'do_not_install');assert.equal(r.alternative?.id,'express');assert.ok(r.signals.some(s=>s.type==='typosquat'));
});
test('new package, hooks, MAL and ordinary advisories',async()=>{
  const registry={...old,time:{created:new Date().toISOString()},versions:{'1':{scripts:{install:'echo test'}}}};
  const {results:[r]}=await checkPackages({ecosystem:'npm',packages:['zzqx-example']},{fetch:mock(registry,{vulns:[{id:'MAL-1'},{id:'GHSA-test'}]})});
  assert.equal(r.label,'known_malicious');assert.equal(r.otherVulnerabilities,1);assert.equal(r.verdict,'do_not_install');assert.equal(r.alternative,null);
  for(const t of ['too_new','install_script','malicious_advisory']) assert.ok(r.signals.some(s=>s.type===t));
});
test('failures never clean',async()=>{
  const {results:[r]}=await checkPackages({ecosystem:'npm',packages:['react']},{fetch:(async()=>{throw Error('offline');}) as typeof fetch});
  assert.equal(r.label,'lookup_failed');assert.equal(r.verdict,'pause');assert.equal(r.signals.length,2);
});
test('ordinary advisories link to a browsable ecosystem-filtered evidence page',async()=>{
  const {results:[r]}=await checkPackages({ecosystem:'npm',packages:['react']},{fetch:mock(old,{vulns:[{id:'GHSA-test'}]})});
  assert.equal(r.verdict,'no_flags');
  const url=new URL(r.signals.find(s=>s.type==='vulnerability_count')!.evidence.url);
  assert.equal(url.origin+url.pathname,'https://osv.dev/list');
  assert.equal(url.searchParams.get('q'),'react');
  assert.equal(url.searchParams.get('ecosystem'),'npm');
});
test('PyPI earliest upload and normalized exact match',async()=>{
  const {results:[r]}=await checkPackages({ecosystem:'pypi',packages:['scikit_learn']},{fetch:mock({releases:{'1':[{upload_time:'2020-01-01T00:00:00'}],'2':[{upload_time:new Date().toISOString().slice(0,-1)}]}})});
  assert.equal(r.verdict,'no_flags');assert.equal(r.label,'real');
});
test('parses JSON, requirements, pyproject and mixed chatbot commands',()=>{
  assert.equal(parseInput({ecosystem:'npm',manifest:'{"dependencies":{"react":"*"},"devDependencies":{"express":"*"}}'}).length,2);
  assert.deepEqual(parseInput({ecosystem:'pypi',manifest:'requests>=2\n# comment\nnumpy[extra]==1'}).map(p=>p.name),['requests','numpy']);
  assert.deepEqual(parseInput({ecosystem:'pypi',manifest:'[project]\ndependencies = ["requests>=2", "numpy"]\n[tool.poetry.dependencies]\npython = "^3"\npandas = "*"'}).map(p=>p.name),['requests','numpy','pandas']);
  assert.deepEqual(parseInput({ecosystem:'auto',manifest:'Try:\n```sh\nnpm i react express\npip3 install requests\nyarn add next\npnpm add fastify\nnpx react\nuv add numpy\npoetry add pandas\n```'}).map(p=>p.name),['react','express','requests','next','fastify','numpy','pandas']);
  assert.throws(()=>parseInput({ecosystem:'npm',manifest:'{'}));
  assert.throws(()=>parseInput({ecosystem:'npm',packages:Array.from({length:51},(_,i)=>`p${i}`)}));
});
test('student inputs: plain requirements, dependency fragments, chatbot prose and skipped specifiers',()=>{
  const names=(manifest:string,ecosystem:'auto'|'npm'|'pypi'='auto',skipped:string[]=[])=>parseInput({ecosystem,manifest},skipped).map(p=>`${p.ecosystem}:${p.name}`);
  assert.deepEqual(names('flask==3.0.0\r\nrequests>=2.31\nnumpy\n-r base.txt\n--index-url https://x'),['pypi:flask','pypi:requests','pypi:numpy']);
  assert.deepEqual(names('"react": "^18.2.0",\n"axios": "^1.6.0",'),['npm:react','npm:axios']);
  assert.deepEqual(names('{"name":"x","version":"1.0.0"}'),[]);
  assert.deepEqual(names('react, lodash\naxios@1.6','npm'),['npm:react','npm:lodash','npm:axios']);
  assert.deepEqual(names('Run pip install requests. Then npx create-react-app my-app and bun add hono'),['pypi:requests','npm:create-react-app','npm:hono']);
  assert.deepEqual(names('pip install pandas and then python main.py'),['pypi:pandas']);
  const skipped:string[]=[];
  assert.deepEqual(names('npm install https://github.com/x/y left-pad','auto',skipped),['npm:left-pad']);
  assert.deepEqual(skipped,['https://github.com/x/y']);
  assert.deepEqual(names('requests[security,socks]>=2.31\nflask'),['pypi:requests','pypi:flask']);
  const direct:string[]=[];
  assert.deepEqual(names('mylib @ https://x.dev/mylib.whl\nflask==3.0','auto',direct),['pypi:flask']);
  assert.deepEqual(names('pkg@https://x.dev/pkg.tgz\nmy-react@npm:react@18','npm',direct),['npm:react']);
  assert.deepEqual(names('npm install my-react@npm:react@18 left-pad@git+https://x/y','auto',direct),['npm:react']);
  assert.equal(direct.length,3);
  assert.deepEqual(names(`npm install "@types/node@20" '@scope/pkg'`),['npm:@types/node','npm:@scope/pkg']);
  assert.deepEqual(names('react,   lodash','npm'),['npm:react','npm:lodash']);
  assert.deepEqual(names('flask==3.0,  numpy','pypi'),['pypi:flask','pypi:numpy']);
  assert.deepEqual(names(`flask; python_version in "3.8,  3.9,  3.10"`),['pypi:flask']);
  assert.deepEqual(names("https://x.dev/it's.tgz, react, lodash",'npm'),['npm:react','npm:lodash']);
  const t=Date.now(); assert.equal(parseInput({ecosystem:'npm',manifest:Array(30000).fill('a').join(',   ')}).length,1); assert.ok(Date.now()-t<500);
  assert.throws(()=>parseInput({ecosystem:'auto',manifest:'react\nlodash'}),/Pick one in the dropdown/);
  assert.throws(()=>parseInput({ecosystem:'auto',manifest:'{"dependencies":{"react":"^18",}}'}),/isn't valid JSON/);
});
test('large manifests check the first 50 and report the rest',async()=>{
  const manifest=JSON.stringify({dependencies:Object.fromEntries(Array.from({length:60},(_,i)=>[`p${i}`,'*']))});
  const r=await checkPackages({ecosystem:'auto',manifest},{fetch:mock()});
  assert.equal(r.results.length,50);assert.equal(r.notChecked,10);
});
