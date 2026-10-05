// 지문 표시 (Req 3.5). 동적 조직 구조이거나 지문 다수면 탭 전환.

import { useState } from 'react';
import { AssetImage } from '../../components/AssetImage';
import {
  situationLabel,
  textFormatLabel,
  textTypeLabel,
  organizationLabel,
} from '../../data/taxonomy';
import type { Passage } from '../../types';

export function PassageView({ passages }: { passages: Passage[] }) {
  const [active, setActive] = useState(0);

  if (passages.length === 0) {
    return <p className="muted">지문이 없습니다.</p>;
  }

  // 동적 조직 구조이거나 지문이 2개 이상이면 탭 (Req 3.5)
  const useTabs = passages.length > 1 || passages.some((p) => p.organization === 'dynamic');
  const current = passages[Math.min(active, passages.length - 1)]!;

  return (
    <div>
      {useTabs && passages.length > 1 && (
        <div className="passage-tabs" role="tablist" aria-label="지문 탭">
          {passages.map((p, i) => (
            <button
              key={p.id}
              role="tab"
              aria-selected={active === i}
              className={active === i ? 'btn btn-sm btn-primary' : 'btn btn-sm'}
              onClick={() => setActive(i)}
            >
              {p.title || `지문 ${i + 1}`}
            </button>
          ))}
        </div>
      )}

      <PassageBody passage={current} />
    </div>
  );
}

function PassageBody({ passage }: { passage: Passage }) {
  return (
    <article>
      {passage.title && <h3 className="passage-title">{passage.title}</h3>}
      {passage.imageIds.map((id) => (
        <div key={id} className="passage-figure">
          <AssetImage assetId={id} alt={passage.title || '지문 이미지'} />
        </div>
      ))}
      <div
        className="passage-body"
        dangerouslySetInnerHTML={{ __html: passage.bodyHtml || '<p class="muted">(본문 없음)</p>' }}
      />
      <p className="passage-meta">
        {[
          situationLabel(passage.situation),
          textFormatLabel(passage.textFormat),
          textTypeLabel(passage.textType),
          organizationLabel(passage.organization),
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      {renderSource(passage)}
    </article>
  );
}

function renderSource(p: Passage) {
  const s = p.source;
  const parts = [s.author, s.work, s.publisher, s.year, s.pages ? `${s.pages}쪽` : ''].filter(
    Boolean,
  );
  if (parts.length === 0) return null;
  return <p className="passage-meta">출처: {parts.join(', ')}</p>;
}
