import { inkOn } from '../../model';

interface Props {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (color: string) => void;
}

/** 候補の色をタップで選ぶ。候補にない色は「その他」から自由に選べる */
export function ColorPicker({ label, value, options, onChange }: Props) {
  const isCustom = !options.some((o) => o.value.toLowerCase() === value.toLowerCase());
  return (
    <div className="color-picker" role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const selected = o.value.toLowerCase() === value.toLowerCase();
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={o.label}
            title={o.label}
            className={`swatch${selected ? ' is-selected' : ''}`}
            style={{ background: o.value, color: inkOn(o.value) }}
            onClick={() => onChange(o.value)}
          >
            {selected && '✓'}
          </button>
        );
      })}
      <label
        className={`swatch swatch-custom${isCustom ? ' is-selected' : ''}`}
        title="その他の色"
        style={isCustom ? { background: value, color: inkOn(value) } : undefined}
      >
        {isCustom ? '✓' : '＋'}
        <input type="color" value={value} aria-label="その他の色" onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  );
}
