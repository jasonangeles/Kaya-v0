import React, { useRef, useState } from 'react';

export interface AllocSeg { key: string; pct: number; usd: number; color: string; }

interface Props {
  segs: AllocSeg[];
  liquid: number;          // USD
  locked: number;          // USD
  liabilities: number;     // USD (positive number)
  assetsTotal: number;     // USD (gross, ex-liabilities)
  fmt: (usd: number) => string;
  privacyMode: boolean;
  allocMode: 'TYPE' | 'CURRENCY';
  onAllocMode: (m: 'TYPE' | 'CURRENCY') => void;
}

const C = 2 * Math.PI * 70; // donut circumference (r=70)

const Donut: React.FC<{ segs: AllocSeg[]; centerTop: string; centerMain: string }> = ({ segs, centerTop, centerMain }) => {
  let offset = 0;
  return (
    <svg viewBox="0 0 200 200" width="170" height="170" aria-hidden="true">
      <circle cx="100" cy="100" r="70" fill="none" stroke="rgb(var(--surface-3))" strokeWidth="24" />
      {segs.map((s, i) => {
        const len = (s.pct / 100) * C;
        const gap = Math.min(3, len);              // subtle separation
        const dash = `${Math.max(0.001, len - gap)} ${C - (len - gap)}`;
        const el = (
          <circle key={i} cx="100" cy="100" r="70" fill="none" stroke={s.color} strokeWidth="24"
            strokeDasharray={dash} strokeDashoffset={-offset} transform="rotate(-90 100 100)" strokeLinecap="butt" />
        );
        offset += len;
        return el;
      })}
      <text x="100" y="92" textAnchor="middle" fontSize="9" letterSpacing="1.4" fill="rgb(var(--faint))">{centerTop}</text>
      <text x="100" y="114" textAnchor="middle" fontSize="20" fontWeight="600" fill="rgb(var(--ink))">{centerMain}</text>
    </svg>
  );
};

export const AllocationCarousel: React.FC<Props> = ({ segs, liquid, locked, liabilities, assetsTotal, fmt, privacyMode, allocMode, onAllocMode }) => {
  const [slide, setSlide] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ down: false, sx: 0, sl: 0 });

  const go = (i: number) => {
    const t = trackRef.current; if (!t) return;
    t.scrollTo({ left: i * t.clientWidth, behavior: 'smooth' });
  };
  const onScroll = () => {
    const t = trackRef.current; if (!t) return;
    setSlide(Math.round(t.scrollLeft / t.clientWidth));
  };
  const onDown = (e: React.MouseEvent) => { const t = trackRef.current; if (!t) return; drag.current = { down: true, sx: e.pageX, sl: t.scrollLeft }; t.style.scrollSnapType = 'none'; t.style.scrollBehavior = 'auto'; };
  const onMove = (e: React.MouseEvent) => { const t = trackRef.current; if (!t || !drag.current.down) return; e.preventDefault(); t.scrollLeft = drag.current.sl - (e.pageX - drag.current.sx); };
  const onUp = () => { const t = trackRef.current; if (!t || !drag.current.down) return; drag.current.down = false; t.style.scrollSnapType = 'x mandatory'; go(Math.round(t.scrollLeft / t.clientWidth)); };

  const liqTotal = liquid + locked || 1;
  const liquidPct = (liquid / liqTotal) * 100;
  const val = (u: number) => privacyMode ? '••••' : fmt(u);

  return (
    <div className="glass-panel rounded-3xl p-5 shadow-lg mb-2">
      <div className="flex justify-between items-center mb-1">
        <h3 className="text-xs font-bold text-textMuted uppercase tracking-widest">Overview</h3>
        <div className="flex bg-surface2 rounded-full p-0.5">
          {(['TYPE', 'CURRENCY'] as const).map(m => (
            <button key={m} onClick={() => onAllocMode(m)}
              className={`px-3 py-1 text-[11px] font-medium rounded-full transition-all ${allocMode === m ? 'bg-surfaceHi text-ink' : 'text-textFaint hover:text-ink'} ${slide === 2 ? 'opacity-40 pointer-events-none' : ''}`}>
              {m === 'TYPE' ? 'By type' : 'By currency'}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={trackRef}
        onScroll={onScroll}
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={onUp}
        onMouseLeave={onUp}
        className="flex overflow-x-auto no-scrollbar select-none cursor-grab active:cursor-grabbing"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {/* Slide 1 — segmented bar */}
        <div className="shrink-0 w-full" style={{ scrollSnapAlign: 'center' }}>
          <div className="flex gap-[3px] h-3.5 mt-3 mb-4">
            {segs.map(s => <div key={s.key} style={{ flexGrow: s.pct, background: s.color }} className="rounded" />)}
          </div>
          <div className="space-y-2">
            {segs.map(s => (
              <div key={s.key} className="flex items-center justify-between">
                <span className="flex items-center gap-2.5 min-w-0"><i className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} /><span className="text-sm text-ink truncate">{s.key}</span></span>
                <span className="flex items-center gap-3 shrink-0"><span className="text-xs text-textMuted">{val(s.usd)}</span><span className="text-sm font-medium text-ink w-9 text-right">{s.pct.toFixed(0)}%</span></span>
              </div>
            ))}
          </div>
        </div>

        {/* Slide 2 — donut */}
        <div className="shrink-0 w-full" style={{ scrollSnapAlign: 'center' }}>
          <div className="flex justify-center pt-2 pb-1">
            <Donut segs={segs} centerTop="NET WORTH" centerMain={privacyMode ? '••••' : fmt(assetsTotal - liabilities)} />
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2">
            {segs.map(s => (
              <div key={s.key} className="flex items-center justify-between min-w-0">
                <span className="flex items-center gap-2 min-w-0"><i className="w-2 h-2 rounded-sm shrink-0" style={{ background: s.color }} /><span className="text-xs text-ink truncate">{s.key}</span></span>
                <span className="text-xs text-textMuted shrink-0">{s.pct.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Slide 3 — liquidity */}
        <div className="shrink-0 w-full" style={{ scrollSnapAlign: 'center' }}>
          <p className="text-[10px] text-textFaint uppercase tracking-widest mt-3 mb-1">Accessible within ~48h</p>
          <p className="text-2xl font-semibold text-ink mb-3">{val(liquid)}</p>
          <div className="flex gap-1 h-3.5 mb-4">
            <div style={{ flexGrow: Math.max(liquidPct, 1), background: '#10b981' }} className="rounded" />
            <div style={{ flexGrow: Math.max(100 - liquidPct, 1), background: '#94a3b8' }} className="rounded" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2.5"><i className="w-2.5 h-2.5 rounded-sm" style={{ background: '#10b981' }} /><span className="text-sm text-ink">Liquid · cash, banks, stocks</span></span>
              <span className="text-sm font-medium text-ink">{val(liquid)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2.5"><i className="w-2.5 h-2.5 rounded-sm" style={{ background: '#94a3b8' }} /><span className="text-sm text-ink">Locked · pension, crypto, property</span></span>
              <span className="text-sm font-medium text-ink">{val(locked)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-1.5 mt-4">
        {[0, 1, 2].map(i => (
          <button key={i} onClick={() => go(i)} aria-label={`View ${i + 1}`}
            className={`h-1.5 rounded-full transition-all duration-300 ${slide === i ? 'bg-primary w-4' : 'bg-surfaceHi w-1.5 hover:bg-textFaint'}`} />
        ))}
      </div>

      {/* Liabilities subtraction line — only when present */}
      {liabilities > 0 && (
        <div className="mt-4 pt-3 border-t border-ink/5 flex items-center justify-between text-xs">
          <span className="text-textMuted">Assets {val(assetsTotal)} <span className="text-rose-400">− Liabilities {val(liabilities)}</span></span>
          <span className="text-ink font-medium">Net {val(assetsTotal - liabilities)}</span>
        </div>
      )}
    </div>
  );
};
