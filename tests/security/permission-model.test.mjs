import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
const module={exports:{}};
new Function('module','exports',ts.transpileModule(readFileSync(new URL('../../src/lib/permission-model.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(module,module.exports);
const {roleDefaults,mergeDefaultsWithOverrides,grantAllows,validPermissionKey}=module.exports;
test('create/edit/delete/export rights are independent and View off denies all actions',()=>{
 const values=mergeDefaultsWithOverrides('user',{assets:{v:true,c:false,e:true,d:false,x:false}});
 for(const action of ['create','delete','export'])assert.equal(grantAllows(values.assets,action),false);
 assert.equal(grantAllows(values.assets,'edit'),true);
 assert.equal(grantAllows({...values.assets,v:false},'edit'),false);
 assert.equal(grantAllows(undefined,'view'),false);
});
test('manager role does not imply access to all properties; arbitrary feature keys default to denied',()=>{
 assert.equal(grantAllows(roleDefaults('manager').all_properties,'view'),false);
 assert.equal(grantAllows(roleDefaults('user').unmapped_feature,'view'),false);
 assert.equal(validPermissionKey('stock_checks'),true);assert.equal(validPermissionKey('../private'),false);
 assert.equal(validPermissionKey('x'.repeat(65)),false);
});
test('administrator security ownership cannot be removed by a page override',()=>{
 const value=mergeDefaultsWithOverrides('admin',{users:{v:false,e:false}});
 assert.equal(grantAllows(value.users,'edit'),true);
});
test('fresh-install database defaults match the frontend permission catalog',()=>{
 const sql=readFileSync(new URL('../../schema.sql',import.meta.url),'utf8');
 const body=sql.split('CREATE FUNCTION public.app_permission_defaults(')[1].split('-- Name:')[0];
 const values=[...body.matchAll(/'(\{"dashboard".*?\})'::jsonb/g)].map(match=>JSON.parse(match[1]));
 assert.equal(values.length,3);
 for(const [i,role] of ['admin','manager','user'].entries())assert.deepEqual(values[i],roleDefaults(role));
});
