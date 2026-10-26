import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
async function load(path, aliases = {}) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', outputText)(id => aliases[id] ?? require(id), module, module.exports);
  return module.exports;
}
const site = JSON.parse(await readFile(new URL('../src/content/leadConsents.json', import.meta.url)));
const gift = JSON.parse(await readFile(new URL('../src/content/giftConsents.json', import.meta.url)));
const consent = await load('../src/lib/leadConsents.ts', { '@/content/leadConsents.json': site, '@/content/giftConsents.json': gift });
const { default: Fields } = await load('../src/components/lead-form/LeadConsentFields.tsx', { '@/lib/leadConsents': consent });
const render = (value = consent.EMPTY_LEAD_CONSENTS, errors = {}) => renderToStaticMarkup(createElement(Fields, { value, onChange() {}, errors }));

test('one required purpose-specific consent and an unchecked optional marketing choice', () => {
  const html = render();
  const inputs = html.match(/<input\b[^>]*>/g);
  assert.equal(inputs.length, 2);
  assert.match(inputs[0], /name="consent"/);
  assert.match(inputs[0], /required/);
  assert.match(inputs[1], /name="consent_marketing"/);
  assert.doesNotMatch(inputs[1], /required/);
  assert.doesNotMatch(html, /checked=""/);
  assert.match(html, /подбора тура и связи по моей заявке/);
});

test('the form links to the tour purpose and the marketing document based on the filled owner text in new tabs', () => {
  const html = render();
  assert.match(html, /href="\/consents\/personal-data" target="_blank"/);
  assert.match(html, /href="\/consents\/marketing" target="_blank"/);
  assert.equal(consent.LEAD_CONSENT_VERSION, site.version);
  assert.match(site.documents['personal-data'].paragraphs.join(' '), /на подбор путешествия/);
  assert.match(site.documents['personal-data'].paragraphs.join(' '), /Обратная связь входит в цель/);
});

test('marketing does not implicitly select the required consent and validation errors stay visible', () => {
  const html = render({ personalData: false, marketing: true }, { consent: ['Нужно согласие'], consent_version: ['old'] });
  const inputs = html.match(/<input\b[^>]*>/g);
  assert.doesNotMatch(inputs[0], /checked/);
  assert.match(inputs[1], /checked/);
  assert.match(html, /Нужно согласие/);
  assert.match(html, /Обновите страницу/);
});
