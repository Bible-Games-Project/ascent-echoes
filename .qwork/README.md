# Question work (handoff)

Working area for writing the game's trivia questions with agents. The game
reads `content/questions/*.json` (built into `src/components/game/questions/`
by `node scripts/build-questions.mjs`); this folder is how those files are
produced.

## What is done

- All 1,327 original questions were reviewed and rewritten (`out/review-*.json`,
  queue `queue.json`, finished).
- New questions: 5 per Bible chapter (one per difficulty: easy, medium, hard,
  expert, impossible), 1,328 chapters in 111 units of up to 20 chapters
  (`ch-units.json`). Progress is in `ch-queue.json`. Genesis through
  Deuteronomy are done; next is `ch-joshua-001`.

## The loop (one step at a time; parallel agents burn the usage limit)

```bash
node .qwork/tools/ch_prompts.mjs                      # (re)generate .qwork/prompts/*.txt
Q=.qwork/ch-queue.json python3 .qwork/tools/queue.py next   # -> "<unit> <step> <model>"
```

For each step, start one agent with that model and the prompt:
"Read .qwork/prompts/<unit>-<step>.txt and carry out the task it describes,
exactly as written. Do not edit AGENTS.md."

- `write` (Sonnet): writes `.qwork/out/<unit>.json`.
- `en` (Opus, medium effort): fact-checks the English only, applies a patch
  with `tools/apply_en.py`; changed questions get `needs_translation`.
- `tr` (Sonnet): fixes the 11 translations and clears `needs_translation`.

After each step: check with
`node .qwork/tools/validate.mjs .qwork/out/<unit>.json --expect <count> --perchapter`
then `Q=.qwork/ch-queue.json python3 .qwork/tools/queue.py done <unit> <step>`.
After a `tr` step: `python3 .qwork/tools/merge.py && node scripts/build-questions.mjs`,
then commit `content/questions`, `src/components/game/questions` and `.qwork`
(minus `prompts/`), and push to `main`.

`merge.py` rebuilds every `content/questions/*.json` from the files in
`.qwork/out` and `.qwork/existing`, so never delete those.

## House style (rules live in `workflow.js` RULES and `tools/ch_prompts.mjs`)

Short question (max 14 words in English) that names its context (who / which
story), a direct question (never fill-in-the-blank), 3 options, each ONE real
word in all 12 languages, only one correct, numbers as digits, names from each
language's Catholic Bible.
