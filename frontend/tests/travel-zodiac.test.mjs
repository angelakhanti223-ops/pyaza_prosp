import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const data = JSON.parse(fs.readFileSync(new URL('../src/content/travelHoroscope2027.json', import.meta.url), 'utf8'));
const source = fs.readFileSync(new URL('../src/lib/travelZodiac.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
const mod = { exports: {} };
new Function('require', 'module', 'exports', outputText)(id => {
  assert.equal(id, '@/content/travelHoroscope2027.json');
  return data;
}, mod, mod.exports);
const { zodiacForBirthDate, horoscopeLeadComment } = mod.exports;
const now = new Date(2026, 10, 2, 12);

test('every transition uses the supplied calendar intervals, including the new-year wrap', () => {
  const boundaries = [
    ['01-19', 'capricorn'], ['01-20', 'aquarius'], ['02-18', 'aquarius'], ['02-19', 'pisces'],
    ['03-20', 'pisces'], ['03-21', 'aries'], ['04-19', 'aries'], ['04-20', 'taurus'],
    ['05-20', 'taurus'], ['05-21', 'gemini'], ['06-20', 'gemini'], ['06-21', 'cancer'],
    ['07-22', 'cancer'], ['07-23', 'leo'], ['08-22', 'leo'], ['08-23', 'virgo'],
    ['09-22', 'virgo'], ['09-23', 'libra'], ['10-22', 'libra'], ['10-23', 'scorpio'],
    ['11-21', 'scorpio'], ['11-22', 'sagittarius'], ['12-21', 'sagittarius'], ['12-22', 'capricorn'],
    ['12-31', 'capricorn'], ['01-01', 'capricorn'],
  ];
  for (const [date, id] of boundaries) assert.equal(zodiacForBirthDate(`2000-${date}`, now)?.id, id, date);
});

test('all 366 days have exactly one sign and a populated travel forecast', () => {
  const found = new Set();
  for (let day = new Date(2000, 0, 1); day.getFullYear() === 2000; day.setDate(day.getDate() + 1)) {
    const monthDay = (day.getMonth() + 1) * 100 + day.getDate();
    assert.equal(data.filter(s => s.start <= s.end ? monthDay >= s.start && monthDay <= s.end : monthDay >= s.start || monthDay <= s.end).length, 1);
    const date = `2000-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    const sign = zodiacForBirthDate(date, now);
    assert.ok(sign?.intro && sign?.window && sign?.routes.length >= 4, date);
    found.add(sign.id);
  }
  assert.equal(found.size, 12);
});

test('rejects impossible, partial and future dates; handles leap-year century rules', () => {
  for (const value of ['', '2000-2-09', '2000-02', '2000-00-01', '2000-13-01', '2000-04-31', '1900-02-29', '2001-02-29', '0000-01-01', '2026-11-03', '9999-01-01', 'not-a-date']) assert.equal(zodiacForBirthDate(value, now), null, value);
  assert.equal(zodiacForBirthDate('2000-02-29', now)?.id, 'pisces');
  assert.equal(zodiacForBirthDate('2026-11-02', now)?.id, 'scorpio');
});

test('CTA carries the selected sign and route, without a birthday', () => {
  const sign = zodiacForBirthDate('1984-03-21', now);
  const comment = horoscopeLeadComment(sign, sign.routes[0].title);
  assert.match(comment, /Овен/);
  assert.ok(comment.includes(sign.routes[0].title));
  assert.doesNotMatch(comment, /1984|03-21|21\.03/);
});
