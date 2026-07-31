# What is a token?

An interactive, single-page explainer about tokens in large language models, built
for a public exhibition in a UK library.

Visitors tap one of five real questions, see how the text is chopped into tokens,
read the genuine reply from **Claude Haiku 4.5**, and watch the token counts and
cost change with the complexity of the prompt.

**Everything runs in the browser.** There is no backend, no API key and no network
call at runtime — every prompt, answer and token count is pre-computed and shipped
as a static file. It is designed to be dropped straight onto GitHub Pages.

---

## Deploying to GitHub Pages

1. Push this repository to GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, and select
   the `main` branch and the `/ (root)` folder.
4. Save. The site appears at `https://<user>.github.io/<repo>/` within a minute or two.

No build step and no workflow file are required — the repository root *is* the site.

To run it locally instead:

```sh
python3 -m http.server 8765
# then open http://localhost:8765
```

---

## What's in here

| Path | Purpose |
|---|---|
| `index.html` | The whole page |
| `assets/styles.css` | All styling. Mobile-first, light and dark themes |
| `assets/app.js` | Interaction logic. No dependencies |
| `assets/data.js` | **Generated.** Prompts, real answers, token splits, costs |
| `assets/tokeniser.js` | Vendored BPE tokeniser, lazy-loaded only for "try your own words" |
| `build/` | The tooling used to produce `assets/data.js`. Not served |

The core page is about 80 KB. The tokeniser is roughly 1 MB but is only fetched if a
visitor taps the button in the "try your own words" section, so a phone on library
Wi-Fi loads the main demo immediately.

---

## Regenerating the data

Only needed if you change the prompts or want fresher answers. Requires the
[Claude CLI](https://claude.com/claude-code), signed in.

```sh
# 1. Edit the prompts
$EDITOR build/prompts.json

# 2. Send each one to Claude Haiku 4.5 and capture the reply
#    (delete build/responses/<id>.json first to force a re-run)
./build/run-haiku.sh

# 3. Tokenise everything and rebuild assets/data.js
node build/build-data.js

# 4. Check the page still renders correctly
node build/verify.js
```

`build/verify.js` loads `index.html` in a headless DOM, runs the real page scripts
and asserts that the chooser, result panels, chart, scale cards, aGiTrack links and
accessibility basics all render. It needs `jsdom`:

```sh
npm install jsdom
SCRATCH="$PWD" node build/verify.js   # SCRATCH points at the node_modules parent
```

---

## About the numbers

- Every answer shown is a genuine, unedited reply from **Claude Haiku 4.5**, captured
  via the Claude CLI with the default system prompt replaced so the model answers as a
  plain assistant rather than as a coding agent.
- Costs use that model's published rates: **$1.00** per million input tokens and
  **$5.00** per million output tokens. Pounds are converted at approximately
  **£1 = $1.27** (stated on the page).
- Token counts come from the `cl100k_base` BPE tokeniser. Claude's own tokeniser is
  not public, but on these examples the two agreed to within about **3%** — measured
  by comparing against the token counts the API actually reported for the same
  prompts. The concept demonstrated is identical either way.
- The page counts only the tokens in text a visitor can see. Models also emit hidden
  *thinking* tokens that are billed too, so a real invoice would be somewhat higher.
  This is stated plainly in the page footnotes.

---

## Accessibility and presentation notes

- Semantic headings, a skip link, visible focus rings, and a table alternative to the
  chart.
- The two data-visualisation colours (blue for input, orange for output) were checked
  with a colour-vision-deficiency validator and pass separation and contrast
  requirements in both light and dark modes.
- Colour is never the only signal: every bar is direct-labelled and the legend is
  always present.
- Respects `prefers-reduced-motion` and `prefers-color-scheme`, and works under
  forced-colours mode.
- Touch targets are at least 44 px. The layout reflows to a single column on phones.

---

## Credits

Token tracking for AI-assisted coding: **[aGiTrack](https://agitrack.core-aix.org)**.
