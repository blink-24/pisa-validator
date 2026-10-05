# Verification — Logic-only debugging pass (pisa-validator)

Environment: Windows / PowerShell. `npm.ps1` is blocked by execution policy, so commands were
run via `node` directly against the installed binaries. Output was redirected to files because
terminal integration mangles interleaved stdout.

## What changed

- `src/core/stats.ts` — `computeItemStats()` discrimination now uses the CORRECTED item-total
  correlation (design §3.6, Req 13.3). The old `sessionTotalRate()` helper (full per-session
  rate INCLUDING the item itself) was replaced by `sessionScoredSum()` returning `{sum, count}`.
  For each scored respondent the corrected total = `(scoredSum − thisItemScore) / (scoredCount − 1)`.
  Separate index-aligned arrays `discScores`/`discTotals` feed `pearson()`. Sessions with only one
  scored response (`restCount === 0`) are EXCLUDED from the discrimination input (not injected as 0),
  keeping `pearson()` fed with equal-length arrays. `p`, timings, `codingDist`, `choiceDist`, and the
  `ItemStat` interface shape (`discrimination: number | null`) are unchanged. The misleading inline
  comment was replaced with an accurate description.
- `src/core/stats.test.ts` — NEW. Covers the corrected value (−0.5), `n < 3 → null`, the
  single-scored-response edge case (excluded; corrected value unchanged, `n` still counts it), and a
  `p`/`n` regression guard.

No other core module was changed (Part C audit: no spec contradictions found). `sessionEngine.ts`
was NOT modified (no logic bug). No `.tsx`, `src/features`, `src/components`, `src/hooks`,
`App.tsx`, styling, or `src/features/report/htmlReport.ts` touched.

## Commands run and results

### Tests
Command: `node node_modules\vitest\vitest.mjs run`

Result: PASS.
- Test Files: 4 passed (4)
- Tests: 27 passed (27)
  - `src/core/stats.test.ts` — 4 tests (new)
  - `src/core/scoring.test.ts` — 8 tests
  - `src/core/routing.test.ts` — 9 tests
  - `src/core/grading.test.ts` — 6 tests

23 pre-existing tests + 4 new = 27, all green. No existing assertions weakened or deleted.

### Typecheck
Command: `node node_modules\typescript\bin\tsc -b --noEmit` (stdout redirected to a file)

Result: PASS. Exit code 0, no type errors. Confirms the `ItemStat` shape is preserved and
`htmlReport.ts` still compiles against `discrimination: number | null`.

### UI guard
Command: `git status --porcelain`

Result:
```
 M package-lock.json
 M src/core/stats.ts
?? .agents/
?? src/core/stats.test.ts
```
- `src/core/stats.ts` (M) and `src/core/stats.test.ts` (??) are the only source changes — both in scope.
- `.agents/` holds the workflow task docs (plan.md, this verification.md) — not UI.
- `package-lock.json` (M) is a PRE-EXISTING change from the dependency-install step noted in the
  task ("dependencies are already installed"); it was not touched by this work. `git diff --stat`
  shows 12 deletions only, unrelated to the logic fix.

No `.tsx`, `src/features`, `src/components`, `src/hooks`, `App.tsx`, or styling files are modified.

## Numeric check (why the test is sensitive to the fix)

Fixture A/B/C over S1(1,1,1), S2(1,0,0), S3(0,1,1); target item A scores x=[1,1,0].
- Corrected totals y = [(3−1)/2, (1−1)/2, (2−0)/2] = [1.0, 0.0, 1.0] → Pearson(x,y) = −0.5 (exact).
- Old buggy full totals = [3/3, 1/3, 2/3] → Pearson ≈ 0. The gap guarantees the test fails on the
  old code and passes on the fix.

## Not committed
Per instructions, nothing was committed.
