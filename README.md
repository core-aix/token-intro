# What is a token?

A single-page, dark-themed exhibition display explaining tokens in large language
models, built for a public library exhibition in **Exeter**.

It is designed to be read standing up, a metre or two from the screen: big type,
big tap targets, and very little prose. Visitors tap one of five real questions and
immediately see the token counts and the cost.

**Everything runs in the browser.** There is no backend, no API key and no network
call at runtime — every prompt, answer and token count is pre-computed and shipped
as a static file.

---

## Deploying to GitHub Pages

1. Push this repository to GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, then select the
   `main` branch and the `/ (root)` folder.
4. Save. The site appears at `https://<user>.github.io/<repo>/` within a minute or two.

No build step and no workflow file are required — the repository root *is* the site.

To run it locally:

```sh
python3 -m http.server 8765
# then open http://localhost:8765
```

---

## The five examples

Each was genuinely sent to **Claude Haiku 4.5**; the replies shown are unedited.

| Tap | Your tokens | AI tokens | Cost |
|---|---|---|---|
| Boiling an egg | 14 | 246 | 0.098p |
| A quick message | 28 | 204 | 0.083p |
| A week of meals | 39 | 920 | 0.37p |
| A long letter | 618 | 394 | 0.20p |
| A cover letter | 666 | 472 | 0.24p |

They are ordered to make one point without needing a paragraph to explain it: the
meal plan has nearly the *shortest* question yet costs the most, because answers are
billed at five times the rate of questions.

**No named organisations appear anywhere.** The two long examples deliberately contain
no company, charity or institution names — the letter comes from "your energy supplier"
and is signed by a "Customer Accounts Team", and the job advert is for "a community
library service in Exeter". Earlier drafts invented plausible-sounding businesses and
also referenced two genuinely real organisations; both are gone, and `verify.js` fails
on a blocklist of those names plus anything matching a `… Limited` / `… Ltd` / `… plc`
pattern.

---

## What's in here

| Path | Purpose |
|---|---|
| `index.html` | The whole page |
| `assets/styles.css` | All styling. Dark only, sized for distance viewing |
| `assets/app.js` | Interaction logic. No dependencies |
| `assets/data.js` | **Generated.** Prompts, real answers, token splits, costs |
| `assets/tokeniser.js` | Vendored BPE tokeniser, lazy-loaded for "try your own words" |
| `assets/favicon.svg` | Browser-tab icon — four token chips, drawn as plain shapes |
| `assets/apple-touch-icon.png` | **Generated.** 180x180 home-screen icon, same geometry |
| `build/` | Tooling used to produce `assets/data.js` and the PNG icon. Not part of the site |

The page itself is about 90 KB. The tokeniser is roughly 1 MB, but it is not part of
the initial load: an `IntersectionObserver` starts fetching it only once the "try your
own words" section comes within 600 px of the viewport. The main demo therefore loads
instantly on library Wi-Fi, and by the time a visitor scrolls down the box is already
live — there is nothing to press.

---

## Regenerating the data

Only needed if you change the prompts. Requires the
[Claude CLI](https://claude.com/claude-code), signed in.

```sh
$EDITOR build/prompts.json          # 1. edit the prompts
rm build/responses/<id>.json        # 2. force a re-run for what changed
./build/run-haiku.sh                #    send each prompt to Claude Haiku 4.5
node build/build-data.js            # 3. tokenise and rebuild assets/data.js
node build/verify.js                # 4. check the page still works
```

## Icons

`assets/favicon.svg` is the source of truth: four uneven token chips in the page's two
data colours, drawn as plain shapes so it needs no emoji or web font and renders the
same everywhere. It is deliberately chunky — six smaller chips looked better at 180 px
but turned to mush at the 16 px browser-tab size.

`assets/apple-touch-icon.png` is generated from the same geometry:

```sh
python3 build/make-icons.py     # needs Pillow
```

The geometry lives in two places (the SVG and the script), so `verify.js` parses both
and fails if they disagree.

`build/verify.js` loads `index.html` in a headless DOM, runs the real page scripts,
and asserts 85 checks covering the chooser, result panels, chart, scale cards,
aGiTrack links, accessibility basics, and the exhibition constraints (dark theme, no
non-Devon place names, standing prose under 120 words, no fade-out gradients on text,
every single-line sentence actually fitting on one line, and that the word/token counts
claimed in the explainer are actually true). It needs `jsdom`:

```sh
npm install jsdom
SCRATCH="$PWD" node build/verify.js   # SCRATCH points at the node_modules parent
```

---

## About the numbers

- Every answer is a genuine, unedited reply from **Claude Haiku 4.5**, captured via the
  Claude CLI with the default system prompt replaced so the model answers as a plain
  assistant rather than as a coding agent.
- Costs use that model's published rates — **$1.00** per million input tokens and
  **$5.00** per million output tokens — converted at approximately **£1 = $1.27**.
  That conversion is a single constant (`USD_PER_GBP` in `app.js`) and is stated on
  the page.
- Token counts come from the `cl100k_base` BPE tokeniser. Claude's own tokeniser is not
  public, but on these examples the two agreed to within about **3%**, measured against
  the token counts the API actually reported for the same prompts.
- The page counts only the tokens in text a visitor can see. Models also emit hidden
  *thinking* tokens that are billed too, so a real invoice would be higher. Stated in
  the page's collapsed footnotes.

---

## Presentation notes

- **Dark throughout.** There is no light mode; `color-scheme` is fixed to `dark`.
- Base type is 20 px on phones and 23 px on larger screens, with headings and key
  numbers scaling up to roughly 7 rem — legible from a distance.
- Every tap target is at least 44 px, and the main controls are 60–72 px.
- The two data colours (blue for your words, orange for the AI's) were checked with a
  colour-vision-deficiency validator and pass separation and contrast requirements on
  this dark surface. Colour is never the only signal: every bar is labelled and the
  legend is always shown.
- Long prose is collapsed behind "See the numbers" and "About these numbers" so the
  standing display stays sparse.
- **The demo fits one screen.** The question chips, the three numbers and both messages
  are visible together: the chooser is a single compact row (48 px tall, wrapping on a
  phone), the headline and numbers share a row above 46 rem, and the two messages sit
  side by side above 60 rem. Each message is a bounded scroll pane
  (`clamp(11rem, 34vh, 26rem)`) rather than a clip-and-expand, so a 900-token answer
  cannot push the rest of the demo off screen — and nothing fades. The panes are
  keyboard-scrollable and labelled as regions.
- Short sentences never wrap early. Nothing is capped by a `max-width` in characters;
  instead each single-line sentence is sized against the viewport and capped so it also
  fits the `--maxw` container on a large display. `verify.js` checks the arithmetic
  (characters x ~0.55em advance) against both limits and demands 10% headroom, so
  lengthening a sentence or bumping a font size fails the build rather than silently
  wrapping.
- "Try your own words" needs no button: the tokeniser loads as the section approaches,
  the box is pre-filled with an example so it demonstrates itself from a distance, and
  the example is selected on first focus so the first keystroke replaces it.
- A reload always starts at the top. The "Try it" control is a `<button>` that scrolls
  the page rather than a link to `#demo`, so no anchor is left in the URL, and
  `history.scrollRestoration` is set to `manual` so the browser does not restore the
  previous scroll position either. The skip link keeps its `href` as a no-JS fallback
  but suppresses the hash and moves focus itself when scripting is available.
- Respects `prefers-reduced-motion`; works under forced-colours mode.

---

## Credits

Token tracking for AI-assisted coding: **[aGiTrack](https://agitrack.core-aix.org)**.
