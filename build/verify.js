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

    // One chip per token, always — otherwise counting the chips on screen
    // disagrees with the number in the header. Newline tokens used to vanish.
    let chipMismatch = [];
    data.examples.forEach((e, i) => {
      choices[i].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
      const a = d.querySelectorAll('.panels .tokens--in .tok').length;
      const b = d.querySelectorAll('.panels .tokens--out .tok').length;
      if (a !== e.inCount) chipMismatch.push(e.id + ' in ' + a + '!=' + e.inCount);
      if (b !== e.outCount) chipMismatch.push(e.id + ' out ' + b + '!=' + e.outCount);
    });
    choices[0].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    check('chips on screen equal the token count, every example',
      chipMismatch.length === 0, chipMismatch.join('; '));

    // Newline tokens must still be visible, not silently dropped.
    const nlExample = data.examples.findIndex((e) =>
      e.outTokens.some((t) => /^\n+$/.test(t)));
    check('newline tokens are shown, not dropped', nlExample >= 0 &&
      d.querySelectorAll('.panels .tokens--out .tok-mark').length > 0);

    console.log('\n— Switching examples —');
    choices[4].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    check('clicking a choice selects it',
      choices[4].getAttribute('aria-selected') === 'true');
    check('previous choice deselected',
      choices[0].getAttribute('aria-selected') === 'false');
    const answerPanel = d.querySelectorAll('.panel')[1];
    const expected = data.examples[4].answer.slice(0, 60);
    check('answer panel shows the new reply',
      answerPanel && answerPanel.textContent.includes(expected),
      'panel does not contain the cover-letter answer');
    check('scale picker followed the selection',
      d.getElementById('scale-select').value === '4');
    choices[0].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));

    console.log('\n— One-screen layout —');
    check('both messages share a .panels container',
      d.querySelectorAll('.panels .panel').length === 2);
    check('panel bodies are bounded scroll panes',
      /\.panel-body\s*\{[^}]*max-height:[^}]*overflow-y:\s*auto/.test(
        fs.readFileSync(path.join(ROOT, 'assets/styles.css'), 'utf8')));
    check('panels sit side by side on a wide screen',
      /@media \(min-width: 60rem\) \{ \.panels \{ grid-template-columns: 1fr 1fr/.test(
        fs.readFileSync(path.join(ROOT, 'assets/styles.css'), 'utf8')));
    check('no Show all button remains', !d.querySelector('.expand'));
    check('scroll panes are keyboard reachable',
      Array.from(d.querySelectorAll('.panel-body')).every((b) => b.tabIndex === 0));
    check('scroll panes are labelled for screen readers',
      Array.from(d.querySelectorAll('.panel-body')).every((b) =>
        b.getAttribute('role') === 'region' && b.getAttribute('aria-label')));

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
    // The lab's own site, distinct from the aGiTrack subdomain above.
    const lab = d.querySelector('.footer a[href="https://core-aix.org"]');
    check('footer links CORE-AIx Lab', !!lab,
      'no https://core-aix.org link in the footer');
    check('CORE-AIx link opens safely',
      lab && (lab.getAttribute('rel') || '').includes('noopener'));
    check('CORE-AIx link is named, not a bare URL',
      lab && /CORE-AIx/i.test(lab.textContent));

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

    // The examples must not read as any real or plausible named business.
    const corpus = html + fs.readFileSync(path.join(ROOT, 'assets/data.js'), 'utf8');
    const ENTITIES = [
      'Northgate', 'Riverbank', 'National Lottery', 'University of Exeter',
      'Okafor', 'Marlborough', 'Secure Saver',
    ];
    const found = ENTITIES.filter((n) => corpus.includes(n));
    check('no invented or real organisation names', found.length === 0,
      'found ' + found.join(', '));
    const suffixes = corpus.match(/\b[A-Z][A-Za-z]+ (?:Limited|Ltd|PLC|plc)\b/g) || [];
    check('no company-style names', suffixes.length === 0, suffixes.join(', '));
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

    // The chip colour must mean exactly one thing: who wrote the text.
    check('token chips use one flat colour per group',
      /\.tokens--in\s+\.tok \{ background: #[0-9a-f]{6}/.test(css) &&
      !/\.tok:nth-child/.test(css),
      'shade cycling still present');
    check('invisible characters are marked', /\.tok-mark/.test(css));

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

    console.log('\n— Icons —');
    const iconLink = d.querySelector('link[rel="icon"]');
    check('favicon is a real file, not an emoji data URI',
      iconLink && /^assets\/favicon\.svg$/.test(iconLink.getAttribute('href') || ''),
      'href=' + (iconLink && iconLink.getAttribute('href')));
    check('no emoji left in any icon reference', !/rel="(icon|apple-touch-icon)"[^>]*[\u{1F000}-\u{1FAFF}]/u.test(html));
    const touch = d.querySelector('link[rel="apple-touch-icon"]');
    check('apple-touch-icon declared', !!touch);
    check('apple-touch-icon file exists',
      touch && fs.existsSync(path.join(ROOT, touch.getAttribute('href'))));

    // The SVG and the PNG generator hold the same geometry in two places; make
    // sure an edit to one without the other cannot slip through.
    const svg = fs.readFileSync(path.join(ROOT, 'assets/favicon.svg'), 'utf8');
    const svgChips = Array.from(
      svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)
    ).map((m) => m.slice(1, 5).map(Number).join(','));
    const py = fs.readFileSync(path.join(ROOT, 'build/make-icons.py'), 'utf8');
    const pyChips = Array.from(
      py.matchAll(/\(\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(?:BLUE|ORANGE)\)/g)
    ).map((m) => m.slice(1, 5).map(Number).join(','));
    check('favicon.svg has 4 chips', svgChips.length === 4, 'found ' + svgChips.length);
    check('SVG and PNG generator geometry agree',
      svgChips.length > 0 && svgChips.join(' | ') === pyChips.join(' | '),
      'svg=[' + svgChips.join('] [') + '] py=[' + pyChips.join('] [') + ']');

    console.log('\n— Documentation split —');
    const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
    check('AGENTS.md exists', fs.existsSync(path.join(ROOT, 'AGENTS.md')));
    check('README points at AGENTS.md', /AGENTS\.md/.test(readme));
    // README is for visitors and adapters; implementation rationale lives in
    // AGENTS.md. These are the tells that internal notes have leaked back in.
    const internal = ['jsdom', 'IntersectionObserver', 'scrollRestoration',
                      'An earlier version', 'clamp(', 'nth-child', 'verify.js checks'];
    const leaked = internal.filter((t) => readme.includes(t));
    check('README stays outward-facing', leaked.length === 0,
      'internal detail in README: ' + leaked.join(', '));

    console.log('\n— Referenced files exist —');
    ['assets/styles.css', 'assets/app.js', 'assets/data.js', 'assets/tokeniser.js',
     'assets/favicon.svg', 'assets/apple-touch-icon.png']
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
