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
  // jsdom implements neither of these, so the page's feature guards would skip
  // the real code paths. Stub them at their browser defaults so the paths run.
  beforeParse(w) {
    w.history.scrollRestoration = 'auto';
    w.Element.prototype.scrollIntoView = function () {};
  },
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
    check('static token example present', staticBlocks.length === 1,
      'found ' + staticBlocks.length);
    let allFilled = true;
    staticBlocks.forEach((b) => { if (b.querySelectorAll('.tok').length === 0) allFilled = false; });
    check('all static token examples rendered chips', allFilled);

    console.log('\n— Chooser & result —');
    const choices = d.querySelectorAll('.choice');
    check('5 choice buttons rendered', choices.length === 5, 'found ' + choices.length);
    check('first choice is selected', choices[0] &&
      choices[0].getAttribute('aria-selected') === 'true');
    check('result panel has 3 meters', d.querySelectorAll('.meter').length === 3);
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
    check('data table has 4 headers',
      d.querySelectorAll('#datatable thead th').length === 4);

    console.log('\n— Scale —');
    check('scale select has 5 options',
      d.querySelectorAll('#scale-select option').length === 5);
    check('4 scale cards rendered', d.querySelectorAll('.scaleitem').length === 4);
    const scaleText = d.getElementById('scalegrid').textContent;
    check('scale shows a million-times figure', /million|£[\d,]{4,}/.test(scaleText) ||
      scaleText.includes('a million times'));

    console.log('\n— Try your own —');
    check('textarea present', !!d.getElementById('tryinput'));
    check('no Start button to press', !d.getElementById('tryload'));

    console.log('\n— aGiTrack —');
    const agiLinks = Array.from(d.querySelectorAll('a[href*="agitrack.core-aix.org"]'));
    check('aGiTrack is linked', agiLinks.length >= 1, 'found ' + agiLinks.length);
    check('aGiTrack links open safely', agiLinks.every((a) =>
      a.getAttribute('rel') && a.getAttribute('rel').includes('noopener')));
    check('aGiTrack has a prominent button',
      !!d.querySelector('.agicard .btn-primary'));
    check('footer does NOT link aGiTrack',
      !d.querySelector('.footer a[href*="agitrack"]'));

    console.log('\n— Footnotes —');
    check('generated date filled in',
      /\d{4}/.test(d.getElementById('gen-date').textContent));

    console.log('— Exhibition requirements —');
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(ROOT, 'assets/styles.css'), 'utf8');
    check('declared dark colour scheme',
      /<meta name="color-scheme" content="dark">/.test(html));
    check('no light-mode styling remains',
      !/prefers-color-scheme:\s*light/.test(css));
    check('no non-Devon place names anywhere',
      !/Sheffield|Rotherham|\bLeeds\b/.test(html + fs.readFileSync(path.join(ROOT, 'assets/data.js'), 'utf8')));
    check('Exeter is referenced', /Exeter/.test(html));
    // The explainer states a word and token count in prose; keep them true.
    const ex1 = JSON.parse(staticBlocks[0].getAttribute('data-static-tokens'));
    const sentence = ex1.join('');
    const wordCount = sentence.replace(/[.]/g, '').trim().split(/\s+/).filter(Boolean).length;
    const claim = d.querySelector('#what .oneline').textContent;
    const NUMS = { two: 2, three: 3, four: 4, five: 5, six: 6,
                   seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
    const claimedWords = NUMS[(claim.match(/(\w+) words/i) || [])[1]?.toLowerCase()];
    const claimedTokens = NUMS[(claim.match(/(\w+) tokens/i) || [])[1]?.toLowerCase()];
    check('explainer word count claim is true', claimedWords === wordCount,
      'claims ' + claimedWords + ', actually ' + wordCount);
    check('explainer token count claim is true', claimedTokens === ex1.length,
      'claims ' + claimedTokens + ', actually ' + ex1.length);
    // Prose the visitor reads as page furniture, excluding the collapsed
    // footnotes and the demo content itself.
    const prose = Array.from(d.querySelectorAll('.hero p, .section > .wrap > h2, .oneline'))
      .map((n) => n.textContent.trim()).join(' ');
    const words = prose.split(/\s+/).filter(Boolean).length;
    check('standing prose under 120 words', words < 120, words + ' words');

    check('no fade-out gradient on clipped text',
      !/\.clip::after/.test(css) && !/linear-gradient\(transparent/.test(css));

    // Every line that must never wrap is sized against the viewport. Check the
    // budget for real: characters x ~0.55em average advance has to fit BOTH the
    // ~90vw available between the gutters on a phone AND the 64rem .wrap cap on
    // a large display. This catches someone lengthening a sentence or bumping a
    // font size without re-checking.
    const AVG = 0.55;
    const maxwRem = parseFloat((css.match(/--maxw:\s*([\d.]+)rem/) || [])[1]);
    const WRAP_PX = maxwRem * 16 - 80;   // .wrap max-width minus its padding
    const MARGIN = 0.9;                  // require 10% headroom, not a bare fit

    function clampFor(rule) {
      const re = new RegExp('\\' + rule +
        '\\s*\\{[^}]*font-size:\\s*clamp\\(\\s*[\\d.]+rem\\s*,\\s*([\\d.]+)vw\\s*,\\s*([\\d.]+)rem');
      const m = css.match(re);
      return m ? { vw: parseFloat(m[1]), maxPx: parseFloat(m[2]) * 16 } : null;
    }

    check('no-wrap lines declare white-space: nowrap',
      /\.lede-line[^}]*nowrap/.test(css) && /\.oneline\s*\{[^}]*nowrap/.test(css));
    check('.oneline no longer capped by max-width',
      !/\.oneline\s*\{[^}]*max-width:\s*\d+ch/.test(css));

    [['.lede', '.lede-line'],
     ['.oneline', '#what .oneline, #compare .oneline'],
     ['.oneline--muted', '#try .oneline--muted']].forEach(function (pair) {
      const cl = clampFor(pair[0]);
      if (!cl) { check('clamp readable for ' + pair[0], false); return; }
      d.querySelectorAll(pair[1]).forEach(function (node) {
        const chars = node.textContent.replace(/\s+/g, ' ').trim().length;
        const vwNeed = chars * AVG * cl.vw;
        const pxNeed = chars * AVG * cl.maxPx;
        check('fits one line: "' + node.textContent.replace(/\s+/g, ' ').trim().slice(0, 34) + '…"',
          vwNeed <= 90 * MARGIN && pxNeed <= WRAP_PX * MARGIN,
          chars + ' chars needs ' + vwNeed.toFixed(0) + 'vw of 90vw and ' +
          pxNeed.toFixed(0) + 'px of ' + WRAP_PX + 'px');
      });
    });

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

    console.log('\n— Reload returns to the top —');
    const heroBtn = d.getElementById('hero-cta');
    check('hero CTA is a button, not a link', heroBtn && heroBtn.tagName === 'BUTTON');
    check('hero CTA has no href', heroBtn && !heroBtn.hasAttribute('href'));
    check('browser scroll restoration disabled',
      dom.window.history.scrollRestoration === 'manual',
      'is ' + dom.window.history.scrollRestoration);
    heroBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    check('clicking hero CTA leaves no #hash',
      !dom.window.location.hash, 'hash=' + dom.window.location.hash);
    const skipEv = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
    d.querySelector('.skip-link').dispatchEvent(skipEv);
    check('skip link keeps href as a no-JS fallback',
      d.querySelector('.skip-link').getAttribute('href') === '#demo');
    check('skip link suppresses the hash when JS runs', skipEv.defaultPrevented);
    check('skip link still moves focus to the demo',
      d.activeElement && d.activeElement.id === 'demo',
      'focus on ' + (d.activeElement && (d.activeElement.id || d.activeElement.tagName)));

    console.log('\n— Referenced files exist —');
    ['assets/styles.css', 'assets/app.js', 'assets/data.js', 'assets/tokeniser.js']
      .forEach((f) => check(f + ' exists', fs.existsSync(path.join(ROOT, f))));

    return lazyLoadChecks();
  })
  .then(() => {
    console.log('\n────────────────────────────');
    console.log(`  ${passed} passed, ${failed} failed`);
    console.log('────────────────────────────\n');
    process.exit(failed === 0 ? 0 : 1);
  })
  .catch((e) => { console.error('verify crashed:', e); process.exit(1); });

/* jsdom has no IntersectionObserver, so the main run above exercises the
   fallback. Stub one in to test the path real visitors actually get: the
   tokeniser must NOT be fetched on load, but must arrive by itself — with no
   click — once the section comes near the viewport. */
function lazyLoadChecks() {
  console.log('\n— Tokeniser auto-loads (no button) —');
  let observed = null, opts = null, inst = null;
  return JSDOM.fromFile(path.join(ROOT, 'index.html'), {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
    virtualConsole: new VirtualConsole(),
    beforeParse(w) {
      w.IntersectionObserver = function (cb, o) {
        opts = o; inst = this;
        this.observe = (el) => { observed = el; };
        this.disconnect = () => { this._off = true; };
        this._fire = () => cb([{ isIntersecting: true }]);
      };
    },
  })
    .then((dom) => new Promise((r) => setTimeout(() => r(dom), 1200)))
    .then((dom) => {
      check('watches the try-your-own section', observed && observed.id === 'try');
      check('starts fetching before the section is on screen',
        opts && /\d+px/.test(opts.rootMargin || ''), 'rootMargin=' + (opts && opts.rootMargin));
      check('tokeniser NOT fetched on page load', !dom.window.GPTTokenizer_cl100k_base);
      inst._fire();
      return new Promise((r) => setTimeout(() => r(dom), 9000));
    })
    .then((dom) => {
      const d = dom.window.document;
      check('observer disconnects after firing', !!inst._off);
      check('tokeniser loads with no interaction', !!dom.window.GPTTokenizer_cl100k_base);
      check('tokens shown without typing',
        d.querySelectorAll('#tryoutput .tok').length > 0);
      // And typing updates them live.
      const inp = d.getElementById('tryinput');
      inp.value = 'Exeter';
      inp.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      return new Promise((r) => setTimeout(() => r(d), 400));
    })
    .then((d) => {
      const chips = Array.from(d.querySelectorAll('#tryoutput .tok')).map((t) => t.textContent);
      check('typing re-tokenises live', chips.join('') === 'Exeter' && chips.length === 2,
        JSON.stringify(chips));
    });
}
