# Working notes

Implementation notes for this repository. `README.md` is the outward-facing description
— keep rationale, measurements and history here instead.

The brief: an interactive token explainer for a public library exhibition in **Exeter**,
hosted on GitHub Pages with no server, usable standing up by members of the public on
either the venue's screen or their own phone. British English throughout.

---

## Layout

| Path | Purpose |
|---|---|
| `index.html` | The whole page |
| `assets/styles.css` | All styling. Dark only, sized for distance viewing |
| `assets/app.js` | Interaction logic. No dependencies, no framework |
| `assets/data.js` | **Generated** by `build/build-data.js`. Never edit by hand |
| `assets/tokeniser.js` | Vendored `cl100k_base` BPE tokeniser, lazy-loaded |
| `assets/favicon.svg` | Browser-tab icon. Source of truth for the icon geometry |
| `assets/apple-touch-icon.png` | **Generated** by `build/make-icons.py` |
| `build/prompts.json` | The five questions |
| `build/responses/` | Raw Claude CLI output, one JSON per question. Cached |
| `build/vendor/cl100k_base.js` | The tokeniser used at build time |
| `build/verify.js` | The check suite |

`build/` is not part of the published site. It is harmless if served.

## Rebuilding

```sh
./build/run-haiku.sh        # only regenerates responses whose JSON is missing
node build/build-data.js    # tokenises everything, writes assets/data.js
python3 build/make-icons.py # only if the icon changed; needs Pillow
node build/verify.js        # 96 checks
```

`run-haiku.sh` calls the Claude CLI with `--system-prompt` replacing the default, so the
model answers as a plain assistant rather than as a coding agent, and with
`--setting-sources ""` and tools disabled to keep the run clean.

---

## Invariants worth preserving

These are the things that were got wrong at least once. Most have a check behind them.

### Token rendering

- **Exactly one chip per token.** Counting chips on screen must give the number in the
  header. An earlier version split each token on `\n` and skipped the empty pieces, so
  tokens that were purely line breaks rendered as *nothing*: the meal-plan answer showed
  874 chips for 920 tokens. `verify.js` now compares chip count to token count across all
  ten panels.
- **Invisible characters are marked inside the chip**: `·` for a leading space, `↵` for a
  line break. This is not decoration. A leading space is part of the token, and hiding it
  makes the tokeniser look broken — `" partnerships"` mid-sentence is one token, while
  `"partnerships"` typed at the start of the try-box is two. Someone reported this as a
  bug; it was the display, not the tokeniser.
- Markers sit at **0.7 opacity**, which is 3.4:1 against the chip fill. At 0.45 they were
  2.3:1 and effectively unreadable.
- **A chip's colour means one thing only: who wrote the text.** Blue is the visitor,
  orange is the model, one flat colour each. An earlier version cycled three shades so
  neighbouring chips stayed distinct, but a repeating shade pattern reads as though the
  shade encodes something. Separation comes from the gap plus a 1px lighter border, which
  measures 4.6:1 against the panel.

### The tokeniser

`assets/tokeniser.js` must stay a byte-identical copy of `build/vendor/cl100k_base.js`.
If they drift, the pre-computed examples and the live box will disagree and the whole
demo loses credibility. It is ~1MB, so it is **not** part of the initial load: an
`IntersectionObserver` with a 600px root margin fetches it as the "try your own words"
section approaches. There is deliberately no button to press.

Claude's own tokeniser is not public. `cl100k_base` is a stand-in, and it is honest to
say so. It was validated against reality once, early on: the Claude CLI reports
`cache_creation_input_tokens`, and subtracting the ~2057-token baseline overhead gave
682 and 696 real tokens for the two long prompts as they stood then, against 661 and 677
from `cl100k_base` — about 3%. The prompts have been rewritten since, so those exact
figures no longer correspond to anything in the repo; the ~3% agreement is the finding
worth keeping. Re-run the comparison if the claim ever needs to be defended.

### Typography

Single-line sentences (`.lede-line`, `.oneline`) must never wrap early. They are sized
against the viewport rather than capped with a character `max-width`. Two limits apply,
and both matter:

- the ~90vw available between the gutters on a phone, and
- `--maxw` minus the gutters on a large display, which is the one that is easy to forget.

`verify.js` computes `characters x 0.55em advance` against both and demands 10% headroom.
An earlier pass left only 6% and rested entirely on the 0.55 estimate being right. If you
lengthen a sentence or raise a font size, the check fails rather than the page silently
wrapping.

### The demo fits one screen

Question chips, the three numbers and both messages are meant to be visible together.
The chooser is a single compact row of 48px chips; the headline and numbers share a row
above 46rem; the two messages sit side by side above 60rem.

Each message is a **bounded scroll pane** (`clamp(11rem, 34vh, 26rem)`), not a
clip-and-expand, so a 900-token answer cannot push everything else off screen. The panes
are keyboard-focusable and labelled as regions — a scrollable box that cannot be reached
by keyboard is a trap. `overscroll-behavior` is left at its default so reaching the end
of a pane continues scrolling the page rather than trapping the visitor.

**No fading.** Clipped text must never be faded out with a gradient; it reads as broken
rather than deliberately shortened. This was asked for explicitly and there is a check.

### Reload returns to the top

The "Try it" control is a `<button>` that scrolls, not a link to `#demo`, so no anchor is
left in the URL. Separately, `history.scrollRestoration` is set to `manual` — without it a
refresh restores the previous scroll position regardless of the hash. The skip link keeps
its `href` as a no-JS fallback but calls `preventDefault()`, moves focus itself and
scrolls, so it does not add a hash either.

### Content

No real or invented organisations anywhere. Early drafts had fabricated companies
("Northgate Energy Supply Limited", "Riverbank Libraries Trust") and, more seriously, two
genuinely real bodies — the National Lottery Community Fund and the University of Exeter —
inside otherwise fictional documents. `verify.js` blocks that list plus anything matching
`… Limited` / `… Ltd` / `… plc`.

Place names are Devon only; a check blocks the earlier Sheffield/Leeds/Rotherham drafts.

Standing prose — hero text, section headings, the one-line captions — is capped at 120
words. It currently sits near 70. The demo content itself is exempt.

### Outbound links

Two different destinations, easily conflated:

- **`agitrack.core-aix.org`** — the token-tracking tool. It gets the prominent card
  near the end of the page. It was explicitly removed from the footer, and a check
  keeps it out.
- **`core-aix.org`** — the lab itself. This one belongs in the footer.

Because the first URL contains the second as a substring, any check must match the exact
href rather than using `[href*=...]`, or it will match both and prove nothing.

### Icons

`assets/favicon.svg` is hand-written and is the source of truth; `build/make-icons.py`
mirrors its geometry to produce the PNG. `verify.js` parses the rectangles out of both and
fails if they disagree — that check was tested by deliberately introducing a 1px mismatch.

Four chunky chips, not six small ones: six looked better at 180px but turned to mush at
the 16px browser-tab size. Uneven widths matter, otherwise it reads as a generic
four-square grid rather than text in pieces. No emoji — the original was a 🔤 in a data
URI, which renders through the OS emoji font and varies by platform.

---

## The check suite

`node build/verify.js` — 96 checks. It loads `index.html` in jsdom, runs the real page
scripts, and asserts against the resulting DOM rather than against the source.

Needs `jsdom`, and `SCRATCH` pointing at whatever directory holds `node_modules`:

```sh
npm install jsdom
SCRATCH="$PWD" node build/verify.js
```

**jsdom gaps that matter.** jsdom implements neither `IntersectionObserver`,
`history.scrollRestoration` nor `Element.scrollIntoView`, so the page's feature guards
quietly skip the real code paths and the tests pass without testing anything. Both are
stubbed in `beforeParse` so the paths actually run. A second jsdom instance with a
controllable `IntersectionObserver` verifies the tokeniser is *not* fetched on load and
then arrives on its own.

jsdom does no layout: `scrollHeight`, `clientHeight` and text metrics are all zero. Any
check about size or wrapping has to be arithmetic over the CSS, which is why the
single-line budget is computed rather than measured.

**When adding a check, make it fail first.** Two of these were scoped wrongly on the first
attempt and passed for the wrong reason — the chip-count check was matching the explainer
and try-box chips as well as the demo panels.

The suite also guards the split between `README.md` and this file: the README is checked
for tells that implementation detail has leaked back into it.

---

## Things that are assumptions, not facts

- **£1 = $1.27.** A single constant, `USD_PER_GBP` in `app.js`, stated on the page. Rates
  move; this will need revisiting.
- **0.55em average character advance**, used for the single-line budget. Reasonable for a
  system sans-serif, but it is an estimate, and the 10% headroom exists to absorb it.
- **The page has never been seen rendered.** It was built without browser tooling
  available, so every visual claim here is arithmetic or DOM structure. Type sizes at
  distance, the side-by-side panels and the scroll panes are all worth checking on the
  actual exhibition screen before the event.
