// taxonomy.ko.json 로더와 코드→표시명 헬퍼 (Task 2.2).
// 개념어는 이 파일을 통해서만 접근한다. 문자열 하드코딩 금지 (tech steering).

import raw from './taxonomy.ko.json';

export interface TaxOption {
  code: string;
  label: string;
  en?: string;
  desc?: string;
  ext?: boolean;
  weight?: number;
  auto_scored?: boolean;
}

export interface TaxGroup {
  code: string;
  label: string;
  en?: string;
  options: TaxOption[];
}

export interface CodingLabel {
  code: number;
  label: string;
}

type Raw = typeof raw;

export const taxonomy = raw as Raw;

// ---- 인지 과정 (대분류 › 세부) ----

export const cognitiveGroups: TaxGroup[] = taxonomy.item_required.cognitive_process
  .groups as TaxGroup[];

/** 세부 코드 → 대분류 코드 (역참조). 예: 'literal' → 'understand' */
const detailToGroup = new Map<string, string>();
for (const g of cognitiveGroups) {
  for (const o of g.options) {
    detailToGroup.set(o.code, g.code);
  }
}

export type ProcessGroupCode = 'locate' | 'understand' | 'evaluate_reflect';

export function groupOfProcess(detailCode: string): ProcessGroupCode | undefined {
  return detailToGroup.get(detailCode) as ProcessGroupCode | undefined;
}

export function processDetailLabel(detailCode: string): string {
  for (const g of cognitiveGroups) {
    const o = g.options.find((x) => x.code === detailCode);
    if (o) return o.label;
  }
  return detailCode;
}

export function processGroupLabel(groupCode: string): string {
  const g = cognitiveGroups.find((x) => x.code === groupCode);
  return g ? g.label : groupCode;
}

// ---- 공용 옵션 조회 ----

export const responseFormatOptions = taxonomy.item_required.response_format.options as TaxOption[];
export const sourceRequirementOptions = taxonomy.item_required.source_requirement
  .options as TaxOption[];
export const difficultyOptions = taxonomy.item_required.difficulty.options as TaxOption[];

export const passageSituationOptions = taxonomy.passage.situation.options as TaxOption[];
export const passageTextFormatOptions = taxonomy.passage.text_format.options as TaxOption[];
export const passageTextTypeOptions = taxonomy.passage.text_type.options as TaxOption[];
export const passageOrganizationOptions = taxonomy.passage.organization.options as TaxOption[];
export const passageTextSourceOptions = taxonomy.passage.text_source.options as TaxOption[];

export const expectedLevelOptions = taxonomy.item_optional.expected_level.options as string[];
export const itemTagOptions = taxonomy.item_optional.item_tag.options as TaxOption[];

export const stageOptions = taxonomy.structure.stage as TaxOption[];
export const blockLevelOptions = taxonomy.structure.block_level as TaxOption[];
export const codingOptions = taxonomy.structure.coding as CodingLabel[];
export const gradeOptions = taxonomy.structure.grade as TaxOption[];

/** 옵션 배열에서 code에 해당하는 label을 찾는다. 없으면 code를 그대로 반환. */
export function labelOf(options: TaxOption[], code: string | undefined): string {
  if (code == null) return '';
  const o = options.find((x) => x.code === code);
  return o ? o.label : code;
}

export function responseFormatLabel(code: string): string {
  return labelOf(responseFormatOptions, code);
}
export function sourceRequirementLabel(code: string): string {
  return labelOf(sourceRequirementOptions, code);
}
export function difficultyLabel(code: string): string {
  return labelOf(difficultyOptions, code);
}
export function stageLabel(code: string): string {
  return labelOf(stageOptions, code);
}
export function blockLabel(code: string): string {
  if (code === 'none') return '';
  return labelOf(blockLevelOptions, code);
}
export function gradeLabel(code: string): string {
  return labelOf(gradeOptions, code);
}
export function situationLabel(code: string): string {
  return labelOf(passageSituationOptions, code);
}
export function textFormatLabel(code: string): string {
  return labelOf(passageTextFormatOptions, code);
}
export function textTypeLabel(code: string): string {
  return labelOf(passageTextTypeOptions, code);
}
export function organizationLabel(code: string): string {
  return labelOf(passageOrganizationOptions, code);
}
export function codingLabel(code: number): string {
  const o = codingOptions.find((x) => x.code === code);
  return o ? o.label : String(code);
}
export function itemTagLabel(code: string): string {
  return labelOf(itemTagOptions, code);
}

/** 응답 형식이 자동 채점 대상인지 */
export function isAutoScored(responseFormat: string): boolean {
  const o = responseFormatOptions.find((x) => x.code === responseFormat);
  return o?.auto_scored === true;
}

/** 응답 형식/태그 등이 PISA 원 분류가 아닌 확장값(ext)인지 */
export function isExtension(options: TaxOption[], code: string): boolean {
  return options.find((x) => x.code === code)?.ext === true;
}
