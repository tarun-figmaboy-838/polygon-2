# Kits from POLYGON Part 1 and Part 2

Fetched on 30 September 2026 from the published previews, with the files each kit lists under "FILES TO COPY". Each folder keeps the kit's own layout, so its preview page opens with its assets when this project is served (for example `npx serve .`, then `/source-art/kits/buttons-kit/previews/buttons-kit.html`).

Nothing here is shipped: `source-art/` is left out of the deployment. Copy a file into `assets/` or `game/assets/` when it is put to use.

The working copies are at the project root, where the site serves them: `assets/ui/` (the Play button and the four pills), `assets/char/` (the run and jump sheets), `src/fx/snowflake.js`, and the two kit pages `buttons-kit.html` and `momo-jump-kit.html`. The root `momo-jump-kit.html` reads its sheets from `assets/char/`. The hi-DPI jump sheet is only here, in `momo-jump-kit/game/assets/char/hd/`.

## buttons-kit

From https://polygon-part-1.vercel.app/part1-swiftee-lesson/previews/buttons-kit.html

| File | What it is |
|---|---|
| `previews/buttons-kit.html` | The kit page: its CSS, markup and the Play button's motion (`PlayFx`) |
| `assets/ui/play.webp` | The round gold Play button, 320 x 320 |
| `assets/ui/btn-uiPrimary.webp` | Gold pill, 405 x 147, cap 82 (acts: "Play again") |
| `assets/ui/btn-uiNav.webp` | Blue pill, 404 x 148, cap 83 (navigates: "Next", "Part 2") |
| `assets/ui/btn-uiSuccess.webp` | Green pill, 404 x 148, cap 83 (a right answer) |
| `assets/ui/btn-uiDanger.webp` | Red pill, 401 x 149, cap 83 (a wrong answer) |
| `src/fx/snowflake.js` | The snow crystals on the Play button's rim |

The pills are 3-slice buttons: `border-image` keeps the round caps at their true size and stretches only the middle, so one picture fits any word.

## momo-jump-kit

From https://polygon-part-1.vercel.app/part2-frozen-rush/previews/momo-jump-kit.html

| File | What it is |
|---|---|
| `previews/momo-jump-kit.html` | The kit page: Momo's run and jump on their own (the arc, the landing, the dust) |
| `game/assets/char/mammoth-jump-v2.webp` | The jump sheet: 24 cells, 6 across, 420 x 320 each |
| `game/assets/char/hd/mammoth-jump-v2.webp` | The same at 1.5x: 630 x 480 cells |
| `game/assets/char/mammoth-run.webp` | The run sheet: 36 cells, 6 across, 420 x 320 each |
| `game/assets/char/hd/mammoth-run.webp` | The same at 1.5x |

The two run sheets are byte for byte the ones already in `game/assets/char/`. The jump sheet is new: this project's game still has the older 10-cell `mammoth-jump.webp`.
