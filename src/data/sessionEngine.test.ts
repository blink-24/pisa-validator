import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { markStageCompleted, nextStagePlan, recordResponse, unansweredCount } from './sessionEngine';
import type { SubtestBundle } from './db';
import { makeItem, makeSession, makeSubtest } from '../core/testFixtures';

function bundle(): SubtestBundle {
  return {
    subtest: makeSubtest(),
    units: [{ id: 'u1', subtestId: 'st1', unitNo: 901, title: '단위', scenarioIntro: '', passageIds: [] }],
    passages: [],
    items: [
      makeItem({ id: 'CR901Q01', order: 1 }),
      makeItem({ id: 'CR901Q02', order: 2 }),
      makeItem({ id: 'CR901Q03', stage: 'stage1', block: 'low', order: 3 }),
      makeItem({ id: 'CR901Q04', stage: 'stage1', block: 'high', order: 4 }),
    ],
  };
}

describe('nextStagePlan — 건너뛴 문항', () => {
  it('core 문항을 건너뛰고 단계 완료하면 core로 되돌아가지 않고 stage1로 간다', async () => {
    const b = bundle();
    let s = makeSession({ id: 'sess-skip', path: [{ stage: 'core', block: 'none', reason: '시작' }] });
    s = recordResponse(s, b.items[0]!, 'a', 1000); // Q02는 건너뜀

    // 단계 완료 표시 전: 아직 core
    expect((await nextStagePlan(b, s)).plan?.stage).toBe('core');

    const { plan, session } = await nextStagePlan(b, markStageCompleted(s, 'core'));
    expect(plan?.stage).toBe('stage1');
    // 건너뛴 문항은 0점 → 정답률 50% → '중' → midGoesTo 'low'
    expect(plan?.block).toBe('low');
    expect(session.path.find((p) => p.stage === 'stage1')?.reason).toContain('50%');
  });

  it('미응답 수는 건너뛴 문항과 지운 답을 모두 센다', async () => {
    const b = bundle();
    let s = makeSession({ id: 'sess-count', path: [{ stage: 'core', block: 'none', reason: '시작' }] });
    s = recordResponse(s, b.items[0]!, '', 1000); // 입력 후 지움
    expect(unansweredCount(b, s)).toBe(2);
  });
});
