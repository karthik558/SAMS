import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load(path) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('require','module','exports',compiled)(require,module,module.exports);
  return module.exports.default;
}
const email = load('../../api/send-email.ts');
const proxy = load('../../api/proxy-supabase.ts');
function response() {
  return { code: 200, body: null, headers: {}, status(code) { this.code=code;return this; },
    setHeader(key,value) { this.headers[key]=value; },json(body) { this.body=body;return this; },send(body) {this.body=body;return this;},end(){return this;} };
}
process.env.SUPABASE_URL='https://security-test.supabase.co';
process.env.SUPABASE_ANON_KEY='test-anon';
test('email endpoint refuses anonymous and invalid/inactive identities before contacting the mail provider', async () => {
  const originalFetch=globalThis.fetch;
  try {
    for(const mode of ['anonymous','invalid','inactive']) {
      globalThis.fetch=async input=> {
        const url=String(input);
        if(url.includes('/auth/v1/user')) return new Response(JSON.stringify(mode==='invalid'?{message:'invalid token'}:{id:'10000000-0000-0000-0000-000000000001'}),{status:mode==='invalid'?401:200,headers:{'content-type':'application/json'}});
        if(url.includes('/rest/v1/app_users')) return new Response(JSON.stringify({status:'Inactive'}),{headers:{'content-type':'application/json'}});
        throw Error('Mail provider must never be called');
      };
      const res=response();
      await email({method:'POST',headers:mode==='anonymous'?{}:{authorization:'Bearer test-user'},body:{}},res);
      assert.equal(res.code,mode==='inactive'?403:401);
    }
  } finally { globalThis.fetch=originalFetch; }
});
test('Supabase proxy rejects other projects, embedded credentials and unrelated paths', async () => {
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async()=>{throw Error('Untrusted destination must never be fetched');};
  try {
    for(const url of ['https://other.supabase.co/rest/v1/app_users','https://security-test.supabase.co/unrelated','https://user:pass@security-test.supabase.co/auth/v1/token']) {
      const res=response();
      await proxy({method:'POST',headers:{},body:{url,method:'GET'}},res);
      assert.equal(res.code,403);
    }
  } finally { globalThis.fetch=originalFetch; }
});
test('Supabase proxy does not follow redirects or cache auth responses', async () => {
  const originalFetch=globalThis.fetch;
  try {
    globalThis.fetch=async(_input,init)=> {
      assert.equal(init.redirect,'manual');
      return new Response('{}',{headers:{'content-type':'application/json'}});
    };
    const res=response();
    await proxy({method:'POST',headers:{},body:{url:'https://security-test.supabase.co/auth/v1/token',method:'POST'}},res);
    assert.equal(res.code,200);
    assert.equal(res.headers['Cache-Control'],'no-store');
  } finally { globalThis.fetch=originalFetch; }
});
