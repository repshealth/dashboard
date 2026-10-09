import { SOURCES } from '@/lib/constants';
import type { SourceId } from '@/lib/types';

export default function SourceTag({ source }: { source: SourceId }) {
  const s = SOURCES[source] ?? SOURCES.magnet;
  return (
    <span className="tag" style={{ color: s.text, background: `rgba(${s.rgb},.06)`, borderColor: `rgba(${s.rgb},.22)` }}>
      {s.label}
    </span>
  );
}
