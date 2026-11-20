import { checkPackages } from '../../../package-checker/src/checker/index.ts';
const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
export async function handler(req: Request): Promise<Response> {
  const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
  if(req.method==='OPTIONS') return new Response(null,{status:204,headers:cors});
  if(req.method!=='POST') return reply({error:'Use POST'},405);
  try {
    const text=await req.text();
    if(text.length>100000) return reply({error:'Body too large'},413);
    const body=JSON.parse(text);
    if(!body || typeof body!=='object' || ![undefined,'auto','npm','pypi'].includes(body.ecosystem) || (body.packages!==undefined && (!Array.isArray(body.packages)||body.packages.length>50||body.packages.some((n:unknown)=>typeof n!=='string'||n.length>214))) || (body.manifest!==undefined && typeof body.manifest!=='string')) return reply({error:'Invalid input; maximum 50 packages'},400);
    return reply(await checkPackages(body,{concurrency:4}));
  } catch(error) { return reply({error:error instanceof Error?error.message:'Invalid request'},400); }
}
Deno.serve(handler);
