/* ==========================================================================
   What is a token? — exhibition demo
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

  /* Render an array of token strings as chips. Newlines become row breaks so
     the shape of the original text stays readable. */
  function renderTokens(container, tokens) {
    container.textContent = '';
    var frag = document.createDocumentFragment();
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      var parts = t.split('\n');
      for (var j = 0; j < parts.length; j++) {
        if (j > 0) frag.appendChild(el('span', 'tok tok--nl'));
        if (parts[j] === '' && parts.length > 1) continue;
        var chip = el('span', 'tok', parts[j] === '' ? ' ' : parts[j]);
        frag.appendChild(chip);
      }
    }
    container.appendChild(frag);
  }

  /* ── 1. static token examples in the explainer ───────────────────────── */

  document.querySelectorAll('[data-static-tokens]').forEach(function (node) {
    try {
      renderTokens(node, JSON.parse(node.getAttribute('data-static-tokens')));
    } catch (e) { /* leave empty rather than break the page */ }
  });

  /* ── 2. the chooser + result panel ───────────────────────────────────── */

  var chooser = document.querySelector('.chooser');
  var result = document.getElementById('result');
  var current = 0;

  examples.forEach(function (ex, i) {
    var b = el('button', 'choice');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    b.setAttribute('aria-controls', 'result');
    b.appendChild(el('span', 'choice-label', ex.label));
    b.appendChild(el('span', 'choice-meta',
      num(ex.inCount) + ' in · ' + num(ex.outCount) + ' out · ' + pence(ex.costTotal)));
    b.addEventListener('click', function () { select(i); });
    chooser.appendChild(b);
  });

  function select(i) {
    current = i;
    var tabs = chooser.querySelectorAll('.choice');
    for (var k = 0; k < tabs.length; k++) {
      tabs[k].setAttribute('aria-selected', k === i ? 'true' : 'false');
    }
    renderResult(examples[i]);
    syncScalePicker(i);
  }

  /* A panel showing one body of text, switchable between plain words and
     the token chips it is made of. */
  function textPanel(opts) {
    var panel = el('div', 'panel');

    var head = el('div', 'panel-head');
    head.appendChild(el('span', 'panel-dot panel-dot--' + opts.kind));
    head.appendChild(el('h3', 'panel-title', opts.title));
    head.appendChild(el('span', 'panel-count', num(opts.tokens.length) + ' tokens'));
    panel.appendChild(head);

    var tabs = el('div', 'viewtabs');
    var bWords = el('button', 'viewtab', 'Words');
    var bTokens = el('button', 'viewtab', 'Tokens');
    bWords.type = bTokens.type = 'button';
    tabs.appendChild(bWords);
    tabs.appendChild(bTokens);
    panel.appendChild(tabs);

    var body = el('div', 'panel-body');
    var clip = el('div', 'clip');
    var plain = el('p', 'plaintext', opts.text);
    var toks = el('p', 'tokens tokens--' + opts.kind);
    renderTokens(toks, opts.tokens);
    clip.appendChild(plain);
    clip.appendChild(toks);
    body.appendChild(clip);

    var expand = el('button', 'expand', 'Show all');
    expand.type = 'button';
    expand.addEventListener('click', function () {
      var open = clip.classList.toggle('open');
      expand.textContent = open ? 'Show less' : 'Show all';
    });
    body.appendChild(expand);
    panel.appendChild(body);

    // Only offer the expander when there is genuinely something clipped. The
    // two views have different heights, so re-check whenever the view changes.
    function syncExpand() {
      if (clip.classList.contains('open')) { expand.hidden = false; return; }
      expand.hidden = clip.scrollHeight <= clip.clientHeight + 4;
    }

    function setView(showTokens) {
      plain.hidden = showTokens;
      toks.hidden = !showTokens;
      bWords.setAttribute('aria-pressed', String(!showTokens));
      bTokens.setAttribute('aria-pressed', String(showTokens));
      requestAnimationFrame(syncExpand);
    }
    bWords.addEventListener('click', function () { setView(false); });
    bTokens.addEventListener('click', function () { setView(true); });
    setView(opts.startOnTokens);

    return panel;
  }

  function meter(kind, value, label, sub) {
    var m = el('div', 'meter meter--' + kind);
    m.appendChild(el('span', 'meter-num', value));
    m.appendChild(el('span', 'meter-lbl', label));
    if (sub) m.appendChild(el('span', 'meter-sub', sub));
    return m;
  }

  function renderResult(ex) {
    result.textContent = '';

    result.appendChild(el('p', 'blurb', ex.blurb));

    // Individual input/output costs are far too small to print meaningfully, so
    // show each side's share of the bill instead — which is the point anyway.
    var shareIn = Math.round((ex.costIn / ex.costTotal) * 100);
    var shareOut = 100 - shareIn;

    var meters = el('div', 'meters');
    meters.appendChild(meter('in', num(ex.inCount), 'tokens you sent',
      shareIn + '% of the cost'));
    meters.appendChild(meter('out', num(ex.outCount), 'tokens Claude wrote',
      shareOut + '% of the cost'));
    meters.appendChild(meter('total', pence(ex.costTotal), 'total cost',
      'in pence'));
    meters.appendChild(meter('total', num(Math.round(1 / (ex.costTotal / USD_PER_GBP))),
      'answers for £1', 'at this size'));
    result.appendChild(meters);

    result.appendChild(textPanel({
      kind: 'in',
      title: 'What you asked',
      text: ex.prompt,
      tokens: ex.inTokens,
      startOnTokens: ex.inCount <= 60
    }));

    result.appendChild(textPanel({
      kind: 'out',
      title: 'What Claude Haiku 4.5 replied',
      text: ex.answer,
      tokens: ex.outTokens,
      startOnTokens: false
    }));
  }

  /* ── 3. comparison chart ─────────────────────────────────────────────── */

  (function chart() {
    var legend = document.getElementById('legend');
    [['in', 'Tokens you sent'], ['out', 'Tokens Claude wrote']].forEach(function (s) {
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
      var inPct = (ex.costIn / max) * 100;
      var outPct = (ex.costOut / max) * 100;

      if (inPct > 0) {
        var si = el('div', 'bar-seg bar-seg--in');
        si.style.width = inPct + '%';
        track.appendChild(si);
      }
      var so = el('div', 'bar-seg bar-seg--out');
      so.style.width = outPct + '%';
      track.appendChild(so);
      row.appendChild(track);

      row.appendChild(el('div', 'bar-value',
        pence(ex.costTotal) + '  ·  ' + num(ex.inCount) + ' in, ' + num(ex.outCount) + ' out'));
      host.appendChild(row);
    });

    // Accessible table alternative
    var table = document.getElementById('datatable');
    var thead = el('thead');
    var hr = el('tr');
    ['Question', 'Tokens in', 'Tokens out', 'Cost in', 'Cost out', 'Total'].forEach(function (h) {
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
      tr.appendChild(el('td', null, pence(ex.costIn)));
      tr.appendChild(el('td', null, pence(ex.costOut)));
      tr.appendChild(el('td', null, pence(ex.costTotal)));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
  })();

  /* ── 4. scale ────────────────────────────────────────────────────────── */

  var scaleSelect = document.getElementById('scale-select');
  var scaleGrid = document.getElementById('scalegrid');

  examples.forEach(function (ex, i) {
    var o = el('option', null, '“' + ex.label + '” (' + pence(ex.costTotal) + ' each)');
    o.value = String(i);
    scaleSelect.appendChild(o);
  });

  var SCALES = [
    [1, 'once'],
    [100, 'a hundred times'],
    [10000, 'ten thousand times'],
    [1000000, 'a million times']
  ];

  function renderScale(i) {
    var ex = examples[i];
    scaleGrid.textContent = '';
    SCALES.forEach(function (s) {
      var li = el('li', 'scaleitem');
      li.appendChild(el('span', 'scaleitem-num', money(ex.costTotal * s[0])));
      li.appendChild(el('span', 'scaleitem-lbl', 'asked ' + s[1]));
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
    var loadBtn = document.getElementById('tryload');
    var output = document.getElementById('tryoutput');
    var countBox = document.getElementById('trycount');
    var countNum = document.getElementById('trycount-num');
    var tokeniser = null;

    function update() {
      if (!tokeniser) return;
      var text = input.value;
      if (!text) {
        output.textContent = '';
        countNum.textContent = '0';
        return;
      }
      var ids = tokeniser.encode(text);
      renderTokens(output, ids.map(function (id) { return tokeniser.decode([id]); }));
      countNum.textContent = num(ids.length);
    }

    loadBtn.addEventListener('click', function () {
      loadBtn.disabled = true;
      loadBtn.textContent = 'Loading…';
      var s = document.createElement('script');
      s.src = 'assets/tokeniser.js';
      s.onload = function () {
        tokeniser = window.GPTTokenizer_cl100k_base;
        if (!tokeniser) { s.onerror(); return; }
        status.textContent = 'Ready — type away.';
        countBox.hidden = false;
        if (!input.value) {
          input.value = 'Tokenisation is surprisingly unpredictable!';
        }
        update();
        input.focus();
      };
      s.onerror = function () {
        status.textContent =
          'Sorry, the tokeniser could not be loaded. The examples above still work.';
        loadBtn.remove();
      };
      document.head.appendChild(s);
    });

    var timer = null;
    input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(update, 90);
    });
  })();

  /* ── 6. footnote date ────────────────────────────────────────────────── */

  var gen = document.getElementById('gen-date');
  if (gen && DATA.generated) {
    var d = new Date(DATA.generated + 'T00:00:00Z');
    gen.textContent = d.toLocaleDateString('en-GB', {
      month: 'long', year: 'numeric', timeZone: 'UTC'
    });
  }

  /* ── go ──────────────────────────────────────────────────────────────── */

  select(0);
})();
