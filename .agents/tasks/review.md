# Corrected item-total correlation for item discrimination

The discrimination statistic in `computeItemStats()` now computes the corrected (item-excluded) item-total correlation that design §3.6 and Req 13.3 require, replacing a full-rate approximation that included the item's own score in the total it was correlated against. The old `sessionTotalRate()` helper (which returned the full per-session score rate) was replaced by `sessionScoredSum()` returning `{ sum, count }`, and the per-respondent corrected total is now `(scoredSum − thisItemScore) / (scoredCount − 1)`. A new `src/core/stats.test.ts` locks in the corrected value and the two edge cases. No other core module was changed, and no UI, feature, component, hook, or report file was touched.

Watch for: nothing blocking. The change is tightly scoped, mathematically matches the spec, the single-scored-response edge case is handled by exclusion (not fabrication), and `pearson()`'s `n<3 → null` guard and the `ItemStat` shape are preserved. (confirmed)

**Verdict**: APPROVED

## High-level view

The fix changes what the item score is correlated *against*. Previously each respondent's item score was correlated with that respondent's full score rate — a rate that includes the item itself, so every item partly correlated with its own contribution and the number was inflated toward a self-correlation. The corrected form subtracts the item's own score from both the numerator and the denominator of the rest total, which is the point-biserial corrected item-total correlation named in Req 13.3.

The denominator-zero case (a session whose only scored response is the target item, so there is no "rest" to correlate against) is handled by excluding that session from the discrimination input rather than injecting a 0. Exclusion keeps the two arrays fed to `pearson()` equal-length and avoids fabricating a data point that would bias the coefficient. A consequence worth knowing: the discrimination sample can be smaller than the item's reported `n`, which is correct and intended.

The `p`, timing, coding-distribution, and choice-distribution computations are untouched — the discrimination pair is built in separate `discScores`/`discTotals` arrays so the respondent-keyed arrays feeding those other stats are unaffected. `pearson()` and its `n<3 → null` behavior are unchanged, and the `ItemStat` interface keeps `discrimination: number | null`, so `htmlReport.ts` continues to compile and read it without modification.

The new test asserts the corrected value (−0.5) on a fixture where the old full-total value was ≈0, so it fails on the buggy code and passes on the fix; it also covers `n<3 → null`, the single-scored exclusion, and a `p`/`n` regression guard. The Part C audit of the other core modules found no spec contradictions and made no changes; the two documented judgment calls were left as-is.

<details>
<summary>Issues (0)</summary>

No blocking or non-blocking issues. The change matches the spec, handles the edge case sensibly, preserves the required interface and `pearson()` behavior, and stays within the allowed scope.

</details>

<details>
<summary>Details</summary>

### What the correlation is now computed against

The behavioral change is a single swap in what the per-respondent item score pairs with. The old code pushed `sessionTotalRate(sess, itemsById)` — the respondent's full scored rate, item included — into a `totals` array and called `pearson(scores, totals)`. Because the item's own score is a component of that total, each item was correlated partly against itself, inflating the coefficient. Req 13.3 names the statistic "문항-총점 **점이연 상관**" (point-biserial corrected item-total correlation) and design §3.6 spells out "(총점 − 해당 문항 점수)의 피어슨 상관", so the full-rate version was a genuine discrepancy, not a stylistic choice. The inline comment in the old code admitted as much ("근사").

The fix computes, for each scored respondent of the target item,

```
restTotal = (scoredSum − thisItemScore) / (scoredCount − 1)
```

where `scoredSum`/`scoredCount` come from `sessionScoredSum()`, which sums `responseScore` over every scored response in the session (`null` scores — ungraded `open_human` — excluded, matching the old filter). The item's own score `s` is already in hand inside the loop, so the subtraction is exact. `pearson(discScores, discTotals)` then produces the corrected coefficient. On the test fixture the corrected value is −0.5 versus the old ≈0, confirming the two implementations diverge materially.

### The denominator-zero edge case

When a session's only scored response is the target item, `scoredCount − 1 == 0` and there is no rest total to form. The code guards with `if (restCount > 0)` and simply does not push a pair for that session:

```ts
const restCount = scoredCount - 1;
if (restCount > 0) {
  discScores.push(s);
  discTotals.push((scoredSum - s) / restCount);
}
```

Excluding the session is the right call over injecting a 0: a fabricated 0 would both invent a data point and shift the coefficient (the plan notes a clean −0.5 would drift to −0.577). Exclusion also keeps `discScores` and `discTotals` index-aligned and equal-length, which `pearson()` relies on. The design-level consequence — the discrimination sample size can be smaller than the item's `n` — is intended and is documented both in the code comment and asserted in test (c).

### Isolation of the discrimination pair from the other stats

`p`, `timeMean/Median/IqrMs`, `codingDist`, and `choiceDist` all stay keyed to every scored respondent because the discrimination computation uses its own `discScores`/`discTotals` arrays and leaves `scores`/`times`/`coding`/`choice` pushes untouched. So a single-scored respondent is still counted in `n` and `p` even though it is dropped from discrimination — exactly the asymmetry test (c) pins down (`n === 4` while discrimination stays −0.5). `pearson()` itself is unchanged, so the `n < 3 → null` guard and the zero-variance `null` guard both carry over, and the `ItemStat` interface still declares `discrimination: number | null`, so `htmlReport.ts` needs no change.

### Test coverage

`src/core/stats.test.ts` is new and uses the existing fixture helpers (`makeItem`, `makeSession`, `resp`) in the established style. It covers:

- the corrected value on the A/B/C × S1/S2/S3 fixture, asserting `toBeCloseTo(-0.5, 10)` — the discriminating assertion, since the old full-total value was ≈0;
- `n < 3 → null` with only two sessions;
- the single-scored exclusion (adds S4 answering only A; discrimination stays −0.5 while `n` becomes 4);
- a `p`/`n` regression guard (`n === 3`, `p ≈ 2/3`).

Not tested: discrimination behavior for `open_human` items where some responses are ungraded (`responseScore` returns `null`) and are filtered from `scoredSum`/`scoredCount` — the exclusion-from-total path is exercised only indirectly. This is a minor gap, not a blocker; the scored/ungraded filter is shared with the pre-existing `p` path and unchanged by this diff.

No existing assertions were weakened or deleted — `stats.test.ts` did not previously exist, and the scoring/routing/grading test files are untouched per the file list.

### Part C audit and scope

The audit of scoring, routing, grading, explanation, conformance, and `sessionEngine` found no spec contradictions and made no code changes, which the diff confirms: the only tracked source change is `src/core/stats.ts`. The two judgment calls were left as-is — `difficultyMismatches()` still flags only `high` (p>0.8) and `low` (p<0.2) extremes, and `byProcessGroup()` still counts `score >= 0.5` as correct — both consistent with the instruction to leave them.

UI guard holds. `git diff main --name-only` lists only `package-lock.json` and `src/core/stats.ts`; `git status --porcelain` adds the untracked `.agents/` (task docs) and `src/core/stats.test.ts`. No `.tsx`, nothing under `src/features`, `src/components`, `src/hooks`, no `App.tsx`, no `htmlReport.ts`, no styling. `package-lock.json` is a pre-existing dependency-install artifact (12 deletions, unrelated to the logic fix) and carries no UI change.

### Verification evidence

The coder's `verification.md` records `vitest run` green (27 tests: 4 new stats + 23 pre-existing) and `tsc -b --noEmit` exit 0, run via `node` against the installed binaries because `npm.ps1` is execution-policy-blocked. The evidence is specific and consistent with the diff I read (the numeric −0.5 vs ≈0 argument matches the fixture in the test file), so per instructions I did not re-run the suite. No articulable doubt remained that would justify a spot-check.

</details>

<details>
<summary>File map</summary>

- `src/core/stats.ts` — `sessionTotalRate()` (full rate) replaced by `sessionScoredSum()` (`{sum,count}`); discrimination now the corrected item-total Pearson correlation over separate `discScores`/`discTotals`; misleading comment corrected. `p`, timings, dists, and `ItemStat` shape unchanged.
- `src/core/stats.test.ts` — new; covers corrected value (−0.5), `n<3 → null`, single-scored exclusion, and a `p`/`n` guard.
- `package-lock.json` — pre-existing dependency change, not part of this logic fix.

Full diff: `git diff main -- src/core/stats.ts` and the untracked `src/core/stats.test.ts`.

</details>
