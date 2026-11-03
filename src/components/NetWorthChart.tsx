import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { HistoricalPoint, TimeRange } from '../types';

export type ChartScrub = { index: number; point: HistoricalPoint; value: number } | null;

interface NetWorthChartProps {
  data: HistoricalPoint[];
  mode: 'FIAT' | 'BTC' | 'COMPARISON' | 'EXCHANGE'; // Comparison shows BTC vs USD Erosion
  displayCurrency: string;
  timeRange: TimeRange;
  /** Called with the point under the finger/cursor while scrubbing, null on release. */
  onScrub?: (s: ChartScrub) => void;
}

const SECONDARY = '#399d74';
const reduceMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Catmull-Rom → cubic Bézier for a smooth line through every point.
function smoothPath(p: number[][]) {
  if (!p.length) return '';
  if (p.length === 1) return `M${p[0][0]},${p[0][1]}`;
  let d = `M${p[0][0]},${p[0][1]}`;
  const t = 0.18;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
    d += ` C${p1[0] + (p2[0] - p0[0]) * t},${p1[1] + (p2[1] - p0[1]) * t} ${p2[0] - (p3[0] - p1[0]) * t},${p2[1] - (p3[1] - p1[1]) * t} ${p2[0]},${p2[1]}`;
  }
  return d;
}

/**
 * Net worth / balance chart: dot-pattern fill fading downward, a circle that
 * leads the line as it draws in, and press-and-drag scrubbing where the left
 * side stays active, the right side dims, and a 1px divider marks the point.
 * The value itself is shown by the parent header (via onScrub), not a tooltip.
 */
const ScrubChart: React.FC<{ data: HistoricalPoint[]; valueKey: 'totalValueBTC' | 'totalValueDisplay'; color: string; animKey: string; onScrub?: (s: ChartScrub) => void }> = ({ data, valueKey, color, animKey, onScrub }) => {
  const uid = useId().replace(/:/g, '');
  const wrapRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<SVGPathElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [intro, setIntro] = useState<{ x: number; y: number; done: boolean }>({ x: 0, y: 0, done: false });
  const [scrubI, setScrubI] = useState<number | null>(null);
  const dragging = useRef(false);
  const lastSent = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { pts, line, area } = useMemo(() => {
    const { w, h } = size;
    if (!w || !h || !data.length) return { pts: [] as number[][], line: '', area: '' };
    const vals = data.map(d => Number((d as any)[valueKey]) || 0);
    let min = Math.min(...vals), max = Math.max(...vals);
    if (max === min) { max += 1; min -= 1; }
    const PADT = 12, PADB = 4;
    const n = vals.length;
    const p = vals.map((v, i) => [n === 1 ? w / 2 : (i / (n - 1)) * w, PADT + (1 - (v - min) / (max - min)) * (h - PADT - PADB)]);
    const l = smoothPath(p);
    return { pts: p, line: l, area: `${l} L${p[p.length - 1][0]},${h} L${p[0][0]},${h} Z` };
  }, [data, valueKey, size]);

  // Entrance: draw left → right with a circle leading the line.
  useEffect(() => {
    if (!line || !lineRef.current || !pts.length) return;
    const path = lineRef.current;
    const len = path.getTotalLength();
    const end = pts[pts.length - 1];
    if (reduceMotion() || len === 0) { setIntro({ x: end[0], y: end[1], done: true }); return; }
    let raf = 0;
    const t0 = performance.now(), dur = 1200;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      const pt = path.getPointAtLength(len * e);
      setIntro({ x: pt.x, y: pt.y, done: p >= 1 });
      if (p < 1) raf = requestAnimationFrame(step);
    };
    setIntro({ x: 0, y: pts[0][1], done: false });
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // Only replay on a real data/range change, not on every resize.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animKey, size.w > 0 && size.h > 0]);

  const report = (i: number | null) => {
    if (lastSent.current === i) return;
    lastSent.current = i;
    setScrubI(i);
    if (!onScrub) return;
    if (i == null) onScrub(null);
    else onScrub({ index: i, point: data[i], value: Number((data[i] as any)[valueKey]) || 0 });
  };
  const indexAt = (clientX: number) => {
    const el = wrapRef.current; if (!el || pts.length === 0) return null;
    const r = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(r.width, clientX - r.left));
    return pts.length === 1 ? 0 : Math.round((x / r.width) * (pts.length - 1));
  };

  const { w, h } = size;
  const scrubbing = scrubI != null && !!pts[scrubI];
  const cutX = scrubbing ? pts[scrubI!][0] : intro.done ? w : intro.x;
  const last = pts[pts.length - 1];

  return (
    <div
      ref={wrapRef}
      className="w-full h-full select-none"
      style={{ touchAction: 'pan-y', cursor: data.length ? 'crosshair' : 'default' }}
      onPointerDown={(e) => { dragging.current = true; (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); report(indexAt(e.clientX)); }}
      onPointerMove={(e) => { if (dragging.current || e.pointerType === 'mouse') report(indexAt(e.clientX)); }}
      onPointerUp={() => { dragging.current = false; report(null); }}
      onPointerCancel={() => { dragging.current = false; report(null); }}
      onPointerLeave={() => { if (!dragging.current) report(null); }}
    >
      {w > 0 && h > 0 && pts.length > 0 && (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
          <defs>
            <pattern id={`dots-${uid}`} width="4" height="4" patternUnits="userSpaceOnUse">
              <circle cx="1.2" cy="1.2" r="0.9" fill={color} />
            </pattern>
            <linearGradient id={`fade-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity="0.85" />
              <stop offset="0.55" stopColor="#fff" stopOpacity="0.25" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <mask id={`mask-${uid}`}><rect width={w} height={h} fill={`url(#fade-${uid})`} /></mask>
            <clipPath id={`on-${uid}`}><rect x="-10" y="-20" width={Math.max(0, cutX + 10)} height={h + 40} /></clipPath>
            <clipPath id={`off-${uid}`}><rect x={cutX} y="-20" width={scrubbing ? Math.max(0, w - cutX + 10) : 0} height={h + 40} /></clipPath>
          </defs>

          {/* Dot-pattern fill, only on the active (left) side */}
          <g clipPath={`url(#on-${uid})`}><path d={area} fill={`url(#dots-${uid})`} mask={`url(#mask-${uid})`} /></g>
          {/* Dimmed remainder while scrubbing */}
          <path d={line} fill="none" stroke={color} strokeOpacity={0.28} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" clipPath={`url(#off-${uid})`} />
          {/* Active line (also the path the entrance animation measures) */}
          <path ref={lineRef} d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" clipPath={`url(#on-${uid})`} />

          {scrubbing ? (
            <>
              {/* 1px divider — same token as the Assets | Liabilities | Net dividers */}
              <line x1={cutX} x2={cutX} y1={0} y2={h} strokeWidth={1} style={{ stroke: 'rgb(var(--ink, 255 255 255) / 0.10)' }} />
              <circle cx={cutX} cy={pts[scrubI!][1]} r={5} fill="#0b120e" stroke={color} strokeWidth={2} />
            </>
          ) : (
            <circle cx={intro.done ? last[0] : intro.x} cy={intro.done ? last[1] : intro.y} r={4} fill={color} />
          )}
        </svg>
      )}
    </div>
  );
};

export const NetWorthChart: React.FC<NetWorthChartProps> = ({ data, mode, displayCurrency, timeRange, onScrub }) => {
  const isComparison = mode === 'COMPARISON';
  const isExchange = mode === 'EXCHANGE';

  if (!isComparison && !isExchange) {
    const valueKey = mode === 'BTC' ? 'totalValueBTC' : 'totalValueDisplay';
    const color = mode === 'BTC' ? '#F7931A' : SECONDARY;
    // Replay the draw-in whenever the range, currency or underlying series changes.
    const animKey = `${timeRange}|${displayCurrency}|${mode}|${data.length}|${data[0]?.date ?? ''}`;
    return <ScrubChart data={data} valueKey={valueKey} color={color} animKey={animKey} onScrub={onScrub} />;
  }

  // ---- Legacy modes (not used by Home / account detail) ----
  const dataKey = isExchange ? 'totalValueUSD' : 'btcPrice';
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const d = new Date(label);
    const dateLabel = !isExchange && !isNaN(d.getTime()) ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : label;
    if (isComparison) {
      return (
        <div className="kaya-pop p-3 rounded-xl min-w-[120px]">
          <p className="text-textMuted text-xs font-medium mb-2">{dateLabel}</p>
          <p className="text-[#F7931A] font-bold text-sm">${Math.round(payload[0].value).toLocaleString()}</p>
          <p className="text-rose-400 font-bold text-sm">{payload[1]?.value?.toFixed(1)}</p>
        </div>
      );
    }
    return (
      <div className="bg-textMuted text-paper px-3 py-2 rounded-xl shadow-lg shadow-black/30">
        <p className="text-sm font-semibold leading-none tabular-nums">{payload[0].value.toFixed(4)}</p>
      </div>
    );
  };

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
          <XAxis dataKey="date" hide />
          <YAxis yAxisId="left" hide domain={['auto', 'auto']} />
          {isComparison && <YAxis yAxisId="right" hide domain={[0, 110]} />}
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(220,245,223,0.35)', strokeWidth: 1 }} />
          <Line yAxisId="left" type="monotone" dataKey={dataKey} stroke={isExchange ? '#e4e4e7' : '#F7931A'} strokeWidth={2.5} dot={false} animationDuration={1200} />
          {isComparison && <Line yAxisId="right" type="monotone" dataKey="inflationIndex" stroke="#f43f5e" strokeWidth={2} strokeDasharray="4 4" dot={false} animationDuration={1200} />}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
