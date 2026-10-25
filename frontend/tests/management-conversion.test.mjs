import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/lib/managementConversion.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const { formatConversionPercent, conversionExplanation } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('both views can show identical one-decimal percentages with no extra rounding', () => {
  assert.equal(formatConversionPercent(16.7), '16,7%');
  assert.equal(formatConversionPercent(0), '0%');
  assert.equal(formatConversionPercent(200), '200%');
  assert.equal(formatConversionPercent(null), '—');
});

test('the displayed base identifies previous-period sales and undefined denominator', () => {
  const text = conversionExplanation({sold_count:2,incoming_count:0,percent:null,previous_period_sales_count:2});
  assert.match(text, /Продажи периода: 2/);
  assert.match(text, /входящие периода: 0/);
  assert.match(text, /прошлых периодов: 2/);
  assert.match(text, /не рассчитывается/);
});
