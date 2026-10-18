// 보고서 공통 데이터 모델 (Task 12.1, design §5.1, Req 8.2).

import { loadBundle, listSessions } from '../../data/db';
import { runConformance, type ConformanceResult } from '../../core/conformance';
import {
  computeItemStats,
  pathDistribution,
  tagComparison,
  type ItemStat,
} from '../../core/stats';
import {
  processDetailLabel,
  processGroupLabel,
  groupOfProcess,
  responseFormatLabel,
  sourceRequirementLabel,
  difficultyLabel,
  situationLabel,
  scenarioSituationLabel,
  mixedSituationLabel,
  textFormatLabel,
  textTypeLabel,
  stageLabel,
  blockLabel,
} from '../../data/taxonomy';
import type { Subtest, Unit, Passage, Item } from '../../types';

export interface ReportItemRow {
  unitNo: number;
  id: string;
  stageBlock: string;
  process: string;
  textFormat: string;
  textType: string;
  source: string; // 출처 요구
  scenarioSituation: string; // 단위문항의 시나리오 상황 (Req 3.8)
  situation: string; // 문항이 다루는 지문의 상황. 지문 상황이 서로 다르면 '복합'
  responseFormat: string;
  difficulty: string;
}

export interface ReportItemDetail {
  id: string;
  stem: string;
  characteristics: { label: string; value: string }[];
  intent?: string;
  commentary?: string;
  coding?: { code: number; label: string; criterion: string; examples: string[] }[];
}

export interface ReportModel {
  overview: {
    title: string;
    description: string;
    target: string;
    structure: string;
    unitCount: number;
    itemCount: number;
    pathSummary: string[];
  };
  frameworkTable: { dimension: string; subcategory: string; kinds: string }[];
  itemTable: ReportItemRow[];
  itemDetails: ReportItemDetail[];
  conformance: ConformanceResult[];
  pilot?: {
    n: number;
    itemStats: ItemStat[];
    paths: Record<string, { count: number; grades: Record<string, number> }>;
    tags: Record<string, { count: number; avgP: number; avgDisc: number | null }>;
  };
  sources: { passageTitle: string; source: string }[];
  limitations: string[];
}

const LIMITATIONS = [
  '등급 산출은 IRT가 아닌 단순 규칙이며 PISA 공식 척도와 다릅니다.',
  '학교 단위 파일럿은 국제 비교 근거가 아닙니다.',
];

function stageBlockLabel(it: Item): string {
  return it.stage === 'core' ? stageLabel('core') : `${stageLabel(it.stage)} ${blockLabel(it.block)}`;
}

function passageOf(item: Item, units: Unit[], passages: Passage[]): Passage | undefined {
  return passagesOf(item, units, passages)[0];
}

/** 문항이 다루는 지문 = 문항이 속한 단위문항의 지문(단위의 지문 순서대로) */
function passagesOf(item: Item, units: Unit[], passages: Passage[]): Passage[] {
  const unit = units.find((u) => u.id === item.unitId);
  if (!unit) return [];
  return unit.passageIds
    .map((id) => passages.find((p) => p.id === id))
    .filter((p): p is Passage => !!p);
}

/**
 * 보고서 Ⅲ '상황' 열 값 (Req 3.8).
 * 지문이 없으면 '-', 지문 상황이 모두 같으면 그 상황, 2개 이상인데 서로 다르면 '복합'.
 */
export function itemSituationLabel(itemPassages: Passage[]): string {
  if (itemPassages.length === 0) return '-';
  const kinds = new Set(itemPassages.map((p) => p.situation));
  if (kinds.size > 1) return mixedSituationLabel;
  return situationLabel(itemPassages[0]!.situation);
}

export async function buildReportModel(subtestId: string): Promise<ReportModel> {
  const bundle = await loadBundle(subtestId);
  if (!bundle) throw new Error('소검사를 찾을 수 없습니다.');
  const { subtest, units, passages } = bundle;
  // 표·상세는 단위문항 번호 → 단위 내 문항 순서로 (문항 ID CR{단위}Q{순서}와 같은 순서)
  const unitNoOf = (it: Item) => units.find((u) => u.id === it.unitId)?.unitNo ?? 0;
  const items = [...bundle.items].sort((a, b) => unitNoOf(a) - unitNoOf(b) || a.order - b.order);

  const sessions = (await listSessions(subtestId)).filter((s) => s.submittedAt);

  const itemTable: ReportItemRow[] = items.map((it) => {
    const p = passageOf(it, units, passages);
    const unit = units.find((u) => u.id === it.unitId);
    const scenario = scenarioSituationLabel(unit?.scenarioSituation);
    return {
      unitNo: unit?.unitNo ?? 0,
      id: it.id,
      stageBlock: stageBlockLabel(it),
      process: processDetailLabel(it.cognitiveProcess),
      textFormat: p ? textFormatLabel(p.textFormat) : '-',
      textType: p ? textTypeLabel(p.textType) : '-',
      source: sourceRequirementLabel(it.sourceRequirement),
      scenarioSituation: scenario || '-',
      situation: itemSituationLabel(passagesOf(it, units, passages)),
      responseFormat: responseFormatLabel(it.responseFormat),
      difficulty: difficultyLabel(it.difficulty),
    };
  });

  const itemDetails: ReportItemDetail[] = items.map((it) => {
    const group = groupOfProcess(it.cognitiveProcess);
    return {
      id: it.id,
      stem: it.stem,
      characteristics: [
        { label: '인지 과정', value: `${group ? processGroupLabel(group) + ' › ' : ''}${processDetailLabel(it.cognitiveProcess)}` },
        { label: '응답 형식', value: responseFormatLabel(it.responseFormat) },
        { label: '출처 요구', value: sourceRequirementLabel(it.sourceRequirement) },
        { label: '난도', value: difficultyLabel(it.difficulty) },
        { label: '단계·묶음', value: stageBlockLabel(it) },
      ],
      intent: it.questionIntent,
      commentary: it.commentary,
      coding:
        it.responseFormat === 'open_human'
          ? (it.coding ?? []).map((c) => ({
              code: c.code,
              label: `Code ${c.code}`,
              criterion: c.criterion,
              examples: c.examples,
            }))
          : undefined,
    };
  });

  const conformance = runConformance({ subtest, units, passages, items });

  const sources = passages
    .map((p) => {
      const s = p.source;
      const parts = [s.author, s.work, s.publisher, s.year, s.pages ? `${s.pages}쪽` : ''].filter(Boolean);
      return { passageTitle: p.title || '(제목 없음)', source: parts.join(', ') || '(출처 미기재)' };
    });

  const model: ReportModel = {
    overview: {
      title: subtest.title,
      description: subtest.description,
      target: subtest.target,
      structure: subtest.structure === 'msat3' ? '3단계 적응형' : '단일 단계',
      unitCount: units.length,
      itemCount: items.length,
      pathSummary: buildPathSummary(subtest, items),
    },
    frameworkTable: buildFrameworkTable(items, passages),
    itemTable,
    itemDetails,
    conformance,
    sources,
    limitations: LIMITATIONS,
  };

  if (sessions.length > 0) {
    const itemStats = computeItemStats(items, sessions);
    model.pilot = {
      n: sessions.length,
      itemStats,
      paths: pathDistribution(sessions),
      tags: tagComparison(items, itemStats),
    };
  }

  return model;
}

function buildPathSummary(subtest: Subtest, items: Item[]): string[] {
  if (subtest.structure === 'single') return ['단일 단계(핵심단계만)'];
  const count = (stage: Item['stage'], block: Item['block']) =>
    items.filter((i) => i.stage === stage && i.block === block).length;
  return [
    `핵심단계 ${count('core', 'none')}문항`,
    `1단계 상 ${count('stage1', 'high')} / 하 ${count('stage1', 'low')}`,
    `2단계 상 ${count('stage2', 'high')} / 하 ${count('stage2', 'low')}`,
  ];
}

function buildFrameworkTable(items: Item[], passages: Passage[]): { dimension: string; subcategory: string; kinds: string }[] {
  const processKinds = new Set(items.map((i) => processDetailLabel(i.cognitiveProcess)));
  const formatKinds = new Set(items.map((i) => responseFormatLabel(i.responseFormat)));
  const situationKinds = new Set(passages.map((p) => situationLabel(p.situation)));
  const textFormatKinds = new Set(passages.map((p) => textFormatLabel(p.textFormat)));
  const textTypeKinds = new Set(passages.map((p) => textTypeLabel(p.textType)));
  return [
    { dimension: '인지 과정', subcategory: '정보 찾기 / 이해 / 평가·성찰', kinds: [...processKinds].join(', ') },
    { dimension: '텍스트 상황', subcategory: '개인·공적·교육·직업', kinds: [...situationKinds].join(', ') },
    { dimension: '텍스트 체재', subcategory: '연속·비연속·혼합', kinds: [...textFormatKinds].join(', ') },
    { dimension: '텍스트 유형', subcategory: '기술·서사·설명·논증·지시·상호작용', kinds: [...textTypeKinds].join(', ') },
    { dimension: '응답 형식', subcategory: '선다·구성형', kinds: [...formatKinds].join(', ') },
  ];
}
