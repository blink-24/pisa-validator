# Implementation Plan — Logic-only debugging pass (pisa-validator)

Scope constraint (from the task): edits are allowed ONLY under `src/core/**` (and `src/core/*.test.ts`), plus `src/data/sessionEngine.ts` *if* a logic bug is found there. NO `.tsx`, nothing under `src/features`, `src/components`, `src/hooks`, `App.tsx`, no styling. UI must not be touched. `src/features/report/htmlReport.ts` reads `ItemStat.discrimination`; the fix must keep the field name and type (`number | null`) exactly, so that file does not need to change.

Build/test commands discovered during exploration (from `package.json`):
- Tests: `npm test` (= `vitest run`), or scoped: `npx vitest run src/core`
- Typecheck: `npm run typecheck` (= `tsc -b --noEmit`)
- Lint: `npm run lint`
- Full build: `npm run build` (= `tsc -b && vite build`)

Test framework is **vitest 2.0.5**. Existing core tests (`src/core/*.test.ts`) use `import { describe, it, expect } from 'vitest'` and the fixture helpers in `src/core/testFixtures.ts` (`makeSubtest`, `makeItem`, `resp`, `makeSession`). New tests must follow that style and must not weaken or delete existing assertions.

---

## Part A — Primary confirmed bug: corrected item-total correlation in `stats.ts`

### Root cause (verified against design §3.6 / Req 13.3)
`design.md` §3.6 states the discrimination is the Pearson correlation between an item's score and **(총점 − 해당 문항 점수)** — the corrected item-total (point-biserial) correlation. The current `computeItemStats()` builds the `totals` array from `sessionTotalRate(sess, itemsById)`, which returns the FULL per-session score rate **including the item itself**. The inline comment admits it is only an approximation. Including the item inflates the correlation (self-correlation component), so it is a real discrepancy with the design.

### The corrected-total math (what the fix computes)
For a given target `item` and a session `sess` that produced a scored response `r` for it:
- Let `restSum` = (sum of `responseScore` over ALL scored responses in `sess`) − (this item's score `s`).
- Let `restCount` = (count of scored responses in `sess`) − 1.
- Corrected total for this (session, item) = `restSum / restCount`.
- `responseScore` is the existing helper from `scoring.ts`; "scored" means `responseScore(...) != null` (excludes ungraded `open_human`), exactly as `sessionTotalRate` already filters.

### Edge-case handling choice (decided, not left open)
When `restCount === 0` (the session has only ONE scored response — the target item itself), there is no "rest" to correlate against. **Decision: exclude that session from the discrimination input** rather than injecting a 0. Rationale: injecting 0 fabricates a data point and (worse) would desynchronize the `scores`/`totals` arrays or bias the correlation (verified: a single-scored session treated as 0 shifts a clean −0.5 to −0.577). Excluding it keeps `pearson()` fed with equal-length, consistent arrays. Note this means the discrimination's effective n can be smaller than the item's `n`; that is correct and intended.

### Implementation detail (keep `p`, timings, dists unchanged)
`scores` is reused for `p`, and `times`/`coding`/`choice` must stay keyed to every respondent. So do NOT drop single-scored sessions from `scores`/`times`. Instead, build a **separate aligned pair** for discrimination only:
- Keep pushing to `scores`, `times`, `coding`, `choice` for every scored respondent (unchanged).
- Add two new local arrays, e.g. `discScores: number[]` and `discTotals: number[]`. For each scored respondent, compute the corrected total; if `restCount > 0`, push `s` to `discScores` and the corrected total to `discTotals`. If `restCount === 0`, skip both (exclusion).
- Compute `const disc = pearson(discScores, discTotals);` (replaces `pearson(scores, totals)`).
- Remove the now-unused `totals` array and the `sessionTotalRate` helper (or repurpose it). Keep the `pearson()` helper and its `n < 3 → null` behavior exactly. Keep `median`, `quantile`.
- To avoid an O(n·m) recompute, it is fine to compute each session's full scored (sum,count) once per (item,session) inline — the function already iterates responses per session via `responseScore`; a small private helper `sessionScoredSum(sess): { sum, count }` returning both the total scored sum and count is the clean form. The target item's own `s` is already known in the loop, so corrected = `(sum - s) / (count - 1)`.

### Plan items

- [ ] 1. Rewrite the discrimination computation in `computeItemStats()` to use the corrected item-total correlation, and update the misleading comment.
      What: Replace `sessionTotalRate` (full-rate approximation) with a corrected per-(session,item) total = `(scoredSum − thisItemScore) / (scoredCount − 1)`. Build separate index-aligned `discScores`/`discTotals` arrays, pushing a pair only when `scoredCount − 1 > 0` (exclude single-scored sessions). Compute `disc = pearson(discScores, discTotals)`. Leave `p`, `timeMean/Median/IqrMs`, `codingDist`, `choiceDist`, and the `ItemStat` interface shape (`discrimination: number | null`) exactly as they are. Replace the inline comment that says "전체 득점비율 사용 (design 주석)" with an accurate description of the corrected (item-excluded) total.
      Files: `src/core/stats.ts`
      Verify: `npm run typecheck` passes; `npx vitest run src/core/stats.test.ts` passes (see item 3). Also confirm `difficultyMismatches`, `pathDistribution`, `tagComparison` still compile and their existing behavior is unchanged (they only read `ItemStat.p`/`.discrimination`, which keep their types).

- [ ] 2. Confirm no other core module or `htmlReport.ts` depends on the removed `sessionTotalRate` export.
      What: `sessionTotalRate` is a module-private function (not exported) — verify it is not referenced elsewhere, then it is safe to delete/replace. `tagComparison` consumes `discrimination` via the `ItemStat` objects, not the helper, so it is unaffected.
      Files: none (verification only; `src/core/stats.ts` from item 1 is the only change).
      Verify: `grep` is not sufficient as proof; rely on `npm run typecheck` and `npm run build` compiling with no unused-symbol or missing-reference errors.

---

## Part B — New/updated tests for the corrected discrimination

Create `src/core/stats.test.ts` (does not currently exist). Use `makeSubtest`/`makeItem`/`resp`/`makeSession` from `testFixtures.ts`. Items are `simple_mc` by default with `answer: 'a'`, so `resp(id, 'a')` scores 1 and `resp(id, 'b')` scores 0 via `responseScore`. Default `makeItem` has `stage: 'core'`, which is fine for stats (stats ignores stage; it only matches by response presence).

Worked values (verified numerically):
- Build 3 sessions, each answering items **A, B, C** (all `simple_mc`, answer `'a'`):
  - S1: A=`a`(1), B=`a`(1), C=`a`(1)
  - S2: A=`a`(1), B=`b`(0), C=`b`(0)
  - S3: A=`b`(0), B=`a`(1), C=`a`(1)
  - For item A: item scores `x = [1, 1, 0]`.
    - Corrected totals (rest = (sum−A)/(count−1)): S1=(3−1)/2=**1.0**, S2=(1−1)/2=**0.0**, S3=(2−0)/2=**1.0** → `y = [1.0, 0.0, 1.0]`.
    - **Corrected Pearson(x, y) = −0.5** (exact).
    - Uncorrected/full totals (the OLD buggy value): `[3/3, 1/3, 2/3]` → Pearson ≈ **0** (≈3.6e-17). The two differ materially, so this case fails on the buggy code and passes on the fix.

- [ ] 3. Add `src/core/stats.test.ts` covering the corrected discrimination and both edge cases.
      What: Add a `describe('computeItemStats discrimination', ...)` with these `it` cases:
        (a) **Corrected value**: the 3-session A/B/C fixture above. Assert `computeItemStats([A,B,C], [S1,S2,S3])`'s stat for item A has `discrimination` ≈ **−0.5** (use `expect(disc).toBeCloseTo(-0.5, 10)`). This is the assertion that distinguishes corrected from the old full-total ~0.
        (b) **n < 3 → null**: build only 2 sessions answering item A; assert item A's `discrimination` is `null` (pearson's `n < 3` guard, preserved).
        (c) **Single-scored-response edge case**: reuse the 3-session fixture but add a 4th session S4 that answers ONLY item A (`responses: [resp('A','a')]`). Assert item A's `discrimination` is still ≈ **−0.5** (S4 is excluded because its `restCount` is 0), i.e. the extra single-response session does not change the corrected correlation. Optionally also assert item A's `n` is 4 (S4 still counts as a respondent for `p`/`n`) to document that `n` and the discrimination sample size can differ.
        (d) **p and n unaffected** (guard against regressions): for the base 3-session fixture assert item A's `n === 3` and `p` ≈ 2/3 (A correct in S1,S2; wrong in S3).
      Also follow existing style: `import { describe, it, expect } from 'vitest'`, `import { computeItemStats } from './stats'`, `import { makeItem, makeSession, resp } from './testFixtures'`. Give items `simple_mc` default; use distinct `itemId`s like `CR901Q01`/`Q02`/`Q03` to match existing naming.
      Files: `src/core/stats.test.ts` (new)
      Verify: `npx vitest run src/core/stats.test.ts` — all new cases pass. Then `npm test` — the full suite (scoring, routing, grading, stats) passes with no regressions.

---

## Part C — Audit of each core module against the spec (verify; fix only on definite contradiction)

Each item below is a read-and-confirm check. The task pre-judged these CORRECT; the audit re-confirms against the files actually read and records the finding. **Finding: no contradictions found — no code changes in Part C.**

- [ ] 4. Audit `scoring.ts` against design §3.1. **Finding: CORRECT, no change.**
      Confirmed: `simple_mc` → 1 iff `answer === item.answer` (null → 0); `complex_mc` → `fullCredit==='all'` needs all rows, numeric `n` needs ≥ n correct rows; `short_auto` → normalized match against `acceptedAnswers`; `open_human` → `autoScore` undefined, `responseScore` uses `humanCode/2` with 9→0 (`humanCodeToScore`). Matches spec exactly.
      Files: none. Verify: covered by existing `src/core/scoring.test.ts` (`npm test`).

- [ ] 5. Audit `routing.ts` against design §3.2 / Req 6. **Finding: CORRECT, no change.**
      Confirmed: `autoRate` skips `open_human` and null-score responses, returns `null` on empty (Req 6.5, §7 "분모 0" handling); `classify` uses `>=high→high`, `>=mid→mid`, else `low`; `pickBlock` deterministic (high→high, low→low, mid→`midGoesTo`) and `pisa_probabilistic` (high `rng<.9?high:low`, low `rng<.9?low:high`, mid `rng<.5?high:low`); `stageRng` is seeded/deterministic. Matches spec.
      Files: none. Verify: existing `src/core/routing.test.ts` (`npm test`).

- [ ] 6. Audit `grading.ts` against design §3.3 / Req 11.2. **Finding: CORRECT, no change.**
      Confirmed: `single` → `classify(scoredRate(all), firstCut)`; `msat3` → `finalBlock==='high' ? (r>=highBlockCut?high:mid) : (r>=lowBlockCut?mid:low)` over stage2 scored items; `hasUngradedOpen` drives `provisional`; `byProcessGroup` counts `score>=0.5` as correct. Matches spec. (The `byProcessGroup` `>=0.5` rule is a judgment call — see item 11.)
      Files: none. Verify: existing `src/core/grading.test.ts` (`npm test`).

- [ ] 7. Audit `explanation.ts` against design §3.4. **Finding: CORRECT, no change.**
      Confirmed: template-only substitution (no free generation); four numbered clauses ①–④ with ② emitted only for `msat3`; clause ③ omits 0-item groups; `weakestGroup` tie-breaks by larger `total` (`rate === bestRate && total > bestTotal`); appends `gradeDescriptor` and the provisional sentence when present. Matches spec.
      Files: none. Verify: `npm test` (no dedicated explanation.test currently; the function is exercised indirectly — do not add scope here beyond the stats task).

- [ ] 8. Audit `conformance.ts` against design §3.5 / Req 7.1 & 7.3. **Finding: CORRECT, no change.**
      Confirmed all 9 checks with correct levels: required_attrs (error), process_coverage (warn), format_mix (warn), items_per_unit 3–5 (warn), coding_exists Code 1|2 (error), passage_source (warn), route_coverage (error), block_difficulty (warn), multi_source (error). `hasBlockingError` returns true on any `error` (Req 7.3). Matches spec.
      Files: none. Verify: `npm test`.

- [ ] 9. Audit `src/data/sessionEngine.ts` for logic bugs only. **Finding: CORRECT, no change.**
      Confirmed `computeResult` derives `finalBlock` from the `stage2` step in `session.path` and feeds it to `computeGrade`; `nextStagePlan` assigns stage1/stage2 blocks via `decideNextBlock` and persists path; `recordResponse` accumulates re-answer `timeMs`. No logic contradiction with Req 10/11. Per the task, do NOT change behavior. (This file is only in scope if a bug were found; none was.)
      Files: none. Verify: `npm run build` (type-level) and `npm test`.

- [ ] 10. Audit `stats.ts` secondary functions against Req 13.4–13.6. **Finding: CORRECT, no change (two judgment calls noted in item 11).**
      Confirmed: `difficultyMismatches` flags high-with-p>0.8 and low-with-p<0.2 (thresholds configurable); `pathDistribution` groups by non-core path and counts grades; `tagComparison` averages `p`/`discrimination` per tag and counts items. Matches spec intent.
      Files: none. Verify: `npm test`.

- [ ] 11. Record the two JUDGMENT CALLS — leave as-is (do not contradict spec).
      (a) `difficultyMismatches()` flags only `high` (p>0.8) and `low` (p<0.2) difficulty items; Req 13.4's `p>0.8` is illustrative ("예:"), so flagging only extreme-difficulty items is a reasonable reading — **leave as-is**.
      (b) `byProcessGroup()` counts a response as "맞힌 수" when `score >= 0.5`, so a partial-credit Code 1 (0.5) counts as correct; the spec does not define the partial-credit boundary, so this is a defensible choice — **leave as-is**.
      Files: none (documentation only).

---

## Part D — Final verification

- [ ] 12. Run the full verification suite and confirm green.
      What: Run typecheck, the full test suite, lint, and the production build to confirm the logic change is complete and nothing regressed.
      Files: none.
      Verify (run all, expect success):
        - `npm run typecheck` — no type errors (confirms `ItemStat` shape preserved, `htmlReport.ts` still compiles against it).
        - `npm test` — all suites pass, including the new `src/core/stats.test.ts` and all pre-existing assertions in scoring/routing/grading tests (unchanged).
        - `npm run lint` — no new lint errors (watch for an unused-variable error if `sessionTotalRate`/`totals` were left dangling; remove them).
        - `npm run build` — `tsc -b && vite build` succeeds.

---

## Notes / assumptions
- `src/features/report/htmlReport.ts` is intentionally NOT modified; the fix preserves `ItemStat.discrimination: number | null` and the field name, so the HTML report keeps reading it unchanged.
- No UI, hooks, components, or styling are touched. The only source edit is `src/core/stats.ts`; the only new file is the test `src/core/stats.test.ts`. `src/data/sessionEngine.ts` is left unchanged (no logic bug found).
- Numeric expectations in the tests (−0.5; full-total ≈ 0) were computed and verified before writing this plan; the gap between the two guarantees the test is sensitive to the fix rather than passing on either implementation.
