import { describe, it, expect } from 'vitest';
import { autoRate, classify, pickBlock, decideNextBlock, stageRng } from './routing';
import { makeItem, makeSubtest, resp } from './testFixtures';
import type { RoutingConfig } from '../types';

describe('classify', () => {
  const cut = { high: 0.7, mid: 0.4 };
  it('경계값: 정확히 컷이면 해당 등급', () => {
    expect(classify(0.7, cut)).toBe('high');
    expect(classify(0.4, cut)).toBe('mid');
    expect(classify(0.39, cut)).toBe('low');
  });
});

describe('autoRate', () => {
  it('구성형 문항은 분모에서 제외', () => {
    const items = [
      makeItem({ id: 'CR901Q01', answer: 'a' }),
      makeItem({ id: 'CR901Q02', responseFormat: 'open_human' }),
    ];
    const responses = [resp('CR901Q01', 'a'), resp('CR901Q02', '서술', { humanCode: 2 })];
    const r = autoRate(items, responses);
    expect(r).not.toBeNull();
    expect(r!.total).toBe(1); // 자동 채점 1문항만
    expect(r!.rate).toBe(1);
  });

  it('자동 채점 문항이 없으면 null (분모 0)', () => {
    const items = [makeItem({ id: 'CR901Q01', responseFormat: 'open_human' })];
    const responses = [resp('CR901Q01', '서술', { humanCode: 1 })];
    expect(autoRate(items, responses)).toBeNull();
  });
});

describe('pickBlock', () => {
  const det: RoutingConfig = { firstCut: { high: 0.7, mid: 0.4 }, assign: 'deterministic', midGoesTo: 'low' };
  it('결정형: 상→상, 하→하, 중→midGoesTo', () => {
    expect(pickBlock('high', det, 0.5)).toBe('high');
    expect(pickBlock('low', det, 0.5)).toBe('low');
    expect(pickBlock('mid', det, 0.5)).toBe('low');
    expect(pickBlock('mid', { ...det, midGoesTo: 'high' }, 0.5)).toBe('high');
  });

  const prob: RoutingConfig = { firstCut: { high: 0.7, mid: 0.4 }, assign: 'pisa_probabilistic', midGoesTo: 'low' };
  it('확률형: 상 90/10', () => {
    expect(pickBlock('high', prob, 0.89)).toBe('high');
    expect(pickBlock('high', prob, 0.91)).toBe('low');
  });
  it('확률형: 중 50/50', () => {
    expect(pickBlock('mid', prob, 0.49)).toBe('high');
    expect(pickBlock('mid', prob, 0.51)).toBe('low');
  });
});

describe('stageRng 재현성', () => {
  it('같은 세션ID+단계면 같은 값', () => {
    expect(stageRng('sess-x', 'stage1')).toBe(stageRng('sess-x', 'stage1'));
  });
  it('다른 단계면 (대개) 다른 값', () => {
    expect(stageRng('sess-x', 'stage1')).not.toBe(stageRng('sess-x', 'stage2'));
  });
});

describe('decideNextBlock', () => {
  it('핵심단계 정답률로 1단계 묶음 결정 (결정형)', () => {
    const subtest = makeSubtest();
    const items = [
      makeItem({ id: 'CR901Q01', stage: 'core', answer: 'a' }),
      makeItem({ id: 'CR901Q02', stage: 'core', answer: 'a' }),
    ];
    const responses = [resp('CR901Q01', 'a'), resp('CR901Q02', 'a')]; // 100%
    const d = decideNextBlock('stage1', items, responses, subtest.routing, 'sess-1');
    expect(d).not.toBeNull();
    expect(d!.cls).toBe('high');
    expect(d!.block).toBe('high');
    expect(d!.reason).toContain('1단계');
  });
});
