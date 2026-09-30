# The Frozen Pass — the runner's own notes

These files came with the game in `game/` from the `running-mammoth` repository and are
kept here unchanged, so the contract the game was built to travels with it:

| file | what it is |
|---|---|
| [RUNNER.md](RUNNER.md) | **The contract.** The run of play, the curriculum (`CFG.levelOne.phases`), what a level brief may and may not ask for, what the game's tests hold it to, and the record of every review round. Read it before changing anything under `game/js/`. |
| [VO-SCRIPT.md](VO-SCRIPT.md) | Every word the learner hears or reads in the game, with the id each recording is named by. |
| [ANIMATION-BRIEF.md](ANIMATION-BRIEF.md) | The brief for generating Momo's sprite sheets: cell, foot line, frame counts. |
| [ANIMATION.md](ANIMATION.md) | The older production spec; its own header lists the numbers that are now stale. |
| [QA-REPORT.md](QA-REPORT.md) | The live QA pass and what it found. |

How the game is joined to the lesson is not in these files: see the **Frozen Pass** section of
the project [README](../../README.md), `src/runner/runner-stage.js` and `styles/runner-stage.css`.
Paths inside these documents (`game/js/engine.js`, `tools/…`, `tests/…`) are the runner
repository's own; here the game is under `game/` and its tools and tests stayed behind.
