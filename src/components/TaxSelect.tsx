// taxonomy 기반 select. 자유 텍스트 금지(Req 4.3). code 값만 저장.

import type { TaxOption } from '../data/taxonomy';
import { cognitiveGroups } from '../data/taxonomy';

interface TaxSelectProps {
  id?: string;
  label: string;
  value: string;
  options: TaxOption[];
  onChange: (code: string) => void;
  required?: boolean;
}

export function TaxSelect({ id, label, value, options, onChange, required }: TaxSelectProps) {
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.code} value={o.code}>
            {o.label}
            {o.ext ? ' (확장)' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}

/** 인지 과정: 대분류 optgroup으로 묶은 단일 select (Req 4.2, design §4). */
export function CognitiveProcessSelect({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: string;
  onChange: (code: string) => void;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>
        인지 과정<span aria-hidden="true"> *</span>
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {cognitiveGroups.map((g) => (
          <optgroup key={g.code} label={g.label}>
            {g.options.map((o) => (
              <option key={o.code} value={o.code}>
                {o.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
