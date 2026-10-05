// 샘플 소검사 시드 (Task 13). 자작 지문만 사용 — 저작권 지문 없음 (Req 15.3).
// 3단계 적응형, 단위 3개, 응답 형식 4종 포함.

import { db } from './db';
import { uid, makeItemId } from '../core/ids';
import type { Subtest, Unit, Passage, Item } from '../types';

const SAMPLE_ID = 'sample-reading-01';

export async function seedSampleSubtest(): Promise<string> {
  // 이미 있으면 새 ID로 중복 생성 방지: 기존 샘플 삭제 후 재생성
  const existing = await db.subtests.get(SAMPLE_ID);
  if (existing) {
    const units = await db.units.where('subtestId').equals(SAMPLE_ID).toArray();
    await db.passages.bulkDelete(units.flatMap((u) => u.passageIds));
    await db.units.where('subtestId').equals(SAMPLE_ID).delete();
    await db.items.where('subtestId').equals(SAMPLE_ID).delete();
  }

  const now = new Date().toISOString();
  const subtest: Subtest = {
    id: SAMPLE_ID,
    title: '샘플 읽기 소검사: 학교 텃밭 프로젝트',
    description:
      '자작 지문으로 구성한 시연용 소검사입니다. PISA 2018 다단계 적응형(MSAT) 구조를 따릅니다. 모든 지문은 저작권 문제가 없는 창작 텍스트입니다.',
    target: '중3~고1(만 15세)',
    structure: 'msat3',
    routing: { firstCut: { high: 0.7, mid: 0.4 }, assign: 'deterministic', midGoesTo: 'low' },
    gradeRule: { highBlockCut: 0.5, lowBlockCut: 0.7 },
    gradeDescriptors: {
      high: '여러 텍스트의 정보를 통합하고 근거의 질을 비판적으로 따질 수 있습니다.',
      mid: '제시된 텍스트의 핵심 정보를 이해하고 간단한 추론을 할 수 있습니다.',
      low: '텍스트에서 명시된 정보를 찾는 데 더 많은 연습이 필요합니다.',
    },
    allowWithinUnitNav: true,
    createdAt: now,
    updatedAt: now,
  };

  const units: Unit[] = [];
  const passages: Passage[] = [];
  const items: Item[] = [];

  // ---- 단위 901: 핵심단계 (안내문 1지문, 형식 혼합) ----
  const u1 = unit(SAMPLE_ID, 901, '텃밭 프로젝트 안내', '학교 텃밭 동아리가 신입 부원을 모집합니다. 아래 안내문을 읽고 질문에 답하세요.');
  const p1 = passage(u1.id, '텃밭 동아리 신입 부원 모집 안내', {
    situation: 'educational',
    textFormat: 'continuous',
    textType: 'instruction',
    organization: 'static',
    bodyHtml:
      '<p><strong>햇살 텃밭 동아리</strong>가 새 학기 신입 부원을 모집합니다. 활동일은 매주 수요일 방과 후이며, 장소는 본관 뒤 텃밭입니다.</p>' +
      '<p>준비물은 모자와 장갑입니다. 상추, 방울토마토, 바질을 함께 기르고 수확한 채소는 급식실에 기부합니다.</p>' +
      '<p>신청은 3월 15일까지 학생회실에서 받습니다. 반려동물 동반은 안전상 금지됩니다.</p>',
    source: { author: '검증 도구 자작', work: '텃밭 안내문', year: '2026' },
  });
  u1.passageIds = [p1.id];
  units.push(u1);
  passages.push(p1);

  items.push(
    simpleMc(SAMPLE_ID, u1, 1, 'core', 'none', 'scan_locate', 'low', '동아리 활동은 무슨 요일에 하나요?', [
      ['월요일', false],
      ['수요일', true],
      ['금요일', false],
      ['일요일', false],
    ]),
    simpleMc(SAMPLE_ID, u1, 2, 'core', 'none', 'literal', 'mid', '안내문에서 금지한 것은 무엇인가요?', [
      ['모자 착용', false],
      ['채소 기부', false],
      ['반려동물 동반', true],
      ['장갑 준비', false],
    ]),
    shortAuto(SAMPLE_ID, u1, 3, 'core', 'none', 'scan_locate', 'low', '신청 마감일은 몇 월 며칠인가요? (예: 3월 15일)', [
      '3월 15일',
      '3월15일',
    ]),
    complexMc(SAMPLE_ID, u1, 4, 'core', 'none', 'integrate_infer', 'mid', '다음 각 진술이 안내문과 일치하는지 고르세요.', [
      ['수확한 채소는 급식실에 기부한다.', '예'],
      ['준비물에 모자가 포함된다.', '예'],
      ['활동 장소는 운동장이다.', '아니오'],
    ]),
  );

  // ---- 단위 902: 1단계 (하 묶음 / 상 묶음) ----
  // 하 묶음: 쉬운 단일 지문
  const u2 = unit(SAMPLE_ID, 902, '식물 기르기 기초', '텃밭에서 식물을 기르는 방법을 설명한 글입니다. 읽고 답하세요.');
  const p2 = passage(u2.id, '물 주기의 기본', {
    situation: 'educational',
    textFormat: 'continuous',
    textType: 'exposition',
    organization: 'static',
    bodyHtml:
      '<p>식물에 물을 줄 때는 흙 표면이 말랐는지 먼저 확인합니다. 흙이 축축하면 물을 주지 않아도 됩니다.</p>' +
      '<p>너무 자주 물을 주면 뿌리가 숨을 쉬지 못해 썩을 수 있습니다. 아침에 물을 주는 것이 좋습니다.</p>',
    source: { author: '검증 도구 자작', work: '식물 기르기 기초', year: '2026' },
  });
  u2.passageIds = [p2.id];
  units.push(u2);
  passages.push(p2);
  items.push(
    simpleMc(SAMPLE_ID, u2, 1, 'stage1', 'low', 'literal', 'low', '물을 주기 전에 먼저 확인할 것은?', [
      ['잎의 색', false],
      ['흙이 말랐는지', true],
      ['화분의 크기', false],
    ]),
    simpleMc(SAMPLE_ID, u2, 2, 'stage1', 'low', 'integrate_infer', 'low', '물을 너무 자주 주면 생기는 문제는?', [
      ['잎이 커진다', false],
      ['뿌리가 썩을 수 있다', true],
      ['꽃이 빨리 핀다', false],
    ]),
    shortAuto(SAMPLE_ID, u2, 3, 'stage1', 'low', 'scan_locate', 'low', '하루 중 언제 물을 주는 것이 좋다고 했나요? (한 단어)', [
      '아침',
    ]),
  );

  // 상 묶음: 두 지문 비교(다중)
  const u3 = unit(SAMPLE_ID, 903, '퇴비 논쟁', '퇴비 사용에 대한 서로 다른 두 글을 읽고, 두 글을 비교해 답하세요.');
  const p3a = passage(u3.id, '글 (가): 퇴비 찬성', {
    situation: 'public',
    textFormat: 'continuous',
    textType: 'argumentation',
    organization: 'static',
    bodyHtml:
      '<p>퇴비는 음식물 쓰레기를 흙으로 되돌려 자원을 아낍니다. 화학 비료보다 토양을 오래 건강하게 합니다.</p>',
    source: { author: '검증 도구 자작', work: '퇴비 찬성글', year: '2026' },
  });
  const p3b = passage(u3.id, '글 (나): 퇴비 신중론', {
    situation: 'public',
    textFormat: 'continuous',
    textType: 'argumentation',
    organization: 'static',
    bodyHtml:
      '<p>퇴비를 잘못 만들면 냄새와 벌레가 생깁니다. 도시의 좁은 공간에서는 관리가 어렵다는 지적도 있습니다.</p>',
    source: { author: '검증 도구 자작', work: '퇴비 신중론', year: '2026' },
  });
  u3.passageIds = [p3a.id, p3b.id];
  units.push(u3);
  passages.push(p3a, p3b);
  items.push(
    complexMc(SAMPLE_ID, u3, 1, 'stage1', 'high', 'detect_conflict', 'high', '각 진술이 어느 글의 입장인지 고르세요.', [
      ['퇴비는 자원을 아낀다.', '(가)'],
      ['퇴비는 냄새와 벌레를 부를 수 있다.', '(나)'],
    ], ['(가)', '(나)']),
    openHuman(
      SAMPLE_ID,
      u3,
      2,
      'stage1',
      'high',
      'reflect_content_form',
      'high',
      '두 글을 모두 고려할 때, 학교 텃밭에서 퇴비를 쓸지 결정하려면 어떤 점을 더 알아봐야 할까요? 근거를 들어 쓰세요.',
      'multiple',
    ),
    simpleMc(SAMPLE_ID, u3, 3, 'stage1', 'high', 'assess_quality', 'mid', '두 글의 공통된 주제는 무엇인가요?', [
      ['급식 메뉴', false],
      ['퇴비 사용', true],
      ['물 주기 시간', false],
    ]),
  );

  // ---- 단위 904: 2단계 (하/상 묶음) ----
  const u4 = unit(SAMPLE_ID, 904, '수확 일지', '텃밭 수확량을 적은 간단한 표입니다. 읽고 답하세요.');
  const p4 = passage(u4.id, '주간 수확 일지', {
    situation: 'educational',
    textFormat: 'non_continuous',
    textType: 'description',
    organization: 'static',
    bodyHtml:
      '<table><thead><tr><th>주차</th><th>상추(포기)</th><th>토마토(개)</th></tr></thead>' +
      '<tbody><tr><td>1주</td><td>5</td><td>0</td></tr><tr><td>2주</td><td>8</td><td>3</td></tr>' +
      '<tr><td>3주</td><td>8</td><td>7</td></tr></tbody></table>',
    source: { author: '검증 도구 자작', work: '수확 일지', year: '2026' },
  });
  u4.passageIds = [p4.id];
  units.push(u4);
  passages.push(p4);
  items.push(
    // 2단계 하 묶음
    simpleMc(SAMPLE_ID, u4, 1, 'stage2', 'low', 'scan_locate', 'low', '2주차 토마토 수확량은?', [
      ['0개', false],
      ['3개', true],
      ['7개', false],
    ]),
    shortAuto(SAMPLE_ID, u4, 2, 'stage2', 'low', 'literal', 'low', '상추가 가장 많이 수확된 주차의 포기 수는? (숫자만)', ['8']),
    simpleMc(SAMPLE_ID, u4, 3, 'stage2', 'low', 'integrate_infer', 'mid', '표에서 알 수 있는 사실은?', [
      ['토마토는 1주차부터 많이 났다', false],
      ['토마토 수확량이 점점 늘었다', true],
      ['상추는 매주 줄었다', false],
    ]),
    // 2단계 상 묶음
    openHuman(
      SAMPLE_ID,
      u4,
      4,
      'stage2',
      'high',
      'integrate_infer',
      'high',
      '표의 변화를 근거로 4주차 토마토 수확량을 예측하고, 그렇게 생각한 이유를 쓰세요.',
    ),
    complexMc(SAMPLE_ID, u4, 5, 'stage2', 'high', 'assess_quality', 'high', '다음 해석이 표로 뒷받침되는지 고르세요.', [
      ['상추 수확은 2주차 이후 변화가 없었다.', '예'],
      ['토마토는 3주차에 가장 많이 났다.', '예'],
      ['상추가 매주 두 배씩 늘었다.', '아니오'],
    ]),
    simpleMc(SAMPLE_ID, u4, 6, 'stage2', 'high', 'reflect_content_form', 'mid', '이 표를 더 유용하게 만들려면?', [
      ['색을 화려하게 칠한다', false],
      ['수확 날짜와 날씨를 함께 적는다', true],
      ['글씨를 크게 한다', false],
    ]),
  );

  await db.transaction('rw', db.subtests, db.units, db.passages, db.items, async () => {
    await db.subtests.put(subtest);
    await db.units.bulkPut(units);
    await db.passages.bulkPut(passages);
    await db.items.bulkPut(items);
  });

  return SAMPLE_ID;
}

// ---- 빌더 헬퍼 ----

function unit(subtestId: string, unitNo: number, title: string, scenarioIntro: string): Unit {
  return { id: uid('u'), subtestId, unitNo, title, scenarioIntro, passageIds: [] };
}

function passage(
  unitId: string,
  title: string,
  rest: Omit<Passage, 'id' | 'unitId' | 'title' | 'imageIds'>,
): Passage {
  return { id: uid('p'), unitId, title, imageIds: [], ...rest };
}

function baseItem(
  subtestId: string,
  u: Unit,
  itemNo: number,
  stage: Item['stage'],
  block: Item['block'],
  process: string,
  difficulty: Item['difficulty'],
  stem: string,
): Item {
  const unitItemCount = itemNo - 1;
  return {
    id: makeItemId(u.unitNo, itemNo),
    subtestId,
    unitId: u.id,
    order: unitItemCount,
    stage,
    block,
    stem,
    cognitiveProcess: process,
    responseFormat: 'simple_mc',
    sourceRequirement: 'single',
    difficulty,
    tags: ['scenario'],
  };
}

function simpleMc(
  subtestId: string,
  u: Unit,
  itemNo: number,
  stage: Item['stage'],
  block: Item['block'],
  process: string,
  difficulty: Item['difficulty'],
  stem: string,
  choices: [string, boolean][],
): Item {
  const built = choices.map(([text]) => ({ id: uid('c'), text }));
  const answerIdx = choices.findIndex(([, correct]) => correct);
  return {
    ...baseItem(subtestId, u, itemNo, stage, block, process, difficulty, stem),
    responseFormat: 'simple_mc',
    choices: built,
    answer: built[answerIdx >= 0 ? answerIdx : 0]!.id,
  };
}

function shortAuto(
  subtestId: string,
  u: Unit,
  itemNo: number,
  stage: Item['stage'],
  block: Item['block'],
  process: string,
  difficulty: Item['difficulty'],
  stem: string,
  accepted: string[],
): Item {
  return {
    ...baseItem(subtestId, u, itemNo, stage, block, process, difficulty, stem),
    responseFormat: 'short_auto',
    acceptedAnswers: accepted,
    normalize: { ignoreSpace: true, ignoreCase: true },
  };
}

function complexMc(
  subtestId: string,
  u: Unit,
  itemNo: number,
  stage: Item['stage'],
  block: Item['block'],
  process: string,
  difficulty: Item['difficulty'],
  stem: string,
  rows: [string, string][],
  cols: string[] = ['예', '아니오'],
): Item {
  return {
    ...baseItem(subtestId, u, itemNo, stage, block, process, difficulty, stem),
    responseFormat: 'complex_mc',
    sourceRequirement: cols.some((c) => c.startsWith('(')) ? 'multiple' : 'single',
    matrix: {
      rows: rows.map(([text, answer]) => ({ id: uid('r'), text, answer })),
      cols,
      fullCredit: 'all',
    },
  };
}

function openHuman(
  subtestId: string,
  u: Unit,
  itemNo: number,
  stage: Item['stage'],
  block: Item['block'],
  process: string,
  difficulty: Item['difficulty'],
  stem: string,
  sourceRequirement: Item['sourceRequirement'] = 'single',
): Item {
  return {
    ...baseItem(subtestId, u, itemNo, stage, block, process, difficulty, stem),
    responseFormat: 'open_human',
    sourceRequirement,
    coding: [
      { code: 2, criterion: '두 글/자료의 근거를 모두 들어 타당하게 설명함.', examples: ['두 입장을 비교하고 추가로 확인할 점을 구체적으로 제시'] },
      { code: 1, criterion: '한쪽 근거만 들거나 설명이 부분적임.', examples: ['한 글의 내용만 언급'] },
      { code: 0, criterion: '근거 없이 단정하거나 주제와 무관함.', examples: ['모르겠다'] },
      { code: 9, criterion: '무응답.', examples: [] },
    ],
  };
}
