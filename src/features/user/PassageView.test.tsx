import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PassageView } from './PassageView';
import type { Passage } from '../../types';

const M = '{소설 원문}';
const passage: Passage = {
  id: 'p1',
  unitId: 'u1',
  title: '소설 발췌',
  imageIds: [],
  bodyHtml: `<p>${M}</p>`,
  source: {},
  situation: 'personal',
  textFormat: 'continuous',
  textType: 'narration',
  organization: 'static',
};

describe('PassageView 보호 지문 (Req 3.9)', () => {
  it('풀린 코드면 원문을 보여 준다', () => {
    render(
      <PassageView
        passages={[passage]}
        protectedState={{ markers: [M], unlocked: new Map([[M, '<p>존은 환하게 웃었다.</p>']]) }}
      />,
    );
    expect(screen.getByText('존은 환하게 웃었다.')).toBeInTheDocument();
    expect(screen.queryByText(M)).toBeNull();
  });

  it('풀리지 않았거나 상태가 없으면 자리표시 대신 잠금 안내', () => {
    const { unmount } = render(
      <PassageView passages={[passage]} protectedState={{ markers: [M], unlocked: new Map() }} />,
    );
    expect(screen.getByText(/권한이 있는 응시 코드/)).toBeInTheDocument();
    expect(screen.queryByText(M)).toBeNull();
    unmount();
    render(<PassageView passages={[passage]} />);
    expect(screen.getByText(/권한이 있는 응시 코드/)).toBeInTheDocument();
  });

  it('원문에 섞인 스크립트는 정화된다', () => {
    const { container } = render(
      <PassageView
        passages={[passage]}
        protectedState={{
          markers: [M],
          unlocked: new Map([
            [M, '<p>본문</p><script>alert(1)</script><img src=x onerror=alert(1)>'],
          ]),
        }}
      />,
    );
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img[onerror]')).toBeNull();
  });
});
