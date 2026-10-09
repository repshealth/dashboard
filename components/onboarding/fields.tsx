'use client';

import { useId, useRef, useState, type ReactNode } from 'react';
import { uploadImage } from '@/lib/uploads';

export function Field({ label, hint, children, wide }: { label: string; hint?: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`ob-field${wide ? ' ob-wide' : ''}`}>
      <span className="ob-label">{label}</span>
      {hint && <span className="ob-hint">{hint}</span>}
      {children}
    </div>
  );
}

export function Text({ label, hint, value, onChange, type = 'text', placeholder, wide, required }: {
  label: string; hint?: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; wide?: boolean; required?: boolean;
}) {
  const id = useId();
  return (
    <div className={`ob-field${wide ? ' ob-wide' : ''}`}>
      <label className="ob-label" htmlFor={id}>{label}{required && <span className="ob-req"> *</span>}</label>
      {hint && <span className="ob-hint">{hint}</span>}
      <input id={id} className="ob-input" type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function Area({ label, hint, value, onChange, placeholder, rows = 3 }: {
  label: string; hint?: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  const id = useId();
  return (
    <div className="ob-field ob-wide">
      <label className="ob-label" htmlFor={id}>{label}</label>
      {hint && <span className="ob-hint">{hint}</span>}
      <textarea id={id} className="ob-input ob-area" rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function Colour({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div className="ob-field">
      <label className="ob-label" htmlFor={id}>{label}</label>
      <div className="ob-colour">
        <input id={id} type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value)} aria-label={`${label} picker`} />
        <input className="ob-input" value={value} onChange={(e) => onChange(e.target.value)} aria-label={`${label} hex code`} maxLength={7} />
      </div>
    </div>
  );
}

export function Choice<T extends string>({ label, value, options, onChange, wide }: {
  label: string; value: T; options: { value: T; title: string; desc?: string; preview?: ReactNode }[]; onChange: (v: T) => void; wide?: boolean;
}) {
  return (
    <div className={`ob-field${wide ? ' ob-wide' : ''}`} role="radiogroup" aria-label={label}>
      <span className="ob-label">{label}</span>
      <div className="ob-choices">
        {options.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={value === o.value}
            className={`ob-choice${value === o.value ? ' on' : ''}`} onClick={() => onChange(o.value)}>
            {o.preview}
            <b>{o.title}</b>
            {o.desc && <span>{o.desc}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Chips({ label, hint, options, value, onChange }: {
  label: string; hint?: string; options: string[]; value: string[]; onChange: (v: string[]) => void;
}) {
  const [custom, setCustom] = useState('');
  const all = [...options, ...value.filter((v) => !options.includes(v))];
  const toggle = (o: string) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
  return (
    <div className="ob-field ob-wide">
      <span className="ob-label">{label}</span>
      {hint && <span className="ob-hint">{hint}</span>}
      <div className="ob-chips">
        {all.map((o) => (
          <button key={o} type="button" aria-pressed={value.includes(o)} className={`ob-chip${value.includes(o) ? ' on' : ''}`} onClick={() => toggle(o)}>{o}</button>
        ))}
      </div>
      <div className="ob-add">
        <input className="ob-input" placeholder="Add your own" value={custom} onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && custom.trim()) { e.preventDefault(); onChange([...value, custom.trim()]); setCustom(''); } }} />
        <button type="button" className="btn" disabled={!custom.trim()} onClick={() => { onChange([...value, custom.trim()]); setCustom(''); }}>Add</button>
      </div>
    </div>
  );
}

/** One image, uploaded as soon as it is chosen. */
export function Photo({ label, hint, value, onChange, square }: {
  label: string; hint?: string; value?: string; onChange: (v?: string) => void; square?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  const pick = async (file?: File) => {
    if (!file) return;
    setState('busy');
    try { onChange(await uploadImage(file, { maxSide: square ? 800 : 1800 })); setState('idle'); }
    catch (e) { setState('error'); setMsg(e instanceof Error ? e.message : 'Upload failed.'); }
  };
  return (
    <div className="ob-field">
      <span className="ob-label">{label}</span>
      {hint && <span className="ob-hint">{hint}</span>}
      <div className={`ob-photo${square ? ' sq' : ''}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]); }}>
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt={label} />
            <button type="button" className="ob-x" aria-label={`Remove ${label}`} onClick={() => onChange(undefined)}>×</button>
          </>
        ) : (
          <button type="button" className="ob-drop" onClick={() => ref.current?.click()} disabled={state === 'busy'}>
            {state === 'busy' ? 'Uploading…' : <>Drop an image or <u>choose a file</u></>}
          </button>
        )}
        <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      {state === 'error' && <span className="ob-err">{msg}</span>}
    </div>
  );
}

/** Several images, e.g. app screenshots. */
export function Photos({ label, hint, value, onChange, max = 6 }: {
  label: string; hint?: string; value: string[]; onChange: (v: string[]) => void; max?: number;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true); setErr('');
    const out: string[] = [];
    for (const f of Array.from(files).slice(0, max - value.length)) {
      try { out.push(await uploadImage(f, { maxSide: 1400 })); } catch (e) { setErr(e instanceof Error ? e.message : 'Upload failed.'); }
    }
    onChange([...value, ...out]);
    setBusy(false);
  };
  return (
    <div className="ob-field ob-wide">
      <span className="ob-label">{label}</span>
      {hint && <span className="ob-hint">{hint}</span>}
      <div className="ob-photos" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); add(e.dataTransfer.files); }}>
        {value.map((src, i) => (
          <div key={i} className="ob-thumb">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`${label} ${i + 1}`} />
            <button type="button" className="ob-x" aria-label={`Remove image ${i + 1}`} onClick={() => onChange(value.filter((_, j) => j !== i))}>×</button>
          </div>
        ))}
        {value.length < max && (
          <button type="button" className="ob-thumb ob-thumb-add" onClick={() => ref.current?.click()} disabled={busy}>
            {busy ? 'Uploading…' : '+ Add'}
          </button>
        )}
        <input ref={ref} type="file" accept="image/*" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
      </div>
      {err && <span className="ob-err">{err}</span>}
    </div>
  );
}
