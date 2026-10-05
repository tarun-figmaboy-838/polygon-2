# Lesson checks

Focused checks for the 47-screen polygon lesson, kept from the original project. Every one of them passes on the current game.

```bash
npm run test:checks                               # all of them, one after another (~20 min)
ONLY=check-sfx.cjs npm run test:checks            # just one
node tests/checks/playwright-game.cjs             # the full 47-screen playthrough on its own
```

Run them from the project folder. Browser checks ask for Google Chrome; `run-all.cjs` lets Playwright's bundled Chromium stand in when Chrome isn't installed. Screenshots and reports go to `tests/checks/output/`, which git ignores.

Two kinds of check live here:

- **Browser checks** (Playwright) serve the project and drive the real page. They open it with `?intro=0` or `?preview=1`, so the story and the Help Momo scene don't run in front of them.
- **Node checks** load the lesson's script directly and exercise its logic without a browser: timing, voice cues, sounds, geometry, and the like.

| Check | Covers |
|---|---|
| `playwright-game.cjs` | The complete 47-screen playthrough: real audio, keyboard, wrong answers, drag and drop, counting, dragging a vertex, sorting, and restart |
| `check-all-screen-polish.cjs` | Layout and visuals across the screens |
| `check-answer-feedback.cjs` | Right and wrong answer feedback, glows, Swiftee's reactions, one sound per answer |
| `check-audio-recovery.cjs`, `check-voice-gate.cjs`, `check-recorded-voice.cjs`, `check-word-animation.cjs`, `check-word-browser.cjs`, `check-choice-voice-cues.cjs` | Narration: recordings, word timing, gating, recovery |
| `check-hindi-voice.cjs` | The Hindi voice (`?lan=hi`): every line's Hindi take, its file and length, each word shown as it is said, the cues on the Hindi words, screen 27's cut, the game's Hindi take; English and Marathi keep the English takes |
| `check-guide-sync.cjs`, `check-idle-feedback.cjs` | Swiftee's expressions and idle behaviour |
| `check-sfx.cjs`, `check-sfx-channel.cjs` | Sound effects |
| `check-background-transition.cjs`, `check-canvas-scaling.cjs`, `check-scene-aspect.cjs`, `check-dialogue-frame.cjs`, `check-dialogue-tail.cjs` | Layout at many screen sizes and zoom levels |
| `check-dialogue-fit.cjs` | Swiftee's bubble on every screen and for every feedback line, with her real voice: the fewest lines its strip allows, no lone last word, nothing covered or clipped, steady while the words appear, and through a resize |
| All other `check-*.cjs` | Individual screens and interactions (open/closed, boundaries, labels, counting, morphing, sorting) |

The story, and the whole game as a user meets it, are covered by the QA suite one folder up (`npm test`).
