import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Phone } from './ExploreFeatures';
import { InstitutionLogo } from './InstitutionLogo';

/**
 * "Make it yours" — theme picker on the landing page.
 * Big color circles (Dark, Light, Orange) plus a "Choose your own" pill (native color
 * picker). Orange + custom are hidden for now: flip SHOW_COLOR_THEMES to bring them back. Three phones below re-theme live. Dark keeps the app's dither background;
 * Light is plain; Orange and custom themes use a smooth gradient in their own color.
 */

type Theme = {
  key: string; name: string; caption: string;
  swatch: string;            // circle fill
  bg: string | 'dither';     // screen background
  ink: string; muted: string; faint: string; accent: string;
  card: string; cardBorder: string; onPill: string; pill: string; light?: boolean;
};

const DARK: Theme = {
  key: 'dark', name: 'Dark', caption: "Dark. Kaya's default, with the green dither glow.",
  swatch: 'radial-gradient(circle at 50% 120%, #193F2F, #070C0A 70%)', bg: 'dither',
  ink: '#ffffff', muted: '#dcf5df', faint: '#6e8777', accent: '#399d74',
  card: 'rgba(66,66,66,0.14)', cardBorder: 'rgba(255,255,255,0.07)', pill: '#dcf5df', onPill: '#000000',
};
const LIGHT: Theme = {
  key: 'light', name: 'Light', caption: 'Light. Clean and bright for daytime checks.',
  swatch: 'linear-gradient(160deg, #ffffff, #e9ecea)', bg: 'linear-gradient(180deg, #ffffff 0%, #f2f4f3 100%)',
  ink: '#18181b', muted: '#6b6b70', faint: '#96969c', accent: '#399d74',
  card: 'rgba(255,255,255,0.92)', cardBorder: 'rgba(0,0,0,0.07)', pill: '#18181b', onPill: '#ffffff', light: true,
};
const ORANGE: Theme = {
  key: 'orange', name: 'Orange', caption: 'Orange. A warm gradient with yellow highlights.',
  swatch: 'linear-gradient(160deg, #FECA53, #FF7A00)',
  bg: 'linear-gradient(170deg, #0d0e12 0%, #1d1e26 42%, #5a2508 76%, #FF7A00 118%)',
  ink: '#F8F9FB', muted: '#FECA53', faint: '#8d8f9c', accent: '#FF7A00',
  card: 'rgba(255,255,255,0.06)', cardBorder: 'rgba(255,255,255,0.08)', pill: '#FECA53', onPill: '#000000',
};

const SHOW_COLOR_THEMES = false;

// ---- custom theme from any hex ---------------------------------------------
const hexToHsl = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16), r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l * 100];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s * 100, l * 100];
};
const customTheme = (hex: string): Theme => {
  const [h, s] = hexToHsl(hex);
  const sat = Math.max(35, Math.min(85, s));
  return {
    key: 'custom', name: 'Your color', caption: `Your color. ${hex.toUpperCase()} across every screen.`,
    swatch: hex,
    bg: `linear-gradient(170deg, hsl(${h} 18% 6%) 0%, hsl(${h} 22% 11%) 42%, hsl(${h} ${sat}% 22%) 76%, hsl(${h} ${sat}% 45%) 118%)`,
    ink: '#ffffff', muted: `hsl(${h} ${sat}% 86%)`, faint: `hsl(${h} 10% 58%)`, accent: hex,
    card: 'rgba(255,255,255,0.06)', cardBorder: 'rgba(255,255,255,0.08)', pill: `hsl(${h} ${sat}% 86%)`, onPill: '#000000',
  };
};

// ---- themed screen pieces (292px wide screens) -----------------------------
const tr = 'transition-[color,background-color,border-color,opacity] duration-500';

const Bg: React.FC<{ themes: Theme[]; on: string }> = ({ themes, on }) => (
  <>
    {themes.map(t => (
      <div key={t.key} className="absolute inset-0 transition-opacity duration-700" style={{
        opacity: t.key === on ? 1 : 0,
        ...(t.bg === 'dither'
          ? { backgroundColor: '#000', backgroundImage: 'url(/bg-dither.png)', backgroundSize: 'cover', backgroundPosition: 'center bottom' }
          : { background: t.bg }),
      }} />
    ))}
  </>
);

const Card: React.FC<{ t: Theme; children: React.ReactNode; className?: string }> = ({ t, children, className = '' }) => (
  <div className={`rounded-[18px] border ${tr} ${className}`}
    style={{ background: t.card, borderColor: t.cardBorder, boxShadow: t.light ? '0 6px 20px rgba(0,0,0,0.06)' : 'none', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
    {children}
  </div>
);
const Lbl: React.FC<{ t: Theme; children: React.ReactNode }> = ({ t, children }) => (
  <p className={`text-[8.5px] font-medium uppercase tracking-[1px] ${tr}`} style={{ color: t.muted }}>{children}</p>
);
const Status: React.FC<{ t: Theme }> = ({ t }) => (
  <div className={`flex justify-between px-6 pt-3 text-[10px] font-semibold ${tr}`} style={{ color: t.ink }}><span>9:41</span><i className="w-3.5 h-2 rounded-[2px] border" style={{ borderColor: t.ink, opacity: 0.7 }} /></div>
);
const Title: React.FC<{ t: Theme; title: string; sub?: string }> = ({ t, title, sub }) => (
  <div className="px-4 pt-7">
    <p className={`text-[20px] font-medium leading-tight ${tr}`} style={{ color: t.ink }}>{title}</p>
    {sub && <p className={`text-[10px] mt-0.5 ${tr}`} style={{ color: t.faint }}>{sub}</p>}
  </div>
);
const Row: React.FC<{ t: Theme; inst: string; name: string; amount: string; last?: boolean }> = ({ t, inst, name, amount, last }) => (
  <div className={`flex items-center gap-2.5 px-3 py-2.5 ${last ? '' : 'border-b'} ${tr}`} style={{ borderColor: t.cardBorder }}>
    <InstitutionLogo name={inst} size={28} radius={9} />
    <span className="flex-1 min-w-0">
      <span className={`block text-[11px] font-medium truncate ${tr}`} style={{ color: t.ink }}>{name}</span>
      <span className={`block text-[9px] ${tr}`} style={{ color: t.faint }}>{inst}</span>
    </span>
    <span className={`text-[11px] font-semibold tabular-nums ${tr}`} style={{ color: t.ink }}>{amount}</span>
  </div>
);

const HomeScreen: React.FC<{ t: Theme }> = ({ t }) => {
  const d = 'M0 40 L18 35 L32 37 L48 29 L64 32 L82 24 L98 27 L116 18 L134 21 L152 13 L172 15 L190 8 L264 10';
  return (
    <>
      <Status t={t} />
      <div className="px-4 pt-6"><p className={`text-[16px] font-semibold ${tr}`} style={{ color: t.ink }}>Hi, Jazz!</p></div>
      <Card t={t} className="mx-3 mt-4 p-3.5">
        <Lbl t={t}>Net worth</Lbl>
        <div className="flex items-baseline gap-1 mt-1">
          <span className={`text-[18px] ${tr}`} style={{ color: t.faint }}>₱</span>
          <span className={`text-[26px] font-medium tracking-tight tabular-nums ${tr}`} style={{ color: t.ink }}>1,847,200</span>
        </div>
        <p className="text-[10px] mt-0.5"><span className={`font-medium ${tr}`} style={{ color: t.accent }}>+4.2%</span> <span className={tr} style={{ color: t.faint }}>past month</span></p>
        <svg viewBox="0 0 264 52" className="w-[calc(100%+28px)] -mx-3.5 h-[52px] mt-2" aria-hidden>
          <path d={`${d} L264 52 L0 52 Z`} style={{ fill: t.accent, opacity: 0.14, transition: 'fill .5s' }} />
          <path d={d} fill="none" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" style={{ stroke: t.accent, transition: 'stroke .5s' }} />
        </svg>
        <div className="flex justify-between mt-2 text-[8px] font-medium">
          {['1D', '1W', '1M', '3M', 'YTD', '1Y', 'ALL'].map(r => (
            <span key={r} className={`px-2 py-[3px] rounded-full ${tr}`} style={r === '1M' ? { background: t.pill, color: t.onPill } : { color: t.faint }}>{r}</span>
          ))}
        </div>
      </Card>
      <div className="px-4 mt-4 mb-2"><Lbl t={t}>Top assets</Lbl></div>
      <Card t={t} className="mx-3 overflow-hidden">
        <Row t={t} inst="BPI" name="Emergency Fund" amount="₱220,000" />
        <Row t={t} inst="Wealthsimple" name="TFSA" amount="C$16,800" />
        <Row t={t} inst="Ledger" name="Bitcoin" amount="₿0.21" last />
      </Card>
    </>
  );
};

const PortfolioScreen: React.FC<{ t: Theme }> = ({ t }) => {
  const segs: [string, number][] = [['Equities', 38], ['Philippine Banks', 27], ['Crypto Assets', 15], ['International Banks', 12], ['Others', 8]];
  const op = [1, 0.75, 0.5, 0.32, 0.18];
  return (
    <>
      <Status t={t} />
      <Title t={t} title="Portfolio" sub="Tap to view details" />
      <Card t={t} className="mx-3 mt-4 p-3.5">
        <div className="flex items-center justify-between">
          <Lbl t={t}>Overview</Lbl>
          <span className="flex gap-0.5 text-[8.5px] font-medium">
            <span className={`px-2 py-[3px] rounded-full ${tr}`} style={{ background: t.pill, color: t.onPill }}>By type</span>
            <span className={`px-2 py-[3px] ${tr}`} style={{ color: t.faint }}>By currency</span>
          </span>
        </div>
        <div className="flex gap-[3px] h-[7px] mt-3.5">
          {segs.map(([k, p], i) => (
            <div key={k} className="rounded-full" style={{ flexGrow: p, background: i === 0 ? `linear-gradient(90deg, ${t.accent}, ${t.muted})` : t.accent, opacity: i === 0 ? 1 : op[i], transition: 'background .5s' }} />
          ))}
        </div>
        <div className="mt-3 space-y-1.5">
          {segs.map(([k, p], i) => (
            <div key={k} className="flex items-center justify-between text-[10.5px]">
              <span className={`flex items-center gap-2 ${tr}`} style={{ color: t.ink }}><i className="w-1.5 h-1.5 rounded-full" style={{ background: t.accent, opacity: op[i], transition: 'background .5s' }} />{k}</span>
              <span className={`font-medium tabular-nums ${tr}`} style={{ color: t.ink }}>{p}%</span>
            </div>
          ))}
        </div>
      </Card>
      <div className="px-4 mt-4 mb-2"><Lbl t={t}>Philippine banks</Lbl></div>
      <Card t={t} className="mx-3 overflow-hidden">
        <Row t={t} inst="BDO" name="Savings" amount="₱185,400" />
        <Row t={t} inst="Maribank" name="High-yield Savings" amount="₱96,000" last />
      </Card>
    </>
  );
};

const IncomeScreen: React.FC<{ t: Theme }> = ({ t }) => {
  const v = [4800, 5200, 6100, 5400, 6900, 7300, 6600, 7900, 7700, 7135, 8450];
  return (
    <>
      <Status t={t} />
      <Title t={t} title="Passive Income" sub="Track how your dividends & interest grow" />
      <Card t={t} className="mx-3 mt-4 p-3.5">
        <div className="flex items-center justify-between">
          <Lbl t={t}>November 2026</Lbl>
          <span className={`text-[10px] font-medium ${tr}`} style={{ color: t.accent }}>↑ 18.4%</span>
        </div>
        <div className="flex items-baseline gap-1 mt-1.5">
          <span className={`text-[16px] ${tr}`} style={{ color: t.faint }}>₱</span>
          <span className={`text-[26px] font-medium tabular-nums ${tr}`} style={{ color: t.ink }}>8,450</span>
        </div>
        <div className="relative flex items-end gap-[5px] h-[96px] mt-3">
          {v.map((x, i) => (
            <div key={i} className="flex-1 rounded-t-[5px] rounded-b-[2px]"
              style={{ height: `${(x / 9000) * 100}%`, background: `linear-gradient(0deg, ${t.accent}, ${t.muted})`, opacity: i === 10 ? 1 : 0.4, transition: 'background .5s' }} />
          ))}
        </div>
      </Card>
      <div className="px-4 mt-4 mb-2"><Lbl t={t}>November 2026</Lbl></div>
      <Card t={t} className="mx-3 overflow-hidden">
        {[['JFC Dividend', 'Dividend · Nov 3', '+₱5,200'], ['Maribank Interest', 'Interest · Nov 1', '+₱3,250']].map(([n, c, a], i) => (
          <div key={n} className={`flex items-center gap-2.5 px-3 py-2.5 ${i ? '' : 'border-b'} ${tr}`} style={{ borderColor: t.cardBorder }}>
            <span className="w-7 h-7 rounded-[9px] flex items-center justify-center text-[12px] font-semibold" style={{ background: t.accent, color: t.light ? '#fff' : '#000', transition: 'background .5s' }}>↙</span>
            <span className="flex-1"><span className={`block text-[11px] font-medium ${tr}`} style={{ color: t.ink }}>{n}</span><span className={`block text-[9px] ${tr}`} style={{ color: t.faint }}>{c}</span></span>
            <span className={`text-[11px] font-semibold ${tr}`} style={{ color: t.ink }}>{a}</span>
          </div>
        ))}
      </Card>
    </>
  );
};

// ---- section ----------------------------------------------------------------
export const ThemeShowcase: React.FC = () => {
  const [sel, setSel] = useState<'dark' | 'light' | 'orange' | 'custom'>('dark');
  const [hex, setHex] = useState('#7c5cff');
  const picker = useRef<HTMLInputElement>(null);
  const custom = useMemo(() => customTheme(hex), [hex]);
  const themes = [DARK, LIGHT, ORANGE, custom];
  const t = themes.find(x => x.key === sel)!;
  // Section entrance: the toggle, then the three phones, once the section scrolls into view
  const rootRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setInView(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); io.disconnect(); } }, { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const Circle: React.FC<{ th: Theme }> = ({ th }) => {
    const on = sel === th.key;
    return (
      <button onClick={() => setSel(th.key as typeof sel)} aria-label={th.name} aria-pressed={on}
        className="relative w-[42px] h-[42px] sm:w-[46px] sm:h-[46px] rounded-full flex items-center justify-center transition-transform hover:scale-105"
        style={{ background: th.swatch, boxShadow: `0 0 0 1px rgba(255,255,255,0.12) inset${on ? ', 0 0 0 2px #0b1712, 0 0 0 3.5px #fff' : ''}` }}>
        <span className="text-[9.5px] font-semibold transition-opacity duration-300" style={{ color: th.light ? '#18181b' : '#ffffff', opacity: on ? 1 : 0.45 }}>{th.name}</span>
      </button>
    );
  };

  return (
    <div ref={rootRef}>
      {/* Picker */}
      <div className="flex items-start justify-center gap-4 sm:gap-5 flex-wrap"
        style={{ opacity: inView ? 1 : 0, transform: inView ? 'none' : 'translateY(16px)', transition: 'opacity .6s ease 100ms, transform .7s cubic-bezier(.22,1,.36,1) 100ms' }}>
        {/* Segmented Dark / Light toggle (Figma 120:5717 / 120:5789); the active pill slides */}
        <div role="radiogroup" aria-label="Theme" className="kaya-frost inline-flex p-2 rounded-[20px]">
          <span aria-hidden className="absolute top-2 bottom-2 left-2 w-[88px] rounded-[12px] overflow-hidden transition-transform duration-[450ms] ease-[cubic-bezier(.22,1,.36,1)]"
            style={{ transform: sel === 'light' ? 'translateX(88px)' : 'none', boxShadow: '0 0 0 2px #dcf5df inset' }}>
            {/* dark knob: black with a soft green glow; light knob: white */}
            <span className="absolute inset-0 transition-opacity duration-300" style={{ background: 'radial-gradient(70% 90% at 50% 100%, rgba(16,185,129,0.25), rgba(16,185,129,0) 70%), #000', opacity: sel === 'light' ? 0 : 1 }} />
            <span className="absolute inset-0 transition-opacity duration-300 bg-white" style={{ opacity: sel === 'light' ? 1 : 0 }} />
            <span className="absolute inset-0 rounded-[12px]" style={{ boxShadow: '0 0 0 2px #dcf5df inset' }} />
          </span>
          {[DARK, LIGHT].map(th => {
            const on = sel === th.key;
            return (
              <button key={th.key} role="radio" aria-checked={on} onClick={() => setSel(th.key as typeof sel)}
                className="relative z-10 w-[88px] h-[52px] rounded-[12px] text-[16px] font-semibold transition-[color,opacity] duration-300"
                style={{ color: on && th.light ? '#000' : '#dcf5df', opacity: on ? 1 : 0.45 }}>
                {th.name}
              </button>
            );
          })}
        </div>
        {SHOW_COLOR_THEMES && <Circle th={ORANGE} />}
        {SHOW_COLOR_THEMES && <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => { setSel('custom'); picker.current?.click(); }}
            aria-pressed={sel === 'custom'}
            className="h-14 sm:h-16 pl-2 pr-5 rounded-full flex items-center gap-3 bg-white/[0.08] hover:bg-white/[0.13] transition-colors"
            style={{ boxShadow: sel === 'custom' ? '0 0 0 2px #0b1712, 0 0 0 3.5px #fff' : 'none' }}>
            <span className="w-10 h-10 sm:w-12 sm:h-12 rounded-full" style={{ background: sel === 'custom' ? hex : 'conic-gradient(#ff5f6d, #ffc371, #f9f871, #4ade80, #22d3ee, #818cf8, #e879f9, #ff5f6d)' }} />
            <span className="text-[14px] font-medium text-white whitespace-nowrap">Choose your own</span>
          </button>
          <span className={`text-[12px] font-medium ${sel === 'custom' ? 'text-white' : 'text-zinc-500'}`}>{sel === 'custom' ? hex.toUpperCase() : 'Any color'}</span>
          <input ref={picker} type="color" value={hex} onChange={e => { setHex(e.target.value); setSel('custom'); }} className="sr-only" aria-label="Pick your own color" />
        </div>}
      </div>

      {/* Phones: each one fades out toward its own bottom (same fade on all three, so no
          phone's rounded bottom shows), and they rise in one after another */}
      <div className="mt-10 sm:mt-14 pt-8 pb-6 flex gap-4 sm:gap-6 justify-start lg:justify-center overflow-x-auto overflow-y-hidden lg:overflow-x-hidden no-scrollbar snap-x snap-mandatory lg:snap-none -mx-6 px-6">
        {[HomeScreen, PortfolioScreen, IncomeScreen].map((S, i) => {
          const fade = 'linear-gradient(to bottom, #000 38%, transparent 76%)'; // same fade on all three
          return (
            <div key={i} className={`shrink-0 snap-center ${i === 1 ? 'lg:-translate-y-6' : 'lg:translate-y-4'}`}
              style={{ width: 320 * 0.82, height: 660 * 0.82 }}>
              <div style={{
                WebkitMaskImage: fade, maskImage: fade,
                opacity: inView ? 1 : 0, transform: inView ? 'none' : 'translateY(36px)',
                transition: `opacity .8s ease ${250 + i * 140}ms, transform .9s cubic-bezier(.22,1,.36,1) ${250 + i * 140}ms`,
              }}>
                <div className="origin-top-left" style={{ transform: 'scale(0.82)' }}>
                  <Phone bg={<Bg themes={themes} on={sel} />}><S t={t} /></Phone>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ThemeShowcase;
