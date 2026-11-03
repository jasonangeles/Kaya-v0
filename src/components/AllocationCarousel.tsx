import React, { useEffect, useId, useRef, useState } from 'react';
import { Icons } from './icons';

export interface AllocSeg { key: string; pct: number; usd: number; color: string; }

interface Props {
  segs: AllocSeg[];
  liquid: number;          // USD
  locked: number;          // USD
  liabilities: number;     // USD (positive number)
  assetsTotal: number;     // USD (gross, ex-liabilities)
  fmt: (usd: number) => string;
  fmtCompact: (usd: number) => string;
  privacyMode: boolean;
  onTogglePrivacy?: () => void;
  allocMode: 'TYPE' | 'CURRENCY';
  onAllocMode: (m: 'TYPE' | 'CURRENCY') => void;
}

const LIQUID = '#399d74';            // secondary
const LOCKED = 'rgb(var(--faint))';  // faint

const reduceMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Ease-out count from the current value to `target` once `run` is true. */
function useCountUp(target: number, run: boolean, duration = 900) {
  const [v, setV] = useState(0);
  const cur = useRef(0);
  useEffect(() => {
    if (!run) return;
    if (reduceMotion()) { cur.current = target; setV(target); return; }
    const from = cur.current;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      const next = from + (target - from) * e;
      cur.current = next;
      setV(next);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, duration]);
  return v;
}

/** Half-circle gauge: liquid then locked, rounded caps, 3px gap (like the bar). */
export const LiquidityGauge: React.FC<{ liqFrac: number; progress: number }> = ({ liqFrac, progress }) => {
  const gradId = 'liq-grad-' + useId().replace(/:/g, '');
  const cx = 120, cy = 116, r = 96, sw = 17; // stroke 30% thinner than before (24 → 17)
  const half = Math.PI * r;                  // arc length of the half circle
  const pt = (a: number) => { const t = Math.PI * (1 - a); return [cx + r * Math.cos(t), cy - r * Math.sin(t)]; };
  const arc = (a0: number, a1: number, color: string) => {
    if (a1 < a0) return null;
    const [x0, y0] = pt(a0), [x1, y1] = pt(Math.max(a1, a0 + 0.0004)); // tiny length still draws a round dot
    return <path d={`M${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1}`} fill="none" strokeWidth={sw} strokeLinecap="round" style={{ stroke: color }} />;
  };
  // Rounded caps extend sw/2 past each end — trim so caps sit inside the arc.
  // Visible gap = 3 CSS px (viewBox renders ~1.25× on phones → 2.4 units).
  const cap = (sw / 2) / half;
  const gapHalf = (2.4 / 2) / half;
  const lf = Math.max(0, Math.min(1, liqFrac));
  const p = Math.max(0, Math.min(1, progress));
  const hasLiq = lf > 0.0005, hasLock = lf < 0.9995;

  // Final segment positions (arc fraction 0 = left end, 1 = right end).
  let liqA1 = hasLock ? lf - gapHalf - cap : 1 - cap;
  liqA1 = Math.max(cap, liqA1);                        // small share → at least a dot
  let lockA0 = hasLiq ? liqA1 + 2 * cap + 2 * gapHalf : cap;
  if (hasLiq && hasLock && lockA0 > 1 - cap) {         // small locked share → keep a dot on the right
    lockA0 = 1 - cap;
    liqA1 = Math.max(cap, lockA0 - 2 * cap - 2 * gapHalf);
  }
  // Sweep-in animation: reveal from the left as progress goes 0 → 1.
  const sweep = cap + (1 - 2 * cap) * p;
  // Liquid arc gradient: main green (left) → muted (right), spanning the arc's
  // FINAL extent so the colors don't stretch while it sweeps in.
  const gx1 = pt(cap)[0] - sw / 2, gx2 = pt(liqA1)[0] + sw / 2;
  const useGrad = gx2 - gx1 > sw * 2;
  return (
    <svg viewBox="0 0 240 126" width="100%" style={{ maxWidth: 300 }} aria-hidden="true">
      <defs>
        <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1={gx1} y1="0" x2={gx2} y2="0">
          <stop offset="0%" style={{ stopColor: LIQUID }} />
          <stop offset="100%" style={{ stopColor: 'rgb(var(--muted))' }} />
        </linearGradient>
      </defs>
      {hasLiq && p > 0 && arc(cap, Math.min(liqA1, sweep), useGrad ? `url(#${gradId})` : LIQUID)}
      {hasLock && sweep >= lockA0 && arc(lockA0, Math.min(1 - cap, sweep), LOCKED)}
    </svg>
  );
};

export const AllocationCarousel: React.FC<Props> = ({ segs, liquid, locked, liabilities, assetsTotal, fmt, fmtCompact, privacyMode, onTogglePrivacy, allocMode, onAllocMode }) => {
  const [slide, setSlide] = useState(0);
  const [seenLiquidity, setSeenLiquidity] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ down: false, sx: 0, sl: 0 });

  const go = (i: number) => { const t = trackRef.current; if (!t) return; t.scrollTo({ left: i * t.clientWidth, behavior: 'smooth' }); };
  const onScroll = () => { const t = trackRef.current; if (!t) return; const s = Math.round(t.scrollLeft / t.clientWidth); setSlide(s); if (s === 1) setSeenLiquidity(true); };
  const onDown = (e: React.MouseEvent) => { const t = trackRef.current; if (!t) return; drag.current = { down: true, sx: e.pageX, sl: t.scrollLeft }; t.style.scrollSnapType = 'none'; };
  const onMove = (e: React.MouseEvent) => { const t = trackRef.current; if (!t || !drag.current.down) return; e.preventDefault(); t.scrollLeft = drag.current.sl - (e.pageX - drag.current.sx); };
  const onUp = () => { const t = trackRef.current; if (!t || !drag.current.down) return; drag.current.down = false; t.style.scrollSnapType = 'x mandatory'; go(Math.round(t.scrollLeft / t.clientWidth)); };

  const net = assetsTotal - liabilities;
  const liqTotal = liquid + locked;
  const liqFrac = liqTotal > 0 ? liquid / liqTotal : 0;

  // Counters: summary on load; liquidity the first time that slide is shown.
  const aAssets = useCountUp(assetsTotal, true);
  const aLiab = useCountUp(liabilities, true);
  const aNet = useCountUp(net, true);
  const aLiquid = useCountUp(liquid, seenLiquidity);
  const aLocked = useCountUp(locked, seenLiquidity);
  const aProg = useCountUp(1, seenLiquidity, 1000);
  const hide = '••••';

  return (
    <div className="glass-panel rounded-[24px] p-5 mb-2 kaya-anim">
      {/* Header: Overview + toggle on slide 1; Liquidity (no toggle) on slide 2 */}
      <div className="flex justify-between items-center h-[25px]">
        <div className="flex items-center gap-2">
          <h3 key={slide} className="text-[11px] font-medium text-textMuted uppercase tracking-[1.2px] animate-[kayaFadeUp_0.25s_ease-out]">
            {slide === 0 ? 'Overview' : 'Liquidity'}
          </h3>
          {onTogglePrivacy && (
            <button onClick={onTogglePrivacy} aria-label={privacyMode ? 'Show amounts' : 'Hide amounts'}
              className="text-textMuted hover:text-ink transition-colors p-1 -m-1">
              {privacyMode ? <Icons.EyeOff size={14} /> : <Icons.Eye size={14} />}
            </button>
          )}
        </div>
        <div className={`flex gap-0.5 transition-opacity duration-200 ${slide === 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} aria-hidden={slide !== 0}>
          {(['TYPE', 'CURRENCY'] as const).map(m => (
            <button key={m} onClick={() => onAllocMode(m)} tabIndex={slide === 0 ? 0 : -1}
              className={`px-[10px] py-[6px] text-[10px] font-medium rounded-full transition-colors duration-200 ${allocMode === m ? 'bg-textMuted text-paper' : 'text-textFaint hover:text-ink'}`}>
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
        {/* Slide 1 — summary + allocation */}
        <div className="shrink-0 w-full" style={{ scrollSnapAlign: 'center' }}>
          <div className="grid grid-cols-3 mt-4">
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[1.2px] text-textFaint">Assets</p>
              <p className="text-[15px] font-semibold text-ink mt-1 tabular-nums truncate">{privacyMode ? hide : fmtCompact(aAssets)}</p>
            </div>
            <div className="min-w-0 border-l border-ink/10 pl-3.5">
              <p className="text-[10px] font-medium uppercase tracking-[1.2px] text-textFaint">Liabilities</p>
              <p className={`text-[15px] font-semibold mt-1 tabular-nums truncate ${liabilities > 0 ? 'text-rose-400' : 'text-textFaint'}`}>
                {privacyMode ? hide : (liabilities > 0 ? `−${fmtCompact(aLiab)}` : fmtCompact(0))}
              </p>
            </div>
            <div className="min-w-0 border-l border-ink/10 pl-3.5">
              <p className="text-[10px] font-medium uppercase tracking-[1.2px] text-textFaint">Net</p>
              <p className="text-[15px] font-semibold text-textMuted mt-1 tabular-nums truncate">{privacyMode ? hide : fmtCompact(aNet)}</p>
            </div>
          </div>

          {/* key={allocMode}: re-runs the sweep + fade when toggling type/currency */}
          <div key={allocMode}>
            <div className="flex gap-[3px] h-2.5 mt-[18px] mb-4 animate-[kayaSweep_0.6s_cubic-bezier(.22,1,.36,1)]">
              {segs.map((s, i) => (
                <div key={s.key} className="rounded-full min-w-[4px]"
                  style={{ flexGrow: s.pct, background: i === 0 ? `linear-gradient(90deg, ${LIQUID}, rgb(var(--muted)))` : s.color }} />
              ))}
            </div>
            <div className="space-y-2.5">
              {segs.map((s, i) => (
                <div key={s.key} className="flex items-center justify-between opacity-0 animate-[kayaFadeUp_0.35s_ease-out_forwards]" style={{ animationDelay: `${80 + i * 45}ms` }}>
                  <span className="flex items-center gap-2.5 min-w-0">
                    <i className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                    <span className="text-[14px] text-ink truncate">{s.key}</span>
                  </span>
                  <span className="flex items-center gap-3 shrink-0">
                    <span className="text-[12px] text-textFaint tabular-nums">{privacyMode ? hide : fmt(s.usd)}</span>
                    <span className="text-[14px] font-medium text-ink w-9 text-right tabular-nums">{s.pct.toFixed(0)}%</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Slide 2 — liquidity */}
        <div className="shrink-0 w-full" style={{ scrollSnapAlign: 'center' }}>
          <div className="grid grid-cols-2 mt-4">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full" style={{ background: LIQUID }} /><span className="text-[12px] text-textMuted">Liquid</span></div>
              <p className="text-[15px] font-semibold text-ink mt-1 tabular-nums truncate">{privacyMode ? hide : fmt(aLiquid)}</p>
              <p className="text-[11px] text-textFaint mt-0.5">Cash, banks, stocks</p>
            </div>
            <div className="min-w-0 border-l border-ink/10 pl-3.5">
              <div className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full" style={{ background: LOCKED }} /><span className="text-[12px] text-textMuted">Locked</span></div>
              <p className="text-[15px] font-semibold text-ink mt-1 tabular-nums truncate">{privacyMode ? hide : fmt(aLocked)}</p>
              <p className="text-[11px] text-textFaint mt-0.5">Pension, crypto, property</p>
            </div>
          </div>
          <div className="relative flex justify-center mt-4">
            <LiquidityGauge liqFrac={liqFrac} progress={aProg} />
            <div className="absolute inset-x-0 bottom-0 text-center">
              {/* Same size/weight as the Home net worth total */}
              <p className="text-4xl font-medium tracking-tight text-ink leading-none tabular-nums">{Math.round(liqFrac * 100 * aProg)}%</p>
              <p className="text-[11px] mt-1.5" style={{ color: LIQUID }}>liquid</p>
            </div>
          </div>
        </div>
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-1.5 mt-4">
        {[0, 1].map(i => (
          <button key={i} onClick={() => go(i)} aria-label={`View ${i + 1}`}
            className={`h-1.5 rounded-full transition-all duration-300 ${slide === i ? 'bg-[#399d74] w-4' : 'bg-ink/20 w-1.5 hover:bg-ink/40'}`} />
        ))}
      </div>
    </div>
  );
};
