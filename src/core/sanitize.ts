// 지문 본문 HTML 제한 서식 정화 (Req 3.2: 굵게/기울임/문단/표/이미지만).
// 외부 라이브러리 없이 DOM 파싱 기반 화이트리스트. XSS 방지.

const ALLOWED_TAGS = new Set([
  'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U',
  'UL', 'OL', 'LI',
  'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD',
  'H3', 'H4', 'FIGURE', 'FIGCAPTION',
]);

/** 서버/테스트(jsdom)에서도 동작하도록 DOMParser 사용. */
export function sanitizeHtml(input: string): string {
  if (typeof DOMParser === 'undefined') return stripAllTags(input);
  const doc = new DOMParser().parseFromString(`<div>${input}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return '';
  clean(root);
  return root.innerHTML;
}

function clean(node: Element): void {
  const children = Array.from(node.children);
  for (const child of children) {
    if (!ALLOWED_TAGS.has(child.tagName)) {
      // 비허용 태그는 자식만 끌어올리고 자신은 제거
      const parent = child.parentNode;
      if (parent) {
        while (child.firstChild) parent.insertBefore(child.firstChild, child);
        parent.removeChild(child);
      }
      continue;
    }
    // 모든 속성 제거(이미지는 별도 자산 모델로 처리하므로 src 불필요)
    for (const attr of Array.from(child.attributes)) {
      child.removeAttribute(attr.name);
    }
    clean(child);
  }
}

function stripAllTags(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}
