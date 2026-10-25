import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
async function loadModule(path, aliases = {}) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', outputText)(id => aliases[id] ?? require(id), module, module.exports);
  return module.exports;
}
const formats = await loadModule('../src/lib/managementConversion.ts');
const { default: ManagerConversion } = await loadModule('../src/components/crm/ManagerConversion.tsx', { '@/lib/managementConversion': formats });
const manager = (id, name, incoming, sold, rate, old = 0) => ({ manager_id: id, manager_name: name, new_leads: incoming, sold, conversion_percent: rate, previous_period_sales_count: old });
const render = (rows, office) => renderToStaticMarkup(createElement(ManagerConversion, { rows, office, periodLabel: 'Текущий месяц' }));
const rowTexts = html => (html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/g) ?? []).map(row => row.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '));

test('manager bases, rates and office comparison are visible without averaging percentages', () => {
  const html = render([manager(1, 'Елена', 1, 1, 100), manager(2, 'Екатерина', 4, 1, 25, 1)], {incoming_count:5,sold_count:2,percent:40,previous_period_sales_count:1});
  const rows = rowTexts(html);
  assert.match(rows.find(row=>row.includes('Елена')), /1 1 0 100% \+60 п\.п\./);
  assert.match(rows.find(row=>row.includes('Екатерина')), /4 1 1 25% -15 п\.п\./);
  assert.match(rows.find(row=>row.includes('Всего по офису')), /5 2 1 40%/);
  assert.doesNotMatch(html, /62,5%/);
});

test('unassigned and old sales with zero incoming remain visible while inactive rows are hidden', () => {
  const html = render([manager(null, 'Не назначен', 1, 0, 0),manager(1,'Елена',0,1,null,1),manager(2,'Без активности',0,0,null)], {incoming_count:1,sold_count:1,percent:100,previous_period_sales_count:1});
  const rows = rowTexts(html);
  assert.match(rows.find(row=>row.includes('Елена')), /0 1 1 — —/);
  assert.match(rows[rows.length-2], /Без ответственного/);
  assert.doesNotMatch(html, /Без активности/);
});

test('an empty period shows an explanation and no invented percentage', () => {
  const html = render([], {incoming_count:0,sold_count:0,percent:null,previous_period_sales_count:0});
  assert.match(html, /нет входящих и продаж/);
  assert.match(rowTexts(html).at(-1), /0 0 0 — —/);
  assert.equal(formats.formatConversionDifference(null, 40), '—');
  assert.equal(formats.formatConversionDifference(16.7, 16.7), '0 п.п.');
});
