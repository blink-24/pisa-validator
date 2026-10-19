import { describe, it, expect } from 'vitest';
import { buildExplanation, type ExplanationInput } from './explanation';
import { makeItem, makeSubtest, resp } from './testFixtures';
import { processGroupLabel } from '../data/taxonomy';
import type { PathStep } from '../types';

// 3단계 적응형: 핵심단계 → 1단계 상 묶음 → 2단계 상 묶음
const path: PathStep[] = [
  { stage: 'core', block: 'none', reason: '시작' },
  { stage: 'stage1', block: 'high', reason: '' },
  { stage: 'stage2', block: 'high', reason: '' },
];
const core = makeItem({ id: 'CR901Q01', stage: 'core', cognitiveProcess: 'literal' }); // 이해하기
const s1 = makeItem({
  id: 'CR902Q01',
  stage: 'stage1',
  block: 'high',
  cognitiveProcess: 'scan_locate',
}); // 정보 찾기
const s2mc = makeItem({
  id: 'CR903Q01',
  stage: 'stage2',
  block: 'high',
  cognitiveProcess: 'scan_locate',
});
const s2open = makeItem({
  id: 'CR903Q02',
  stage: 'stage2',
  block: 'high',
  cognitiveProcess: 'reflect_content_form', // 평가와 성찰하기
  responseFormat: 'open_human',
});

function explain(partial: Partial<ExplanationInput>): string[] {
  return buildExplanation({
    subtest: makeSubtest(),
    items: [core, s1, s2mc, s2open],
    responses: [],
    grade: 'high',
    firstGrade: 'high',
    provisional: false,
    path,
    ...partial,
  }).split('\n');
}
const line = (lines: string[], mark: string) => lines.find((l) => l.startsWith(mark)) ?? '';

describe('buildExplanation', () => {
  it("경로 문장에 '묶음 묶음'이 없다", () => {
    const text = explain({}).join('\n');
    expect(text).toContain('1단계 상 묶음 → 2단계 상 묶음');
    expect(text).not.toContain('묶음 묶음');
  });

  it("모든 문항 만점이면 '보완' 대신 '모든 인지 과정의 문항을 해결'", () => {
    const lines = explain({
      responses: [
        resp('CR901Q01', 'a'),
        resp('CR902Q01', 'a'),
        resp('CR903Q01', 'a'),
        resp('CR903Q02', '서술', { humanCode: 2 }),
      ],
    });
    expect(lines.join('\n')).not.toContain('보완');
    expect(line(lines, '④')).toBe('④ 모든 인지 과정의 문항을 해결하였습니다.');
  });

  it('선택형 1 + 서술형 Code 1이면 "2점 만점에 1.5점(75%)", ④는 서술형의 대분류', () => {
    const lines = explain({
      responses: [
        resp('CR901Q01', 'a'),
        resp('CR902Q01', 'a'),
        resp('CR903Q01', 'a'),
        resp('CR903Q02', '서술', { humanCode: 1 }),
      ],
    });
    expect(line(lines, '②')).toContain('최종 묶음에서 2점 만점에 1.5점(75%)을 얻어');
    expect(line(lines, '④')).toContain(`'${processGroupLabel('evaluate_reflect')}'`);
    expect(line(lines, '④')).toContain('보완이 필요합니다');
  });

  it('정수 점수는 .0 없이 쓴다 ("2점 만점에 2점(100%)")', () => {
    const lines = explain({
      responses: [
        resp('CR901Q01', 'a'),
        resp('CR902Q01', 'a'),
        resp('CR903Q01', 'a'),
        resp('CR903Q02', '서술', { humanCode: 2 }),
      ],
    });
    expect(line(lines, '②')).toContain('2점 만점에 2점(100%)');
  });

  it("잠정이면 ④ 끝에 '(채점된 문항 기준)'이 붙는다 (미채점 서술형은 ④ 판단에서 제외)", () => {
    const lines = explain({
      provisional: true,
      responses: [
        resp('CR901Q01', 'a'),
        resp('CR902Q01', 'b'),
        resp('CR903Q01', 'a'),
        resp('CR903Q02', '서술'),
      ],
    });
    expect(line(lines, '④').endsWith('(채점된 문항 기준)')).toBe(true);
    expect(line(lines, '④')).toContain(`'${processGroupLabel('locate')}'`);
  });

  it("등급 뒤 조사: 상·중은 '으로', 하는 '로'", () => {
    const hi = explain({
      responses: [
        resp('CR901Q01', 'a'),
        resp('CR902Q01', 'a'),
        resp('CR903Q01', 'a'),
        resp('CR903Q02', '서술', { humanCode: 2 }),
      ],
    });
    expect(line(hi, '①')).toContain("'상'(기준: 상 70% 이상, 중 40% 이상)으로 판정");
    expect(line(hi, '②')).toContain("'상'으로 판정");
    const mid = explain({ grade: 'mid', firstGrade: 'mid' });
    expect(line(mid, '①')).toContain('중 40% 이상)으로 판정');
    expect(line(mid, '②')).toContain("'중'으로 판정");
    const low = explain({ grade: 'low', firstGrade: 'low' });
    expect(line(low, '①')).toContain('중 40% 이상)로 판정');
    expect(line(low, '②')).toContain("'하'로 판정");
    expect(line(low, '②')).not.toContain("'하'으로");
  });

  it("잠정이면 ② 비율 괄호에 '채점된 문항 기준'이 붙고, 채점 후에는 없다", () => {
    const base = [resp('CR901Q01', 'a'), resp('CR902Q01', 'a'), resp('CR903Q01', 'a')];
    const prov = explain({ provisional: true, responses: [...base, resp('CR903Q02', '서술')] });
    expect(line(prov, '②')).toContain('1점 만점에 1점(100%, 채점된 문항 기준)을 얻어');
    const done = explain({ responses: [...base, resp('CR903Q02', '서술', { humanCode: 2 })] });
    expect(line(done, '②')).not.toContain('채점된 문항 기준');
  });

  it("Code 1이면 ③에 '(부분 점수 1문항)', ④는 '득점률' 문구", () => {
    const lines = explain({
      responses: [
        resp('CR901Q01', 'a'),
        resp('CR902Q01', 'a'),
        resp('CR903Q01', 'a'),
        resp('CR903Q02', '서술', { humanCode: 1 }),
      ],
    });
    expect(line(lines, '③')).toContain(
      `${processGroupLabel('evaluate_reflect')} 1/1(부분 점수 1문항)`,
    );
    expect(line(lines, '④')).toContain('득점률이 가장 낮은');
    expect(lines.join('\n')).not.toContain('정답률이 가장 낮은');
  });
});
