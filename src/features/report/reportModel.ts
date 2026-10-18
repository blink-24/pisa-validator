// 보고서 공통 데이터 모델 (Task 12.1, design §5.1, Req 8.2).

import { loadBundle, listSessions } from '../../data/db';
import { runConformance, type ConformanceResult } from '../../core/conformance';
import {
  computeItemStats,
  pathDistribution,
  tagComparison,
  type ItemStat,
  type TagStat,
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
  mixedTextFormat,
  mixedTextType,
  taxonomy,
} from '../../data/taxonomy';
import { combinedLabel, itemPassages } from '../../core/itemPassages';
import { formatSource } from '../../core/sourceFormat';
import type { Subtest, Passage, Item } from '../../types';

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
  /** Ⅲ 표 아래 주석 (확장 표기 '복합'을 썼을 때) */
  itemTableNotes: string[];
  itemDetails: ReportItemDetail[];
  conformance: ConformanceResult[];
  pilot?: {
    n: number;
    itemStats: ItemStat[];
    paths: Record<string, { count: number; grades: Record<string, number> }>;
    tags: Record<string, TagStat>;
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

/**
 * 보고서 Ⅲ '상황' 열 값 (Req 3.8).
 * 지문이 없으면 '-', 지문 상황이 모두 같으면 그 상황, 2개 이상인데 서로 다르면 '복합'.
 */
export function itemSituationLabel(itemPassages: Passage[]): string {
  return combinedLabel(
    itemPassages.map((p) => p.situation),
    situationLabel,
    mixedSituationLabel,
  );
}

/** 문항이 다루는 지문 기준 평가틀 특성(상황·체재·유형) — Ⅲ 표와 Ⅳ 상세가 같은 값을 쓴다 (Req 4.11) */
export function itemTextTraits(itemPassages: Passage[]): {
  situation: string;
  textFormat: string;
  textType: string;
  extMixed: boolean; // 확장 표기 '복합'(체재·유형)을 썼는지
} {
  const formats = itemPassages.map((p) => p.textFormat);
  const types = itemPassages.map((p) => p.textType);
  return {
    situation: itemSituationLabel(itemPassages),
    textFormat: combinedLabel(formats, textFormatLabel, mixedTextFormat.label),
    textType: combinedLabel(types, textTypeLabel, mixedTextType.label),
    extMixed:
      (mixedTextFormat.ext && new Set(formats).size > 1) ||
      (mixedTextType.ext && new Set(types).size > 1),
  };
}

export async function buildReportModel(subtestId: string): Promise<ReportModel> {
  const bundle = await loadBundle(subtestId);
  if (!bundle) throw new Error('소검사를 찾을 수 없습니다.');
  const { subtest, units, passages } = bundle;
  // 표·상세는 단위문항 번호 → 단위 내 문항 순서로 (문항 ID CR{단위}Q{순서}와 같은 순서)
  const unitNoOf = (it: Item) => units.find((u) => u.id === it.unitId)?.unitNo ?? 0;
  const items = [...bundle.items].sort((a, b) => unitNoOf(a) - unitNoOf(b) || a.order - b.order);

  const sessions = (await listSessions(subtestId)).filter((s) => s.submittedAt);

  const unitOf = (it: Item) => units.find((u) => u.id === it.unitId);
  const traitsById = new Map(
    items.map((it) => [it.id, itemTextTraits(itemPassages(it, unitOf(it), passages))]),
  );

  const itemTable: ReportItemRow[] = items.map((it) => {
    const unit = unitOf(it);
    const scenario = scenarioSituationLabel(unit?.scenarioSituation);
    const t = traitsById.get(it.id)!;
    return {
      unitNo: unit?.unitNo ?? 0,
      id: it.id,
      stageBlock: stageBlockLabel(it),
      process: processDetailLabel(it.cognitiveProcess),
      textFormat: t.textFormat,
      textType: t.textType,
      source: sourceRequirementLabel(it.sourceRequirement),
      scenarioSituation: scenario || '-',
      situation: t.situation,
      responseFormat: responseFormatLabel(it.responseFormat),
      difficulty: difficultyLabel(it.difficulty),
    };
  });

  const itemTableNotes = [...traitsById.values()].some((t) => t.extMixed)
    ? [
        `'${mixedTextFormat.label}'(${taxonomy.passage.text_format.label}·${taxonomy.passage.text_type.label})은 ` +
          'PISA 원 분류가 아닌 본 도구의 확장 표기로, 문항이 다루는 지문들의 값이 서로 다를 때 씁니다.',
      ]
    : [];

  const itemDetails: ReportItemDetail[] = items.map((it) => {
    const group = groupOfProcess(it.cognitiveProcess);
    const t = traitsById.get(it.id)!;
    return {
      id: it.id,
      stem: it.stem,
      characteristics: [
        { label: '인지 과정', value: `${group ? processGroupLabel(group) + ' › ' : ''}${processDetailLabel(it.cognitiveProcess)}` },
        { label: '응답 형식', value: responseFormatLabel(it.responseFormat) },
        { label: '출처 요구', value: sourceRequirementLabel(it.sourceRequirement) },
        { label: '난도', value: difficultyLabel(it.difficulty) },
        { label: '단계·묶음', value: stageBlockLabel(it) },
        { label: taxonomy.passage.situation.label, value: t.situation },
        { label: taxonomy.passage.text_format.label, value: t.textFormat },
        { label: taxonomy.passage.text_type.label, value: t.textType },
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
    .map((p) => ({
      passageTitle: p.title || '(제목 없음)',
      source: formatSource(p.source) || '(출처 미기재)',
    }));

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
    itemTableNotes,
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
