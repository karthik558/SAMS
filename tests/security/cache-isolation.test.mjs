import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
function load() {
  const module={exports:{}};
  const code=ts.transpileModule(readFileSync(new URL('../../src/lib/data-cache.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  new Function('module','exports',code)(module,module.exports);
  return module.exports;
}
test('an earlier account request cannot repopulate the cache after identity invalidation',async()=>{
  const cache=load();let resolveOld;
  const old=cache.getCachedValue('assets',()=>new Promise(resolve=>{resolveOld=resolve;}));
  cache.clearCache();
  await cache.getCachedValue('assets',async()=>['new account']);
  resolveOld(['old account']);await old;
  assert.deepEqual(cache.peekCachedValue('assets'),['new account']);
});
test('a failed earlier request cannot evict the new account cache',async()=>{
  const cache=load();let rejectOld;
  const old=cache.getCachedValue('assets',()=>new Promise((_resolve,reject)=>{rejectOld=reject;}));
  cache.clearCache();
  await cache.getCachedValue('assets',async()=>['new account']);
  rejectOld(new Error('Old session'));await assert.rejects(old);
  assert.deepEqual(cache.peekCachedValue('assets'),['new account']);
});
