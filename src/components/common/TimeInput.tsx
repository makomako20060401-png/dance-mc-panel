import { useEffect, useState } from 'react';

const digits = (s: string) => s.replace(/[^0-9０-９]/g, '').replace(/[０-９]/g, (c) => String(c.charCodeAt(0) - 0xfee0));

/** 分・秒で入力する時間欄。値は合計秒数でやり取りする */
export function TimeInput({
  valueSec,
  onChange,
  disabled,
  id,
  maxMinutes = 99,
}: {
  valueSec: number;
  onChange: (sec: number) => void;
  disabled?: boolean;
  id?: string;
  maxMinutes?: number;
}) {
  const [min, setMin] = useState(String(Math.floor(valueSec / 60)));
  const [sec, setSec] = useState(String(valueSec % 60));

  // 外部から値が変わった場合（初期値の差し替えなど）に追従
  useEffect(() => {
    const local = (Number(min) || 0) * 60 + (Number(sec) || 0);
    if (local !== valueSec) {
      setMin(String(Math.floor(valueSec / 60)));
      setSec(String(valueSec % 60));
    }
  }, [valueSec]);

  const emit = (m: string, s: string) => onChange((Number(m) || 0) * 60 + (Number(s) || 0));

  return (
    <div className="time-input">
      <input
        id={id}
        className="input input-num"
        inputMode="numeric"
        aria-label="分"
        value={min}
        disabled={disabled}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          let v = digits(e.target.value).slice(0, 2);
          if (Number(v) > maxMinutes) v = String(maxMinutes);
          setMin(v);
          emit(v, sec);
        }}
        onBlur={() => min === '' && setMin('0')}
      />
      <span className="time-unit">分</span>
      <input
        className="input input-num"
        inputMode="numeric"
        aria-label="秒"
        value={sec}
        disabled={disabled}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          let v = digits(e.target.value).slice(0, 2);
          if (Number(v) > 59) v = '59';
          setSec(v);
          emit(min, v);
        }}
        onBlur={() => sec === '' && setSec('0')}
      />
      <span className="time-unit">秒</span>
    </div>
  );
}

export function normalizeDigits(s: string): string {
  return digits(s);
}
