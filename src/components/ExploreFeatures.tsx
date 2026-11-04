import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icons } from './icons';
import { NetWorth, Liquidity, Account } from './OrbitWidgets';

/**
 * "Take a closer look" explorer (Apple iPhone page pattern).
 *
 * Desktop: feature pills on the left, visual on the right. Tapping a pill opens it into a
 * card; ↑ ↓ step through; ✕ or a click on the visual goes back to the overview.
 * Mobile: visual on top, pills scroll sideways underneath; the open card sits over the
 * bottom of the visual with ‹ › arrows.
 *
 * Each feature plays a short journey inside a phone: a tap bubble walks through the
 * steps (or the screen animates to its end state). Only the top half of the phone shows;
 * it fades out toward the bottom like the hero.
 *
 * ASSETS (optional, in /public/explore/):
 *   overview-desktop.png  1660 × 1360   overview-mobile.png  1170 × 1560
 *   phone-frame.png        960 × 1980   transparent screen cut-out, 42px bezel on every
 *                                       side, ~132px screen corner radius (3× of 320×660)
 * Until a file exists, a built-in stand-in is drawn instead.
 */

const GREEN = '#399d74';
const MUTED = '#dcf5df';
const FAINT = '#6e8777';
const ROSE = '#fb7185';
const SCREEN_W = 292;   // phone screen width in px (phone 320 wide, 14px bezel)
const SCREEN_H = 632;

// ---------------------------------------------------------------------------
// Data
type Swatch = { key: string; label: string; sym: string; value: string };
const CURRENCIES: Swatch[] = [
  { key: 'php', label: 'PHP', sym: '₱', value: '1,847,200' },
  { key: 'usd', label: 'USD', sym: '$', value: '29,067' },
  { key: 'cad', label: 'CAD', sym: 'C$', value: '40,616' },
  { key: 'btc', label: 'BTC', sym: '₿', value: '0.27' },
];

type Item = { id: string; title: string; body: string; currency?: boolean };
const ITEMS: Item[] = [
  { id: 'currency', title: 'Every currency.', body: 'Pesos, dollars, dirhams, even sats. Kaya converts it all at live rates. Tap a currency to see your total in it.', currency: true },
  { id: 'income', title: 'Passive income.', body: 'Log dividends and interest when they land. See your monthly average and how this month compares to last.' },
  { id: 'allocation', title: 'Allocation.', body: 'Switch between type and currency to see how spread out your money really is.' },
  { id: 'liquidity', title: 'Liquid vs locked.', body: "How much could you reach this week? Swipe over to see what's liquid and what's tied up in pensions, crypto or property." },
  { id: 'private', title: 'Private by design.', body: 'You type in your balances, so Kaya never connects to your bank. Add Face ID or a PIN and your numbers stay yours.' },
];

// ---------------------------------------------------------------------------
// Journey helpers

const reduceMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Steps through a timeline while `play` is true. Returns the current step (0…durations.length). */
function useSteps(play: boolean, durations: number[]) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!play) { setStep(0); return; }
    if (reduceMotion()) { setStep(durations.length); return; }
    let i = 0, t: ReturnType<typeof setTimeout>;
    setStep(0);
    const go = () => { if (i >= durations.length) return; t = setTimeout(() => { i++; setStep(i); go(); }, durations[i]); };
    go();
    return () => clearTimeout(t);
  }, [play]); // eslint-disable-line react-hooks/exhaustive-deps
  return step;
}

/** Center of an element in screen coordinates (works when the phone is scaled). */
function useCenter(screen: React.RefObject<HTMLDivElement>) {
  return (el: HTMLElement | null, dx = 0, dy = 0) => {
    const s = screen.current;
    if (!s || !el) return { x: SCREEN_W / 2, y: 200 };
    const sr = s.getBoundingClientRect(), r = el.getBoundingClientRect();
    const k = sr.width / SCREEN_W || 1;
    return { x: (r.left + r.width / 2 - sr.left) / k + dx, y: (r.top + r.height / 2 - sr.top) / k + dy };
  };
}

/** The hovering tap bubble. */
const Tap: React.FC<{ x: number; y: number; show: boolean; press: boolean; slow?: boolean }> = ({ x, y, show, press, slow }) => (
  <div className="absolute z-40 pointer-events-none"
    style={{
      left: x, top: y, opacity: show ? 1 : 0,
      transform: `translate(-50%, -50%) scale(${press ? 0.8 : 1})`,
      transition: `left ${slow ? 0.9 : 0.6}s cubic-bezier(.4,0,.2,1), top ${slow ? 0.9 : 0.6}s cubic-bezier(.4,0,.2,1), transform .15s ease, opacity .3s ease`,
    }}>
    <div className="w-9 h-9 rounded-full"
      style={{ background: 'rgba(255,255,255,0.28)', boxShadow: '0 0 0 1.5px rgba(255,255,255,0.6) inset, 0 6px 18px rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }} />
    {press && <span className="absolute inset-0 rounded-full animate-[tapRipple_.55s_ease-out]" style={{ boxShadow: '0 0 0 2px rgba(255,255,255,0.55)' }} />}
  </div>
);

// Small app pieces, sized for the 292px screen
const Glass: React.FC<{ children: React.ReactNode; className?: string; style?: React.CSSProperties }> = ({ children, className = '', style }) => (
  <div className={`rounded-[18px] border border-white/[0.07] ${className}`}
    style={{ background: 'linear-gradient(160deg, rgba(220,245,223,0.06), rgba(66,66,66,0.12) 50%, rgba(57,157,116,0.06))', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', ...style }}>
    {children}
  </div>
);
const Lbl: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[8.5px] font-medium uppercase tracking-[1px]" style={{ color: MUTED, opacity: 0.8 }}>{children}</p>
);
const Pill: React.FC<{ on: boolean; children: React.ReactNode; refEl?: React.Ref<HTMLSpanElement> }> = ({ on, children, refEl }) => (
  <span ref={refEl} className="px-2 py-[3px] rounded-full text-[8.5px] font-medium transition-colors duration-300"
    style={on ? { background: MUTED, color: '#000' } : { color: FAINT }}>{children}</span>
);
const StatusBar = () => (
  <div className="flex items-center justify-between px-6 pt-3 text-[10px] font-semibold text-white">
    <span>9:41</span>
    <span className="flex items-center gap-1 opacity-90"><i className="w-3.5 h-2 rounded-[2px] border border-white/70" /></span>
  </div>
);
const Header: React.FC<{ title: string; sub?: string }> = ({ title, sub }) => (
  <div className="px-4 pt-7">
    <p className="text-[20px] font-medium text-white leading-tight">{title}</p>
    {sub && <p className="text-[10px] mt-0.5" style={{ color: MUTED, opacity: 0.7 }}>{sub}</p>}
  </div>
);
const DotsChart: React.FC<{ id: string; drawn?: boolean }> = ({ id, drawn = true }) => {
  const d = 'M0 40 L18 35 L32 37 L48 29 L64 32 L82 24 L98 27 L116 18 L134 21 L152 13 L172 15 L190 8 L236 10';
  return (
    <svg viewBox="0 0 236 52" className="w-full h-[52px]" aria-hidden>
      <defs>
        <pattern id={`${id}-d`} width="4" height="4" patternUnits="userSpaceOnUse"><circle cx="1.2" cy="1.2" r="0.9" fill={GREEN} /></pattern>
        <linearGradient id={`${id}-f`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".85" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
        <mask id={`${id}-m`}><rect width="236" height="52" fill={`url(#${id}-f)`} /></mask>
      </defs>
      <path d={`${d} L236 52 L0 52 Z`} fill={`url(#${id}-d)`} mask={`url(#${id}-m)`} style={{ opacity: drawn ? 1 : 0, transition: 'opacity .8s ease .4s' }} />
      <path d={d} fill="none" stroke={GREEN} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" pathLength={1}
        style={{ strokeDasharray: 1, strokeDashoffset: drawn ? 0 : 1, transition: 'stroke-dashoffset 1.3s cubic-bezier(.4,.1,.2,1)' }} />
    </svg>
  );
};

// ---------------------------------------------------------------------------
// 1 · Every currency: tap the total → pick USD → total converts
const CurrencyJourney: React.FC<{ play: boolean; cur: Swatch; onPick: (c: Swatch) => void; screen: React.RefObject<HTMLDivElement> }> = ({ play, cur, onPick, screen }) => {
  const step = useSteps(play, [700, 650, 180, 650, 180, 400]);
  const caret = useRef<HTMLSpanElement>(null), usd = useRef<HTMLDivElement>(null);
  const center = useCenter(screen);
  const [tap, setTap] = useState({ x: 230, y: 260 });
  const picked = step >= 6;
  const shown = !play ? cur : picked ? cur : CURRENCIES[0];
  useEffect(() => { if (play && step === 6 && cur.key !== 'usd') onPick(CURRENCIES[1]); }, [step, play]); // eslint-disable-line
  useLayoutEffect(() => {
    if (step === 1 || step === 2) setTap(center(caret.current));
    if (step === 4 || step === 5) setTap(center(usd.current));
  }, [step]); // eslint-disable-line
  const open = step >= 3 && step < 6;
  return (
    <>
      <StatusBar />
      <div className="px-4 pt-6 flex items-center justify-between">
        <p className="text-[16px] font-semibold text-white">Hi, Jazz!</p>
        <span className="w-7 h-7 rounded-full border border-white/10 flex items-center justify-center" style={{ color: MUTED }}><Icons.User size={15} /></span>
      </div>
      <Glass className="mx-3 mt-4 p-3.5 relative">
        <Lbl>Net worth</Lbl>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="text-[18px]" style={{ color: FAINT }}>{shown.sym}</span>
          <span key={shown.key} className="text-[26px] font-medium tracking-tight text-white tabular-nums animate-[kayaFadeUp_.35s_ease-out]">{shown.value}</span>
          <span ref={caret} className="ml-0.5 self-center" style={{ color: FAINT }}><Icons.ChevronDown size={12} /></span>
        </div>
        <p className="text-[10px] mt-0.5"><span className="font-medium" style={{ color: GREEN }}>+4.2%</span> <span style={{ color: MUTED, opacity: 0.7 }}>past month</span></p>
        <div className="-mx-3.5 mt-2"><DotsChart id="cj" drawn={play} /></div>
        {/* Currency dropdown */}
        <div className="absolute left-3 top-[62px] w-[128px] rounded-[12px] py-1 z-20 transition-all duration-300 origin-top"
          style={{ background: 'rgba(14,21,18,0.96)', border: '1px solid rgba(255,255,255,0.10)', boxShadow: '0 16px 40px rgba(0,0,0,.5)', opacity: open ? 1 : 0, transform: open ? 'none' : 'translateY(-6px) scale(.97)' }}>
          {CURRENCIES.map(c => (
            <div key={c.key} ref={c.key === 'usd' ? usd : undefined}
              className={`px-3 py-1.5 text-[10.5px] flex items-center justify-between ${step >= 5 && c.key === 'usd' ? 'bg-white/10 text-white' : c.key === 'php' ? 'text-white' : 'text-white/60'}`}>
              {c.label}{c.key === 'php' && <Icons.Check size={10} />}
            </div>
          ))}
        </div>
      </Glass>
      <Glass className="mx-3 mt-3 px-3 py-2.5">
        {[['BPI', 'Emergency Fund', '₱220,000'], ['Wealthsimple', 'TFSA', 'C$16,800']].map(([i, n, a]) => (
          <div key={n} className="flex items-center gap-2.5 py-1.5">
            <span className="w-7 h-7 rounded-[9px] bg-white/10" />
            <span className="flex-1 text-[11px] font-medium text-white">{n}<br /><span className="text-[9px] font-normal" style={{ color: FAINT }}>{i}</span></span>
            <span className="text-[11px] font-semibold text-white tabular-nums">{a}</span>
          </div>
        ))}
      </Glass>
      <Tap x={tap.x} y={tap.y} show={play && step >= 1 && step < 6} press={step === 2 || step === 5} />
    </>
  );
};

// ---------------------------------------------------------------------------
// 2 · Passive income: bars grow in, tap November → headline updates
const INCOME = [4800, 5200, 6100, 5400, 6900, 7300, 6600, 7900, 7700, 7135, 8450];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];
const IncomeJourney: React.FC<{ play: boolean; screen: React.RefObject<HTMLDivElement> }> = ({ play, screen }) => {
  const step = useSteps(play, [200, 900, 700, 180, 300]);
  const nov = useRef<HTMLDivElement>(null);
  const center = useCenter(screen);
  const [tap, setTap] = useState({ x: 150, y: 300 });
  useLayoutEffect(() => { if (step === 2 || step === 3) setTap(center(nov.current, 0, 10)); }, [step]); // eslint-disable-line
  const grown = play && step >= 1;
  const sel = step >= 4 ? 10 : 9;
  const head = sel === 10
    ? { label: 'November 2026', v: '8,450', ch: '18.4%', up: true, vs: 'vs Oct' }
    : { label: 'October 2026', v: '7,135', ch: '7.3%', up: false, vs: 'vs Sep' };
  return (
    <>
      <StatusBar />
      <Header title="Passive Income" sub="Track how your dividends & interest grow" />
      <Glass className="mx-3 mt-4 p-3.5">
        <div className="flex items-center justify-between">
          <span key={head.label} className="animate-[kayaFadeUp_.3s_ease-out]"><Lbl>{head.label}</Lbl></span>
          <span className="flex gap-0.5"><Pill on>Monthly</Pill><Pill on={false}>Yearly</Pill></span>
        </div>
        <div className="flex items-end justify-between mt-1.5">
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-[16px]" style={{ color: FAINT }}>₱</span>
              <span key={head.v} className="text-[26px] font-medium text-white tabular-nums animate-[kayaFadeUp_.3s_ease-out]">{head.v}</span>
            </div>
            <p className="text-[9px]" style={{ color: FAINT }}>Averaging <span className="font-medium" style={{ color: GREEN }}>₱6,920</span> a month</p>
          </div>
          <div key={head.ch} className="text-right animate-[kayaFadeUp_.3s_ease-out]">
            <p className="text-[10px] font-medium flex items-center gap-0.5 justify-end" style={{ color: head.up ? GREEN : ROSE }}>
              {head.up ? <Icons.ArrowUp size={10} weight="bold" /> : <Icons.ArrowDown size={10} weight="bold" />}{head.ch}
            </p>
            <p className="text-[9px]" style={{ color: FAINT }}>{head.vs}</p>
          </div>
        </div>
        <div className="relative flex items-end gap-[5px] h-[96px] mt-3">
          <div className="absolute inset-x-0 border-t border-dashed" style={{ bottom: `${(6920 / 9000) * 100}%`, borderColor: 'rgba(57,157,116,.9)', opacity: grown ? 1 : 0, transition: 'opacity .5s ease 1s' }} />
          {INCOME.map((v, i) => (
            <div key={i} ref={i === 10 ? nov : undefined} className="flex-1 rounded-t-[5px] rounded-b-[2px]"
              style={{
                height: grown ? `${(v / 9000) * 100}%` : '0%',
                background: `linear-gradient(0deg, ${GREEN}, ${MUTED})`,
                opacity: i === sel ? 1 : 0.4,
                transition: `height .8s cubic-bezier(.2,.8,.2,1) ${i * 50}ms, opacity .25s ease`,
              }} />
          ))}
        </div>
        <div className="flex justify-between mt-1.5 text-[8px]" style={{ color: FAINT }}>
          {MONTHS.map((m, i) => <span key={m} className="flex-1 text-center">{i % 2 === 0 || i === 10 ? m : ''}</span>)}
        </div>
      </Glass>
      <Tap x={tap.x} y={tap.y} show={play && step >= 2 && step < 5} press={step === 3} />
    </>
  );
};

// ---------------------------------------------------------------------------
// Shared portfolio card (used by Allocation and Liquidity)
const BY_TYPE: [string, number, string][] = [['Equities', 38, ''], ['Philippine Banks', 27, MUTED], ['Crypto Assets', 15, FAINT], ['International Banks', 12, '#2b6b50'], ['Others', 8, '#3f4a44']];
const BY_CUR: [string, number, string][] = [['PHP', 62, ''], ['CAD', 21, MUTED], ['BTC', 15, FAINT], ['USD', 2, '#2b6b50'], ['', 0, '#3f4a44']];

const AllocationSlide: React.FC<{ mode: 'type' | 'cur' }> = ({ mode }) => {
  const segs = mode === 'type' ? BY_TYPE : BY_CUR;
  return (
    <div className="w-full shrink-0">
      <div className="grid grid-cols-3 mt-3">
        {[['Assets', '₱1.92M', 'text-white'], ['Liabilities', '−₱72.8K', 'text-rose-400'], ['Net', '₱1.85M', '']].map(([k, v, c], i) => (
          <div key={k} className={i ? 'border-l border-white/10 pl-2.5' : ''}>
            <p className="text-[7.5px] font-medium uppercase tracking-[1px]" style={{ color: FAINT }}>{k}</p>
            <p className={`text-[11.5px] font-semibold mt-0.5 ${c}`} style={c ? undefined : { color: MUTED }}>{v}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-[3px] h-[7px] mt-3.5">
        {segs.map(([k, p, c], i) => (
          <div key={i} className="rounded-full" style={{ flexGrow: p, flexBasis: 0, minWidth: p ? 4 : 0, background: i === 0 ? `linear-gradient(90deg, ${GREEN}, ${MUTED})` : c, transition: 'flex-grow .8s cubic-bezier(.22,1,.36,1)' }} />
        ))}
      </div>
      <div key={mode} className="mt-3 space-y-1.5 animate-[kayaFadeUp_.35s_ease-out]">
        {segs.filter(s => s[1] > 0).slice(0, 4).map(([k, p, c], i) => (
          <div key={k} className="flex items-center justify-between text-[10.5px]">
            <span className="flex items-center gap-2 text-white"><i className="w-1.5 h-1.5 rounded-full" style={{ background: i === 0 ? GREEN : c }} />{k}</span>
            <span className="font-medium text-white tabular-nums">{p}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const Dots: React.FC<{ i: number }> = ({ i }) => (
  <div className="flex justify-center gap-1 mt-3">
    {[0, 1].map(k => <span key={k} className="h-1 rounded-full transition-all duration-300" style={{ width: k === i ? 12 : 4, background: k === i ? GREEN : 'rgba(255,255,255,.2)' }} />)}
  </div>
);

// 3 · Allocation: tap "By currency" → the bar re-splits
const AllocationJourney: React.FC<{ play: boolean; screen: React.RefObject<HTMLDivElement> }> = ({ play, screen }) => {
  const step = useSteps(play, [700, 650, 180, 300]);
  const btn = useRef<HTMLSpanElement>(null);
  const center = useCenter(screen);
  const [tap, setTap] = useState({ x: 200, y: 160 });
  useLayoutEffect(() => { if (step === 1 || step === 2) setTap(center(btn.current)); }, [step]); // eslint-disable-line
  const mode = step >= 3 ? 'cur' : 'type';
  return (
    <>
      <StatusBar />
      <Header title="Portfolio" sub="Tap to view details" />
      <Glass className="mx-3 mt-4 p-3.5">
        <div className="flex items-center justify-between">
          <Lbl>Overview</Lbl>
          <span className="flex gap-0.5"><Pill on={mode === 'type'}>By type</Pill><Pill on={mode === 'cur'} refEl={btn}>By currency</Pill></span>
        </div>
        <AllocationSlide mode={mode} />
        <Dots i={0} />
      </Glass>
      <Tap x={tap.x} y={tap.y} show={play && step >= 1 && step < 4} press={step === 2} />
    </>
  );
};

// 4 · Liquidity: swipe the card → gauge sweeps in
const LiquidityJourney: React.FC<{ play: boolean }> = ({ play }) => {
  const step = useSteps(play, [700, 500, 160, 700, 250]);
  const swiped = step >= 4;
  const tapX = step >= 4 ? 80 : 230;
  const r = 70, cx = 110, cy = 92, half = Math.PI * r;
  const pt = (a: number) => { const t = Math.PI * (1 - a); return [cx + r * Math.cos(t), cy - r * Math.sin(t)]; };
  const arc = (a0: number, a1: number) => { const [x0, y0] = pt(a0), [x1, y1] = pt(a1); return `M${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1}`; };
  const cap = 7 / half, gap = 2 / half, lf = 0.58;
  const pct = useCount(58, swiped && play, 1000);
  return (
    <>
      <StatusBar />
      <Header title="Portfolio" sub="Tap to view details" />
      <Glass className="mx-3 mt-4 p-3.5 overflow-hidden">
        <div className="flex items-center justify-between h-[18px]">
          <span key={String(swiped)} className="animate-[kayaFadeUp_.3s_ease-out]"><Lbl>{swiped ? 'Liquidity' : 'Overview'}</Lbl></span>
          <span className="flex gap-0.5 transition-opacity" style={{ opacity: swiped ? 0 : 1 }}><Pill on>By type</Pill><Pill on={false}>By currency</Pill></span>
        </div>
        <div className="overflow-hidden"><div className="flex transition-transform duration-700 ease-[cubic-bezier(.22,1,.36,1)]" style={{ transform: swiped ? 'translateX(-100%)' : 'none' }}>
          <AllocationSlide mode="type" />
          <div className="w-full shrink-0">
            <div className="grid grid-cols-2 mt-3">
              {[['Liquid', '₱1,116,000', 'Cash, banks, stocks', GREEN], ['Locked', '₱804,640', 'Pension, crypto, property', FAINT]].map(([k, v, s, c], i) => (
                <div key={k} className={i ? 'border-l border-white/10 pl-2.5' : ''}>
                  <p className="text-[9.5px] flex items-center gap-1" style={{ color: MUTED, opacity: 0.8 }}><i className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />{k}</p>
                  <p className="text-[11.5px] font-semibold text-white mt-0.5">{v}</p>
                  <p className="text-[8px]" style={{ color: FAINT }}>{s}</p>
                </div>
              ))}
            </div>
            <div className="relative mt-2">
              <svg viewBox="0 0 220 104" className="w-full" aria-hidden>
                <defs><linearGradient id="lj-g" x1="0" x2="1"><stop offset="0" stopColor={GREEN} /><stop offset="1" stopColor={MUTED} /></linearGradient></defs>
                <path d={arc(cap, lf - gap - cap)} fill="none" stroke="url(#lj-g)" strokeWidth="13" strokeLinecap="round" pathLength={1}
                  style={{ strokeDasharray: 1, strokeDashoffset: swiped && play ? 0 : 1, transition: 'stroke-dashoffset .9s cubic-bezier(.22,1,.36,1) .2s' }} />
                <path d={arc(lf + gap + cap, 1 - cap)} fill="none" stroke={FAINT} strokeWidth="13" strokeLinecap="round" pathLength={1}
                  style={{ strokeDasharray: 1, strokeDashoffset: swiped && play ? 0 : 1, transition: 'stroke-dashoffset .6s ease 1s' }} />
              </svg>
              <div className="absolute inset-x-0 bottom-0 text-center">
                <p className="text-[26px] font-medium text-white leading-none tabular-nums">{pct}%</p>
                <p className="text-[9px] mt-1" style={{ color: GREEN }}>liquid</p>
              </div>
            </div>
          </div>
        </div></div>
        <Dots i={swiped ? 1 : 0} />
      </Glass>
      <Tap x={tapX} y={190} show={play && step >= 1 && step < 5} press={step >= 2 && step < 4} slow />
    </>
  );
};

function useCount(target: number, run: boolean, dur = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) { setV(0); return; }
    if (reduceMotion()) { setV(target); return; }
    let raf = 0; const t0 = performance.now();
    const tick = (t: number) => { const p = Math.min(1, (t - t0) / dur); setV(Math.round(target * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, target, dur]);
  return v;
}

// 5 · Private by design: unlock with Face ID → Home fades in
const PrivateJourney: React.FC<{ play: boolean; screen: React.RefObject<HTMLDivElement> }> = ({ play, screen }) => {
  const step = useSteps(play, [700, 650, 180, 1100, 500, 300]);
  const btn = useRef<HTMLDivElement>(null);
  const center = useCenter(screen);
  const [tap, setTap] = useState({ x: 146, y: 260 });
  useLayoutEffect(() => { if (step === 1 || step === 2) setTap(center(btn.current)); }, [step]); // eslint-disable-line
  const scanning = step === 3, ok = step === 4, unlocked = step >= 5;
  return (
    <>
      <StatusBar />
      {/* Lock screen */}
      <div className="absolute inset-x-0 top-0 transition-all duration-500" style={{ opacity: unlocked ? 0 : 1, transform: unlocked ? 'scale(1.04)' : 'none' }}>
        <div className="pt-[86px] flex flex-col items-center text-center">
          <div className="relative w-[64px] h-[64px] flex items-center justify-center">
            {/* Face ID frame */}
            <span className="absolute inset-0 rounded-[18px] border-2 transition-colors duration-300" style={{ borderColor: ok ? GREEN : scanning ? MUTED : 'rgba(255,255,255,.15)' }} />
            {scanning && <span className="absolute inset-1 rounded-[14px] animate-pulse" style={{ background: 'rgba(220,245,223,.08)' }} />}
            {ok ? <span style={{ color: GREEN }}><Icons.Check size={28} weight="bold" /></span>
              : <img src="/logo-icon.svg" alt="" className="w-8 h-8" draggable={false} />}
          </div>
          <p className="text-[15px] font-semibold text-white mt-4">{ok ? 'Unlocked' : 'Kaya is locked'}</p>
          <p className="text-[10px] mt-1" style={{ color: FAINT }}>{scanning ? 'Looking for your face…' : 'Use Face ID or your PIN'}</p>
          <div ref={btn} className="mt-5 px-4 h-8 rounded-full flex items-center gap-1.5 text-[11px] font-semibold transition-colors"
            style={{ background: step === 2 ? '#c6e8cb' : MUTED, color: '#000' }}>
            <Icons.Fingerprint size={13} /> Unlock with Face ID
          </div>
          <p className="text-[10px] mt-3" style={{ color: FAINT }}>Use PIN instead</p>
        </div>
      </div>
      {/* Home, after unlock */}
      <div className="absolute inset-x-0 top-0 transition-all duration-700" style={{ opacity: unlocked ? 1 : 0, filter: unlocked ? 'none' : 'blur(8px)' }}>
        <div className="h-[34px]" />
        <div className="px-4 pt-6"><p className="text-[16px] font-semibold text-white">Hi, Jazz!</p></div>
        <Glass className="mx-3 mt-4 p-3.5">
          <Lbl>Net worth</Lbl>
          <div className="flex items-baseline gap-1 mt-1"><span className="text-[18px]" style={{ color: FAINT }}>₱</span><span className="text-[26px] font-medium tracking-tight text-white">1,847,200</span></div>
          <div className="-mx-3.5 mt-2"><DotsChart id="pj" drawn={unlocked} /></div>
        </Glass>
        <div className="mx-3 mt-3 flex items-center gap-2 rounded-[14px] px-3 py-2.5 border border-white/[0.07]" style={{ background: 'rgba(57,157,116,0.10)' }}>
          <span style={{ color: GREEN }}><Icons.Lock size={13} /></span>
          <p className="text-[10px]" style={{ color: FAINT }}>All manual. <span className="text-white font-semibold">Nothing links to your bank.</span></p>
        </div>
      </div>
      <Tap x={tap.x} y={tap.y} show={play && step >= 1 && step < 3} press={step === 2} />
    </>
  );
};

// ---------------------------------------------------------------------------
// Phone shell. Uses /explore/phone-frame.png when present, else a drawn stand-in.
export const Phone: React.FC<{ children: React.ReactNode; screenRef?: React.RefObject<HTMLDivElement>; bg?: React.ReactNode }> = ({ children, screenRef, bg }) => {
  const [png, setPng] = useState(true);
  return (
    <div className="relative" style={{ width: 320, height: 660 }}>
      {!png && <div className="absolute inset-0 rounded-[52px] bg-gradient-to-b from-zinc-600 via-zinc-900 to-black p-[2px]"><div className="w-full h-full rounded-[50px] bg-black" /></div>}
      <div ref={screenRef} className="absolute overflow-hidden bg-black" style={{ left: 14, top: 14, width: SCREEN_W, height: SCREEN_H, borderRadius: 40 }}>
        {/* app background: the app's dither unless a custom one is passed (theme showcase) */}
        {bg ?? <div className="absolute inset-0" style={{ backgroundImage: 'url(/bg-dither.png)', backgroundSize: 'cover', backgroundPosition: 'center bottom' }} />}
        <div className="relative h-full">{children}</div>
      </div>
      {!png && <div className="absolute left-1/2 -translate-x-1/2 top-[24px] w-[92px] h-[26px] rounded-full bg-black z-50" />}
      <img src="/explore/phone-frame.png" alt="" onError={() => setPng(false)} className={`absolute inset-0 w-full h-full pointer-events-none z-50 ${png ? '' : 'hidden'}`} draggable={false} />
    </div>
  );
};

/** One feature's phone, faded to transparent toward the bottom like the hero. */
const PhoneScene: React.FC<{ id: string; play: boolean; cur: Swatch; setCur: (c: Swatch) => void }> = ({ id, play, cur, setCur }) => {
  const screen = useRef<HTMLDivElement>(null);
  return (
    <div style={{ WebkitMaskImage: 'linear-gradient(to bottom, #000 42%, transparent 78%)', maskImage: 'linear-gradient(to bottom, #000 42%, transparent 78%)' }}>
      <Phone screenRef={screen}>
        {id === 'currency' && <CurrencyJourney play={play} cur={cur} onPick={setCur} screen={screen} />}
        {id === 'income' && <IncomeJourney play={play} screen={screen} />}
        {id === 'allocation' && <AllocationJourney play={play} screen={screen} />}
        {id === 'liquidity' && <LiquidityJourney play={play} />}
        {id === 'private' && <PrivateJourney play={play} screen={screen} />}
      </Phone>
    </div>
  );
};

// Overview: PNG if provided, else a widget collage
const Overview: React.FC<{ mobile?: boolean }> = ({ mobile }) => {
  const [failed, setFailed] = useState(false);
  if (!failed) return <img src={`/explore/overview-${mobile ? 'mobile' : 'desktop'}.png`} alt="" onError={() => setFailed(true)} className="w-full h-full object-cover" draggable={false} />;
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 55% 50% at 55% 50%, rgba(57,157,116,0.22), transparent 70%)' }} />
      <div className={`relative w-[360px] h-[300px] ${mobile ? 'scale-[0.85]' : ''}`}>
        <div className="absolute left-0 top-0 scale-90 origin-top-left"><NetWorth /></div>
        <div className="absolute right-0 top-24 scale-90 origin-top-right"><Liquidity /></div>
        <div className="absolute left-6 bottom-0 scale-90 origin-bottom-left"><Account inst="BPI" name="Emergency Fund" amount="₱220,000" w={250} /></div>
      </div>
    </div>
  );
};

// Crossfading stack: overview + one phone per feature
const Stage: React.FC<{ active: number | null; cur: Swatch; setCur: (c: Swatch) => void; mobile?: boolean; onClose: () => void }> = ({ active, cur, setCur, mobile, onClose }) => {
  const on = active === null ? 'overview' : ITEMS[active].id;
  const layer = (k: string) => ({ opacity: k === on ? 1 : 0, transform: k === on ? 'scale(1)' : 'scale(1.03)' });
  return (
    <div className={`absolute inset-0 ${active !== null ? 'cursor-pointer' : ''}`} onClick={() => { if (active !== null) onClose(); }}>
      <div className="absolute inset-0 transition-[opacity,transform] duration-700 pointer-events-none" style={layer('overview')}><Overview mobile={mobile} /></div>
      {ITEMS.map(it => (
        <div key={it.id} className="absolute inset-0 flex justify-center transition-[opacity,transform] duration-700 ease-[cubic-bezier(.2,.7,.2,1)] pointer-events-none" style={layer(it.id)}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 40% 45% at 50% 30%, rgba(57,157,116,0.18), transparent 70%)' }} />
          <div className={`relative ${mobile ? 'mt-3 scale-[0.82] origin-top' : 'mt-8'}`}>
            <PhoneScene id={it.id} play={on === it.id} cur={cur} setCur={setCur} />
          </div>
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Controls
const Plus = () => (
  <span className="w-5 h-5 rounded-full border border-white/40 flex items-center justify-center shrink-0"><Icons.Add size={11} /></span>
);
const pill = 'inline-flex items-center gap-2.5 h-11 pl-3 pr-5 rounded-full text-[14px] font-medium text-white bg-white/[0.08] hover:bg-white/[0.13] backdrop-blur-xl transition-colors whitespace-nowrap';

const Swatches: React.FC<{ cur: Swatch; setCur: (s: Swatch) => void }> = ({ cur, setCur }) => (
  <div className="flex gap-2 mt-4">
    {CURRENCIES.map(c => (
      <button key={c.key} onClick={(e) => { e.stopPropagation(); setCur(c); }} aria-label={`Show in ${c.label}`}
        className={`h-8 px-2.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors ${cur.key === c.key ? 'bg-[#dcf5df] text-black' : 'bg-white/10 text-white/80 hover:bg-white/15'}`}>
        {c.sym} {c.label}
      </button>
    ))}
  </div>
);

const Detail: React.FC<{ item: Item; cur: Swatch; setCur: (s: Swatch) => void; className?: string }> = ({ item, cur, setCur, className = '' }) => (
  <div onClick={e => e.stopPropagation()} className={`rounded-[28px] bg-[#1c1d1c]/90 backdrop-blur-xl p-6 text-[15px] leading-[1.45] text-white/70 animate-[kayaFadeUp_0.35s_ease-out] ${className}`}>
    <span className="font-semibold text-white">{item.title}</span> {item.body}
    {item.currency && <Swatches cur={cur} setCur={setCur} />}
  </div>
);

const Round: React.FC<{ onClick: () => void; label: string; disabled?: boolean; children: React.ReactNode }> = ({ onClick, label, disabled, children }) => (
  <button onClick={(e) => { e.stopPropagation(); onClick(); }} aria-label={label} disabled={disabled}
    className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/15 backdrop-blur-xl text-white flex items-center justify-center transition-colors disabled:opacity-30 shrink-0">
    {children}
  </button>
);

export const ExploreFeatures: React.FC = () => {
  const [active, setActive] = useState<number | null>(null);
  const [cur, setCur] = useState<Swatch>(CURRENCIES[0]);
  const n = ITEMS.length;
  const close = () => setActive(null);
  const prev = () => setActive(a => (a === null ? 0 : Math.max(0, a - 1)));
  const next = () => setActive(a => (a === null ? 0 : Math.min(n - 1, a + 1)));
  const open = (i: number) => { if (ITEMS[i].currency) setCur(CURRENCIES[0]); setActive(i); };

  useEffect(() => {
    if (active === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next();
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]); // eslint-disable-line

  return (
    <div>
      {/* ---------- Desktop ---------- */}
      <div className="hidden md:block relative h-[680px] overflow-hidden">
        <div className="absolute inset-y-0 right-0 left-[30%]"><Stage active={active} cur={cur} setCur={setCur} onClose={close} /></div>

        {active !== null && (
          <div className="absolute top-4 right-4 z-20"><Round onClick={close} label="Close"><Icons.Close size={16} /></Round></div>
        )}

        <div className="absolute inset-y-0 left-0 w-[380px] flex items-center z-10 pointer-events-none">
          {active !== null && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col gap-2 pointer-events-auto">
              <Round onClick={prev} label="Previous" disabled={active === 0}><Icons.ChevronDown size={16} className="rotate-180" /></Round>
              <Round onClick={next} label="Next" disabled={active === n - 1}><Icons.ChevronDown size={16} /></Round>
            </div>
          )}
          <div className={`flex flex-col items-start gap-3 transition-[padding] duration-300 pointer-events-auto ${active !== null ? 'pl-14' : 'pl-0'}`}>
            {ITEMS.map((it, i) => (
              active === i
                ? <Detail key={it.id} item={it} cur={cur} setCur={setCur} className="w-[320px]" />
                : <button key={it.id} onClick={() => open(i)} className={pill}><Plus />{it.title.replace(/\.$/, '')}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ---------- Mobile ---------- */}
      <div className="md:hidden">
        <div className="relative w-full overflow-hidden" style={{ aspectRatio: '3 / 4' }}>
          <Stage active={active} cur={cur} setCur={setCur} mobile onClose={close} />
          {active !== null && (
            <>
              <div className="absolute top-3 right-3 z-20"><Round onClick={close} label="Close"><Icons.Close size={16} /></Round></div>
              <div className="absolute inset-x-3 bottom-3 z-10 flex items-end gap-2">
                <Round onClick={prev} label="Previous" disabled={active === 0}><Icons.ChevronRight size={16} className="rotate-180" /></Round>
                <Detail item={ITEMS[active]} cur={cur} setCur={setCur} className="flex-1 !p-5 !text-[14px]" />
                <Round onClick={next} label="Next" disabled={active === n - 1}><Icons.ChevronRight size={16} /></Round>
              </div>
            </>
          )}
        </div>
        <div className={`flex gap-2 overflow-x-auto overflow-y-hidden no-scrollbar px-6 -mx-6 pt-4 pb-1 transition-opacity ${active !== null ? 'opacity-40' : ''}`}>
          {ITEMS.map((it, i) => (
            <button key={it.id} onClick={() => open(i)} className={`${pill} shrink-0 ${active === i ? '!bg-[#dcf5df] !text-black' : ''}`}>
              <Plus />{it.title.replace(/\.$/, '')}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ExploreFeatures;
