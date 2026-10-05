// 데이터 모델 (design.md §2). 저장은 code 값으로, 표시는 taxonomy label로.

export type ISO = string;
export type Code = string; // taxonomy code

export type Stage = 'core' | 'stage1' | 'stage2';
export type Block = 'none' | 'low' | 'high'; // core는 'none'
export type Grade = 'high' | 'mid' | 'low';
export type Difficulty = 'low' | 'mid' | 'high';
export type ResponseFormat = 'simple_mc' | 'complex_mc' | 'open_human' | 'short_auto';
export type SourceRequirement = 'single' | 'multiple';
export type CodingValue = 2 | 1 | 0 | 9;

export interface RoutingConfig {
  firstCut: { high: number; mid: number }; // 정답률 비율, 기본 0.7 / 0.4
  assign: 'deterministic' | 'pisa_probabilistic';
  midGoesTo: 'low' | 'high'; // deterministic일 때
}

export interface GradeRule {
  highBlockCut: number; // 기본 0.5
  lowBlockCut: number; // 기본 0.7
}

export interface GradeDescriptors {
  high?: string;
  mid?: string;
  low?: string;
}

export interface Subtest {
  id: string;
  title: string;
  description: string;
  target: string; // 예: "고1(만 15세)"
  structure: 'single' | 'msat3';
  routing: RoutingConfig;
  gradeRule: GradeRule;
  gradeDescriptors?: GradeDescriptors;
  allowWithinUnitNav: boolean;
  createdAt: ISO;
  updatedAt: ISO;
}

export interface Unit {
  id: string;
  subtestId: string;
  unitNo: number; // 901, 902 ...
  title: string;
  scenarioIntro: string;
  passageIds: string[];
}

export interface PassageSource {
  author?: string;
  work?: string;
  publisher?: string;
  year?: string;
  pages?: string;
}

export interface Passage {
  id: string;
  unitId: string;
  title: string;
  bodyHtml: string; // 제한된 서식만 허용 (sanitize)
  imageIds: string[];
  source: PassageSource;
  situation: Code;
  textFormat: Code;
  textType: Code;
  organization: Code;
}

export interface Choice {
  id: string;
  text: string;
}

export interface ComplexMatrix {
  rows: { id: string; text: string; answer: string }[];
  cols: string[];
  fullCredit: 'all' | number;
}

export interface CodingCriterion {
  code: CodingValue;
  criterion: string;
  examples: string[];
}

export interface Item {
  id: string; // CR901Q01
  subtestId: string;
  unitId: string;
  order: number;
  stage: Stage;
  block: Block; // core는 'none'
  stem: string; // 발문 (HTML)

  // 필수 4속성
  cognitiveProcess: Code; // 세부 코드 (대분류는 taxonomy 역참조)
  responseFormat: ResponseFormat;
  sourceRequirement: SourceRequirement;
  difficulty: Difficulty;

  // 형식별 페이로드
  choices?: Choice[];
  answer?: string; // simple_mc 정답 choice id
  matrix?: ComplexMatrix; // complex_mc
  acceptedAnswers?: string[]; // short_auto
  normalize?: { ignoreSpace: boolean; ignoreCase: boolean };
  coding?: CodingCriterion[]; // open_human

  // 선택
  expectedLevel?: string;
  questionIntent?: string;
  tags?: Code[];
  commentary?: string;
}

export interface PathStep {
  stage: string;
  block: string;
  reason: string;
}

export interface ResponseRecord {
  itemId: string;
  answer: unknown;
  timeMs: number;
  autoScore?: number; // 자동 채점 결과 (0~1)
  humanCode?: CodingValue; // 교사 채점
}

export interface ProcessGroupStat {
  correct: number;
  total: number;
}

export interface Result {
  grade: Grade;
  provisional: boolean;
  firstJudgement: { grade: string; correct: number; total: number; rate: number };
  byProcessGroup: Record<'locate' | 'understand' | 'evaluate_reflect', ProcessGroupStat>;
  explanation: string;
}

export interface Session {
  id: string;
  subtestId: string;
  anonCode: string;
  startedAt: ISO;
  submittedAt?: ISO;
  path: PathStep[];
  responses: ResponseRecord[];
  /** 학생이 '단계 완료'로 마친 단계. 미응답 문항이 있어도 다음 단계로 넘어가게 한다. */
  completedStages?: Stage[];
  result?: Result;
  source: 'local' | 'imported';
  importedFrom?: string;
}

export interface Asset {
  id: string;
  blob: Blob;
  mime: string;
  name: string;
}

export type AppMetaKey = 'activeSubtestId' | 'lastBackupAt' | 'persisted';
export interface AppMeta {
  key: AppMetaKey;
  value: string;
}
