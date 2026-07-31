/* ==========================================================================
   What is a token? — exhibition display
   All data is pre-computed in assets/data.js. Nothing here talks to a server.
   ========================================================================== */

(function () {
  'use strict';

  var DATA = window.TOKEN_DEMO_DATA;
  if (!DATA) return;

  var USD_PER_GBP = 1.27; // stated in the footnotes
  var examples = DATA.examples;

  /* ── helpers ─────────────────────────────────────────────────────────── */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function pence(usd) {
    var p = (usd / USD_PER_GBP) * 100;
    if (p < 0.1) return p.toFixed(3) + 'p';
    if (p < 10) return p.toFixed(2) + 'p';
    return p.toFixed(1) + 'p';
  }

  function money(usd) {
    var gbp = usd / USD_PER_GBP;
    if (gbp < 1) return pence(usd);
    if (gbp < 1000) return '£' + gbp.toFixed(2);
    if (gbp < 1e6) return '£' + Math.round(gbp).toLocaleString('en-GB');
    return '£' + (gbp / 1e6).toFixed(1) + 'm';
  }

  function num(n) { return n.toLocaleString('en-GB'); }

  /* Render an array of token strings as chips — exactly one chip per token, so
     counting the chips always gives the number in the header.

     Two things are made visible rather than left invisible, because both
     surprise people and both change the count:
       · a leading space, which belongs to the token (" the" is one token,
         "the" at the very start of a text is a different one)
       ↵ a line break, which is a token in its own right */
  function renderTokens(container, tokens) {
    container.textContent = '';
    var frag = document.createDocumentFragment();

    for (var i = 0; i < tokens.length; i++) {
      var raw = tokens[i];
      var chip = el('span', 'tok');
      var text = raw;

      if (text.charAt(0) === ' ') {
        chip.appendChild(el('span', 'tok-mark', '·'));
        text = text.slice(1);
      }

      if (text.indexOf('\n') !== -1) {
        var segs = text.split('\n');
        for (var j = 0; j < segs.length; j++) {
          if (j > 0) chip.appendChild(el('span', 'tok-mark', '↵'));
          if (segs[j]) chip.appendChild(document.createTextNode(segs[j]));
        }
      } else if (text) {
        chip.appendChild(document.createTextNode(text));
      }

      frag.appendChild(chip);
      // Start a fresh row after a token that ends a line, so the shape of the
      // original text survives. This is a spacer, not a chip.
      if (raw.charAt(raw.length - 1) === '\n') frag.appendChild(el('span', 'rowbreak'));
    }

    container.appendChild(frag);
  }

  /* ── 1. static token example in the explainer ────────────────────────── */

  document.querySelectorAll('[data-static-tokens]').forEach(function (node) {
    try {
      renderTokens(node, JSON.parse(node.getAttribute('data-static-tokens')));
    } catch (e) { /* leave empty rather than break the page */ }
  });

  /* ── 2. the chooser + result panel ───────────────────────────────────── */

  var chooser = document.querySelector('.chooser');
  var result = document.getElementById('result');

  examples.forEach(function (ex, i) {
    var b = el('button', 'choice');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    b.setAttribute('aria-controls', 'result');
    b.appendChild(el('span', 'choice-label', ex.label));
    b.appendChild(el('span', 'choice-meta', pence(ex.costTotal)));
    b.addEventListener('click', function () { select(i); });
    chooser.appendChild(b);
  });

  function select(i) {
    var tabs = chooser.querySelectorAll('.choice');
    for (var k = 0; k < tabs.length; k++) {
      tabs[k].setAttribute('aria-selected', k === i ? 'true' : 'false');
    }
    renderResult(examples[i]);
    syncScalePicker(i);
  }

  /* A panel showing one body of text, switchable between plain words and the
     token chips it is made of. */
  function textPanel(opts) {
    var panel = el('div', 'panel');

    var head = el('div', 'panel-head');
    head.appendChild(el('span', 'panel-dot panel-dot--' + opts.kind));
    head.appendChild(el('h3', 'panel-title', opts.title));
    head.appendChild(el('span', 'panel-count', num(opts.tokens.length)));
    panel.appendChild(head);

    var tabs = el('div', 'viewtabs');
    var bTokens = el('button', 'viewtab', 'Tokens');
    var bWords = el('button', 'viewtab', 'Words');
    bWords.type = bTokens.type = 'button';
    tabs.appendChild(bTokens);
    tabs.appendChild(bWords);
    panel.appendChild(tabs);

    /* A bounded, scrollable pane rather than a clip-and-expand: both messages
       then stay on screen together, whatever their length. */
    var body = el('div', 'panel-body');
    body.tabIndex = 0;                       // keyboard-scrollable
    body.setAttribute('role', 'region');
    body.setAttribute('aria-label', opts.title);
    var plain = el('p', 'plaintext', opts.text);
    var toks = el('p', 'tokens tokens--' + opts.kind + (opts.big ? ' tokens--big' : ''));
    renderTokens(toks, opts.tokens);
    body.appendChild(plain);
    body.appendChild(toks);
    panel.appendChild(body);

    function setView(showTokens) {
      plain.hidden = showTokens;
      toks.hidden = !showTokens;
      bWords.setAttribute('aria-pressed', String(!showTokens));
      bTokens.setAttribute('aria-pressed', String(showTokens));
      body.scrollTop = 0;
    }
    bWords.addEventListener('click', function () { setView(false); });
    bTokens.addEventListener('click', function () { setView(true); });
    setView(opts.startOnTokens);

    return panel;
  }

  function meter(kind, value, label) {
    var m = el('div', 'meter meter--' + kind);
    m.appendChild(el('span', 'meter-num', value));
    m.appendChild(el('span', 'meter-lbl', label));
    return m;
  }

  function renderResult(ex) {
    result.textContent = '';

    // Headline and the three numbers share one row on wider screens, so the
    // two messages below stay visible at the same time.
    var summary = el('div', 'summary');
    summary.appendChild(el('p', 'blurb', ex.blurb));
    var meters = el('div', 'meters');
    meters.appendChild(meter('in', num(ex.inCount), 'your tokens'));
    meters.appendChild(meter('out', num(ex.outCount), 'AI tokens'));
    meters.appendChild(meter('total', pence(ex.costTotal), 'cost'));
    summary.appendChild(meters);
    result.appendChild(summary);

    var panels = el('div', 'panels');
    panels.appendChild(textPanel({
      kind: 'in',
      title: 'You asked',
      text: ex.prompt,
      tokens: ex.inTokens,
      startOnTokens: true,
      big: ex.inCount <= 60
    }));
    panels.appendChild(textPanel({
      kind: 'out',
      title: 'The AI replied',
      text: ex.answer,
      tokens: ex.outTokens,
      startOnTokens: true,
      big: false
    }));
    result.appendChild(panels);
  }

  /* ── 3. comparison chart ─────────────────────────────────────────────── */

  (function chart() {
    var legend = document.getElementById('legend');
    [['in', 'Your words'], ['out', 'The AI’s words']].forEach(function (s) {
      var item = el('div', 'legend-item');
      var sw = el('span', 'legend-swatch');
      sw.style.background = 'var(--series-' + s[0] + ')';
      item.appendChild(sw);
      item.appendChild(el('span', null, s[1]));
      legend.appendChild(item);
    });

    var host = document.getElementById('chart');
    var max = Math.max.apply(null, examples.map(function (e) { return e.costTotal; }));

    examples.forEach(function (ex) {
      var row = el('div', 'bar-row');
      row.appendChild(el('div', 'bar-label', ex.label));

      var track = el('div', 'bar-track');
      var si = el('div', 'bar-seg bar-seg--in');
      si.style.width = (ex.costIn / max) * 100 + '%';
      track.appendChild(si);
      var so = el('div', 'bar-seg bar-seg--out');
      so.style.width = (ex.costOut / max) * 100 + '%';
      track.appendChild(so);
      row.appendChild(track);

      row.appendChild(el('div', 'bar-value', pence(ex.costTotal)));
      host.appendChild(row);
    });

    // Accessible table alternative
    var table = document.getElementById('datatable');
    var thead = el('thead');
    var hr = el('tr');
    ['Question', 'Your tokens', 'AI tokens', 'Cost'].forEach(function (h) {
      hr.appendChild(el('th', null, h));
    });
    thead.appendChild(hr);
    table.appendChild(thead);

    var tbody = el('tbody');
    examples.forEach(function (ex) {
      var tr = el('tr');
      tr.appendChild(el('td', null, ex.label));
      tr.appendChild(el('td', null, num(ex.inCount)));
      tr.appendChild(el('td', null, num(ex.outCount)));
      tr.appendChild(el('td', null, pence(ex.costTotal)));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
  })();

  /* ── 4. scale ────────────────────────────────────────────────────────── */

  var scaleSelect = document.getElementById('scale-select');
  var scaleGrid = document.getElementById('scalegrid');

  examples.forEach(function (ex, i) {
    var o = el('option', null, ex.label);
    o.value = String(i);
    scaleSelect.appendChild(o);
  });

  var SCALES = [[1, 'once'], [100, '100 times'], [10000, '10,000 times'], [1000000, 'a million times']];

  function renderScale(i) {
    var ex = examples[i];
    scaleGrid.textContent = '';
    SCALES.forEach(function (s) {
      var li = el('li', 'scaleitem');
      li.appendChild(el('span', 'scaleitem-num', money(ex.costTotal * s[0])));
      li.appendChild(el('span', 'scaleitem-lbl', s[1]));
      scaleGrid.appendChild(li);
    });
  }

  function syncScalePicker(i) {
    scaleSelect.value = String(i);
    renderScale(i);
  }

  scaleSelect.addEventListener('change', function () {
    renderScale(Number(scaleSelect.value));
  });

  /* ── 5. try your own ─────────────────────────────────────────────────── */

  (function tryYourOwn() {
    var input = document.getElementById('tryinput');
    var status = document.getElementById('trystatus');
    var output = document.getElementById('tryoutput');
    var countBox = document.getElementById('trycount');
    var countNum = document.getElementById('trycount-num');
    var section = document.getElementById('try');

    var SEED = 'Tokenisation is unpredictable!';
    var tokeniser = null;
    var loading = false;
    var seeded = false;   // the box still holds our example text
    var timer = null;

    function update() {
      if (!tokeniser) return;
      var text = input.value;
      if (!text) { output.textContent = ''; countNum.textContent = '0'; return; }
      var ids = tokeniser.encode(text);
      renderTokens(output, ids.map(function (id) { return tokeniser.decode([id]); }));
      countNum.textContent = num(ids.length);
    }

    function load() {
      if (tokeniser || loading) return;
      loading = true;
      status.textContent = 'Loading…';
      var s = document.createElement('script');
      s.src = 'assets/tokeniser.js';
      s.onload = function () {
        tokeniser = window.GPTTokenizer_cl100k_base;
        if (!tokeniser) { s.onerror(); return; }
        loading = false;
        status.textContent = '';
        countBox.hidden = false;
        // Show something straight away so the section demonstrates itself.
        if (!input.value) { input.value = SEED; seeded = true; }
        update();
      };
      s.onerror = function () {
        loading = false;
        status.textContent = 'Sorry — that could not be loaded. The examples above still work.';
      };
      document.head.appendChild(s);
    }

    // Start fetching as the section nears the viewport, so it is ready by the
    // time anyone reaches it and there is nothing to press.
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) { io.disconnect(); load(); return; }
        }
      }, { rootMargin: '600px' });
      io.observe(section);
    } else {
      load();
    }

    // If someone reaches the box before the observer fires, start then instead.
    input.addEventListener('focus', function () {
      load();
      // Select the example so the first keystroke replaces it, rather than
      // making the visitor delete it by hand.
      if (seeded) { input.select(); seeded = false; }
    });

    input.addEventListener('input', function () {
      seeded = false;
      load();
      clearTimeout(timer);
      timer = setTimeout(update, 90);
    });
  })();

  /* ── 6. footnote date ────────────────────────────────────────────────── */

  var gen = document.getElementById('gen-date');
  if (gen && DATA.generated) {
    gen.textContent = new Date(DATA.generated + 'T00:00:00Z')
      .toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  }

  /* ── 7. scrolling without leaving a #hash behind ─────────────────────── */

  /* A reload should start at the top of the page, which means two things: no
     anchor in the URL to jump to, and no browser scroll restoration. */
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  function scrollToDemo() {
    var target = document.getElementById('demo');
    if (!target) return;
    var reduced = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }

  var heroBtn = document.getElementById('hero-cta');
  if (heroBtn) heroBtn.addEventListener('click', scrollToDemo);

  /* The skip link keeps its href so it still works without JavaScript, but when
     JS is available we move focus ourselves and skip the hash. */
  var skip = document.querySelector('.skip-link');
  if (skip) {
    skip.addEventListener('click', function (e) {
      var target = document.getElementById('demo');
      if (!target) return;
      e.preventDefault();
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      scrollToDemo();
    });
  }

  /* ── go ──────────────────────────────────────────────────────────────── */

  select(0);
})();
