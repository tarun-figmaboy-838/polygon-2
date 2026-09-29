# Lesson checks

Focused checks for the 48-screen polygon lesson, kept from the original project. Every one of them passes on the current game.

```bash
npm run test:checks                               # all of them, one after another (~20 min)
ONLY=check-sfx.cjs npm run test:checks            # just one
node tests/checks/playwright-game.cjs             # the full 48-screen playthrough on its own
```

Run them from the project folder. Browser checks ask for Google Chrome; `run-all.cjs` lets Playwright's bundled Chromium stand in when Chrome isn't installed. Screenshots and reports go to `tests/checks/output/`, which git ignores.

Two kinds of check live here:

- **Browser checks** (Playwright) serve the project and drive the real page. They open it with `?intro=0` or `?preview=1`, so the story and the blizzard don't run in front of them.
- **Node checks** load the lesson's script directly and exercise its logic without a browser: timing, voice cues, sounds, geometry, and the like.

| Check | Covers |
|---|---|
| `playwright-game.cjs` | The complete 48-screen playthrough: real audio, keyboard, wrong answers, drag and drop, counting, dragging a vertex, sorting, and restart |
| `check-all-screen-polish.cjs` | Layout and visuals across the screens |
| `check-answer-feedback.cjs` | Right and wrong answer feedback, glows, Swiftee's reactions, one sound per answer |
| `check-audio-recovery.cjs`, `check-voice-gate.cjs`, `check-recorded-voice.cjs`, `check-word-animation.cjs`, `check-word-browser.cjs`, `check-choice-voice-cues.cjs` | Narration: recordings, word timing, gating, recovery |
| `check-guide-sync.cjs`, `check-idle-feedback.cjs` | Swiftee's expressions and idle behaviour |
| `check-sfx.cjs`, `check-sfx-channel.cjs` | Sound effects |
| `check-ice-intro.cjs` | The blizzard intro and its handoff to screen 1 |
| `check-background-transition.cjs`, `check-canvas-scaling.cjs`, `check-scene-aspect.cjs`, `check-dialogue-frame.cjs`, `check-dialogue-tail.cjs` | Layout at many screen sizes and zoom levels |
| All other `check-*.cjs` | Individual screens and interactions (open/closed, boundaries, labels, counting, morphing, sorting) |

The story, and the whole game as a user meets it, are covered by the QA suite one folder up (`npm test`).
