---
name: testing-elver-galarga
description: How to run and browser-test the Elver-galarga static arcade site (index.html games grid, Cookie Clicker, Breakout, Pong, Dodge).
---

# Testing the Elver-galarga site

## Run it
The whole app is a single static file (`index.html`). No build, no backend.

```bash
cd /path/to/Elver-galarga
python3 -m http.server 8123 &
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8123/index.html   # expect 200
```

Open `http://localhost:8123/index.html` in Chrome. Maximize before recording:
`wmctrl -r :ACTIVE: -b add,maximized_vert,maximized_horz`.

## Reaching a game
Type the game name in the search box at the top (e.g. `Cookie`, `Breakout`, `Pong`, `Dodge`),
then click the game card. Games open in a modal (`openGame(id)`); close with the modal X.
Some games need a `Jugar` / start click inside the modal before they animate.

## Cookie Clicker specifics
- Save key: `elvergalarga_cookie_clicker_v3` (older `..._v2` saves are migrated/sanitized).
- Fast-path a long upgrade chain instead of clicking: in the Chrome console run
  `localStorage.setItem('elvergalarga_cookie_clicker_v3', JSON.stringify({cookies:1e11, owned:{}}))`
  then close and reopen the game card (state is read on open, and written on close/tick).
- Tamper tests: seed `{cookies:N, owned:{cyborg:5}}`; unique upgrades should clamp to 1
  (check the `click +N` label, e.g. `click +3` not `click +243`).
- Multipliers stack multiplicatively and apply to both `por segundo` and `click +N`.
- The state is saved when the tick sees the modal closed, so always close via the UI
  before re-seeding localStorage, otherwise a stale save may overwrite your seed.
- Layout regression worth re-checking: open a game with a mobile d-pad (Breakout/Pong)
  first, close it, then open Cookie Clicker — the shop must not be clipped
  (`openGame` resets `body.style.position/overflow`).

## Unit tests
`npm test` runs node's test runner against logic extracted from index.html between the
`// CLICKER_LOGIC_START` / `// CLICKER_LOGIC_END` markers. Keep those markers intact.

## Devin Secrets Needed
None — fully local static site, no auth.
