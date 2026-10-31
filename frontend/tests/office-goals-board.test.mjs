import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
async function load(path, aliases = {}) {
  const code = await fs.readFile(new URL(path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = {exports:{}};
  new Function('require','module','exports',compiled)(id => aliases[id] ?? require(id), module, module.exports);
  return module.exports;
}
const formats = await load('../src/lib/managementConversion.ts');
const managers = await load('../src/components/crm/ManagerConversion.tsx', {'@/lib/managementConversion':formats});
const {default:Board} = await load('../src/components/crm/OfficeGoalsBoard.tsx', {'@/lib/managementConversion':formats,'./ManagerConversion':managers});
const activity = (id,title,category='product',completed=false) => ({id,title,category,completed,target:'',note:''});
const goals = {year:2026,month:11,commission_basis:'cash_receipts',commission_receipts_actual:null,
  targets:{turnover:5000000,receipts:220000,leads:150,conversion:30,commissionRate:9,articles:5},
  activities:[...Array.from({length:5},(_,i)=>activity(`article-${i+1}`,`Статья ${i+1} из 5`)),activity('thailand-katya','Катя — Таиланд','development'),activity('maldives-elena','Елена — Мальдивы','development'),activity('mauritius-elena','Елена — Маврикий','development'),activity('business-breakfast','Бизнес-завтрак','development'),activity('crm','Доработать CRM'),activity('beauty-leaflets','Листовки для салонов красоты'),activity('card-katya','Визитка для Екатерины'),activity('card-elena','Визитка для Елены'),activity('resort-space','Старая ручная отметка','operators')],
  operator_progress:[{key:'russianExpress',name:'Русский Экспресс',target:1000000,amount:0,bookings_count:0,missing_count:0},{key:'resort',name:'Резорт',target:500000,amount:0,bookings_count:0,missing_count:0},{key:'space',name:'Спейс',target:500000,amount:0,bookings_count:0,missing_count:0}]};
const props={month:11,goals,data:null,loading:false,saving:false,receipts:'',error:'',saveMessage:'',onMonth(){},onReceipts(){},onSaveReceipts(){},onToggle(){},onRetry(){}};
const render=overrides=>renderToStaticMarkup(createElement(Board,{...props,...overrides}));

test('five article checkboxes belong to exactly one compact section',()=>{
  const html=render();
  const sections=html.match(/<section\b[\s\S]*?<\/section>/g);
  const articles=sections.filter(s=>s.includes('Статьи на сайт'));
  assert.equal(articles.length,1);
  assert.equal((articles[0].match(/type="checkbox"/g)||[]).length,5);
  assert.equal((html.match(/type="checkbox"/g)||[]).length,13);
  assert.doesNotMatch(html,/Старая ручная отметка/);
});
test('operators have automatic progress and distinct half-million targets',()=>{
  const html=render();
  const section=html.match(/<section\b[\s\S]*?<\/section>/g).find(s=>s.includes('Бронирования у туроператоров'));
  assert.equal((section.match(/<article/g)||[]).length,3);
  assert.match(section,/Резорт/); assert.match(section,/Спейс/);
  assert.doesNotMatch(section,/type="checkbox"/);
});
test('saving disables manual controls while unknown receipts stay empty',()=>{
  const html=render({saving:true});
  assert.equal((html.match(/type="checkbox" disabled=""/g)||[]).length,13);
  assert.match(html,/id="commission-receipts"[^>]*value=""/);
});
test('month selector reflects October and retains its archived tasks',()=>{
  const html=render({month:10,goals:{...goals,month:10,commission_basis:'bookings',activities:[activity('october-social','Instagram','social')],operator_progress:[]}});
  assert.match(html,/aria-pressed="true"[^>]*>Октябрь/);
  assert.match(html,/Instagram/);assert.doesNotMatch(html,/id="commission-receipts"/);
});

if(process.env.GOALS_PREVIEW_DIR){
  const output=process.env.GOALS_PREVIEW_DIR; await fs.mkdir(output,{recursive:true});
  const chunks=new URL('../.next/static/chunks/',import.meta.url); const css=[];
  for(const name of await fs.readdir(chunks)) if(name.endsWith('.css')) css.push(await fs.readFile(new URL(name,chunks),'utf8'));
  await fs.writeFile(`${output}/style.css`,css.join('\n'));
  await fs.writeFile(`${output}/index.html`,`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Предпросмотр раздела целей</title><link rel="stylesheet" href="style.css"><body style="font-family:Arial,sans-serif;margin:0;background:#f8fafd"><main style="max-width:1300px;margin:0 auto;padding:24px">${render()}</main></body></html>`);
}
