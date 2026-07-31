# What is a token?

An interactive display that explains, in plain English, how AI language models read and
write text — and what it costs. Built for a public exhibition at a library in Exeter.

Visitors tap one of five everyday questions and immediately see three things: how their
words were chopped into **tokens**, the real answer the AI gave, and what that exchange
actually cost.

It is designed to be used standing up, at a distance, on a phone or a laptop: large
type, large tap targets, and very little to read.

**Everything runs in the browser.** There is no server, no API key and no network call
while it is running. Every question, answer and token count is worked out in advance and
shipped as a plain file, so the display keeps working even if the venue's Wi-Fi does not.

---

## Seeing it

Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8765
# then visit http://localhost:8765
```

### Putting it online with GitHub Pages

1. Push this repository to GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, then pick the
   `main` branch and the `/ (root)` folder.
4. Save. The site appears at `https://<user>.github.io/<repo>/` after a minute or two.

There is no build step and no workflow to configure — the repository root *is* the site.

---

## The five examples

Each question was genuinely sent to **Claude Haiku 4.5**. The answers on the page are
its real replies, unedited.

| Tap | Your tokens | AI tokens | Cost |
|---|---|---|---|
| Boiling an egg | 14 | 246 | 0.098p |
| A quick message | 28 | 204 | 0.083p |
| A week of meals | 39 | 920 | 0.37p |
| A long letter | 618 | 394 | 0.20p |
| A cover letter | 666 | 472 | 0.24p |

They are arranged to make one point without needing a paragraph to explain it: *A week
of meals* has almost the shortest question of the five, yet costs the most — because
answers are charged at five times the rate of questions.

The examples mention no real or invented organisations. The letter simply comes from
"your energy supplier"; the job advert is for "a community library service in Exeter".

---

## About the numbers

Everything on the page is real, and the page says so in its own footnotes. In summary:

- **The answers are genuine.** Each was produced by Claude Haiku 4.5 and is shown
  unedited.
- **The prices are the published ones** for that model: $1.00 per million tokens read
  and $5.00 per million tokens written, converted at roughly £1 = $1.27.
- **The token counts are very close, not exact.** Each AI model divides text up slightly
  differently, and Claude's own method is not published. The counter used here agreed
  with Claude's to within about 3% on these examples.
- **Real bills would be a little higher.** Models also produce hidden "thinking" text
  that is charged for. The page counts only the words you can actually see.
- **Prices and models change quickly.** These figures were prepared in 2026.

---

## Adapting it for your own venue

The five questions live in `build/prompts.json`. To change them you will need the
[Claude CLI](https://claude.com/claude-code), signed in:

```sh
$EDITOR build/prompts.json          # 1. write your questions
rm build/responses/<id>.json        # 2. clear the answers you changed
./build/run-haiku.sh                #    ask Claude Haiku 4.5 for new ones
node build/build-data.js            # 3. rebuild the page's data
node build/verify.js                # 4. check nothing broke
```

Place names, the currency conversion and the wording are all editable — see
[AGENTS.md](AGENTS.md) for how the pieces fit together and which details are load-bearing.

---

## Credits

Built as a public-engagement exhibit by **[CORE-AIx Lab](https://core-aix.org)**.

If you write software with AI and want to see where your own tokens go, have a look at
**[aGiTrack](https://agitrack.core-aix.org)**.
