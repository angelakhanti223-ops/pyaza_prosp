import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
function loadApi(fetch){
 const source=fs.readFileSync(new URL('../src/lib/api.ts',import.meta.url),'utf8');
 const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 const module={exports:{}};
 new Function('module','exports','fetch','process',outputText)(module,module.exports,fetch,{env:{}});
 return module.exports;
}
test('all public submissions omit CRM cookies and preserve payload/endpoint',async()=>{
 const calls=[];const api=loadApi(async(url,init)=>{calls.push({url,init});return {ok:true};});
 const payload={name:'Тест',phone:'+79991234567',consent:true,consent_marketing:false,consent_version:'current'};
 await api.createLead(payload);await api.createGiftCertificateApplication({...payload,amount:25000});await api.subscribe({email:'test@example.com',consent:true});
 assert.deepEqual(calls.map(c=>new URL(c.url).pathname),['/api/leads/','/api/gift-certificates/','/api/subscribe/']);
 for(const {init}of calls){assert.equal(init.credentials,'omit');assert.equal(init.method,'POST');assert.equal(init.headers['Content-Type'],'application/json');}
 assert.deepEqual(JSON.parse(calls[0].init.body),payload);
});
test('server detail and field arrays are normalized to full visible messages',async()=>{
 const api=loadApi(async()=>({ok:false,json:async()=>({detail:'Слишком много запросов. Повторите позже.',phone:['Проверьте телефон']})}));
 await assert.rejects(()=>api.createLead({}),e=>{assert.ok(e instanceof api.ApiError);assert.deepEqual(e.fieldErrors.detail,['Слишком много запросов. Повторите позже.']);assert.deepEqual(e.fieldErrors.phone,['Проверьте телефон']);return true;});
});
test('HTML/non-JSON server errors become fallback-compatible ApiError',async()=>{
 const api=loadApi(async()=>({ok:false,json:async()=>{throw Error('HTML error page');}}));
 await assert.rejects(()=>api.subscribe({}),e=>{assert.ok(e instanceof api.ApiError);assert.deepEqual(e.fieldErrors,{});return true;});
});
test('network failure rejects and never reports success',async()=>{
 const api=loadApi(async()=>{throw Error('offline');});await assert.rejects(()=>api.createGiftCertificateApplication({}),/offline/);
});
