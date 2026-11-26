import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';

const helperUrl = new URL('../src/lib/busTourRequest.ts', import.meta.url);
const source = fs.readFileSync(helperUrl, 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
const exports = {};
vm.runInNewContext(output, { exports, require: createRequire(helperUrl), Intl });
const { busTourRequestComment } = exports;
const tours = JSON.parse(fs.readFileSync(new URL('../public/bus-assets/winter-2026-2027/tours.json', import.meta.url)));

test('every catalogue tour resolves to its exact name, dates, route and price', () => {
  assert.equal(tours.length, 80);
  assert.equal(new Set(tours.map(t => t.id)).size, 80);
  for (const tour of tours) {
    const comment = busTourRequestComment(String(tour.id));
    assert.equal(comment, [
      `Интересует автобусный тур: «${tour.title}».`,
      `Даты выезда: ${tour.date} (зима 2026–2027).`,
      `Маршрут: ${tour.route}.`,
      `Стоимость: от ${new Intl.NumberFormat('ru-RU').format(tour.price)} ₽ за человека.`,
    ].join('\n'));
  }
});

test('invalid, repeated and unknown IDs do not prefill unrelated information', () => {
  for (const id of [undefined, '', '0', '-1', '81', '999', '1.5', '01', '1e0', '1/../../', ' 1', '<script>', ['1', '2'], '1000']) {
    assert.equal(busTourRequestComment(id), undefined);
  }
});

test('similar tour names on different dates remain distinct by catalogue ID', () => {
  assert.notEqual(busTourRequestComment('26'), busTourRequestComment('27'));
  assert.match(busTourRequestComment('26'), /Саранск театральный/);
  assert.match(busTourRequestComment('27'), /Саранск театральный/);
});
