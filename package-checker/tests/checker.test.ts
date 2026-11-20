import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkPackages,parseInput} from '../src/checker/index.ts';
const old={time:{created:'2020-01-01'},'dist-tags':{latest:'1'},versions:{'1':{}}};
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
  assert.equal(r.label,'brand_new');assert.equal(r.otherVulnerabilities,1);assert.equal(r.verdict,'do_not_install');assert.equal(r.alternative,null);
  for(const t of ['too_new','install_script','malicious_advisory']) assert.ok(r.signals.some(s=>s.type===t));
});
test('failures never clean',async()=>{
  const {results:[r]}=await checkPackages({ecosystem:'npm',packages:['react']},{fetch:(async()=>{throw Error('offline');}) as typeof fetch});
  assert.equal(r.label,'lookup_failed');assert.equal(r.verdict,'pause');assert.equal(r.signals.length,2);
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
