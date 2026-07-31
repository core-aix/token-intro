#!/usr/bin/env node
// Loads index.html in a headless DOM, runs the real page scripts, and asserts
// that everything the exhibition depends on actually rendered.
// Run: node build/verify.js   (from the repo root)

const path = require('path');
const fs = require('fs');
const { JSDOM, VirtualConsole } = require(
  path.join(process.env.SCRATCH || '', 'node_modules', 'jsdom')
);

const ROOT = path.join(__dirname, '..');

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errors.push('jsdomError: ' + (e.stack || e.message)));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

let passed = 0;
let failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  — ' + detail : '')); }
}

JSDOM.fromFile(path.join(ROOT, 'index.html'), {
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true,
  virtualConsole: vc,
}).then((dom) => new Promise((r) => setTimeout(() => r(dom), 1500)))
  .then((dom) => {
    const d = dom.window.document;
    const data = dom.window.TOKEN_DEMO_DATA;

    console.log('\n— Script execution —');
    check('no uncaught script errors', errors.length === 0, errors.join(' | '));
    check('data.js exposed TOKEN_DEMO_DATA', !!data);
    check('five examples present', data && data.examples.length === 5);

    console.log('\n— Explainer —');
    const staticBlocks = d.querySelectorAll('[data-static-tokens]');
    check('4 static token examples present', staticBlocks.length === 4,
      'found ' + staticBlocks.length);
    let allFilled = true;
    staticBlocks.forEach((b) => { if (b.querySelectorAll('.tok').length === 0) allFilled = false; });
    check('all static token examples rendered chips', allFilled);

    console.log('\n— Chooser & result —');
    const choices = d.querySelectorAll('.choice');
    check('5 choice buttons rendered', choices.length === 5, 'found ' + choices.length);
    check('first choice is selected', choices[0] &&
      choices[0].getAttribute('aria-selected') === 'true');
    check('result panel has meters', d.querySelectorAll('.meter').length === 4);
    check('result panel has 2 text panels', d.querySelectorAll('.panel').length === 2);
    const inChips = d.querySelectorAll('.tokens--in .tok').length;
    check('prompt token chips rendered', inChips > 0, 'chips=' + inChips);
    const outChips = d.querySelectorAll('.tokens--out .tok').length;
    check('answer token chips rendered', outChips > 0, 'chips=' + outChips);

    console.log('\n— Switching examples —');
    choices[4].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    check('clicking a choice selects it',
      choices[4].getAttribute('aria-selected') === 'true');
    check('previous choice deselected',
      choices[0].getAttribute('aria-selected') === 'false');
    const answerPanel = d.querySelectorAll('.panel')[1];
    check('answer panel shows the new reply',
      answerPanel && answerPanel.textContent.includes('Riverbank'),
      'panel text did not mention the cover-letter content');
    check('scale picker followed the selection',
      d.getElementById('scale-select').value === '4');
    choices[0].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));

    console.log('\n— Chart —');
    check('5 bar rows rendered', d.querySelectorAll('.bar-row').length === 5);
    check('legend has 2 entries', d.querySelectorAll('.legend-item').length === 2);
    const segs = d.querySelectorAll('.bar-seg');
    check('bar segments have widths', segs.length >= 5 &&
      Array.from(segs).every((s) => /%$/.test(s.style.width)));
    check('data table has 5 body rows',
      d.querySelectorAll('#datatable tbody tr').length === 5);
    check('data table has 6 headers',
      d.querySelectorAll('#datatable thead th').length === 6);

    console.log('\n— Scale —');
    check('scale select has 5 options',
      d.querySelectorAll('#scale-select option').length === 5);
    check('4 scale cards rendered', d.querySelectorAll('.scaleitem').length === 4);
    const scaleText = d.getElementById('scalegrid').textContent;
    check('scale shows a million-times figure', /million|£[\d,]{4,}/.test(scaleText) ||
      scaleText.includes('a million times'));

    console.log('\n— Try your own —');
    check('load button present', !!d.getElementById('tryload'));
    check('textarea present', !!d.getElementById('tryinput'));

    console.log('\n— aGiTrack —');
    const agiLinks = Array.from(d.querySelectorAll('a[href*="agitrack.core-aix.org"]'));
    check('aGiTrack linked at least twice', agiLinks.length >= 2,
      'found ' + agiLinks.length);
    check('aGiTrack links open safely', agiLinks.every((a) =>
      a.getAttribute('rel') && a.getAttribute('rel').includes('noopener')));
    check('aGiTrack has a prominent button',
      !!d.querySelector('.agicard .btn-primary'));

    console.log('\n— Footnotes —');
    check('generated date filled in',
      /\d{4}/.test(d.getElementById('gen-date').textContent));

    console.log('\n— Accessibility basics —');
    check('lang is en-GB', d.documentElement.getAttribute('lang') === 'en-GB');
    check('page has one h1', d.querySelectorAll('h1').length === 1);
    check('viewport meta present', !!d.querySelector('meta[name="viewport"]'));
    check('skip link present', !!d.querySelector('.skip-link'));
    check('textarea has a label',
      !!d.querySelector('label[for="tryinput"]'));
    const imgs = d.querySelectorAll('img');
    check('no images without alt text',
      Array.from(imgs).every((i) => i.hasAttribute('alt')));

    console.log('\n— Referenced files exist —');
    ['assets/styles.css', 'assets/app.js', 'assets/data.js', 'assets/tokeniser.js']
      .forEach((f) => check(f + ' exists', fs.existsSync(path.join(ROOT, f))));

    console.log('\n────────────────────────────');
    console.log(`  ${passed} passed, ${failed} failed`);
    console.log('────────────────────────────\n');
    process.exit(failed === 0 ? 0 : 1);
  })
  .catch((e) => { console.error('verify crashed:', e); process.exit(1); });
