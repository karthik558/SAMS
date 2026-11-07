import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
function load(client) {
  const source=readFileSync(new URL('../../src/services/systemStatus.ts',import.meta.url),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};
  new Function('require','module','exports',code)(()=>({supabase:client,hasSupabaseEnv:true}),module,module.exports);
  return module.exports;
}
function client({dbError=null,user={id:'verified-user'},authError=null}={}) {
  return {
    get storage(){throw Error('Bucket administration is not an application health probe');},
    auth:{getUser:async()=>({data:{user},error:authError})},
    from:table=>({select:(columns,options)=>{
      assert.equal(table,'app_users');assert.equal(columns,'id');assert.equal(options.head,true);
      return {limit:value=>{assert.equal(value,1);return {abortSignal:async()=>({error:dbError})};}};
    }}),
  };
}
test('healthy ordinary-session checks use real requests without the nonexistent count column or bucket admin API',async()=>{
  const original=globalThis.fetch;
  try{globalThis.fetch=async(_url,options)=>{assert.equal(options.method,'HEAD');assert.equal(options.cache,'no-store');return new Response(null,{status:200});};
    const {checkSystemHealth,summarizeHealth}=load(client());const result=await checkSystemHealth();
    assert.equal(summarizeHealth(result.checks),'operational');assert.equal(result.checks.length,3);
    assert.ok(result.checks.every(item=>item.latency>=0&&item.status==='operational'));
  }finally{globalThis.fetch=original;}
});
test('permission failures and missing sessions are unknown checks, not infrastructure outages or false normal states',async()=>{
  const original=globalThis.fetch;
  try{globalThis.fetch=async()=>new Response(null,{status:200});
    const {checkSystemHealth,summarizeHealth}=load(client({dbError:{code:'42501'},user:null}));const result=await checkSystemHealth();
    assert.equal(summarizeHealth(result.checks),'unknown');assert.equal(result.checks.find(item=>item.id==='db').status,'unknown');
    assert.equal(summarizeHealth([{status:'checking'}]),'checking');
  }finally{globalThis.fetch=original;}
});
test('an unsuccessful hosting response is surfaced instead of hardcoding System Normal',async()=>{
  const original=globalThis.fetch;
  try{globalThis.fetch=async()=>new Response(null,{status:503});
    const {checkSystemHealth,summarizeHealth}=load(client());const result=await checkSystemHealth();
    assert.equal(result.checks.find(item=>item.id==='hosting').status,'degraded');assert.equal(summarizeHealth(result.checks),'degraded');
  }finally{globalThis.fetch=original;}
});
